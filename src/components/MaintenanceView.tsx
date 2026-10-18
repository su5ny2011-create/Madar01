import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Edit3,
  Plus,
  Search,
  Trash2,
  Wrench,
  Phone,
  Banknote,
  FileText,
  Calendar,
  X,
  Printer,
  Copy,
} from 'lucide-react';
import type {
  Customer,
  Language,
  MaintenanceVisit,
  PartItem,
  PaymentMethod,
} from '../types';
import { formatJod, getDayName, getTodayStr } from '../utils/logic';
import { TouchDatePicker, TouchTimePicker } from './TouchDateTimePicker';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface MaintenanceViewProps {
  lang: Language;
  visits: MaintenanceVisit[];
  customers: Customer[];
  parts: PartItem[];
  preselectedCustomerName?: string;
  onClearPreselectedCustomer?: () => void;
  onSaveVisit: (visit: MaintenanceVisit) => void;
  onDeleteVisit: (visitId: string) => void;
  currentUserFullName: string;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  lang,
  visits,
  customers,
  parts,
  preselectedCustomerName,
  onClearPreselectedCustomer,
  onSaveVisit,
  onDeleteVisit,
  currentUserFullName,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [visitType, setVisitType] = useState<'contract' | 'visit'>('visit');
  const [problem, setProblem] = useState('');
  const [requiredParts, setRequiredParts] = useState<string[]>([]);
  const [customReqPart, setCustomReqPart] = useState('');
  const [installedParts, setInstalledParts] = useState<string[]>([]);
  const [customInstPart, setCustomInstPart] = useState('');
  const [visitDate, setVisitDate] = useState(getTodayStr());
  const [visitTime, setVisitTime] = useState('10:30');
  const [nextVisitDate, setNextVisitDate] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [amountJod, setAmountJod] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isResolved, setIsResolved] = useState(false);
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  // Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'resolved' | 'pending' | 'portal'>('all');

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceVisit | null>(null);
  // Printable Receipt Modal state
  const [receiptVisit, setReceiptVisit] = useState<MaintenanceVisit | null>(null);

  useEffect(() => {
    if (preselectedCustomerName) {
      setCustomerName(preselectedCustomerName);
      const found = customers.find(
        (c) => c.name.toLowerCase() === preselectedCustomerName.toLowerCase()
      );
      if (found) {
        if (found.phone) setPhone(found.phone);
        setVisitType(found.contractType === 'on_demand' ? 'visit' : 'contract');
      }
      if (onClearPreselectedCustomer) onClearPreselectedCustomer();
    }
  }, [preselectedCustomerName, customers, onClearPreselectedCustomer]);

  const resetForm = () => {
    setEditingId(null);
    setCustomerName('');
    setPhone('');
    setVisitType('visit');
    setProblem('');
    setRequiredParts([]);
    setCustomReqPart('');
    setInstalledParts([]);
    setCustomInstPart('');
    setVisitDate(getTodayStr());
    setVisitTime('10:30');
    setNextVisitDate('');
    setIsPaid(false);
    setAmountJod('');
    setPaymentMethod('cash');
    setIsResolved(false);
    setNote('');
    setFormError('');
  };

  const handleSelectSavedCustomer = (cust: Customer) => {
    setCustomerName(cust.name);
    if (cust.phone) setPhone(cust.phone);
    setVisitType(cust.contractType === 'on_demand' ? 'visit' : 'contract');
    if (cust.contractFeeJod && cust.contractFeeJod > 0 && visitType === 'contract') {
      setAmountJod(String(cust.contractFeeJod));
    }
  };

  const togglePartInList = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    partName: string
  ) => {
    if (list.includes(partName)) {
      setList(list.filter((p) => p !== partName));
    } else {
      setList([...list, partName]);
    }
  };

  const addCustomPart = (
    value: string,
    setValue: React.Dispatch<React.SetStateAction<string>>,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const clean = value.trim();
    if (!clean) return;
    if (!list.includes(clean)) {
      setList([...list, clean]);
    }
    setValue('');
  };

  const handleEditClick = (v: MaintenanceVisit) => {
    setEditingId(v.id);
    setCustomerName(v.customerName);
    setPhone(v.phone || '');
    setVisitType(v.visitType);
    setProblem(v.problem);
    setRequiredParts([...v.requiredParts]);
    setInstalledParts([...v.installedParts]);
    setVisitDate(v.visitDate);
    setVisitTime(v.visitTime);
    setNextVisitDate(v.nextVisitDate || '');
    setIsPaid(v.isPaid);
    setAmountJod(String(v.amountJod));
    setPaymentMethod(v.paymentMethod);
    setIsResolved(v.isResolved);
    setNote(v.note || '');
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!customerName.trim()) {
      setFormError(
        lang === 'ar' ? 'يرجى إدخال أو اختيار اسم الزبون.' : 'Customer name is required.'
      );
      return;
    }
    if (!problem.trim()) {
      setFormError(
        lang === 'ar' ? 'يرجى إدخال وصف المشكلة.' : 'Problem description is required.'
      );
      return;
    }
    if (!visitDate) {
      setFormError(
        lang === 'ar' ? 'يرجى تحديد تاريخ الزيارة.' : 'Visit date is required.'
      );
      return;
    }

    const parsedAmount = Math.max(0, Number(amountJod) || 0);
    const existing = editingId ? visits.find((v) => v.id === editingId) : undefined;

    const finalReqParts = [...requiredParts];
    if (customReqPart.trim() && !finalReqParts.includes(customReqPart.trim())) {
      finalReqParts.push(customReqPart.trim());
    }
    const finalInstParts = [...installedParts];
    if (customInstPart.trim() && !finalInstParts.includes(customInstPart.trim())) {
      finalInstParts.push(customInstPart.trim());
    }

    const visitRecord: MaintenanceVisit = {
      id: editingId || `visit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerName: customerName.trim(),
      phone: phone.trim(),
      visitType,
      problem: problem.trim(),
      requiredParts: finalReqParts,
      installedParts: finalInstParts,
      visitDate,
      visitTime: visitTime || '10:00',
      nextVisitDate: nextVisitDate.trim() || '',
      isPaid,
      amountJod: parsedAmount,
      paymentMethod,
      isResolved,
      note: note.trim(),
      source: existing?.source || 'staff',
      technicianName: existing?.technicianName || currentUserFullName,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };

    onSaveVisit(visitRecord);
    setSuccessBanner(
      editingId
        ? lang === 'ar'
          ? 'تم تعديل طلب الصيانة وتحديث المواعيد والمالية تلقائياً.'
          : 'Maintenance visit updated & synced across Finance and Calendar.'
        : lang === 'ar'
        ? 'تم تسجيل طلب الصيانة وترحيله تلقائياً إلى الجدول الأسبوعي والمالية.'
        : 'Maintenance visit saved & synced to Weekly Schedule and Finance.'
    );
    resetForm();
    setTimeout(() => setSuccessBanner(''), 4000);
  };

  const filteredVisits = visits.filter((v) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      v.customerName.toLowerCase().includes(q) ||
      v.problem.toLowerCase().includes(q) ||
      (v.phone && v.phone.includes(q)) ||
      (v.note && v.note.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (statusFilter === 'resolved') return v.isResolved;
    if (statusFilter === 'pending') return !v.isResolved;
    if (statusFilter === 'portal') return v.source === 'customer_portal';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Form Section */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#0B3B68] text-white flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#0B3B68]">
                {editingId
                  ? lang === 'ar'
                    ? 'تعديل طلب / زيارة صيانة'
                    : 'Edit Maintenance Visit'
                  : lang === 'ar'
                  ? 'تسجيل طلب صيانة أو زيارة عقد صيانة'
                  : 'Register Maintenance Request / Contract Visit'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'ar'
                  ? 'يرتبط تلقائياً بجدول المواعيد الأسبوعي والمالية (دينار أردني JOD) وسجل الزبائن'
                  : 'Auto-syncs with Weekly Calendar, Finance (JOD), and Customers Directory'}
              </p>
            </div>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء التعديل' : 'Cancel Edit'}
            </button>
          )}
        </div>

        {formError && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold"
          >
            {formError}
          </div>
        )}

        {successBanner && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-bold flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5 text-[#1E824C] shrink-0" />
            <span>{successBanner}</span>
          </div>
        )}

        {/* Quick Customer Selection Strip (shown when saved customers exist) */}
        {customers.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">
                {lang === 'ar'
                  ? 'اختيار سريع من أسماء الزبائن المسجلين:'
                  : 'Quick Select from Saved Customers:'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {customers.slice(0, 8).map((cust) => {
                const isSelected =
                  customerName.trim().toLowerCase() === cust.name.toLowerCase();
                return (
                  <button
                    key={cust.id}
                    type="button"
                    onClick={() => handleSelectSavedCustomer(cust)}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#0B3B68]/40 hover:bg-white'
                    }`}
                  >
                    {cust.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Customer Name, Phone, and Visit Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="maint-customer-name"
              className="text-xs sm:text-sm font-bold text-slate-800 block"
            >
              {lang === 'ar' ? 'اسم الزبون *' : 'Customer Name *'}
            </label>
            <input
              id="maint-customer-name"
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={
                lang === 'ar' ? 'ادخل اسم الزبون أو الشركة...' : 'Enter customer name...'
              }
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="maint-phone"
              className="text-xs sm:text-sm font-bold text-slate-800 block"
            >
              {lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
            </label>
            <input
              id="maint-phone"
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="079XXXXXXX"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono text-sm tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs sm:text-sm font-bold text-slate-800 block">
              {lang === 'ar' ? 'تصنيف الزيارة' : 'Visit Category'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisitType('visit')}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  visitType === 'visit'
                    ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {lang === 'ar' ? 'زيارة صيانة' : 'Single Visit'}
              </button>
              <button
                type="button"
                onClick={() => setVisitType('contract')}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  visitType === 'contract'
                    ? 'bg-[#E58E26] text-white border-[#E58E26]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {lang === 'ar' ? 'عقد صيانة' : 'Contract Visit'}
              </button>
            </div>
          </div>
        </div>

        {/* Problem Description + Quick Touchscreen IT Issue Chips */}
        <div className="space-y-2">
          <label
            htmlFor="maint-problem"
            className="text-xs sm:text-sm font-bold text-slate-800 block"
          >
            {lang === 'ar' ? 'المشكلة / تفاصيل العطل *' : 'Problem Description *'}
          </label>
          <input
            id="maint-problem"
            type="text"
            required
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'اكتب تفاصيل المشكلة أو اختر من الأعطال السريعة أدناه...'
                : 'Describe the maintenance issue or tap a quick template below...'
            }
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {(lang === 'ar'
              ? [
                  'زيارة صيانة دورية للعقد',
                  'تعطل طابعة أو شبكة داخلية',
                  'فحص سيرفر ونسخ احتياطي',
                  'تركيب وتحديث قطع هاردوير',
                  'فورمات وتجهيز نظام تشغيل',
                  'صيانة كاميرات مراقبة',
                ]
              : [
                  'Routine Contract Maintenance',
                  'Printer / Network Issue',
                  'Server & Backup Check',
                  'Hardware Upgrade & Install',
                  'OS Format & Setup',
                  'CCTV Maintenance',
                ]
            ).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() =>
                  setProblem((prev) =>
                    prev.trim() ? `${prev.trim()} + ${preset}` : preset
                  )
                }
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-[#0B3B68] border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Required Parts & Installed Parts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Required Parts */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <label
              htmlFor="maint-req-part-input"
              className="text-xs sm:text-sm font-bold text-slate-800 block"
            >
              {lang === 'ar' ? 'القطع اللازمة' : 'Required Parts'}
            </label>
            {parts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {parts.map((part) => {
                  const selected = requiredParts.includes(part.name);
                  return (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() =>
                        togglePartInList(requiredParts, setRequiredParts, part.name)
                      }
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-[#0B3B68]/40'
                      }`}
                    >
                      {part.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2">
              <input
                id="maint-req-part-input"
                type="text"
                value={customReqPart}
                onChange={(e) => setCustomReqPart(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomPart(
                      customReqPart,
                      setCustomReqPart,
                      requiredParts,
                      setRequiredParts
                    );
                  }
                }}
                placeholder={
                  lang === 'ar' ? 'إضافة قطعة لازمة أخرى...' : 'Add custom required part...'
                }
                className="flex-1 min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  addCustomPart(
                    customReqPart,
                    setCustomReqPart,
                    requiredParts,
                    setRequiredParts
                  )
                }
                className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                {lang === 'ar' ? 'إضافة' : 'Add'}
              </button>
            </div>
            {requiredParts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {requiredParts.map((partName) => (
                  <button
                    key={partName}
                    type="button"
                    onClick={() =>
                      togglePartInList(requiredParts, setRequiredParts, partName)
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0B3B68] text-white text-xs font-bold cursor-pointer"
                  >
                    <span>{partName}</span>
                    <X className="w-3 h-3 text-amber-300" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Installed Parts */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <label
              htmlFor="maint-inst-part-input"
              className="text-xs sm:text-sm font-bold text-slate-800 block"
            >
              {lang === 'ar' ? 'القطع التي تم تركيبها' : 'Installed Parts'}
            </label>
            {parts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {parts.map((part) => {
                  const selected = installedParts.includes(part.name);
                  return (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() =>
                        togglePartInList(installedParts, setInstalledParts, part.name)
                      }
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#1E824C] text-white border-[#1E824C]'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-[#1E824C]/40'
                      }`}
                    >
                      {part.name}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-2">
              <input
                id="maint-inst-part-input"
                type="text"
                value={customInstPart}
                onChange={(e) => setCustomInstPart(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomPart(
                      customInstPart,
                      setCustomInstPart,
                      installedParts,
                      setInstalledParts
                    );
                  }
                }}
                placeholder={
                  lang === 'ar' ? 'إضافة قطعة تم تركيبها...' : 'Add installed part...'
                }
                className="flex-1 min-h-[44px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  addCustomPart(
                    customInstPart,
                    setCustomInstPart,
                    installedParts,
                    setInstalledParts
                  )
                }
                className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-[#1E824C] text-white text-xs font-bold hover:bg-[#145A32] cursor-pointer"
              >
                {lang === 'ar' ? 'إضافة' : 'Add'}
              </button>
            </div>
            {installedParts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {installedParts.map((partName) => (
                  <button
                    key={partName}
                    type="button"
                    onClick={() =>
                      togglePartInList(installedParts, setInstalledParts, partName)
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1E824C] text-white text-xs font-bold cursor-pointer"
                  >
                    <span>{partName}</span>
                    <X className="w-3 h-3 text-white/80" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Spacious Date & Time Pickers */}
        <div className="space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <TouchDatePicker
              id="maint-visit-date"
              label={lang === 'ar' ? 'تاريخ الزيارة' : 'Visit Date'}
              value={visitDate}
              onChange={setVisitDate}
              lang={lang}
              mode="visit"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <TouchTimePicker
                id="maint-visit-time"
                label={lang === 'ar' ? 'وقت الزيارة' : 'Visit Time'}
                value={visitTime}
                onChange={setVisitTime}
                lang={lang}
              />
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200">
              <TouchDatePicker
                id="maint-next-visit-date"
                label={lang === 'ar' ? 'الزيارة القادمة' : 'Next Visit Date'}
                value={nextVisitDate}
                onChange={setNextVisitDate}
                lang={lang}
                optional={true}
                mode="next_visit"
              />
            </div>
          </div>
        </div>

        {/* Payment, Amount (JOD), Payment Method (Cash/Check/CliQ), Problem Resolved */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200">
          {/* Is Paid */}
          <div className="space-y-2">
            <span className="text-xs sm:text-sm font-bold text-slate-800 block">
              {lang === 'ar' ? 'هل تم الدفع؟' : 'Payment Received?'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPaid(true)}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  isPaid
                    ? 'bg-[#1E824C] text-white border-[#1E824C]'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                {lang === 'ar' ? 'نعم (مدفوع)' : 'Yes (Paid)'}
              </button>
              <button
                type="button"
                onClick={() => setIsPaid(false)}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  !isPaid
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                {lang === 'ar' ? 'لا (ذمم)' : 'No (Unpaid)'}
              </button>
            </div>
          </div>

          {/* Amount in JOD */}
          <div className="space-y-2">
            <label
              htmlFor="maint-amount-jod"
              className="text-xs sm:text-sm font-bold text-slate-800 block"
            >
              {lang === 'ar' ? 'المبلغ (دينار أردني JOD)' : 'Amount (JOD)'}
            </label>
            <div className="relative">
              <input
                id="maint-amount-jod"
                type="number"
                dir="ltr"
                step="0.5"
                min="0"
                placeholder="0.00"
                value={amountJod}
                onChange={(e) => setAmountJod(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono text-sm font-bold tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              />
            </div>
          </div>

          {/* Payment Method: Cash / Check / CliQ */}
          <div className="space-y-2">
            <span className="text-xs sm:text-sm font-bold text-slate-800 block">
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
                  onClick={() => setPaymentMethod(pm.id)}
                  className={`min-h-[44px] px-2 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    paymentMethod === pm.id
                      ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {lang === 'ar' ? pm.ar : pm.en}
                </button>
              ))}
            </div>
          </div>

          {/* Is Problem Resolved */}
          <div className="space-y-2">
            <span className="text-xs sm:text-sm font-bold text-slate-800 block">
              {lang === 'ar' ? 'هل تم حل المشكلة؟' : 'Problem Resolved?'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsResolved(true)}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  isResolved
                    ? 'bg-[#1E824C] text-white border-[#1E824C]'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                {lang === 'ar' ? 'تم الحل' : 'Resolved'}
              </button>
              <button
                type="button"
                onClick={() => setIsResolved(false)}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  !isResolved
                    ? 'bg-[#E58E26] text-white border-[#E58E26]'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                {lang === 'ar' ? 'قيد المتابعة' : 'Pending'}
              </button>
            </div>
          </div>
        </div>

        {/* Additional Note */}
        <div className="space-y-1.5">
          <label
            htmlFor="maint-note"
            className="text-xs sm:text-sm font-bold text-slate-800 block"
          >
            {lang === 'ar' ? 'إضافة ملاحظة' : 'Additional Note'}
          </label>
          <input
            id="maint-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'أي ملاحظات فنية أو مالية إضافية حول الزيارة...'
                : 'Any technical or financial notes...'
            }
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
          />
        </div>

        <button
          type="submit"
          className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-5 h-5 shrink-0" />
          <span>
            {editingId
              ? lang === 'ar'
                ? 'حفظ التعديلات وترحيل البيانات'
                : 'Save Maintenance Changes'
              : lang === 'ar'
              ? 'حفظ طلب الصيانة وترحيله للجدول والمالية'
              : 'Save Maintenance Request & Sync'}
          </span>
        </button>
      </form>

      {/* Maintenance Records List & Filter Bar */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
              {lang === 'ar'
                ? `سجل طلبات وزيارات الصيانة (${filteredVisits.length})`
                : `Maintenance Visits Log (${filteredVisits.length})`}
            </h3>
            <p className="text-xs text-slate-500">
              {lang === 'ar'
                ? 'يشمل الزيارات المسجلة وعقود الصيانة وطلبات بوابة الزبائن المرحّلة تلقائياً'
                : 'Includes staff visits, contracts, and auto-transferred customer portal bookings'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Segmented Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              {(
                [
                  { id: 'all', ar: 'الكل', en: 'All' },
                  { id: 'resolved', ar: 'تم الحل', en: 'Resolved' },
                  { id: 'pending', ar: 'قيد المتابعة', en: 'Pending' },
                  { id: 'portal', ar: 'طلبات الزبائن', en: 'Customer Portal' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-[#0B3B68] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang === 'ar' ? tab.ar : tab.en}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'ar' ? 'بحث باسم الزبون أو العطل...' : 'Search customer or issue...'}
                aria-label={lang === 'ar' ? 'بحث في طلبات الصيانة' : 'Search maintenance visits'}
                className="min-h-[44px] ps-9 pe-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B68] w-full sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Visits Cards / Responsive Table */}
        {filteredVisits.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            {lang === 'ar'
              ? 'لا توجد طلبات صيانة مطابقة للبحث الحالي.'
              : 'No maintenance visits match the current filter.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredVisits.map((v) => {
              const pmLabel =
                v.paymentMethod === 'cash'
                  ? lang === 'ar'
                    ? 'كاش'
                    : 'Cash'
                  : v.paymentMethod === 'check'
                  ? lang === 'ar'
                    ? 'شيك'
                    : 'Check'
                  : lang === 'ar'
                  ? 'كلك (CliQ)'
                  : 'CliQ';

              return (
                <div
                  key={v.id}
                  className="py-4 first:pt-2 last:pb-1 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors px-2 rounded-xl"
                >
                  <div className="space-y-1.5 flex-1">
                    {/* Primary Title + Quiet Metadata Separator (Zero-Pill Rule) */}
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-extrabold text-[#0B3B68]">
                        {v.customerName}
                      </h4>
                      <span className="text-slate-300" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        {v.visitType === 'contract'
                          ? lang === 'ar'
                            ? 'عقد صيانة'
                            : 'Contract'
                          : lang === 'ar'
                          ? 'زيارة صيانة'
                          : 'Single Visit'}
                      </span>
                      {v.source === 'customer_portal' && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs font-bold text-[#E58E26]">
                            {lang === 'ar' ? 'وارد من شاشة الزبائن' : 'From Customer Portal'}
                          </span>
                        </>
                      )}
                      {v.phone && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs font-mono tabular-nums text-slate-600 inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {v.phone}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-800">{v.problem}</p>

                    {/* Parts & Schedule Metadata */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1.5 text-slate-800 font-bold bg-slate-100 px-3 py-1 rounded-lg">
                        <Calendar className="w-3.5 h-3.5 text-[#0B3B68]" />
                        <span>{getDayName(v.visitDate, lang)}</span>
                        <span dir="ltr" className="font-mono tabular-nums text-[#0B3B68]">
                          {v.visitDate}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-slate-800 font-bold bg-slate-100 px-3 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5 text-[#E58E26]" />
                        <span dir="ltr" className="font-mono tabular-nums">
                          {v.visitTime}
                        </span>
                      </span>
                      {v.nextVisitDate && (
                        <span className="inline-flex items-center gap-1.5 text-[#155E95] font-bold bg-sky-50 px-3 py-1 rounded-lg border border-sky-200">
                          <span>
                            {lang === 'ar' ? 'الزيارة القادمة:' : 'Next Visit:'}
                          </span>
                          <span>{getDayName(v.nextVisitDate, lang)}</span>
                          <span dir="ltr" className="font-mono tabular-nums">
                            {v.nextVisitDate}
                          </span>
                        </span>
                      )}
                      {v.requiredParts.length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {lang === 'ar' ? 'القطع اللازمة: ' : 'Required: '}
                            <strong className="text-slate-800">
                              {v.requiredParts.join(' + ')}
                            </strong>
                          </span>
                        </>
                      )}
                      {v.installedParts.length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#145A32]">
                            {lang === 'ar' ? 'تم تركيب: ' : 'Installed: '}
                            <strong>{v.installedParts.join(' + ')}</strong>
                          </span>
                        </>
                      )}
                    </div>

                    {v.note && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span>{v.note}</span>
                      </p>
                    )}
                  </div>

                  {/* Financial & Resolution Status + Edit/Delete Actions */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-4 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <div className="text-start lg:text-end space-y-0.5">
                      <div className="text-base font-mono font-extrabold tabular-nums text-slate-900 flex items-center gap-1.5">
                        <Banknote className="w-4 h-4 text-[#1E824C]" />
                        <span>{formatJod(v.amountJod, lang)}</span>
                      </div>
                      <div className="text-xs text-slate-600 flex items-center gap-1.5">
                        <span
                          className={
                            v.isPaid
                              ? 'font-bold text-[#1E824C]'
                              : 'font-bold text-amber-700'
                          }
                        >
                          {v.isPaid
                            ? lang === 'ar'
                              ? 'مدفوع'
                              : 'Paid'
                            : lang === 'ar'
                            ? 'غير مدفوع'
                            : 'Unpaid'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{pmLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            v.isResolved
                              ? 'font-bold text-[#0B3B68]'
                              : 'font-bold text-[#E58E26]'
                          }
                        >
                          {v.isResolved
                            ? lang === 'ar'
                              ? 'تم الحل'
                              : 'Resolved'
                            : lang === 'ar'
                            ? 'قيد المتابعة'
                            : 'Pending'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onSaveVisit({
                            ...v,
                            isResolved: !v.isResolved,
                          })
                        }
                        className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                          v.isResolved
                            ? 'border-emerald-200 bg-emerald-50 text-[#1E824C]'
                            : 'border-amber-200 bg-amber-50 text-[#E58E26]'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {v.isResolved
                            ? lang === 'ar'
                              ? 'تم الحل'
                              : 'Resolved'
                            : lang === 'ar'
                            ? 'إنهاء العطل'
                            : 'Mark Resolved'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReceiptVisit(v)}
                        className="min-h-[42px] px-3 py-2 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-[#0B3B68] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'وصل صيانة' : 'Receipt'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEditClick(v)}
                        aria-label={
                          lang === 'ar'
                            ? `تعديل زيارة ${v.customerName}`
                            : `Edit visit ${v.customerName}`
                        }
                        className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#0B3B68] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(v)}
                        aria-label={
                          lang === 'ar'
                            ? `حذف زيارة ${v.customerName}`
                            : `Delete visit ${v.customerName}`
                        }
                        className="min-h-[42px] px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Printable Maintenance Visit Receipt Modal */}
      {receiptVisit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-[#0B3B68]">
                  شركة المدار لتجارة تكنولوجيا المعلومات
                </h3>
                <p className="text-xs font-bold text-[#155E95]">
                  Al-Madar Information Technology Trading Company
                </p>
                <p className="text-xs font-bold text-[#1E824C] mt-1">
                  {lang === 'ar' ? 'وصل وتقرير زيارة صيانة فنية' : 'Technical Maintenance Visit Receipt'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptVisit(null)}
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-xs">
                    {lang === 'ar' ? 'الزبون / الجهة' : 'Customer'}
                  </span>
                  <strong className="text-[#0B3B68] text-sm">{receiptVisit.customerName}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs">
                    {lang === 'ar' ? 'اليوم والتاريخ' : 'Day & Date'}
                  </span>
                  <strong className="text-slate-900">
                    {getDayName(receiptVisit.visitDate, lang)}{' '}
                    <span dir="ltr" className="font-mono">
                      {receiptVisit.visitDate} ({receiptVisit.visitTime})
                    </span>
                  </strong>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <div>
                  <span className="text-slate-500 text-xs block">
                    {lang === 'ar' ? 'تفاصيل العطل / الصيانة' : 'Issue / Maintenance Details'}
                  </span>
                  <p className="font-bold text-slate-900 mt-0.5">{receiptVisit.problem}</p>
                </div>
                {receiptVisit.installedParts.length > 0 && (
                  <div>
                    <span className="text-slate-500 text-xs block">
                      {lang === 'ar' ? 'القطع المركبة' : 'Installed Parts'}
                    </span>
                    <p className="font-bold text-[#145A32] mt-0.5">
                      {receiptVisit.installedParts.join(' + ')}
                    </p>
                  </div>
                )}
                {receiptVisit.requiredParts.length > 0 && (
                  <div>
                    <span className="text-slate-500 text-xs block">
                      {lang === 'ar' ? 'القطع اللازمة' : 'Required Parts'}
                    </span>
                    <p className="font-bold text-slate-800 mt-0.5">
                      {receiptVisit.requiredParts.join(' + ')}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <div>
                  <span className="text-xs text-[#145A32] font-bold block">
                    {lang === 'ar' ? 'المبلغ وحالة الدفع' : 'Amount & Payment Status'}
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {receiptVisit.isPaid
                      ? lang === 'ar'
                        ? 'مدفوع بالكامل'
                        : 'Paid'
                      : lang === 'ar'
                      ? 'ذمم / غير مدفوع'
                      : 'Unpaid'}
                  </span>
                </div>
                <div className="text-lg font-mono font-extrabold text-[#1E824C]">
                  {formatJod(receiptVisit.amountJod, lang)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 text-xs text-slate-500 border-t border-dashed border-slate-300">
                <div>
                  {lang === 'ar' ? 'توقيع الفني المسؤول:' : 'Technician Signature:'}
                  <div className="mt-4 border-b border-slate-300" />
                </div>
                <div>
                  {lang === 'ar' ? 'توقيع واستلام الزبون:' : 'Customer Signature:'}
                  <div className="mt-4 border-b border-slate-300" />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const summary = [
                    `شركة المدار لتجارة تكنولوجيا المعلومات`,
                    `Al-Madar Information Technology Trading Company`,
                    `وصل زيارة صيانة — ${receiptVisit.customerName}`,
                    `التاريخ: ${getDayName(receiptVisit.visitDate, 'ar')} ${receiptVisit.visitDate}`,
                    `العطل/الصيانة: ${receiptVisit.problem}`,
                    receiptVisit.installedParts.length > 0
                      ? `القطع المركبة: ${receiptVisit.installedParts.join(' + ')}`
                      : '',
                    `المبلغ: ${formatJod(receiptVisit.amountJod, 'ar')} (${
                      receiptVisit.isPaid ? 'مدفوع' : 'غير مدفوع'
                    })`,
                    `الحالة: ${receiptVisit.isResolved ? 'تم الحل' : 'قيد المتابعة'}`,
                  ]
                    .filter(Boolean)
                    .join('\n');
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(summary);
                  }
                  setSuccessBanner(
                    lang === 'ar'
                      ? 'تم نسخ وصل الصيانة لإرساله عبر واتساب'
                      : 'Receipt summary copied for WhatsApp'
                  );
                  setReceiptVisit(null);
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>{lang === 'ar' ? 'نسخ الوصل للواتساب' : 'Copy for WhatsApp'}</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{lang === 'ar' ? 'طباعة الوصل' : 'Print Receipt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal before Delete */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={lang === 'ar' ? 'تأكيد حذف زيارة الصيانة' : 'Confirm Delete Maintenance Visit'}
        itemName={
          deleteTarget
            ? `${deleteTarget.customerName} — ${deleteTarget.problem} (${deleteTarget.visitDate})`
            : ''
        }
        lang={lang}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteVisit(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
};
