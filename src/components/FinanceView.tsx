import React, { useState, useEffect, useMemo } from 'react';
import {
  Banknote,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Cpu,
  Edit3,
  Fuel,
  Plus,
  Printer,
  Receipt,
  Search,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import type {
  AppState,
  ExpenseCategory,
  ExpenseRecord,
  Language,
  MaintenanceVisit,
  MorningCashRecord,
  ReportPeriod,
} from '../types';
import {
  calculateCliqAccountMetrics,
  calculateFinancialSummary,
  formatJod,
  getDayName,
  getTodayStr,
  isDateInRange,
} from '../utils/logic';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { EditFinanceRecordModal } from './EditFinanceRecordModal';
import { FinancialReportPdfModal } from './FinancialReportPdfModal';
import { CliqAccountModal } from './CliqAccountModal';

interface FinanceViewProps {
  lang: Language;
  state: AppState;
  currentUserFullName: string;
  onSaveMorningCash: (record: MorningCashRecord) => void;
  onDeleteMorningCash: (id: string) => void;
  onSaveExpense: (record: ExpenseRecord) => void;
  onDeleteExpense: (id: string) => void;
  onSaveVisit?: (visit: MaintenanceVisit) => void;
  onDeleteVisit?: (id: string) => void;
  onOpenAdvancedFinance?: () => void;
  onTransferAllActiveFinance?: (options?: { targetDate?: string }) => number;
  canDelete?: boolean;
  canTransfer?: boolean;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  lang,
  state,
  currentUserFullName,
  onSaveMorningCash,
  onDeleteMorningCash,
  onSaveExpense,
  onDeleteExpense,
  onSaveVisit,
  onDeleteVisit,
  onOpenAdvancedFinance,
  onTransferAllActiveFinance,
  canDelete = true,
  canTransfer = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [financeBanner, setFinanceBanner] = useState('');

  // Live timer for midnight / end-of-day automatic cash rollover countdown
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Modal State for adding/editing financial entries
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);
  const [financeModalTab, setFinanceModalTab] = useState<'expense' | 'morning_cash'>('expense');
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [editingMorningCash, setEditingMorningCash] = useState<MorningCashRecord | null>(null);
  const [isPdfReportOpen, setIsPdfReportOpen] = useState(false);
  const [pdfReportPeriod, setPdfReportPeriod] = useState<ReportPeriod>('daily');
  const [pdfOpenCalendar, setPdfOpenCalendar] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'morning_cash' | 'expense';
    id: string;
    label: string;
  } | null>(null);

  const referenceDate = getTodayStr();

  // CliQ Customer Account Metrics (مفصول عن الكاش)
  const cliqMetrics = useMemo(
    () => calculateCliqAccountMetrics(state, referenceDate),
    [state, referenceDate]
  );
  const [isCliqModalOpen, setIsCliqModalOpen] = useState(false);

  // Active (unarchived) financial state for Daily Finance screen
  const activeFinanceState = useMemo(() => ({
    ...state,
    morningCash: state.morningCash.filter((m) => !m.isArchived),
    expenses: state.expenses.filter((e) => !e.isArchived),
    visits: state.visits.filter((v) => !v.isFinanceArchived),
  }), [state]);

  const summary = useMemo(
    () => calculateFinancialSummary(activeFinanceState, 'all', referenceDate),
    [activeFinanceState, referenceDate]
  );

  const q = searchQuery.trim().toLowerCase();

  // Active counts
  const allActiveMorningCashCount = activeFinanceState.morningCash.length;
  const activeExpensesCount = activeFinanceState.expenses.length;
  const activePaidVisitsCount = activeFinanceState.visits.filter(
    (v) => v.isPaid && v.visitType !== 'contract'
  ).length;
  const totalActiveFinanceCount =
    allActiveMorningCashCount + activeExpensesCount + activePaidVisitsCount;

  const totalTransferredFinanceCount =
    state.morningCash.filter((m) => Boolean(m.isArchived)).length +
    state.expenses.filter((e) => Boolean(e.isArchived)).length +
    state.visits.filter(
      (v) => v.isPaid && v.visitType !== 'contract' && Boolean(v.isFinanceArchived)
    ).length;

  // Filter active lists by search query
  const activeMorningCashList = useMemo(
    () =>
      state.morningCash.filter(
        (m) =>
          !m.isArchived &&
          isDateInRange(m.date, summary.startDate, summary.endDate) &&
          (!q ||
            (m.note || '').toLowerCase().includes(q) ||
            (m.recordedBy || '').toLowerCase().includes(q) ||
            m.date.includes(q))
      ),
    [state.morningCash, summary.startDate, summary.endDate, q]
  );

  const periodExpenses = useMemo(
    () =>
      state.expenses.filter(
        (e) =>
          !e.isArchived &&
          isDateInRange(e.date, summary.startDate, summary.endDate) &&
          (!q ||
            e.title.toLowerCase().includes(q) ||
            (e.partType || '').toLowerCase().includes(q) ||
            (e.note || '').toLowerCase().includes(q) ||
            e.date.includes(q))
      ),
    [state.expenses, summary.startDate, summary.endDate, q]
  );

  const periodPaidVisits = useMemo(
    () =>
      state.visits.filter(
        (v) =>
          v.isPaid &&
          v.visitType !== 'contract' &&
          !v.isFinanceArchived &&
          isDateInRange(v.visitDate, summary.startDate, summary.endDate) &&
          (!q ||
            v.customerName.toLowerCase().includes(q) ||
            v.problem.toLowerCase().includes(q) ||
            v.visitDate.includes(q))
      ),
    [state.visits, summary.startDate, summary.endDate, q]
  );

  // End of Day Countdown Calculation
  const endOfDayCountdown = useMemo(() => {
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diffMs = Math.max(0, midnight.getTime() - now.getTime());
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    return {
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
      totalMinutes: Math.floor(diffMs / (1000 * 60)),
    };
  }, [now]);

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
      ? 'Fuel / Gas'
      : cat === 'car_repair'
      ? 'Car Repair'
      : cat === 'parts_purchase'
      ? 'Parts Purchase'
      : 'Other Expense';
  };

  const openAddExpenseModal = () => {
    setEditingExpense(null);
    setEditingMorningCash(null);
    setFinanceModalTab('expense');
    setIsFinanceModalOpen(true);
  };

  const openAddMorningCashModal = () => {
    setEditingExpense(null);
    setEditingMorningCash(null);
    setFinanceModalTab('morning_cash');
    setIsFinanceModalOpen(true);
  };

  const openEditExpenseModal = (exp: ExpenseRecord) => {
    setEditingExpense(exp);
    setEditingMorningCash(null);
    setFinanceModalTab('expense');
    setIsFinanceModalOpen(true);
  };

  const openEditMorningCashModal = (mc: MorningCashRecord) => {
    setEditingExpense(null);
    setEditingMorningCash(mc);
    setFinanceModalTab('morning_cash');
    setIsFinanceModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Automatic Cash Rollover Notification Card — الترحيل التلقائي إلى الكاش بنهاية اليوم */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-900 via-[#1E824C] to-emerald-800 text-white p-3 sm:p-3.5 shadow-md border border-emerald-500/30 relative overflow-hidden">
        <div className="absolute top-0 end-0 -mt-8 -me-8 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-black shadow-2xs backdrop-blur-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse" />
              {lang === 'ar' ? 'الترحيل التلقائي إلى الكاش: نشط' : 'Auto Rollover: Active'}
            </span>
            <span className="text-emerald-200 text-xs font-extrabold">
              {lang === 'ar'
                ? `اليوم: ${getDayName(referenceDate, lang)} (${referenceDate})`
                : `Today: ${getDayName(referenceDate, lang)} (${referenceDate})`}
            </span>
          </div>

          {/* Live Countdown & Today's Rollover Snapshot */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 shrink-0 bg-black/20 p-3 rounded-2xl border border-white/10 backdrop-blur-xs">
            <div className="text-center px-2 py-1">
              <span className="text-2xs text-emerald-200 block font-bold leading-tight">
                {lang === 'ar' ? 'الوقت حتى الإغلاق والترحيل:' : 'Time Until Auto-Rollover:'}
              </span>
              <div dir="ltr" className="font-mono text-sm sm:text-base font-black text-amber-300 mt-0.5 tracking-wider">
                {endOfDayCountdown.hours}:{endOfDayCountdown.minutes}:{endOfDayCountdown.seconds}
              </div>
            </div>

            <div className="text-center px-2 py-1 border-s border-white/15">
              <span className="text-2xs text-emerald-200 block font-bold leading-tight">
                {lang === 'ar' ? 'صافي أرباح اليوم للترحيل:' : 'Today Net for Rollover:'}
              </span>
              <div className="font-mono text-sm sm:text-base font-black text-white mt-0.5">
                {summary.netProfitJod >= 0 ? '+' : ''}
                {formatJod(summary.netProfitJod, lang)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Banner / Hero Header (Compact & Mobile-Harmonious) */}
      <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0B3B68] via-[#0E4980] to-[#155E95] text-white p-3 sm:p-4 shadow-lg relative overflow-hidden space-y-3">
        <div className="absolute top-0 end-0 -mt-12 -me-12 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-base sm:text-lg lg:text-xl font-extrabold tracking-tight leading-snug">
              {lang === 'ar' ? 'المالية اليومية' : 'Daily Finance'}
            </h1>
          </div>

          {/* Primary Action Buttons: إضافة مصروف + كاش الصباح + تحويل للمالية المتقدمة + حساب كلك */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0">
            <div className="grid grid-cols-3 sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={openAddExpenseModal}
                className="min-h-[40px] px-3 sm:px-4 py-2 rounded-xl bg-white text-[#0B3B68] hover:bg-sky-50 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer text-center"
              >
                <Plus className="w-4 h-4 text-amber-600 stroke-[2.5] shrink-0" />
                <span className="truncate">{lang === 'ar' ? 'إضافة مصروف' : 'New Expense'}</span>
              </button>

              <button
                type="button"
                onClick={openAddMorningCashModal}
                className="min-h-[40px] px-3 sm:px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 border border-white/20 transition-colors cursor-pointer text-center"
              >
                <Wallet className="w-4 h-4 text-emerald-300 shrink-0" />
                <span className="truncate">{lang === 'ar' ? 'كاش الصباح' : 'Morning Cash'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCliqModalOpen(true)}
                className="min-h-[40px] px-3 sm:px-4 py-2 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/40 text-amber-200 text-xs font-extrabold flex items-center justify-center gap-1.5 border border-indigo-300/40 transition-colors cursor-pointer text-center"
              >
                <Smartphone className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="truncate">{lang === 'ar' ? 'حساب كلك (CliQ)' : 'CliQ Account'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Compact Mobile-Friendly KPI Stats Summary (2 cols on phone, 3 on tablet, 6 on desktop) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-3 border-t border-white/15">
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
            <span className="text-[11px] font-extrabold text-sky-200 block leading-tight truncate">
              {lang === 'ar' ? 'كاش الصباح' : 'Morning Cash'}
            </span>
            <span className="text-base sm:text-xl font-black font-mono text-white mt-0.5 block">
              {formatJod(summary.morningCashJod, lang)}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
            <span className="text-[11px] font-extrabold text-emerald-200 block leading-tight truncate">
              {lang === 'ar' ? 'مقبوضات اليوم' : 'Collections'}
            </span>
            <span className="text-base sm:text-xl font-black font-mono text-emerald-300 mt-0.5 block">
              +{formatJod(summary.totalRevenueJod, lang)}
            </span>
            <span className="text-[10px] text-emerald-100/90 block mt-0.5 leading-tight truncate">
              {lang === 'ar'
                ? `كاش: ${summary.revenueByMethod.cash.toFixed(0)} · كلك/شيك: ${(
                    summary.revenueByMethod.cliq + summary.revenueByMethod.check
                  ).toFixed(0)}`
                : `Visits: ${summary.paidVisitsCount}`}
            </span>
          </div>

          {/* Dedicated CliQ Customer Account Box in Daily Finance (مفصول عن الكاش) */}
          <div className="bg-indigo-500/30 backdrop-blur-xs rounded-xl p-2.5 border border-indigo-300/40">
            <span className="text-[11px] font-extrabold text-amber-200 block leading-tight truncate">
              {lang === 'ar' ? 'حساب كلك اليوم' : "Today's CliQ"}
            </span>
            <span className="text-base sm:text-xl font-black font-mono text-white mt-0.5 block">
              +{formatJod(summary.revenueByMethod.cliq, lang)}
            </span>
            <span className="text-[10px] text-indigo-100/90 block mt-0.5 leading-tight truncate">
              {lang === 'ar'
                ? `إجمالي كلك: ${formatJod(cliqMetrics.totalBalanceJod, lang)}`
                : `Total: ${formatJod(cliqMetrics.totalBalanceJod, lang)}`}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
            <span className="text-[11px] font-extrabold text-rose-200 block leading-tight truncate">
              {lang === 'ar' ? 'مصاريف اليوم' : 'Expenses'}
            </span>
            <span className="text-base sm:text-xl font-black font-mono text-rose-300 mt-0.5 block">
              -{formatJod(summary.totalExpensesJod, lang)}
            </span>
            <span className="text-[10px] text-rose-100/90 block mt-0.5 leading-tight truncate">
              {lang === 'ar' ? `الحركات: ${periodExpenses.length}` : `Entries: ${periodExpenses.length}`}
            </span>
          </div>

          <div className="bg-emerald-500/20 backdrop-blur-xs rounded-xl p-2.5 border border-emerald-300/30">
            <span className="text-[11px] font-extrabold text-emerald-200 block leading-tight truncate">
              {lang === 'ar' ? 'صافي أرباح اليوم' : 'Net Profit'}
            </span>
            <span className="text-base sm:text-xl font-black font-mono text-emerald-300 mt-0.5 block">
              {summary.netProfitJod >= 0 ? '+' : ''}
              {formatJod(summary.netProfitJod, lang)}
            </span>
          </div>

          <div className="bg-amber-500/20 backdrop-blur-xs rounded-xl p-2.5 border border-amber-300/30">
            <span className="text-[11px] font-extrabold text-amber-200 block leading-tight truncate">
              {lang === 'ar' ? 'صافي كاش الدرج' : 'Cash Drawer'}
            </span>
            <span className="text-base sm:text-xl font-black font-mono text-amber-300 mt-0.5 block">
              {formatJod(summary.netCashDrawerJod, lang)}
            </span>
            <span className="text-[10px] text-amber-100 block mt-0.5 leading-tight truncate">
              {lang === 'ar'
                ? `كاش فعلي (بدون كلك)`
                : `Cash only (no CliQ)`}
            </span>
          </div>
        </div>
      </div>

      {/* Dedicated CliQ Customer Account Bar — قائمة حساب الزبون كلك */}
      <div className="rounded-2xl bg-white border border-indigo-200 p-3.5 sm:p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-indigo-700" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-[#0B3B68]">
                {lang === 'ar' ? 'قائمة حساب الزبون كلك (CliQ)' : 'CliQ Customer Account List'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] font-black">
                {lang === 'ar' ? 'مفصول عن الكاش' : 'Independent of Cash'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {lang === 'ar'
                ? `إجمالي الرصيد: ${formatJod(cliqMetrics.totalBalanceJod, lang)} · تحويلات اليوم: +${formatJod(cliqMetrics.todayBalanceJod, lang)} (${cliqMetrics.todayTransactionsCount} تحويل)`
                : `Total CliQ Balance: ${formatJod(cliqMetrics.totalBalanceJod, lang)} · Today: +${formatJod(cliqMetrics.todayBalanceJod, lang)}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCliqModalOpen(true)}
          className="min-h-[38px] px-4 py-1.5 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer shadow-xs transition-colors ms-auto"
        >
          <Smartphone className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{lang === 'ar' ? 'فتح قائمة حساب كلك' : 'Open CliQ List'}</span>
          <span className="font-mono text-xs bg-white/20 px-1.5 py-0.5 rounded text-amber-200">
            {cliqMetrics.totalTransactionsCount}
          </span>
        </button>
      </div>

      {/* Success Notification Alert */}
      {financeBanner && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs sm:text-sm font-bold flex flex-wrap items-center justify-between gap-3 shadow-xs animate-in fade-in"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#1E824C] shrink-0" />
            <span className="break-words">{financeBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFinanceBanner('')}
            className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Active Morning Cash Section */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-[#1E824C] flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#0B3B68]">
                {lang === 'ar'
                  ? `الكاش الصباحي وعهدة الصندوق النشطة (${activeMorningCashList.length})`
                  : `Active Morning Cash Float (${activeMorningCashList.length})`}
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-extrabold text-[#0B3B68] bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              {lang === 'ar' ? 'رصيد الصباح: ' : 'Morning Cash: '}
              {formatJod(summary.morningCashJod, lang)}
            </span>
            <span className="text-xs font-mono font-extrabold text-[#1E824C] bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              {lang === 'ar' ? 'مع أرباح اليوم: ' : 'With Profits: '}
              {formatJod(summary.totalBalanceWithMorningJod, lang)}
            </span>
          </div>
        </div>

        {activeMorningCashList.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            {lang === 'ar'
              ? 'لا يوجد كاش صباح مسجل لليوم.'
              : 'No active morning cash recorded.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeMorningCashList.map((m) => {
              const isAutoRollover = (m.note || '').includes('ترحيل تلقائي');
              return (
                <div
                  key={m.id}
                  className="p-4 rounded-2xl border bg-slate-50 border-slate-200 hover:border-emerald-200 transition-all shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-mono font-black tabular-nums text-[#0B3B68]">
                      {formatJod(m.amountJod, lang)}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        isAutoRollover
                          ? 'bg-emerald-100 text-[#145A32] border border-emerald-300'
                          : 'bg-sky-100 text-[#0B3B68]'
                      }`}
                    >
                      {isAutoRollover
                        ? lang === 'ar'
                          ? 'ترحيل تلقائي'
                          : 'Auto-Rollover'
                        : lang === 'ar'
                        ? 'عهدة الصندوق'
                        : 'Opening Float'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="font-bold text-slate-800">{getDayName(m.date, lang)}</span>
                    <span
                      dir="ltr"
                      className="font-mono tabular-nums px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-bold"
                    >
                      {m.date}
                    </span>
                    {m.note && <span className="text-slate-600 break-words font-medium">· {m.note}</span>}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-2.5 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => openEditMorningCashModal(m)}
                      aria-label={
                        lang === 'ar'
                          ? `تعديل كاش الصباح ${m.date}`
                          : `Edit morning cash ${m.date}`
                      }
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50/90 hover:bg-sky-100 text-[#0B3B68] text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#155E95] shrink-0" />
                      <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                    </button>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            type: 'morning_cash',
                            id: m.id,
                            label: `${lang === 'ar' ? 'كاش الصباح' : 'Morning Cash'} (${m.date}) — ${formatJod(m.amountJod, lang)}`,
                          })
                        }
                        aria-label={
                          lang === 'ar'
                            ? `حذف كاش الصباح ${m.date}`
                            : `Delete morning cash ${m.date}`
                        }
                        className="min-h-[38px] px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/90 text-rose-700 hover:bg-rose-100 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shadow-2xs"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Search Toolbar for Expenses & Revenue */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'ابحث في المصاريف أو مقبوضات الصيانة اليومية (البيان، نوع القطع، اسم الزبون، التاريخ)...'
                : 'Search expenses or maintenance collections (title, part type, customer, date)...'
            }
            aria-label={lang === 'ar' ? 'بحث في السجل المالي' : 'Search financial records'}
            className="w-full min-h-[46px] ps-10 pe-10 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Detailed Ledgers Grid: Expenses + Auto-Synced Maintenance Collections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses Log */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-600" />
                <span>
                  {lang === 'ar'
                    ? `سجل مصاريف اليوم (${periodExpenses.length})`
                    : `Today Expenses (${periodExpenses.length})`}
                </span>
              </h3>
            </div>
            <div className="text-end">
              <span className="text-sm font-mono font-black tabular-nums text-rose-600 bg-rose-50 px-3 py-1 rounded-xl border border-rose-200 block">
                -{formatJod(summary.totalExpensesJod, lang)}
              </span>
            </div>
          </div>

          {periodExpenses.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              {lang === 'ar'
                ? 'لا توجد مصاريف مسجلة لليوم.'
                : 'No expenses recorded for today.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {periodExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="py-3.5 px-2 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 transition-colors hover:bg-slate-50"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {exp.title}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 shrink-0">
                        {getCategoryLabel(exp.category)}
                      </span>
                    </div>

                    {exp.partType && (
                      <div className="text-xs font-semibold text-[#145A32]">
                        {lang === 'ar' ? 'نوع القطع: ' : 'Part Type: '}
                        {exp.partType}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                      <span className="font-bold text-slate-700">
                        {getDayName(exp.date, lang)}
                      </span>
                      <span
                        dir="ltr"
                        className="font-mono tabular-nums px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold"
                      >
                        {exp.date}
                      </span>
                      <span
                        dir="ltr"
                        className="font-mono tabular-nums px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
                      >
                        {exp.time}
                      </span>
                      <span>·</span>
                      <span className="font-semibold text-slate-700">
                        {exp.paymentMethod === 'cash'
                          ? lang === 'ar'
                            ? 'كاش'
                            : 'Cash'
                          : exp.paymentMethod === 'check'
                          ? lang === 'ar'
                            ? 'شيك'
                            : 'Check'
                          : 'CliQ'}
                      </span>
                      {exp.note ? <span className="text-slate-500">· {exp.note}</span> : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <span className="text-sm font-mono font-black tabular-nums text-rose-600">
                      -{formatJod(exp.amountJod, lang)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditExpenseModal(exp)}
                        aria-label={
                          lang === 'ar'
                            ? `تعديل مصروف ${exp.title}`
                            : `Edit expense ${exp.title}`
                        }
                        className="min-h-[38px] px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50/90 hover:bg-sky-100 text-[#0B3B68] text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shadow-2xs"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#155E95] shrink-0" />
                        <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                      </button>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              type: 'expense',
                              id: exp.id,
                              label: `${exp.title} (${exp.date}) — ${formatJod(exp.amountJod, lang)}`,
                            })
                          }
                          aria-label={
                            lang === 'ar'
                              ? `حذف مصروف ${exp.title}`
                              : `Delete expense ${exp.title}`
                          }
                          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/90 text-rose-700 hover:bg-rose-100 text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auto-Synced Maintenance Collections Log */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#1E824C]" />
                <span>
                  {lang === 'ar'
                    ? `مقبوضات الصيانة اليوم (${periodPaidVisits.length})`
                    : `Maintenance Collections (${periodPaidVisits.length})`}
                </span>
              </h3>
            </div>
            <span className="text-sm font-mono font-black tabular-nums text-[#1E824C] bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
              +{formatJod(summary.totalRevenueJod, lang)}
            </span>
          </div>

          {periodPaidVisits.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              {lang === 'ar'
                ? 'لا توجد مقبوضات صيانة مدفوعة لليوم.'
                : 'No paid maintenance visits for today.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {periodPaidVisits.map((v) => (
                <div
                  key={v.id}
                  className="py-3.5 px-2 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors hover:bg-slate-50"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#0B3B68] truncate">
                        {v.customerName}
                      </span>
                      <span
                        className={`text-2xs px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          v.paymentMethod === 'cliq'
                            ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {v.paymentMethod === 'cash'
                          ? lang === 'ar'
                            ? 'كاش'
                            : 'Cash'
                          : v.paymentMethod === 'check'
                          ? lang === 'ar'
                            ? 'شيك'
                            : 'Check'
                          : lang === 'ar'
                          ? 'كلك CliQ (حساب كلك)'
                          : 'CliQ'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 truncate">{v.problem}</div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                      <span className="font-bold text-slate-700">
                        {getDayName(v.visitDate, lang)}
                      </span>
                      <span
                        dir="ltr"
                        className="font-mono tabular-nums px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold"
                      >
                        {v.visitDate}
                      </span>
                      {v.visitTime && (
                        <span
                          dir="ltr"
                          className="font-mono tabular-nums px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
                        >
                          {v.visitTime}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <span className="text-sm font-mono font-black tabular-nums text-[#1E824C]">
                      +{formatJod(v.amountJod, lang)}
                    </span>
                    <span className="text-2xs text-slate-400 font-bold">
                      {lang === 'ar' ? 'مزامنة تلقائية' : 'Synced'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        lang={lang}
        title={
          deleteTarget?.type === 'morning_cash'
            ? lang === 'ar'
              ? 'حذف سجل كاش الصباح'
              : 'Delete Morning Cash Record'
            : lang === 'ar'
            ? 'حذف سجل المصروف'
            : 'Delete Expense Record'
        }
        itemName={deleteTarget?.label || ''}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'morning_cash') {
            onDeleteMorningCash(deleteTarget.id);
            setFinanceBanner(
              lang === 'ar'
                ? 'تم حذف سجل كاش الصباح بنجاح.'
                : 'Deleted morning cash record.'
            );
          } else {
            onDeleteExpense(deleteTarget.id);
            setFinanceBanner(
              lang === 'ar'
                ? 'تم حذف سجل المصروف بنجاح.'
                : 'Deleted expense record.'
            );
          }
          setDeleteTarget(null);
          setTimeout(() => setFinanceBanner(''), 3500);
        }}
      />

      {/* Unified Edit/Add Financial Entry Modal */}
      <EditFinanceRecordModal
        isOpen={isFinanceModalOpen}
        onClose={() => {
          setIsFinanceModalOpen(false);
          setEditingExpense(null);
          setEditingMorningCash(null);
        }}
        lang={lang}
        initialTab={financeModalTab}
        mode={editingExpense || editingMorningCash ? 'edit' : 'add'}
        expenseToEdit={editingExpense}
        morningCashToEdit={editingMorningCash}
        expenseTemplates={state.expenseTemplates || []}
        parts={state.parts || []}
        currentUserFullName={currentUserFullName}
        activeNetProfitJod={summary.netProfitJod}
        activeTotalWithMorningJod={summary.totalBalanceWithMorningJod}
        onSaveExpense={(rec) => {
          onSaveExpense(rec);
          setIsFinanceModalOpen(false);
          setEditingExpense(null);
          setFinanceBanner(
            lang === 'ar'
              ? `تم حفظ المصروف بنجاح (${formatJod(rec.amountJod, lang)})`
              : `Saved expense (${formatJod(rec.amountJod, lang)})`
          );
          setTimeout(() => setFinanceBanner(''), 3500);
        }}
        onSaveMorningCash={(mc) => {
          onSaveMorningCash(mc);
          setIsFinanceModalOpen(false);
          setEditingMorningCash(null);
          setFinanceBanner(
            lang === 'ar'
              ? `تم حفظ كاش الصباح بنجاح (${formatJod(mc.amountJod, lang)})`
              : `Saved morning cash (${formatJod(mc.amountJod, lang)})`
          );
          setTimeout(() => setFinanceBanner(''), 3500);
        }}
      />

      {/* Financial Report PDF & WhatsApp Modal (Detailed by Day + Interactive Carender) */}
      <FinancialReportPdfModal
        isOpen={isPdfReportOpen}
        onClose={() => {
          setIsPdfReportOpen(false);
          setPdfOpenCalendar(false);
        }}
        lang={lang}
        state={state}
        initialPeriod={pdfReportPeriod}
        initialScope="all_combined"
        initialOpenCalendar={pdfOpenCalendar}
        currentUserFullName={currentUserFullName}
      />

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
