import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  Cpu,
  Edit3,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wrench,
  Phone,
  MapPin,
  FileText,
  FileDown,
  Loader2,
  Send,
  Printer,
  Copy,
  CheckCircle2,
  X,
  Calendar,
  BellRing,
  AlertCircle,
  Wallet,
} from 'lucide-react';
import type {
  ContractType,
  Customer,
  ExpenseCategory,
  ExpenseTemplate,
  Language,
  MaintenanceVisit,
  PartItem,
  ScheduleAppointment,
} from '../types';
import {
  CLIQ_PAYMENT_INFO,
  formatJod,
  getDayName,
  getTodayStr,
  isVisitUnpaid,
} from '../utils/logic';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { EditDailyMaintenanceModal } from './EditDailyMaintenanceModal';
import { PaymentReminderModal } from './PaymentReminderModal';
import {
  downloadPdfFromElement,
  preparePdfReport,
  sharePdfReportViaWhatsApp,
  uploadPdfReportForDirectLink,
  type PreparedPdfReport,
} from '../utils/pdfExport';

interface CatalogsViewProps {
  lang: Language;
  customers: Customer[];
  parts: PartItem[];
  expenseTemplates: ExpenseTemplate[];
  visits?: MaintenanceVisit[];
  appointments?: ScheduleAppointment[];
  onSaveCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onSavePart: (part: PartItem) => void;
  onDeletePart: (id: string) => void;
  onSaveExpenseTemplate: (tpl: ExpenseTemplate) => void;
  onDeleteExpenseTemplate: (id: string) => void;
  onDeleteVisit?: (id: string) => void;
  onSaveVisit?: (visit: MaintenanceVisit) => void;
  onCreateVisitForCustomer: (customerName: string) => void;
  canDelete?: boolean;
  currentUserFullName?: string;
}

