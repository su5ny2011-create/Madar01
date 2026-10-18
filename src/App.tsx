import React, { useState, useEffect } from 'react';
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
  Wrench,
  X,
} from 'lucide-react';
import type {
  AppNotification,
  AppState,
  Customer,
  DailyNote,
  ExpenseRecord,
  ExpenseTemplate,
  Language,
  MaintenanceVisit,
  MorningCashRecord,
  PartItem,
  ScheduleAppointment,
  User,
} from './types';
import {
  authenticateUser,
  createCustomerBookingIntoState,
  createMaintenanceNotification,
  deleteMaintenanceVisitFromState,
  getInitialState,
  searchSystemRecords,
  syncAppointmentIntoState,
  syncExpenseIntoState,
  syncMaintenanceVisitIntoState,
} from './utils/logic';
import type { CustomerBookingInput } from './utils/logic';
import { AlMadarLogo } from './components/AlMadarLogo';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton';
import { DashboardHomeView } from './components/DashboardHomeView';
import { MaintenanceView } from './components/MaintenanceView';
import { FinanceView } from './components/FinanceView';
import { CatalogsView } from './components/CatalogsView';
import { ScheduleCalendarView } from './components/ScheduleCalendarView';
import { StatisticsExportView } from './components/StatisticsExportView';
import { CustomerPortalView } from './components/CustomerPortalView';
import { UsersView } from './components/UsersView';
import { NotificationsCenter } from './components/NotificationsCenter';
import { BackupRestoreView } from './components/BackupRestoreView';

type ActiveTab =
  | 'dashboard'
  | 'maintenance'
  | 'finance'
  | 'schedule'
  | 'catalogs'
  | 'stats'
  | 'backup'
  | 'users';

