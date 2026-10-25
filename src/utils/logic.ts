import type {
  AppNotification,
  AppState,
  CashAdvanceRecord,
  Customer,
  ExpenseRecord,
  FinancialSummary,
  Language,
  MaintenanceVisit,
  MorningCashRecord,
  ReportPeriod,
  ScheduleAppointment,
  User,
} from '../types.ts';

export function getTodayStr(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  const ry = dt.getUTCFullYear();
  const rm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const rd = String(dt.getUTCDate()).padStart(2, '0');
  return `${ry}-${rm}-${rd}`;
}

/**
 * Jordan standard workweek starts Saturday (day 6) through Friday (day 5).
 */
export function getWeekStartSaturday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const dayOfWeek = dt.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToSaturday = dayOfWeek === 6 ? 0 : -(dayOfWeek + 1);
  return addDaysStr(dateStr, diffToSaturday);
}

export function getWeekDays(referenceDateStr: string): string[] {
  const startSat = getWeekStartSaturday(referenceDateStr);
  return Array.from({ length: 7 }, (_, i) => addDaysStr(startSat, i));
}

const AR_WEEKDAY_NAMES = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];
const EN_WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function getDayName(dateStr: string, lang: Language = 'ar'): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
  const idx = dt.getUTCDay();
  return lang === 'ar'
    ? AR_WEEKDAY_NAMES[idx] || ''
    : EN_WEEKDAY_NAMES[idx] || '';
}

export function getPeriodRange(
  period: ReportPeriod,
  referenceDateStr: string
): { startDate: string; endDate: string } {
  if (period === 'daily') {
    return { startDate: referenceDateStr, endDate: referenceDateStr };
  }
  if (period === 'weekly') {
    const startSat = getWeekStartSaturday(referenceDateStr);
    return { startDate: startSat, endDate: addDaysStr(startSat, 6) };
  }
  if (period === 'monthly') {
    const prefix = referenceDateStr.slice(0, 7); // YYYY-MM
    const [y, m] = prefix.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return {
      startDate: `${prefix}-01`,
      endDate: `${prefix}-${String(lastDay).padStart(2, '0')}`,
    };
  }
  return { startDate: '0000-01-01', endDate: '9999-12-31' };
}

export function isDateInRange(
  dateStr: string,
  startDate: string,
  endDate: string
): boolean {
  return dateStr >= startDate && dateStr <= endDate;
}

export function formatJod(amount: number, lang: Language = 'ar'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = safe.toFixed(2);
  return lang === 'ar' ? `${formatted} د.أ` : `${formatted} JOD`;
}

export function deduplicateUsers(users: User[]): User[] {
  if (!Array.isArray(users)) return [];
  const map = new Map<string, User>();
  for (const u of users) {
    if (!u || !u.username) continue;
    const key = u.username.trim().toLowerCase();
    const existing = map.get(key);
    // Prefer 'user-admin' over legacy 'u-admin' if both exist
    if (!existing || (existing.id === 'u-admin' && u.id === 'user-admin') || u.id !== 'u-admin') {
      map.set(key, u);
    }
  }
  return Array.from(map.values());
}

export function authenticateUser(
  users: User[],
  usernameInput: string,
  passwordInput: string
): User | null {
  const cleanUser = usernameInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();
  if (!cleanUser || !cleanPass) return null;

  const found = users.find(
    (u) =>
      u.active &&
      u.username.trim().toLowerCase() === cleanUser &&
      (u.password === cleanPass ||
        (cleanUser === 'admin' &&
          (u.password === 'admin' || u.password === '123') &&
          (cleanPass === 'admin' || cleanPass === '123')))
  );
  return found || null;
}

export function createMaintenanceNotification(
  visit: MaintenanceVisit
): AppNotification {
  const cleanName = visit.customerName.trim();
  const visitTime = visit.visitTime || '10:00';
  const isPortal = visit.source === 'customer_portal';

  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: isPortal
      ? `طلب صيانة جديد من الزبون: ${cleanName}`
      : `طلب صيانة جديد (المدير / الإدارة): ${cleanName}`,
    message: `${visit.problem} — التاريخ: ${visit.visitDate} الساعة ${visitTime}`,
    customerName: cleanName,
    phone: visit.phone || '',
    visitDate: visit.visitDate,
    visitTime,
    linkedVisitId: visit.id,
    source: visit.source,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Synchronizes a MaintenanceVisit into AppState:
 * 1. Upserts the visit in state.visits
 * 2. Auto-registers the customer in state.customers if not already present
 * 3. Auto-syncs the primary visit appointment and optional nextVisitDate appointment in state.appointments
 * 4. Optionally creates an unread notification when a new visit is added (from Customer or Manager/Staff)
 */
export function syncMaintenanceVisitIntoState(
  state: AppState,
  visit: MaintenanceVisit,
  options?: { notifyOnNew?: boolean }
): AppState {
  const cleanName = visit.customerName.trim();
  if (!cleanName) {
    throw new Error('Customer name is required');
  }

  // 1. Ensure customer exists in state.customers
  let matchedCustomer = state.customers.find(
    (c) => c.name.trim().toLowerCase() === cleanName.toLowerCase()
  );
  let nextCustomers = [...state.customers];

  if (!matchedCustomer) {
    matchedCustomer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      phone: visit.phone || '',
      address: '',
      contractType: visit.visitType === 'contract' ? 'annual' : 'on_demand',
      contractFeeJod: visit.visitType === 'contract' ? visit.amountJod : 0,
      notes: 'تمت الإضافة تلقائياً من سجل الصيانة',
      createdAt: visit.visitDate,
    };
    nextCustomers = [matchedCustomer, ...nextCustomers];
  } else if (visit.phone && !matchedCustomer.phone) {
    // Enrich customer phone if previously empty
    nextCustomers = nextCustomers.map((c) =>
      c.id === matchedCustomer!.id ? { ...c, phone: visit.phone } : c
    );
  }

  // 2. Upsert visit (preserving existing metadata flags if updating)
  const existingIdx = state.visits.findIndex((v) => v.id === visit.id);
  const isNewVisit = existingIdx < 0;
  const baseVisit =
    existingIdx >= 0 ? { ...state.visits[existingIdx], ...visit } : visit;

  const resolvedStatus =
    Boolean(baseVisit.isResolved) || baseVisit.status === 'resolved';
  const normalizedStatus = resolvedStatus
    ? 'resolved'
    : baseVisit.status === 'in_progress'
    ? 'in_progress'
    : 'pending';

  const enrichedVisit: MaintenanceVisit = {
    ...baseVisit,
    status: normalizedStatus,
    isResolved: resolvedStatus,
    amountJod: baseVisit.visitType === 'contract' ? 0 : baseVisit.amountJod,
    isPaid: baseVisit.visitType === 'contract' ? false : baseVisit.isPaid,
    customerId: matchedCustomer.id,
    customerName: cleanName,
  };

  const nextVisits =
    existingIdx >= 0
      ? state.visits.map((v, i) => (i === existingIdx ? enrichedVisit : v))
      : [enrichedVisit, ...state.visits];

  // 3. Sync appointments linked to this visit (preserving reminderSent30Min if date & time match)
  const existingMainApt = state.appointments.find(
    (a) => a.id === `apt-main-${enrichedVisit.id}`
  );
  const existingNextApt = state.appointments.find(
    (a) => a.id === `apt-next-${enrichedVisit.id}`
  );
  const filteredAppointments = state.appointments.filter(
    (a) => a.linkedVisitId !== enrichedVisit.id
  );

  const visitTimeNorm = enrichedVisit.visitTime || '10:00';
  const mainAppointment: ScheduleAppointment = {
    id: `apt-main-${enrichedVisit.id}`,
    title:
      enrichedVisit.visitType === 'contract'
        ? `زيارة عقد صيانة: ${enrichedVisit.problem}`
        : `صيانة: ${enrichedVisit.problem}`,
    customerName: enrichedVisit.customerName,
    phone: enrichedVisit.phone,
    date: enrichedVisit.visitDate,
    time: visitTimeNorm,
    type: 'maintenance',
    linkedVisitId: enrichedVisit.id,
    status: enrichedVisit.isResolved ? 'completed' : 'scheduled',
    note: enrichedVisit.note,
    reminderSent30Min:
      existingMainApt &&
      existingMainApt.date === enrichedVisit.visitDate &&
      existingMainApt.time === visitTimeNorm
        ? existingMainApt.reminderSent30Min
        : false,
  };

  const newAppointments: ScheduleAppointment[] = [mainAppointment];

  if (enrichedVisit.nextVisitDate && enrichedVisit.nextVisitDate.trim() !== '') {
    newAppointments.push({
      id: `apt-next-${enrichedVisit.id}`,
      title: `زيارة قادمة (متابعة): ${enrichedVisit.customerName}`,
      customerName: enrichedVisit.customerName,
      phone: enrichedVisit.phone,
      date: enrichedVisit.nextVisitDate,
      time: visitTimeNorm,
      type: 'next_visit',
      linkedVisitId: enrichedVisit.id,
      status: 'scheduled',
      note: `متابعة صيانة سابقة (${enrichedVisit.problem})`,
      reminderSent30Min:
        existingNextApt &&
        existingNextApt.date === enrichedVisit.nextVisitDate &&
        existingNextApt.time === visitTimeNorm
          ? existingNextApt.reminderSent30Min
          : false,
    });
  }

  // 4. Auto-register any new parts from requiredParts or installedParts into state.parts,
  // and decrement stockQty when an existing catalog part is newly installed (supporting "(xN)" quantities)
  const parsePartStr = (raw: string) => {
    const trimmed = raw.trim();
    const m = trimmed.match(/^(.*?)\s*\(x(\d+)\)$/i);
    if (m) {
      return { baseName: m[1].trim(), qty: Math.max(1, parseInt(m[2], 10) || 1) };
    }
    return { baseName: trimmed, qty: 1 };
  };

  let nextParts = [...state.parts];
  const prevInstalledMap = new Map<string, number>();
  for (const raw of existingIdx >= 0 ? state.visits[existingIdx].installedParts || [] : []) {
    const { baseName, qty } = parsePartStr(raw);
    if (baseName) {
      const k = baseName.toLowerCase();
      prevInstalledMap.set(k, (prevInstalledMap.get(k) || 0) + qty);
    }
  }

  const newInstalledMap = new Map<string, number>();
  for (const raw of enrichedVisit.installedParts || []) {
    const { baseName, qty } = parsePartStr(raw);
    if (baseName) {
      const k = baseName.toLowerCase();
      newInstalledMap.set(k, (newInstalledMap.get(k) || 0) + qty);
    }
  }

  nextParts = nextParts.map((pt) => {
    const key = pt.name.trim().toLowerCase();
    const prevQ = prevInstalledMap.get(key) || 0;
    const newQ = newInstalledMap.get(key) || 0;
    if (newQ > prevQ) {
      return {
        ...pt,
        stockQty: Math.max(0, (pt.stockQty || 0) - (newQ - prevQ)),
      };
    }
    return pt;
  });

  const allVisitParts = [
    ...(enrichedVisit.requiredParts || []),
    ...(enrichedVisit.installedParts || []),
  ];
  for (const rawPartName of allVisitParts) {
    const { baseName: cleanPart } = parsePartStr(rawPartName);
    if (!cleanPart) continue;
    const exists = nextParts.some(
      (p) => p.name.trim().toLowerCase() === cleanPart.toLowerCase()
    );
    if (!exists) {
      nextParts = [
        {
          id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: cleanPart,
          category: 'قطع صيانة',
          defaultCostJod: 0,
          defaultPriceJod: 0,
          stockQty: 1,
          notes: 'تمت الإضافة تلقائياً من طلبات الصيانة',
        },
        ...nextParts,
      ];
    }
  }

  // 5. Create notification if requested and this is a new maintenance visit
  let nextNotifications = state.notifications || [];
  if (isNewVisit && options?.notifyOnNew) {
    const notif = createMaintenanceNotification(enrichedVisit);
    nextNotifications = [notif, ...nextNotifications];
  }

  return {
    ...state,
    customers: nextCustomers,
    parts: nextParts,
    visits: nextVisits,
    appointments: [...newAppointments, ...filteredAppointments],
    notifications: nextNotifications,
  };
}

