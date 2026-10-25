import React, { useState, useMemo } from 'react';
import {
  Banknote,
  Calendar,
  CheckCircle2,
  CreditCard,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Wallet,
  X,
} from 'lucide-react';
import type {
  AppState,
  Customer,
  Language,
  MaintenanceVisit,
  PaymentMethod,
} from '../types';
import {
  CLIQ_PAYMENT_INFO,
  formatJod,
  getDayName,
  getTodayStr,
  isVisitUnpaid,
} from '../utils/logic';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface CliqAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  state?: AppState;
  visits?: MaintenanceVisit[];
  customers?: Customer[];
  currentUserFullName?: string;
  onSaveVisit?: (visit: MaintenanceVisit) => void;
  onDeleteVisit?: (id: string) => void;
  canDelete?: boolean;
}

export const CliqAccountModal: React.FC<CliqAccountModalProps> = ({
  isOpen,
  onClose,
  lang,
  state,
  visits,
  customers,
  currentUserFullName = 'مدير النظام',
  onSaveVisit,
  onDeleteVisit,
  canDelete = true,
}) => {
  const actualVisits = visits || state?.visits || [];
  const actualCustomers = customers || state?.customers || [];
  const todayStr = getTodayStr();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUnpaidConvert, setShowUnpaidConvert] = useState(false);
  const [bannerMsg, setBannerMsg] = useState('');

  // Quick Add New Customer CliQ Form State
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newProblem, setNewProblem] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(todayStr);

  // Draft amounts for inline editing
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceVisit | null>(null);
  const [confirmConvertTarget, setConfirmConvertTarget] =
    useState<MaintenanceVisit | null>(null);

  // All customer visits paid via CliQ (حساب الزبون كلك)
  const cliqVisits = useMemo(() => {
    return actualVisits
      .filter((v) => v.isPaid && !v.noPayment && v.paymentMethod === 'cliq')
      .sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''));
  }, [actualVisits]);

  const totalCliqJod = useMemo(
    () =>
      Number(
        cliqVisits
          .reduce((sum, v) => sum + (Number(v.amountJod) || 0), 0)
          .toFixed(2)
      ),
    [cliqVisits]
  );

  const todayCliqVisits = useMemo(
    () => cliqVisits.filter((v) => v.visitDate === todayStr),
    [cliqVisits, todayStr]
  );

  const todayCliqJod = useMemo(
    () =>
      Number(
        todayCliqVisits
          .reduce((sum, v) => sum + (Number(v.amountJod) || 0), 0)
          .toFixed(2)
      ),
    [todayCliqVisits]
  );

  // Unpaid customer visits that can be converted to CliQ with 1 tap
  const unpaidVisits = useMemo(() => {
    return actualVisits
      .filter((v) => isVisitUnpaid(v))
      .sort((a, b) => (b.visitDate || '').localeCompare(a.visitDate || ''));
  }, [actualVisits]);

  const filteredCliqVisits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cliqVisits;
    return cliqVisits.filter((v) => {
      const hay = `${v.customerName} ${v.problem || ''} ${v.phone || ''} ${
        v.visitDate || ''
      } ${v.technicianName || ''} ${v.note || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [cliqVisits, searchQuery]);

  if (!isOpen) return null;

  const handleAddDirectCliqCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveVisit) return;
    const cleanName = newCustomerName.trim();
    if (!cleanName) return;
    const parsedAmt = Math.max(0, Number(newAmount) || 0);
    const cleanAmt = Number(parsedAmt.toFixed(2));
    const matchedCust = actualCustomers.find(
      (c) => c.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    const nowTime = new Date().toTimeString().slice(0, 5) || '10:00';

    const newVisit: MaintenanceVisit = {
      id: `visit-cliq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerName: cleanName,
      phone: newPhone.trim() || matchedCust?.phone || '',
      visitType: 'visit',
      problem:
        newProblem.trim() ||
        (lang === 'ar' ? 'دفعة حساب كلك (CliQ)' : 'CliQ Account Payment'),
      requiredParts: [],
      installedParts: [],
      visitDate: newDate || todayStr,
      visitTime: nowTime,
      isPaid: true,
      noPayment: false,
      amountJod: cleanAmt,
      paymentMethod: 'cliq',
      status: 'resolved',
      isResolved: true,
      isArchived: true,
      archivedAt: todayStr,
      isFinanceArchived: true,
      financeArchivedAt: todayStr,
      profitTransferredToMorningCash: true,
      source: 'staff',
      technicianName: currentUserFullName || 'مدير النظام',
      note:
        lang === 'ar'
          ? 'حساب زبون كلك (CliQ) — مستقل لا يضاف إلى الكاش'
          : 'Customer CliQ account — not added to cash',
      createdAt: new Date().toISOString(),
    };

    onSaveVisit(newVisit);
    setNewCustomerName('');
    setNewPhone('');
    setNewProblem('');
    setNewAmount('');
    setShowAddForm(false);
    setBannerMsg(
      lang === 'ar'
        ? `تمت إضافة حساب الزبون «${cleanName}» بقيمة (${formatJod(
            cleanAmt,
            lang
          )}) إلى قائمة حساب كلك (بدون إضافته للكاش).`
        : `Added "${cleanName}" (${formatJod(cleanAmt, lang)}) to CliQ Account list.`
    );
    setTimeout(() => setBannerMsg(''), 4500);
  };

  const handleConvertUnpaidToCliq = (v: MaintenanceVisit) => {
    if (!onSaveVisit) return;
    const rawStr =
      draftAmounts[v.id] !== undefined
        ? draftAmounts[v.id]
        : String(v.amountJod ?? 0);
    const parsedAmt = Number(rawStr);
    const cleanAmt =
      Number.isFinite(parsedAmt) && parsedAmt >= 0
        ? Number(parsedAmt.toFixed(2))
        : 0;

    onSaveVisit({
      ...v,
      visitType: 'visit',
      amountJod: cleanAmt,
      paymentMethod: 'cliq',
      isPaid: true,
      noPayment: false,
      status: 'resolved',
      isResolved: true,
      isArchived: true,
      archivedAt: v.archivedAt || todayStr,
      isFinanceArchived: true,
      financeArchivedAt: todayStr,
      profitTransferredToMorningCash: true,
    });

    setDraftAmounts((prev) => {
      const next = { ...prev };
      delete next[v.id];
      return next;
    });
    setConfirmConvertTarget(null);
    setBannerMsg(
      lang === 'ar'
        ? `تم حساب الزبون «${v.customerName}» كلك بقيمة (${formatJod(
            cleanAmt,
            lang
          )}) وإضافته إلى قائمة حساب كلك (لا يُضاف للكاش)!`
        : `Converted "${v.customerName}" (${formatJod(
            cleanAmt,
            lang
          )}) to CliQ Account!`
    );
    setTimeout(() => setBannerMsg(''), 4500);
  };

  const handleSaveCliqAmount = (v: MaintenanceVisit) => {
    if (!onSaveVisit) return;
    const rawStr =
      draftAmounts[v.id] !== undefined
        ? draftAmounts[v.id]
        : String(v.amountJod ?? 0);
    const parsedAmt = Number(rawStr);
    const cleanAmt =
      Number.isFinite(parsedAmt) && parsedAmt >= 0
        ? Number(parsedAmt.toFixed(2))
        : 0;

    onSaveVisit({
      ...v,
      amountJod: cleanAmt,
    });

    setDraftAmounts((prev) => {
      const next = { ...prev };
      delete next[v.id];
      return next;
    });
    setBannerMsg(
      lang === 'ar'
        ? `تم تحديث مبلغ حساب كلك للزبون «${v.customerName}» إلى (${formatJod(
            cleanAmt,
            lang
          )}).`
        : `Updated CliQ amount for "${v.customerName}" to ${formatJod(
            cleanAmt,
            lang
          )}.`
    );
    setTimeout(() => setBannerMsg(''), 3500);
  };

  const handleChangePaymentMethod = (
    v: MaintenanceVisit,
    newMethod: PaymentMethod | 'unpaid'
  ) => {
    if (!onSaveVisit) return;
    if (newMethod === 'unpaid') {
      onSaveVisit({
        ...v,
        isPaid: false,
        paymentMethod: 'cash',
      });
      setBannerMsg(
        lang === 'ar'
          ? `تم إرجاع الزبون «${v.customerName}» إلى قائمة الذمم غير المدفوعة.`
          : `Returned "${v.customerName}" to Unpaid Customers.`
      );
    } else {
      onSaveVisit({
        ...v,
        paymentMethod: newMethod,
      });
      setBannerMsg(
        lang === 'ar'
          ? `تم تغيير طريقة دفع الزبون «${v.customerName}» إلى ${
              newMethod === 'cash' ? 'الكاش' : 'شيك'
            }.`
          : `Changed payment method for "${v.customerName}" to ${newMethod}.`
      );
    }
    setTimeout(() => setBannerMsg(''), 3500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex flex-col p-1.5 sm:p-4 animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-6xl mx-auto flex-1 bg-slate-50 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="bg-gradient-to-r from-[#0B3B68] via-[#124B82] to-indigo-900 text-white px-3 py-2.5 sm:px-5 sm:py-3.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-400/20 border border-amber-300/40 text-amber-300 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-xs sm:text-base font-black tracking-tight leading-snug">
                  {lang === 'ar'
                    ? 'قائمة حساب الزبون كلك (CliQ)'
                    : 'Customer CliQ Account List'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                  {lang === 'ar'
                    ? 'مستقل — لا يُضاف إلى الكاش'
                    : 'Separate — Not Added to Cash'}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-sky-200 font-bold mt-0.5">
                {lang === 'ar'
                  ? `كلك المعتمد: ${CLIQ_PAYMENT_INFO.cliqNumber} · ${CLIQ_PAYMENT_INFO.recipientName} (${CLIQ_PAYMENT_INFO.bankName})`
                  : `CliQ: ${CLIQ_PAYMENT_INFO.cliqNumber} · ${CLIQ_PAYMENT_INFO.recipientNameEn}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <div className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-end">
              <span className="text-[9px] sm:text-[10px] text-sky-200 block font-bold leading-none">
                {lang === 'ar' ? 'حساب كلك اليوم' : 'Today CliQ'}
              </span>
              <span className="font-mono text-xs sm:text-sm font-black text-emerald-300">
                {formatJod(todayCliqJod, lang)} ({todayCliqVisits.length})
              </span>
            </div>

            <div className="px-2.5 py-1 rounded-xl bg-amber-400/20 border border-amber-300/40 text-end">
              <span className="text-[9px] sm:text-[10px] text-amber-200 block font-bold leading-none">
                {lang === 'ar' ? 'إجمالي حساب كلك' : 'Total CliQ Account'}
              </span>
              <span className="font-mono text-xs sm:text-sm font-black text-amber-300">
                {formatJod(totalCliqJod, lang)} ({cliqVisits.length})
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[32px] px-2.5 sm:px-3.5 py-1 rounded-xl bg-white/15 hover:bg-rose-600 text-white text-[11px] sm:text-xs font-black flex items-center gap-1 cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'إغلاق' : 'Close'}</span>
            </button>
          </div>
        </div>

        {/* Action & Search Sub-header */}
        <div className="bg-white border-b border-slate-200 px-2.5 py-2 sm:px-5 sm:py-3 space-y-2.5 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? 'ابحث في قائمة حساب كلك (اسم الزبون، الهاتف، البيان، التاريخ)...'
                    : 'Search CliQ account list (customer, phone, service, date)...'
                }
                className="w-full min-h-[36px] ps-8 pe-8 py-1 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute top-1/2 -translate-y-1/2 end-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Action Buttons: Add Customer to CliQ / Convert Unpaid Customer to CliQ */}
            {onSaveVisit && (
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm((prev) => !prev);
                    setShowUnpaidConvert(false);
                  }}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs ${
                    showAddForm
                      ? 'bg-[#0B3B68] text-white'
                      : 'bg-[#1E824C] hover:bg-[#145A32] text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {lang === 'ar'
                      ? 'إضافة حساب زبون كلك'
                      : 'Add CliQ Customer'}
                  </span>
                </button>

                {unpaidVisits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnpaidConvert((prev) => !prev);
                      setShowAddForm(false);
                    }}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors border shadow-2xs ${
                      showUnpaidConvert
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {lang === 'ar'
                        ? `تحويل زبون من الذمم إلى كلك (${unpaidVisits.length})`
                        : `Convert Unpaid to CliQ (${unpaidVisits.length})`}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Banner Message */}
          {bannerMsg && (
            <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-bold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#1E824C] shrink-0" />
                <span className="whitespace-normal break-words">{bannerMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setBannerMsg('')}
                className="text-emerald-700 hover:text-emerald-950 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Collapsible Direct Add Customer CliQ Form */}
          {showAddForm && onSaveVisit && (
            <form
              onSubmit={handleAddDirectCliqCustomer}
              className="p-3 rounded-2xl bg-sky-50/80 border border-sky-200 space-y-2.5 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between text-xs font-black text-[#0B3B68]">
                <span>
                  {lang === 'ar'
                    ? 'تسجيل حساب زبون كلك جديد (يُضاف مباشرة إلى قائمة حساب كلك ولا يُضاف إلى الكاش)'
                    : 'Record New Customer CliQ Payment (Not added to Cash)'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <input
                  type="text"
                  required
                  list="cliq-modal-customers-list"
                  value={newCustomerName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewCustomerName(val);
                    const found = actualCustomers.find(
                      (c) => c.name.toLowerCase() === val.trim().toLowerCase()
                    );
                    if (found?.phone && !newPhone) {
                      setNewPhone(found.phone);
                    }
                  }}
                  placeholder={lang === 'ar' ? 'اسم الزبون *' : 'Customer Name *'}
                  className="min-h-[36px] px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
                <datalist id="cliq-modal-customers-list">
                  {actualCustomers.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>

                <input
                  type="tel"
                  dir="ltr"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder={lang === 'ar' ? 'رقم الهاتف' : 'Phone'}
                  className="min-h-[36px] px-2.5 py-1 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />

                <input
                  type="text"
                  value={newProblem}
                  onChange={(e) => setNewProblem(e.target.value)}
                  placeholder={
                    lang === 'ar'
                      ? 'الخدمة / البيان (مثال: صيانة طابعة)'
                      : 'Service / Description'
                  }
                  className="min-h-[36px] px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />

                <input
                  type="number"
                  required
                  min="0"
                  step="0.5"
                  dir="ltr"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder={lang === 'ar' ? 'المبلغ (د.أ) *' : 'Amount (JOD) *'}
                  className="min-h-[36px] px-2.5 py-1 rounded-xl border border-slate-300 bg-white font-mono text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />

                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    dir="ltr"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="flex-1 min-h-[36px] px-2 py-1 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-800"
                  />
                  <button
                    type="submit"
                    className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white text-xs font-black flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إضافة لكلك' : 'Add'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Collapsible Convert Unpaid Customer to CliQ Panel */}
          {showUnpaidConvert && onSaveVisit && (
            <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2 max-h-56 overflow-y-auto animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-xs font-black text-amber-950">
                <span>
                  {lang === 'ar'
                    ? 'اختر زبوناً لتحويل دفعته إلى «حساب كلك» (يُضاف لقائمة كلك ولا يُضاف للكاش):'
                    : 'Select an unpaid customer to bill via CliQ Account:'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowUnpaidConvert(false)}
                  className="text-amber-800 hover:text-amber-950 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {unpaidVisits.map((uv) => {
                  const curDraft =
                    draftAmounts[uv.id] !== undefined
                      ? draftAmounts[uv.id]
                      : String(uv.amountJod ?? 0);
                  return (
                    <div
                      key={uv.id}
                      className="p-2.5 rounded-xl bg-white border border-amber-200 flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-[#0B3B68] whitespace-normal break-words">
                          {uv.customerName}
                        </div>
                        <div className="text-[11px] text-slate-600 whitespace-normal break-words">
                          {uv.problem} · <span className="font-mono">{uv.visitDate}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          dir="ltr"
                          value={curDraft}
                          onChange={(e) =>
                            setDraftAmounts((prev) => ({
                              ...prev,
                              [uv.id]: e.target.value,
                            }))
                          }
                          className="w-16 h-7 px-1.5 rounded-lg border border-slate-300 font-mono text-xs font-black text-center bg-slate-50"
                        />
                        <button
                          type="button"
                          onClick={() => setConfirmConvertTarget(uv)}
                          className="h-7 px-2.5 rounded-lg bg-[#0B3B68] hover:bg-[#155E95] text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                        >
                          <CreditCard className="w-3 h-3 text-amber-300" />
                          <span>{lang === 'ar' ? 'حساب كلك' : 'CliQ'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Scrollable CliQ Customer Accounts Body */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4">
          {filteredCliqVisits.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center space-y-2.5 shadow-2xs">
              <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-200 text-[#0B3B68] flex items-center justify-center mx-auto">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="text-xs sm:text-sm font-black text-slate-800">
                {searchQuery
                  ? lang === 'ar'
                    ? 'لا توجد نتائج مطابقة للبحث في قائمة حساب كلك'
                    : 'No matching CliQ records found'
                  : lang === 'ar'
                  ? 'لا توجد دفعات زبائن مسجلة في حساب كلك حالياً'
                  : 'No customer payments recorded in CliQ Account yet'}
              </div>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                {lang === 'ar'
                  ? 'عند حساب أي زبون عن طريق كلك (CliQ) في الصيانة أو المالية، يضاف تلقائياً هنا في قائمة حساب كلك ولا يضاف إلى الكاش.'
                  : 'When any customer is billed via CliQ, they are automatically listed here without adding to Cash.'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile & Phone Card Layout (مدعوم للهاتف بخط مدمج وعرض كامل التفاصيل) */}
              <div className="md:hidden space-y-2">
                {filteredCliqVisits.map((visit, idx) => {
                  const currentDraftAmt =
                    draftAmounts[visit.id] !== undefined
                      ? draftAmounts[visit.id]
                      : String(visit.amountJod ?? 0);
                  const isAmountModified =
                    draftAmounts[visit.id] !== undefined &&
                    Number(draftAmounts[visit.id]) !== Number(visit.amountJod ?? 0);

                  return (
                    <div
                      key={visit.id}
                      className="rounded-xl bg-white border border-slate-200/90 p-2.5 shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1.5 min-w-0 flex-1">
                          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-md bg-sky-100 text-[#0B3B68] font-mono text-[10px] font-black shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-black text-[#0B3B68] text-xs leading-snug whitespace-normal break-words">
                              {visit.customerName}
                            </div>
                            {visit.phone && (
                              <div
                                dir="ltr"
                                className="font-mono text-[10px] text-slate-500 leading-tight mt-0.5 inline-block"
                              >
                                {visit.phone}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-end shrink-0">
                          <span className="font-mono text-xs font-black text-[#1E824C] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg block">
                            +{formatJod(visit.amountJod, lang)}
                          </span>
                          <span
                            dir="ltr"
                            className="font-mono text-[10px] font-bold text-slate-500 block mt-0.5"
                          >
                            {visit.visitDate}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] font-semibold text-slate-800 leading-snug whitespace-normal break-words bg-slate-50/80 rounded-lg px-2 py-1 border border-slate-100">
                        {visit.problem || (lang === 'ar' ? 'دفعة كلك' : 'CliQ Payment')}
                        {visit.note && (
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5 whitespace-normal break-words">
                            {visit.note}
                          </div>
                        )}
                      </div>

                      {onSaveVisit && (
                        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-1">
                            <div className="flex items-center gap-0.5 bg-slate-100 px-1.5 py-0.5 rounded-lg border border-slate-200">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                dir="ltr"
                                value={currentDraftAmt}
                                onChange={(e) =>
                                  setDraftAmounts((prev) => ({
                                    ...prev,
                                    [visit.id]: e.target.value,
                                  }))
                                }
                                className="w-16 h-6 px-1 rounded bg-white border border-slate-300 font-mono text-[11px] font-black text-slate-900 text-center"
                              />
                              <span className="text-[9px] font-bold text-slate-600">
                                {lang === 'ar' ? 'د.أ' : 'JOD'}
                              </span>
                            </div>

                            {isAmountModified && (
                              <button
                                type="button"
                                onClick={() => handleSaveCliqAmount(visit)}
                                className="h-6 px-2 rounded-lg bg-[#0B3B68] text-white text-[10px] font-extrabold cursor-pointer"
                              >
                                {lang === 'ar' ? 'حفظ' : 'Save'}
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <select
                              value="cliq"
                              onChange={(e) =>
                                handleChangePaymentMethod(
                                  visit,
                                  e.target.value as PaymentMethod | 'unpaid'
                                )
                              }
                              className="h-6 px-1.5 rounded-lg border border-sky-200 bg-sky-50 text-[10px] font-extrabold text-[#0B3B68] cursor-pointer"
                            >
                              <option value="cliq">
                                {lang === 'ar' ? 'حساب كلك (CliQ)' : 'CliQ'}
                              </option>
                              <option value="cash">
                                {lang === 'ar' ? 'نقل إلى الكاش' : 'Move to Cash'}
                              </option>
                              <option value="unpaid">
                                {lang === 'ar' ? 'إرجاع لذمم غير مدفوعة' : 'Mark Unpaid'}
                              </option>
                            </select>

                            {canDelete && onDeleteVisit && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(visit)}
                                className="h-6 px-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[10px] font-extrabold flex items-center gap-0.5 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden md:block rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-start border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-black text-slate-700">
                        <th className="py-2.5 px-3 text-start w-10">#</th>
                        <th className="py-2.5 px-3 text-start">
                          {lang === 'ar' ? 'اسم الزبون والهاتف' : 'Customer & Phone'}
                        </th>
                        <th className="py-2.5 px-3 text-start">
                          {lang === 'ar' ? 'الخدمة / البيان' : 'Service / Issue'}
                        </th>
                        <th className="py-2.5 px-3 text-start whitespace-nowrap">
                          {lang === 'ar' ? 'التاريخ والفني' : 'Date & Tech'}
                        </th>
                        <th className="py-2.5 px-3 text-start whitespace-nowrap">
                          {lang === 'ar'
                            ? 'مبلغ حساب كلك (لا يضاف للكاش)'
                            : 'CliQ Amount (JOD)'}
                        </th>
                        <th className="py-2.5 px-3 text-end whitespace-nowrap">
                          {lang === 'ar' ? 'إجراءات' : 'Actions'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 text-xs">
                      {filteredCliqVisits.map((visit, idx) => {
                        const currentDraftAmt =
                          draftAmounts[visit.id] !== undefined
                            ? draftAmounts[visit.id]
                            : String(visit.amountJod ?? 0);
                        const isAmountModified =
                          draftAmounts[visit.id] !== undefined &&
                          Number(draftAmounts[visit.id]) !==
                            Number(visit.amountJod ?? 0);

                        return (
                          <tr
                            key={visit.id}
                            className="hover:bg-sky-50/40 transition-colors align-top"
                          >
                            <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3">
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
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-800 text-xs whitespace-normal break-words leading-snug">
                                {visit.problem ||
                                  (lang === 'ar' ? 'دفعة حساب كلك' : 'CliQ Payment')}
                              </div>
                              {visit.note && (
                                <div className="text-[11px] text-slate-500 mt-0.5 whitespace-normal break-words leading-snug">
                                  {visit.note}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-bold text-slate-800 text-[11px]">
                                {getDayName(visit.visitDate, lang)}{' '}
                                <span dir="ltr" className="font-mono">
                                  ({visit.visitDate})
                                </span>
                              </div>
                              {visit.technicianName && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  {visit.technicianName}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {onSaveVisit ? (
                                  <>
                                    <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-lg border border-slate-200">
                                      <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        dir="ltr"
                                        value={currentDraftAmt}
                                        onChange={(e) =>
                                          setDraftAmounts((prev) => ({
                                            ...prev,
                                            [visit.id]: e.target.value,
                                          }))
                                        }
                                        className="w-20 h-7 px-1.5 rounded bg-white border border-slate-300 font-mono text-xs font-black text-slate-900 text-center"
                                      />
                                      <span className="text-[10px] font-bold text-slate-600">
                                        {lang === 'ar' ? 'د.أ' : 'JOD'}
                                      </span>
                                    </div>
                                    {isAmountModified && (
                                      <button
                                        type="button"
                                        onClick={() => handleSaveCliqAmount(visit)}
                                        className="h-7 px-2.5 rounded-lg bg-[#0B3B68] hover:bg-[#155E95] text-white text-[11px] font-extrabold cursor-pointer"
                                      >
                                        {lang === 'ar' ? 'حفظ المبلغ' : 'Save'}
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span className="font-mono font-black text-[#1E824C]">
                                    +{formatJod(visit.amountJod, lang)}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 text-[10px] font-black">
                                  CliQ · كلك
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-end whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                {onSaveVisit && (
                                  <select
                                    value="cliq"
                                    onChange={(e) =>
                                      handleChangePaymentMethod(
                                        visit,
                                        e.target.value as PaymentMethod | 'unpaid'
                                      )
                                    }
                                    className="h-7 px-2 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-700 cursor-pointer"
                                  >
                                    <option value="cliq">
                                      {lang === 'ar' ? 'حساب كلك' : 'CliQ'}
                                    </option>
                                    <option value="cash">
                                      {lang === 'ar' ? 'تحويل للكاش' : 'To Cash'}
                                    </option>
                                    <option value="unpaid">
                                      {lang === 'ar' ? 'إرجاع لذمم' : 'To Unpaid'}
                                    </option>
                                  </select>
                                )}
                                {canDelete && onDeleteVisit && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget(visit)}
                                    className="h-7 px-2.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                                  </button>
                                )}
                              </div>
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

      {/* Confirm Convert Unpaid Customer to CliQ Modal */}
      {confirmConvertTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">
                  {lang === 'ar'
                    ? 'تأكيد حساب الزبون كلك (CliQ)'
                    : 'Confirm Customer CliQ Payment'}
                </h4>
                <p className="text-xs text-slate-600">
                  {lang === 'ar'
                    ? `سيتم إضافة الزبون «${confirmConvertTarget.customerName}» إلى قائمة حساب كلك ولن يُضاف المبلغ إلى الكاش.`
                    : `"${confirmConvertTarget.customerName}" will be added to the CliQ Account list and NOT added to Cash.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmConvertTarget(null)}
                className="min-h-[38px] px-4 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => handleConvertUnpaidToCliq(confirmConvertTarget)}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-300" />
                <span>
                  {lang === 'ar'
                    ? 'تأكيد الإضافة إلى حساب كلك'
                    : 'Confirm CliQ Account'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete CliQ Record Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title={
          lang === 'ar'
            ? 'تأكيد حذف دفعة حساب كلك'
            : 'Confirm Deleting CliQ Payment'
        }
        itemName={
          deleteTarget
            ? `${deleteTarget.customerName} — ${formatJod(
                deleteTarget.amountJod,
                lang
              )}`
            : ''
        }
        lang={lang}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget && onDeleteVisit) {
            onDeleteVisit(deleteTarget.id);
            setDeleteTarget(null);
            setBannerMsg(
              lang === 'ar'
                ? 'تم حذف السجل من قائمة حساب كلك.'
                : 'Removed record from CliQ Account list.'
            );
            setTimeout(() => setBannerMsg(''), 3500);
          }
        }}
      />
    </div>
  );
};
