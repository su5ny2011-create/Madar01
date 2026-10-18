import React, { useState } from 'react';
import {
  Banknote,
  Car,
  Cpu,
  Edit3,
  Fuel,
  Plus,
  Receipt,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  Sparkles,
} from 'lucide-react';
import type {
  AppState,
  ExpenseCategory,
  ExpenseRecord,
  ExpenseTemplate,
  Language,
  MorningCashRecord,
  PartItem,
  PaymentMethod,
  ReportPeriod,
} from '../types';
import {
  calculateFinancialSummary,
  formatJod,
  getDayName,
  getTodayStr,
  isDateInRange,
} from '../utils/logic';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface FinanceViewProps {
  lang: Language;
  state: AppState;
  currentUserFullName: string;
  onSaveMorningCash: (record: MorningCashRecord) => void;
  onDeleteMorningCash: (id: string) => void;
  onSaveExpense: (record: ExpenseRecord) => void;
  onDeleteExpense: (id: string) => void;
}

export const FinanceView: React.FC<FinanceViewProps> = ({
  lang,
  state,
  currentUserFullName,
  onSaveMorningCash,
  onDeleteMorningCash,
  onSaveExpense,
  onDeleteExpense,
}) => {
  const [period, setPeriod] = useState<ReportPeriod>('daily');
  const [referenceDate, setReferenceDate] = useState(getTodayStr());
  const [searchQuery, setSearchQuery] = useState('');

  // Morning Cash Form State
  const [editingMcId, setEditingMcId] = useState<string | null>(null);
  const [mcDate, setMcDate] = useState(getTodayStr());
  const [mcAmount, setMcAmount] = useState('');
  const [mcNote, setMcNote] = useState('');

  // Expense Form State
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [expDate, setExpDate] = useState(getTodayStr());
  const [expTime, setExpTime] = useState('10:00');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('fuel');
  const [expTitle, setExpTitle] = useState('');
  const [expPartType, setExpPartType] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaymentMethod, setExpPaymentMethod] = useState<PaymentMethod>('cash');
  const [expNote, setExpNote] = useState('');
  const [expError, setExpError] = useState('');

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'morning_cash' | 'expense';
    id: string;
    label: string;
  } | null>(null);

  const summary = calculateFinancialSummary(state, period, referenceDate);
  const q = searchQuery.trim().toLowerCase();

  const periodExpenses = state.expenses.filter(
    (e) =>
      isDateInRange(e.date, summary.startDate, summary.endDate) &&
      (!q ||
        e.title.toLowerCase().includes(q) ||
        (e.partType || '').toLowerCase().includes(q) ||
        (e.note || '').toLowerCase().includes(q) ||
        e.date.includes(q))
  );
  const periodMorningCash = state.morningCash.filter((m) =>
    isDateInRange(m.date, summary.startDate, summary.endDate)
  );
  const periodPaidVisits = state.visits.filter(
    (v) =>
      v.isPaid &&
      isDateInRange(v.visitDate, summary.startDate, summary.endDate) &&
      (!q ||
        v.customerName.toLowerCase().includes(q) ||
        v.problem.toLowerCase().includes(q) ||
        v.visitDate.includes(q))
  );

  const handleMorningCashSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.max(0, Number(mcAmount) || 0);
    const record: MorningCashRecord = {
      id: editingMcId || `mc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      date: mcDate || getTodayStr(),
      amountJod: amt,
      note: mcNote.trim(),
      recordedBy: currentUserFullName,
    };
    onSaveMorningCash(record);
    setEditingMcId(null);
    setMcAmount('');
    setMcNote('');
  };

  const handleEditMorningCash = (m: MorningCashRecord) => {
    setEditingMcId(m.id);
    setMcDate(m.date);
    setMcAmount(String(m.amountJod));
    setMcNote(m.note || '');
  };

  const applyExpenseTemplate = (tpl: ExpenseTemplate) => {
    setExpCategory(tpl.category);
    setExpTitle(tpl.title);
    setExpAmount(String(tpl.defaultAmountJod));
    if (tpl.partType) setExpPartType(tpl.partType);
    if (tpl.notes) setExpNote(tpl.notes);
    setExpError('');
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExpError('');

    const amt = Number(expAmount);
    if (!expTitle.trim()) {
      setExpError(
        lang === 'ar'
          ? 'يرجى إدخال بيان / وصف المصروف.'
          : 'Please enter the expense description.'
      );
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setExpError(
        lang === 'ar'
          ? 'يرجى إدخال مبلغ صحيح بالدينار الأردني.'
          : 'Please enter a valid amount in JOD.'
      );
      return;
    }
    if (expCategory === 'parts_purchase' && !expPartType.trim()) {
      setExpError(
        lang === 'ar'
          ? 'عند اختيار "شراء قطع" يرجى كتابة نوع القطع المشتراة.'
          : 'Please specify the part type when recording a parts purchase.'
      );
      return;
    }

    const record: ExpenseRecord = {
      id: editingExpId || `exp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      date: expDate || getTodayStr(),
      time: expTime || '10:00',
      category: expCategory,
      title: expTitle.trim(),
      partType: expCategory === 'parts_purchase' ? expPartType.trim() : undefined,
      amountJod: amt,
      paymentMethod: expPaymentMethod,
      note: expNote.trim(),
      recordedBy: currentUserFullName,
    };

    onSaveExpense(record);
    setEditingExpId(null);
    setExpTitle('');
    setExpPartType('');
    setExpAmount('');
    setExpNote('');
  };

  const handleEditExpense = (exp: ExpenseRecord) => {
    setEditingExpId(exp.id);
    setExpDate(exp.date);
    setExpTime(exp.time);
    setExpCategory(exp.category);
    setExpTitle(exp.title);
    setExpPartType(exp.partType || '');
    setExpAmount(String(exp.amountJod));
    setExpPaymentMethod(exp.paymentMethod);
    setExpNote(exp.note || '');
    setExpError('');
  };

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

  return (
    <div className="space-y-6">
      {/* Period Selector & Financial Summary Report Header */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#0B3B68]">
              {lang === 'ar'
                ? 'الإدارة المالية والتقارير (دينار أردني JOD)'
                : 'Financial Management & Reports (JOD)'}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1">
              <span>{lang === 'ar' ? 'الفترة المحسوبة:' : 'Calculated Period:'}</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 font-bold text-[#0B3B68] inline-flex items-center gap-1.5">
                <span>{getDayName(summary.startDate, lang)}</span>
                <span dir="ltr" className="font-mono tabular-nums">
                  {summary.startDate}
                </span>
              </span>
              <span>{lang === 'ar' ? 'إلى' : 'to'}</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 font-bold text-[#0B3B68] inline-flex items-center gap-1.5">
                <span>{getDayName(summary.endDate, lang)}</span>
                <span dir="ltr" className="font-mono tabular-nums">
                  {summary.endDate}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Period Tabs: Daily / Weekly / Monthly / All */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              {(
                [
                  { id: 'daily', ar: 'تقرير يومي', en: 'Daily' },
                  { id: 'weekly', ar: 'تقرير أسبوعي', en: 'Weekly' },
                  { id: 'monthly', ar: 'تقرير شهري', en: 'Monthly' },
                  { id: 'all', ar: 'شامل', en: 'All Time' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeriod(tab.id)}
                  className={`min-h-[40px] px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    period === tab.id
                      ? 'bg-[#0B3B68] text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang === 'ar' ? tab.ar : tab.en}
                </button>
              ))}
            </div>

            <input
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              aria-label={lang === 'ar' ? 'تاريخ التقرير المرجعي' : 'Reference report date'}
              className="min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-mono text-xs sm:text-sm tabular-nums text-slate-900"
            />
          </div>
        </div>

        {/* 4 Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span>{lang === 'ar' ? 'الكاش الصباحي (رصيد الصندوق)' : 'Morning Cash Float'}</span>
              <Wallet className="w-4 h-4 text-[#0B3B68]" />
            </div>
            <div className="text-2xl font-mono font-extrabold tabular-nums text-[#0B3B68] mt-2">
              {formatJod(summary.morningCashJod, lang)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {lang === 'ar'
                ? `عدد سجلات الصباح: ${periodMorningCash.length}`
                : `Morning entries: ${periodMorningCash.length}`}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span>
                {lang === 'ar'
                  ? 'مقبوضات الصيانة (مرحّلة تلقائياً)'
                  : 'Paid Maintenance Revenue'}
              </span>
              <TrendingUp className="w-4 h-4 text-[#1E824C]" />
            </div>
            <div className="text-2xl font-mono font-extrabold tabular-nums text-[#1E824C] mt-2">
              {formatJod(summary.totalRevenueJod, lang)}
            </div>
            <div className="text-[11px] text-slate-600 mt-1 font-mono tabular-nums">
              {lang === 'ar'
                ? `كاش: ${summary.revenueByMethod.cash} · شيك: ${summary.revenueByMethod.check} · كلك: ${summary.revenueByMethod.cliq}`
                : `Cash: ${summary.revenueByMethod.cash} · Check: ${summary.revenueByMethod.check} · CliQ: ${summary.revenueByMethod.cliq}`}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600">
              <span>{lang === 'ar' ? 'إجمالي المصاريف' : 'Total Expenses'}</span>
              <TrendingDown className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-mono font-extrabold tabular-nums text-rose-600 mt-2">
              {formatJod(summary.totalExpensesJod, lang)}
            </div>
            <div className="text-[11px] text-slate-600 mt-1 font-mono tabular-nums">
              {lang === 'ar'
                ? `بنزين: ${summary.expensesByCategory.fuel} · سيارة: ${summary.expensesByCategory.car_repair} · قطع: ${summary.expensesByCategory.parts_purchase}`
                : `Fuel: ${summary.expensesByCategory.fuel} · Car: ${summary.expensesByCategory.car_repair} · Parts: ${summary.expensesByCategory.parts_purchase}`}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0B3B68] text-white">
            <div className="flex items-center justify-between text-xs font-bold text-sky-200">
              <span>
                {lang === 'ar' ? 'صافي الكاش الفعلي بالصندوق' : 'Net Cash in Drawer'}
              </span>
              <Banknote className="w-4 h-4 text-[#E58E26]" />
            </div>
            <div className="text-2xl font-mono font-extrabold tabular-nums text-white mt-2">
              {formatJod(summary.netCashDrawerJod, lang)}
            </div>
            <div className="text-[11px] text-amber-300 mt-1 font-mono tabular-nums">
              {lang === 'ar'
                ? `الرصيد الكلي (شامل الشيك/كلك): ${formatJod(summary.totalBalanceWithMorningJod, lang)}`
                : `Total Balance (incl. Check/CliQ): ${formatJod(summary.totalBalanceWithMorningJod, lang)}`}
            </div>
          </div>
        </div>
      </div>

      {/* Forms Grid: Morning Cash + Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Morning Cash Form (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#0B3B68] text-white flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-[#0B3B68]">
                {editingMcId
                  ? lang === 'ar'
                    ? 'تعديل كاش الصباح'
                    : 'Edit Morning Cash'
                  : lang === 'ar'
                  ? 'تسجيل كاش الصباح'
                  : 'Record Morning Cash'}
              </h3>
            </div>
            {editingMcId && (
              <button
                type="button"
                onClick={() => {
                  setEditingMcId(null);
                  setMcAmount('');
                  setMcNote('');
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            )}
          </div>

          <form onSubmit={handleMorningCashSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="mc-date"
                className="text-xs font-bold text-slate-700 block"
              >
                {lang === 'ar' ? 'التاريخ' : 'Date'}
              </label>
              <input
                id="mc-date"
                type="date"
                required
                value={mcDate}
                onChange={(e) => setMcDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="mc-amount"
                className="text-xs font-bold text-slate-700 block"
              >
                {lang === 'ar' ? 'مبلغ كاش الصباح (دينار أردني JOD)' : 'Morning Cash Amount (JOD)'}
              </label>
              <input
                id="mc-amount"
                type="number"
                step="0.5"
                min="0"
                required
                value={mcAmount}
                onChange={(e) => setMcAmount(e.target.value)}
                placeholder="100.00"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm font-bold tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="mc-note"
                className="text-xs font-bold text-slate-700 block"
              >
                {lang === 'ar' ? 'ملاحظة' : 'Note'}
              </label>
              <input
                id="mc-note"
                type="text"
                value={mcNote}
                onChange={(e) => setMcNote(e.target.value)}
                placeholder={lang === 'ar' ? 'عهدة الصندوق الصباحية...' : 'Drawer opening cash...'}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {editingMcId
                  ? lang === 'ar'
                    ? 'حفظ تعديل الكاش الصباحي'
                    : 'Update Morning Cash'
                  : lang === 'ar'
                  ? 'إضافة كاش الصباح'
                  : 'Save Morning Cash'}
              </span>
            </button>
          </form>

          {/* Morning Cash Saved List */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <h4 className="text-xs font-bold text-slate-500">
              {lang === 'ar' ? 'سجل كاش الصباح' : 'Morning Cash History'}
            </h4>
            {state.morningCash.slice(0, 5).map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="text-sm font-mono font-extrabold tabular-nums text-[#0B3B68]">
                    {formatJod(m.amountJod, lang)}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                    <span className="font-bold text-slate-700">
                      {getDayName(m.date, lang)}
                    </span>
                    <span
                      dir="ltr"
                      className="font-mono tabular-nums px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700"
                    >
                      {m.date}
                    </span>
                    {m.note ? <span>· {m.note}</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditMorningCash(m)}
                    aria-label={lang === 'ar' ? `تعديل كاش الصباح ${m.date}` : `Edit morning cash ${m.date}`}
                    className="min-h-[38px] min-w-[38px] rounded-lg border border-slate-200 bg-white text-[#0B3B68] hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({
                        type: 'morning_cash',
                        id: m.id,
                        label: `${lang === 'ar' ? 'كاش الصباح' : 'Morning Cash'} (${m.date}) — ${formatJod(m.amountJod, lang)}`,
                      })
                    }
                    aria-label={lang === 'ar' ? `حذف كاش الصباح ${m.date}` : `Delete morning cash ${m.date}`}
                    className="min-h-[38px] min-w-[38px] rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expenses Form (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#E58E26] text-white flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingExpId
                    ? lang === 'ar'
                      ? 'تعديل مصروف'
                      : 'Edit Expense'
                    : lang === 'ar'
                    ? 'تسجيل المصاريف (بنزين / تصليح سيارة / شراء قطع)'
                    : 'Record Expenses (Fuel / Car Repair / Parts Purchase)'}
                </h3>
              </div>
            </div>
            {editingExpId && (
              <button
                type="button"
                onClick={() => {
                  setEditingExpId(null);
                  setExpTitle('');
                  setExpPartType('');
                  setExpAmount('');
                  setExpNote('');
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء التعديل' : 'Cancel Edit'}
              </button>
            )}
          </div>

          {/* 1-Tap Ready-Made Expense Templates */}
          {state.expenseTemplates.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#E58E26]" />
                <span>
                  {lang === 'ar'
                    ? 'مصاريف جاهزة للتعبئة الفورية بلمسة واحدة:'
                    : '1-Tap Ready-Made Expense Templates:'}
                </span>
              </span>
              <div className="flex flex-wrap gap-2">
                {state.expenseTemplates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => applyExpenseTemplate(tpl)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-amber-50/70 hover:bg-amber-100/80 border border-amber-200 text-slate-800 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>{tpl.title}</span>
                    <span className="font-mono text-[#0B3B68] tabular-nums">
                      ({formatJod(tpl.defaultAmountJod, lang)})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {expError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold"
            >
              {expError}
            </div>
          )}

          <form onSubmit={handleExpenseSubmit} className="space-y-4">
            {/* Expense Category Selector: Fuel, Car Repair, Parts Purchase, Other */}
            <div className="space-y-1.5">
              <span className="text-xs sm:text-sm font-bold text-slate-800 block">
                {lang === 'ar' ? 'نوع المصروف *' : 'Expense Category *'}
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'fuel', ar: 'بنزين', en: 'Fuel', icon: Fuel },
                    { id: 'car_repair', ar: 'تصليح سيارة', en: 'Car Repair', icon: Car },
                    { id: 'parts_purchase', ar: 'شراء قطع', en: 'Parts Purchase', icon: Cpu },
                    { id: 'other', ar: 'مصاريف أخرى', en: 'Other', icon: Receipt },
                  ] as const
                ).map((cat) => {
                  const Icon = cat.icon;
                  const active = expCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setExpCategory(cat.id);
                        if (!expTitle) {
                          setExpTitle(lang === 'ar' ? cat.ar : cat.en);
                        }
                      }}
                      className={`min-h-[48px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0B3B68] text-white border-[#0B3B68] shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{lang === 'ar' ? cat.ar : cat.en}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dedicated Part Type Input when "Parts Purchase / شراء قطع" is selected */}
            {expCategory === 'parts_purchase' && (
              <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-2.5">
                <label
                  htmlFor="exp-part-type"
                  className="text-xs sm:text-sm font-bold text-[#0B3B68] block"
                >
                  {lang === 'ar'
                    ? 'كتابة نوع القطع المشتراة * (أو اختر من قائمة القطع أدناه)'
                    : 'Specify Purchased Part Type *'}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {state.parts.map((p: PartItem) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setExpPartType(p.name);
                        if (!expTitle || expTitle === 'شراء قطع') {
                          setExpTitle(`شراء قطع: ${p.name}`);
                        }
                        if (!expAmount) {
                          setExpAmount(String(p.defaultCostJod));
                        }
                      }}
                      className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        expPartType === p.name
                          ? 'bg-[#1E824C] text-white border-[#1E824C]'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-[#0B3B68]'
                      }`}
                    >
                      {p.name} ({formatJod(p.defaultCostJod, lang)})
                    </button>
                  ))}
                </div>
                <input
                  id="exp-part-type"
                  type="text"
                  required
                  value={expPartType}
                  onChange={(e) => setExpPartType(e.target.value)}
                  placeholder={
                    lang === 'ar'
                      ? 'اكتب نوع القطع ومواصفاتها (مثال: SSD 512GB + راوتر TP-Link)...'
                      : 'Write exact part type and model...'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label
                  htmlFor="exp-title"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'بيان / تفاصيل المصروف *' : 'Expense Title / Description *'}
                </label>
                <input
                  id="exp-title"
                  type="text"
                  required
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder={
                    lang === 'ar'
                      ? 'مثال: تعبئة بنزين جولة الصيانة / تصليح بريكات...'
                      : 'e.g. Fuel refill / Brake pad replacement...'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="exp-amount"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'المبلغ (دينار أردني JOD) *' : 'Amount (JOD) *'}
                </label>
                <input
                  id="exp-amount"
                  type="number"
                  step="0.25"
                  min="0.25"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="15.00"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm font-bold tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="exp-date"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'التاريخ' : 'Date'}
                </label>
                <input
                  id="exp-date"
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">
                  {lang === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'cash', ar: 'كاش', en: 'Cash' },
                      { id: 'check', ar: 'شيك', en: 'Check' },
                      { id: 'cliq', ar: 'كلك', en: 'CliQ' },
                    ] as const
                  ).map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setExpPaymentMethod(pm.id)}
                      className={`min-h-[44px] px-2 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        expPaymentMethod === pm.id
                          ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {lang === 'ar' ? pm.ar : pm.en}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="exp-note"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'ملاحظة' : 'Note'}
                </label>
                <input
                  id="exp-note"
                  type="text"
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  placeholder={lang === 'ar' ? 'رقم الفاتورة أو المحطة...' : 'Invoice # or station...'}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[48px] px-5 py-2.5 rounded-xl bg-[#E58E26] hover:bg-[#d17d1b] text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {editingExpId
                  ? lang === 'ar'
                    ? 'حفظ تعديلات المصروف'
                    : 'Save Expense Changes'
                  : lang === 'ar'
                  ? 'إضافة المصروف إلى التقرير المالي'
                  : 'Add Expense to Financial Ledger'}
              </span>
            </button>
          </form>
        </div>
      </div>

      {/* Search Bar for Financial Ledger */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'ابحث في المصاريف أو مقبوضات الصيانة (البيان، نوع القطع، اسم الزبون، التاريخ)...'
                : 'Search expenses or maintenance revenue (title, part type, customer, date)...'
            }
            aria-label={lang === 'ar' ? 'بحث في السجل المالي' : 'Search financial records'}
            className="w-full min-h-[46px] ps-10 pe-4 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
          />
        </div>
      </div>

      {/* Detailed Ledger for Selected Period: Expenses + Auto-Synced Maintenance Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses Log */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900">
              {lang === 'ar'
                ? `سجل المصاريف للفترة (${periodExpenses.length})`
                : `Expenses Log (${periodExpenses.length})`}
            </h3>
            <span className="text-sm font-mono font-bold tabular-nums text-rose-600">
              {formatJod(summary.totalExpensesJod, lang)}
            </span>
          </div>

          {periodExpenses.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              {lang === 'ar'
                ? 'لا توجد مصاريف مسجلة في هذه الفترة.'
                : 'No expenses recorded in this period.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-200">
              {periodExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="py-3.5 flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {exp.title}
                      </span>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span className="text-xs font-bold text-[#0B3B68]">
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
                      <span className="font-semibold">
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
                      {exp.note ? <span>· {exp.note}</span> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-mono font-extrabold tabular-nums text-rose-600">
                      -{formatJod(exp.amountJod, lang)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEditExpense(exp)}
                      aria-label={lang === 'ar' ? `تعديل مصروف ${exp.title}` : `Edit expense ${exp.title}`}
                      className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 bg-white text-[#0B3B68] hover:bg-slate-50 flex items-center justify-center cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          type: 'expense',
                          id: exp.id,
                          label: `${exp.title} (${exp.date}) — ${formatJod(exp.amountJod, lang)}`,
                        })
                      }
                      aria-label={lang === 'ar' ? `حذف مصروف ${exp.title}` : `Delete expense ${exp.title}`}
                      className="min-h-[40px] min-w-[40px] rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Auto-Synced Maintenance Revenue Log */}
        <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {lang === 'ar'
                  ? `مقبوضات الصيانة المرحّلة تلقائياً (${periodPaidVisits.length})`
                  : `Auto-Synced Maintenance Collections (${periodPaidVisits.length})`}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === 'ar'
                  ? 'تُرحّل تلقائياً عند تفعيل "تم الدفع" في شاشة طلبات الصيانة'
                  : 'Automatically synced when visits are marked Paid in Maintenance'}
              </p>
            </div>
            <span className="text-sm font-mono font-bold tabular-nums text-[#1E824C]">
              +{formatJod(summary.totalRevenueJod, lang)}
            </span>
          </div>

          {periodPaidVisits.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              {lang === 'ar'
                ? 'لا توجد مقبوضات صيانة مدفوعة في هذه الفترة.'
                : 'No paid maintenance visits in this period.'}
            </p>
          ) : (
            <div className="divide-y divide-slate-200">
              {periodPaidVisits.map((v) => (
                <div
                  key={v.id}
                  className="py-3.5 flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-[#0B3B68]">
                      {v.customerName}
                    </div>
                    <div className="text-xs text-slate-700">{v.problem}</div>
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
                      <span>·</span>
                      <span className="font-semibold">
                        {v.paymentMethod === 'cash'
                          ? lang === 'ar'
                            ? 'كاش'
                            : 'Cash'
                          : v.paymentMethod === 'check'
                          ? lang === 'ar'
                            ? 'شيك'
                            : 'Check'
                          : lang === 'ar'
                          ? 'كلك (CliQ)'
                          : 'CliQ'}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm font-mono font-extrabold tabular-nums text-[#1E824C] shrink-0">
                    +{formatJod(v.amountJod, lang)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={
          lang === 'ar' ? 'تأكيد حذف السجل المالي' : 'Confirm Financial Record Deletion'
        }
        itemName={deleteTarget?.label || ''}
        lang={lang}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.type === 'morning_cash') {
            onDeleteMorningCash(deleteTarget.id);
          } else {
            onDeleteExpense(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