export function deleteMaintenanceVisitFromState(
  state: AppState,
  visitId: string
): AppState {
  return {
    ...state,
    visits: state.visits.filter((v) => v.id !== visitId),
    appointments: state.appointments.filter((a) => a.linkedVisitId !== visitId),
    notifications: (state.notifications || []).filter(
      (n) => n.linkedVisitId !== visitId
    ),
  };
}

/**
 * Automatically archives requests from ended/previous days (visitDate < todayStr)
 * into the "Daily Maintenance Requests" (طلبات الصيانة اليومية) archive without losing any information.
 */
export function autoArchivePastDayVisits(
  state: AppState,
  todayStr: string = getTodayStr()
): { state: AppState; archivedCount: number } {
  let archivedCount = 0;
  const nextVisits = state.visits.map((v) => {
    // Automatically archive visits from previous/ended days (visitDate < todayStr) to Old Requests archive
    const isExcludedToday = v.autoArchiveExcludedDate === todayStr;
    if (!v.isArchived && !isExcludedToday && v.visitDate < todayStr) {
      archivedCount += 1;
      return {
        ...v,
        isArchived: true,
        archivedAt: todayStr,
        autoArchiveExcluded: false,
        autoArchiveExcludedDate: undefined,
      };
    }
    return v;
  });

  if (archivedCount === 0) {
    return { state, archivedCount: 0 };
  }

  return {
    state: {
      ...state,
      visits: nextVisits,
    },
    archivedCount,
  };
}

/**
 * Transfers completed maintenance visits (or specific visitIds) to the
 * "Daily Maintenance Requests" (طلبات الصيانة اليومية) archive without losing any data.
 */
export function archiveVisitsIntoState(
  state: AppState,
  visitIds?: string[],
  todayStr: string = getTodayStr()
): { state: AppState; archivedCount: number } {
  const idSet = visitIds ? new Set(visitIds) : null;
  let archivedCount = 0;

  const nextVisits = state.visits.map((v) => {
    const shouldArchive = idSet
      ? idSet.has(v.id) && !v.isArchived
      : (v.isResolved || v.status === 'resolved') && !v.isArchived;

    if (shouldArchive) {
      archivedCount += 1;
      return {
        ...v,
        isArchived: true,
        archivedAt: todayStr,
        autoArchiveExcluded: false,
        autoArchiveExcludedDate: undefined,
      };
    }
    return v;
  });

  if (archivedCount === 0) {
    return { state, archivedCount: 0 };
  }

  return {
    state: {
      ...state,
      visits: nextVisits,
    },
    archivedCount,
  };
}

/**
 * Restores an archived maintenance visit back to the active Maintenance Requests list.
 */
export function unarchiveVisitFromState(
  state: AppState,
  visitId: string,
  todayStr: string = getTodayStr()
): AppState {
  return {
    ...state,
    visits: state.visits.map((v) =>
      v.id === visitId
        ? {
            ...v,
            isArchived: false,
            archivedAt: undefined,
            autoArchiveExcluded: true,
            autoArchiveExcludedDate: todayStr,
          }
        : v
    ),
  };
}

/**
 * Restores multiple (or all) archived maintenance visits back to the active Maintenance Requests list.
 */
export function unarchiveVisitsFromState(
  state: AppState,
  visitIds?: string[],
  todayStr: string = getTodayStr()
): { state: AppState; restoredCount: number } {
  const idSet = visitIds && visitIds.length > 0 ? new Set(visitIds) : null;
  let restoredCount = 0;

  const nextVisits = state.visits.map((v) => {
    const shouldRestore = idSet
      ? idSet.has(v.id) && Boolean(v.isArchived)
      : Boolean(v.isArchived);

    if (shouldRestore) {
      restoredCount += 1;
      return {
        ...v,
        isArchived: false,
        archivedAt: undefined,
        autoArchiveExcluded: true,
        autoArchiveExcludedDate: todayStr,
      };
    }
    return v;
  });

  if (restoredCount === 0) {
    return { state, restoredCount: 0 };
  }

  return {
    state: {
      ...state,
      visits: nextVisits,
    },
    restoredCount,
  };
}

/**
 * Automatically archives past-day financial transactions (date < todayStr)
 * into "المالية المتقدمة" (Advanced Finance) and automatically rolls over their
 * net collections/expenses directly into active Morning Cash for todayStr.
 */
export function autoArchivePastDayFinance(
  state: AppState,
  todayStr: string = getTodayStr()
): { state: AppState; archivedCount: number; rolledOverProfitJod: number } {
  let archivedCount = 0;
  let rolledOverProfitJod = 0;

  // 1. Identify previous active morning cash that will be archived
  let previousMorningCashJod = 0;
  for (const m of state.morningCash) {
    if (!m.isArchived && m.date < todayStr) {
      previousMorningCashJod += Number(m.amountJod) || 0;
    }
  }

  // 2. Identify unrolled revenue & expenses from past days (date < todayStr)
  let pastRevenueJod = 0;
  let pastExpensesJod = 0;
  const targetVisitIds = new Set<string>();
  const targetExpenseIds = new Set<string>();

  for (const v of state.visits) {
    const isExcludedToday = v.financeAutoArchiveExcludedDate === todayStr;
    if (
      v.isPaid &&
      v.visitType !== 'contract' &&
      !isExcludedToday &&
      v.visitDate < todayStr &&
      (!v.isFinanceArchived || !v.profitTransferredToMorningCash)
    ) {
      targetVisitIds.add(v.id);
      // CliQ and Check payments do NOT get added to Cash (الكاش)
      if (v.paymentMethod === 'cash') {
        pastRevenueJod += Number(v.amountJod) || 0;
      }
    }
  }

  for (const e of state.expenses) {
    const isExcludedToday = e.autoArchiveExcludedDate === todayStr;
    if (
      !isExcludedToday &&
      e.date < todayStr &&
      (!e.isArchived || !e.profitTransferredToMorningCash)
    ) {
      targetExpenseIds.add(e.id);
      if (e.paymentMethod === 'cash') {
        pastExpensesJod += Number(e.amountJod) || 0;
      }
    }
  }

  pastRevenueJod = Number(pastRevenueJod.toFixed(2));
  pastExpensesJod = Number(pastExpensesJod.toFixed(2));
  const netProfit = Number((pastRevenueJod - pastExpensesJod).toFixed(2));

  // 3. Archive past morning cash records
  const nextMorningCashBase = state.morningCash.map((m) => {
    const isExcludedToday = m.autoArchiveExcludedDate === todayStr;
    if (!m.isArchived && !isExcludedToday && m.date < todayStr) {
      archivedCount += 1;
      return {
        ...m,
        isArchived: true,
        archivedAt: todayStr,
        autoArchiveExcluded: false,
        autoArchiveExcludedDate: undefined,
      };
    }
    return m;
  });

  // 4. Archive & mark profitTransferred for past expenses
  const nextExpenses = state.expenses.map((e) => {
    if (targetExpenseIds.has(e.id)) {
      if (!e.isArchived) archivedCount += 1;
      return {
        ...e,
        isArchived: true,
        archivedAt: todayStr,
        profitTransferredToMorningCash: true,
        autoArchiveExcluded: false,
        autoArchiveExcludedDate: undefined,
      };
    }
    return e;
  });

  // 5. Archive & mark profitTransferred for past visits
  const nextVisits = state.visits.map((v) => {
    if (targetVisitIds.has(v.id)) {
      if (!v.isFinanceArchived) archivedCount += 1;
      return {
        ...v,
        isFinanceArchived: true,
        financeArchivedAt: todayStr,
        profitTransferredToMorningCash: true,
        financeAutoArchiveExcluded: false,
        financeAutoArchiveExcludedDate: undefined,
      };
    }
    return v;
  });

  // Check if any rollover or archiving occurred
  const hasPastTransactionsToRollover =
    targetVisitIds.size > 0 || targetExpenseIds.size > 0 || previousMorningCashJod > 0;

  if (archivedCount === 0 && !hasPastTransactionsToRollover) {
    return { state, archivedCount: 0, rolledOverProfitJod: 0 };
  }

  let finalMorningCash = nextMorningCashBase;
  rolledOverProfitJod = netProfit;

  if (hasPastTransactionsToRollover) {
    // Check if there is already an active morning cash for todayStr
    const existingTodayMcIdx = finalMorningCash.findIndex(
      (m) => !m.isArchived && m.date === todayStr
    );

    if (existingTodayMcIdx >= 0) {
      const existing = finalMorningCash[existingTodayMcIdx];
      const newAmt = Number(
        (
          Number(existing.amountJod || 0) +
          (previousMorningCashJod > 0 && Number(existing.amountJod || 0) === 0
            ? previousMorningCashJod
            : 0) +
          netProfit
        ).toFixed(2)
      );
      const noteAddition = `ترحيل تلقائي لنهاية اليوم السابق (صافي أرباح: ${
        netProfit >= 0 ? '+' : ''
      }${netProfit.toFixed(2)} د.أ)`;
      const updatedNote = existing.note
        ? existing.note.includes('ترحيل تلقائي')
          ? existing.note
          : `${existing.note} · ${noteAddition}`
        : noteAddition;

      finalMorningCash = finalMorningCash.map((m, idx) =>
        idx === existingTodayMcIdx
          ? {
              ...m,
              amountJod: newAmt,
              note: updatedNote,
              recordedBy: m.recordedBy || 'النظام (ترحيل تلقائي)',
              autoArchiveExcluded: true,
            }
          : m
      );
    } else {
      // Create today's opening morning cash with previous cash + net profit
      const openingAmount = Number(
        (previousMorningCashJod + netProfit).toFixed(2)
      );
      const newRecord: MorningCashRecord = {
        id: `mc-auto-rollover-${todayStr}-${Date.now().toString(36).slice(2, 6)}`,
        date: todayStr,
        amountJod: Math.max(0, openingAmount),
        note: `ترحيل تلقائي لنهاية اليوم — رصيد مرحّل من اليوم السابق (صافي أرباح: ${
          netProfit >= 0 ? '+' : ''
        }${netProfit.toFixed(2)} د.أ | مقبوضات: ${pastRevenueJod.toFixed(
          2
        )} د.أ - مصاريف: ${pastExpensesJod.toFixed(2)} د.أ)`,
        recordedBy: 'النظام (ترحيل تلقائي لنهاية اليوم)',
        isArchived: false,
        autoArchiveExcluded: true,
      };
      finalMorningCash = [newRecord, ...finalMorningCash];
    }
  }

  return {
    state: {
      ...state,
      morningCash: finalMorningCash,
      expenses: nextExpenses,
      visits: nextVisits,
    },
    archivedCount,
    rolledOverProfitJod,
  };
}

