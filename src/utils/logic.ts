import type {
  AppNotification,
  AppState,
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
      u.password === cleanPass
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

  const enrichedVisit: MaintenanceVisit = {
    ...visit,
    customerId: matchedCustomer.id,
    customerName: cleanName,
  };

  // 2. Upsert visit
  const existingIdx = state.visits.findIndex((v) => v.id === enrichedVisit.id);
  const isNewVisit = existingIdx < 0;
  const nextVisits =
    existingIdx >= 0
      ? state.visits.map((v, i) => (i === existingIdx ? enrichedVisit : v))
      : [enrichedVisit, ...state.visits];

  // 3. Sync appointments linked to this visit
  const filteredAppointments = state.appointments.filter(
    (a) => a.linkedVisitId !== enrichedVisit.id
  );

  const mainAppointment: ScheduleAppointment = {
    id: `apt-main-${enrichedVisit.id}`,
    title:
      enrichedVisit.visitType === 'contract'
        ? `زيارة عقد صيانة: ${enrichedVisit.problem}`
        : `صيانة: ${enrichedVisit.problem}`,
    customerName: enrichedVisit.customerName,
    phone: enrichedVisit.phone,
    date: enrichedVisit.visitDate,
    time: enrichedVisit.visitTime || '10:00',
    type: 'maintenance',
    linkedVisitId: enrichedVisit.id,
    status: enrichedVisit.isResolved ? 'completed' : 'scheduled',
    note: enrichedVisit.note,
  };

  const newAppointments: ScheduleAppointment[] = [mainAppointment];

  if (enrichedVisit.nextVisitDate && enrichedVisit.nextVisitDate.trim() !== '') {
    newAppointments.push({
      id: `apt-next-${enrichedVisit.id}`,
      title: `زيارة قادمة (متابعة): ${enrichedVisit.customerName}`,
      customerName: enrichedVisit.customerName,
      phone: enrichedVisit.phone,
      date: enrichedVisit.nextVisitDate,
      time: enrichedVisit.visitTime || '10:00',
      type: 'next_visit',
      linkedVisitId: enrichedVisit.id,
      status: 'scheduled',
      note: `متابعة صيانة سابقة (${enrichedVisit.problem})`,
    });
  }

  // 4. Auto-register any new parts from requiredParts or installedParts into state.parts
  let nextParts = [...state.parts];
  const allVisitParts = [
    ...(enrichedVisit.requiredParts || []),
    ...(enrichedVisit.installedParts || []),
  ];
  for (const rawPartName of allVisitParts) {
    const cleanPart = rawPartName.trim();
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
  const nextExpenses =
    idx >= 0
      ? state.expenses.map((e, i) => (i === idx ? record : e))
      : [record, ...state.expenses];

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

  return {
    ...state,
    expenses: nextExpenses,
    parts: nextParts,
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
    | 'catalogs'
    | 'schedule'
    | 'finance'
    | 'dashboard';
}

export function searchSystemRecords(
  state: AppState,
  rawQuery: string
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

  for (const e of state.expenses) {
    const hay = `${e.title} ${e.partType || ''} ${e.note || ''} ${e.date}`.toLowerCase();
    if (hay.includes(q)) {
      results.push({
        id: `res-exp-${e.id}`,
        category: 'finance',
        title: e.title,
        subtitle: e.partType || e.note || 'مصروف مالي',
        meta: `${e.date} · ${e.amountJod.toFixed(2)} JOD`,
        targetTab: 'finance',
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
        targetTab: 'catalogs',
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
    if (v.isResolved) {
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
    } else {
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
  const netProfitJod = totalRevenueJod - totalExpensesJod;
  const totalBalanceWithMorningJod =
    morningCashJod + totalRevenueJod - totalExpensesJod;

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

export function generateCsvContent(
  visits: MaintenanceVisit[],
  expenses: ExpenseRecord[],
  morningCash: MorningCashRecord[],
  summary: FinancialSummary,
  lang: Language = 'ar'
): string {
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
          escapeCsv(v.isPaid ? 'مدفوع' : 'غير مدفوع'),
          escapeCsv(
            v.paymentMethod === 'cash'
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
          escapeCsv(v.isPaid ? 'Paid' : 'Unpaid'),
          escapeCsv(v.paymentMethod.toUpperCase()),
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
    expenseTemplates: [],
    visits: [],
    morningCash: [],
    expenses: [],
    appointments: [],
    dailyNotes: [],
    notifications: [],
  };
}
