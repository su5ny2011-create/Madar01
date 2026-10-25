import React, { useState, useMemo } from 'react';
import {
  Archive,
  ArchiveRestore,
  Banknote,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ArrowRight,
  FileText,
  Printer,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Lock,
  Edit3,
  Layers,
  Fuel,
  Wrench,
  Package,
  AlertTriangle,
  X,
  Smartphone,
} from 'lucide-react';
import type {
  AppState,
  ExpenseCategory,
  ExpenseRecord,
  Language,
  MaintenanceVisit,
  MorningCashRecord,
  PaymentMethod,
  ReportPeriod,
} from '../types';
import {
  calculateCliqAccountMetrics,
  formatJod,
  getDayName,
  getTodayStr,
  isVisitUnpaid,
  type ProfitRolloverResult,
} from '../utils/logic';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { EditFinanceRecordModal } from './EditFinanceRecordModal';
import { EditDailyMaintenanceModal } from './EditDailyMaintenanceModal';
import { FinancialReportPdfModal } from './FinancialReportPdfModal';
import { FinanceTransferConfirmModal } from './FinanceTransferConfirmModal';
import { CliqAccountModal } from './CliqAccountModal';

interface AdvancedFinanceViewProps {
  lang: Language;
  state: AppState;
  currentUserFullName?: string;
  onTransferAllActiveFinance: (options?: { targetDate?: string }) => number;
  onTransferProfitsToMorningCash?: (options?: {
    targetDate?: string;
    source?: 'active' | 'archived';
  }) => ProfitRolloverResult;
  onRestoreFinanceRecord: (
    recordType: 'morning_cash' | 'expense' | 'visit_revenue',
    id: string
  ) => void;
  onRestoreDayFinance: (dateStr: string) => void;
  onSaveMorningCash?: (record: MorningCashRecord) => void;
  onSaveExpense?: (record: ExpenseRecord) => void;
  onSaveVisit?: (visit: MaintenanceVisit) => void;
  onDeleteMorningCash: (id: string) => void;
  onDeleteExpense: (id: string) => void;
  onDeleteVisit: (id: string) => void;
  onBackToActiveFinance: () => void;
  canDelete?: boolean;
  canTransfer?: boolean;
}

type TxTypeFilter = 'all' | 'visit_revenue' | 'expense' | 'morning_cash';
type MethodFilter = 'all' | PaymentMethod;

interface UnifiedFinanceItem {
  id: string;
  recordType: 'morning_cash' | 'expense' | 'visit_revenue';
  date: string;
  time: string;
  title: string;
  subtitle: string;
  amountJod: number;
  isPositive: boolean;
  paymentMethod?: PaymentMethod;
  categoryLabel: string;
  note?: string;
  rawMorningCash?: MorningCashRecord;
  rawExpense?: ExpenseRecord;
  rawVisit?: MaintenanceVisit;
}