/**
 * Transfers daily financial transactions (Morning Cash, Expenses, and Paid Maintenance Visits)
 * to the "المالية المتقدمة" (Advanced Finance) page without losing any data.
 */
export function transferDailyFinanceToAdvanced(
  state: AppState,
  options?: {
    targetDate?: string;
    recordType?: 'morning_cash' | 'expense' | 'visit_revenue';
    id?: string;
    ids?: string[];
  },
  todayStr: string = getTodayStr()
): { state: AppState; transferredCount: number } {
  let transferredCount = 0;
  const targetDate = options?.targetDate;
  const recordType = options?.recordType;
  const targetId = options?.id;
  const idSet =
    options?.ids && options.ids.length > 0 ? new Set(options.ids) : null;

  const nextMorningCash = state.morningCash.map((m) => {
    if (m.isArchived) return m;
    const matchBySet = idSet ? idSet.has(m.id) : false;
    const matchSingle =
      !idSet && recordType === 'morning_cash' && targetId
        ? m.id === targetId
        : false;
    const matchBulk =
      !idSet && !recordType && (!targetDate || m.date === targetDate);

    if (matchBySet || matchSingle || matchBulk) {
      transferredCount += 1;
      return {
        ...m,
        isArchived: true,
        archivedAt: todayStr,
        autoArchiveExcluded: false,
      };
    }
    return m;
  });

  const nextExpenses = state.expenses.map((e) => {
    if (e.isArchived) return e;
    const matchBySet = idSet ? idSet.has(e.id) : false;
    const matchSingle =
      !idSet && recordType === 'expense' && targetId
        ? e.id === targetId
        : false;
    const matchBulk =
      !idSet && !recordType && (!targetDate || e.date === targetDate);

    if (matchBySet || matchSingle || matchBulk) {
      transferredCount += 1;
      return {
        ...e,
        isArchived: true,
        archivedAt: todayStr,
        autoArchiveExcluded: false,
      };
    }
    return e;
  });

  const nextVisits = state.visits.map((v) => {
    if (!v.isPaid || v.visitType === 'contract' || v.isFinanceArchived) return v;
    const matchBySet = idSet ? idSet.has(v.id) : false;
    const matchSingle =
      !idSet && recordType === 'visit_revenue' && targetId
        ? v.id === targetId
        : false;
    const matchBulk =
      !idSet && !recordType && (!targetDate || v.visitDate === targetDate);

    if (matchBySet || matchSingle || matchBulk) {
      transferredCount += 1;
      return {
        ...v,
        isFinanceArchived: true,
        financeArchivedAt: todayStr,
        financeAutoArchiveExcluded: false,
      };
    }
    return v;
  });

  if (transferredCount === 0) {
    return { state, transferredCount: 0 };
  }

  return {
    state: {
      ...state,
      morningCash: nextMorningCash,
      expenses: nextExpenses,
      visits: nextVisits,
    },
    transferredCount,
  };
}

export interface ProfitRolloverResult {
  state: AppState;
  transferredCount: number;
  revenueJod: number;
  expensesJod: number;
  netProfitJod: number;
  previousMorningCashJod: number;
  newMorningCashJod: number;
  morningCashRecord?: MorningCashRecord;
}

/**
 * Transfers financial accounts (Paid Maintenance Visits & Expenses) and their Net Profit
 * directly into the active Morning Cash (الكاش الصباحي), while archiving the settled
 * revenue and expense records into Advanced Finance so nothing is lost or double-counted.
 */
