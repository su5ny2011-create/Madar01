import React, { useState, useEffect, useRef } from 'react';
import {
  Banknote,
  BarChart3,
  Building2,
  Calendar,
  Database,
  Globe,
  LayoutDashboard,
  Lock,
  LogOut,
  Search,
  User as UserIcon,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  X,
  Camera,
  Package,
  Printer,
} from 'lucide-react';
import type {
  AppNotification,
  AppState,
  CashAdvanceRecord,
  Customer,
  DailyNote,
  ExpenseRecord,
  ExpenseTemplate,
  Language,
  MaintenanceVisit,
  MorningCashRecord,
  PartItem,
  PurchasePaymentMethod,
  PurchaseRecord,
  ScheduleAppointment,
  User,
} from './types';
import { isUserAdmin } from './types';
import {
  archiveVisitsIntoState,
  authenticateUser,
  autoArchivePastDayFinance,
  autoArchivePastDayVisits,
  checkUpcomingAppointmentReminders,
  createCustomerBookingIntoState,
  createMaintenanceNotification,
  deleteCashAdvanceFromState,
  deleteMaintenanceVisitFromState,
  getInitialState,
  getTodayStr,
  deduplicateUsers,
  resetSystemDataState,
  restoreDayFinanceToActive,
  restoreFinanceRecordToActive,
  searchSystemRecords,
  syncAppointmentIntoState,
  syncCashAdvanceIntoState,
  syncExpenseIntoState,
  syncMaintenanceVisitIntoState,
  transferDailyFinanceToAdvanced,
  transferProfitsToMorningCash,
  unarchiveVisitFromState,
  unarchiveVisitsFromState,
} from './utils/logic';
import type { CustomerBookingInput, ProfitRolloverResult } from './utils/logic';
import {
  subscribeToLiveState,
  pushStateToFirestore,
  fetchStateFromFirestore,
} from './utils/firebaseSync';
import { googleSignIn } from './utils/googleDrive';
import { sendPwaNotification } from './utils/pwaNotifications';
import { AlMadarLogo } from './components/AlMadarLogo';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton';
import { DashboardHomeView } from './components/DashboardHomeView';
import { MaintenanceView } from './components/MaintenanceView';
import { DailyMaintenanceReportModal } from './components/DailyMaintenanceReportModal';
import { FinanceView } from './components/FinanceView';
import { AdvancedFinanceView } from './components/AdvancedFinanceView';
import { WorkNotesScannerModal, type ExtractedWorkData } from './components/WorkNotesScannerModal';
import { CatalogsView } from './components/CatalogsView';
import { ScheduleCalendarView } from './components/ScheduleCalendarView';
import { CustomerPortalView } from './components/CustomerPortalView';
import { UsersView } from './components/UsersView';
import { NotificationsCenter } from './components/NotificationsCenter';
import { BackupRestoreView } from './components/BackupRestoreView';
import { PurchasesView } from './components/PurchasesView';
import type { ExtractedPurchaseItem } from './components/InvoiceScannerModal';

type ActiveTab =
  | 'dashboard'
  | 'maintenance'
  | 'purchases'
  | 'daily_archive'
  | 'finance'
  | 'advanced_finance'
  | 'schedule'
  | 'catalogs'
  | 'stats'
  | 'backup'
  | 'users';