export const CatalogsView: React.FC<CatalogsViewProps> = ({
  lang,
  customers,
  parts,
  expenseTemplates,
  visits = [],
  appointments = [],
  onSaveCustomer,
  onDeleteCustomer,
  onSavePart,
  onDeletePart,
  onSaveExpenseTemplate,
  onDeleteExpenseTemplate,
  onDeleteVisit,
  onSaveVisit,
  onCreateVisitForCustomer,
  canDelete = true,
  currentUserFullName,
}) => {
  const [activeTab, setActiveTab] = useState<'customers' | 'parts' | 'templates'>(
    'customers'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'unpaid'>('all');

  // Customer Statement Modal State
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [editingVisit, setEditingVisit] = useState<MaintenanceVisit | null>(null);
  const [copiedBanner, setCopiedBanner] = useState('');
  const [isStatementPdfBusy, setIsStatementPdfBusy] = useState(false);
  const [preparedStatementPdf, setPreparedStatementPdf] =
    useState<PreparedPdfReport | null>(null);
  const statementContainerRef = useRef<HTMLDivElement>(null);
  const [reminderTarget, setReminderTarget] = useState<{
    customerName: string;
    phone?: string;
    unpaidVisits: MaintenanceVisit[];
  } | null>(null);

  useEffect(() => {
    if (!statementCustomer) {
      setPreparedStatementPdf(null);
      return;
    }
    let cancelled = false;
    setPreparedStatementPdf(null);
    const fileName = `AlMadar_Statement_${statementCustomer.name}_${getTodayStr()}.pdf`;
    const timer = setTimeout(async () => {
      if (!statementContainerRef.current || cancelled) return;
      try {
        const ready = await preparePdfReport(
          statementContainerRef.current,
          fileName
        );
        if (cancelled) return;
        setPreparedStatementPdf(ready);
        uploadPdfReportForDirectLink(ready.blob, ready.fileName).then((url) => {
          if (!cancelled && url) {
            setPreparedStatementPdf((prev) =>
              prev && prev.fileName === ready.fileName
                ? { ...prev, hostedPdfUrl: url }
                : prev
            );
          }
        });
      } catch {
        // Ignore background pre-generation error
      }
    }, 90);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [statementCustomer, visits.length]);

  // Customer Form & Instant Edit Customer Modal
  const [editCustId, setEditCustId] = useState<string | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custContractType, setCustContractType] = useState<ContractType>('annual');
  const [custFee, setCustFee] = useState('');
  const [custNotes, setCustNotes] = useState('');
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [catalogStatusBanner, setCatalogStatusBanner] = useState('');

  const custFormRef = useRef<HTMLFormElement>(null);
  const partFormRef = useRef<HTMLFormElement>(null);
  const tplFormRef = useRef<HTMLFormElement>(null);

  // Part Form
  const [editPartId, setEditPartId] = useState<string | null>(null);
  const [partName, setPartName] = useState('');
  const [partCategory, setPartCategory] = useState('تخزين وهاردوير');
  const [partCost, setPartCost] = useState('');
  const [partPrice, setPartPrice] = useState('');
  const [partStock, setPartStock] = useState('5');

  // Expense Template Form
  const [editTplId, setEditTplId] = useState<string | null>(null);
  const [tplTitle, setTplTitle] = useState('');
  const [tplCategory, setTplCategory] = useState<ExpenseCategory>('fuel');
  const [tplAmount, setTplAmount] = useState('');
  const [tplPartType, setTplPartType] = useState('');
  const [tplNotes, setTplNotes] = useState('');

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'customer' | 'part' | 'template' | 'visit';
    id: string;
    label: string;
  } | null>(null);

  const openCustomerEdit = (c: Customer) => {
    setEditCustId(c.id);
    setCustName(c.name || '');
    setCustPhone(c.phone || '');
    setCustAddress(c.address || '');
    setCustContractType(c.contractType || 'on_demand');
    setCustFee(c.contractFeeJod ? String(c.contractFeeJod) : '');
    setCustNotes(c.notes || '');
    setIsEditCustomerModalOpen(true);
  };

  const resetCustomerForm = () => {
    setEditCustId(null);
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setCustContractType('annual');
    setCustFee('');
    setCustNotes('');
    setIsEditCustomerModalOpen(false);
  };

  const q = searchQuery.trim().toLowerCase();
  const getCustomerUnpaidVisits = (custNameStr: string) =>
    visits.filter(
      (v) =>
        v.customerName.trim().toLowerCase() === custNameStr.trim().toLowerCase() &&
        isVisitUnpaid(v)
    );

  const unpaidCustomersCount = customers.filter(
    (c) => getCustomerUnpaidVisits(c.name).length > 0
  ).length;
  const allUnpaidVisits = visits.filter((v) => isVisitUnpaid(v));
  const totalUnpaidBalanceJod = allUnpaidVisits.reduce(
    (acc, v) => acc + (Number(v.amountJod) || 0),
    0
  );
  const [cliqCopiedNotice, setCliqCopiedNotice] = useState('');

  const handleCopyCliqDetails = (onlyNumber = false) => {
    const textToCopy = onlyNumber
      ? CLIQ_PAYMENT_INFO.cliqNumber
      : lang === 'ar'
      ? `بيانات التحويل عبر خدمة كلك (CliQ):\n• رقم كلك: ${CLIQ_PAYMENT_INFO.cliqNumber}\n• الاسم: ${CLIQ_PAYMENT_INFO.recipientName}\n• البنك: ${CLIQ_PAYMENT_INFO.bankName}`
      : `CliQ Payment Details:\n• CliQ Number: ${CLIQ_PAYMENT_INFO.cliqNumber}\n• Name: ${CLIQ_PAYMENT_INFO.recipientNameEn} (${CLIQ_PAYMENT_INFO.recipientName})\n• Bank: ${CLIQ_PAYMENT_INFO.bankNameEn} (${CLIQ_PAYMENT_INFO.bankName})`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy).catch(() => {});
    }
    setCliqCopiedNotice(
      onlyNumber
        ? lang === 'ar'
          ? `تم نسخ رقم كلك: ${CLIQ_PAYMENT_INFO.cliqNumber}`
          : `Copied CliQ number: ${CLIQ_PAYMENT_INFO.cliqNumber}`
        : lang === 'ar'
        ? `تم نسخ بيانات كلك (${CLIQ_PAYMENT_INFO.cliqNumber} — ${CLIQ_PAYMENT_INFO.recipientName} — ${CLIQ_PAYMENT_INFO.bankName})`
        : 'Copied full CliQ payment details!'
    );
    setTimeout(() => setCliqCopiedNotice(''), 3500);
  };

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (customerFilter === 'unpaid') {
      return getCustomerUnpaidVisits(c.name).length > 0;
    }
    return true;
  });
  const filteredParts = parts.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
  );
  const filteredTemplates = expenseTemplates.filter(
    (t) =>
      !q ||
      t.title.toLowerCase().includes(q) ||
      (t.partType || '').toLowerCase().includes(q)
  );

  const handleCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) return;

    const existingCust = editCustId
      ? customers.find((c) => c.id === editCustId)
      : undefined;

    const record: Customer = {
      ...(existingCust || {}),
      id: editCustId || `cust-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: custName.trim(),
      phone: custPhone.trim(),
      address: custAddress.trim(),
      contractType: custContractType || 'on_demand',
      contractFeeJod: Number(custFee) || 0,
      notes: custNotes.trim(),
      createdAt: existingCust?.createdAt || getTodayStr(),
    };
    onSaveCustomer(record);

    if (statementCustomer && statementCustomer.id === record.id) {
      setStatementCustomer(record);
    }

    setCatalogStatusBanner(
      editCustId
        ? lang === 'ar'
          ? `تم حفظ تعديل بيانات الزبون (${record.name}) بنجاح ✓`
          : `Customer (${record.name}) updated successfully ✓`
        : lang === 'ar'
        ? `تمت إضافة الزبون (${record.name}) إلى القائمة بنجاح ✓`
        : `Customer (${record.name}) added successfully ✓`
    );
    setTimeout(() => setCatalogStatusBanner(''), 4000);
    resetCustomerForm();
  };

  const handlePartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim()) return;

    const existingPart = editPartId
      ? parts.find((p) => p.id === editPartId)
      : undefined;

    const record: PartItem = {
      ...(existingPart || {}),
      id: editPartId || `part-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: partName.trim(),
      category: partCategory.trim() || 'قطع عامة',
      defaultCostJod: Number(partCost) || 0,
      defaultPriceJod: Number(partPrice) || 0,
      stockQty: Number(partStock) || 0,
    };
    onSavePart(record);
    setCatalogStatusBanner(
      editPartId
        ? lang === 'ar'
          ? `تم حفظ تعديل القطعة (${record.name}) بنجاح ✓`
          : `Part (${record.name}) updated ✓`
        : lang === 'ar'
        ? `تمت إضافة القطعة (${record.name}) بنجاح ✓`
        : `Part (${record.name}) added ✓`
    );
    setTimeout(() => setCatalogStatusBanner(''), 4000);
    setEditPartId(null);
    setPartName('');
    setPartCost('');
    setPartPrice('');
    setPartStock('5');
  };

  const handleTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplTitle.trim()) return;

    const record: ExpenseTemplate = {
      id: editTplId || `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      title: tplTitle.trim(),
      category: tplCategory,
      defaultAmountJod: Number(tplAmount) || 0,
      partType: tplCategory === 'parts_purchase' ? tplPartType.trim() : undefined,
      notes: tplNotes.trim(),
    };
    onSaveExpenseTemplate(record);
    setCatalogStatusBanner(
      editTplId
        ? lang === 'ar'
          ? `تم حفظ تعديل المصروف الجاهز (${record.title}) بنجاح ✓`
          : `Template (${record.title}) updated ✓`
        : lang === 'ar'
        ? `تمت إضافة المصروف الجاهز (${record.title}) بنجاح ✓`
        : `Template (${record.title}) added ✓`
    );
    setTimeout(() => setCatalogStatusBanner(''), 4000);
    setEditTplId(null);
    setTplTitle('');
    setTplAmount('');
    setTplPartType('');
    setTplNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Section Switcher + Search Bar */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#0B3B68]">
              {lang === 'ar'
                ? 'الزبائن والعقود · أنواع القطع · المصاريف الجاهزة'
                : 'Customers & Contracts · Parts Catalog · Ready Expenses'}
            </h2>
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'بحث عن زبون، هاتف، قطعة، أو مصروف...'
                  : 'Search customer, phone, part...'
              }
              aria-label={lang === 'ar' ? 'بحث في الزبائن والقطع' : 'Search catalogs'}
              className="w-full min-h-[44px] ps-9 pe-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('customers')}
            className={`min-h-[42px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'customers'
                ? 'bg-[#0B3B68] text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>
              {lang === 'ar'
                ? `أسماء الزبائن (${filteredCustomers.length})`
                : `Customers (${filteredCustomers.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('parts')}
            className={`min-h-[42px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'parts'
                ? 'bg-[#1E824C] text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-4 h-4 shrink-0" />
            <span>
              {lang === 'ar' ? `أنواع القطع (${filteredParts.length})` : `Parts (${filteredParts.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`min-h-[42px] px-4 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'templates'
                ? 'bg-[#E58E26] text-white shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span>
              {lang === 'ar'
                ? `مصاريف جاهزة (${filteredTemplates.length})`
                : `Ready Expenses (${filteredTemplates.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: CUSTOMERS & CONTRACTS */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          {/* Official CliQ Payment Information Card on Customers Page */}
          <div className="rounded-2xl bg-gradient-to-r from-[#0B3B68] via-[#0E4980] to-[#155E95] text-white p-4 sm:p-5 shadow-md border border-sky-800/40">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5 text-amber-300" />
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-extrabold text-amber-300">
                    {lang === 'ar'
                      ? 'بيانات الدفع والتحويل المعتمدة عبر خدمة كلك (CliQ)'
                      : 'Official CliQ Instant Payment & Transfer Details'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-extrabold">
                    <span className="px-3 py-1 rounded-xl bg-white text-[#0B3B68] font-mono tabular-nums shadow-2xs">
                      {lang === 'ar' ? 'رقم كلك: ' : 'CliQ: '}
                      <span dir="ltr">{CLIQ_PAYMENT_INFO.cliqNumber}</span>
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-white/15 border border-white/20 text-white">
                      {lang === 'ar' ? 'الاسم: ' : 'Name: '}
                      {CLIQ_PAYMENT_INFO.recipientName}
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-emerald-500/25 border border-emerald-300/40 text-emerald-100">
                      {lang === 'ar' ? 'البنك: ' : 'Bank: '}
                      {CLIQ_PAYMENT_INFO.bankName}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyCliqDetails(true)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-300" />
                  <span>{lang === 'ar' ? 'نسخ رقم كلك فقط' : 'Copy CliQ Number'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyCliqDetails(false)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'ar' ? 'نسخ بيانات كلك كاملة للزبون' : 'Copy Full CliQ Info'}
                  </span>
                </button>
              </div>
            </div>

            {cliqCopiedNotice && (
              <div className="mt-3 px-3 py-2 rounded-xl bg-emerald-500/25 border border-emerald-300/40 text-white text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>{cliqCopiedNotice}</span>
              </div>
            )}
          </div>

          {/* Payment Notifications & Unpaid Visits Reminder Banner (Only on Customers Page & Program Notifications) */}
          {allUnpaidVisits.length > 0 && (
            <div className="rounded-2xl bg-rose-50/90 border border-rose-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-300 text-rose-700 flex items-center justify-center shrink-0">
                  <BellRing className="w-4 h-4 text-rose-600" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-extrabold text-rose-950">
                    {lang === 'ar'
                      ? `إشعارات الدفع وتذكير الذمم (${unpaidCustomersCount} زبائن · ${allUnpaidVisits.length} زيارات غير مدفوعة)`
                      : `Payment Notifications & Reminders (${unpaidCustomersCount} customers · ${allUnpaidVisits.length} unpaid visits)`}
                  </div>
                  <div className="text-xs text-rose-800 font-bold mt-0.5">
                    {lang === 'ar'
                      ? `إجمالي الذمم المستحقة: ${formatJod(totalUnpaidBalanceJod, lang)}`
                      : `Total unpaid balance: ${formatJod(totalUnpaidBalanceJod, lang)}`}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setCustomerFilter(customerFilter === 'unpaid' ? 'all' : 'unpaid')
                }
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors ${
                  customerFilter === 'unpaid'
                    ? 'bg-rose-700 text-white'
                    : 'bg-white hover:bg-rose-100 text-rose-900 border border-rose-300'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {customerFilter === 'unpaid'
                    ? lang === 'ar'
                      ? 'عرض جميع الزبائن'
                      : 'Show All Customers'
                    : lang === 'ar'
                    ? 'عرض الزبائن غير المسددين فقط'
                    : 'Filter Unpaid Customers'}
                </span>
              </button>
            </div>
          )}
          {catalogStatusBanner && (
            <div
              role="status"
              className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#145A32] text-xs sm:text-sm font-extrabold flex items-center justify-between gap-2 shadow-xs"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#1E824C] shrink-0" />
                <span>{catalogStatusBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setCatalogStatusBanner('')}
                className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form
            ref={custFormRef}
            onSubmit={handleCustomerSubmit}
            className={`rounded-2xl bg-white border p-5 sm:p-6 shadow-sm space-y-4 transition-all ${
              editCustId
                ? 'border-[#E58E26] ring-2 ring-[#E58E26]/30 bg-amber-50/20'
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#0B3B68]">
                {editCustId
                  ? lang === 'ar'
                    ? 'تعديل بيانات الزبون / العقد'
                    : 'Edit Customer / Contract'
                  : lang === 'ar'
                  ? 'إضافة زبون جديد أو عقد صيانة'
                  : 'Add New Customer or Maintenance Contract'}
              </h3>
              {editCustId && (
                <button
                  type="button"
                  onClick={resetCustomerForm}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء التعديل' : 'Cancel'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="cat-cust-name"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'اسم الزبون / الشركة *' : 'Customer / Company Name *'}
                </label>
                <input
                  id="cat-cust-name"
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder={lang === 'ar' ? 'ادخل اسم الزبون...' : 'Enter customer name...'}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="cat-cust-phone"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                </label>
                <input
                  id="cat-cust-phone"
                  type="tel"
                  dir="ltr"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="079XXXXXXX"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="cat-cust-address"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'العنوان / الموقع' : 'Address / Location'}
                </label>
                <input
                  id="cat-cust-address"
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder={lang === 'ar' ? 'عمان - الشميساني...' : 'Amman...'}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">
                  {lang === 'ar' ? 'نوع التعامل / العقد' : 'Contract Type'}
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'annual', ar: 'عقد سنوي', en: 'Annual' },
                      { id: 'monthly', ar: 'عقد شهري', en: 'Monthly' },
                      { id: 'on_demand', ar: 'حسب الطلب', en: 'On-Demand' },
                    ] as const
                  ).map((ct) => (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => setCustContractType(ct.id)}
                      className={`min-h-[44px] px-2 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        custContractType === ct.id
                          ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {lang === 'ar' ? ct.ar : ct.en}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="cat-cust-fee"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar'
                    ? 'قيمة العقد / الزيارة الافتراضية (JOD)'
                    : 'Default Contract / Visit Fee (JOD)'}
                </label>
                <input
                  id="cat-cust-fee"
                  type="number"
                  step="1"
                  min="0"
                  value={custFee}
                  onChange={(e) => setCustFee(e.target.value)}
                  placeholder="0.00"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="cat-cust-notes"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'ملاحظات العقد' : 'Contract Notes'}
                </label>
                <input
                  id="cat-cust-notes"
                  type="text"
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  placeholder={lang === 'ar' ? 'تفاصيل الأجهزة المشمولة...' : 'Covered devices...'}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {editCustId
                  ? lang === 'ar'
                    ? 'حفظ تعديل الزبون'
                    : 'Update Customer'
                  : lang === 'ar'
                  ? 'إضافة الزبون إلى القائمة'
                  : 'Add Customer'}
              </span>
            </button>
          </form>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            {/* Customer Unpaid Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCustomerFilter('all')}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    customerFilter === 'all'
                      ? 'bg-[#0B3B68] text-white shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {lang === 'ar'
                    ? `جميع الزبائن (${customers.length})`
                    : `All Customers (${customers.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerFilter('unpaid')}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                    customerFilter === 'unpaid'
                      ? 'bg-rose-700 text-white shadow-2xs'
                      : 'text-rose-800 hover:bg-rose-50'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {lang === 'ar'
                      ? `زبائن بزيارات غير مدفوعة (${unpaidCustomersCount})`
                      : `Unpaid Visits (${unpaidCustomersCount})`}
                  </span>
                </button>
              </div>
            </div>

            {filteredCustomers.length === 0 ? (
              <p className="py-6 text-center text-xs sm:text-sm text-slate-500">
                {lang === 'ar'
                  ? 'لا توجد أسماء زبائن مطابقة.'
                  : 'No matching customers found.'}
              </p>
            ) : null}

            <div className="divide-y divide-slate-200 space-y-2">
              {filteredCustomers.map((c) => {
                const custVisits = visits.filter(
                  (v) =>
                    v.customerName.trim().toLowerCase() === c.name.trim().toLowerCase()
                );
                const custUnpaidVisits = custVisits.filter((v) => isVisitUnpaid(v));
                const hasUnpaid = custUnpaidVisits.length > 0;
                const paidJod = custVisits
                  .filter((v) => v.isPaid)
                  .reduce((acc, v) => acc + (Number(v.amountJod) || 0), 0);
                const unpaidJod = custUnpaidVisits.reduce(
                  (acc, v) => acc + (Number(v.amountJod) || 0),
                  0
                );

                return (
                  <div
                    key={c.id}
                    className={`py-4 px-3.5 rounded-2xl transition-colors flex flex-col gap-3 ${
                      hasUnpaid
                        ? 'bg-rose-50/45 border-s-4 border-s-rose-500 ring-1 ring-rose-200/80'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-extrabold text-[#0B3B68]">
                            {c.name}
                          </h4>
                          {hasUnpaid && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 text-[11px] font-extrabold inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              <span>
                                {lang === 'ar'
                                  ? `زيارات غير مدفوعة (${custUnpaidVisits.length})`
                                  : `Unpaid Visits (${custUnpaidVisits.length})`}
                              </span>
                            </span>
                          )}
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-xs font-bold text-[#1E824C]">
                            {c.contractType === 'annual'
                              ? lang === 'ar'
                                ? 'عقد صيانة سنوي'
                                : 'Annual Contract'
                              : c.contractType === 'monthly'
                              ? lang === 'ar'
                                ? 'عقد صيانة شهري'
                                : 'Monthly Contract'
                              : lang === 'ar'
                              ? 'زيارات حسب الطلب'
                              : 'On-Demand'}
                          </span>
                          {c.contractFeeJod && c.contractFeeJod > 0 ? (
                            <>
                              <span aria-hidden="true" className="text-slate-300">
                                ·
                              </span>
                              <span className="text-xs font-mono font-bold tabular-nums text-slate-800">
                                {formatJod(c.contractFeeJod, lang)}
                              </span>
                            </>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          {c.phone && (
                            <span
                              dir="ltr"
                              className="font-mono tabular-nums inline-flex items-center gap-1 font-bold text-slate-700"
                            >
                              <Phone className="w-3.5 h-3.5 text-[#0B3B68]" />
                              {c.phone}
                            </span>
                          )}
                          {c.address && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-[#E58E26]" />
                              {c.address}
                            </span>
                          )}
                          {c.notes && <span className="text-slate-500">{c.notes}</span>}
                        </div>

                        {/* Customer Activity & Balance Summary */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold">
                            {lang === 'ar'
                              ? `الزيارات: ${custVisits.length}`
                              : `Visits: ${custVisits.length}`}
                          </span>
                          {paidJod > 0 && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-[#1E824C] font-bold font-mono tabular-nums">
                              {lang === 'ar'
                                ? `المدفوع: ${formatJod(paidJod, lang)}`
                                : `Paid: ${formatJod(paidJod, lang)}`}
                            </span>
                          )}
                          {hasUnpaid && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 font-extrabold font-mono tabular-nums">
                              {lang === 'ar'
                                ? `ذمم غير مدفوعة: ${formatJod(unpaidJod, lang)}`
                                : `Unpaid Balance: ${formatJod(unpaidJod, lang)}`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {hasUnpaid && (
                          <button
                            type="button"
                            onClick={() =>
                              setReminderTarget({
                                customerName: c.name,
                                phone: c.phone,
                                unpaidVisits: custUnpaidVisits,
                              })
                            }
                            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-extrabold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <BellRing className="w-3.5 h-3.5 text-[#E58E26]" />
                            <span>
                              {lang === 'ar' ? 'تذكير بالدفع' : 'Payment Reminder'}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setStatementCustomer(c)}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#0B3B68] border border-sky-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>
                            {lang === 'ar'
                              ? 'كشف حساب وسجل الزبون'
                              : 'Statement & History'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onCreateVisitForCustomer(c.name)}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'تسجيل زيارة صيانة' : 'New Visit'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openCustomerEdit(c)}
                          aria-label={
                            lang === 'ar'
                              ? `تعديل الزبون ${c.name}`
                              : `Edit customer ${c.name}`
                          }
                          className="min-h-[42px] px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-[#0B3B68] text-xs font-extrabold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#E58E26]" />
                          <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                        </button>

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                kind: 'customer',
                                id: c.id,
                                label: c.name,
                              })
                            }
                            aria-label={
                              lang === 'ar'
                                ? `حذف الزبون ${c.name}`
                                : `Delete customer ${c.name}`
                            }
                            className="min-h-[42px] px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Highlighted Unpaid Visits List for this Customer */}
                    {hasUnpaid && (
                      <div className="rounded-xl bg-white/90 border border-rose-200 p-2.5 space-y-1.5">
                        <div className="text-[11px] font-extrabold text-rose-800 flex items-center justify-between">
                          <span>
                            {lang === 'ar'
                              ? 'تفاصيل الزيارات غير المدفوعة لهذا الزبون:'
                              : 'Unpaid visits for this customer:'}
                          </span>
                        </div>
                        <div className="divide-y divide-rose-100">
                          {custUnpaidVisits.map((uv) => (
                            <div
                              key={uv.id}
                              className="py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                <span
                                  dir="ltr"
                                  className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[10px] font-bold"
                                >
                                  {uv.visitDate}
                                </span>
                                <span className="font-bold text-slate-800 truncate">
                                  <bdi>{uv.problem}</bdi>
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono font-extrabold text-rose-700">
                                  {formatJod(uv.amountJod, lang)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setReminderTarget({
                                      customerName: c.name,
                                      phone: uv.phone || c.phone,
                                      unpaidVisits: [uv],
                                    })
                                  }
                                  className="px-2 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <BellRing className="w-3 h-3 text-[#E58E26]" />
                                  <span>
                                    {lang === 'ar' ? 'تذكير' : 'Remind'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PARTS CATALOG */}
      {activeTab === 'parts' && (
        <div className="space-y-6">
          <form
            ref={partFormRef}
            onSubmit={handlePartSubmit}
            className={`rounded-2xl bg-white border p-5 sm:p-6 shadow-sm space-y-4 ${
              editPartId ? 'border-[#1E824C] ring-2 ring-[#1E824C]/25' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#1E824C]">
                {editPartId
                  ? lang === 'ar'
                    ? 'تعديل نوع القطعة'
                    : 'Edit Part Item'
                  : lang === 'ar'
                  ? 'إضافة نوع قطعة جديد'
                  : 'Add New Part Item'}
              </h3>
              {editPartId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditPartId(null);
                    setPartName('');
                    setPartCost('');
                    setPartPrice('');
                    setPartStock('5');
                  }}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء التعديل' : 'Cancel'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label
                  htmlFor="part-name"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'اسم ونوع القطعة *' : 'Part Name & Model *'}
                </label>
                <input
                  id="part-name"
                  type="text"
                  required
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: SSD NVMe 1TB Samsung...' : 'e.g. SSD NVMe 1TB...'}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="part-cat"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'التصنيف' : 'Category'}
                </label>
                <input
                  id="part-cat"
                  type="text"
                  value={partCategory}
                  onChange={(e) => setPartCategory(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="part-cost"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'سعر التكلفة (JOD)' : 'Cost (JOD)'}
                </label>
                <input
                  id="part-cost"
                  type="number"
                  step="0.5"
                  min="0"
                  value={partCost}
                  onChange={(e) => setPartCost(e.target.value)}
                  placeholder="20.00"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="part-price"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'سعر البيع للزبون (JOD)' : 'Sale Price (JOD)'}
                </label>
                <input
                  id="part-price"
                  type="number"
                  step="0.5"
                  min="0"
                  value={partPrice}
                  onChange={(e) => setPartPrice(e.target.value)}
                  placeholder="30.00"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm tabular-nums"
                />
              </div>
            </div>

            <button
              type="submit"
              className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {editPartId
                  ? lang === 'ar'
                    ? 'حفظ تعديل القطعة'
                    : 'Update Part'
                  : lang === 'ar'
                  ? 'إضافة القطعة للدليل'
                  : 'Add Part'}
              </span>
            </button>
          </form>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm divide-y divide-slate-200">
            {filteredParts.length === 0 ? (
              <p className="py-6 text-center text-xs sm:text-sm text-slate-500">
                {lang === 'ar'
                  ? 'لا توجد قطع مضافة حالياً.'
                  : 'No parts added yet.'}
              </p>
            ) : null}
            {filteredParts.map((p) => (
              <div
                key={p.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {p.name}
                  </div>
                  <div className="text-xs text-slate-600 font-mono tabular-nums mt-0.5">
                    {p.category} ·{' '}
                    {lang === 'ar'
                      ? `التكلفة: ${formatJod(p.defaultCostJod, lang)} · البيع: ${formatJod(p.defaultPriceJod, lang)}`
                      : `Cost: ${formatJod(p.defaultCostJod, lang)} · Price: ${formatJod(p.defaultPriceJod, lang)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditPartId(p.id);
                      setPartName(p.name);
                      setPartCategory(p.category);
                      setPartCost(String(p.defaultCostJod));
                      setPartPrice(String(p.defaultPriceJod));
                      setPartStock(String(p.stockQty ?? 5));
                      partFormRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                    }}
                    aria-label={lang === 'ar' ? `تعديل القطعة ${p.name}` : `Edit part ${p.name}`}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 text-[#0B3B68] text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          kind: 'part',
                          id: p.id,
                          label: p.name,
                        })
                      }
                      aria-label={lang === 'ar' ? `حذف القطعة ${p.name}` : `Delete part ${p.name}`}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: READY-MADE EXPENSE TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <form
            ref={tplFormRef}
            onSubmit={handleTemplateSubmit}
            className={`rounded-2xl bg-white border p-5 sm:p-6 shadow-sm space-y-4 ${
              editTplId ? 'border-[#E58E26] ring-2 ring-[#E58E26]/30' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#E58E26]">
                {editTplId
                  ? lang === 'ar'
                    ? 'تعديل قالب مصروف جاهز'
                    : 'Edit Ready Expense Template'
                  : lang === 'ar'
                  ? 'إضافة مصروف جاهز'
                  : 'Add Ready-Made Expense Template'}
              </h3>
              {editTplId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditTplId(null);
                    setTplTitle('');
                    setTplAmount('');
                    setTplPartType('');
                    setTplNotes('');
                  }}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء التعديل' : 'Cancel'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label
                  htmlFor="tpl-title"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'اسم المصروف الجاهز *' : 'Template Title *'}
                </label>
                <input
                  id="tpl-title"
                  type="text"
                  required
                  value={tplTitle}
                  onChange={(e) => setTplTitle(e.target.value)}
                  placeholder={
                    lang === 'ar'
                      ? 'مثال: بنزين سيارة الصيانة / غيار زيت...'
                      : 'e.g. Field Car Fuel...'
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="tpl-category"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'التصنيف' : 'Category'}
                </label>
                <select
                  id="tpl-category"
                  value={tplCategory}
                  onChange={(e) => setTplCategory(e.target.value as ExpenseCategory)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm"
                >
                  <option value="fuel">{lang === 'ar' ? 'بنزين' : 'Fuel'}</option>
                  <option value="car_repair">
                    {lang === 'ar' ? 'تصليح سيارة' : 'Car Repair'}
                  </option>
                  <option value="parts_purchase">
                    {lang === 'ar' ? 'شراء قطع' : 'Parts Purchase'}
                  </option>
                  <option value="other">
                    {lang === 'ar' ? 'مصاريف أخرى' : 'Other'}
                  </option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="tpl-amount"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'المبلغ الافتراضي (JOD)' : 'Default Amount (JOD)'}
                </label>
                <input
                  id="tpl-amount"
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  value={tplAmount}
                  onChange={(e) => setTplAmount(e.target.value)}
                  placeholder="15.00"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm tabular-nums"
                />
              </div>
            </div>

            {tplCategory === 'parts_purchase' && (
              <div className="space-y-1.5">
                <label
                  htmlFor="tpl-part-type"
                  className="text-xs font-bold text-slate-700 block"
                >
                  {lang === 'ar' ? 'نوع القطع الافتراضي' : 'Default Part Type'}
                </label>
                <input
                  id="tpl-part-type"
                  type="text"
                  value={tplPartType}
                  onChange={(e) => setTplPartType(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: كوابل Cat6 + رؤوس RJ45' : 'e.g. Cat6 Cables'}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            )}

            <button
              type="submit"
              className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#E58E26] hover:bg-[#d17d1b] text-white font-bold text-sm flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {editTplId
                  ? lang === 'ar'
                    ? 'حفظ تعديل المصروف الجاهز'
                    : 'Update Template'
                  : lang === 'ar'
                  ? 'إضافة مصروف جاهز'
                  : 'Add Ready Expense'}
              </span>
            </button>
          </form>

          <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm divide-y divide-slate-200">
            {filteredTemplates.length === 0 ? (
              <p className="py-6 text-center text-xs sm:text-sm text-slate-500">
                {lang === 'ar'
                  ? 'لا توجد مصاريف جاهزة حالياً.'
                  : 'No ready-made expense templates yet.'}
              </p>
            ) : null}
            {filteredTemplates.map((t) => (
              <div
                key={t.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {t.title}
                  </div>
                  <div className="text-xs text-slate-600 font-mono tabular-nums mt-0.5">
                    {formatJod(t.defaultAmountJod, lang)}
                    {t.partType ? ` · ${t.partType}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTplId(t.id);
                      setTplTitle(t.title);
                      setTplCategory(t.category);
                      setTplAmount(String(t.defaultAmountJod));
                      setTplPartType(t.partType || '');
                      setTplNotes(t.notes || '');
                      tplFormRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                    }}
                    aria-label={lang === 'ar' ? `تعديل قالب ${t.title}` : `Edit template ${t.title}`}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 text-[#0B3B68] text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          kind: 'template',
                          id: t.id,
                          label: t.title,
                        })
                      }
                      aria-label={lang === 'ar' ? `حذف قالب ${t.title}` : `Delete template ${t.title}`}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer Statement & History Modal */}
      {statementCustomer && (() => {
        const custVisits = visits.filter(
          (v) =>
            v.customerName.trim().toLowerCase() ===
            statementCustomer.name.trim().toLowerCase()
        );
        const custAppointments = appointments.filter(
          (a) =>
            a.customerName.trim().toLowerCase() ===
            statementCustomer.name.trim().toLowerCase()
        );
        const totalPaid = custVisits
          .filter((v) => v.isPaid)
          .reduce((acc, v) => acc + v.amountJod, 0);
        const totalUnpaid = custVisits
          .filter((v) => !v.isPaid && v.amountJod > 0)
          .reduce((acc, v) => acc + v.amountJod, 0);

        const handleCopyStatement = () => {
          const lines = [
            `شركة المدار لتجارة تكنولوجيا المعلومات`,
            `Al-Madar Information Technology Trading Company`,
            `--------------------------------`,
            `كشف حساب وسجل صيانة الزبون: ${statementCustomer.name}`,
            statementCustomer.phone ? `رقم الهاتف: ${statementCustomer.phone}` : '',
            `عدد الزيارات المسجلة: ${custVisits.length}`,
            `إجمالي المدفوع: ${formatJod(totalPaid, 'ar')}`,
            `إجمالي الذمم غير المدفوعة: ${formatJod(totalUnpaid, 'ar')}`,
            `--------------------------------`,
            ...custVisits.map((v, idx) => {
              const isResolved = Boolean(v.isResolved || v.status === 'resolved');
              return `${idx + 1}. [${v.visitDate}] ${v.problem} — الحالة: ${
                isResolved ? 'منجز' : 'قيد الإنجاز'
              } — ${formatJod(v.amountJod, 'ar')} (${v.isPaid ? 'مدفوع' : 'غير مدفوع'})`;
            }),
            `--------------------------------`,
            `بيانات الدفع والتحويل عبر خدمة كلك (CliQ):`,
            `• رقم كلك: ${CLIQ_PAYMENT_INFO.cliqNumber}`,
            `• الاسم: ${CLIQ_PAYMENT_INFO.recipientName}`,
            `• البنك: ${CLIQ_PAYMENT_INFO.bankName}`,
          ].filter(Boolean);

          if (navigator.clipboard) {
            navigator.clipboard.writeText(lines.join('\n'));
          }
          setCopiedBanner(
            lang === 'ar'
              ? 'تم نسخ كشف حساب الزبون مع بيانات كلك لإرساله عبر واتساب'
              : 'Customer statement with CliQ details copied for WhatsApp'
          );
          setTimeout(() => setCopiedBanner(''), 3500);
        };

        const statementFileName = `AlMadar_Statement_${statementCustomer.name}_${getTodayStr()}.pdf`;

        const handleDownloadStatementPdf = async () => {
          if (!statementContainerRef.current || isStatementPdfBusy) return;
          setIsStatementPdfBusy(true);
          try {
            const generated = await downloadPdfFromElement(
              statementContainerRef.current,
              statementFileName,
              preparedStatementPdf
            );
            if (!preparedStatementPdf) {
              setPreparedStatementPdf(generated);
            }
            setCopiedBanner(
              lang === 'ar'
                ? `تم تنزيل كشف الحساب (${generated.fileName}) بصيغة PDF بنجاح!`
                : 'Statement .pdf downloaded!'
            );
            setTimeout(() => setCopiedBanner(''), 4000);
          } finally {
            setIsStatementPdfBusy(false);
          }
        };

        const handleWhatsAppStatementPdf = async () => {
          if (!statementContainerRef.current || isStatementPdfBusy) return;
          const sharePromise = sharePdfReportViaWhatsApp({
            element: statementContainerRef.current,
            fileName: statementFileName,
            phone: statementCustomer.phone,
            reportTitle:
              lang === 'ar'
                ? `كشف حساب وسجل صيانة الزبون: ${statementCustomer.name}`
                : `Customer Statement: ${statementCustomer.name}`,
            preGenerated: preparedStatementPdf,
          });
          setIsStatementPdfBusy(true);
          try {
            const res = await sharePromise;
            setCopiedBanner(
              res === 'shared_native_pdf'
                ? lang === 'ar'
                  ? 'تم فتح المشاركة المباشرة لملف كشف الحساب (.pdf) عبر واتس اب!'
                  : 'Opened direct .pdf share for WhatsApp!'
                : lang === 'ar'
                ? 'تم تنزيل ملف كشف الحساب (.pdf) وإرساله عبر واتس اب!'
                : 'Statement .pdf downloaded and sent to WhatsApp!'
            );
            setTimeout(() => setCopiedBanner(''), 4500);
          } finally {
            setIsStatementPdfBusy(false);
          }
        };

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div
              ref={statementContainerRef}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <div className="text-xs font-bold text-[#1E824C]">
                    شركة المدار لتجارة تكنولوجيا المعلومات · Al-Madar Information Technology Trading Company
                  </div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-[#0B3B68] mt-0.5">
                    {lang === 'ar'
                      ? `كشف حساب وسجل الزبون: ${statementCustomer.name}`
                      : `Customer Statement & History: ${statementCustomer.name}`}
                  </h3>
                  {statementCustomer.phone && (
                    <div
                      dir="ltr"
                      className="text-xs font-mono font-bold text-slate-600 mt-1 inline-block"
                    >
                      {statementCustomer.phone}
                    </div>
                  )}
                </div>

                <div className="no-print flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openCustomerEdit(statementCustomer)}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-[#0B3B68] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#E58E26]" />
                    <span>{lang === 'ar' ? 'تعديل الزبون' : 'Edit Customer'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatementCustomer(null)}
                    className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {copiedBanner && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[#145A32] text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{copiedBanner}</span>
                </div>
              )}

              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500 font-bold">
                    {lang === 'ar' ? 'إجمالي الزيارات' : 'Total Visits'}
                  </div>
                  <div className="text-xl font-extrabold font-mono text-[#0B3B68] mt-1">
                    {custVisits.length}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                  <div className="text-xs text-[#145A32] font-bold">
                    {lang === 'ar' ? 'إجمالي المبالغ المدفوعة' : 'Total Paid'}
                  </div>
                  <div className="text-xl font-extrabold font-mono text-[#1E824C] mt-1">
                    {formatJod(totalPaid, lang)}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200">
                  <div className="text-xs text-amber-800 font-bold">
                    {lang === 'ar' ? 'الذمم غير المدفوعة' : 'Unpaid Balance'}
                  </div>
                  <div className="text-xl font-extrabold font-mono text-amber-800 mt-1">
                    {formatJod(totalUnpaid, lang)}
                  </div>
                </div>
              </div>

              {/* Visits History List */}
              <div className="space-y-2.5">
                <h4 className="text-sm font-extrabold text-slate-800">
                  {lang === 'ar' ? 'سجل طلبات وزيارات الصيانة' : 'Maintenance Visits History'}
                </h4>
                {custVisits.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center bg-slate-50 rounded-xl">
                    {lang === 'ar'
                      ? 'لا توجد زيارات صيانة مسجلة لهذا الزبون حتى الآن.'
                      : 'No maintenance visits recorded for this customer yet.'}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl px-4">
                    {custVisits.map((v) => {
                      const isUnpaid = isVisitUnpaid(v);
                      const isVisitResolved = Boolean(
                        v.isResolved || v.status === 'resolved'
                      );
                      return (
                        <div
                          key={v.id}
                          className={`py-3 px-2 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                            isUnpaid ? 'bg-rose-50/45 border-s-4 border-s-rose-500 my-1' : ''
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                              <span>{v.problem}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                  isVisitResolved
                                    ? 'bg-emerald-100 text-[#145A32]'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {isVisitResolved
                                  ? lang === 'ar'
                                    ? 'منجز (تم الحل)'
                                    : 'Completed'
                                  : lang === 'ar'
                                  ? 'قيد الإنجاز'
                                  : 'Pending'}
                              </span>
                              {isUnpaid && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-extrabold">
                                  {lang === 'ar' ? 'غير مدفوع' : 'Unpaid'}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-slate-600">
                              <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-bold">
                                <Calendar className="w-3 h-3 text-[#0B3B68]" />
                                <span>{getDayName(v.visitDate, lang)}</span>
                                <span dir="ltr" className="font-mono text-[#0B3B68]">
                                  {v.visitDate}
                                </span>
                              </span>
                              {v.installedParts.length > 0 && (
                                <span className="text-[#145A32] font-semibold">
                                  {lang === 'ar' ? 'قطع مركبة: ' : 'Parts: '}
                                  {v.installedParts.join(' + ')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0 font-mono font-bold">
                            {/* 1. Completion Status Badge First (منجز قبل الدفع) */}
                            <span
                              className={`px-2 py-0.5 rounded-md font-sans text-[11px] font-extrabold ${
                                isVisitResolved
                                  ? 'bg-emerald-50 text-[#145A32] border border-emerald-200'
                                  : 'bg-amber-50 text-amber-900 border border-amber-200'
                              }`}
                            >
                              {isVisitResolved
                                ? lang === 'ar'
                                  ? '1. منجز ✓'
                                  : '1. Done ✓'
                                : lang === 'ar'
                                ? '1. غير منجز'
                                : '1. Not Done'}
                            </span>

                            {/* 2. Amount & Payment Status Second */}
                            {v.visitType === 'contract' ? (
                              <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 font-sans text-xs">
                                {lang === 'ar'
                                  ? 'عقد دوري (غير مدفوع)'
                                  : 'Contract (Unpaid)'}
                              </span>
                            ) : (
                              <>
                                <span>{formatJod(v.amountJod, lang)}</span>
                                <span
                                  className={`px-2 py-0.5 rounded-md ${
                                    v.isPaid
                                      ? 'bg-emerald-50 text-[#1E824C]'
                                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                                  }`}
                                >
                                  {v.isPaid
                                    ? lang === 'ar'
                                      ? '2. مدفوع'
                                      : '2. Paid'
                                    : lang === 'ar'
                                    ? '2. غير مدفوع'
                                    : '2. Unpaid'}
                                </span>
                              </>
                            )}
                            {isUnpaid && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReminderTarget({
                                    customerName: statementCustomer.name,
                                    phone: v.phone || statementCustomer.phone,
                                    unpaidVisits: [v],
                                  })
                                }
                                className="min-h-[32px] px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-100 hover:bg-amber-200 text-amber-950 font-sans text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                              >
                                <BellRing className="w-3.5 h-3.5 text-[#E58E26]" />
                                <span>{lang === 'ar' ? 'تذكير بالدفع' : 'Payment Reminder'}</span>
                              </button>
                            )}
                            {onSaveVisit && (
                              <button
                                type="button"
                                onClick={() => setEditingVisit(v)}
                                aria-label={
                                  lang === 'ar'
                                    ? `تعديل زيارة ${v.problem}`
                                    : `Edit visit ${v.problem}`
                                }
                                className="min-h-[32px] px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-[#0B3B68] font-sans text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[#155E95]" />
                                <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                              </button>
                            )}
                            {canDelete && onDeleteVisit && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({
                                    kind: 'visit',
                                    id: v.id,
                                    label: `${v.customerName} — ${v.problem} (${v.visitDate})`,
                                  })
                                }
                                aria-label={
                                  lang === 'ar'
                                    ? `حذف زيارة ${v.problem}`
                                    : `Delete visit ${v.problem}`
                                }
                                className="min-h-[32px] px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-sans text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

              {custAppointments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-extrabold text-slate-800">
                    {lang === 'ar' ? 'المواعيد المجدولة' : 'Scheduled Appointments'}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {custAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-xs font-bold text-[#0B3B68] flex items-center gap-2"
                      >
                        <span>{getDayName(apt.date, lang)}</span>
                        <span dir="ltr" className="font-mono">
                          {apt.date} ({apt.time})
                        </span>
                        <span>— {apt.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="no-print flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200">
                {custVisits.some((v) => isVisitUnpaid(v)) && (
                  <button
                    type="button"
                    onClick={() =>
                      setReminderTarget({
                        customerName: statementCustomer.name,
                        phone: statementCustomer.phone,
                        unpaidVisits: custVisits.filter((v) => isVisitUnpaid(v)),
                      })
                    }
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <BellRing className="w-4 h-4 text-[#E58E26]" />
                    <span>
                      {lang === 'ar' ? 'رسالة تذكير بالدفع' : 'Payment Reminder'}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleWhatsAppStatementPdf}
                  disabled={isStatementPdfBusy}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#1da851] disabled:opacity-60 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  {isStatementPdfBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>
                    {lang === 'ar'
                      ? 'إرسال الكشف واتس اب (.pdf)'
                      : 'WhatsApp (.pdf)'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadStatementPdf}
                  disabled={isStatementPdfBusy}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1E824C] hover:bg-[#145A32] disabled:opacity-60 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  {isStatementPdfBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4 text-amber-300" />
                  )}
                  <span>
                    {lang === 'ar' ? 'تنزيل الكشف (.pdf)' : 'Download (.pdf)'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyStatement}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>
                    {lang === 'ar' ? 'نسخ نص' : 'Copy Text'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'طباعة' : 'Print'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={
          deleteTarget?.kind === 'visit'
            ? lang === 'ar'
              ? 'تأكيد حذف طلب / زيارة الصيانة'
              : 'Confirm Delete Maintenance Visit'
            : lang === 'ar'
            ? 'تأكيد الحذف من الدليل'
            : 'Confirm Catalog Deletion'
        }
        itemName={deleteTarget?.label || ''}
        lang={lang}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'customer') onDeleteCustomer(deleteTarget.id);
          if (deleteTarget.kind === 'part') onDeletePart(deleteTarget.id);
          if (deleteTarget.kind === 'template')
            onDeleteExpenseTemplate(deleteTarget.id);
          if (deleteTarget.kind === 'visit' && onDeleteVisit)
            onDeleteVisit(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />

      {/* Edit Maintenance Visit Modal from Customer Statement */}
      {onSaveVisit && (
        <EditDailyMaintenanceModal
          lang={lang}
          visit={editingVisit}
          isOpen={!!editingVisit}
          onClose={() => setEditingVisit(null)}
          onSave={(updated) => {
            onSaveVisit(updated);
            setEditingVisit(null);
          }}
          customers={customers}
          parts={parts}
          defaultTechnicianName={currentUserFullName}
        />
      )}

      <PaymentReminderModal
        isOpen={Boolean(reminderTarget)}
        onClose={() => setReminderTarget(null)}
        lang={lang}
        customerName={reminderTarget?.customerName || ''}
        phone={reminderTarget?.phone}
        unpaidVisits={reminderTarget?.unpaidVisits || []}
        onMarkVisitPaid={
          onSaveVisit
            ? (visit) => {
                onSaveVisit({
                  ...visit,
                  isResolved: true,
                  status: 'resolved',
                  isPaid: true,
                });
                setReminderTarget((prev) => {
                  if (!prev) return null;
                  const remaining = prev.unpaidVisits.filter(
                    (u) => u.id !== visit.id
                  );
                  return remaining.length > 0
                    ? { ...prev, unpaidVisits: remaining }
                    : null;
                });
              }
            : undefined
        }
        onMarkAllPaid={
          onSaveVisit
            ? (visitsToPay) => {
                visitsToPay.forEach((v) =>
                  onSaveVisit({
                    ...v,
                    isResolved: true,
                    status: 'resolved',
                    isPaid: true,
                  })
                );
                setReminderTarget(null);
              }
            : undefined
        }
      />

      {/* Instant Edit Customer Modal (نافذة تعديل بيانات الزبون والعقد المباشرة) */}
      {isEditCustomerModalOpen && editCustId && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-customer-modal-title"
        >
          <form
            onSubmit={handleCustomerSubmit}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#0B3B68] text-white flex items-center justify-center shrink-0">
                  <Edit3 className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3
                    id="edit-customer-modal-title"
                    className="text-base sm:text-lg font-extrabold text-[#0B3B68]"
                  >
                    {lang === 'ar'
                      ? 'تعديل بيانات الزبون والعقد'
                      : 'Edit Customer & Contract Details'}
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    {lang === 'ar'
                      ? 'تحديث الاسم أو رقم الهاتف يتزامن تلقائياً مع جميع زيارات ومواعيد الزبون'
                      : 'Updating name or phone automatically syncs across all customer visits'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetCustomerForm}
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2 space-y-1.5">
                <label
                  htmlFor="modal-cust-name"
                  className="text-xs font-extrabold text-slate-700 block"
                >
                  {lang === 'ar' ? 'اسم الزبون / الشركة *' : 'Customer / Company Name *'}
                </label>
                <input
                  id="modal-cust-name"
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="modal-cust-phone"
                  className="text-xs font-extrabold text-slate-700 block"
                >
                  {lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                </label>
                <input
                  id="modal-cust-phone"
                  type="tel"
                  dir="ltr"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="079XXXXXXX"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="modal-cust-address"
                  className="text-xs font-extrabold text-slate-700 block"
                >
                  {lang === 'ar' ? 'العنوان / الموقع' : 'Address / Location'}
                </label>
                <input
                  id="modal-cust-address"
                  type="text"
                  value={custAddress}
                  onChange={(e) => setCustAddress(e.target.value)}
                  placeholder={lang === 'ar' ? 'عمان...' : 'Amman...'}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <span className="text-xs font-extrabold text-slate-700 block">
                  {lang === 'ar' ? 'نوع التعامل / العقد' : 'Contract Type'}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'annual', ar: 'عقد سنوي', en: 'Annual' },
                      { id: 'monthly', ar: 'عقد شهري', en: 'Monthly' },
                      { id: 'on_demand', ar: 'حسب الطلب', en: 'On-Demand' },
                    ] as const
                  ).map((ct) => (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => setCustContractType(ct.id)}
                      className={`min-h-[42px] px-2 py-2 rounded-xl text-xs font-extrabold border cursor-pointer transition-colors ${
                        custContractType === ct.id
                          ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {lang === 'ar' ? ct.ar : ct.en}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="modal-cust-fee"
                  className="text-xs font-extrabold text-slate-700 block"
                >
                  {lang === 'ar'
                    ? 'قيمة العقد / الزيارة الافتراضية (JOD)'
                    : 'Default Fee (JOD)'}
                </label>
                <input
                  id="modal-cust-fee"
                  type="number"
                  step="1"
                  min="0"
                  value={custFee}
                  onChange={(e) => setCustFee(e.target.value)}
                  placeholder="0.00"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="modal-cust-notes"
                  className="text-xs font-extrabold text-slate-700 block"
                >
                  {lang === 'ar' ? 'ملاحظات العقد' : 'Contract Notes'}
                </label>
                <input
                  id="modal-cust-notes"
                  type="text"
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  placeholder={lang === 'ar' ? 'تفاصيل الأجهزة المشمولة...' : 'Covered devices...'}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={resetCustomerForm}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-bold cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-6 py-2 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>
                  {lang === 'ar' ? 'حفظ تعديل الزبون' : 'Save Customer Changes'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