export function transferProfitsToMorningCash(
  state: AppState,
  options?: {
    targetDate?: string;
    recordType?: 'morning_cash' | 'expense' | 'visit_revenue';
    id?: string;
    ids?: string[];
    source?: 'active' | 'archived';
    recordedBy?: string;
  },
  todayStr: string = getTodayStr()
): ProfitRolloverResult {
  const targetDate = options?.targetDate;
  const recordType = options?.recordType;
  const targetId = options?.id;
  const idSet =
    options?.ids && options.ids.length > 0 ? new Set(options.ids) : null;
  const source = options?.source || 'active';
  const recordedBy = options?.recordedBy || 'مدير النظام';

  const activeMorningCash = state.morningCash.filter((m) => !m.isArchived);
  const previousMorningCashJod = Number(
    activeMorningCash
      .reduce((sum, m) => sum + (Number(m.amountJod) || 0), 0)
      .toFixed(2)
  );

  if (source === 'archived') {
    const matchedVisits = state.visits.filter(
      (v) =>
        v.isPaid &&
        v.visitType !== 'contract' &&
        Boolean(v.isFinanceArchived) &&
        !v.profitTransferredToMorningCash &&
        (!targetDate || v.visitDate === targetDate) &&
        (!idSet || idSet.has(v.id))
    );
    const matchedExpenses = state.expenses.filter(
      (e) =>
        Boolean(e.isArchived) &&
        !e.profitTransferredToMorningCash &&
        (!targetDate || e.date === targetDate) &&
        (!idSet || idSet.has(e.id))
    );

    const matchedVisitIds = new Set(matchedVisits.map((v) => v.id));
    const matchedExpenseIds = new Set(matchedExpenses.map((e) => e.id));

    const revenueJod = Number(
      matchedVisits
        .filter((v) => v.paymentMethod === 'cash')
        .reduce((sum, v) => sum + (Number(v.amountJod) || 0), 0)
        .toFixed(2)
    );
    const expensesJod = Number(
      matchedExpenses
        .filter((e) => e.paymentMethod === 'cash')
        .reduce((sum, e) => sum + (Number(e.amountJod) || 0), 0)
        .toFixed(2)
    );
    const netProfitJod = Number((revenueJod - expensesJod).toFixed(2));
    const transferredCount = matchedVisits.length + matchedExpenses.length;

    if (transferredCount === 0) {
      return {
        state,
        transferredCount: 0,
        revenueJod: 0,
        expensesJod: 0,
        netProfitJod: 0,
        previousMorningCashJod,
        newMorningCashJod: previousMorningCashJod,
      };
    }

    const newMorningCashJod = Number(
      (previousMorningCashJod + netProfitJod).toFixed(2)
    );
    const noteSummary = `ترحيل أرباح الكاش${
      targetDate ? ` (${targetDate})` : ''
    } إلى الكاش الصباحي — صافي الكاش المرحّل: ${
      netProfitJod >= 0 ? '+' : ''
    }${netProfitJod.toFixed(2)} د.أ (مقبوضات كاش: ${revenueJod.toFixed(
      2
    )} - مصاريف كاش: ${expensesJod.toFixed(2)})`;

    const existingTodayMc = activeMorningCash.find((m) => m.date === todayStr);
    const updatedRecord: MorningCashRecord = existingTodayMc
      ? {
          ...existingTodayMc,
          amountJod: newMorningCashJod,
          note: noteSummary,
          recordedBy,
          isArchived: false,
          autoArchiveExcluded: true,
        }
      : {
          id: `mc-profit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: todayStr,
          amountJod: newMorningCashJod,
          note: noteSummary,
          recordedBy,
          isArchived: false,
          autoArchiveExcluded: true,
        };

    const nextMorningCash = existingTodayMc
      ? state.morningCash.map((m) => {
          if (m.id === existingTodayMc.id) return updatedRecord;
          if (!m.isArchived) {
            return { ...m, isArchived: true, archivedAt: todayStr };
          }
          return m;
        })
      : [
          updatedRecord,
          ...state.morningCash.map((m) =>
            !m.isArchived ? { ...m, isArchived: true, archivedAt: todayStr } : m
          ),
        ];

    const nextVisits = state.visits.map((v) =>
      matchedVisitIds.has(v.id)
        ? { ...v, profitTransferredToMorningCash: true }
        : v
    );
    const nextExpenses = state.expenses.map((e) =>
      matchedExpenseIds.has(e.id)
        ? { ...e, profitTransferredToMorningCash: true }
        : e
    );

    return {
      state: {
        ...state,
        morningCash: nextMorningCash,
        visits: nextVisits,
        expenses: nextExpenses,
      },
      transferredCount,
      revenueJod,
      expensesJod,
      netProfitJod,
      previousMorningCashJod,
      newMorningCashJod,
      morningCashRecord: updatedRecord,
    };
  }

  // Active source: match active unarchived expenses and paid visits
  let transferredCount = 0;
  let revenueJod = 0;
  let expensesJod = 0;

  const nextExpenses = state.expenses.map((e) => {
    if (e.isArchived || e.profitTransferredToMorningCash) return e;
    const matchBySet = idSet ? idSet.has(e.id) : false;
    const matchSingle =
      !idSet && recordType === 'expense' && targetId
        ? e.id === targetId
        : false;
    const matchBulk =
      !idSet && !recordType && (!targetDate || e.date === targetDate);

    if (matchBySet || matchSingle || matchBulk) {
      transferredCount += 1;
      if (e.paymentMethod === 'cash') {
        expensesJod += Number(e.amountJod) || 0;
      }
      return {
        ...e,
        isArchived: true,
        archivedAt: todayStr,
        autoArchiveExcluded: false,
        profitTransferredToMorningCash: true,
      };
    }
    return e;
  });

  const nextVisits = state.visits.map((v) => {
    if (
      !v.isPaid ||
      v.visitType === 'contract' ||
      v.isFinanceArchived ||
      v.profitTransferredToMorningCash
    ) {
      return v;
    }
    const matchBySet = idSet ? idSet.has(v.id) : false;
    const matchSingle =
      !idSet && recordType === 'visit_revenue' && targetId
        ? v.id === targetId
        : false;
    const matchBulk =
      !idSet && !recordType && (!targetDate || v.visitDate === targetDate);

    if (matchBySet || matchSingle || matchBulk) {
      transferredCount += 1;
      // CliQ and Check payments are never added to Cash (الكاش)
      if (v.paymentMethod === 'cash') {
        revenueJod += Number(v.amountJod) || 0;
      }
      return {
        ...v,
        isFinanceArchived: true,
        financeArchivedAt: todayStr,
        financeAutoArchiveExcluded: false,
        profitTransferredToMorningCash: true,
      };
    }
    return v;
  });

  revenueJod = Number(revenueJod.toFixed(2));
  expensesJod = Number(expensesJod.toFixed(2));
  const netProfitJod = Number((revenueJod - expensesJod).toFixed(2));
  const newMorningCashJod = Number(
    (previousMorningCashJod + netProfitJod).toFixed(2)
  );

  if (transferredCount === 0) {
    return {
      state,
      transferredCount: 0,
      revenueJod: 0,
      expensesJod: 0,
      netProfitJod: 0,
      previousMorningCashJod,
      newMorningCashJod: previousMorningCashJod,
    };
  }

  const noteSummary = `رصيد الكاش الصباحي شامل الأرباح المرحّلة (الأرباح: ${
    netProfitJod >= 0 ? '+' : ''
  }${netProfitJod.toFixed(2)} د.أ | مقبوضات: ${revenueJod.toFixed(
    2
  )} - مصاريف: ${expensesJod.toFixed(2)})`;

  const existingTodayMc = activeMorningCash.find((m) => m.date === todayStr);
  const updatedRecord: MorningCashRecord = existingTodayMc
    ? {
        ...existingTodayMc,
        amountJod: newMorningCashJod,
        note: noteSummary,
        recordedBy,
        isArchived: false,
        autoArchiveExcluded: true,
      }
    : {
        id: `mc-profit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        date: todayStr,
        amountJod: newMorningCashJod,
        note: noteSummary,
        recordedBy,
        isArchived: false,
        autoArchiveExcluded: true,
      };

  const nextMorningCash = existingTodayMc
    ? state.morningCash.map((m) => {
        if (m.id === existingTodayMc.id) return updatedRecord;
        if (!m.isArchived) {
          return {
            ...m,
            isArchived: true,
            archivedAt: todayStr,
            autoArchiveExcluded: false,
          };
        }
        return m;
      })
    : [
        updatedRecord,
        ...state.morningCash.map((m) =>
          !m.isArchived
            ? {
                ...m,
                isArchived: true,
                archivedAt: todayStr,
                autoArchiveExcluded: false,
              }
            : m
        ),
      ];

  return {
    state: {
      ...state,
      morningCash: nextMorningCash,
      expenses: nextExpenses,
      visits: nextVisits,
    },
    transferredCount,
    revenueJod,
    expensesJod,
    netProfitJod,
    previousMorningCashJod,
    newMorningCashJod,
    morningCashRecord: updatedRecord,
  };
}

/**
 * Restores a single financial transaction from "المالية المتقدمة" back to active daily Finance.
 */
export function restoreFinanceRecordToActive(
  state: AppState,
  recordType: 'morning_cash' | 'expense' | 'visit_revenue',
  id: string,
  todayStr: string = getTodayStr()
): AppState {
  if (recordType === 'morning_cash') {
    return {
      ...state,
      morningCash: state.morningCash.map((m) =>
        m.id === id
          ? {
              ...m,
              isArchived: false,
              archivedAt: undefined,
              autoArchiveExcluded: true,
              autoArchiveExcludedDate: todayStr,
            }
          : m
      ),
    };
  }
  if (recordType === 'expense') {
    return {
      ...state,
      expenses: state.expenses.map((e) =>
        e.id === id
          ? {
              ...e,
              isArchived: false,
              archivedAt: undefined,
              autoArchiveExcluded: true,
              autoArchiveExcludedDate: todayStr,
            }
          : e
      ),
    };
  }
  return {
    ...state,
    visits: state.visits.map((v) =>
      v.id === id
        ? {
            ...v,
            isFinanceArchived: false,
            financeArchivedAt: undefined,
            financeAutoArchiveExcluded: true,
            financeAutoArchiveExcludedDate: todayStr,
          }
        : v
    ),
  };
}

/**
 * Restores all financial transactions for a specific day from "المالية المتقدمة" back to active daily Finance.
 */
export function restoreDayFinanceToActive(
  state: AppState,
  dateStr: string,
  todayStr: string = getTodayStr()
): AppState {
  return {
    ...state,
    morningCash: state.morningCash.map((m) =>
      m.date === dateStr
        ? {
            ...m,
            isArchived: false,
            archivedAt: undefined,
            autoArchiveExcluded: true,
            autoArchiveExcludedDate: todayStr,
          }
        : m
    ),
    expenses: state.expenses.map((e) =>
      e.date === dateStr
        ? {
            ...e,
            isArchived: false,
            archivedAt: undefined,
            autoArchiveExcluded: true,
            autoArchiveExcludedDate: todayStr,
          }
        : e
    ),
    visits: state.visits.map((v) =>
      v.visitDate === dateStr && v.isPaid
        ? {
            ...v,
            isFinanceArchived: false,
            financeArchivedAt: undefined,
            financeAutoArchiveExcluded: true,
            financeAutoArchiveExcludedDate: todayStr,
          }
        : v
    ),
  };
}

/**
 * Checks scheduled calendar appointments and identifies any appointment occurring within
 * the next 30 minutes (or up to 5 minutes past start if just opened) that hasn't sent its
 * 30-minute reminder notification yet.
 */
export function checkUpcomingAppointmentReminders(
  state: AppState,
  now: Date = new Date()
): {
  state: AppState;
  dueAppointments: ScheduleAppointment[];
  newNotifications: AppNotification[];
} {
  const nowMs = now.getTime();
  const dueAppointments: ScheduleAppointment[] = [];
  const newNotifications: AppNotification[] = [];

  const nextAppointments = state.appointments.map((apt) => {
    if (apt.status !== 'scheduled' || apt.reminderSent30Min) {
      return apt;
    }
    const [y, m, d] = (apt.date || '').split('-').map(Number);
    if (!y || !m || !d) return apt;
    const [hh, mm] = (apt.time || '10:00').split(':').map(Number);
    const aptTimeMs = new Date(
      y,
      m - 1,
      d,
      Number.isFinite(hh) ? hh : 10,
      Number.isFinite(mm) ? mm : 0,
      0
    ).getTime();

    const diffMinutes = (aptTimeMs - nowMs) / (1000 * 60);
    // Trigger reminder when appointment is between 30 minutes away and 5 minutes after start
    if (diffMinutes <= 30 && diffMinutes >= -5) {
      const updatedApt: ScheduleAppointment = {
        ...apt,
        reminderSent30Min: true,
      };
      dueAppointments.push(updatedApt);

      const notif: AppNotification = {
        id: `notif-rem30-${apt.id}-${Date.now()}`,
        title: `تنبيه موعد صيانة (بعد أقل من 30 دقيقة): ${apt.customerName}`,
        message: `${apt.title} — اليوم ${apt.date} الساعة ${apt.time}${
          apt.phone ? ` · هاتف: ${apt.phone}` : ''
        }`,
        customerName: apt.customerName,
        phone: apt.phone || '',
        visitDate: apt.date,
        visitTime: apt.time || '10:00',
        linkedVisitId: apt.linkedVisitId || apt.id,
        source: 'calendar_reminder',
        isRead: false,
        createdAt: now.toISOString(),
      };
      newNotifications.push(notif);
      return updatedApt;
    }
    return apt;
  });

  if (dueAppointments.length === 0) {
    return { state, dueAppointments: [], newNotifications: [] };
  }

  return {
    state: {
      ...state,
      appointments: nextAppointments,
      notifications: [...newNotifications, ...(state.notifications || [])],
    },
    dueAppointments,
    newNotifications,
  };
}

/**
 * Saves an ExpenseRecord and automatically registers any new purchased part
 * (`partType` when `category === 'parts_purchase'`) into `state.parts`.
 */
export function syncExpenseIntoState(
  state: AppState,
  record: ExpenseRecord
): AppState {
  const idx = state.expenses.findIndex((e) => e.id === record.id);
  const mergedRecord: ExpenseRecord =
    idx >= 0 ? { ...state.expenses[idx], ...record } : record;
  const nextExpenses =
    idx >= 0
      ? state.expenses.map((e, i) => (i === idx ? mergedRecord : e))
      : [mergedRecord, ...state.expenses];

  let nextParts = [...state.parts];
  if (
    record.category === 'parts_purchase' &&
    record.partType &&
    record.partType.trim() !== ''
  ) {
    const cleanPart = record.partType.trim();
    const existingIdx = nextParts.findIndex(
      (p) => p.name.trim().toLowerCase() === cleanPart.toLowerCase()
    );
    if (existingIdx === -1) {
      nextParts = [
        {
          id: `part-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: cleanPart,
          category: 'مشتريات قطع',
          defaultCostJod: record.amountJod || 0,
          defaultPriceJod: record.amountJod || 0,
          stockQty: 1,
          notes: 'تمت الإضافة تلقائياً من المالية (شراء قطع)',
        },
        ...nextParts,
      ];
    }
  }

  let nextCashAdvances = state.cashAdvances ? [...state.cashAdvances] : [];
  if (mergedRecord.linkedCashAdvanceId) {
    nextCashAdvances = nextCashAdvances.map((adv) =>
      adv.id === mergedRecord.linkedCashAdvanceId
        ? {
            ...adv,
            amountJod: Number(mergedRecord.amountJod) || 0,
            date: mergedRecord.date,
            time: mergedRecord.time,
            note: mergedRecord.note,
            updatedAt: Date.now(),
          }
        : adv
    );
  }

  return {
    ...state,
    expenses: nextExpenses,
    parts: nextParts,
    cashAdvances: nextCashAdvances,
  };
}

/**
 * Saves or updates a CashAdvanceRecord and automatically syncs a linked cash ExpenseRecord
 * so the advance is immediately deducted from the Cash Drawer.
 */
export function syncCashAdvanceIntoState(
  state: AppState,
  advance: CashAdvanceRecord
): AppState {
  const expId = advance.linkedExpenseId || `exp-adv-${advance.id}`;
  const cleanAmount = Number((Number(advance.amountJod) || 0).toFixed(2));
  const stampedAdvance: CashAdvanceRecord = {
    ...advance,
    amountJod: cleanAmount,
    linkedExpenseId: expId,
    updatedAt: Date.now(),
  };

  const currentAdvances = state.cashAdvances || [];
  const advIdx = currentAdvances.findIndex((a) => a.id === stampedAdvance.id);
  const nextCashAdvances =
    advIdx >= 0
      ? currentAdvances.map((a, i) => (i === advIdx ? stampedAdvance : a))
      : [stampedAdvance, ...currentAdvances];

  const existingExpIdx = state.expenses.findIndex(
    (e) => e.id === expId || e.linkedCashAdvanceId === stampedAdvance.id
  );
  const existingExp = existingExpIdx >= 0 ? state.expenses[existingExpIdx] : undefined;

  const linkedExpense: ExpenseRecord = {
    ...(existingExp || {}),
    id: existingExp?.id || expId,
    date: stampedAdvance.date,
    time: stampedAdvance.time || '10:00',
    category: 'other',
    title: `سلفة من الكاش — ${stampedAdvance.userFullName}`,
    amountJod: cleanAmount,
    paymentMethod: 'cash',
    note: stampedAdvance.note?.trim()
      ? `${stampedAdvance.note.trim()} (خصم سلفة من الكاش للمستخدم: ${stampedAdvance.userFullName})`
      : `خصم سلفة نقدية من الكاش للمستخدم: ${stampedAdvance.userFullName} (@${stampedAdvance.username})`,
    recordedBy: stampedAdvance.recordedBy,
    linkedCashAdvanceId: stampedAdvance.id,
  };

  const nextExpenses =
    existingExpIdx >= 0
      ? state.expenses.map((e, i) => (i === existingExpIdx ? linkedExpense : e))
      : [linkedExpense, ...state.expenses];

  return {
    ...state,
    cashAdvances: nextCashAdvances,
    expenses: nextExpenses,
  };
}

/**
 * Deletes a CashAdvanceRecord and removes its linked cash ExpenseRecord,
 * immediately restoring the deducted amount to the Cash Drawer.
 */
export function deleteCashAdvanceFromState(
  state: AppState,
  advanceId: string
): { nextState: AppState; deletedIds: string[] } {
  const currentAdvances = state.cashAdvances || [];
  const target = currentAdvances.find((a) => a.id === advanceId);
  const deletedIds: string[] = [advanceId];

  const linkedExpenses = state.expenses.filter(
    (e) =>
      e.linkedCashAdvanceId === advanceId ||
      (target?.linkedExpenseId && e.id === target.linkedExpenseId)
  );
  for (const le of linkedExpenses) {
    deletedIds.push(le.id);
  }

  const nextCashAdvances = currentAdvances.filter((a) => a.id !== advanceId);
  const nextExpenses = state.expenses.filter(
    (e) =>
      e.linkedCashAdvanceId !== advanceId &&
      (!target?.linkedExpenseId || e.id !== target.linkedExpenseId)
  );

  return {
    nextState: {
      ...state,
      cashAdvances: nextCashAdvances,
      expenses: nextExpenses,
    },
    deletedIds,
  };
}

/**
 * Saves a ScheduleAppointment and automatically registers the customer in `state.customers`
 * if not already present.
 */
export function syncAppointmentIntoState(
  state: AppState,
  apt: ScheduleAppointment
): AppState {
  const idx = state.appointments.findIndex((a) => a.id === apt.id);
  const nextAppointments =
    idx >= 0
      ? state.appointments.map((a, i) => (i === idx ? apt : a))
      : [apt, ...state.appointments];

  let nextCustomers = [...state.customers];
  const cleanName = apt.customerName.trim();
  if (cleanName) {
    const existingIdx = nextCustomers.findIndex(
      (c) => c.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existingIdx === -1) {
      nextCustomers = [
        {
          id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: cleanName,
          phone: apt.phone?.trim() || '',
          contractType: 'on_demand',
          notes: apt.note?.trim() || '',
          createdAt: apt.date || getTodayStr(),
        },
        ...nextCustomers,
      ];
    } else if (apt.phone && !nextCustomers[existingIdx].phone) {
      nextCustomers[existingIdx] = {
        ...nextCustomers[existingIdx],
        phone: apt.phone.trim(),
      };
    }
  }

  return {
    ...state,
    appointments: nextAppointments,
    customers: nextCustomers,
  };
}

export interface CustomerBookingInput {
  customerName: string;
  date: string;
  phone?: string;
  problemType: string;
  time?: string;
  note?: string;
}

/**
 * Handles customer self-service booking and automatically routes it to:
 * - Maintenance Requests (state.visits with source: 'customer_portal')
 * - Customers Catalog (state.customers)
 * - Weekly Schedule Calendar (state.appointments)
 * - Notifications Center (state.notifications)
 */
export function createCustomerBookingIntoState(
  state: AppState,
  input: CustomerBookingInput
): {
  nextState: AppState;
  createdVisit: MaintenanceVisit;
  createdNotification: AppNotification;
} {
  const cleanName = input.customerName.trim();
  const cleanProblem = input.problemType.trim();
  if (!cleanName || !cleanProblem || !input.date) {
    throw new Error('Name, date, and problem type are required');
  }

  const nowIso = new Date().toISOString();
  const visitTime = input.time?.trim() || '10:00';

  const createdVisit: MaintenanceVisit = {
    id: `visit-portal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    customerName: cleanName,
    phone: input.phone?.trim() || '',
    visitType: 'visit',
    problem: cleanProblem,
    requiredParts: [],
    installedParts: [],
    visitDate: input.date,
    visitTime,
    nextVisitDate: '',
    isPaid: false,
    amountJod: 0,
    paymentMethod: 'cash',
    status: 'pending',
    isResolved: false,
    note: input.note?.trim()
      ? `${input.note.trim()} (طلب إلكتروني من شاشة الزبائن)`
      : 'طلب صيانة مرحّل تلقائياً من شاشة الزبائن',
    source: 'customer_portal',
    technicianName: 'قيد التعيين',
    createdAt: nowIso,
  };

  const createdNotification = createMaintenanceNotification(createdVisit);
  const syncedState = syncMaintenanceVisitIntoState(state, createdVisit);
  const nextState: AppState = {
    ...syncedState,
    notifications: [createdNotification, ...(syncedState.notifications || [])],
  };

  return { nextState, createdVisit, createdNotification };
}

export interface GlobalSearchResultItem {
  id: string;
  category:
    | 'maintenance'
    | 'customer'
    | 'schedule'
    | 'finance'
    | 'part'
    | 'note';
  title: string;
  subtitle: string;
  meta: string;
  targetTab:
    | 'maintenance'
    | 'daily_archive'
    | 'purchases'
    | 'catalogs'
    | 'schedule'
    | 'finance'
    | 'advanced_finance'
    | 'users'
    | 'dashboard';
}

export function searchSystemRecords(
  state: AppState,
  rawQuery: string,
  _lang?: Language
): GlobalSearchResultItem[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  const results: GlobalSearchResultItem[] = [];

  for (const v of state.visits) {
    const hay = `${v.customerName} ${v.problem} ${v.phone || ''} ${v.note || ''} ${v.requiredParts.join(' ')} ${v.installedParts.join(' ')} ${v.visitDate}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: `res-visit-${v.id}`,
        category: 'maintenance',
        title: v.customerName,
        subtitle: v.problem,
        meta: `${v.visitDate} · ${v.amountJod.toFixed(2)} JOD`,
        targetTab: 'maintenance',
      });
    }
  }

  for (const c of state.customers) {
    const hay = `${c.name} ${c.phone || ''} ${c.address || ''} ${c.notes || ''}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: `res-cust-${c.id}`,
        category: 'customer',
        title: c.name,
        subtitle: c.address || c.notes || 'زبون مسجل في الدليل',
        meta: c.phone || '-',
        targetTab: 'catalogs',
      });
    }
  }

  for (const a of state.appointments) {
    const hay = `${a.customerName} ${a.title} ${a.phone || ''} ${a.date} ${a.note || ''}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: `res-apt-${a.id}`,
        category: 'schedule',
        title: a.customerName,
        subtitle: a.title,
        meta: `${a.date} · ${a.time}`,
        targetTab: 'schedule',
      });
    }
  }

  for (const adv of state.cashAdvances || []) {
    const hay = `سلفة ${adv.userFullName} ${adv.username} ${adv.note || ''} ${adv.date}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: `res-adv-${adv.id}`,
        category: 'finance',
        title: `سلفة موظف: ${adv.userFullName}`,
        subtitle: adv.note || `خصم من الكاش (@${adv.username})`,
        meta: `${adv.date} · ${adv.amountJod.toFixed(2)} JOD`,
        targetTab: 'users',
      });
    }
  }

  for (const e of state.expenses) {
    const hay = `${e.title} ${e.partType || ''} ${e.note || ''} ${e.date}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: `res-exp-${e.id}`,
        category: 'finance',
        title: e.title,
        subtitle: e.partType || e.note || 'مصروف مالي',
        meta: `${e.date} · ${e.amountJod.toFixed(2)} JOD`,
        targetTab: e.isArchived ? 'advanced_finance' : 'finance',
      });
    }
  }

  for (const pr of state.purchases || []) {
    const hay = `${pr.partName} ${pr.category} ${pr.supplierName || ''} ${pr.invoiceNumber || ''} ${pr.notes || ''} ${pr.invoiceDate}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: `res-purch-${pr.id}`,
        category: 'part',
        title: pr.partName,
        subtitle: `${pr.supplierName || pr.category} (${pr.paymentMethod === 'credit' ? 'ذمم' : pr.paymentMethod === 'cliq' ? 'كلك' : 'كاش'})`,
        meta: `${pr.invoiceDate} · ${pr.totalCostJod.toFixed(2)} JOD`,
        targetTab: 'purchases',
      });
    }
  }

  for (const p of state.parts) {
    const hay = `${p.name} ${p.category} ${p.notes || ''}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: `res-part-${p.id}`,
        category: 'part',
        title: p.name,
        subtitle: p.category,
        meta: `${p.defaultPriceJod.toFixed(2)} JOD`,
        targetTab: 'purchases',
      });
    }
  }

  for (const n of state.dailyNotes) {
    const hay = `${n.title} ${n.content}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: `res-note-${n.id}`,
        category: 'note',
        title: n.title,
        subtitle: n.content,
        meta: n.date,
        targetTab: 'dashboard',
      });
    }
  }

  return results.slice(0, 25);
}