const STORAGE_KEY = 'al_madar_it_pwa_state_v2';
const SESSION_USER_KEY = 'al_madar_it_current_user_v2';

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [state, setState] = useState<AppState>(() => {
    const initial = getInitialState();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AppState;
        if (parsed && Array.isArray(parsed.users) && parsed.users.length > 0) {
          return {
            ...initial,
            ...parsed,
            notifications: Array.isArray(parsed.notifications)
              ? parsed.notifications
              : initial.notifications || [],
          };
        }
      }
    } catch {
      // Fallback to initial seed state
    }
    return initial;
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

  // Persist AppState to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage quota errors
    }
  }, [state]);

  // Listen for cross-tab customer portal submissions
  useEffect(() => {
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
              return parsed;
            });
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Update HTML dir & lang attributes for RTL/LTR support
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

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

  // --- State Updaters with Full Cross-Page Synchronization ---
  const handleSaveVisit = (visit: MaintenanceVisit) => {
    const isNewVisit = !state.visits.some((v) => v.id === visit.id);
    setState((prev) =>
      syncMaintenanceVisitIntoState(prev, visit, { notifyOnNew: true })
    );
    if (isNewVisit) {
      setLiveAlert(createMaintenanceNotification(visit));
    }
  };

  const handleDeleteVisit = (visitId: string) => {
    setState((prev) => deleteMaintenanceVisitFromState(prev, visitId));
  };

  const handleCustomerBooking = (input: CustomerBookingInput): MaintenanceVisit => {
    const res = createCustomerBookingIntoState(state, input);
    setState(res.nextState);
    setLiveAlert(res.createdNotification);
    return res.createdVisit;
  };

  const handleMarkNotificationRead = (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: (prev.notifications || []).map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    }));
  };

  const handleMarkAllNotificationsRead = () => {
    setState((prev) => ({
      ...prev,
      notifications: (prev.notifications || []).map((n) => ({
        ...n,
        isRead: true,
      })),
    }));
  };

  const handleDeleteNotification = (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: (prev.notifications || []).filter((n) => n.id !== id),
    }));
  };

  const handleClearAllNotifications = () => {
    setState((prev) => ({
      ...prev,
      notifications: [],
    }));
  };

  const handleSaveMorningCash = (record: MorningCashRecord) => {
    setState((prev) => {
      const idx = prev.morningCash.findIndex((m) => m.id === record.id);
      const next =
        idx >= 0
          ? prev.morningCash.map((m, i) => (i === idx ? record : m))
          : [record, ...prev.morningCash];
      return { ...prev, morningCash: next };
    });
  };

  const handleDeleteMorningCash = (id: string) => {
    setState((prev) => ({
      ...prev,
      morningCash: prev.morningCash.filter((m) => m.id !== id),
    }));
  };

  const handleSaveExpense = (record: ExpenseRecord) => {
    setState((prev) => syncExpenseIntoState(prev, record));
  };

  const handleDeleteExpense = (id: string) => {
    setState((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
  };

  const handleSaveCustomer = (customer: Customer) => {
    setState((prev) => {
      const idx = prev.customers.findIndex((c) => c.id === customer.id);
      const next =
        idx >= 0
          ? prev.customers.map((c, i) => (i === idx ? customer : c))
          : [customer, ...prev.customers];
      return { ...prev, customers: next };
    });
  };

  const handleDeleteCustomer = (id: string) => {
    setState((prev) => ({
      ...prev,
      customers: prev.customers.filter((c) => c.id !== id),
    }));
  };

  const handleSavePart = (part: PartItem) => {
    setState((prev) => {
      const idx = prev.parts.findIndex((p) => p.id === part.id);
      const next =
        idx >= 0
          ? prev.parts.map((p, i) => (i === idx ? part : p))
          : [part, ...prev.parts];
      return { ...prev, parts: next };
    });
  };

  const handleDeletePart = (id: string) => {
    setState((prev) => ({
      ...prev,
      parts: prev.parts.filter((p) => p.id !== id),
    }));
  };

  const handleSaveExpenseTemplate = (tpl: ExpenseTemplate) => {
    setState((prev) => {
      const idx = prev.expenseTemplates.findIndex((t) => t.id === tpl.id);
      const next =
        idx >= 0
          ? prev.expenseTemplates.map((t, i) => (i === idx ? tpl : t))
          : [tpl, ...prev.expenseTemplates];
      return { ...prev, expenseTemplates: next };
    });
  };

  const handleDeleteExpenseTemplate = (id: string) => {
    setState((prev) => ({
      ...prev,
      expenseTemplates: prev.expenseTemplates.filter((t) => t.id !== id),
    }));
  };

  const handleSaveAppointment = (apt: ScheduleAppointment) => {
    setState((prev) => syncAppointmentIntoState(prev, apt));
  };

  const handleDeleteAppointment = (id: string) => {
    setState((prev) => ({
      ...prev,
      appointments: prev.appointments.filter((a) => a.id !== id),
    }));
  };

  const handleSaveNote = (note: DailyNote) => {
    setState((prev) => {
      const idx = prev.dailyNotes.findIndex((n) => n.id === note.id);
      const next =
        idx >= 0
          ? prev.dailyNotes.map((n, i) => (i === idx ? note : n))
          : [note, ...prev.dailyNotes];
      return { ...prev, dailyNotes: next };
    });
  };

  const handleDeleteNote = (id: string) => {
    setState((prev) => ({
      ...prev,
      dailyNotes: prev.dailyNotes.filter((n) => n.id !== id),
    }));
  };

  const handleSaveUser = (usr: User) => {
    setState((prev) => {
      const idx = prev.users.findIndex((u) => u.id === usr.id);
      const next =
        idx >= 0
          ? prev.users.map((u, i) => (i === idx ? usr : u))
          : [usr, ...prev.users];
      return { ...prev, users: next };
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
    icon: React.FC<{ className?: string }>;
  }[] = [
    {
      id: 'dashboard',
      labelAr: 'الرئيسية والملخص',
      labelEn: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'maintenance',
      labelAr: 'طلبات الصيانة',
      labelEn: 'Maintenance',
      icon: Wrench,
    },
    {
      id: 'finance',
      labelAr: 'المالية والمصاريف',
      labelEn: 'Finance (JOD)',
      icon: Banknote,
    },
    {
      id: 'schedule',
      labelAr: 'جدول المواعيد',
      labelEn: 'Weekly Calendar',
      icon: Calendar,
    },
    {
      id: 'catalogs',
      labelAr: 'الزبائن والقطع',
      labelEn: 'Customers & Parts',
      icon: Building2,
    },
    {
      id: 'stats',
      labelAr: 'الإحصاءات والتصدير',
      labelEn: 'Stats & Export',
      icon: BarChart3,
    },
    {
      id: 'backup',
      labelAr: 'النسخ الاحتياطي',
      labelEn: 'Backup & Restore',
      icon: Database,
    },
    {
      id: 'users',
      labelAr: 'المستخدمين',
      labelEn: 'Users & Roles',
      icon: Users,
    },
  ];

  const unreadPortalCount = (state.notifications || []).filter(
    (n) => !n.isRead
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
            const active = activeTab === item.id;
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
                {item.id === 'maintenance' && unreadPortalCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-md bg-white text-[#0B3B68] font-mono text-[11px] font-extrabold tabular-nums flex items-center justify-center">
                    {unreadPortalCount}
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
                {currentUser.role === 'manager'
                  ? lang === 'ar'
                    ? 'صلاحية: مدير'
                    : 'Role: Manager'
                  : lang === 'ar'
                  ? 'صلاحية: فني صيانة'
                  : 'Role: Technician'}
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
      <div className="flex-1 min-w-0 lg:ps-68 flex flex-col min-h-screen pb-20 lg:pb-8">
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
              liveAlert={liveAlert}
              onDismissLiveAlert={() => setLiveAlert(null)}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
              onDeleteNotification={handleDeleteNotification}
              onClearAllNotifications={handleClearAllNotifications}
              onOpenMaintenanceFromNotification={(notif) => {
                handleMarkNotificationRead(notif.id);
                setActiveTab('maintenance');
              }}
            />

            <button
              type="button"
              onClick={() => setActiveTab('backup')}
              aria-label={lang === 'ar' ? 'النسخ الاحتياطي' : 'Backup & Restore'}
              className={`min-h-[42px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'backup'
                  ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#0B3B68]'
              }`}
            >
              <Database
                className={`w-4 h-4 ${
                  activeTab === 'backup' ? 'text-amber-300' : 'text-[#1E824C]'
                }`}
              />
              <span className="hidden md:inline">
                {lang === 'ar' ? 'النسخ الاحتياطي' : 'Backup'}
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
            />
          )}

          {activeTab === 'maintenance' && (
            <MaintenanceView
              lang={lang}
              visits={state.visits}
              customers={state.customers}
              parts={state.parts}
              preselectedCustomerName={preselectedCustomer}
              onClearPreselectedCustomer={() => setPreselectedCustomer('')}
              onSaveVisit={handleSaveVisit}
              onDeleteVisit={handleDeleteVisit}
              currentUserFullName={currentUser.fullName}
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
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleCalendarView
              lang={lang}
              appointments={state.appointments}
              customers={state.customers}
              onSaveAppointment={handleSaveAppointment}
              onDeleteAppointment={handleDeleteAppointment}
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
              onCreateVisitForCustomer={(custName) => {
                setPreselectedCustomer(custName);
                setActiveTab('maintenance');
              }}
            />
          )}

          {activeTab === 'stats' && (
            <StatisticsExportView lang={lang} state={state} />
          )}

          {activeTab === 'backup' && (
            <BackupRestoreView
              lang={lang}
              state={state}
              onRestoreState={(nextState) => setState(nextState)}
            />
          )}

          {activeTab === 'users' && (
            <UsersView
              lang={lang}
              users={state.users}
              currentUser={currentUser}
              onSaveUser={handleSaveUser}
              onDeleteUser={handleDeleteUser}
            />
          )}
        </main>
      </div>

      {/* Mobile & Tablet Touch Bottom Navigation Bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-1.5 py-1 flex items-center justify-between overflow-x-auto gap-1 no-print"
        aria-label={lang === 'ar' ? 'شريط التنقل السفلي' : 'Mobile Bottom Navigation'}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[48px] min-w-[60px] flex-1 py-1 px-1.5 rounded-xl flex flex-col items-center justify-center transition-colors shrink-0 cursor-pointer ${
                active
                  ? 'bg-sky-50 text-[#0B3B68] font-extrabold'
                  : 'text-slate-500'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${active ? 'text-[#E58E26]' : 'text-slate-500'}`}
              />
              <span className="text-[10px] mt-0.5 whitespace-nowrap">
                {lang === 'ar' ? item.labelAr.split(' ')[0] : item.labelEn.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
