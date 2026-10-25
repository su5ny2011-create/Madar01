import React, { useState, useEffect } from 'react';
import {
  Banknote,
  Car,
  CheckCircle2,
  Cpu,
  Fuel,
  Plus,
  Receipt,
  Sparkles,
  Wallet,
  X,
  Edit3,
} from 'lucide-react';
import type {
  ExpenseCategory,
  ExpenseRecord,
  ExpenseTemplate,
  Language,
  MorningCashRecord,
  PartItem,
  PaymentMethod,
} from '../types';
import { formatJod, getTodayStr } from '../utils/logic';

interface EditFinanceRecordModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'expense' | 'morning_cash';
  mode?: 'add' | 'edit';
  expenseToEdit?: ExpenseRecord | null;
  morningCashToEdit?: MorningCashRecord | null;
  onSaveExpense: (exp: ExpenseRecord) => void;
  onSaveMorningCash: (mc: MorningCashRecord) => void;
  expenseTemplates: ExpenseTemplate[];
  parts: PartItem[];
  currentUserFullName: string;
  activeNetProfitJod?: number;
  activeTotalWithMorningJod?: number;
  archivedNetProfitJod?: number;
  onTransferProfitsToMorningCash?: (source: 'active' | 'archived') => void;
}

export const EditFinanceRecordModal: React.FC<EditFinanceRecordModalProps> = ({
  lang,
  isOpen,
  onClose,
  initialTab = 'expense',
  mode = 'add',
  expenseToEdit,
  morningCashToEdit,
  onSaveExpense,
  onSaveMorningCash,
  expenseTemplates,
  parts,
  currentUserFullName,
  activeNetProfitJod = 0,
  activeTotalWithMorningJod = 0,
  archivedNetProfitJod = 0,
  onTransferProfitsToMorningCash,
}) => {
  const [activeTab, setActiveTab] = useState<'expense' | 'morning_cash'>(
    morningCashToEdit ? 'morning_cash' : expenseToEdit ? 'expense' : initialTab
  );

  // Expense fields
  const [expDate, setExpDate] = useState(getTodayStr());
  const [expTime, setExpTime] = useState('10:00');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('fuel');
  const [expTitle, setExpTitle] = useState('');
  const [expPartType, setExpPartType] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expPaymentMethod, setExpPaymentMethod] = useState<PaymentMethod>('cash');
  const [expNote, setExpNote] = useState('');
  const [expError, setExpError] = useState('');

  // Morning Cash fields
  const [mcDate, setMcDate] = useState(getTodayStr());
  const [mcAmount, setMcAmount] = useState('');
  const [mcNote, setMcNote] = useState('');
  const [mcError, setMcError] = useState('');

  // Populate state on open or edit change
  useEffect(() => {
    if (!isOpen) return;

    if (morningCashToEdit) {
      setActiveTab('morning_cash');
      setMcDate(morningCashToEdit.date || getTodayStr());
      setMcAmount(String(morningCashToEdit.amountJod));
      setMcNote(morningCashToEdit.note || '');
      setMcError('');
    } else if (expenseToEdit) {
      setActiveTab('expense');
      setExpDate(expenseToEdit.date || getTodayStr());
      setExpTime(expenseToEdit.time || '10:00');
      setExpCategory(expenseToEdit.category || 'fuel');
      setExpTitle(expenseToEdit.title || '');
      setExpPartType(expenseToEdit.partType || '');
      setExpAmount(String(expenseToEdit.amountJod));
      setExpPaymentMethod(expenseToEdit.paymentMethod || 'cash');
      setExpNote(expenseToEdit.note || '');
      setExpError('');
    } else {
      setActiveTab(initialTab);
      // Reset expense
      setExpDate(getTodayStr());
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setExpTime(`${hh}:${mm}`);
      setExpCategory('fuel');
      setExpTitle('');
      setExpPartType('');
      setExpAmount('');
      setExpPaymentMethod('cash');
      setExpNote('');
      setExpError('');

      // Reset morning cash
      setMcDate(getTodayStr());
      setMcAmount('');
      setMcNote('');
      setMcError('');
    }
  }, [isOpen, expenseToEdit, morningCashToEdit, initialTab]);

  if (!isOpen) return null;

  const isEditMode = mode === 'edit' || Boolean(expenseToEdit || morningCashToEdit);

  const applyTemplate = (tpl: ExpenseTemplate) => {
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
          ? 'عند اختيار "شراء قطع" يرجى كتابة نوع القطع المشتراة أو اختيارها.'
          : 'Please specify the part type when recording a parts purchase.'
      );
      return;
    }

    const record: ExpenseRecord = {
      id: expenseToEdit?.id || `exp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      date: expDate || getTodayStr(),
      time: expTime || '10:00',
      category: expCategory,
      title: expTitle.trim(),
      partType: expCategory === 'parts_purchase' ? expPartType.trim() : undefined,
      amountJod: amt,
      paymentMethod: expPaymentMethod,
      note: expNote.trim(),
      recordedBy: expenseToEdit?.recordedBy || currentUserFullName,
      isArchived: expenseToEdit?.isArchived || false,
      archivedAt: expenseToEdit?.archivedAt,
      autoArchiveExcluded: expenseToEdit?.autoArchiveExcluded,
      linkedPurchaseId: expenseToEdit?.linkedPurchaseId,
      linkedCashAdvanceId: expenseToEdit?.linkedCashAdvanceId,
      profitTransferredToMorningCash: expenseToEdit?.profitTransferredToMorningCash,
    };

    onSaveExpense(record);
    onClose();
  };

  const handleMorningCashSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMcError('');

    const amt = Math.max(0, Number(mcAmount) || 0);
    if (amt <= 0 && !mcAmount) {
      setMcError(
        lang === 'ar'
          ? 'يرجى إدخال مبلغ كاش الصباح (دينار أردني JOD).'
          : 'Please enter the morning cash amount.'
      );
      return;
    }

    const record: MorningCashRecord = {
      id: morningCashToEdit?.id || `mc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      date: mcDate || getTodayStr(),
      amountJod: amt,
      note: mcNote.trim(),
      recordedBy: morningCashToEdit?.recordedBy || currentUserFullName,
      isArchived: morningCashToEdit?.isArchived || false,
      archivedAt: morningCashToEdit?.archivedAt,
      autoArchiveExcluded: morningCashToEdit?.isArchived ? false : true,
    };

    onSaveMorningCash(record);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0B3B68] text-white px-5 sm:px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                activeTab === 'expense'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
              }`}
            >
              {isEditMode ? (
                <Edit3 className="w-5 h-5 text-white" />
              ) : activeTab === 'expense' ? (
                <Receipt className="w-5 h-5 text-amber-300" />
              ) : (
                <Wallet className="w-5 h-5 text-emerald-300" />
              )}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                {isEditMode
                  ? activeTab === 'expense'
                    ? lang === 'ar'
                      ? 'تعديل المصروف'
                      : 'Edit Expense'
                    : lang === 'ar'
                    ? 'تعديل كاش الصباح'
                    : 'Edit Morning Cash'
                  : activeTab === 'expense'
                  ? lang === 'ar'
                    ? 'إضافة مصروف جديد'
                    : 'Record New Expense'
                  : lang === 'ar'
                  ? 'تسجيل كاش الصباح (رصيد الصندوق)'
                  : 'Record Morning Cash'}
              </h3>
              <p className="text-xs text-sky-200">
                {lang === 'ar'
                  ? 'تسجيل الحركات المالية اليومية بدقة وربط تلقائي مع التقارير'
                  : 'Record daily financial entries linked directly to ledger'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher if not locked to single item edit */}
        {!isEditMode && (
          <div className="px-5 sm:px-6 pt-4 pb-1 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('expense')}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'expense'
                  ? 'bg-white text-[#0B3B68] shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Receipt className="w-4 h-4 text-amber-600" />
              <span>{lang === 'ar' ? 'تسجيل مصروف' : 'Expense'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('morning_cash')}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'morning_cash'
                  ? 'bg-white text-[#0B3B68] shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'ar' ? 'كاش الصباح (الصندوق)' : 'Morning Cash'}</span>
            </button>
          </div>
        )}

        {/* Modal Form Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1">
          {activeTab === 'expense' ? (
            <form onSubmit={handleExpenseSubmit} className="space-y-5">
              {/* Ready-Made Expense Templates */}
              {expenseTemplates.length > 0 && !isEditMode && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#E58E26]" />
                    <span>
                      {lang === 'ar'
                        ? 'مصاريف جاهزة للتعبئة الفورية بلمسة واحدة:'
                        : '1-Tap Quick Expense Presets:'}
                    </span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {expenseTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => applyTemplate(tpl)}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
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
                  className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold flex items-center gap-2"
                >
                  <X className="w-4 h-4 shrink-0" />
                  <span>{expError}</span>
                </div>
              )}

              {/* Expense Category Selector */}
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
                        className={`min-h-[46px] px-3 py-2 rounded-xl text-xs font-extrabold border flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#0B3B68] text-white border-[#0B3B68] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{lang === 'ar' ? cat.ar : cat.en}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Part Type Input if Parts Purchase */}
              {expCategory === 'parts_purchase' && (
                <div className="p-4 rounded-2xl bg-sky-50/80 border border-sky-200 space-y-2.5">
                  <label
                    htmlFor="modal-exp-part-type"
                    className="text-xs sm:text-sm font-bold text-[#0B3B68] block"
                  >
                    {lang === 'ar'
                      ? 'نوع القطع المشتراة * (أو اختر من المخزن أدناه)'
                      : 'Specify Purchased Part Type *'}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {parts.map((p: PartItem) => (
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
                        className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
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
                    id="modal-exp-part-type"
                    type="text"
                    required
                    value={expPartType}
                    onChange={(e) => setExpPartType(e.target.value)}
                    placeholder={
                      lang === 'ar'
                        ? 'اكتب نوع القطع ومواصفاتها (مثال: شاشة سامسونج / هارد SSD)...'
                        : 'Write exact part type and model...'
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
                  />
                </div>
              )}

              {/* Title & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label
                    htmlFor="modal-exp-title"
                    className="text-xs font-bold text-slate-700 block"
                  >
                    {lang === 'ar' ? 'بيان / تفاصيل المصروف *' : 'Expense Title *'}
                  </label>
                  <input
                    id="modal-exp-title"
                    type="text"
                    required
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    placeholder={
                      lang === 'ar'
                        ? 'مثال: تعبئة بنزين جولة الصيانة / تصليح بريكات...'
                        : 'e.g. Fuel refill / Brake pad replacement...'
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="modal-exp-amount"
                    className="text-xs font-bold text-slate-700 block"
                  >
                    {lang === 'ar' ? 'المبلغ (دينار أردني JOD) *' : 'Amount (JOD) *'}
                  </label>
                  <input
                    id="modal-exp-amount"
                    type="number"
                    step="0.25"
                    min="0.25"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="15.00"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                  />
                </div>
              </div>

              {/* Date, Time & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="modal-exp-date"
                    className="text-xs font-bold text-slate-700 block"
                  >
                    {lang === 'ar' ? 'التاريخ' : 'Date'}
                  </label>
                  <input
                    id="modal-exp-date"
                    type="date"
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="modal-exp-time"
                    className="text-xs font-bold text-slate-700 block"
                  >
                    {lang === 'ar' ? 'الوقت' : 'Time'}
                  </label>
                  <input
                    id="modal-exp-time"
                    type="time"
                    value={expTime}
                    onChange={(e) => setExpTime(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 block">
                    {lang === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
                  </span>
                  <div className="grid grid-cols-3 gap-1">
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
                        className={`min-h-[44px] px-1 py-1 rounded-xl text-xs font-bold border cursor-pointer ${
                          expPaymentMethod === pm.id
                            ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {lang === 'ar' ? pm.ar : pm.en}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label
                  htmlFor="modal-exp-note"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'ملاحظة (اختياري)' : 'Note (Optional)'}
                </label>
                <input
                  id="modal-exp-note"
                  type="text"
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  placeholder={
                    lang === 'ar'
                      ? 'رقم الفاتورة أو اسم المحطة أو تفاصيل إضافية...'
                      : 'Invoice # or station name...'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs sm:text-sm font-bold cursor-pointer transition-colors"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                >
                  {isEditMode ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <Plus className="w-4 h-4 text-emerald-300" />
                  )}
                  <span>
                    {isEditMode
                      ? lang === 'ar'
                        ? 'حفظ تعديل المصروف'
                        : 'Update Expense'
                      : lang === 'ar'
                      ? 'إضافة المصروف إلى المالية'
                      : 'Add Expense to Ledger'}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleMorningCashSubmit} className="space-y-5">
              {mcError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold flex items-center gap-2"
                >
                  <X className="w-4 h-4 shrink-0" />
                  <span>{mcError}</span>
                </div>
              )}

              {/* Quick Profit Rollover to Morning Cash */}
              {(activeNetProfitJod !== 0 ||
                activeTotalWithMorningJod !== 0 ||
                archivedNetProfitJod !== 0) && (
                <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-2.5">
                  <span className="text-xs font-extrabold text-[#0B3B68] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#1E824C]" />
                    <span>
                      {lang === 'ar'
                        ? 'ترحيل الأرباح والحسابات المالية إلى الكاش الصباحي:'
                        : 'Rollover Profits & Financial Accounts to Morning Cash:'}
                    </span>
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {activeNetProfitJod !== 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onTransferProfitsToMorningCash) {
                            onTransferProfitsToMorningCash('active');
                            onClose();
                          } else {
                            setMcAmount(String(Math.max(0, activeTotalWithMorningJod)));
                            setMcNote(
                              lang === 'ar'
                                ? `رصيد الكاش الصباحي شامل صافي الأرباح (${formatJod(activeNetProfitJod, lang)})`
                                : `Morning cash including net profit (${formatJod(activeNetProfitJod, lang)})`
                            );
                          }
                        }}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>
                          {lang === 'ar'
                            ? `ترحيل أرباح الحسابات الحالية للكاش الصباحي (${activeNetProfitJod >= 0 ? '+' : ''}${formatJod(activeNetProfitJod, lang)})`
                            : `Transfer Active Profits to Morning Cash (${formatJod(activeNetProfitJod, lang)})`}
                        </span>
                      </button>
                    )}

                    {archivedNetProfitJod !== 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onTransferProfitsToMorningCash) {
                            onTransferProfitsToMorningCash('archived');
                            onClose();
                          } else {
                            setMcAmount(String(Math.max(0, archivedNetProfitJod)));
                            setMcNote(
                              lang === 'ar'
                                ? `ترحيل صافي أرباح المالية المتقدمة (${formatJod(archivedNetProfitJod, lang)})`
                                : `Transferred net profit from Advanced Finance (${formatJod(archivedNetProfitJod, lang)})`
                            );
                          }
                        }}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      >
                        <Banknote className="w-3.5 h-3.5 text-amber-300" />
                        <span>
                          {lang === 'ar'
                            ? `ترحيل أرباح الأرشيف للكاش الصباحي (${archivedNetProfitJod >= 0 ? '+' : ''}${formatJod(archivedNetProfitJod, lang)})`
                            : `Transfer Archived Profits to Morning Cash (${formatJod(archivedNetProfitJod, lang)})`}
                        </span>
                      </button>
                    )}

                    {activeNetProfitJod > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMcAmount(String(activeNetProfitJod));
                          setMcNote(
                            lang === 'ar'
                              ? `إيداع صافي الأرباح (${formatJod(activeNetProfitJod, lang)}) في كاش الصباح`
                              : `Deposit net profit (${formatJod(activeNetProfitJod, lang)}) in morning cash`
                          );
                        }}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-100 border border-emerald-300 text-[#145A32] text-xs font-bold transition-colors cursor-pointer"
                      >
                        {lang === 'ar'
                          ? `تعبئة مبلغ الربح فقط (${formatJod(activeNetProfitJod, lang)})`
                          : `Fill Profit Amount (${formatJod(activeNetProfitJod, lang)})`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Amount Suggestion Chips */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-[#1E824C]" />
                  <span>
                    {lang === 'ar'
                      ? 'مبالغ سريعة مقترحة لعهدة الصندوق:'
                      : 'Quick Morning Float Presets:'}
                  </span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {[50, 100, 150, 200, 300].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setMcAmount(String(amt))}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#145A32] text-xs font-mono font-bold transition-colors cursor-pointer"
                    >
                      {formatJod(amt, lang)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="modal-mc-date"
                    className="text-xs font-bold text-slate-700 block"
                  >
                    {lang === 'ar' ? 'التاريخ' : 'Date'}
                  </label>
                  <input
                    id="modal-mc-date"
                    type="date"
                    required
                    value={mcDate}
                    onChange={(e) => setMcDate(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="modal-mc-amount"
                    className="text-xs font-bold text-slate-700 block"
                  >
                    {lang === 'ar'
                      ? 'مبلغ كاش الصباح (دينار أردني JOD) *'
                      : 'Morning Float Amount (JOD) *'}
                  </label>
                  <input
                    id="modal-mc-amount"
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    value={mcAmount}
                    onChange={(e) => setMcAmount(e.target.value)}
                    placeholder="100.00"
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="modal-mc-note"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'ملاحظة (اختياري)' : 'Note (Optional)'}
                </label>
                <input
                  id="modal-mc-note"
                  type="text"
                  value={mcNote}
                  onChange={(e) => setMcNote(e.target.value)}
                  placeholder={
                    lang === 'ar'
                      ? 'عهدة الصندوق الصباحية أو بيان العهدة...'
                      : 'Drawer opening cash note...'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs sm:text-sm font-bold cursor-pointer transition-colors"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                >
                  {isEditMode ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <Plus className="w-4 h-4 text-emerald-300" />
                  )}
                  <span>
                    {isEditMode
                      ? lang === 'ar'
                        ? 'حفظ تعديل كاش الصباح'
                        : 'Update Morning Cash'
                      : lang === 'ar'
                      ? 'تسجيل كاش الصباح'
                      : 'Save Morning Cash'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