export interface BackupPayload {
  app: 'AL-MADAR-IT-SYSTEM';
  version: '1.0';
  exportedAt: string;
  data: AppState;
}

export function exportBackupJson(state: AppState): string {
  const payload: BackupPayload = {
    app: 'AL-MADAR-IT-SYSTEM',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    data: {
      ...state,
      notifications: state.notifications || [],
    },
  };
  return JSON.stringify(payload, null, 2);
}

export function validateAndParseBackupJson(rawJson: string): AppState {
  if (!rawJson || !rawJson.trim()) {
    throw new Error('ملف النسخة الاحتياطية فارغ / Backup JSON is empty');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('صيغة ملف JSON غير صالحة / Invalid JSON format');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('بنية النسخة الاحتياطية غير صالحة / Invalid backup structure');
  }

  const candidate =
    'data' in parsed &&
    parsed.data &&
    typeof parsed.data === 'object'
      ? (parsed.data as Record<string, unknown>)
      : (parsed as Record<string, unknown>);

  if (
    !Array.isArray(candidate.users) ||
    !Array.isArray(candidate.customers) ||
    !Array.isArray(candidate.visits) ||
    !Array.isArray(candidate.expenses) ||
    !Array.isArray(candidate.morningCash)
  ) {
    throw new Error(
      'ملف النسخة الاحتياطية لا يحتوي على الجداول الأساسية المطلوبة (الزبائن، الصيانة، المالية، المستخدمين).'
    );
  }

  if (candidate.users.length === 0) {
    throw new Error('يجب أن تحتوي النسخة الاحتياطية على مستخدم واحد على الأقل.');
  }

  return {
    users: candidate.users as User[],
    customers: candidate.customers as Customer[],
    parts: Array.isArray(candidate.parts) ? (candidate.parts as AppState['parts']) : [],
    purchases: Array.isArray(candidate.purchases)
      ? (candidate.purchases as AppState['purchases'])
      : [],
    cashAdvances: Array.isArray(candidate.cashAdvances)
      ? (candidate.cashAdvances as AppState['cashAdvances'])
      : [],
    expenseTemplates: Array.isArray(candidate.expenseTemplates)
      ? (candidate.expenseTemplates as AppState['expenseTemplates'])
      : [],
    visits: candidate.visits as MaintenanceVisit[],
    morningCash: candidate.morningCash as MorningCashRecord[],
    expenses: candidate.expenses as ExpenseRecord[],
    appointments: Array.isArray(candidate.appointments)
      ? (candidate.appointments as ScheduleAppointment[])
      : [],
    dailyNotes: Array.isArray(candidate.dailyNotes)
      ? (candidate.dailyNotes as AppState['dailyNotes'])
      : [],
    notifications: Array.isArray(candidate.notifications)
      ? (candidate.notifications as AppNotification[])
      : [],
  };
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of existing) {
    map.set(item.id, item);
  }
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