export const AdvancedFinanceView: React.FC<AdvancedFinanceViewProps> = ({
  lang,
  state,
  currentUserFullName = 'مدير النظام',
  onTransferAllActiveFinance,
  onTransferProfitsToMorningCash,
  onRestoreFinanceRecord,
  onRestoreDayFinance,
  onSaveMorningCash,
  onSaveExpense,
  onSaveVisit,
  onDeleteMorningCash,
  onDeleteExpense,
  onDeleteVisit,
  onBackToActiveFinance,
  canDelete = true,
  canTransfer = true,
}) => {
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>(getTodayStr());
  const [txTypeFilter, setTxTypeFilter] = useState<TxTypeFilter>('all');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusBanner, setStatusBanner] = useState('');
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [editingMorningCash, setEditingMorningCash] =
    useState<MorningCashRecord | null>(null);
  const [editingVisit, setEditingVisit] = useState<MaintenanceVisit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    recordType: 'morning_cash' | 'expense' | 'visit_revenue';
    id: string;
    label: string;
  } | null>(null);
  const [isPdfReportOpen, setIsPdfReportOpen] = useState(false);
  const [pdfReportPeriod, setPdfReportPeriod] = useState<ReportPeriod>('all');
  const [pdfOpenCalendar, setPdfOpenCalendar] = useState(false);

  // Compact Unpaid Customers Full-Screen Modal State
  const [isCustomerPaymentListOpen, setIsCustomerPaymentListOpen] = useState<boolean>(false);
  const [customerPaymentSearch, setCustomerPaymentSearch] = useState<string>('');
  const [draftVisitAmounts, setDraftVisitAmounts] = useState<Record<string, string>>({});
  const [draftVisitMethods, setDraftVisitMethods] = useState<Record<string, PaymentMethod>>({});
  const [confirmPaidVisitTarget, setConfirmPaidVisitTarget] = useState<MaintenanceVisit | null>(null);

  // CliQ Customer Account State & Metrics (مفصول عن الكاش)
  const todayStr = useMemo(() => getTodayStr(), []);
  const [isCliqModalOpen, setIsCliqModalOpen] = useState<boolean>(false);
  const cliqMetrics = useMemo(() => calculateCliqAccountMetrics(state, todayStr), [state, todayStr]);
  const [initialYear, initialMonth] = useMemo(() => {
    const [y, m] = todayStr.split('-').map(Number);
    return [y, m];
  }, [todayStr]);
  const [calendarYear, setCalendarYear] = useState<number>(initialYear);
  const [calendarMonth, setCalendarMonth] = useState<number>(initialMonth);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState<boolean>(true);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState<boolean>(false);
  const [isCarenderPopoverOpen, setIsCarenderPopoverOpen] = useState<boolean>(false);

  // Transfer & Rollover & Restore Confirmation Modals State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [rolloverConfirmTarget, setRolloverConfirmTarget] = useState<{
    dateStr?: string;
    profitJod: number;
  } | null>(null);
  const [restoreConfirmDate, setRestoreConfirmDate] = useState<string | null>(null);

  const getCategoryLabel = (cat: ExpenseCategory) => {
    if (lang === 'ar') {
      return cat === 'fuel'
        ? 'بنزين'
        : cat === 'car_repair'
        ? 'تصليح سيارة'
        : cat === 'parts_purchase'
        ? 'شراء قطع'
        : 'مصاريف أخرى';
    }
    return cat === 'fuel'
      ? 'Fuel'
      : cat === 'car_repair'
      ? 'Car Repair'
      : cat === 'parts_purchase'
      ? 'Parts Purchase'
      : 'Other Expense';
  };

  // Count active unarchived financial records that can be transferred now
  const activeUnarchivedCount =
    state.morningCash.filter((m) => !m.isArchived).length +
    state.expenses.filter((e) => !e.isArchived).length +
    state.visits.filter(
      (v) => v.isPaid && v.visitType !== 'contract' && !v.isFinanceArchived
    ).length;

  // Collect all archived/transferred financial items
  const archivedMorningCash = state.morningCash.filter((m) =>
    Boolean(m.isArchived)
  );
  const archivedExpenses = state.expenses.filter((e) => Boolean(e.isArchived));
  const archivedPaidVisits = state.visits.filter(
    (v) =>
      v.isPaid && v.visitType !== 'contract' && Boolean(v.isFinanceArchived)
  );

  // Build unified items list
  const allUnifiedItems: UnifiedFinanceItem[] = useMemo(() => [
    ...archivedMorningCash.map(
      (m): UnifiedFinanceItem => ({
        id: m.id,
        recordType: 'morning_cash',
        date: m.date,
        time: '08:00',
        title:
          lang === 'ar'
            ? 'رصيد كاش الصباح الافتتاحي'
            : 'Opening Morning Cash',
        subtitle: m.recordedBy
          ? lang === 'ar'
            ? `بواسطة: ${m.recordedBy}`
            : `By: ${m.recordedBy}`
          : '',
        amountJod: Number(m.amountJod) || 0,
        isPositive: true,
        paymentMethod: 'cash',
        categoryLabel: lang === 'ar' ? 'كاش الصباح' : 'Morning Cash',
        note: m.note,
        rawMorningCash: m,
      })
    ),
    ...archivedPaidVisits.map(
      (v): UnifiedFinanceItem => ({
        id: v.id,
        recordType: 'visit_revenue',
        date: v.visitDate,
        time: v.visitTime || '10:00',
        title: v.customerName,
        subtitle: v.problem,
        amountJod: Number(v.amountJod) || 0,
        isPositive: true,
        paymentMethod: v.paymentMethod,
        categoryLabel:
          v.visitType === 'contract'
            ? lang === 'ar'
              ? 'مقبوضات عقد صيانة'
              : 'Contract Revenue'
            : lang === 'ar'
            ? 'مقبوضات زيارة صيانة'
            : 'Visit Revenue',
        note: v.note,
        rawVisit: v,
      })
    ),
    ...archivedExpenses.map(
      (e): UnifiedFinanceItem => ({
        id: e.id,
        recordType: 'expense',
        date: e.date,
        time: e.time || '10:00',
        title: e.title,
        subtitle: e.partType
          ? `${getCategoryLabel(e.category)} (${e.partType})`
          : getCategoryLabel(e.category),
        amountJod: Number(e.amountJod) || 0,
        isPositive: false,
        paymentMethod: e.paymentMethod,
        categoryLabel: getCategoryLabel(e.category),
        note: e.note,
        rawExpense: e,
      })
    ),
  ], [archivedMorningCash, archivedPaidVisits, archivedExpenses, lang]);

  // Unique dates from all recorded items (sorted descending YYYY-MM-DD)
  const allAvailableDates = useMemo(() => {
    return Array.from(new Set(allUnifiedItems.map((i) => i.date))).sort(
      (a, b) => b.localeCompare(a)
    );
  }, [allUnifiedItems]);

  // Pre-calculate per-day summary stats & expense distributions for the dropdown and badges
  const daySummaries = useMemo(() => {
    return allAvailableDates.map((dStr) => {
      const dayItems = allUnifiedItems.filter((i) => i.date === dStr);
      const morningJod = dayItems
        .filter((i) => i.recordType === 'morning_cash')
        .reduce((acc, i) => acc + i.amountJod, 0);
      const revenueJod = dayItems
        .filter((i) => i.recordType === 'visit_revenue')
        .reduce((acc, i) => acc + i.amountJod, 0);
      const cashRevenueJod = dayItems
        .filter(
          (i) =>
            i.recordType === 'visit_revenue' &&
            (i.rawVisit?.paymentMethod ?? 'cash') === 'cash'
        )
        .reduce((acc, i) => acc + i.amountJod, 0);
      const expensesJod = dayItems
        .filter((i) => i.recordType === 'expense')
        .reduce((acc, i) => acc + i.amountJod, 0);
      const cashExpensesJod = dayItems
        .filter(
          (i) =>
            i.recordType === 'expense' &&
            (i.rawExpense?.paymentMethod ?? 'cash') === 'cash'
        )
        .reduce((acc, i) => acc + i.amountJod, 0);
      const netProfitJod = cashRevenueJod - cashExpensesJod;
      const netBalanceJod = morningJod + netProfitJod;

      // Expense categories breakdown
      const expenseItems = dayItems.filter((i) => i.recordType === 'expense');
      const fuelTotal = expenseItems
        .filter((i) => i.rawExpense?.category === 'fuel')
        .reduce((acc, i) => acc + i.amountJod, 0);
      const carRepairTotal = expenseItems
        .filter((i) => i.rawExpense?.category === 'car_repair')
        .reduce((acc, i) => acc + i.amountJod, 0);
      const partsTotal = expenseItems
        .filter((i) => i.rawExpense?.category === 'parts_purchase')
        .reduce((acc, i) => acc + i.amountJod, 0);
      const otherTotal = expenseItems
        .filter((i) => i.rawExpense?.category === 'other')
        .reduce((acc, i) => acc + i.amountJod, 0);

      return {
        dateStr: dStr,
        count: dayItems.length,
        morningJod,
        revenueJod,
        expensesJod,
        netProfitJod,
        netBalanceJod,
        fuelTotal,
        carRepairTotal,
        partsTotal,
        otherTotal,
      };
    });
  }, [allAvailableDates, allUnifiedItems]);

  const selectedDaySummary = useMemo(() => {
    if (selectedDayFilter === 'all') return null;
    return daySummaries.find((d) => d.dateStr === selectedDayFilter) || null;
  }, [daySummaries, selectedDayFilter]);

  // Fast map lookup for day stats in calendar cells
  const daySummariesMap = useMemo(() => {
    const map = new Map<string, (typeof daySummaries)[0]>();
    daySummaries.forEach((d) => map.set(d.dateStr, d));
    return map;
  }, [daySummaries]);

  // Month names
  const monthNames = {
    ar: [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ],
    en: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
  };

  const calendarWeekdays = [
    { ar: 'السبت', en: 'Sat' },
    { ar: 'الأحد', en: 'Sun' },
    { ar: 'الإثنين', en: 'Mon' },
    { ar: 'الثلاثاء', en: 'Tue' },
    { ar: 'الأربعاء', en: 'Wed' },
    { ar: 'الخميس', en: 'Thu' },
    { ar: 'الجمعة', en: 'Fri' },
  ];

  // Calendar cells generation (Weeks start Saturday, offset = (firstDayOfWeek + 1) % 7)
  const calendarCells = useMemo(() => {
    const firstDay = new Date(Date.UTC(calendarYear, calendarMonth - 1, 1));
    const firstDayOfWeek = firstDay.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const leadingDays = (firstDayOfWeek + 1) % 7;

    const daysInMonth = new Date(
      Date.UTC(calendarYear, calendarMonth, 0)
    ).getUTCDate();
    const daysInPrevMonth = new Date(
      Date.UTC(calendarYear, calendarMonth - 1, 0)
    ).getUTCDate();

    const cells: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
    }[] = [];

    // Prev month days
    const prevMonth = calendarMonth === 1 ? 12 : calendarMonth - 1;
    const prevYear = calendarMonth === 1 ? calendarYear - 1 : calendarYear;
    for (let i = leadingDays - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(
        day
      ).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: day, isCurrentMonth: false });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calendarYear}-${String(calendarMonth).padStart(
        2,
        '0'
      )}-${String(day).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: day, isCurrentMonth: true });
    }

    // Next month days to complete full weeks
    const remaining = (7 - (cells.length % 7)) % 7;
    const nextMonth = calendarMonth === 12 ? 1 : calendarMonth + 1;
    const nextYear = calendarMonth === 12 ? calendarYear + 1 : calendarYear;
    for (let day = 1; day <= remaining; day++) {
      const dateStr = `${nextYear}-${String(nextMonth).padStart(
        2,
        '0'
      )}-${String(day).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: day, isCurrentMonth: false });
    }

    return cells;
  }, [calendarYear, calendarMonth]);

  // Monthly stats for the current calendar view month
  const monthPrefix = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}`;
  const monthItems = useMemo(
    () => allUnifiedItems.filter((i) => i.date.startsWith(monthPrefix)),
    [allUnifiedItems, monthPrefix]
  );
  const monthRevenueJod = useMemo(
    () =>
      monthItems
        .filter((i) => i.recordType === 'visit_revenue')
        .reduce((acc, i) => acc + i.amountJod, 0),
    [monthItems]
  );
  const monthExpensesJod = useMemo(
    () =>
      monthItems
        .filter((i) => i.recordType === 'expense')
        .reduce((acc, i) => acc + i.amountJod, 0),
    [monthItems]
  );
  const monthNetProfitJod = monthRevenueJod - monthExpensesJod;
  const monthRecordedDates = useMemo(
    () => Array.from(new Set(monthItems.map((i) => i.date))),
    [monthItems]
  );

  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const today = getTodayStr();
    const [y, m] = today.split('-').map(Number);
    setCalendarYear(y);
    setCalendarMonth(m);
    setSelectedDayFilter(today);
    setIsCalendarModalOpen(false);
  };

  // Transfer & Rollover & Restore execution handlers
  const handleExecuteTransferModal = (options?: { targetDate?: string }) => {
    const count = onTransferAllActiveFinance(options);
    if (count > 0) {
      setStatusBanner(
        lang === 'ar'
          ? `تم ترحيل (${count}) حركة مالية بنجاح إلى «المالية المتقدمة» ${
              options?.targetDate ? `ليوم (${options.targetDate})` : ''
            }!`
          : `Transferred (${count}) daily financial transactions to Advanced Finance ${
              options?.targetDate ? `for (${options.targetDate})` : ''
            }!`
      );
    } else {
      setStatusBanner(
        lang === 'ar'
          ? 'جميع الحركات المالية الحالية مرحّلة بالفعل في المالية المتقدمة.'
          : 'All current financial transactions are already transferred.'
      );
    }
    setTimeout(() => setStatusBanner(''), 4500);
  };

  const handleExecuteRollover = () => {
    if (!onTransferProfitsToMorningCash || !rolloverConfirmTarget) return;
    const res = onTransferProfitsToMorningCash({
      source: 'archived',
      targetDate: rolloverConfirmTarget.dateStr,
    });
    const dateLabel = rolloverConfirmTarget.dateStr
      ? `يوم (${rolloverConfirmTarget.dateStr})`
      : 'الأرشيف المالي';
    setRolloverConfirmTarget(null);
    if (res.transferredCount > 0) {
      setStatusBanner(
        lang === 'ar'
          ? `تم ترحيل أرباح ${dateLabel} بقيمة (${
              res.netProfitJod >= 0 ? '+' : ''
            }${formatJod(res.netProfitJod, lang)}) بنجاح إلى الكاش الصباحي! رصيد الكاش الصباحي الجديد: ${formatJod(
              res.newMorningCashJod,
              lang
            )}`
          : `Rolled over profit (${formatJod(res.netProfitJod, lang)}) into Morning Cash!`
      );
    } else {
      setStatusBanner(
        lang === 'ar'
          ? 'لا توجد مقبوضات أو مصاريف مرحّلة حالياً لترحيل أرباحها إلى الكاش الصباحي.'
          : 'No transferred revenue or expenses to roll over into Morning Cash.'
      );
    }
    setTimeout(() => setStatusBanner(''), 5000);
  };

  const handleExecuteRestoreDay = () => {
    if (!restoreConfirmDate) return;
    const dateStr = restoreConfirmDate;
    setRestoreConfirmDate(null);
    onRestoreDayFinance(dateStr);
    setStatusBanner(
      lang === 'ar'
        ? `تم إرجاع حركات يوم (${dateStr}) بنجاح إلى صفحة المالية اليومية النشطة.`
        : `Restored financial records of (${dateStr}) to active Daily Finance.`
    );
    setTimeout(() => setStatusBanner(''), 4500);
  };

  // Navigation helpers for Previous / Next recorded day (works from any selected date, including Today)
  const nextRecordedDate = useMemo(() => {
    if (selectedDayFilter === 'all') return null;
    const newer = allAvailableDates.filter((d) => d > selectedDayFilter);
    return newer.length > 0 ? newer[newer.length - 1] : null;
  }, [allAvailableDates, selectedDayFilter]);

  const prevRecordedDate = useMemo(() => {
    if (selectedDayFilter === 'all') return null;
    const older = allAvailableDates.filter((d) => d < selectedDayFilter);
    return older.length > 0 ? older[0] : null;
  }, [allAvailableDates, selectedDayFilter]);

  const hasNextDay = Boolean(nextRecordedDate);
  const hasPrevDay = Boolean(prevRecordedDate);

  const goToNextDay = () => {
    if (nextRecordedDate) {
      setSelectedDayFilter(nextRecordedDate);
      const [y, m] = nextRecordedDate.split('-').map(Number);
      setCalendarYear(y);
      setCalendarMonth(m);
    }
  };

  const goToPrevDay = () => {
    if (prevRecordedDate) {
      setSelectedDayFilter(prevRecordedDate);
      const [y, m] = prevRecordedDate.split('-').map(Number);
      setCalendarYear(y);
      setCalendarMonth(m);
    }
  };

  // Filter items by day (if a specific day is selected from the top dropdown)
  const dayFilteredItems = useMemo(() => {
    if (selectedDayFilter === 'all') {
      return allUnifiedItems;
    }
    return allUnifiedItems.filter((item) => item.date === selectedDayFilter);
  }, [allUnifiedItems, selectedDayFilter]);

  // Apply secondary filters (type, payment method, text search)
  const filteredItems = useMemo(() => {
    return dayFilteredItems.filter((item) => {
      if (txTypeFilter !== 'all' && item.recordType !== txTypeFilter)
        return false;
      if (methodFilter !== 'all' && item.paymentMethod !== methodFilter)
        return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const hay = `${item.title} ${item.subtitle} ${item.categoryLabel} ${
        item.note || ''
      } ${item.date}`.toLowerCase();
      return hay.includes(q);
    });
  }, [dayFilteredItems, txTypeFilter, methodFilter, searchQuery]);

  // Unique dates descending
  const uniqueDates = useMemo(() => {
    return Array.from(new Set(filteredItems.map((i) => i.date))).sort((a, b) =>
      b.localeCompare(a)
    );
  }, [filteredItems]);

  // Overall Archived Totals (Cash balance excludes CliQ / non-cash)
  const totalTransferredRevenueJod = archivedPaidVisits.reduce(
    (acc, v) => acc + (Number(v.amountJod) || 0),
    0
  );
  const totalTransferredCashRevenueJod = archivedPaidVisits
    .filter((v) => (v.paymentMethod ?? 'cash') === 'cash')
    .reduce((acc, v) => acc + (Number(v.amountJod) || 0), 0);
  const totalTransferredExpensesJod = archivedExpenses.reduce(
    (acc, e) => acc + (Number(e.amountJod) || 0),
    0
  );
  const totalTransferredCashExpensesJod = archivedExpenses
    .filter((e) => (e.paymentMethod ?? 'cash') === 'cash')
    .reduce((acc, e) => acc + (Number(e.amountJod) || 0), 0);
  const totalTransferredMorningCashJod = archivedMorningCash.reduce(
    (acc, m) => acc + (Number(m.amountJod) || 0),
    0
  );
  const netTransferredProfitJod =
    totalTransferredCashRevenueJod - totalTransferredCashExpensesJod;
  const totalBalanceWithMorningJod =
    totalTransferredMorningCashJod + netTransferredProfitJod;

  const pendingRolloverRevenueJod = archivedPaidVisits
    .filter(
      (v) =>
        !v.profitTransferredToMorningCash &&
        (v.paymentMethod ?? 'cash') === 'cash'
    )
    .reduce((acc, v) => acc + (Number(v.amountJod) || 0), 0);
  const pendingRolloverExpensesJod = archivedExpenses
    .filter(
      (e) =>
        !e.profitTransferredToMorningCash &&
        (e.paymentMethod ?? 'cash') === 'cash'
    )
    .reduce((acc, e) => acc + (Number(e.amountJod) || 0), 0);
  const pendingRolloverProfitJod = Number(
    (pendingRolloverRevenueJod - pendingRolloverExpensesJod).toFixed(2)
  );

  // Active view metrics (adapted to selected day if one is chosen, otherwise overall)
  const isDaySelected = selectedDayFilter !== 'all';
  const displayRevenueJod = isDaySelected
    ? (selectedDaySummary ? selectedDaySummary.revenueJod : 0)
    : totalTransferredRevenueJod;
  const displayExpensesJod = isDaySelected
    ? (selectedDaySummary ? selectedDaySummary.expensesJod : 0)
    : totalTransferredExpensesJod;
  const displayMorningCashJod = isDaySelected
    ? (selectedDaySummary ? selectedDaySummary.morningJod : 0)
    : totalTransferredMorningCashJod;
  const displayNetProfitJod = isDaySelected
    ? (selectedDaySummary ? selectedDaySummary.netProfitJod : 0)
    : netTransferredProfitJod;
  const displayBalanceWithMorningJod = isDaySelected
    ? (selectedDaySummary ? selectedDaySummary.netBalanceJod : 0)
    : totalBalanceWithMorningJod;

  // Unpaid Customer Visits List (across all visits so no unpaid customer is missed)
  const allUnpaidCustomerVisits = useMemo(() => {
    return state.visits
      .filter((v) => isVisitUnpaid(v))
      .sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''));
  }, [state.visits]);

  const totalUnpaidCustomerJod = useMemo(
    () =>
      allUnpaidCustomerVisits.reduce(
        (acc, v) => acc + (Number(v.amountJod) || 0),
        0
      ),
    [allUnpaidCustomerVisits]
  );

  const filteredCustomerPaymentVisits = useMemo(() => {
    const q = customerPaymentSearch.trim().toLowerCase();
    if (!q) return allUnpaidCustomerVisits;
    return allUnpaidCustomerVisits.filter((v) => {
      const hay = `${v.customerName} ${v.problem} ${v.phone || ''} ${
        v.visitDate || ''
      } ${v.technicianName || ''} ${v.note || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allUnpaidCustomerVisits, customerPaymentSearch]);

  const handleSaveCustomerVisitAmountOnly = (v: MaintenanceVisit) => {
    if (!onSaveVisit) return;
    const rawStr =
      draftVisitAmounts[v.id] !== undefined
        ? draftVisitAmounts[v.id]
        : String(v.amountJod ?? 0);
    const parsedAmt = Number(rawStr);
    const cleanAmt =
      Number.isFinite(parsedAmt) && parsedAmt >= 0
        ? Number(parsedAmt.toFixed(2))
        : 0;
    const chosenMethod = draftVisitMethods[v.id] || v.paymentMethod || 'cash';

    onSaveVisit({
      ...v,
      visitType: 'visit',
      amountJod: cleanAmt,
      paymentMethod: chosenMethod,
    });

    setDraftVisitAmounts((prev) => {
      const next = { ...prev };
      delete next[v.id];
      return next;
    });

    setStatusBanner(
      lang === 'ar'
        ? `تم تعديل وحفظ مبلغ الزبون «${v.customerName}» ليصبح (${formatJod(
            cleanAmt,
            lang
          )}).`
        : `Updated amount for "${v.customerName}" to ${formatJod(cleanAmt, lang)}.`
    );
    setTimeout(() => setStatusBanner(''), 4000);
  };

  const handleMarkCustomerVisitPaid = (v: MaintenanceVisit) => {
    if (!onSaveVisit) return;
    const rawStr =
      draftVisitAmounts[v.id] !== undefined
        ? draftVisitAmounts[v.id]
        : String(v.amountJod ?? 0);
    const parsedAmt = Number(rawStr);
    const cleanAmt =
      Number.isFinite(parsedAmt) && parsedAmt >= 0
        ? Number(parsedAmt.toFixed(2))
        : 0;
    const chosenMethod = draftVisitMethods[v.id] || v.paymentMethod || 'cash';

    onSaveVisit({
      ...v,
      visitType: 'visit',
      amountJod: cleanAmt,
      paymentMethod: chosenMethod,
      isPaid: true,
      noPayment: false,
      status: 'resolved',
      isResolved: true,
      isArchived: true,
      archivedAt: v.archivedAt || todayStr,
      isFinanceArchived: true,
      financeArchivedAt: todayStr,
    });

    setDraftVisitAmounts((prev) => {
      const next = { ...prev };
      delete next[v.id];
      return next;
    });
    setDraftVisitMethods((prev) => {
      const next = { ...prev };
      delete next[v.id];
      return next;
    });

    setStatusBanner(
      lang === 'ar'
        ? chosenMethod === 'cliq'
          ? `تم تأكيد دفع الزبون «${v.customerName}» عبر كلك (CliQ) بقيمة (${formatJod(
              cleanAmt,
              lang
            )}) وإضافته إلى قائمة حساب كلك (بدون إضافته للكاش)!`
          : `تم تأكيد دفع الزبون «${v.customerName}» بقيمة (${formatJod(
              cleanAmt,
              lang
            )}) وإزالته من قائمة الذمم غير المدفوعة!`
        : chosenMethod === 'cliq'
        ? `Confirmed payment for "${v.customerName}" via CliQ (${formatJod(
            cleanAmt,
            lang
          )}) and added to CliQ Account!`
        : `Confirmed payment for "${v.customerName}" (${formatJod(
            cleanAmt,
            lang
          )}) and removed from Unpaid Customers list!`
    );
    setTimeout(() => setStatusBanner(''), 4500);
  };

  return (
    <div className="space-y-3">
      {/* Top Page Header (بدون كلام تعريفي زائد) */}
      <div className="rounded-2xl bg-white border border-slate-200 px-3 py-2 sm:px-4 sm:py-2.5 shadow-2xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#0B3B68] text-white flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4 text-amber-300" />
          </div>
          <h2 className="text-sm sm:text-base font-extrabold text-[#0B3B68] leading-snug">
            {lang === 'ar' ? 'المالية المتقدمة' : 'Advanced Finance'}
          </h2>
        </div>
      </div>

      {/* Complete Financial Reports Card: اسم التقرير مكتوب بوضوح فوق إصدار التقارير + كبسة Carender تظهر بداخلها التقويم */}
      <div className="rounded-2xl bg-white border border-slate-200 p-3 sm:p-4 shadow-2xs space-y-2.5">
        {/* Tier 1: Report Title Display (اسم التقارير مكتوب بوضوح فوق إصدار التقارير) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-[#0B3B68]" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black text-amber-600 block leading-tight">
                {lang === 'ar' ? 'اسم التقرير:' : 'Report Name:'}
              </span>
              <h3 className="text-sm sm:text-base font-black text-[#0B3B68] leading-tight truncate">
                {lang === 'ar' ? 'التقارير المالية' : 'Financial Reports'}
              </h3>
            </div>
          </div>

          {/* Active Selection Badge */}
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-600">
            <span className="px-2.5 py-1 rounded-xl bg-sky-50 text-[#0B3B68] border border-sky-200">
              {selectedDayFilter !== 'all'
                ? `${getDayName(selectedDayFilter, lang)} (${selectedDayFilter})`
                : lang === 'ar'
                ? 'شامل كافة الأيام'
                : 'All Days'}
            </span>
          </div>
        </div>

        {/* Tier 2: إصدار التقارير + الفترات + كبسة Carender (تحت اسم التقرير مباشرة) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-black text-slate-700 hidden xs:inline">
              {lang === 'ar' ? 'إصدار التقارير:' : 'Export:'}
            </span>

            <div className="grid grid-cols-4 sm:flex items-center gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setPdfReportPeriod('daily');
                  setPdfOpenCalendar(false);
                  setIsPdfReportOpen(true);
                }}
                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-white hover:bg-sky-50 text-[#0B3B68] border border-slate-200 text-xs font-black flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer text-center"
                title={lang === 'ar' ? 'تقرير يومي مفصل' : 'Daily Report'}
              >
                <Printer className="w-3.5 h-3.5 text-amber-600 hidden sm:inline shrink-0" />
                <span>{lang === 'ar' ? 'يومية' : 'Daily'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPdfReportPeriod('weekly');
                  setPdfOpenCalendar(false);
                  setIsPdfReportOpen(true);
                }}
                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-white hover:bg-sky-50 text-[#0B3B68] border border-slate-200 text-xs font-black flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer text-center"
                title={lang === 'ar' ? 'تقرير أسبوعي مفصل' : 'Weekly Report'}
              >
                <Printer className="w-3.5 h-3.5 text-sky-600 hidden sm:inline shrink-0" />
                <span>{lang === 'ar' ? 'أسبوعية' : 'Weekly'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPdfReportPeriod('monthly');
                  setPdfOpenCalendar(false);
                  setIsPdfReportOpen(true);
                }}
                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-white hover:bg-sky-50 text-[#0B3B68] border border-slate-200 text-xs font-black flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer text-center"
                title={lang === 'ar' ? 'تقرير شهري مفصل' : 'Monthly Report'}
              >
                <Printer className="w-3.5 h-3.5 text-emerald-600 hidden sm:inline shrink-0" />
                <span>{lang === 'ar' ? 'شهرية' : 'Monthly'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPdfReportPeriod('all');
                  setPdfOpenCalendar(false);
                  setIsPdfReportOpen(true);
                }}
                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer text-center"
                title={lang === 'ar' ? 'تقرير شامل لكافة الأيام' : 'All Days Report'}
              >
                <span>{lang === 'ar' ? 'شامل' : 'All'}</span>
              </button>
            </div>
          </div>

          {/* Carender Toggle Button: كبسة صغيرة تفتح بداخلها carender لتصغير المساحة */}
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setIsCarenderPopoverOpen((prev) => !prev)}
              className={`min-h-[30px] px-2.5 py-1 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all border ${
                isCarenderPopoverOpen
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xs ring-2 ring-amber-400/30'
                  : 'bg-white hover:bg-amber-50 text-[#0B3B68] border-amber-300 shadow-2xs'
              }`}
              title={
                lang === 'ar'
                  ? 'فتح تقويم Carender لتحديد يوم معين بالتقرير'
                  : 'Open Carender to select day'
              }
            >
              <Calendar className="w-3.5 h-3.5 text-[#E58E26] shrink-0" />
              <span>Carender</span>
              <span className="font-mono text-[11px] font-bold text-slate-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200" dir="ltr">
                {selectedDayFilter !== 'all' ? selectedDayFilter : todayStr}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isCarenderPopoverOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Carender Popover: يفتح بداخل الكبسة مباشرة كقائمة منبثقة عائمة صغيرة لتصغير المساحة */}
            {isCarenderPopoverOpen && (
              <>
                {/* خلفية شفافة للإغلاق عند النقر بالخارج */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsCarenderPopoverOpen(false)}
                />
                <div className="absolute z-50 top-full mt-1.5 end-0 w-[285px] sm:w-[295px] rounded-2xl bg-white border border-slate-200 p-2.5 shadow-2xl space-y-2 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-[#E58E26]" />
                      </div>
                      <span className="text-xs font-black text-[#0B3B68]">
                        Carender
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleJumpToToday}
                        className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black cursor-pointer transition-colors"
                      >
                        {lang === 'ar' ? 'اليوم' : 'Today'}
                      </button>
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                        title={lang === 'ar' ? 'الشهر السابق' : 'Prev Month'}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <span
                        className="font-mono text-[11px] font-bold text-[#0B3B68] px-1 text-center"
                        dir="ltr"
                      >
                        {calendarYear}-{String(calendarMonth).padStart(2, '0')}
                      </span>
                      <button
                        type="button"
                        onClick={handleNextMonth}
                        className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                        title={lang === 'ar' ? 'الشهر التالي' : 'Next Month'}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCarenderPopoverOpen(false)}
                        className="w-6 h-6 rounded-md bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 flex items-center justify-center cursor-pointer ms-0.5"
                        title={lang === 'ar' ? 'إغلاق' : 'Close'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 7 Columns Weekday Header */}
                  <div className="grid grid-cols-7 gap-0.5 text-center">
                    {[
                      { ar: 'أحد', en: 'Sun' },
                      { ar: 'إثنين', en: 'Mon' },
                      { ar: 'ثلاثاء', en: 'Tue' },
                      { ar: 'أربعاء', en: 'Wed' },
                      { ar: 'خميس', en: 'Thu' },
                      { ar: 'جمعة', en: 'Fri' },
                      { ar: 'سبت', en: 'Sat' },
                    ].map((wd, i) => (
                      <div
                        key={i}
                        className="text-[9px] font-extrabold text-slate-500 py-0.5 bg-slate-50 rounded"
                      >
                        {lang === 'ar' ? wd.ar : wd.en}
                      </div>
                    ))}
                  </div>

                  {/* Days Grid */}
                  <div className="grid grid-cols-7 gap-0.5">
                    {calendarCells.map((cell) => {
                      const isSelected = cell.dateStr === selectedDayFilter;
                      const isToday = cell.dateStr === todayStr;
                      const hasMovements = monthRecordedDates.includes(cell.dateStr);

                      return (
                        <button
                          key={cell.dateStr}
                          type="button"
                          onClick={() => {
                            setSelectedDayFilter(cell.dateStr);
                            setIsCarenderPopoverOpen(false);
                          }}
                          className={`relative h-7 p-0.5 rounded text-[11px] font-mono font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#0B3B68] text-white shadow-xs z-10 ring-1 ring-amber-400'
                              : isToday
                              ? 'bg-amber-100 text-amber-950 font-black border border-amber-300'
                              : cell.isCurrentMonth
                              ? 'bg-slate-50 hover:bg-sky-50 text-slate-800 border border-slate-200/60'
                              : 'bg-slate-50/30 text-slate-400 border border-transparent'
                          }`}
                        >
                          <span className="leading-none">{cell.dayNum}</span>
                          {hasMovements && (
                            <span
                              className={`w-1 h-1 rounded-full ${
                                isSelected ? 'bg-amber-300' : 'bg-emerald-600'
                              }`}
                              title={lang === 'ar' ? 'حركات مسجلة' : 'Recorded'}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Action for Selected Day */}
                  {selectedDayFilter !== 'all' && (
                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-[#0B3B68] truncate">
                        {lang === 'ar' ? 'المحدد:' : 'Selected:'}{' '}
                        <strong className="font-mono">{selectedDayFilter}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPdfReportPeriod('daily');
                          setIsPdfReportOpen(true);
                          setIsCarenderPopoverOpen(false);
                        }}
                        className="h-6 px-2 rounded-md bg-[#E58E26] hover:bg-[#d17d1b] text-white text-[10px] font-black flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Printer className="w-3 h-3" />
                        <span>
                          {lang === 'ar' ? 'تقرير اليوم (.pdf)' : 'Daily (.pdf)'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {statusBanner && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs sm:text-sm font-bold flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#1E824C] shrink-0" />
            <span className="break-words">{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={onBackToActiveFinance}
            className="min-h-[34px] px-3 py-1 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Banknote className="w-3.5 h-3.5 text-emerald-300" />
            <span>{lang === 'ar' ? 'الانتقال إلى المالية اليومية' : 'Open Daily Finance'}</span>
          </button>
        </div>
      )}

      {/* Compact Carender Bar & Always-Visible Today / Show All Buttons */}
      <div className="rounded-2xl bg-white border border-slate-200 px-3 py-2.5 sm:px-4 sm:py-3 shadow-2xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 text-[#0B3B68] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-[#0B3B68]" />
            </div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900">
              {lang === 'ar' ? 'التقويم والأيام:' : 'Calendar:'}
            </h3>

            {selectedDayFilter !== 'all' ? (
              <span className="px-2.5 py-1 rounded-xl bg-sky-50 border border-sky-200 text-[#0B3B68] text-xs font-black flex items-center gap-1.5">
                <span>
                  {selectedDayFilter === todayStr
                    ? (lang === 'ar' ? 'اليوم:' : 'Today:')
                    : ''}
                </span>
                <span>{getDayName(selectedDayFilter, lang)}</span>
                <span className="font-mono" dir="ltr">({selectedDayFilter})</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-black">
                {lang === 'ar'
                  ? `كل الأيام (${allAvailableDates.length} يوم)`
                  : `All Days (${allAvailableDates.length})`}
              </span>
            )}

            {/* Quick Prev / Next Recorded Day Arrows */}
            {allAvailableDates.length > 0 && selectedDayFilter !== 'all' && (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled={!hasPrevDay}
                  onClick={goToPrevDay}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-35 disabled:cursor-not-allowed text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  title={lang === 'ar' ? 'اليوم المسجل السابق' : 'Previous Recorded Day'}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!hasNextDay}
                  onClick={goToNextDay}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-35 disabled:cursor-not-allowed text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  title={lang === 'ar' ? 'اليوم المسجل التالي' : 'Next Recorded Day'}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Always-Visible Action Buttons: Carender + Today + Show All (لا تختفي كبسة اليوم أبداً) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsCalendarModalOpen(true)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-sky-200 shrink-0" />
              <span>
                {lang === 'ar' ? '📅 التقويم (Carender)' : 'Carender'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleJumpToToday}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-colors border ${
                selectedDayFilter === todayStr
                  ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
              }`}
              title={lang === 'ar' ? 'عرض حركات اليوم' : 'Show Today'}
            >
              <span>{lang === 'ar' ? 'اليوم' : 'Today'}</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedDayFilter('all')}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors border ${
                selectedDayFilter === 'all'
                  ? 'bg-sky-700 text-white border-sky-700 shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
              title={lang === 'ar' ? 'عرض كل الأيام' : 'Show All Days'}
            >
              <span>
                {lang === 'ar'
                  ? `عرض الكل (${allAvailableDates.length})`
                  : `Show All (${allAvailableDates.length})`}
              </span>
            </button>
          </div>
        </div>

        {/* Selected Day Expense Distribution & Quick Actions Banner */}
        {selectedDaySummary && (
          <div className="pt-3 border-t border-slate-200/90 space-y-2.5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-extrabold text-[#0B3B68] flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                  <span>
                    {lang === 'ar'
                      ? `توزيع مصاريف يوم (${selectedDaySummary.dateStr}):`
                      : `Expenses Breakdown (${selectedDaySummary.dateStr}):`}
                  </span>
                </span>
                {selectedDaySummary.expensesJod === 0 ? (
                  <span className="text-slate-400 font-medium">
                    {lang === 'ar' ? 'لا توجد مصاريف مسجلة في هذا اليوم' : 'No expenses recorded for this day'}
                  </span>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5 font-bold">
                    {selectedDaySummary.fuelTotal > 0 && (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                        ⛽ {lang === 'ar' ? 'بنزين: ' : 'Fuel: '}
                        {formatJod(selectedDaySummary.fuelTotal, lang)}
                      </span>
                    )}
                    {selectedDaySummary.carRepairTotal > 0 && (
                      <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200">
                        🔧 {lang === 'ar' ? 'تصليح سيارة: ' : 'Car Repair: '}
                        {formatJod(selectedDaySummary.carRepairTotal, lang)}
                      </span>
                    )}
                    {selectedDaySummary.partsTotal > 0 && (
                      <span className="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-900 border border-purple-200">
                        📦 {lang === 'ar' ? 'قطع: ' : 'Parts: '}
                        {formatJod(selectedDaySummary.partsTotal, lang)}
                      </span>
                    )}
                    {selectedDaySummary.otherTotal > 0 && (
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                        🏷️ {lang === 'ar' ? 'أخرى: ' : 'Other: '}
                        {formatJod(selectedDaySummary.otherTotal, lang)}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-200 font-extrabold">
                      {lang === 'ar' ? 'المجموع: ' : 'Total: '}
                      {formatJod(selectedDaySummary.expensesJod, lang)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 font-bold shrink-0">
                <span className="text-slate-600">
                  {lang === 'ar' ? 'أرباح اليوم: ' : 'Day Profit: '}
                  <strong className="font-mono text-[#1E824C]">
                    {selectedDaySummary.netProfitJod >= 0 ? '+' : ''}
                    {formatJod(selectedDaySummary.netProfitJod, lang)}
                  </strong>
                </span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-600">
                  {lang === 'ar' ? 'الصافي مع الكاش: ' : 'Net with Cash: '}
                  <strong className="font-mono text-[#0B3B68]">
                    {formatJod(selectedDaySummary.netBalanceJod, lang)}
                  </strong>
                </span>
              </div>
            </div>

            {/* Quick Actions for Selected Day */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={!hasPrevDay}
                  onClick={goToPrevDay}
                  className="min-h-[34px] px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title={lang === 'ar' ? 'اليوم المسجل السابق' : 'Previous Recorded Day'}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'اليوم السابق' : 'Prev Day'}</span>
                </button>

                <button
                  type="button"
                  disabled={!hasNextDay}
                  onClick={goToNextDay}
                  className="min-h-[34px] px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  title={lang === 'ar' ? 'اليوم المسجل التالي' : 'Next Recorded Day'}
                >
                  <span>{lang === 'ar' ? 'اليوم التالي' : 'Next Day'}</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDayFilter('all')}
                  className="min-h-[34px] px-3 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#0B3B68] border border-sky-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'إلغاء التحديد وعرض الكل' : 'Clear & Show All'}</span>
                </button>
              </div>

              {canTransfer && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRestoreConfirmDate(selectedDaySummary.dateStr)}
                    className="min-h-[34px] px-3 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5 text-[#E58E26]" />
                    <span>{lang === 'ar' ? 'إرجاع اليوم للنشط' : 'Restore Day'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4 KPI Summary Cards for Advanced Finance */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold gap-2">
            <span className="leading-snug break-words">
              {isDaySelected
                ? (lang === 'ar'
                    ? `مقبوضات صيانة يوم (${selectedDayFilter})`
                    : `Maintenance Revenue (${selectedDayFilter})`)
                : (lang === 'ar'
                    ? 'إجمالي مقبوضات الصيانة المرحّلة'
                    : 'Transferred Maintenance Revenue')}
            </span>
            <TrendingUp className="w-4 h-4 text-[#1E824C] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-extrabold tabular-nums text-[#1E824C] mt-1.5">
            +{formatJod(displayRevenueJod, lang)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isDaySelected
              ? (lang === 'ar'
                  ? `الإجمالي الكلي لجميع الأيام: +${formatJod(totalTransferredRevenueJod, lang)}`
                  : `Overall: +${formatJod(totalTransferredRevenueJod, lang)}`)
              : (lang === 'ar'
                  ? `عدد الفواتير المدفوعة: ${archivedPaidVisits.length}`
                  : `Paid visits: ${archivedPaidVisits.length}`)}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold gap-2">
            <span className="leading-snug break-words">
              {isDaySelected
                ? (lang === 'ar'
                    ? `مصاريف يوم (${selectedDayFilter})`
                    : `Expenses (${selectedDayFilter})`)
                : (lang === 'ar'
                    ? 'إجمالي المصاريف المرحّلة'
                    : 'Transferred Expenses')}
            </span>
            <TrendingDown className="w-4 h-4 text-rose-600 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-extrabold tabular-nums text-rose-600 mt-1.5">
            -{formatJod(displayExpensesJod, lang)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isDaySelected
              ? (lang === 'ar'
                  ? `الإجمالي الكلي لجميع الأيام: -${formatJod(totalTransferredExpensesJod, lang)}`
                  : `Overall: -${formatJod(totalTransferredExpensesJod, lang)}`)
              : (lang === 'ar'
                  ? `عدد حركات المصاريف: ${archivedExpenses.length}`
                  : `Expense records: ${archivedExpenses.length}`)}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold gap-2">
            <span className="leading-snug break-words">
              {isDaySelected
                ? (lang === 'ar'
                    ? `كاش صباح يوم (${selectedDayFilter})`
                    : `Morning Cash (${selectedDayFilter})`)
                : (lang === 'ar'
                    ? 'إجمالي كاش الصباح المرحّل'
                    : 'Transferred Morning Cash')}
            </span>
            <Banknote className="w-4 h-4 text-[#0B3B68] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-mono font-extrabold tabular-nums text-[#0B3B68] mt-1.5">
            {formatJod(displayMorningCashJod, lang)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {isDaySelected
              ? (lang === 'ar'
                  ? `الإجمالي الكلي لجميع الأيام: ${formatJod(totalTransferredMorningCashJod, lang)}`
                  : `Overall: ${formatJod(totalTransferredMorningCashJod, lang)}`)
              : (lang === 'ar'
                  ? `عدد أرصدة الصباح: ${archivedMorningCash.length}`
                  : `Morning cash entries: ${archivedMorningCash.length}`)}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0B3B68] text-white shadow-2xs flex flex-col justify-between gap-2">
          <div>
            <div className="flex items-center justify-between text-xs text-sky-200 font-bold gap-2">
              <span className="leading-snug break-words">
                {isDaySelected
                  ? (lang === 'ar'
                      ? `صافي أرباح يوم (${selectedDayFilter})`
                      : `Net Profit (${selectedDayFilter})`)
                  : (lang === 'ar'
                      ? 'صافي الأرباح (المقبوضات - المصاريف)'
                      : 'Net Profit (Revenue - Expenses)')}
              </span>
              <Wallet className="w-4 h-4 text-amber-300 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-mono font-extrabold tabular-nums text-emerald-300 mt-1.5">
              {displayNetProfitJod >= 0 ? '+' : ''}
              {formatJod(displayNetProfitJod, lang)}
            </div>
            <div className="text-[11px] text-amber-200 font-bold mt-1 leading-snug break-words">
              {isDaySelected
                ? (lang === 'ar'
                    ? `صافي اليوم مع الكاش: ${formatJod(displayBalanceWithMorningJod, lang)}`
                    : `Day total with morning: ${formatJod(displayBalanceWithMorningJod, lang)}`)
                : (lang === 'ar'
                    ? `الرصيد الكلي مع كاش الصباح: ${formatJod(totalBalanceWithMorningJod, lang)}`
                    : `Total with Morning Cash: ${formatJod(totalBalanceWithMorningJod, lang)}`)}
            </div>
          </div>
        </div>
      </div>

      {/* Compact Single-Line Trigger Button for Unpaid Customers Full-Screen List (كبسة فتح قائمة ذمم الزبائن التي لم تدفع على كامل الشاشة بدون أخذ حيز من الصفحة) */}
      <div className="rounded-2xl bg-white border border-slate-200 px-3.5 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
            <Banknote className="w-4 h-4" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs sm:text-sm font-black text-[#0B3B68]">
              {lang === 'ar'
                ? 'قائمة ذمم الزبائن التي لم تدفع'
                : 'Unpaid Customers List'}
            </span>
            <span className="text-xs font-extrabold text-rose-700 bg-rose-50 border border-rose-200/80 px-2.5 py-0.5 rounded-lg font-mono">
              {lang === 'ar'
                ? `${allUnpaidCustomerVisits.length} زبون · ${formatJod(
                    totalUnpaidCustomerJod,
                    lang
                  )}`
                : `${allUnpaidCustomerVisits.length} Customers · ${formatJod(
                    totalUnpaidCustomerJod,
                    lang
                  )}`}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 ms-auto">
          <button
            type="button"
            onClick={() => setIsCliqModalOpen(true)}
            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Smartphone className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              {lang === 'ar'
                ? 'قائمة حساب كلك (CliQ)'
                : 'CliQ Customer Account'}
            </span>
            <span className="font-mono text-xs bg-white/20 px-1.5 py-0.5 rounded text-amber-200">
              +{formatJod(cliqMetrics.totalBalanceJod, lang)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsCustomerPaymentListOpen(true)}
            className="min-h-[36px] px-4 py-1.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
          >
            <Banknote className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              {lang === 'ar'
                ? 'فتح قائمة الزبائن التي لم تدفع'
                : 'Open Unpaid Customers List'}
            </span>
            <span className="font-mono text-xs bg-white/15 px-1.5 py-0.5 rounded text-amber-200">
              {allUnpaidCustomerVisits.length}
            </span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar + Direct Financial Reports Export */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Transaction Type Filter */}
          <div className="space-y-1.5">
            <span className="text-xs font-extrabold text-[#0B3B68] block">
              {lang === 'ar' ? 'نوع الحركة المالية' : 'Transaction Type'}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
              {(
                [
                  { id: 'all', ar: 'الكل', en: 'All' },
                  { id: 'visit_revenue', ar: 'المقبوضات', en: 'Revenue' },
                  { id: 'expense', ar: 'المصاريف', en: 'Expenses' },
                  { id: 'morning_cash', ar: 'كاش الصباح', en: 'Morning' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTxTypeFilter(tab.id)}
                  className={`min-h-[38px] px-2 py-1.5 text-xs font-extrabold rounded-lg transition-colors cursor-pointer text-center leading-snug ${
                    txTypeFilter === tab.id
                      ? 'bg-[#0B3B68] text-white shadow-2xs'
                      : 'bg-white/70 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {lang === 'ar' ? tab.ar : tab.en}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method Filter */}
          <div className="space-y-1.5">
            <span className="text-xs font-extrabold text-[#0B3B68] block">
              {lang === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
              {(
                [
                  { id: 'all', ar: 'الكل', en: 'All' },
                  { id: 'cash', ar: 'كاش', en: 'Cash' },
                  { id: 'check', ar: 'شيك', en: 'Check' },
                  { id: 'cliq', ar: 'كلك CliQ', en: 'CliQ' },
                ] as const
              ).map((pm) => (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setMethodFilter(pm.id)}
                  className={`min-h-[38px] px-2 py-1.5 text-xs font-extrabold rounded-lg transition-colors cursor-pointer text-center leading-snug ${
                    methodFilter === pm.id
                      ? 'bg-[#0B3B68] text-white shadow-2xs'
                      : 'bg-white/70 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {lang === 'ar' ? pm.ar : pm.en}
                </button>
              ))}
            </div>
          </div>

          {/* Search Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="adv-finance-search"
              className="text-xs font-extrabold text-[#0B3B68] block"
            >
              {lang === 'ar'
                ? 'بحث في المالية المتقدمة'
                : 'Search Advanced Finance'}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                id="adv-finance-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? 'ابحث بالبيان، الزبون، القطعة، أو التاريخ...'
                    : 'Search title, customer, part, or date...'
                }
                className="w-full min-h-[44px] ps-9 pe-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grouped Daily Financial Ledgers */}
      {uniqueDates.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 text-center space-y-3 shadow-2xs">
          <Wallet className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="text-xs sm:text-sm font-extrabold text-slate-800">
            {selectedDayFilter !== 'all'
              ? (lang === 'ar'
                  ? `لا توجد حركات مالية مرحّلة لتاريخ (${selectedDayFilter})`
                  : `No transferred financial transactions for (${selectedDayFilter})`)
              : (lang === 'ar'
                  ? 'لا توجد حركات مالية مرحّلة مطابقة للفلتر الحالي'
                  : 'No transferred financial transactions match the current filter')}
          </div>
          {selectedDayFilter !== 'all' && allAvailableDates.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedDayFilter('all')}
                className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-extrabold cursor-pointer shadow-2xs"
              >
                {lang === 'ar'
                  ? `عرض كل الأيام المسجلة (${allAvailableDates.length})`
                  : `Show All Recorded Days (${allAvailableDates.length})`}
              </button>
              <button
                type="button"
                onClick={() => setSelectedDayFilter(allAvailableDates[0])}
                className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#0B3B68] border border-sky-200 text-xs font-extrabold cursor-pointer"
              >
                {lang === 'ar'
                  ? `آخر يوم مسجل (${allAvailableDates[0]})`
                  : `Latest Recorded Day (${allAvailableDates[0]})`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {uniqueDates.map((dateStr) => {
            const dayItems = filteredItems.filter((i) => i.date === dateStr);
            const dayMorningJod = dayItems
              .filter((i) => i.recordType === 'morning_cash')
              .reduce((acc, i) => acc + i.amountJod, 0);
            const dayRevenueJod = dayItems
              .filter((i) => i.recordType === 'visit_revenue')
              .reduce((acc, i) => acc + i.amountJod, 0);
            const dayCashRevenueJod = dayItems
              .filter(
                (i) =>
                  i.recordType === 'visit_revenue' &&
                  (i.rawVisit?.paymentMethod ?? 'cash') === 'cash'
              )
              .reduce((acc, i) => acc + i.amountJod, 0);
            const dayExpensesJod = dayItems
              .filter((i) => i.recordType === 'expense')
              .reduce((acc, i) => acc + i.amountJod, 0);
            const dayCashExpensesJod = dayItems
              .filter(
                (i) =>
                  i.recordType === 'expense' &&
                  (i.rawExpense?.paymentMethod ?? 'cash') === 'cash'
              )
              .reduce((acc, i) => acc + i.amountJod, 0);
            const dayNetBalanceJod =
              dayMorningJod + dayCashRevenueJod - dayCashExpensesJod;

            const dayExpenseItems = dayItems.filter((i) => i.recordType === 'expense');
            const dayFuel = dayExpenseItems
              .filter((i) => i.rawExpense?.category === 'fuel')
              .reduce((acc, i) => acc + i.amountJod, 0);
            const dayCarRepair = dayExpenseItems
              .filter((i) => i.rawExpense?.category === 'car_repair')
              .reduce((acc, i) => acc + i.amountJod, 0);
            const dayParts = dayExpenseItems
              .filter((i) => i.rawExpense?.category === 'parts_purchase')
              .reduce((acc, i) => acc + i.amountJod, 0);
            const dayOther = dayExpenseItems
              .filter((i) => i.rawExpense?.category === 'other')
              .reduce((acc, i) => acc + i.amountJod, 0);

            return (
              <div
                key={dateStr}
                className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Day Financial Summary Header */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col gap-2.5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-[#0B3B68]" />
                      <span className="text-sm sm:text-base font-extrabold text-[#0B3B68]">
                        {getDayName(dateStr, lang)}
                      </span>
                      <span
                        dir="ltr"
                        className="font-mono text-xs sm:text-sm font-extrabold text-slate-800 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200"
                      >
                        {dateStr}
                      </span>
                      <span className="text-xs text-slate-500 font-bold">
                        ({dayItems.length}{' '}
                        {lang === 'ar' ? 'حركة مالية' : 'transactions'})
                      </span>

                      {selectedDayFilter === 'all' && (
                        <button
                          type="button"
                          onClick={() => setSelectedDayFilter(dateStr)}
                          className="min-h-[30px] px-2.5 py-1 rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 text-[#0B3B68] text-xs font-black flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title={lang === 'ar' ? 'التركيز على هذا اليوم فقط وتقليص المساحة' : 'Focus Day Only'}
                        >
                          <Layers className="w-3.5 h-3.5 text-[#0B3B68]" />
                          <span>{lang === 'ar' ? 'عزل اليوم' : 'Focus Day'}</span>
                        </button>
                      )}
                    </div>

                    {/* Day Totals & Actions */}
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                      <span className="text-slate-700">
                        {lang === 'ar' ? 'كاش الصباح: ' : 'Morning: '}
                        <strong className="font-mono text-[#0B3B68]">
                          {formatJod(dayMorningJod, lang)}
                        </strong>
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-700">
                        {lang === 'ar' ? 'المقبوضات: ' : 'Revenue: '}
                        <strong className="font-mono text-[#1E824C]">
                          +{formatJod(dayRevenueJod, lang)}
                        </strong>
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-700">
                        {lang === 'ar' ? 'المصاريف: ' : 'Expenses: '}
                        <strong className="font-mono text-rose-600">
                          -{formatJod(dayExpensesJod, lang)}
                        </strong>
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 font-mono font-extrabold">
                        {lang === 'ar' ? 'أرباح اليوم: ' : 'Day Profit: '}
                        {dayRevenueJod - dayExpensesJod >= 0 ? '+' : ''}
                        {formatJod(dayRevenueJod - dayExpensesJod, lang)}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#0B3B68] text-white font-mono">
                        {lang === 'ar' ? 'صافي اليوم: ' : 'Day Net: '}
                        {formatJod(dayNetBalanceJod, lang)}
                      </span>

                      <span className="min-h-[36px] px-3 py-1 rounded-xl border border-emerald-300 bg-emerald-50 text-[#145A32] text-xs font-black flex items-center gap-1.5 shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#1E824C] shrink-0" />
                        <span>
                          {lang === 'ar'
                            ? 'مرحّل تلقائياً للكاش'
                            : 'Auto-Rolled Over to Cash'}
                        </span>
                      </span>

                      {canTransfer && (
                        <button
                          type="button"
                          onClick={() => {
                            setRestoreConfirmDate(dateStr);
                          }}
                          className="min-h-[36px] px-3 py-1 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5 text-[#E58E26]" />
                          <span>
                            {lang === 'ar' ? 'إرجاع اليوم للنشط' : 'Restore Day'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Day Expenses Distribution Mini-Strip */}
                  {dayExpensesJod > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold pt-1.5 border-t border-slate-200/70">
                      <span className="text-slate-500 font-extrabold flex items-center gap-1">
                        <TrendingDown className="w-3 h-3 text-rose-600" />
                        <span>{lang === 'ar' ? 'توزيع مصاريف اليوم:' : 'Day Expenses:'}</span>
                      </span>
                      {dayFuel > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                          ⛽ {lang === 'ar' ? 'بنزين: ' : 'Fuel: '}{formatJod(dayFuel, lang)}
                        </span>
                      )}
                      {dayCarRepair > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200">
                          🔧 {lang === 'ar' ? 'تصليح سيارة: ' : 'Car Repair: '}{formatJod(dayCarRepair, lang)}
                        </span>
                      )}
                      {dayParts > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-200">
                          📦 {lang === 'ar' ? 'قطع: ' : 'Parts: '}{formatJod(dayParts, lang)}
                        </span>
                      )}
                      {dayOther > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                          🏷️ {lang === 'ar' ? 'أخرى: ' : 'Other: '}{formatJod(dayOther, lang)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Day Transactions List */}
                <div className="divide-y divide-slate-200 p-4 sm:p-5">
                  {dayItems.map((item) => {
                    const pmLabel =
                      item.paymentMethod === 'cash'
                        ? lang === 'ar'
                          ? 'كاش'
                          : 'Cash'
                        : item.paymentMethod === 'check'
                        ? lang === 'ar'
                          ? 'شيك'
                          : 'Check'
                        : lang === 'ar'
                        ? 'كلك (CliQ)'
                        : 'CliQ';

                    return (
                      <div
                        key={`${item.recordType}-${item.id}`}
                        className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors px-2 rounded-xl"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm sm:text-base font-extrabold text-[#0B3B68]">
                              {item.title}
                            </span>
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span
                              className={`text-xs font-bold ${
                                item.recordType === 'expense'
                                  ? 'text-rose-700'
                                  : item.recordType === 'visit_revenue'
                                  ? 'text-[#1E824C]'
                                  : 'text-[#0B3B68]'
                              }`}
                            >
                              {item.categoryLabel}
                            </span>
                            <span className="text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-xs font-semibold text-slate-600">
                              {pmLabel}
                            </span>
                            <span
                              dir="ltr"
                              className="text-xs font-mono text-slate-500"
                            >
                              {item.time}
                            </span>
                          </div>

                          {item.subtitle && (
                            <p className="text-xs sm:text-sm font-semibold text-slate-700">
                              {item.subtitle}
                            </p>
                          )}

                          {item.note && (
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                              <span>{item.note}</span>
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                          <div className="flex items-center justify-between sm:block bg-slate-50/80 sm:bg-transparent px-2.5 py-1 sm:p-0 rounded-lg">
                            <span className="text-2xs font-bold text-slate-500 sm:hidden">
                              {lang === 'ar' ? 'المبلغ:' : 'Amount:'}
                            </span>
                            <span
                              className={`text-sm sm:text-base font-mono font-extrabold tabular-nums ${
                                item.isPositive
                                  ? 'text-[#1E824C]'
                                  : 'text-rose-600'
                              }`}
                            >
                              {item.isPositive ? '+' : '-'}
                              {formatJod(item.amountJod, lang)}
                            </span>
                          </div>

                          <div
                            className={`grid ${
                              canTransfer && canDelete
                                ? 'grid-cols-3'
                                : canTransfer || canDelete
                                ? 'grid-cols-2'
                                : 'grid-cols-1'
                            } sm:flex sm:items-center gap-1.5 w-full sm:w-auto`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (item.rawMorningCash) {
                                  setEditingMorningCash(item.rawMorningCash);
                                } else if (item.rawExpense) {
                                  setEditingExpense(item.rawExpense);
                                } else if (item.rawVisit) {
                                  setEditingVisit(item.rawVisit);
                                }
                              }}
                              aria-label={
                                lang === 'ar'
                                  ? `تعديل ${item.title}`
                                  : `Edit ${item.title}`
                              }
                              className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/90 hover:bg-indigo-100 text-[#0B3B68] text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shadow-2xs"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[#155E95] shrink-0" />
                              <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                            </button>

                            {canTransfer && (
                              <button
                                type="button"
                                onClick={() => {
                                  onRestoreFinanceRecord(
                                    item.recordType,
                                    item.id
                                  );
                                  setStatusBanner(
                                    lang === 'ar'
                                      ? `تم إرجاع "${item.title}" إلى صفحة المالية اليومية النشطة.`
                                      : `Restored "${item.title}" to active Daily Finance.`
                                  );
                                  setTimeout(() => setStatusBanner(''), 4000);
                                }}
                                className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50/90 hover:bg-amber-100 text-amber-900 text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shadow-2xs"
                                title={
                                  lang === 'ar'
                                    ? 'إرجاع هذه الحركة إلى المالية اليومية النشطة'
                                    : 'Restore to active Daily Finance'
                                }
                              >
                                <ArchiveRestore className="w-3.5 h-3.5 text-[#E58E26] shrink-0" />
                                <span>
                                  {lang === 'ar' ? 'إرجاع' : 'Restore'}
                                </span>
                              </button>
                            )}

                            {canDelete && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({
                                    recordType: item.recordType,
                                    id: item.id,
                                    label: `${item.title} (${item.date}) — ${formatJod(
                                      item.amountJod,
                                      lang
                                    )}`,
                                  })
                                }
                                aria-label={
                                  lang === 'ar'
                                    ? `حذف الحركة المالية ${item.title}`
                                    : `Delete financial record ${item.title}`
                                }
                                className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/90 hover:bg-rose-100 text-rose-700 text-[11px] sm:text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shadow-2xs"
                              >
                                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={
          lang === 'ar'
            ? 'تأكيد حذف الحركة المالية من المالية المتقدمة'
            : 'Confirm Deleting Financial Record'
        }
        itemName={deleteTarget?.label || ''}
        lang={lang}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.recordType === 'morning_cash') {
            onDeleteMorningCash(deleteTarget.id);
          } else if (deleteTarget.recordType === 'expense') {
            onDeleteExpense(deleteTarget.id);
          } else {
            onDeleteVisit(deleteTarget.id);
          }
          setDeleteTarget(null);
          setStatusBanner(
            lang === 'ar'
              ? 'تم حذف الحركة المالية بنجاح.'
              : 'Financial record deleted successfully.'
          );
          setTimeout(() => setStatusBanner(''), 4000);
        }}
      />
      {/* Edit Financial Record Modal (Expense or Morning Cash) */}
      {(editingExpense || editingMorningCash) && (
        <EditFinanceRecordModal
          lang={lang}
          isOpen={Boolean(editingExpense || editingMorningCash)}
          onClose={() => {
            setEditingExpense(null);
            setEditingMorningCash(null);
          }}
          mode="edit"
          expenseToEdit={editingExpense}
          morningCashToEdit={editingMorningCash}
          onSaveExpense={(updated) => {
            onSaveExpense?.(updated);
            setEditingExpense(null);
            setStatusBanner(
              lang === 'ar'
                ? 'تم حفظ تعديل الحركة المالية بنجاح.'
                : 'Financial record updated successfully.'
            );
            setTimeout(() => setStatusBanner(''), 4000);
          }}
          onSaveMorningCash={(updated) => {
            onSaveMorningCash?.(updated);
            setEditingMorningCash(null);
            setStatusBanner(
              lang === 'ar'
                ? 'تم حفظ تعديل كاش الصباح بنجاح.'
                : 'Morning cash updated successfully.'
            );
            setTimeout(() => setStatusBanner(''), 4000);
          }}
          expenseTemplates={state.expenseTemplates}
          parts={state.parts}
          currentUserFullName={currentUserFullName}
        />
      )}

      {/* Edit Maintenance Visit Revenue Modal */}
      {editingVisit && (
        <EditDailyMaintenanceModal
          lang={lang}
          visit={editingVisit}
          isOpen={Boolean(editingVisit)}
          onClose={() => setEditingVisit(null)}
          onSave={(updated) => {
            onSaveVisit?.(updated);
            setEditingVisit(null);
            setStatusBanner(
              lang === 'ar'
                ? `تم حفظ تعديل بيانات زيارة «${updated.customerName}» بنجاح.`
                : `Visit for "${updated.customerName}" updated successfully.`
            );
            setTimeout(() => setStatusBanner(''), 4000);
          }}
          customers={state.customers}
          parts={state.parts}
          defaultTechnicianName={currentUserFullName}
        />
      )}

      {/* Complete Financial Report PDF Export & Preview Modal */}
      <FinancialReportPdfModal
        isOpen={isPdfReportOpen}
        onClose={() => {
          setIsPdfReportOpen(false);
          setPdfOpenCalendar(false);
        }}
        lang={lang}
        state={state}
        initialPeriod={pdfReportPeriod}
        initialReferenceDate={
          selectedDayFilter !== 'all' ? selectedDayFilter : undefined
        }
        initialScope="all_combined"
        initialOpenCalendar={pdfOpenCalendar}
        currentUserFullName={currentUserFullName}
      />

      {/* Explicit Financial Transfer Confirmation Modal (تأكيد الترحيل بين المالية اليومية حسب الأيام والتواريخ) */}
      <FinanceTransferConfirmModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        lang={lang}
        state={state}
        defaultDate={selectedDayFilter !== 'all' ? selectedDayFilter : undefined}
        onConfirmTransfer={(options) => {
          setIsTransferModalOpen(false);
          handleExecuteTransferModal(options);
        }}
      />

      {/* Profit Rollover to Morning Cash Confirmation Dialog */}
      {rolloverConfirmTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#1E824C] flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {lang === 'ar'
                    ? 'تأكيد ترحيل صافي الأرباح إلى الكاش الصباحي'
                    : 'Confirm Profit Rollover to Morning Cash'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  {lang === 'ar'
                    ? rolloverConfirmTarget.dateStr
                      ? `هل أنت متأكد من ترحيل صافي أرباح يوم (${rolloverConfirmTarget.dateStr}) بقيمة (${
                          rolloverConfirmTarget.profitJod >= 0 ? '+' : ''
                        }${formatJod(rolloverConfirmTarget.profitJod, lang)}) وإضافتها كرصيد كاش صباحي جديد؟`
                      : `هل أنت متأكد من ترحيل صافي أرباح الأرشيف المالي بقيمة (${
                          rolloverConfirmTarget.profitJod >= 0 ? '+' : ''
                        }${formatJod(rolloverConfirmTarget.profitJod, lang)}) وإضافتها كرصيد كاش صباحي جديد؟`
                    : `Are you sure you want to roll over net profit (${formatJod(
                        rolloverConfirmTarget.profitJod,
                        lang
                      )}) into Morning Cash?`}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'سيتم تسجيل حركة كاش صباحي جديدة بالرصيد المذكور تلقائياً.'
                  : 'A new morning cash record will be added automatically.'}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRolloverConfirmTarget(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer transition-colors"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleExecuteRollover}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white text-xs sm:text-sm font-black cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Wallet className="w-4 h-4 text-emerald-200" />
                <span>{lang === 'ar' ? 'تأكيد الترحيل' : 'Confirm Rollover'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Day Records Confirmation Dialog */}
      {restoreConfirmDate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <ArchiveRestore className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {lang === 'ar'
                    ? 'تأكيد إرجاع حركات اليوم إلى النشطة'
                    : 'Confirm Restore Day Records'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  {lang === 'ar'
                    ? `هل أنت متأكد من إرجاع جميع الحركات المالية المسجلة بتاريخ (${restoreConfirmDate}) من المالية المتقدمة إلى صفحة المالية اليومية النشطة؟`
                    : `Are you sure you want to restore all records for date (${restoreConfirmDate}) back to active daily finance?`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRestoreConfirmDate(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer transition-colors"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleExecuteRestoreDay}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs sm:text-sm font-black cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
              >
                <ArchiveRestore className="w-4 h-4 text-sky-200" />
                <span>{lang === 'ar' ? 'تأكيد الإرجاع للنشط' : 'Confirm Restore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Unpaid Customers Modal (قائمة ذمم الزبائن التي لم تدفع على كامل الشاشة بخط مدمج يتسع لكلام أكثر ويدعم شاشة الهاتف بالكامل) */}
      {isCustomerPaymentListOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 bg-slate-900/75 backdrop-blur-xs p-0 sm:p-3 md:p-5 flex flex-col animate-in fade-in duration-150"
        >
          <div className="w-full h-full max-w-7xl mx-auto bg-white sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 flex flex-col overflow-hidden">
            {/* Compact Full-Screen Modal Header */}
            <div className="bg-[#0B3B68] text-white px-3 sm:px-5 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 border border-white/15 text-amber-300 flex items-center justify-center shrink-0">
                  <Banknote className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xs sm:text-base font-black text-white leading-tight">
                    {lang === 'ar'
                      ? 'قائمة ذمم الزبائن التي لم تدفع'
                      : 'Unpaid Customers Ledger'}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-sky-100/90 mt-0.5 leading-snug">
                    {lang === 'ar'
                      ? 'عند الضغط على «تم الدفع» وتأكيده يُرحّل المبلغ للمالية المتقدمة ويُزال الزبون تلقائياً من القائمة'
                      : 'Confirming payment transfers the amount and removes the customer from this list'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 ms-auto">
                {/* Summary Badges in Header */}
                <div className="flex items-center gap-1.5 sm:gap-2 bg-white/10 border border-white/15 px-2.5 py-1 rounded-xl text-[11px] sm:text-xs">
                  <span className="text-sky-100 font-bold">
                    {lang === 'ar' ? 'العدد:' : 'Count:'}
                  </span>
                  <span className="font-mono font-black text-amber-300">
                    {allUnpaidCustomerVisits.length}
                  </span>
                  <span className="text-white/30">|</span>
                  <span className="text-sky-100 font-bold">
                    {lang === 'ar' ? 'الإجمالي:' : 'Total:'}
                  </span>
                  <span className="font-mono font-black text-rose-300">
                    {formatJod(totalUnpaidCustomerJod, lang)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCustomerPaymentListOpen(false)}
                  className="min-h-[32px] sm:min-h-[36px] px-2.5 sm:px-3.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] sm:text-xs font-black flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{lang === 'ar' ? 'إغلاق' : 'Close'}</span>
                </button>
              </div>
            </div>

            {/* Compact Search & Toolbar Subheader */}
            <div className="bg-slate-50 border-b border-slate-200 px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="relative flex-1 min-w-[190px] max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={customerPaymentSearch}
                  onChange={(e) => setCustomerPaymentSearch(e.target.value)}
                  placeholder={
                    lang === 'ar'
                      ? 'بحث باسم الزبون، رقم الهاتف، العطل، أو التاريخ...'
                      : 'Search by customer name, phone, issue, or date...'
                  }
                  className="w-full h-8 sm:h-9 ps-8 pe-7 rounded-xl border border-slate-300 bg-white text-[11px] sm:text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
                {customerPaymentSearch && (
                  <button
                    type="button"
                    onClick={() => setCustomerPaymentSearch('')}
                    className="absolute top-1/2 -translate-y-1/2 end-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="text-[11px] font-bold text-slate-600">
                {lang === 'ar'
                  ? `عرض ${filteredCustomerPaymentVisits.length} من ${allUnpaidCustomerVisits.length}`
                  : `Showing ${filteredCustomerPaymentVisits.length} of ${allUnpaidCustomerVisits.length}`}
              </div>
            </div>

            {/* Status Banner inside Full-Screen Modal */}
            {statusBanner && (
              <div className="mx-3 sm:mx-5 mt-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] sm:text-xs font-bold text-emerald-900 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{statusBanner}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusBanner('')}
                  className="text-[11px] text-emerald-700 hover:underline font-bold cursor-pointer ms-2"
                >
                  {lang === 'ar' ? 'إخفاء' : 'Dismiss'}
                </button>
              </div>
            )}

            {/* Full-Screen Scrollable Unpaid Customers List */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-slate-50/60">
              {filteredCustomerPaymentVisits.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-5 bg-white rounded-2xl border border-slate-200">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#1E824C] flex items-center justify-center mb-2.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <p className="text-xs sm:text-sm font-black text-slate-800">
                    {lang === 'ar'
                      ? 'لا يوجد أي زبائن غير مسددين في القائمة حالياً!'
                      : 'No unpaid customers found!'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {lang === 'ar'
                      ? 'جميع الذمم مسددة أو لا توجد نتائج مطابقة للبحث.'
                      : 'All customer balances are settled or no matching search results.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile & Small Screen Full-Detail Compact Cards (يدعم شاشة الهاتف لرؤية كل التفاصيل بخط مدمج وواضح بدون قص الكلام) */}
                  <div className="md:hidden space-y-2">
                    {filteredCustomerPaymentVisits.map((visit, idx) => {
                      const currentDraftAmt =
                        draftVisitAmounts[visit.id] !== undefined
                          ? draftVisitAmounts[visit.id]
                          : String(visit.amountJod ?? 0);
                      const currentMethod =
                        draftVisitMethods[visit.id] || visit.paymentMethod || 'cash';
                      const isAmountModified =
                        draftVisitAmounts[visit.id] !== undefined &&
                        Number(draftVisitAmounts[visit.id]) !== Number(visit.amountJod);

                      return (
                        <div
                          key={visit.id}
                          className="bg-white rounded-xl border border-slate-200 p-2.5 shadow-2xs space-y-1.5"
                        >
                          {/* Row 1: Number + Full Customer Name + Phone + Date */}
                          <div className="flex flex-wrap items-start justify-between gap-1.5">
                            <div className="flex items-start gap-1.5 min-w-0 flex-1">
                              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded bg-slate-100 font-mono text-[10px] font-black text-slate-600 shrink-0">
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-black text-[#0B3B68] whitespace-normal break-words leading-snug">
                                  {visit.customerName}
                                </div>
                                {visit.phone && (
                                  <div
                                    dir="ltr"
                                    className="font-mono text-[11px] font-semibold text-slate-600 mt-0.5 inline-block"
                                  >
                                    {visit.phone}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end shrink-0 text-end">
                              <span
                                dir="ltr"
                                className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded"
                              >
                                {visit.visitDate}
                              </span>
                              {visit.technicianName && (
                                <span className="text-[10px] font-semibold text-slate-500 mt-0.5">
                                  {lang === 'ar' ? `الفني: ${visit.technicianName}` : visit.technicianName}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Row 2: Full Problem / Service Description & Notes (all text visible) */}
                          <div className="bg-slate-50/90 rounded-lg px-2 py-1.5 border border-slate-100 text-[11px] leading-relaxed whitespace-normal break-words">
                            <span className="font-bold text-slate-500 me-1">
                              {lang === 'ar' ? 'الخدمة/العطل:' : 'Issue:'}
                            </span>
                            <span className="font-semibold text-slate-800">
                              {visit.problem || (lang === 'ar' ? 'صيانة' : 'Maintenance')}
                            </span>
                            {visit.note && (
                              <div className="text-[10px] text-slate-600 mt-0.5 pt-0.5 border-t border-slate-200/60 whitespace-normal break-words">
                                <span className="font-bold text-slate-500 me-1">
                                  {lang === 'ar' ? 'ملاحظة:' : 'Note:'}
                                </span>
                                {visit.note}
                              </div>
                            )}
                          </div>

                          {/* Row 3: Compact Amount Input + Method + Mark Paid Button */}
                          <div className="pt-1 flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-lg border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-500">
                                  {lang === 'ar' ? 'المبلغ:' : 'Amt:'}
                                </span>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  dir="ltr"
                                  aria-label={
                                    lang === 'ar'
                                      ? `مبلغ الزبون ${visit.customerName}`
                                      : `Amount for ${visit.customerName}`
                                  }
                                  value={currentDraftAmt}
                                  onChange={(e) =>
                                    setDraftVisitAmounts((prev) => ({
                                      ...prev,
                                      [visit.id]: e.target.value,
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveCustomerVisitAmountOnly(visit);
                                    }
                                  }}
                                  className="w-16 h-6 px-1 rounded bg-white border border-slate-300 font-mono text-[11px] font-black text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-[#0B3B68]"
                                />
                                <span className="text-[10px] font-bold text-slate-600">
                                  {lang === 'ar' ? 'د.أ' : 'JOD'}
                                </span>
                              </div>

                              <select
                                aria-label={
                                  lang === 'ar'
                                    ? `طريقة دفع ${visit.customerName}`
                                    : `Payment method for ${visit.customerName}`
                                }
                                value={currentMethod}
                                onChange={(e) => {
                                  const newPm = e.target.value as PaymentMethod;
                                  setDraftVisitMethods((prev) => ({
                                    ...prev,
                                    [visit.id]: newPm,
                                  }));
                                }}
                                className="h-7 px-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0B3B68] cursor-pointer"
                              >
                                <option value="cash">
                                  {lang === 'ar' ? 'كاش' : 'Cash'}
                                </option>
                                <option value="cliq">
                                  {lang === 'ar' ? 'كلك CliQ' : 'CliQ'}
                                </option>
                                <option value="check">
                                  {lang === 'ar' ? 'شيك' : 'Check'}
                                </option>
                              </select>

                              {isAmountModified && (
                                <button
                                  type="button"
                                  onClick={() => handleSaveCustomerVisitAmountOnly(visit)}
                                  className="h-7 px-2 rounded-lg bg-[#0B3B68] hover:bg-[#155E95] text-white text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                                >
                                  <span>
                                    {lang === 'ar' ? 'حفظ' : 'Save'}
                                  </span>
                                </button>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setConfirmPaidVisitTarget(visit)}
                              className="h-7 px-2.5 rounded-lg bg-[#1E824C] hover:bg-[#145A32] text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer shadow-2xs transition-colors ms-auto"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{lang === 'ar' ? 'تم الدفع' : 'Mark Paid'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop High-Density Table with Smaller Font & Full Multi-line Text Wrapping */}
                  <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-start border-collapse">
                        <thead>
                          <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-black text-slate-700">
                            <th className="py-2 px-2.5 text-start w-10">#</th>
                            <th className="py-2 px-2.5 text-start w-1/4">
                              {lang === 'ar' ? 'اسم الزبون ورقم الهاتف' : 'Customer & Phone'}
                            </th>
                            <th className="py-2 px-2.5 text-start w-1/3">
                              {lang === 'ar' ? 'الخدمة / العطل والملاحظات' : 'Service / Issue & Notes'}
                            </th>
                            <th className="py-2 px-2.5 text-start whitespace-nowrap">
                              {lang === 'ar' ? 'التاريخ والفني' : 'Date & Tech'}
                            </th>
                            <th className="py-2 px-2.5 text-start whitespace-nowrap">
                              {lang === 'ar' ? 'المبلغ (د.أ) وطريقة الدفع' : 'Amount & Method'}
                            </th>
                            <th className="py-2 px-2.5 text-end whitespace-nowrap">
                              {lang === 'ar' ? 'الإجراء' : 'Action'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/80 text-xs">
                          {filteredCustomerPaymentVisits.map((visit, idx) => {
                            const currentDraftAmt =
                              draftVisitAmounts[visit.id] !== undefined
                                ? draftVisitAmounts[visit.id]
                                : String(visit.amountJod ?? 0);
                            const currentMethod =
                              draftVisitMethods[visit.id] || visit.paymentMethod || 'cash';
                            const isAmountModified =
                              draftVisitAmounts[visit.id] !== undefined &&
                              Number(draftVisitAmounts[visit.id]) !== Number(visit.amountJod);

                            return (
                              <tr
                                key={visit.id}
                                className="hover:bg-sky-50/40 transition-colors align-top"
                              >
                                <td className="py-2 px-2.5 font-mono text-[11px] font-bold text-slate-400">
                                  {idx + 1}
                                </td>

                                {/* Customer & Phone (Full text without truncation) */}
                                <td className="py-2 px-2.5">
                                  <div className="font-black text-[#0B3B68] text-xs whitespace-normal break-words leading-snug">
                                    {visit.customerName}
                                  </div>
                                  {visit.phone && (
                                    <div
                                      dir="ltr"
                                      className="font-mono text-[11px] text-slate-500 mt-0.5 inline-block"
                                    >
                                      {visit.phone}
                                    </div>
                                  )}
                                </td>

                                {/* Service / Issue (Full text without truncation) */}
                                <td className="py-2 px-2.5">
                                  <div className="font-semibold text-slate-800 text-xs whitespace-normal break-words leading-snug">
                                    {visit.problem || (lang === 'ar' ? 'صيانة' : 'Maintenance')}
                                  </div>
                                  {visit.note && (
                                    <div className="text-[11px] text-slate-500 mt-0.5 whitespace-normal break-words leading-snug">
                                      {visit.note}
                                    </div>
                                  )}
                                </td>

                                {/* Date & Technician */}
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <div
                                    dir="ltr"
                                    className="font-mono text-[11px] font-bold text-slate-700 inline-block"
                                  >
                                    {visit.visitDate}
                                  </div>
                                  {visit.technicianName && (
                                    <div className="text-[10px] text-slate-500 mt-0.5 whitespace-normal break-words">
                                      {visit.technicianName}
                                    </div>
                                  )}
                                </td>

                                {/* Editable Amount & Method */}
                                <td className="py-2 px-2.5">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-lg border border-slate-200">
                                      <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        dir="ltr"
                                        aria-label={
                                          lang === 'ar'
                                            ? `مبلغ الزبون ${visit.customerName}`
                                            : `Amount for ${visit.customerName}`
                                        }
                                        value={currentDraftAmt}
                                        onChange={(e) =>
                                          setDraftVisitAmounts((prev) => ({
                                            ...prev,
                                            [visit.id]: e.target.value,
                                          }))
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveCustomerVisitAmountOnly(visit);
                                          }
                                        }}
                                        className="w-20 h-7 px-1.5 rounded bg-white border border-slate-300 font-mono text-xs font-black text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                                      />
                                      <span className="text-[10px] font-bold text-slate-600">
                                        {lang === 'ar' ? 'د.أ' : 'JOD'}
                                      </span>
                                    </div>

                                    <select
                                      aria-label={
                                        lang === 'ar'
                                          ? `طريقة دفع ${visit.customerName}`
                                          : `Payment method for ${visit.customerName}`
                                      }
                                      value={currentMethod}
                                      onChange={(e) => {
                                        const newPm = e.target.value as PaymentMethod;
                                        setDraftVisitMethods((prev) => ({
                                          ...prev,
                                          [visit.id]: newPm,
                                        }));
                                      }}
                                      className="h-7 px-2 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0B3B68] cursor-pointer"
                                    >
                                      <option value="cash">
                                        {lang === 'ar' ? 'كاش' : 'Cash'}
                                      </option>
                                      <option value="cliq">
                                        {lang === 'ar' ? 'كلك CliQ' : 'CliQ'}
                                      </option>
                                      <option value="check">
                                        {lang === 'ar' ? 'شيك' : 'Check'}
                                      </option>
                                    </select>

                                    {isAmountModified && (
                                      <button
                                        type="button"
                                        onClick={() => handleSaveCustomerVisitAmountOnly(visit)}
                                        className="h-7 px-2.5 rounded-lg bg-[#0B3B68] hover:bg-[#155E95] text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer shadow-2xs"
                                      >
                                        <span>
                                          {lang === 'ar' ? 'حفظ المبلغ' : 'Save Amt'}
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                </td>

                                {/* Mark Paid Button */}
                                <td className="py-2 px-2.5 text-end whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => setConfirmPaidVisitTarget(visit)}
                                    className="h-7 px-3 rounded-lg bg-[#1E824C] hover:bg-[#145A32] text-white text-[11px] font-black inline-flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>{lang === 'ar' ? 'تم الدفع' : 'Mark Paid'}</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Customer Mark Paid Modal (نافذة تأكيد تم الدفع للزبون وإزالته من القائمة) */}
      {confirmPaidVisitTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 sm:p-5 space-y-3.5">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#1E824C] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  {lang === 'ar'
                    ? 'تأكيد تم الدفع'
                    : 'Confirm Customer Payment'}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed whitespace-normal break-words">
                  {lang === 'ar'
                    ? `هل أنت متأكد من تسجيل دفع الزبون «${confirmPaidVisitTarget.customerName}» وإزالته من قائمة الزبائن التي لم تدفع؟`
                    : `Are you sure you want to mark "${confirmPaidVisitTarget.customerName}" as paid and remove them from the unpaid list?`}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2 text-xs">
                <span className="text-slate-500 font-bold shrink-0">
                  {lang === 'ar' ? 'اسم الزبون:' : 'Customer:'}
                </span>
                <span className="font-black text-slate-900 text-end whitespace-normal break-words">
                  {confirmPaidVisitTarget.customerName}
                </span>
              </div>
              {confirmPaidVisitTarget.problem && (
                <div className="flex items-start justify-between gap-2 text-xs">
                  <span className="text-slate-500 font-bold shrink-0">
                    {lang === 'ar' ? 'الخدمة / العطل:' : 'Service / Issue:'}
                  </span>
                  <span className="font-semibold text-slate-700 text-end whitespace-normal break-words">
                    {confirmPaidVisitTarget.problem}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-200/80">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    {lang === 'ar' ? 'المبلغ المستلم (د.أ)' : 'Amount (JOD)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    dir="ltr"
                    value={
                      draftVisitAmounts[confirmPaidVisitTarget.id] !== undefined
                        ? draftVisitAmounts[confirmPaidVisitTarget.id]
                        : String(confirmPaidVisitTarget.amountJod ?? 0)
                    }
                    onChange={(e) =>
                      setDraftVisitAmounts((prev) => ({
                        ...prev,
                        [confirmPaidVisitTarget.id]: e.target.value,
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-sm font-black font-mono text-slate-900 focus:outline-none focus:border-[#0B3B68]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    {lang === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
                  </label>
                  <select
                    value={
                      draftVisitMethods[confirmPaidVisitTarget.id] ||
                      confirmPaidVisitTarget.paymentMethod ||
                      'cash'
                    }
                    onChange={(e) =>
                      setDraftVisitMethods((prev) => ({
                        ...prev,
                        [confirmPaidVisitTarget.id]: e.target.value as PaymentMethod,
                      }))
                    }
                    className="w-full h-9 px-2 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-[#0B3B68] cursor-pointer"
                  >
                    <option value="cash">{lang === 'ar' ? 'كاش (نقدي)' : 'Cash'}</option>
                    <option value="cliq">{lang === 'ar' ? 'كلك (CliQ)' : 'CliQ'}</option>
                    <option value="check">{lang === 'ar' ? 'شيك' : 'Check'}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setConfirmPaidVisitTarget(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer transition-colors"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleMarkCustomerVisitPaid(confirmPaidVisitTarget);
                  setConfirmPaidVisitTarget(null);
                }}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white text-xs sm:text-sm font-black cursor-pointer shadow-sm transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                <span>
                  {lang === 'ar' ? 'تأكيد تم الدفع' : 'Confirm Paid'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sleek & Compact Carender Calendar Modal Popup (نافذة تقويم Carender المدمجة والجميلة) */}
      {isCalendarModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 sm:p-4 space-y-2.5 max-h-[90vh] overflow-y-auto">
            {/* Compact Modal Header */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 text-[#0B3B68] flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-[#0B3B68]" />
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  {lang === 'ar' ? 'تقويم الأيام (Carender)' : 'Carender Calendar'}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleJumpToToday}
                  className={`min-h-[32px] px-2.5 py-1 rounded-xl text-xs font-black cursor-pointer border transition-colors ${
                    selectedDayFilter === todayStr
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                  }`}
                >
                  {lang === 'ar' ? 'اليوم' : 'Today'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDayFilter('all');
                    setIsCalendarModalOpen(false);
                  }}
                  className={`min-h-[32px] px-2.5 py-1 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    selectedDayFilter === 'all'
                      ? 'bg-sky-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {lang === 'ar' ? 'عرض الكل' : 'Show All'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCalendarModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  title={lang === 'ar' ? 'إغلاق' : 'Close'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Month Navigation & Compact Month Totals */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="min-h-[30px] px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'السابق' : 'Prev'}</span>
                </button>
                <div className="min-h-[30px] px-2.5 py-0.5 rounded-lg bg-sky-50 text-[#0B3B68] border border-sky-200 text-xs font-black flex items-center gap-1">
                  <span>{monthNames[lang][calendarMonth - 1]}</span>
                  <span className="font-mono">{calendarYear}</span>
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="min-h-[30px] px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{lang === 'ar' ? 'التالي' : 'Next'}</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 font-mono">
                  +{formatJod(monthRevenueJod, lang)}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-900 border border-rose-200 font-mono">
                  -{formatJod(monthExpensesJod, lang)}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-sky-50 text-[#0B3B68] border border-sky-200 font-mono">
                  {monthNetProfitJod >= 0 ? '+' : ''}{formatJod(monthNetProfitJod, lang)}
                </span>
              </div>
            </div>

            {/* Quick Recorded Days Strip (لسهولة القفز لأي يوم مسجل بضغطة واحدة) */}
            {daySummaries.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-extrabold text-slate-500">
                  {lang === 'ar' ? `الأيام المسجلة (${daySummaries.length}):` : `Recorded Days (${daySummaries.length}):`}
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {daySummaries.slice(0, 12).map((d) => {
                    const isActive = selectedDayFilter === d.dateStr;
                    return (
                      <button
                        key={d.dateStr}
                        type="button"
                        onClick={() => {
                          const [y, m] = d.dateStr.split('-').map(Number);
                          setCalendarYear(y);
                          setCalendarMonth(m);
                          setSelectedDayFilter(d.dateStr);
                          setIsCalendarModalOpen(false);
                        }}
                        className={`shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-[#0B3B68] text-white border-[#0B3B68] shadow-2xs'
                            : 'bg-slate-50 hover:bg-sky-50 text-slate-800 border-slate-200'
                        }`}
                      >
                        <span className="font-mono" dir="ltr">{d.dateStr}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : d.netProfitJod >= 0
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-rose-100 text-rose-900'
                          }`}
                        >
                          {d.netProfitJod >= 0 ? '+' : ''}{formatJod(d.netProfitJod, lang)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Compact 7-Column Calendar Grid */}
            <div className="space-y-1">
              <div className="grid grid-cols-7 gap-1 text-center">
                {calendarWeekdays.map((wd, i) => (
                  <div
                    key={i}
                    className="py-1 rounded-lg bg-slate-100 text-slate-700 font-black text-[11px] select-none"
                  >
                    {lang === 'ar' ? wd.ar : wd.en}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell) => {
                  const dayStat = daySummariesMap.get(cell.dateStr);
                  const isSelected = selectedDayFilter === cell.dateStr;
                  const isToday = cell.dateStr === todayStr;
                  const hasData = Boolean(dayStat && dayStat.count > 0);

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => {
                        setSelectedDayFilter(cell.dateStr);
                        setIsCalendarModalOpen(false);
                      }}
                      className={`min-h-[48px] sm:min-h-[52px] p-1 sm:p-1.5 rounded-xl text-start transition-all cursor-pointer relative flex flex-col justify-between border ${
                        isSelected
                          ? 'bg-sky-100 border-[#0B3B68] ring-2 ring-[#0B3B68] shadow-2xs'
                          : isToday
                          ? 'border-amber-400 bg-amber-50 hover:bg-amber-100'
                          : hasData
                          ? 'bg-white hover:bg-sky-50 border-slate-200 hover:border-sky-300 shadow-2xs'
                          : cell.isCurrentMonth
                          ? 'bg-slate-50/70 hover:bg-slate-100 border-slate-100 text-slate-400'
                          : 'bg-slate-50/30 border-slate-100 text-slate-300 opacity-35'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs font-black font-mono leading-none ${
                            isSelected
                              ? 'text-[#0B3B68]'
                              : isToday
                              ? 'text-amber-900'
                              : cell.isCurrentMonth
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {cell.dayNum}
                        </span>

                        <div className="flex items-center gap-0.5">
                          {isToday && (
                            <span className="px-1 py-0.2 rounded bg-amber-500 text-white text-[8px] font-black leading-none">
                              {lang === 'ar' ? 'اليوم' : 'Today'}
                            </span>
                          )}
                          {hasData && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                dayStat!.netProfitJod >= 0
                                  ? 'bg-emerald-500'
                                  : 'bg-rose-500'
                              }`}
                              aria-hidden="true"
                            />
                          )}
                        </div>
                      </div>

                      {hasData ? (
                        <div className="w-full overflow-hidden text-[9px] sm:text-[10px] font-bold leading-tight font-mono truncate">
                          <span
                            className={
                              dayStat!.netProfitJod >= 0
                                ? 'text-emerald-700'
                                : 'text-rose-600'
                            }
                          >
                            {dayStat!.netProfitJod >= 0 ? '+' : ''}
                            {Math.round(dayStat!.netProfitJod)}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[9px] text-slate-300 font-mono leading-none">-</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CliQ Customer Account Modal */}
      <CliqAccountModal
        isOpen={isCliqModalOpen}
        onClose={() => setIsCliqModalOpen(false)}
        lang={lang}
        state={state}
        onSaveVisit={onSaveVisit}
        onDeleteVisit={onDeleteVisit}
        currentUserFullName={currentUserFullName}
        canDelete={canDelete}
      />
    </div>
  );
};
