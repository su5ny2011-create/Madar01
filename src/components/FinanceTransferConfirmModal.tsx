import React, { useState, useMemo } from 'react';
import {
  Archive,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  AlertTriangle,
} from 'lucide-react';
import type { AppState, Language } from '../types';
import { formatJod, getDayName, getTodayStr } from '../utils/logic';

interface FinanceTransferConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  state: AppState;
  defaultDate?: string;
  onConfirmTransfer: (options?: { targetDate?: string }) => void;
}

export const FinanceTransferConfirmModal: React.FC<
  FinanceTransferConfirmModalProps
> = ({
  isOpen,
  onClose,
  lang,
  state,
  defaultDate,
  onConfirmTransfer,
}) => {
  const [scope, setScope] = useState<'date' | 'all'>('date');
  const [targetDate, setTargetDate] = useState<string>(
    defaultDate || getTodayStr()
  );

  // Active (unarchived) financial records
  const activeMorningCash = useMemo(
    () => state.morningCash.filter((m) => !m.isArchived),
    [state.morningCash]
  );
  const activeExpenses = useMemo(
    () => state.expenses.filter((e) => !e.isArchived),
    [state.expenses]
  );
  const activeVisits = useMemo(
    () =>
      state.visits.filter(
        (v) => v.isPaid && v.visitType !== 'contract' && !v.isFinanceArchived
      ),
    [state.visits]
  );

  // List of active dates that currently contain unarchived financial records
  const activeDates = useMemo(() => {
    const dates = new Set<string>();
    activeMorningCash.forEach((m) => dates.add(m.date));
    activeExpenses.forEach((e) => dates.add(e.date));
    activeVisits.forEach((v) => dates.add(v.visitDate));
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [activeMorningCash, activeExpenses, activeVisits]);

  // If initial targetDate has no active records, default to the latest active date if available
  React.useEffect(() => {
    if (activeDates.length > 0 && !activeDates.includes(targetDate)) {
      setTargetDate(activeDates[0]);
    }
  }, [activeDates, targetDate]);

  // Calculate items to transfer based on selected scope
  const targetMorningCash = useMemo(() => {
    if (scope === 'all') return activeMorningCash;
    return activeMorningCash.filter((m) => m.date === targetDate);
  }, [scope, targetDate, activeMorningCash]);

  const targetExpenses = useMemo(() => {
    if (scope === 'all') return activeExpenses;
    return activeExpenses.filter((e) => e.date === targetDate);
  }, [scope, targetDate, activeExpenses]);

  const targetVisits = useMemo(() => {
    if (scope === 'all') return activeVisits;
    return activeVisits.filter((v) => v.visitDate === targetDate);
  }, [scope, targetDate, activeVisits]);

  const morningTotal = targetMorningCash.reduce(
    (acc, m) => acc + (Number(m.amountJod) || 0),
    0
  );
  const expensesTotal = targetExpenses.reduce(
    (acc, e) => acc + (Number(e.amountJod) || 0),
    0
  );
  const revenueTotal = targetVisits.reduce(
    (acc, v) => acc + (Number(v.amountJod) || 0),
    0
  );
  const netProfit = revenueTotal - expensesTotal;
  const totalCount =
    targetMorningCash.length + targetExpenses.length + targetVisits.length;

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (totalCount === 0) return;
    if (scope === 'date') {
      onConfirmTransfer({ targetDate });
    } else {
      onConfirmTransfer();
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0B3B68] to-[#155E95] text-white p-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Archive className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3
                id="transfer-confirm-modal-title"
                className="text-base sm:text-lg font-black leading-snug"
              >
                {lang === 'ar'
                  ? 'تأكيد ترحيل الحركات المالية إلى «المالية المتقدمة»'
                  : 'Confirm Financial Transfer to Advanced Finance'}
              </h3>
              <p className="text-xs text-sky-100/90 mt-0.5">
                {lang === 'ar'
                  ? 'اختر الترحيل حسب يوم وتاريخ محدد أو لجميع الأيام النشطة دفعة واحدة'
                  : 'Select transfer by date or all active records'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Scope Selector */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 block">
              {lang === 'ar' ? 'نطاق وتاريخ الترحيل:' : 'Transfer Scope & Date:'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('date')}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-black border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  scope === 'date'
                    ? 'bg-[#0B3B68] text-white border-[#0B3B68] shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>
                  {lang === 'ar' ? 'حسب تاريخ محدد' : 'Specific Date'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setScope('all')}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-black border flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  scope === 'all'
                    ? 'bg-[#0B3B68] text-white border-[#0B3B68] shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>
                  {lang === 'ar'
                    ? `جميع الأيام (${activeDates.length} يوم)`
                    : `All Days (${activeDates.length})`}
                </span>
              </button>
            </div>
          </div>

          {/* Date Picker (if scope is 'date') */}
          {scope === 'date' && (
            <div className="space-y-1.5 p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="confirm-transfer-date"
                  className="text-xs font-black text-[#0B3B68] flex items-center gap-1.5"
                >
                  <Calendar className="w-4 h-4 text-[#0B3B68]" />
                  <span>
                    {lang === 'ar' ? 'حدد التاريخ المراد ترحيله:' : 'Select Target Date:'}
                  </span>
                </label>
                {targetDate && (
                  <span className="text-xs font-bold text-sky-800">
                    {getDayName(targetDate, lang)}
                  </span>
                )}
              </div>

              {activeDates.length > 0 ? (
                <div className="space-y-2 mt-1">
                  <select
                    id="confirm-transfer-date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-sky-300 bg-white text-xs sm:text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                  >
                    {activeDates.map((dStr) => {
                      const count =
                        activeMorningCash.filter((m) => m.date === dStr).length +
                        activeExpenses.filter((e) => e.date === dStr).length +
                        activeVisits.filter((v) => v.visitDate === dStr).length;
                      return (
                        <option key={dStr} value={dStr}>
                          {`📅 ${getDayName(dStr, lang)} (${dStr}) — (${count} حركة نشطة)`}
                        </option>
                      );
                    })}
                  </select>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-bold">
                      {lang === 'ar' ? 'أو أدخل تاريخاً آخر:' : 'Or manual date:'}
                    </span>
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="flex-1 min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              ) : (
                <input
                  id="confirm-transfer-date"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-sky-300 bg-white text-xs sm:text-sm font-mono font-black"
                />
              )}
            </div>
          )}

          {/* Transfer Summary Preview Card */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <span className="text-xs font-black text-slate-700">
                {lang === 'ar'
                  ? 'معاينة الحركات المالية التي سيتم ترحيلها:'
                  : 'Transfer Breakdown Preview:'}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-black ${
                  totalCount > 0
                    ? 'bg-emerald-100 text-emerald-950'
                    : 'bg-rose-100 text-rose-900'
                }`}
              >
                {totalCount} {lang === 'ar' ? 'حركة' : 'records'}
              </span>
            </div>

            {totalCount === 0 ? (
              <div className="py-4 text-center space-y-1 text-slate-500">
                <AlertTriangle className="w-7 h-7 text-amber-500 mx-auto" />
                <p className="text-xs font-black text-slate-700">
                  {lang === 'ar'
                    ? 'لا توجد حركات مالية نشطة في التاريخ المحدد حالياً'
                    : 'No active records found for this date'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {lang === 'ar'
                    ? 'قد تكون الحركات مرحّلة بالفعل أو لم يتم تسجيل حركات في هذا اليوم'
                    : 'Records may already be transferred to Advanced Finance'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                  <span className="flex items-center gap-1.5 text-slate-600 font-bold">
                    <Wallet className="w-3.5 h-3.5 text-[#0B3B68]" />
                    <span>{lang === 'ar' ? 'كاش الصباح:' : 'Morning Cash:'}</span>
                    <span className="text-[10px] text-slate-400">
                      ({targetMorningCash.length})
                    </span>
                  </span>
                  <span className="font-mono font-bold text-[#0B3B68]">
                    {formatJod(morningTotal, lang)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                  <span className="flex items-center gap-1.5 text-slate-600 font-bold">
                    <TrendingUp className="w-3.5 h-3.5 text-[#1E824C]" />
                    <span>
                      {lang === 'ar' ? 'مقبوضات الصيانة:' : 'Maintenance Revenue:'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({targetVisits.length})
                    </span>
                  </span>
                  <span className="font-mono font-bold text-[#1E824C]">
                    +{formatJod(revenueTotal, lang)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-200/50">
                  <span className="flex items-center gap-1.5 text-slate-600 font-bold">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    <span>{lang === 'ar' ? 'المصاريف:' : 'Expenses:'}</span>
                    <span className="text-[10px] text-slate-400">
                      ({targetExpenses.length})
                    </span>
                  </span>
                  <span className="font-mono font-bold text-rose-600">
                    -{formatJod(expensesTotal, lang)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1.5 font-black text-sm">
                  <span className="text-slate-800">
                    {lang === 'ar' ? 'صافي الأرباح المرحّلة:' : 'Net Profit:'}
                  </span>
                  <span
                    className={`font-mono ${
                      netProfit >= 0 ? 'text-[#1E824C]' : 'text-rose-600'
                    }`}
                  >
                    {netProfit >= 0 ? '+' : ''}
                    {formatJod(netProfit, lang)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Safety Notice */}
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-semibold leading-relaxed flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              {lang === 'ar'
                ? 'الحركات ترحل بأمان كامل دون أي ضياع للبيانات إلى صفحة «المالية المتقدمة»، مع إمكانية إرجاع أي حركة أو يوم بالكامل إلى المالية اليومية النشطة لاحقاً بضغطة زر.'
                : 'Records will be safely transferred to Advanced Finance without data loss, and can be restored back anytime.'}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer transition-colors"
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>

          <button
            type="button"
            disabled={totalCount === 0}
            onClick={handleConfirm}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#1E824C] hover:bg-[#145A32] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-sm cursor-pointer transition-colors"
          >
            <Archive className="w-4 h-4" />
            <span>
              {lang === 'ar'
                ? `تأكيد ترحيل (${totalCount}) حركة الآن`
                : `Confirm Transfer (${totalCount}) Now`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