export function mergeBackupState(
  currentState: AppState,
  importedState: AppState
): AppState {
  return {
    users: mergeById(currentState.users, importedState.users),
    customers: mergeById(currentState.customers, importedState.customers),
    parts: mergeById(currentState.parts, importedState.parts),
    purchases: mergeById(
      currentState.purchases || [],
      importedState.purchases || []
    ),
    cashAdvances: mergeById(
      currentState.cashAdvances || [],
      importedState.cashAdvances || []
    ),
    expenseTemplates: mergeById(
      currentState.expenseTemplates,
      importedState.expenseTemplates
    ),
    visits: mergeById(currentState.visits, importedState.visits),
    morningCash: mergeById(currentState.morningCash, importedState.morningCash),
    expenses: mergeById(currentState.expenses, importedState.expenses),
    appointments: mergeById(currentState.appointments, importedState.appointments),
    dailyNotes: mergeById(currentState.dailyNotes, importedState.dailyNotes),
    notifications: mergeById(
      currentState.notifications || [],
      importedState.notifications || []
    ),
  };
}

export function calculateFinancialSummary(
  state: AppState,
  period: ReportPeriod,
  referenceDateStr: string
): FinancialSummary {
  const { startDate, endDate } = getPeriodRange(period, referenceDateStr);

  const periodMorningCash = state.morningCash.filter((m) =>
    isDateInRange(m.date, startDate, endDate)
  );
  const periodVisits = state.visits.filter((v) =>
    isDateInRange(v.visitDate, startDate, endDate)
  );
  const periodExpenses = state.expenses.filter((e) =>
    isDateInRange(e.date, startDate, endDate)
  );

  const morningCashJod = periodMorningCash.reduce(
    (sum, item) => sum + (Number(item.amountJod) || 0),
    0
  );

  const revenueByMethod = {
    cash: 0,
    check: 0,
    cliq: 0,
  };

  let totalRevenueJod = 0;
  let resolvedVisitsCount = 0;
  let pendingVisitsCount = 0;
  let paidVisitsCount = 0;
  let unpaidVisitsCount = 0;
  let unpaidTotalJod = 0;
  let portalRequestsCount = 0;

  for (const v of periodVisits) {
    const amt = Number(v.amountJod) || 0;
    if (v.isResolved || v.status === 'resolved') {
      resolvedVisitsCount++;
    } else {
      pendingVisitsCount++;
    }
    if (v.source === 'customer_portal') {
      portalRequestsCount++;
    }
    if (v.isPaid) {
      paidVisitsCount++;
      totalRevenueJod += amt;
      revenueByMethod[v.paymentMethod] =
        (revenueByMethod[v.paymentMethod] || 0) + amt;
    } else if (!v.noPayment && v.visitType !== 'contract') {
      unpaidVisitsCount++;
      unpaidTotalJod += amt;
    }
  }

  const expensesByCategory = {
    fuel: 0,
    car_repair: 0,
    parts_purchase: 0,
    other: 0,
  };

  let totalExpensesJod = 0;
  let cashExpensesJod = 0;

  for (const e of periodExpenses) {
    const amt = Number(e.amountJod) || 0;
    totalExpensesJod += amt;
    expensesByCategory[e.category] =
      (expensesByCategory[e.category] || 0) + amt;
    if (e.paymentMethod === 'cash') {
      cashExpensesJod += amt;
    }
  }

  const netCashDrawerJod =
    morningCashJod + revenueByMethod.cash - cashExpensesJod;
  // Net overall profit is total revenue - total expenses
  const netProfitJod = totalRevenueJod - totalExpensesJod;
  // Net cash profit (physical cash drawer profits only, CliQ is separate)
  const netCashProfitJod = revenueByMethod.cash - cashExpensesJod;
  // Cash drawer total balance: morning cash + cash revenue - cash expenses (CliQ is NEVER added to Cash)
  const totalBalanceWithMorningJod =
    morningCashJod + revenueByMethod.cash - cashExpensesJod;

  return {
    period,
    startDate,
    endDate,
    morningCashJod: Number(morningCashJod.toFixed(2)),
    totalRevenueJod: Number(totalRevenueJod.toFixed(2)),
    revenueByMethod: {
      cash: Number(revenueByMethod.cash.toFixed(2)),
      check: Number(revenueByMethod.check.toFixed(2)),
      cliq: Number(revenueByMethod.cliq.toFixed(2)),
    },
    totalExpensesJod: Number(totalExpensesJod.toFixed(2)),
    expensesByCategory: {
      fuel: Number(expensesByCategory.fuel.toFixed(2)),
      car_repair: Number(expensesByCategory.car_repair.toFixed(2)),
      parts_purchase: Number(expensesByCategory.parts_purchase.toFixed(2)),
      other: Number(expensesByCategory.other.toFixed(2)),
    },
    cashExpensesJod: Number(cashExpensesJod.toFixed(2)),
    netCashDrawerJod: Number(netCashDrawerJod.toFixed(2)),
    netProfitJod: Number(netProfitJod.toFixed(2)),
    totalBalanceWithMorningJod: Number(totalBalanceWithMorningJod.toFixed(2)),
    visitsCount: periodVisits.length,
    resolvedVisitsCount,
    pendingVisitsCount,
    paidVisitsCount,
    unpaidVisitsCount,
    unpaidTotalJod: Number(unpaidTotalJod.toFixed(2)),
    portalRequestsCount,
  };
}

export interface CliqCustomerSummary {
  totalCliqJod: number;
  totalCliqCount: number;
  todayCliqJod: number;
  todayCliqCount: number;
  allCliqVisits: MaintenanceVisit[];
}

/**
 * Calculates customer payments made via CliQ (كلك).
 * CliQ amounts are kept in a separate digital account and NEVER added into the physical cash drawer.
 */
export function calculateCliqCustomerSummary(
  visits: MaintenanceVisit[],
  referenceDateStr?: string
): CliqCustomerSummary {
  const refDate = referenceDateStr || getTodayStr();
  const cliqVisits = (visits || []).filter(
    (v) =>
      v.isPaid &&
      v.paymentMethod === 'cliq' &&
      v.visitType !== 'contract' &&
      (Number(v.amountJod) || 0) > 0
  );

  let totalCliqJod = 0;
  let todayCliqJod = 0;
  let todayCliqCount = 0;

  for (const v of cliqVisits) {
    const amt = Number(v.amountJod) || 0;
    totalCliqJod += amt;
    const vDate = v.visitDate || (v.createdAt ? v.createdAt.slice(0, 10) : '');
    if (vDate === refDate) {
      todayCliqJod += amt;
      todayCliqCount += 1;
    }
  }

  // Sort descending by date, then id
  const sorted = [...cliqVisits].sort((a, b) => {
    const dateComp = (b.visitDate || '').localeCompare(a.visitDate || '');
    if (dateComp !== 0) return dateComp;
    const timeComp = (b.visitTime || '').localeCompare(a.visitTime || '');
    if (timeComp !== 0) return timeComp;
    return b.id.localeCompare(a.id);
  });

  return {
    totalCliqJod: Number(totalCliqJod.toFixed(2)),
    totalCliqCount: cliqVisits.length,
    todayCliqJod: Number(todayCliqJod.toFixed(2)),
    todayCliqCount,
    allCliqVisits: sorted,
  };
}