const STORAGE_KEY = 'al_madar_it_pwa_state_v3';
const LEGACY_STORAGE_KEYS = ['al_madar_it_pwa_state_v1', 'al_madar_it_pwa_state_v2'];
const SESSION_USER_KEY = 'al_madar_it_current_user_v2';
const CLIENT_ID = `device_${Math.random().toString(36).slice(2, 10)}`;

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [state, setState] = useState<AppState>(() => {
    const initial = getInitialState();
    try {
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        localStorage.removeItem(legacyKey);
      }
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AppState;
        if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
          const loadedPurchases = Array.isArray(parsed.purchases)
            ? parsed.purchases.map((p) => {
                const cDate =
                  typeof p?.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(p.createdAt)
                    ? p.createdAt.slice(0, 10)
                    : '';
                const iDate = typeof p?.invoiceDate === 'string' ? p.invoiceDate.trim().slice(0, 10) : '';
                if (cDate && (!iDate || iDate.slice(0, 4) < cDate.slice(0, 4))) {
                  return { ...p, invoiceDate: cDate };
                }
                return p;
              })
            : initial.purchases || [];
          const loadedState: AppState = {
            ...initial,
            ...parsed,
            purchases: loadedPurchases,
            users: deduplicateUsers(parsed.users),
            notifications: Array.isArray(parsed.notifications)
              ? parsed.notifications
              : initial.notifications || [],
          };
          const afterVisits = autoArchivePastDayVisits(
            loadedState,
            getTodayStr()
          ).state;
          return autoArchivePastDayFinance(afterVisits, getTodayStr()).state;
        }
      }
    } catch {
      // Fallback to initial seed state
    }
    const afterVisits = autoArchivePastDayVisits(initial, getTodayStr()).state;
    return autoArchivePastDayFinance(afterVisits, getTodayStr()).state;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return getInitialState().users[0];
      }
      const savedUser = localStorage.getItem(SESSION_USER_KEY);
      if (savedUser) {
        return JSON.parse(savedUser) as User;
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Public Customer Portal mode from Login Screen
  const [isPublicPortalMode, setIsPublicPortalMode] = useState(false);

  // Live notification alert banner when a customer portal request is submitted
  const [liveAlert, setLiveAlert] = useState<AppNotification | null>(null);

  // Login Form State
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('admin');
  const [loginError, setLoginError] = useState('');

  // Navigation & Global Search State
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [preselectedCustomer, setPreselectedCustomer] = useState<string>('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [isGlobalScannerOpen, setIsGlobalScannerOpen] = useState(false);
  const [isGlobalMaintReportOpen, setIsGlobalMaintReportOpen] = useState(false);

  // Helper to merge collections by id/username without accidental data wiping
  function mergeCollection<T extends { id?: string; username?: string }>(
    existing: T[] = [],
    incoming: T[] = [],
    deletedSet: Set<string>
  ): T[] {
    const map = new Map<string, T>();
    if (Array.isArray(existing)) {
      for (const item of existing) {
        const key = item?.username
          ? `usr_${item.username.trim().toLowerCase()}`
          : item?.id;
        if (
          key &&
          !deletedSet.has(key) &&
          (!item?.id || !deletedSet.has(item.id)) &&
          (!item?.username || !deletedSet.has(item.username))
        ) {
          map.set(key, item);
        }
      }
    }
    if (Array.isArray(incoming)) {
      for (const item of incoming) {
        const key = item?.username
          ? `usr_${item.username.trim().toLowerCase()}`
          : item?.id;
        if (
          key &&
          !deletedSet.has(key) &&
          (!item?.id || !deletedSet.has(item.id)) &&
          (!item?.username || !deletedSet.has(item.username))
        ) {
          const prev = map.get(key) as any;
          // Avoid overwriting 'user-admin' with legacy 'u-admin'
          if (!prev || !(prev.id === 'user-admin' && item?.id === 'u-admin')) {
            const prevUpdated =
              prev && typeof prev.updatedAt === 'number' ? prev.updatedAt : 0;
            const itemUpdated =
              item && typeof (item as any).updatedAt === 'number'
                ? (item as any).updatedAt
                : 0;

            // Keep existing item if it has a strictly newer updatedAt timestamp than incoming
            if (prev && prevUpdated > itemUpdated) {
              continue;
            }

            if (
              prev &&
              typeof prev === 'object' &&
              'isRead' in prev &&
              item &&
              typeof item === 'object' &&
              'isRead' in item
            ) {
              map.set(key, {
                ...item,
                isRead: Boolean(prev.isRead || (item as any).isRead),
              });
            } else {
              map.set(key, item);
            }
          }
        }
      }
    }
    return Array.from(map.values());
  }

  // Refs to prevent infinite sync loops, hydration race conditions & data erasure
  const isInitialMountRef = useRef(true);
  const isApplyingRemoteRef = useRef(false);
  const hasHydratedRemoteRef = useRef(false);
  const hasLocalUserMutationRef = useRef(false);
  const forceReplaceSyncRef = useRef(false);
  const resetEpochRef = useRef(1);
  const lastRemoteTimestampRef = useRef(0);
  const deletedIdsRef = useRef<Set<string>>(new Set());

  // Persist AppState to localStorage & automatically push local changes (add/edit/delete) to all devices via Server + Firestore
  useEffect(() => {
    // 1. Try to save to localStorage safely
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage quota hit (often due to heavy images). Sanitize state by trimming large data URLs and retry
      try {
        const sanitized: AppState = {
          ...state,
          purchases: (state.purchases || []).map((p) => ({
            ...p,
            invoiceImageUrl:
              p.invoiceImageUrl && p.invoiceImageUrl.length > 50000
                ? undefined
                : p.invoiceImageUrl,
          })),
          parts: (state.parts || []).map((pt) => ({
            ...pt,
            invoiceImageUrl: undefined,
          })),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      } catch {
        // Fallback: localStorage quota full
      }
    }

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (isApplyingRemoteRef.current) {
      isApplyingRemoteRef.current = false;
      return;
    }

    // Only push if remote state has already been hydrated AND a genuine user mutation occurred!
    // This prevents a newly loaded device with empty cache from overwriting existing database state on boot.
    if (!hasHydratedRemoteRef.current || !hasLocalUserMutationRef.current) {
      return;
    }

    hasLocalUserMutationRef.current = false;
    const isForceReplace = forceReplaceSyncRef.current;
    forceReplaceSyncRef.current = false;
    const currentResetEpoch = resetEpochRef.current;
    const now = Date.now();
    lastRemoteTimestampRef.current = Math.max(lastRemoteTimestampRef.current, now);
    const deletedIds = Array.from(deletedIdsRef.current);

    // 1. Push to server endpoint
    fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state,
        clientId: CLIENT_ID,
        updatedAt: now,
        deletedIds,
        forceReplace: isForceReplace,
        resetEpoch: currentResetEpoch,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.updatedAt === 'number') {
          lastRemoteTimestampRef.current = Math.max(
            lastRemoteTimestampRef.current,
            data.updatedAt
          );
        }
      })
      .catch(() => {
        // Offline fallback
      });

    // 2. Direct real-time sync with Google Cloud Firestore
    pushStateToFirestore(state, CLIENT_ID, deletedIds, {
      forceReplace: isForceReplace,
      resetEpoch: currentResetEpoch,
    })
      .then((ts) => {
        lastRemoteTimestampRef.current = Math.max(
          lastRemoteTimestampRef.current,
          ts
        );
      })
      .catch(() => {});
  }, [state]);

  // Automatic Cross-Device Real-Time Synchronization (Firestore + SSE + Polling Fallback + Cross-Tab)
  useEffect(() => {
    const applyIncomingRemoteState = (
      remoteState: AppState,
      updatedAt: number,
      sourceClientId?: string,
      incomingDeletedIds?: string[],
      forceReplace?: boolean,
      incomingResetEpoch?: number
    ) => {
      hasHydratedRemoteRef.current = true;
      if (sourceClientId === CLIENT_ID) return;

      const isNewResetEpoch =
        typeof incomingResetEpoch === 'number' &&
        incomingResetEpoch > resetEpochRef.current;

      if (!isNewResetEpoch && updatedAt <= lastRemoteTimestampRef.current) return;
      lastRemoteTimestampRef.current = Math.max(lastRemoteTimestampRef.current, updatedAt);

      if (isNewResetEpoch && typeof incomingResetEpoch === 'number') {
        resetEpochRef.current = incomingResetEpoch;
      }

      if (forceReplace || isNewResetEpoch) {
        deletedIdsRef.current.clear();
        setState(() => {
          isApplyingRemoteRef.current = true;
          return {
            ...getInitialState(),
            ...remoteState,
            users:
              Array.isArray(remoteState.users) && remoteState.users.length > 0
                ? remoteState.users
                : getInitialState().users,
          };
        });
        return;
      }

      if (Array.isArray(incomingDeletedIds)) {
        for (const did of incomingDeletedIds) {
          deletedIdsRef.current.add(did);
        }
      }

      setState((prev) => {
        const deletedSet = deletedIdsRef.current;
        const incomingNotifs = remoteState.notifications || [];
        const prevIds = new Set((prev.notifications || []).map((n) => n.id));
        const newestUnread = incomingNotifs.find(
          (n) => !n.isRead && !prevIds.has(n.id)
        );
        if (newestUnread) {
          setLiveAlert(newestUnread);
          sendPwaNotification({
            title: newestUnread.title,
            body: newestUnread.message,
            tag: newestUnread.id,
          }).catch(() => {});
        }
        isApplyingRemoteRef.current = true;

        const mergedVisits = mergeCollection(prev.visits, remoteState.visits, deletedSet);
        const mergedAppointments = mergeCollection(
          prev.appointments,
          remoteState.appointments,
          deletedSet
        ).filter((a) => !a.linkedVisitId || !deletedSet.has(a.linkedVisitId));
        const mergedNotifications = mergeCollection(
          prev.notifications,
          remoteState.notifications,
          deletedSet
        ).filter((n) => !n.linkedVisitId || !deletedSet.has(n.linkedVisitId));
        const mergedExpenses = mergeCollection(
          prev.expenses,
          remoteState.expenses,
          deletedSet
        ).filter(
          (e) =>
            (!e.linkedPurchaseId || !deletedSet.has(e.linkedPurchaseId)) &&
            (!e.linkedCashAdvanceId || !deletedSet.has(e.linkedCashAdvanceId))
        );

        const mergedCashAdvances = mergeCollection(
          prev.cashAdvances,
          remoteState.cashAdvances,
          deletedSet
        );

        const mergedPurchases = mergeCollection(
          prev.purchases,
          remoteState.purchases,
          deletedSet
        ).map((p) => {
          const cDate =
            typeof p?.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(p.createdAt)
              ? p.createdAt.slice(0, 10)
              : '';
          const iDate = typeof p?.invoiceDate === 'string' ? p.invoiceDate.trim().slice(0, 10) : '';
          if (cDate && (!iDate || iDate.slice(0, 4) < cDate.slice(0, 4))) {
            return { ...p, invoiceDate: cDate };
          }
          return p;
        });

        return {
          ...prev,
          ...remoteState,
          users: deduplicateUsers(mergeCollection(prev.users, remoteState.users, deletedSet)),
          customers: mergeCollection(prev.customers, remoteState.customers, deletedSet),
          parts: mergeCollection(prev.parts, remoteState.parts, deletedSet),
          purchases: mergedPurchases,
          cashAdvances: mergedCashAdvances,
          visits: mergedVisits,
          expenses: mergedExpenses,
          morningCash: mergeCollection(prev.morningCash, remoteState.morningCash, deletedSet),
          appointments: mergedAppointments,
          dailyNotes: mergeCollection(prev.dailyNotes, remoteState.dailyNotes, deletedSet),
          expenseTemplates: mergeCollection(prev.expenseTemplates, remoteState.expenseTemplates, deletedSet),
          notifications: mergedNotifications,
        };
      });
    };

    // 0. Real-time Firestore subscription (Device-to-device instant sync on mobile phones & desktop)
    const unsubscribeFirestore = subscribeToLiveState((payload) => {
      applyIncomingRemoteState(
        payload.state,
        payload.updatedAt,
        payload.clientId,
        payload.deletedIds,
        payload.forceReplace,
        payload.resetEpoch
      );
    });

    // 1. Initial hydration from Firestore
    fetchStateFromFirestore()
      .then((payload) => {
        if (payload && payload.state) {
          applyIncomingRemoteState(
            payload.state,
            payload.updatedAt,
            payload.clientId,
            payload.deletedIds,
            payload.forceReplace,
            payload.resetEpoch
          );
        } else {
          hasHydratedRemoteRef.current = true;
        }
      })
      .catch(() => {
        hasHydratedRemoteRef.current = true;
      });

    // 2. Initial sync with shared server database on app boot
    fetch('/api/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (
          payload &&
          payload.state &&
          typeof payload.state === 'object' &&
          Array.isArray(payload.state.users) &&
          typeof payload.updatedAt === 'number' &&
          payload.updatedAt > 0
        ) {
          applyIncomingRemoteState(
            payload.state as AppState,
            payload.updatedAt,
            payload.clientId,
            payload.deletedIds,
            payload.forceReplace,
            payload.resetEpoch
          );
        } else {
          hasHydratedRemoteRef.current = true;
        }
      })
      .catch(() => {
        hasHydratedRemoteRef.current = true;
      });

    // 3. Real-time Server-Sent Events stream for instant cross-device push
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/stream');
      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (
            payload &&
            payload.state &&
            Array.isArray(payload.state.users) &&
            typeof payload.updatedAt === 'number'
          ) {
            applyIncomingRemoteState(
              payload.state as AppState,
              payload.updatedAt,
              payload.clientId,
              payload.deletedIds,
              payload.forceReplace,
              payload.resetEpoch
            );
          }
        } catch {
          // ignore malformed event
        }
      };
    } catch {
      // ignore if EventSource is unavailable
    }

    // 4. Periodic polling fallback every 3.5 seconds
    const pollTimer = window.setInterval(() => {
      fetch('/api/state')
        .then((res) => (res.ok ? res.json() : null))
        .then((payload) => {
          if (
            payload &&
            payload.state &&
            Array.isArray(payload.state.users) &&
            typeof payload.updatedAt === 'number' &&
            payload.updatedAt > 0
          ) {
            applyIncomingRemoteState(
              payload.state as AppState,
              payload.updatedAt,
              payload.clientId,
              payload.deletedIds,
              payload.forceReplace,
              payload.resetEpoch
            );
          }
        })
        .catch(() => {});
    }, 3500);

    // 5. Same-device cross-tab storage listener
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue) as AppState;
          if (parsed && Array.isArray(parsed.users)) {
            setState((prev) => {
              const prevIds = new Set((prev.notifications || []).map((n) => n.id));
              const incomingNotifs = parsed.notifications || [];
              const newestUnread = incomingNotifs.find(
                (n) => !n.isRead && !prevIds.has(n.id)
              );
              if (newestUnread) {
                setLiveAlert(newestUnread);
              }
              isApplyingRemoteRef.current = true;
              return parsed;
            });
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      unsubscribeFirestore();
      if (eventSource) eventSource.close();
      window.clearInterval(pollTimer);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Update HTML dir & lang attributes for RTL/LTR support
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Smoothly scroll to top when switching between pages/tabs (especially helpful on mobile phones)
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore in test environments
    }
  }, [activeTab]);

  // Automatic End-of-Day Archiving & 30-Minute Calendar Appointment PWA Reminders
  useEffect(() => {
    const runScheduledChecks = () => {
      const todayStr = getTodayStr();
      const now = new Date();
      setState((prev) => {
        const vRes = autoArchivePastDayVisits(prev, todayStr);
        const fRes = autoArchivePastDayFinance(vRes.state, todayStr);
        const remRes = checkUpcomingAppointmentReminders(fRes.state, now);

        if (remRes.newNotifications.length > 0) {
          const latestNotif = remRes.newNotifications[0];
          setLiveAlert(latestNotif);
          for (const notif of remRes.newNotifications) {
            sendPwaNotification({
              title: notif.title,
              body: notif.message,
              tag: notif.id,
            }).catch(() => {});
          }
        }

        if (
          vRes.archivedCount > 0 ||
          fRes.archivedCount > 0 ||
          fRes.rolledOverProfitJod !== 0 ||
          remRes.dueAppointments.length > 0
        ) {
          hasLocalUserMutationRef.current = true;
          return remRes.state;
        }
        return prev;
      });
    };
    runScheduledChecks();
    const timer = window.setInterval(runScheduledChecks, 20000);
    return () => window.clearInterval(timer);
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const matched = authenticateUser(state.users, loginUsername, loginPassword);
    if (!matched) {
      setLoginError(
        lang === 'ar'
          ? 'اسم المستخدم أو كلمة المرور غير صحيحة. (الافتراضي: admin / admin)'
          : 'Invalid username or password. (Default: admin / admin)'
      );
      return;
    }
    setCurrentUser(matched);
    const newestUnread = (state.notifications || []).find((n) => !n.isRead);
    if (newestUnread) {
      setLiveAlert(newestUnread);
    }
    try {
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(matched));
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsPublicPortalMode(false);
    try {
      localStorage.removeItem(SESSION_USER_KEY);
    } catch {
      // ignore
    }
  };

  // User role and permissions enforcement
  const isAdmin = isUserAdmin(currentUser);

  // --- State Updaters with Full Cross-Page Synchronization & Admin Access Control ---
  const handleSaveVisit = (visit: MaintenanceVisit) => {
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.delete(visit.id);
    const isNewVisit = !state.visits.some((v) => v.id === visit.id);
    if (visit.nextVisitDate && visit.nextVisitDate.trim() !== '') {
      deletedIdsRef.current.delete(`apt-next-${visit.id}`);
    } else {
      deletedIdsRef.current.add(`apt-next-${visit.id}`);
    }
    const enrichedVisit: MaintenanceVisit = {
      ...visit,
      technicianName: isNewVisit
        ? (currentUser?.fullName || visit.technicianName || 'فني الصيانة')
        : (visit.technicianName || currentUser?.fullName || 'فني الصيانة'),
      ...({ updatedAt: Date.now() } as any),
    };
    setState((prev) =>
      syncMaintenanceVisitIntoState(prev, enrichedVisit, { notifyOnNew: true })
    );
    if (isNewVisit) {
      const notif = createMaintenanceNotification(enrichedVisit);
      setLiveAlert(notif);
      sendPwaNotification({
        title: notif.title,
        body: notif.message,
        tag: notif.id,
      }).catch(() => {});
    }
  };

  const handleDeleteVisit = (visitId: string) => {
    // Deletion is strictly restricted to admin permissions
    if (!isAdmin) return;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.add(visitId);
    deletedIdsRef.current.add(`apt-main-${visitId}`);
    deletedIdsRef.current.add(`apt-next-${visitId}`);
    for (const apt of state.appointments) {
      if (apt.linkedVisitId === visitId) {
        deletedIdsRef.current.add(apt.id);
      }
    }
    for (const notif of state.notifications || []) {
      if (notif.linkedVisitId === visitId) {
        deletedIdsRef.current.add(notif.id);
      }
    }
    setState((prev) => deleteMaintenanceVisitFromState(prev, visitId));
  };

  const handleArchiveVisits = (visitIds?: string[]): number => {
    if (!isAdmin) return 0;
    hasLocalUserMutationRef.current = true;
    const todayStr = getTodayStr();
    const res = archiveVisitsIntoState(state, visitIds, todayStr);
    if (res.archivedCount > 0) {
      setState((prev) => archiveVisitsIntoState(prev, visitIds, todayStr).state);
    }
    return res.archivedCount;
  };

  const handleUnarchiveVisit = (visitId: string) => {
    if (!isAdmin) return;
    hasLocalUserMutationRef.current = true;
    setState((prev) => unarchiveVisitFromState(prev, visitId));
  };

  const handleUnarchiveVisits = (visitIds?: string[]): number => {
    if (!isAdmin) return 0;
    hasLocalUserMutationRef.current = true;
    const res = unarchiveVisitsFromState(state, visitIds);
    if (res.restoredCount > 0) {
      setState((prev) => unarchiveVisitsFromState(prev, visitIds).state);
    }
    return res.restoredCount;
  };

  const handleTransferFinance = (options?: {
    targetDate?: string;
    recordType?: 'morning_cash' | 'expense' | 'visit_revenue';
    id?: string;
    ids?: string[];
  }): number => {
    if (!isAdmin) return 0;
    hasLocalUserMutationRef.current = true;
    const todayStr = getTodayStr();
    const res = transferDailyFinanceToAdvanced(state, options, todayStr);
    if (res.transferredCount > 0) {
      setState(
        (prev) => transferDailyFinanceToAdvanced(prev, options, todayStr).state
      );
    }
    return res.transferredCount;
  };

  const handleTransferProfitsToMorningCash = (options?: {
    targetDate?: string;
    recordType?: 'morning_cash' | 'expense' | 'visit_revenue';
    id?: string;
    ids?: string[];
    source?: 'active' | 'archived';
  }): ProfitRolloverResult => {
    if (!isAdmin) {
      return {
        state,
        transferredCount: 0,
        revenueJod: 0,
        expensesJod: 0,
        netProfitJod: 0,
        previousMorningCashJod: 0,
        newMorningCashJod: 0,
      };
    }
    hasLocalUserMutationRef.current = true;
    const todayStr = getTodayStr();
    const res = transferProfitsToMorningCash(
      state,
      { ...options, recordedBy: currentUser?.fullName || 'مدير النظام' },
      todayStr
    );
    if (res.transferredCount > 0 || res.morningCashRecord) {
      setState(
        (prev) =>
          transferProfitsToMorningCash(
            prev,
            { ...options, recordedBy: currentUser?.fullName || 'مدير النظام' },
            todayStr
          ).state
      );
    }
    return res;
  };

  const handleRestoreFinanceRecord = (
    recordType: 'morning_cash' | 'expense' | 'visit_revenue',
    id: string
  ) => {
    if (!isAdmin) return;
    hasLocalUserMutationRef.current = true;
    setState((prev) => restoreFinanceRecordToActive(prev, recordType, id));
  };

  const handleRestoreDayFinance = (dateStr: string) => {
    if (!isAdmin) return;
    hasLocalUserMutationRef.current = true;
    setState((prev) => restoreDayFinanceToActive(prev, dateStr));
  };

  const handleCustomerBooking = (input: CustomerBookingInput): MaintenanceVisit => {
    hasLocalUserMutationRef.current = true;
    const res = createCustomerBookingIntoState(state, input);
    setState(res.nextState);
    setLiveAlert(res.createdNotification);
    sendPwaNotification({
      title: res.createdNotification.title,
      body: res.createdNotification.message,
      tag: res.createdNotification.id,
    }).catch(() => {});
    return res.createdVisit;
  };

  const handleMarkNotificationRead = (id: string) => {
    hasLocalUserMutationRef.current = true;
    setState((prev) => ({
      ...prev,
      notifications: (prev.notifications || []).map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    }));
  };

  const handleMarkAllNotificationsRead = () => {
    hasLocalUserMutationRef.current = true;
    setState((prev) => ({
      ...prev,
      notifications: (prev.notifications || []).map((n) => ({
        ...n,
        isRead: true,
      })),
    }));
  };

  const handleDeleteNotification = (id: string) => {
    deletedIdsRef.current.add(id);
    if (liveAlert?.id === id) {
      setLiveAlert(null);
    }
    hasLocalUserMutationRef.current = true;
    setState((prev) => ({
      ...prev,
      notifications: (prev.notifications || []).filter((n) => n.id !== id),
    }));
  };

  const handleClearReadNotifications = () => {
    for (const n of state.notifications || []) {
      if (n.isRead) {
        deletedIdsRef.current.add(n.id);
      }
    }
    hasLocalUserMutationRef.current = true;
    setState((prev) => ({
      ...prev,
      notifications: (prev.notifications || []).filter((n) => !n.isRead),
    }));
  };

  const handleClearAllNotifications = () => {
    for (const n of state.notifications || []) {
      deletedIdsRef.current.add(n.id);
    }
    setLiveAlert(null);
    hasLocalUserMutationRef.current = true;
    setState((prev) => ({
      ...prev,
      notifications: [],
    }));
  };

  const handleSaveMorningCash = (record: MorningCashRecord) => {
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.delete(record.id);
    const stamped = { ...record, updatedAt: Date.now() } as MorningCashRecord;
    setState((prev) => {
      const idx = prev.morningCash.findIndex((m) => m.id === stamped.id);
      const next =
        idx >= 0
          ? prev.morningCash.map((m, i) => (i === idx ? stamped : m))
          : [stamped, ...prev.morningCash];
      return { ...prev, morningCash: next };
    });
  };

  const handleDeleteMorningCash = (id: string) => {
    if (!isAdmin) return;
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.add(id);
    setState((prev) => ({
      ...prev,
      morningCash: prev.morningCash.filter((m) => m.id !== id),
    }));
  };

  const handleSaveExpense = (record: ExpenseRecord) => {
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.delete(record.id);
    const stamped = { ...record, updatedAt: Date.now() } as ExpenseRecord;
    setState((prev) => syncExpenseIntoState(prev, stamped));
  };

  const handleDeleteExpense = (id: string) => {
    if (!isAdmin) return;
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.add(id);
    const targetExp = state.expenses.find((e) => e.id === id);
    if (targetExp?.linkedCashAdvanceId) {
      deletedIdsRef.current.add(targetExp.linkedCashAdvanceId);
    }
    setState((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
      cashAdvances: targetExp?.linkedCashAdvanceId
        ? (prev.cashAdvances || []).filter(
            (a) => a.id !== targetExp.linkedCashAdvanceId
          )
        : prev.cashAdvances,
    }));
  };

  const handleSaveCashAdvance = (advance: CashAdvanceRecord) => {
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.delete(advance.id);
    const expId = advance.linkedExpenseId || `exp-adv-${advance.id}`;
    deletedIdsRef.current.delete(expId);
    setState((prev) => syncCashAdvanceIntoState(prev, advance));
  };

  const handleDeleteCashAdvance = (advanceId: string) => {
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    const res = deleteCashAdvanceFromState(state, advanceId);
    for (const did of res.deletedIds) {
      deletedIdsRef.current.add(did);
    }
    setState((prev) => deleteCashAdvanceFromState(prev, advanceId).nextState);
  };

  const handleSaveCustomer = (customer: Customer) => {
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.delete(customer.id);
    const stampedCustomer = {
      ...customer,
      name: customer.name.trim(),
      phone: (customer.phone || '').trim(),
      updatedAt: Date.now(),
    } as Customer;

    setState((prev) => {
      let idx = prev.customers.findIndex((c) => c.id === stampedCustomer.id);
      if (idx < 0) {
        idx = prev.customers.findIndex(
          (c) =>
            c.name.trim().toLowerCase() ===
            stampedCustomer.name.trim().toLowerCase()
        );
      }

      const prevCustomer = idx >= 0 ? prev.customers[idx] : null;
      const finalCustomer: Customer = prevCustomer
        ? {
            ...prevCustomer,
            ...stampedCustomer,
            id: prevCustomer.id || stampedCustomer.id,
            createdAt: prevCustomer.createdAt || stampedCustomer.createdAt,
          }
        : stampedCustomer;

      const nextCustomers =
        idx >= 0
          ? prev.customers.map((c, i) => (i === idx ? finalCustomer : c))
          : [finalCustomer, ...prev.customers];

      // Cascade updated customer name and phone to linked maintenance visits and appointments
      const oldNameLower = prevCustomer
        ? prevCustomer.name.trim().toLowerCase()
        : '';
      const newName = finalCustomer.name.trim();
      const newPhone = finalCustomer.phone;

      const nextVisits = prevCustomer
        ? prev.visits.map((v) => {
            const matchesCustomer =
              v.customerId === finalCustomer.id ||
              (oldNameLower &&
                v.customerName.trim().toLowerCase() === oldNameLower);
            if (!matchesCustomer) return v;
            return {
              ...v,
              customerId: finalCustomer.id,
              customerName: newName,
              phone: newPhone || v.phone,
              ...({ updatedAt: Date.now() } as any),
            };
          })
        : prev.visits;

      const nextAppointments = prevCustomer
        ? prev.appointments.map((a) => {
            const matchesCustomer =
              oldNameLower &&
              a.customerName.trim().toLowerCase() === oldNameLower;
            if (!matchesCustomer) return a;
            return {
              ...a,
              customerName: newName,
              phone: newPhone || a.phone,
              ...({ updatedAt: Date.now() } as any),
            };
          })
        : prev.appointments;

      return {
        ...prev,
        customers: nextCustomers,
        visits: nextVisits,
        appointments: nextAppointments,
      };
    });
  };

  const handleDeleteCustomer = (id: string) => {
    if (!isAdmin) return;
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.add(id);
    setState((prev) => ({
      ...prev,
      customers: prev.customers.filter((c) => c.id !== id),
    }));
  };

  const handleSavePart = (part: PartItem) => {
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.delete(part.id);
    const stampedPart = { ...part, updatedAt: Date.now() } as PartItem;
    setState((prev) => {
      const idx = prev.parts.findIndex((p) => p.id === stampedPart.id);
      const next =
        idx >= 0
          ? prev.parts.map((p, i) => (i === idx ? stampedPart : p))
          : [stampedPart, ...prev.parts];
      return { ...prev, parts: next };
    });
  };

  const handleDeletePart = (id: string) => {
    if (!isAdmin) return;
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.add(id);
    setState((prev) => ({
      ...prev,
      parts: prev.parts.filter((p) => p.id !== id),
    }));
  };

  const handleSavePurchase = (purchase: PurchaseRecord) => {
    hasLocalUserMutationRef.current = true;
    setState((prev) => {
      const currentPurchases = prev.purchases || [];
      const existingIdx = currentPurchases.findIndex((p) => p.id === purchase.id);
      const isEditing = existingIdx >= 0;

      const updatedPurchase: PurchaseRecord = {
        ...purchase,
        purchasedBy:
          purchase.purchasedBy || currentUser?.fullName || 'مدير النظام',
        isPaid: purchase.paymentMethod !== 'credit' ? true : purchase.isPaid,
      };

      // 1. Sync with Parts Catalog (inventory)
      let nextParts = [...prev.parts];
      const existingPartIdx = nextParts.findIndex(
        (pt) =>
          (updatedPurchase.linkedPartId &&
            pt.id === updatedPurchase.linkedPartId) ||
          pt.name.toLowerCase() === updatedPurchase.partName.toLowerCase()
      );

      if (existingPartIdx >= 0) {
        const pt = nextParts[existingPartIdx];
        updatedPurchase.linkedPartId = pt.id;
        const deltaQty = isEditing
          ? updatedPurchase.quantity -
            (currentPurchases[existingIdx]?.quantity || 0)
          : updatedPurchase.quantity;
        nextParts[existingPartIdx] = {
          ...pt,
          name: updatedPurchase.partName,
          category: updatedPurchase.category || pt.category,
          defaultCostJod: updatedPurchase.unitCostJod,
          defaultPriceJod:
            updatedPurchase.sellingPriceJod && updatedPurchase.sellingPriceJod > 0
              ? updatedPurchase.sellingPriceJod
              : pt.defaultPriceJod,
          stockQty: Math.max(0, (pt.stockQty || 0) + deltaQty),
          unit: updatedPurchase.unit || pt.unit,
          supplierName: updatedPurchase.supplierName || pt.supplierName,
          invoiceNumber: updatedPurchase.invoiceNumber || pt.invoiceNumber,
          purchaseDate: updatedPurchase.invoiceDate,
          paymentMethod: updatedPurchase.paymentMethod,
          invoiceImageUrl:
            updatedPurchase.invoiceImageUrl || pt.invoiceImageUrl,
          linkedPurchaseId: updatedPurchase.id,
        };
      } else {
        const newPartId =
          updatedPurchase.linkedPartId ||
          `part-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        updatedPurchase.linkedPartId = newPartId;
        const newPart: PartItem = {
          id: newPartId,
          name: updatedPurchase.partName,
          category: updatedPurchase.category,
          defaultCostJod: updatedPurchase.unitCostJod,
          defaultPriceJod:
            updatedPurchase.sellingPriceJod && updatedPurchase.sellingPriceJod > 0
              ? updatedPurchase.sellingPriceJod
              : Math.round(updatedPurchase.unitCostJod * 1.35 * 100) / 100,
          stockQty: updatedPurchase.quantity,
          unit: updatedPurchase.unit,
          supplierName: updatedPurchase.supplierName,
          invoiceNumber: updatedPurchase.invoiceNumber,
          purchaseDate: updatedPurchase.invoiceDate,
          paymentMethod: updatedPurchase.paymentMethod,
          invoiceImageUrl: updatedPurchase.invoiceImageUrl,
          linkedPurchaseId: updatedPurchase.id,
        };
        nextParts = [newPart, ...nextParts];
      }

      // 2. Sync with Finance (Expenses)
      let nextExpenses = [...prev.expenses];
      const expId =
        updatedPurchase.linkedExpenseId || `exp-purch-${updatedPurchase.id}`;

      if (
        updatedPurchase.paymentMethod === 'cash' ||
        updatedPurchase.paymentMethod === 'cliq'
      ) {
        deletedIdsRef.current.delete(expId);
        updatedPurchase.linkedExpenseId = expId;
        updatedPurchase.isPaid = true;
        updatedPurchase.paidAt =
          updatedPurchase.paidAt || updatedPurchase.invoiceDate;

        const expRecord: ExpenseRecord = {
          id: expId,
          date: updatedPurchase.invoiceDate,
          time: '12:00',
          category: 'parts_purchase',
          title: `شراء قطع: ${updatedPurchase.partName} (${updatedPurchase.quantity} ${
            updatedPurchase.unit || 'قطعة'
          })`,
          partType: updatedPurchase.partName,
          amountJod: updatedPurchase.totalCostJod,
          paymentMethod:
            updatedPurchase.paymentMethod === 'cliq' ? 'cliq' : 'cash',
          note: `مورد: ${
            updatedPurchase.supplierName || 'غير محدد'
          } | فاتورة: ${updatedPurchase.invoiceNumber || 'بدون'} [${
            updatedPurchase.paymentMethod === 'cliq' ? 'دفع كلك' : 'دفع كاش'
          }]`,
          recordedBy:
            updatedPurchase.purchasedBy ||
            currentUser?.fullName ||
            'مدير النظام',
          linkedPurchaseId: updatedPurchase.id,
        };

        const expIdx = nextExpenses.findIndex(
          (e) => e.id === expId || e.linkedPurchaseId === updatedPurchase.id
        );
        if (expIdx >= 0) {
          nextExpenses[expIdx] = expRecord;
        } else {
          nextExpenses = [expRecord, ...nextExpenses];
        }
      } else {
        // Credit (ذمم): if not paid yet, remove any immediate cash/cliq expense
        if (!updatedPurchase.isPaid) {
          nextExpenses.forEach((e) => {
            if (e.id === expId || e.linkedPurchaseId === updatedPurchase.id) {
              deletedIdsRef.current.add(e.id);
            }
          });
          nextExpenses = nextExpenses.filter(
            (e) =>
              e.id !== expId && e.linkedPurchaseId !== updatedPurchase.id
          );
          updatedPurchase.linkedExpenseId = undefined;
        }
      }

      const nextPurchases = isEditing
        ? currentPurchases.map((p, idx) =>
            idx === existingIdx ? updatedPurchase : p
          )
        : [updatedPurchase, ...currentPurchases];

      return {
        ...prev,
        purchases: nextPurchases,
        parts: nextParts,
        expenses: nextExpenses,
      };
    });
  };

  const handleDeletePurchase = (id: string) => {
    if (!isAdmin) return;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.add(id);
    setState((prev) => {
      const currentPurchases = prev.purchases || [];
      const target = currentPurchases.find((p) => p.id === id);
      const nextPurchases = currentPurchases.filter((p) => p.id !== id);
      prev.expenses.forEach((e) => {
        if (
          e.linkedPurchaseId === id ||
          (target?.linkedExpenseId && e.id === target.linkedExpenseId)
        ) {
          deletedIdsRef.current.add(e.id);
        }
      });
      const nextExpenses = prev.expenses.filter(
        (e) =>
          e.linkedPurchaseId !== id &&
          (!target?.linkedExpenseId || e.id !== target.linkedExpenseId)
      );
      const nextParts = target
        ? prev.parts.map((pt) => {
            if (
              (target.linkedPartId && pt.id === target.linkedPartId) ||
              pt.linkedPurchaseId === id
            ) {
              return {
                ...pt,
                stockQty: Math.max(0, (pt.stockQty || 0) - (target.quantity || 0)),
              };
            }
            return pt;
          })
        : prev.parts;
      return {
        ...prev,
        purchases: nextPurchases,
        expenses: nextExpenses,
        parts: nextParts,
      };
    });
  };

  const handleSettleCreditPurchase = (
    purchaseId: string,
    settleMethod: 'cash' | 'cliq',
    settleDate: string
  ) => {
    hasLocalUserMutationRef.current = true;
    setState((prev) => {
      const currentPurchases = prev.purchases || [];
      const targetIdx = currentPurchases.findIndex((p) => p.id === purchaseId);
      if (targetIdx < 0) return prev;

      const target = currentPurchases[targetIdx];
      const expId = `exp-settle-${purchaseId}-${Date.now()}`;

      const updatedPurchase: PurchaseRecord = {
        ...target,
        isPaid: true,
        paidAt: settleDate || getTodayStr(),
        linkedExpenseId: expId,
      };

      const settleExpense: ExpenseRecord = {
        id: expId,
        date: settleDate || getTodayStr(),
        time: '12:00',
        category: 'parts_purchase',
        title: `تسديد ذمة شراء: ${target.partName} (${
          target.supplierName || 'مورد'
        })`,
        partType: target.partName,
        amountJod: target.totalCostJod,
        paymentMethod: settleMethod === 'cliq' ? 'cliq' : 'cash',
        note: `تسديد ذمة مورد لفاتورة ${
          target.invoiceNumber || 'بدون'
        } — سداد بواسطة (${settleMethod === 'cliq' ? 'كلك' : 'كاش'})`,
        recordedBy: currentUser?.fullName || 'مدير النظام',
        linkedPurchaseId: target.id,
      };

      const nextPurchases = currentPurchases.map((p, i) =>
        i === targetIdx ? updatedPurchase : p
      );

      return {
        ...prev,
        purchases: nextPurchases,
        expenses: [settleExpense, ...prev.expenses],
      };
    });
  };

  const handleBatchInsertPurchases = (
    items: ExtractedPurchaseItem[],
    metadata: {
      supplierName: string;
      invoiceNumber: string;
      invoiceDate: string;
      paymentMethod: PurchasePaymentMethod;
      notes: string;
      invoiceImageUrl?: string;
    }
  ) => {
    hasLocalUserMutationRef.current = true;
    setState((prev) => {
      let nextPurchases = [...(prev.purchases || [])];
      let nextParts = [...prev.parts];
      let nextExpenses = [...prev.expenses];

      // Single compressed shared image on the first purchase record only
      const sharedImage =
        metadata.invoiceImageUrl && metadata.invoiceImageUrl.length < 120000
          ? metadata.invoiceImageUrl
          : undefined;

      const createdPurchases: PurchaseRecord[] = [];

      items.forEach((item, idx) => {
        const pId = `purch-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
        const q = Math.max(0.1, item.quantity || 1);
        const rawUnitCost = Math.max(0, item.unitCostJod || 0);
        const rawTotal = Math.max(0, item.totalCostJod || 0);
        const cost =
          rawUnitCost > 0
            ? rawUnitCost
            : rawTotal > 0
            ? Math.round((rawTotal / q) * 100) / 100
            : 0;
        const total =
          rawTotal > 0 ? rawTotal : Math.round(q * cost * 100) / 100;
        const sell =
          item.suggestedSellingPriceJod ||
          Math.round(cost * 1.35 * 100) / 100;

        // 1. Part Catalog link
        const existingPartIdx = nextParts.findIndex(
          (pt) => pt.name.toLowerCase() === item.partName.toLowerCase()
        );
        let linkedPartId: string;
        if (existingPartIdx >= 0) {
          const pt = nextParts[existingPartIdx];
          linkedPartId = pt.id;
          nextParts[existingPartIdx] = {
            ...pt,
            stockQty: (pt.stockQty || 0) + q,
            defaultCostJod: cost,
            defaultPriceJod: sell || pt.defaultPriceJod,
            supplierName: metadata.supplierName || pt.supplierName,
            invoiceNumber: metadata.invoiceNumber || pt.invoiceNumber,
            purchaseDate: metadata.invoiceDate || getTodayStr(),
            paymentMethod: metadata.paymentMethod,
            linkedPurchaseId: pId,
          };
        } else {
          linkedPartId = `part-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
          nextParts = [
            {
              id: linkedPartId,
              name: item.partName,
              category: item.category || 'تخزين وهاردوير',
              defaultCostJod: cost,
              defaultPriceJod: sell,
              stockQty: q,
              unit: item.unit || 'قطعة',
              supplierName: metadata.supplierName,
              invoiceNumber: metadata.invoiceNumber,
              purchaseDate: metadata.invoiceDate || getTodayStr(),
              paymentMethod: metadata.paymentMethod,
              linkedPurchaseId: pId,
            },
            ...nextParts,
          ];
        }

        const expId =
          metadata.paymentMethod === 'cash' || metadata.paymentMethod === 'cliq'
            ? `exp-purch-${pId}`
            : undefined;

        const purchaseRecord: PurchaseRecord = {
          id: pId,
          partName: item.partName,
          category: item.category || 'تخزين وهاردوير',
          quantity: q,
          unit: item.unit || 'قطعة',
          unitCostJod: cost,
          totalCostJod: total,
          sellingPriceJod: sell,
          supplierName: metadata.supplierName || undefined,
          invoiceNumber: metadata.invoiceNumber || undefined,
          invoiceDate: metadata.invoiceDate || getTodayStr(),
          paymentMethod: metadata.paymentMethod,
          isPaid: metadata.paymentMethod !== 'credit',
          paidAt:
            metadata.paymentMethod !== 'credit'
              ? metadata.invoiceDate || getTodayStr()
              : undefined,
          notes: metadata.notes || undefined,
          purchasedBy: currentUser?.fullName || 'مدير النظام',
          invoiceImageUrl: idx === 0 ? sharedImage : undefined,
          linkedExpenseId: expId,
          linkedPartId,
          createdAt: new Date().toISOString(),
        };

        createdPurchases.push(purchaseRecord);

        // Expense sync
        if (expId) {
          const expRecord: ExpenseRecord = {
            id: expId,
            date: metadata.invoiceDate || getTodayStr(),
            time: '12:00',
            category: 'parts_purchase',
            title: `شراء قطع: ${item.partName} (${q} ${item.unit || 'قطعة'})`,
            partType: item.partName,
            amountJod: total,
            paymentMethod: metadata.paymentMethod === 'cliq' ? 'cliq' : 'cash',
            note: `مورد: ${metadata.supplierName || 'غير محدد'} | فاتورة: ${
              metadata.invoiceNumber || 'بدون'
            } [${
              metadata.paymentMethod === 'cliq' ? 'دفع كلك' : 'دفع كاش'
            }]`,
            recordedBy: currentUser?.fullName || 'مدير النظام',
            linkedPurchaseId: pId,
          };
          nextExpenses = [expRecord, ...nextExpenses];
        }
      });

      nextPurchases = [...createdPurchases, ...nextPurchases];

      return {
        ...prev,
        purchases: nextPurchases,
        parts: nextParts,
        expenses: nextExpenses,
      };
    });
  };

  const handleAddSupplier = (supplierName: string) => {
    const clean = supplierName.trim();
    if (!clean) return;
    hasLocalUserMutationRef.current = true;
    setState((prev) => {
      const current = prev.suppliers || [];
      if (current.some((s) => s.trim().toLowerCase() === clean.toLowerCase())) {
        return prev;
      }
      return {
        ...prev,
        suppliers: [...current, clean],
      };
    });
  };

  const handleRenameSupplier = (oldName: string, newName: string) => {
    const cleanOld = oldName.trim().toLowerCase();
    const cleanNew = newName.trim();
    if (!cleanOld || !cleanNew || cleanOld === cleanNew.toLowerCase()) return;
    hasLocalUserMutationRef.current = true;
    setState((prev) => {
      const currentSuppliers = prev.suppliers || [];
      const updatedSuppliers = currentSuppliers.map((s) =>
        s.trim().toLowerCase() === cleanOld ? cleanNew : s
      );
      if (!updatedSuppliers.some((s) => s.trim().toLowerCase() === cleanNew.toLowerCase())) {
        updatedSuppliers.push(cleanNew);
      }
      const updatedPurchases = (prev.purchases || []).map((p) =>
        p.supplierName && p.supplierName.trim().toLowerCase() === cleanOld
          ? { ...p, supplierName: cleanNew }
          : p
      );
      const updatedParts = (prev.parts || []).map((pt) =>
        pt.supplierName && pt.supplierName.trim().toLowerCase() === cleanOld
          ? { ...pt, supplierName: cleanNew }
          : pt
      );
      return {
        ...prev,
        suppliers: updatedSuppliers,
        purchases: updatedPurchases,
        parts: updatedParts,
      };
    });
  };

  const handleDeleteSupplier = (supplierName: string) => {
    if (!isAdmin) return;
    const clean = supplierName.trim().toLowerCase();
    hasLocalUserMutationRef.current = true;
    setState((prev) => {
      const updatedSuppliers = (prev.suppliers || []).filter(
        (s) => s.trim().toLowerCase() !== clean
      );
      // Cleanly unassign supplier from purchases & parts so records are preserved under unassigned/general
      const updatedPurchases = (prev.purchases || []).map((p) =>
        p.supplierName && p.supplierName.trim().toLowerCase() === clean
          ? { ...p, supplierName: undefined }
          : p
      );
      const updatedParts = (prev.parts || []).map((pt) =>
        pt.supplierName && pt.supplierName.trim().toLowerCase() === clean
          ? { ...pt, supplierName: undefined }
          : pt
      );
      return {
        ...prev,
        suppliers: updatedSuppliers,
        purchases: updatedPurchases,
        parts: updatedParts,
      };
    });
  };

  const handleSaveExpenseTemplate = (tpl: ExpenseTemplate) => {
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.delete(tpl.id);
    const stampedTpl = { ...tpl, updatedAt: Date.now() } as ExpenseTemplate;
    setState((prev) => {
      const idx = prev.expenseTemplates.findIndex((t) => t.id === stampedTpl.id);
      const next =
        idx >= 0
          ? prev.expenseTemplates.map((t, i) => (i === idx ? stampedTpl : t))
          : [stampedTpl, ...prev.expenseTemplates];
      return { ...prev, expenseTemplates: next };
    });
  };

  const handleDeleteExpenseTemplate = (id: string) => {
    if (!isAdmin) return;
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.add(id);
    setState((prev) => ({
      ...prev,
      expenseTemplates: prev.expenseTemplates.filter((t) => t.id !== id),
    }));
  };

  const handleSaveAppointment = (apt: ScheduleAppointment) => {
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.delete(apt.id);
    const stampedApt = { ...apt, updatedAt: Date.now() } as ScheduleAppointment;
    setState((prev) => syncAppointmentIntoState(prev, stampedApt));
  };

  const handleDeleteAppointment = (id: string) => {
    if (!isAdmin) return;
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.add(id);
    setState((prev) => ({
      ...prev,
      appointments: prev.appointments.filter((a) => a.id !== id),
    }));
  };

  const handleSaveNote = (note: DailyNote) => {
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.delete(note.id);
    const stampedNote = { ...note, updatedAt: Date.now() } as DailyNote;
    setState((prev) => {
      const idx = prev.dailyNotes.findIndex((n) => n.id === stampedNote.id);
      const next =
        idx >= 0
          ? prev.dailyNotes.map((n, i) => (i === idx ? stampedNote : n))
          : [stampedNote, ...prev.dailyNotes];
      return { ...prev, dailyNotes: next };
    });
  };

  const handleDeleteNote = (id: string) => {
    if (!isAdmin) return;
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.add(id);
    setState((prev) => ({
      ...prev,
      dailyNotes: (prev.dailyNotes || []).filter((n) => n.id !== id),
    }));
  };

  const handleGlobalScanNotesInsert = (scannedText: string) => {
    const today = getTodayStr();
    const newNote: DailyNote = {
      id: `note-${Date.now()}`,
      title:
        lang === 'ar'
          ? `ملاحظات ورقة العمل (${today})`
          : `Work Notes Sheet (${today})`,
      content: scannedText,
      date: today,
      isPinned: true,
      isCompleted: false,
      author: currentUser?.fullName || 'الفني',
      createdAt: new Date().toISOString(),
    };
    handleSaveNote(newNote);
    setActiveTab('dashboard');
  };

  const handleGlobalScanApplyData = (data: ExtractedWorkData) => {
    const today = getTodayStr();
    // If structured data has customerName or problem, create a maintenance visit
    if (data.customerName || data.problem) {
      const newVisit: MaintenanceVisit = {
        id: `vis-${Date.now()}`,
        customerId: `cust-${Date.now()}`,
        customerName: data.customerName || (lang === 'ar' ? 'زبون جديد (من ورقة العمل)' : 'New Customer (From Sheet)'),
        phone: data.phone || undefined,
        visitType: 'visit',
        problem: data.problem || data.notesSummary || (lang === 'ar' ? 'أعمال صيانة مسجلة في ورقة العمل' : 'Work from notes sheet'),
        visitDate: today,
        visitTime: '10:00',
        requiredParts: data.requiredParts || [],
        installedParts: data.installedParts || [],
        amountJod: data.amountJod || 0,
        paymentMethod: 'cash',
        isPaid: false,
        status: 'pending',
        isResolved: false,
        source: 'staff',
        createdAt: today,
        technicianName: data.technicianName || currentUser?.fullName || 'فني الصيانة',
        note: data.transcribedText || data.notesSummary || undefined,
      };
      handleSaveVisit(newVisit);
      setActiveTab('maintenance');
    } else if (data.transcribedText) {
      handleGlobalScanNotesInsert(data.transcribedText);
    }
  };

  const handleSaveUser = (usr: User) => {
    hasHydratedRemoteRef.current = true;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.delete(usr.id);
    deletedIdsRef.current.delete(`usr_${usr.username.trim().toLowerCase()}`);
    const stampedUser = { ...usr, updatedAt: Date.now() } as User;
    setState((prev) => {
      const idx = prev.users.findIndex(
        (u) =>
          u.id === stampedUser.id ||
          u.username.trim().toLowerCase() === stampedUser.username.trim().toLowerCase()
      );
      const next =
        idx >= 0
          ? prev.users.map((u, i) => (i === idx ? stampedUser : u))
          : [stampedUser, ...prev.users];
      return { ...prev, users: deduplicateUsers(next) };
    });
    if (currentUser && currentUser.id === usr.id) {
      setCurrentUser(usr);
      try {
        localStorage.setItem(SESSION_USER_KEY, JSON.stringify(usr));
      } catch {
        // ignore
      }
    }
  };

  const handleDeleteUser = (userId: string) => {
    if (!isAdmin) return;
    hasLocalUserMutationRef.current = true;
    deletedIdsRef.current.add(userId);
    const targetUser = state.users.find((u) => u.id === userId);
    if (targetUser?.username) {
      deletedIdsRef.current.add(`usr_${targetUser.username.trim().toLowerCase()}`);
    }
    setState((prev) => ({
      ...prev,
      users: prev.users.filter((u) => u.id !== userId),
    }));
  };

  const portalRequestsCount = state.visits.filter(
    (v) => v.source === 'customer_portal'
  ).length;

  // --- Public Customer Portal Screen (When accessed without staff login) ---
  if (!currentUser && isPublicPortalMode) {
    return (
      <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6">
        <OfflineIndicator lang={lang} />
        <CustomerPortalView
          lang={lang}
          onSubmitBooking={handleCustomerBooking}
          onBackToLogin={() => setIsPublicPortalMode(false)}
          recentPortalVisitsCount={portalRequestsCount}
        />
      </div>
    );
  }

  // --- Staff Login Screen (`admin` / `admin`) ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6">
        <OfflineIndicator lang={lang} />

        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden bg-white shadow-xl border border-slate-200">
          {/* Brand Identity Panel matching Uploaded Logo */}
          <div className="lg:col-span-6 bg-[#0B3B68] text-white p-8 flex flex-col justify-between space-y-6">
            <div className="flex items-center justify-between gap-2">
              <span
                dir="ltr"
                className="text-[11px] sm:text-xs font-bold tracking-wide text-amber-300"
              >
                Al-Madar Information Technology Trading Company
              </span>
              <button
                type="button"
                onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-amber-300" />
                <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl p-7 sm:p-8 flex flex-col items-center justify-center text-center shadow-md space-y-3">
              <AlMadarLogo size="xl" showText={false} />
              <div className="space-y-1 pt-1">
                <h1 className="text-lg sm:text-xl font-extrabold text-[#0B3B68]">
                  شركة المدار لتجارة تكنولوجيا المعلومات
                </h1>
                <p
                  dir="ltr"
                  className="text-xs sm:text-sm font-bold text-[#E58E26]"
                >
                  Al-Madar Information Technology Trading Company
                </p>
              </div>
            </div>

            <div className="space-y-4 text-center">
              <p className="text-base sm:text-lg font-extrabold text-white leading-relaxed">
                {lang === 'ar'
                  ? 'نظام متكامل لإدارة عقود الصيانة وزيارات الزبائن'
                  : 'Integrated System for Maintenance Contracts & Customer Visits'}
              </p>
              <div className="flex justify-center">
                <PWAInstallButton lang={lang} variant="header" />
              </div>
            </div>
          </div>

          {/* Login Credentials Panel */}
          <div className="lg:col-span-6 p-7 sm:p-9 flex flex-col justify-between space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#0B3B68]">
                {lang === 'ar' ? 'تسجيل الدخول إلى النظام' : 'System Sign In'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                {lang === 'ar'
                  ? 'بيانات الدخول الافتراضية: اسم المستخدم admin وكلمة المرور admin'
                  : 'Default credentials: username admin and password admin'}
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold"
                >
                  {loginError}
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="login-username"
                  className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5"
                >
                  <UserIcon className="w-4 h-4 text-[#0B3B68]" />
                  <span>{lang === 'ar' ? 'اسم المستخدم' : 'Username'}</span>
                </label>
                <input
                  id="login-username"
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="login-password"
                  className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5"
                >
                  <Lock className="w-4 h-4 text-[#E58E26]" />
                  <span>{lang === 'ar' ? 'كلمة المرور' : 'Password'}</span>
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="admin"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
              </div>

              {/* 1-Tap Quick Role Fill for Touch Convenience */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginUsername('admin');
                    setLoginPassword('admin');
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  {lang === 'ar' ? 'تعبئة: مدير (admin)' : 'Fill: Manager (admin)'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginUsername('tech');
                    setLoginPassword('1234');
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  {lang === 'ar' ? 'تعبئة: فني صيانة (tech)' : 'Fill: Technician (tech)'}
                </button>
              </div>

              <button
                type="submit"
                className="w-full min-h-[50px] px-6 py-3 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white font-extrabold text-sm sm:text-base shadow-sm transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'دخول للنظام' : 'Sign In'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  setLoginError('');
                  try {
                    const result = await googleSignIn();
                    if (result) {
                      const managerUser =
                        state.users[0] || getInitialState().users[0];
                      setCurrentUser(managerUser);
                      localStorage.setItem(
                        SESSION_USER_KEY,
                        JSON.stringify(managerUser)
                      );
                      setActiveTab('backup');
                    }
                  } catch {
                    setLoginError(
                      lang === 'ar'
                        ? 'تعذر تسجيل الدخول عبر Google.'
                        : 'Google Sign-In failed.'
                    );
                  }
                }}
                className="gsi-material-button w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-2xs transition-colors cursor-pointer"
              >
                <div className="gsi-material-button-icon w-5 h-5 shrink-0">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    ></path>
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    ></path>
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    ></path>
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    ></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {lang === 'ar'
                    ? 'Sign in with Google · الدخول وربط Google Drive'
                    : 'Sign in with Google'}
                </span>
              </button>
            </form>

            {/* Customer Self-Service Portal Entry */}
            <div className="pt-4 border-t border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-500 block">
                {lang === 'ar'
                  ? 'هل أنت زبون وترغب بحجز موعد صيانة مباشرة؟'
                  : 'Are you a customer looking to book a maintenance visit?'}
              </span>
              <button
                type="button"
                onClick={() => setIsPublicPortalMode(true)}
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>
                  {lang === 'ar'
                    ? 'الدخول إلى شاشة الزبائن — تسجيل طلب صيانة'
                    : 'Open Customer Self-Service Maintenance Portal'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const navItems: {
    id: ActiveTab;
    labelAr: string;
    labelEn: string;
    mobileLabelAr: string;
    mobileLabelEn: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    {
      id: 'dashboard',
      labelAr: 'الرئيسية والملخص',
      labelEn: 'Dashboard',
      mobileLabelAr: 'الرئيسية',
      mobileLabelEn: 'Home',
      icon: LayoutDashboard,
    },
    {
      id: 'maintenance',
      labelAr: 'طلبات الصيانة',
      labelEn: 'Maintenance',
      mobileLabelAr: 'الصيانة',
      mobileLabelEn: 'Maint.',
      icon: Wrench,
    },
    {
      id: 'purchases',
      labelAr: 'المشتريات والقطع',
      labelEn: 'Purchases & Parts',
      mobileLabelAr: 'المشتريات',
      mobileLabelEn: 'Purchases',
      icon: Package,
    },
    {
      id: 'finance',
      labelAr: 'المالية والمصاريف',
      labelEn: 'Finance (JOD)',
      mobileLabelAr: 'المالية',
      mobileLabelEn: 'Finance',
      icon: Banknote,
    },
    {
      id: 'advanced_finance',
      labelAr: 'المالية المتقدمة والإحصائيات',
      labelEn: 'Adv. Finance & Stats',
      mobileLabelAr: 'المتقدمة',
      mobileLabelEn: 'Adv.',
      icon: Wallet,
    },
    {
      id: 'schedule',
      labelAr: 'جدول المواعيد',
      labelEn: 'Weekly Calendar',
      mobileLabelAr: 'المواعيد',
      mobileLabelEn: 'Schedule',
      icon: Calendar,
    },
    {
      id: 'catalogs',
      labelAr: 'الزبائن والأدلة',
      labelEn: 'Customers & Catalogs',
      mobileLabelAr: 'الزبائن',
      mobileLabelEn: 'Catalogs',
      icon: Building2,
    },
    {
      id: 'backup',
      labelAr: 'النسخ الاحتياطي و Drive',
      labelEn: 'Backup & Google Drive',
      mobileLabelAr: 'النسخ',
      mobileLabelEn: 'Backup',
      icon: Database,
    },
    {
      id: 'users',
      labelAr: 'المستخدمين',
      labelEn: 'Users & Roles',
      mobileLabelAr: 'المستخدمين',
      mobileLabelEn: 'Users',
      icon: Users,
    },
  ];

  const unreadPortalCount = (state.notifications || []).filter(
    (n) => !n.isRead
  ).length;

  const activeMaintenanceCount = (state.visits || []).filter(
    (v) => !v.isArchived && !v.isResolved && v.status !== 'resolved'
  ).length;

  const globalSearchResults = searchSystemRecords(
    state,
    globalSearchQuery,
    lang
  );

  return (
    <div className="min-h-screen w-full max-w-full bg-slate-50 flex flex-col lg:flex-row">
      <OfflineIndicator lang={lang} />

      {/* Desktop Sidebar Navigation (Al-Madar Deep Navy) */}
      <aside className="hidden lg:flex lg:w-68 lg:flex-col lg:fixed lg:inset-y-0 bg-[#0B3B68] text-white border-e border-[#155E95]/40 z-30 no-print">
        <div className="p-5 bg-white border-b border-slate-200 flex items-center justify-between">
          <AlMadarLogo size="sm" showText={true} />
        </div>

        <nav
          className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto"
          aria-label={lang === 'ar' ? 'القائمة الرئيسية' : 'Main Navigation'}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              activeTab === item.id ||
              (item.id === 'maintenance' && activeTab === 'daily_archive');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-between gap-3 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#E58E26] text-white shadow-sm'
                    : 'text-sky-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{lang === 'ar' ? item.labelAr : item.labelEn}</span>
                </span>
                {item.id === 'maintenance' && activeMaintenanceCount > 0 && (
                  <span
                    className="min-w-[22px] h-5 px-1.5 rounded-md bg-white text-[#0B3B68] font-mono text-[11px] font-black tabular-nums flex items-center justify-center shadow-xs"
                    title={lang === 'ar' ? `طلبات صيانة نشطة: ${activeMaintenanceCount}` : `Active requests: ${activeMaintenanceCount}`}
                  >
                    {activeMaintenanceCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <PWAInstallButton lang={lang} variant="header" />

          <div className="p-3 rounded-xl bg-white/10 flex items-center justify-between gap-2">
            <div className="truncate">
              <div className="text-xs font-extrabold text-white truncate">
                {currentUser.fullName}
              </div>
              <div className="text-[11px] text-amber-300 font-semibold">
                {isAdmin
                  ? lang === 'ar'
                    ? 'صلاحية: مدير النظام (Admin)'
                    : 'Role: Manager (Admin)'
                  : lang === 'ar'
                  ? 'صلاحية: فني صيانة'
                  : 'Role: Maintenance Technician'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title={lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
              aria-label={lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
              className="min-h-[40px] min-w-[40px] rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white flex items-center justify-center shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 lg:ps-68 flex flex-col min-h-screen pb-28 lg:pb-8">
        {/* Top Bar Contract: 3 Clean Zones (Brand, Global Search, Actions) */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs no-print">
          {/* Zone 1: Brand Title */}
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <div className="lg:hidden shrink-0">
              <AlMadarLogo size="sm" showText={false} />
            </div>
            <div className="flex flex-col min-w-0 leading-snug">
              <span className="text-sm sm:text-base font-extrabold text-[#0B3B68] truncate">
                شركة المدار لتجارة تكنولوجيا المعلومات
              </span>
              <span
                dir="ltr"
                className="text-[11px] font-bold text-[#E58E26] truncate"
              >
                Al-Madar Information Technology Trading Company
              </span>
            </div>
          </div>

          {/* Zone 2: Global Search Bar Across All Modules */}
          <div className="relative flex-1 min-w-[220px] max-w-md order-3 sm:order-2 w-full sm:w-auto">
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
            <input
              id="global-system-search"
              type="text"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'بحث شامل في النظام (زبون، صيانة، موعد، مصروف، قطعة)...'
                  : 'Global search (customer, visit, schedule, expense, part)...'
              }
              aria-label={lang === 'ar' ? 'بحث شامل في النظام' : 'Global system search'}
              className="w-full min-h-[42px] ps-10 pe-9 py-1.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
            {globalSearchQuery && (
              <button
                type="button"
                onClick={() => setGlobalSearchQuery('')}
                aria-label={lang === 'ar' ? 'مسح البحث' : 'Clear search'}
                className="absolute top-1/2 -translate-y-1/2 end-2.5 w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Global Search Instant Results Dropdown */}
            {globalSearchQuery.trim() !== '' && (
              <div className="absolute start-0 end-0 top-full mt-2 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 max-h-96 overflow-y-auto p-3 space-y-2">
                <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 text-xs font-extrabold text-[#0B3B68]">
                  <span>
                    {lang === 'ar'
                      ? `نتائج البحث الشامل (${globalSearchResults.length})`
                      : `Global Search Results (${globalSearchResults.length})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setGlobalSearchQuery('')}
                    className="text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    {lang === 'ar' ? 'إغلاق' : 'Close'}
                  </button>
                </div>

                {globalSearchResults.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">
                    {lang === 'ar'
                      ? 'لا توجد نتائج مطابقة في سجلات النظام.'
                      : 'No matching records found across the system.'}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {globalSearchResults.map((item) => (
                      <button
                        key={`${item.category}-${item.id}`}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.targetTab);
                          setGlobalSearchQuery('');
                        }}
                        className="w-full text-start p-2.5 rounded-xl hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 cursor-pointer"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="text-xs sm:text-sm font-extrabold text-[#0B3B68] break-words">
                            {item.title}
                          </div>
                          <div className="text-xs text-slate-600 break-words">
                            {item.subtitle}
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-[#1E824C] shrink-0 whitespace-nowrap">
                          {item.category === 'maintenance'
                            ? lang === 'ar'
                              ? 'الصيانة'
                              : 'Maintenance'
                            : item.category === 'customer'
                            ? lang === 'ar'
                              ? 'الزبائن'
                              : 'Customers'
                            : item.category === 'schedule'
                            ? lang === 'ar'
                              ? 'المواعيد'
                              : 'Schedule'
                            : item.category === 'finance'
                            ? lang === 'ar'
                              ? 'المالية'
                              : 'Finance'
                            : item.category === 'part'
                            ? lang === 'ar'
                              ? 'القطع'
                              : 'Parts'
                            : lang === 'ar'
                            ? 'الملاحظات'
                            : 'Notes'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Zone 3: Notifications Center, Backup Shortcut, Language Toggle & Logout on Mobile */}
          <div className="flex items-center gap-2 shrink-0 order-2 sm:order-3">
            <NotificationsCenter
              lang={lang}
              notifications={state.notifications || []}
              visits={state.visits}
              customers={state.customers}
              onSaveVisit={handleSaveVisit}
              liveAlert={liveAlert}
              onDismissLiveAlert={() => setLiveAlert(null)}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
              onDeleteNotification={handleDeleteNotification}
              onClearReadNotifications={handleClearReadNotifications}
              onClearAllNotifications={handleClearAllNotifications}
              canDelete={true}
              onOpenMaintenanceFromNotification={(notif) => {
                handleMarkNotificationRead(notif.id);
                setActiveTab('maintenance');
              }}
              onOpenScheduleFromNotification={(notif) => {
                handleMarkNotificationRead(notif.id);
                setActiveTab('schedule');
              }}
              onOpenCustomersPage={() => {
                setActiveTab('catalogs');
              }}
            />

            <button
              type="button"
              onClick={() => setIsGlobalMaintReportOpen(true)}
              aria-label={
                lang === 'ar'
                  ? 'طباعة تقارير الصيانة اليومية'
                  : 'Print Daily Maintenance Reports'
              }
              title={
                lang === 'ar'
                  ? 'طباعة وإرسال تقرير الصيانة اليومية (PDF / واتس اب)'
                  : 'Print & WhatsApp Daily Maintenance Report'
              }
              className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">
                {lang === 'ar' ? 'تقرير الصيانة اليومية' : 'Daily Maint. Report'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsGlobalScannerOpen(true)}
              aria-label={lang === 'ar' ? 'تصوير ورقة عمل' : 'Scan Work Notes'}
              title={
                lang === 'ar'
                  ? 'تصوير ورقة ملاحظات العمل وتفريغها كتابياً (OCR)'
                  : 'Scan Work Notes Paper (OCR)'
              }
              className="min-h-[42px] px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
            >
              <Camera className="w-4 h-4 text-[#E58E26]" />
              <span className="hidden sm:inline">
                {lang === 'ar' ? 'تصوير ورقة عمل' : 'Scan Notes'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="min-h-[42px] px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-[#0B3B68] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Globe className="w-4 h-4 text-[#E58E26]" />
              <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              aria-label={lang === 'ar' ? 'خروج' : 'Sign out'}
              className="lg:hidden min-h-[42px] px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardHomeView
              lang={lang}
              state={state}
              currentUserFullName={currentUser.fullName}
              onNavigate={setActiveTab}
              onSaveNote={handleSaveNote}
              onDeleteNote={handleDeleteNote}
              onDeleteVisit={handleDeleteVisit}
              onSaveVisit={handleSaveVisit}
              canDelete={isAdmin}
            />
          )}

          {(activeTab === 'maintenance' || activeTab === 'daily_archive') && (
            <MaintenanceView
              lang={lang}
              visits={state.visits}
              customers={state.customers}
              parts={state.parts}
              preselectedCustomerName={preselectedCustomer}
              onClearPreselectedCustomer={() => setPreselectedCustomer('')}
              onSaveVisit={handleSaveVisit}
              onDeleteVisit={handleDeleteVisit}
              onArchiveVisits={handleArchiveVisits}
              onUnarchiveVisit={handleUnarchiveVisit}
              onUnarchiveVisits={handleUnarchiveVisits}
              initialSection={activeTab === 'daily_archive' ? 'archive' : 'active'}
              currentUserFullName={currentUser.fullName}
              canDelete={isAdmin}
              canTransfer={isAdmin}
            />
          )}

          {activeTab === 'purchases' && (
            <PurchasesView
              lang={lang}
              purchases={state.purchases || []}
              parts={state.parts}
              suppliers={state.suppliers || []}
              canDelete={isAdmin}
              onSavePurchase={handleSavePurchase}
              onDeletePurchase={handleDeletePurchase}
              onAddSupplier={handleAddSupplier}
              onRenameSupplier={handleRenameSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onSettleCreditPurchase={handleSettleCreditPurchase}
              onBatchInsertPurchases={handleBatchInsertPurchases}
              onOpenFinance={() => setActiveTab('finance')}
              onOpenCatalogs={() => setActiveTab('catalogs')}
            />
          )}

          {activeTab === 'finance' && (
            <FinanceView
              lang={lang}
              state={state}
              currentUserFullName={currentUser.fullName}
              onSaveMorningCash={handleSaveMorningCash}
              onDeleteMorningCash={handleDeleteMorningCash}
              onSaveExpense={handleSaveExpense}
              onDeleteExpense={handleDeleteExpense}
              onSaveVisit={handleSaveVisit}
              onDeleteVisit={handleDeleteVisit}
              onOpenAdvancedFinance={() => setActiveTab('advanced_finance')}
              onTransferAllActiveFinance={(options) => handleTransferFinance(options)}
              canDelete={isAdmin}
              canTransfer={isAdmin}
            />
          )}

          {(activeTab === 'advanced_finance' || activeTab === 'stats') && (
            <AdvancedFinanceView
              lang={lang}
              state={state}
              currentUserFullName={currentUser.fullName}
              onTransferAllActiveFinance={(options) => handleTransferFinance(options)}
              onTransferProfitsToMorningCash={handleTransferProfitsToMorningCash}
              onRestoreFinanceRecord={handleRestoreFinanceRecord}
              onRestoreDayFinance={handleRestoreDayFinance}
              onSaveMorningCash={handleSaveMorningCash}
              onSaveExpense={handleSaveExpense}
              onSaveVisit={handleSaveVisit}
              onDeleteMorningCash={handleDeleteMorningCash}
              onDeleteExpense={handleDeleteExpense}
              onDeleteVisit={handleDeleteVisit}
              onBackToActiveFinance={() => setActiveTab('finance')}
              canDelete={isAdmin}
              canTransfer={isAdmin}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleCalendarView
              lang={lang}
              appointments={state.appointments}
              customers={state.customers}
              onSaveAppointment={handleSaveAppointment}
              onDeleteAppointment={handleDeleteAppointment}
              canDelete={isAdmin}
            />
          )}

          {activeTab === 'catalogs' && (
            <CatalogsView
              lang={lang}
              customers={state.customers}
              parts={state.parts}
              expenseTemplates={state.expenseTemplates}
              visits={state.visits}
              appointments={state.appointments}
              onSaveCustomer={handleSaveCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onSavePart={handleSavePart}
              onDeletePart={handleDeletePart}
              onSaveExpenseTemplate={handleSaveExpenseTemplate}
              onDeleteExpenseTemplate={handleDeleteExpenseTemplate}
              onDeleteVisit={handleDeleteVisit}
              onSaveVisit={handleSaveVisit}
              onCreateVisitForCustomer={(custName) => {
                setPreselectedCustomer(custName);
                setActiveTab('maintenance');
              }}
              canDelete={isAdmin}
              currentUserFullName={currentUser.fullName}
            />
          )}

          {activeTab === 'backup' && (
            <BackupRestoreView
              lang={lang}
              state={state}
              onRestoreState={(nextState, isFullReplace) => {
                hasHydratedRemoteRef.current = true;
                hasLocalUserMutationRef.current = true;
                if (isFullReplace) {
                  forceReplaceSyncRef.current = true;
                  resetEpochRef.current = Date.now();
                  deletedIdsRef.current.clear();
                }
                setState(nextState);
              }}
              onResetAllData={() => {
                if (!isAdmin) return;
                hasHydratedRemoteRef.current = true;
                hasLocalUserMutationRef.current = true;
                forceReplaceSyncRef.current = true;
                resetEpochRef.current = Date.now();
                deletedIdsRef.current.clear();
                setLiveAlert(null);
                setState((prev) => resetSystemDataState(prev));
              }}
              canDelete={isAdmin}
            />
          )}

          {activeTab === 'users' && (
            <UsersView
              lang={lang}
              users={state.users}
              currentUser={currentUser}
              state={state}
              onSaveUser={handleSaveUser}
              onDeleteUser={handleDeleteUser}
              onSaveCashAdvance={handleSaveCashAdvance}
              onDeleteCashAdvance={handleDeleteCashAdvance}
            />
          )}
        </main>
      </div>

      {/* Mobile & Tablet Touch Bottom Navigation Bar (Balanced Size for Phones) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1.5 py-1.5 flex items-center justify-between overflow-x-auto gap-1 shadow-[0_-4px_16px_rgba(11,59,104,0.08)] no-print"
        aria-label={lang === 'ar' ? 'شريط التنقل السفلي' : 'Mobile Bottom Navigation'}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            activeTab === item.id ||
            (item.id === 'maintenance' && activeTab === 'daily_archive');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`relative min-h-[52px] min-w-[66px] sm:min-w-[74px] flex-1 py-1.5 px-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#0B3B68] text-white font-extrabold shadow-xs ring-1 ring-[#E58E26]/60'
                  : 'bg-slate-50/80 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200/70'
              }`}
            >
              <Icon
                className={`w-[18px] h-[18px] sm:w-5 sm:h-5 stroke-[2.1] ${
                  active ? 'text-[#E58E26]' : 'text-[#0B3B68]'
                }`}
              />
              <span className="text-[11px] sm:text-xs leading-tight whitespace-nowrap tracking-tight">
                {lang === 'ar' ? item.mobileLabelAr : item.mobileLabelEn}
              </span>
              {item.id === 'maintenance' && activeMaintenanceCount > 0 && (
                <span className="absolute top-1 end-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-600 text-white font-mono text-[10px] font-black tabular-nums flex items-center justify-center shadow-xs">
                  {activeMaintenanceCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Global Work Notes OCR Scanner Modal */}
      <WorkNotesScannerModal
        lang={lang}
        isOpen={isGlobalScannerOpen}
        onClose={() => setIsGlobalScannerOpen(false)}
        onInsertNotes={handleGlobalScanNotesInsert}
        onApplyExtractedData={handleGlobalScanApplyData}
        titleCustom={
          lang === 'ar'
            ? 'تصوير ورقة ملاحظات العمل وإدراجها كتابياً'
            : 'Scan & Transcribe Work Notes Paper'
        }
      />

      <DailyMaintenanceReportModal
        isOpen={isGlobalMaintReportOpen}
        onClose={() => setIsGlobalMaintReportOpen(false)}
        lang={lang}
        allVisits={state.visits}
        initialScope="all"
        currentUserFullName={currentUser.fullName}
      />
    </div>
  );
}