export function generateCsvContent(
  visitsOrState: MaintenanceVisit[] | AppState,
  expensesOrSummary: ExpenseRecord[] | FinancialSummary,
  morningCashOrLang?: MorningCashRecord[] | Language,
  summaryArg?: FinancialSummary,
  langArg: Language = 'ar'
): string {
  let visits: MaintenanceVisit[];
  let expenses: ExpenseRecord[];
  let morningCash: MorningCashRecord[];
  let summary: FinancialSummary;
  let lang: Language = 'ar';

  if (Array.isArray(visitsOrState)) {
    visits = visitsOrState;
    expenses = (expensesOrSummary as ExpenseRecord[]) || [];
    morningCash = (morningCashOrLang as MorningCashRecord[]) || [];
    summary = summaryArg!;
    lang = langArg || 'ar';
  } else {
    visits = visitsOrState.visits;
    expenses = visitsOrState.expenses;
    morningCash = visitsOrState.morningCash;
    summary = expensesOrSummary as FinancialSummary;
    lang = (morningCashOrLang as Language) || 'ar';
  }

  const escapeCsv = (val: string | number | undefined) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };

  const lines: string[] = [];
  if (lang === 'ar') {
    lines.push(
      [
        escapeCsv('شركة المدار لتجارة تكنولوجيا المعلومات - AL-MADAR IT'),
        escapeCsv(`تقرير الفترة: ${summary.startDate} إلى ${summary.endDate}`),
      ].join(',')
    );
    lines.push('');
    lines.push(escapeCsv('ملخص المؤشرات المالية والعمل (دينار أردني JOD)'));
    lines.push(
      [
        escapeCsv('كاش الصباح (JOD)'),
        escapeCsv('مقبوضات الصيانة المدفوعة (JOD)'),
        escapeCsv('مقبوضات كاش (JOD)'),
        escapeCsv('مقبوضات شيك (JOD)'),
        escapeCsv('مقبوضات كلك CliQ (JOD)'),
        escapeCsv('إجمالي المصاريف (JOD)'),
        escapeCsv('صافي ربح العمليات (JOD)'),
        escapeCsv('صافي الكاش في الصندوق (JOD)'),
      ].join(',')
    );
    lines.push(
      [
        escapeCsv(summary.morningCashJod.toFixed(2)),
        escapeCsv(summary.totalRevenueJod.toFixed(2)),
        escapeCsv(summary.revenueByMethod.cash.toFixed(2)),
        escapeCsv(summary.revenueByMethod.check.toFixed(2)),
        escapeCsv(summary.revenueByMethod.cliq.toFixed(2)),
        escapeCsv(summary.totalExpensesJod.toFixed(2)),
        escapeCsv(summary.netProfitJod.toFixed(2)),
        escapeCsv(summary.netCashDrawerJod.toFixed(2)),
      ].join(',')
    );
    lines.push('');
    lines.push(escapeCsv('سجل طلبات وزيارات الصيانة التفصيلي'));
    lines.push(
      [
        escapeCsv('التاريخ'),
        escapeCsv('الوقت'),
        escapeCsv('اسم الزبون'),
        escapeCsv('رقم الهاتف'),
        escapeCsv('نوع الزيارة'),
        escapeCsv('المشكلة'),
        escapeCsv('القطع اللازمة'),
        escapeCsv('القطع المركبة'),
        escapeCsv('الزيارة القادمة'),
        escapeCsv('حالة المشكلة'),
        escapeCsv('حالة الدفع'),
        escapeCsv('طريقة الدفع'),
        escapeCsv('المبلغ (JOD)'),
        escapeCsv('ملاحظات'),
      ].join(',')
    );
    for (const v of visits) {
      lines.push(
        [
          escapeCsv(v.visitDate),
          escapeCsv(v.visitTime),
          escapeCsv(v.customerName),
          escapeCsv(v.phone || '-'),
          escapeCsv(v.visitType === 'contract' ? 'عقد صيانة' : 'زيارة صيانة'),
          escapeCsv(v.problem),
          escapeCsv(v.requiredParts.join(' + ') || '-'),
          escapeCsv(v.installedParts.join(' + ') || '-'),
          escapeCsv(v.nextVisitDate || '-'),
          escapeCsv(v.isResolved ? 'تم الحل' : 'قيد المتابعة'),
          escapeCsv(v.noPayment ? 'بدون دفع' : v.isPaid ? 'مدفوع' : 'غير مدفوع'),
          escapeCsv(
            v.noPayment
              ? 'بدون دفع'
              : v.paymentMethod === 'cash'
              ? 'كاش'
              : v.paymentMethod === 'check'
              ? 'شيك'
              : 'كلك (CliQ)'
          ),
          escapeCsv(v.amountJod.toFixed(2)),
          escapeCsv(v.note || '-'),
        ].join(',')
      );
    }
    lines.push('');
    lines.push(escapeCsv('سجل المصاريف والكاش الصباحي'));
    lines.push(
      [
        escapeCsv('التاريخ'),
        escapeCsv('البند / التصنيف'),
        escapeCsv('الوصف'),
        escapeCsv('نوع القطع المشتراة'),
        escapeCsv('طريقة الدفع'),
        escapeCsv('المبلغ (JOD)'),
        escapeCsv('ملاحظات'),
      ].join(',')
    );
    for (const m of morningCash) {
      lines.push(
        [
          escapeCsv(m.date),
          escapeCsv('كاش الصباح'),
          escapeCsv('رصيد افتتاحي للصندوق'),
          escapeCsv('-'),
          escapeCsv('كاش'),
          escapeCsv(m.amountJod.toFixed(2)),
          escapeCsv(m.note || '-'),
        ].join(',')
      );
    }
    for (const e of expenses) {
      const catAr =
        e.category === 'fuel'
          ? 'بنزين'
          : e.category === 'car_repair'
          ? 'تصليح سيارة'
          : e.category === 'parts_purchase'
          ? 'شراء قطع'
          : 'مصاريف أخرى';
      lines.push(
        [
          escapeCsv(e.date),
          escapeCsv(catAr),
          escapeCsv(e.title),
          escapeCsv(e.partType || '-'),
          escapeCsv(
            e.paymentMethod === 'cash'
              ? 'كاش'
              : e.paymentMethod === 'check'
              ? 'شيك'
              : 'كلك (CliQ)'
          ),
          escapeCsv(e.amountJod.toFixed(2)),
          escapeCsv(e.note || '-'),
        ].join(',')
      );
    }
  } else {
    lines.push(
      [
        escapeCsv('AL-MADAR FOR INFORMATION TECHNOLOGY TRADING'),
        escapeCsv(`Period: ${summary.startDate} to ${summary.endDate}`),
      ].join(',')
    );
    lines.push('');
    lines.push(
      [
        escapeCsv('Morning Cash (JOD)'),
        escapeCsv('Paid Maintenance Revenue (JOD)'),
        escapeCsv('Cash Revenue (JOD)'),
        escapeCsv('Check Revenue (JOD)'),
        escapeCsv('CliQ Revenue (JOD)'),
        escapeCsv('Total Expenses (JOD)'),
        escapeCsv('Net Operating Profit (JOD)'),
        escapeCsv('Net Cash in Drawer (JOD)'),
      ].join(',')
    );
    lines.push(
      [
        escapeCsv(summary.morningCashJod.toFixed(2)),
        escapeCsv(summary.totalRevenueJod.toFixed(2)),
        escapeCsv(summary.revenueByMethod.cash.toFixed(2)),
        escapeCsv(summary.revenueByMethod.check.toFixed(2)),
        escapeCsv(summary.revenueByMethod.cliq.toFixed(2)),
        escapeCsv(summary.totalExpensesJod.toFixed(2)),
        escapeCsv(summary.netProfitJod.toFixed(2)),
        escapeCsv(summary.netCashDrawerJod.toFixed(2)),
      ].join(',')
    );
    lines.push('');
    lines.push(
      [
        escapeCsv('Date'),
        escapeCsv('Time'),
        escapeCsv('Customer Name'),
        escapeCsv('Phone'),
        escapeCsv('Type'),
        escapeCsv('Problem'),
        escapeCsv('Required Parts'),
        escapeCsv('Installed Parts'),
        escapeCsv('Next Visit'),
        escapeCsv('Resolved'),
        escapeCsv('Paid'),
        escapeCsv('Payment Method'),
        escapeCsv('Amount (JOD)'),
        escapeCsv('Note'),
      ].join(',')
    );
    for (const v of visits) {
      lines.push(
        [
          escapeCsv(v.visitDate),
          escapeCsv(v.visitTime),
          escapeCsv(v.customerName),
          escapeCsv(v.phone || '-'),
          escapeCsv(v.visitType),
          escapeCsv(v.problem),
          escapeCsv(v.requiredParts.join(' + ') || '-'),
          escapeCsv(v.installedParts.join(' + ') || '-'),
          escapeCsv(v.nextVisitDate || '-'),
          escapeCsv(v.isResolved ? 'Resolved' : 'Pending'),
          escapeCsv(v.noPayment ? 'No Payment' : v.isPaid ? 'Paid' : 'Unpaid'),
          escapeCsv(v.noPayment ? 'NO PAYMENT' : v.paymentMethod.toUpperCase()),
          escapeCsv(v.amountJod.toFixed(2)),
          escapeCsv(v.note || '-'),
        ].join(',')
      );
    }
  }

  // Prepend UTF-8 BOM so Microsoft Excel renders Arabic cleanly
  return '\uFEFF' + lines.join('\r\n');
}

export function getInitialState(todayStr: string = getTodayStr()): AppState {
  const users: User[] = [
    {
      id: 'user-admin',
      username: 'admin',
      password: 'admin',
      fullName: 'مدير النظام - شركة المدار',
      role: 'manager',
      phone: '',
      active: true,
      createdAt: todayStr,
    },
  ];

  return {
    users,
    customers: [],
    parts: [],
    purchases: [],
    cashAdvances: [],
    expenseTemplates: [],
    visits: [],
    morningCash: [],
    expenses: [],
    appointments: [],
    dailyNotes: [],
    notifications: [],
  };
}

/**
 * Clears all added records in the system (visits, customers, purchases, parts,
 * expenses, morningCash, appointments, dailyNotes, notifications, expenseTemplates)
 * while preserving user login accounts so the user can start working on the app fresh.
 */
export function resetSystemDataState(
  currentState?: AppState | null,
  todayStr: string = getTodayStr()
): AppState {
  const initial = getInitialState(todayStr);
  const preservedUsers =
    currentState && Array.isArray(currentState.users) && currentState.users.length > 0
      ? deduplicateUsers(currentState.users)
      : initial.users;

  return {
    users: preservedUsers,
    customers: [],
    parts: [],
    purchases: [],
    cashAdvances: [],
    expenseTemplates: [],
    visits: [],
    morningCash: [],
    expenses: [],
    appointments: [],
    dailyNotes: [],
    notifications: [],
  };
}

/**
 * Determines whether a maintenance visit is considered unpaid.
 * Single maintenance visits ('visit') that are not marked as paid are unpaid.
 * Contract visits with a positive amountJod that are not paid are also treated as unpaid.
 */
export function isVisitUnpaid(visit: MaintenanceVisit): boolean {
  if (visit.isPaid || visit.noPayment) return false;
  if (visit.visitType !== 'contract') return true;
  return (Number(visit.amountJod) || 0) > 0;
}

export type PaymentReminderTemplateType = 'polite' | 'detailed' | 'short';
export type PaymentReminderLanguage = 'ar' | 'en' | 'bilingual';

export const CLIQ_PAYMENT_INFO = {
  cliqNumber: '00962777977987',
  recipientName: 'سامر جوينات',
  recipientNameEn: 'Samer Jwainat',
  bankName: 'بنك الاتحاد',
  bankNameEn: 'Bank al Etihad',
} as const;

export interface PaymentReminderInput {
  customerName: string;
  phone?: string;
  unpaidVisits?: MaintenanceVisit[];
  visits?: MaintenanceVisit[];
  templateType?: PaymentReminderTemplateType;
  style?: PaymentReminderTemplateType;
  lang?: PaymentReminderLanguage;
}

export function generatePaymentReminderMessage(input: PaymentReminderInput): string {
  const customerName = input.customerName.trim() || 'العميل الكريم';
  const visits = input.unpaidVisits || input.visits || [];
  const templateType: PaymentReminderTemplateType =
    input.templateType || input.style || 'polite';
  const lang: PaymentReminderLanguage = input.lang || 'ar';

  const totalJod = visits.reduce((sum, v) => sum + (Number(v.amountJod) || 0), 0);
  const formattedTotalAr = `${totalJod.toFixed(2)} د.أ`;
  const formattedTotalEn = `${totalJod.toFixed(2)} JOD`;

  const buildArabicText = (): string => {
    if (templateType === 'short') {
      const problemsSummary =
        visits
          .map((v) => `${v.problem} (${v.visitDate})`)
          .slice(0, 3)
          .join('، ') || 'صيانة فنية';
      return [
        `تحية طيبة من شركة المدار لتجارة تكنولوجيا المعلومات (Al-Madar IT)`,
        `السادة / المحترم: ${customerName}`,
        `يسعدنا تواصلكم الدائم معنا، ونرجو التكرم بتسديد الرصيد المستحق بقيمة (${formattedTotalAr}) عن أعمال الصيانة المنجزة (${visits.length || 1}: ${problemsSummary}).`,
        ``,
        `بيانات التحويل عبر خدمة كلك (CliQ):`,
        `• رقم كلك: ${CLIQ_PAYMENT_INFO.cliqNumber}`,
        `• الاسم: ${CLIQ_PAYMENT_INFO.recipientName}`,
        `• البنك: ${CLIQ_PAYMENT_INFO.bankName}`,
        `شاكرين ومقدرين حسن تعاونكم وثقتكم الغالية بنا.`,
      ].join('\n');
    }

    if (templateType === 'detailed') {
      const detailLines =
        visits.length > 0
          ? visits.map((v, idx) => {
              const amt = (Number(v.amountJod) || 0).toFixed(2);
              const partsStr =
                v.installedParts && v.installedParts.length > 0
                  ? ` | القطع المركبة: ${v.installedParts.join(' + ')}`
                  : '';
              const techStr = v.technicianName ? ` | الفني: ${v.technicianName}` : '';
              return `${idx + 1}. التاريخ: ${v.visitDate} — العمل المنفذ: ${v.problem}${partsStr}${techStr} — المبلغ: ${amt} د.أ (غير مدفوع)`;
            })
          : [`1. زيارة صيانة فنية — المبلغ المستحق: ${formattedTotalAr} (غير مدفوع)`];

      return [
        `شركة المدار لتجارة تكنولوجيا المعلومات`,
        `Al-Madar Information Technology Trading Company`,
        `================================`,
        `بيان وكشف تفصيلي لأعمال وزيارات الصيانة المستحقة`,
        `السادة / المحترم: ${customerName}`,
        input.phone ? `رقم الهاتف: ${input.phone}` : '',
        ``,
        `تحية طيبة وبعد،`,
        `تهديكم شركة المدار لتجارة تكنولوجيا المعلومات أطيب التحيات، ويسرنا أن نرفق لحضرتكم تفاصيل زيارات الصيانة المنجزة والمسجلة في حسابكم:`,
        ``,
        ...detailLines,
        `--------------------------------`,
        `• إجمالي عدد الزيارات غير المسددة: ${visits.length || 1}`,
        `• إجمالي المبلغ المستحق للدفع: ${formattedTotalAr}`,
        `--------------------------------`,
        `للتسهيل عليكم، يمكنكم التكرم بتسديد الرصيد نقداً (كاش) أو عبر خدمة كلك (CliQ) حسب البيانات المعتمدة التالية:`,
        `• رقم كلك (CliQ): ${CLIQ_PAYMENT_INFO.cliqNumber}`,
        `• اسم المستفيد: ${CLIQ_PAYMENT_INFO.recipientName}`,
        `• البنك: ${CLIQ_PAYMENT_INFO.bankName}`,
        ``,
        `في حال تم السداد مؤخراً يرجى التكرم بتجاهل هذه الرسالة. شاكرين ومقدرين لكم كريم تعاونكم وثقتكم الدائمة بنا.`,
      ]
        .filter((line) => line !== undefined)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');
    }

    // Default: 'polite' — رسالة جميلة ومرتبة ولبقة بدون عبارة "نذكركم بلطف"
    const politeLines =
      visits.length > 0
        ? visits.map((v, idx) => {
            const amt = (Number(v.amountJod) || 0).toFixed(2);
            const partsStr =
              v.installedParts && v.installedParts.length > 0
                ? ` (شامل تركيب: ${v.installedParts.join(' + ')})`
                : '';
            return `• (${idx + 1}) بتاريخ [${v.visitDate}]: ${v.problem}${partsStr} — ${amt} د.أ`;
          })
        : [`• زيارة صيانة فنية — ${formattedTotalAr}`];

    return [
      `تحية طيبة وبعد،`,
      `السادة / المحترم: ${customerName}`,
      `تهديكم شركة المدار لتجارة تكنولوجيا المعلومات (Al-Madar IT) أطيب التحيات، ونسعد دائماً بخدمتكم وتلبية احتياجاتكم الفنية.`,
      ``,
      `نود إحاطتكم علماً بتفاصيل أعمال وزيارات الصيانة المنجزة لحضرتكم، والمسجلة كذمم مستحقة للدفع:`,
      ...politeLines,
      ``,
      `• إجمالي المبلغ المستحق للدفع: ${formattedTotalAr}`,
      ``,
      `للتسهيل عليكم، يرجى التكرم بتسديد المبلغ نقداً (كاش) أو عبر خدمة كلك (CliQ) على الحساب المعتمد:`,
      `• رقم كلك (CliQ): ${CLIQ_PAYMENT_INFO.cliqNumber}`,
      `• اسم المستفيد: ${CLIQ_PAYMENT_INFO.recipientName}`,
      `• البنك: ${CLIQ_PAYMENT_INFO.bankName}`,
      ``,
      `شاكرين ومقدرين لكم حسن تعاونكم وثقتكم الغالية بنا، ونتمنى لكم دوام التوفيق والنجاح.`,
    ].join('\n');
  };

  const buildEnglishText = (): string => {
    if (templateType === 'short') {
      const problemsSummary =
        visits
          .map((v) => `${v.problem} (${v.visitDate})`)
          .slice(0, 3)
          .join(', ') || 'IT Maintenance';
      return [
        `Warm Greetings from Al-Madar IT Trading Co.`,
        `Dear ${customerName},`,
        `We appreciate your valued business. Kindly settle the outstanding balance of (${formattedTotalEn}) for (${visits.length || 1}) completed maintenance visit(s): ${problemsSummary}.`,
        `CliQ Transfer Details: ${CLIQ_PAYMENT_INFO.cliqNumber} — ${CLIQ_PAYMENT_INFO.recipientNameEn} (${CLIQ_PAYMENT_INFO.bankNameEn}). Thank you!`,
      ].join('\n');
    }

    if (templateType === 'detailed') {
      const detailLines =
        visits.length > 0
          ? visits.map((v, idx) => {
              const amt = (Number(v.amountJod) || 0).toFixed(2);
              const partsStr =
                v.installedParts && v.installedParts.length > 0
                  ? ` | Installed Parts: ${v.installedParts.join(' + ')}`
                  : '';
              return `${idx + 1}. Date: ${v.visitDate} — Service: ${v.problem}${partsStr} — Amount: ${amt} JOD (Unpaid)`;
            })
          : [`1. IT Maintenance Visit — Amount Due: ${formattedTotalEn} (Unpaid)`];

      return [
        `Al-Madar Information Technology Trading Company`,
        `================================`,
        `Statement of Unpaid Maintenance Services`,
        `Customer: ${customerName}`,
        input.phone ? `Phone: ${input.phone}` : '',
        ``,
        `Dear ${customerName},`,
        `Warm greetings from Al-Madar IT. Please find below the summary of your unpaid maintenance visit(s):`,
        ...detailLines,
        `--------------------------------`,
        `• Total Unpaid Visits: ${visits.length || 1}`,
        `• Total Amount Due: ${formattedTotalEn}`,
        `--------------------------------`,
        `Payment Methods: Cash, Check, or CliQ Instant Transfer:`,
        `• CliQ Number: ${CLIQ_PAYMENT_INFO.cliqNumber}`,
        `• Beneficiary Name: ${CLIQ_PAYMENT_INFO.recipientNameEn} (${CLIQ_PAYMENT_INFO.recipientName})`,
        `• Bank: ${CLIQ_PAYMENT_INFO.bankNameEn} (${CLIQ_PAYMENT_INFO.bankName})`,
        ``,
        `Thank you for your valued cooperation and continued trust.`,
      ]
        .filter((line) => line !== undefined)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');
    }

    const politeLines =
      visits.length > 0
        ? visits.map((v, idx) => {
            const amt = (Number(v.amountJod) || 0).toFixed(2);
            const partsStr =
              v.installedParts && v.installedParts.length > 0
                ? ` (Parts: ${v.installedParts.join(' + ')})`
                : '';
            return `• (${idx + 1}) [${v.visitDate}]: ${v.problem}${partsStr} — ${amt} JOD`;
          })
        : [`• IT Maintenance Service — ${formattedTotalEn}`];

    return [
      `Warm Greetings from Al-Madar Information Technology Trading Company (Al-Madar IT)`,
      `Dear ${customerName},`,
      ``,
      `We are always pleased to serve you. Please find below the details of the completed maintenance services with an outstanding balance:`,
      ...politeLines,
      ``,
      `• Total Amount Due: ${formattedTotalEn}`,
      ``,
      `For your convenience, payment can be made via Cash or CliQ transfer:`,
      `• CliQ Number: ${CLIQ_PAYMENT_INFO.cliqNumber}`,
      `• Beneficiary: ${CLIQ_PAYMENT_INFO.recipientNameEn} (${CLIQ_PAYMENT_INFO.recipientName})`,
      `• Bank: ${CLIQ_PAYMENT_INFO.bankNameEn} (${CLIQ_PAYMENT_INFO.bankName})`,
      ``,
      `Thank you very much for your cooperation and continued trust in Al-Madar IT.`,
    ].join('\n');
  };

  if (lang === 'ar') return buildArabicText();
  if (lang === 'en') return buildEnglishText();
  return `${buildArabicText()}\n\n================================\n\n${buildEnglishText()}`;
}

export function formatWhatsAppUrl(phone: string | undefined, message: string): string {
  const digits = (phone || '').replace(/[^\d]/g, '');
  let normalized = digits;
  if (normalized.startsWith('00')) {
    normalized = normalized.slice(2);
  } else if (normalized.startsWith('07') && normalized.length >= 9) {
    normalized = `962${normalized.slice(1)}`;
  } else if (normalized.startsWith('7') && normalized.length >= 8) {
    normalized = `962${normalized}`;
  }
  const encoded = encodeURIComponent(message);
  return normalized
    ? `https://wa.me/${normalized}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export interface CliqAccountMetrics {
  totalBalanceJod: number;
  todayBalanceJod: number;
  totalTransactionsCount: number;
  todayTransactionsCount: number;
  visits: MaintenanceVisit[];
  todayVisits: MaintenanceVisit[];
}

export function calculateCliqAccountMetrics(
  state: AppState,
  todayStr: string = getTodayStr()
): CliqAccountMetrics {
  const allVisits = state.visits || [];
  const cliqVisits = allVisits
    .filter((v) => v.isPaid && v.paymentMethod === 'cliq')
    .sort((a, b) => {
      const dCmp = (b.visitDate || '').localeCompare(a.visitDate || '');
      if (dCmp !== 0) return dCmp;
      return (b.visitTime || '').localeCompare(a.visitTime || '');
    });

  const todayVisits = cliqVisits.filter((v) => v.visitDate === todayStr);

  const totalBalanceJod = Number(
    cliqVisits
      .reduce((sum, v) => sum + (Number(v.amountJod) || 0), 0)
      .toFixed(2)
  );
  const todayBalanceJod = Number(
    todayVisits
      .reduce((sum, v) => sum + (Number(v.amountJod) || 0), 0)
      .toFixed(2)
  );

  return {
    totalBalanceJod,
    todayBalanceJod,
    totalTransactionsCount: cliqVisits.length,
    todayTransactionsCount: todayVisits.length,
    visits: cliqVisits,
    todayVisits,
  };
}



