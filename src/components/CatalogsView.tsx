import React, { useState } from 'react';
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
  Printer,
  Copy,
  CheckCircle2,
  X,
  Calendar,
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
import { formatJod, getDayName, getTodayStr } from '../utils/logic';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

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
  onCreateVisitForCustomer: (customerName: string) => void;
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
  onCreateVisitForCustomer,
}) => {
  const [activeTab, setActiveTab] = useState<'customers' | 'parts' | 'templates'>(
    'customers'
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Customer Statement Modal State
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [copiedBanner, setCopiedBanner] = useState('');

  // Customer Form
  const [editCustId, setEditCustId] = useState<string | null>(null);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custContractType, setCustContractType] = useState<ContractType>('annual');
  const [custFee, setCustFee] = useState('');
  const [custNotes, setCustNotes] = useState('');

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
    kind: 'customer' | 'part' | 'template';
    id: string;
    label: string;
  } | null>(null);

  const q = searchQuery.trim().toLowerCase();
  const filteredCustomers = customers.filter(
    (c) =>
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.address || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
  );
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

    const record: Customer = {
      id: editCustId || `cust-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: custName.trim(),
      phone: custPhone.trim(),
      address: custAddress.trim(),
      contractType: custContractType,
      contractFeeJod: Number(custFee) || 0,
      notes: custNotes.trim(),
      createdAt: getTodayStr(),
    };
    onSaveCustomer(record);
    setEditCustId(null);
    setCustName('');
    setCustPhone('');
    setCustAddress('');
    setCustFee('');
    setCustNotes('');
  };

  const handlePartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim()) return;

    const record: PartItem = {
      id: editPartId || `part-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: partName.trim(),
      category: partCategory.trim() || 'قطع عامة',
      defaultCostJod: Number(partCost) || 0,
      defaultPriceJod: Number(partPrice) || 0,
      stockQty: Number(partStock) || 0,
    };
    onSavePart(record);
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
                ? 'دليل الزبائن والعقود · أنواع القطع · المصاريف الجاهزة'
                : 'Customers & Contracts · Parts Catalog · Ready Expenses'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              {lang === 'ar'
                ? 'إعداد القوائم الجاهزة والبحث السريع لتسهيل الإضافة في شاشات الصيانة والمالية'
                : 'Configure quick-select lists and search customers, parts, and templates'}
            </p>
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
          <form
            onSubmit={handleCustomerSubmit}
            className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4"
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
                  onClick={() => {
                    setEditCustId(null);
                    setCustName('');
                    setCustPhone('');
                    setCustAddress('');
                    setCustFee('');
                    setCustNotes('');
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
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

          <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm divide-y divide-slate-200">
            {filteredCustomers.length === 0 ? (
              <p className="py-8 text-center text-xs sm:text-sm text-slate-500">
                {lang === 'ar'
                  ? 'لا توجد أسماء زبائن مضافة حالياً. يمكنك إضافة زبون أعلاه أو سيتم ترحيل الزبائن تلقائياً عند تسجيل طلب صيانة أو موعد.'
                  : 'No customers added yet. Add a customer above or they will be transferred automatically from Maintenance or Schedule.'}
              </p>
            ) : null}
            {filteredCustomers.map((c) => {
              const custVisits = visits.filter(
                (v) => v.customerName.trim().toLowerCase() === c.name.trim().toLowerCase()
              );
              const paidJod = custVisits
                .filter((v) => v.isPaid)
                .reduce((acc, v) => acc + v.amountJod, 0);
              const unpaidJod = custVisits
                .filter((v) => !v.isPaid && v.amountJod > 0)
                .reduce((acc, v) => acc + v.amountJod, 0);

              return (
                <div
                  key={c.id}
                  className="py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-extrabold text-[#0B3B68]">{c.name}</h4>
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
                      {unpaidJod > 0 && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold font-mono tabular-nums">
                          {lang === 'ar'
                            ? `ذمم غير مدفوعة: ${formatJod(unpaidJod, lang)}`
                            : `Unpaid Balance: ${formatJod(unpaidJod, lang)}`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setStatementCustomer(c)}
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#0B3B68] border border-sky-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>
                        {lang === 'ar' ? 'كشف حساب وسجل الزبون' : 'Statement & History'}
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
                      onClick={() => {
                        setEditCustId(c.id);
                        setCustName(c.name);
                        setCustPhone(c.phone || '');
                        setCustAddress(c.address || '');
                        setCustContractType(c.contractType);
                        setCustFee(String(c.contractFeeJod || ''));
                        setCustNotes(c.notes || '');
                      }}
                      aria-label={lang === 'ar' ? `تعديل الزبون ${c.name}` : `Edit customer ${c.name}`}
                      className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-[#0B3B68] text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({
                          kind: 'customer',
                          id: c.id,
                          label: c.name,
                        })
                      }
                      aria-label={lang === 'ar' ? `حذف الزبون ${c.name}` : `Delete customer ${c.name}`}
                      className="min-h-[42px] px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: PARTS CATALOG */}
      {activeTab === 'parts' && (
        <div className="space-y-6">
          <form
            onSubmit={handlePartSubmit}
            className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4"
          >
            <h3 className="text-base font-extrabold text-[#1E824C]">
              {editPartId
                ? lang === 'ar'
                  ? 'تعديل نوع القطعة'
                  : 'Edit Part Item'
                : lang === 'ar'
                ? 'إضافة نوع قطعة جديد لسهولة الاختيار في الصيانة والمالية'
                : 'Add New Part Item to Catalog'}
            </h3>

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
              <p className="py-8 text-center text-xs sm:text-sm text-slate-500">
                {lang === 'ar'
                  ? 'لا توجد قطع مضافة حالياً. يمكنك إضافة قطعة أعلاه أو سيتم ترحيل القطع تلقائياً عند إضافتها في طلبات الصيانة أو شراء القطع في المالية.'
                  : 'No parts added yet. Add a part above or they will transfer automatically from Maintenance or Finance.'}
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
                    }}
                    aria-label={lang === 'ar' ? `تعديل القطعة ${p.name}` : `Edit part ${p.name}`}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 text-[#0B3B68] text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                  </button>
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
            onSubmit={handleTemplateSubmit}
            className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4"
          >
            <h3 className="text-base font-extrabold text-[#E58E26]">
              {editTplId
                ? lang === 'ar'
                  ? 'تعديل قالب مصروف جاهز'
                  : 'Edit Ready Expense Template'
                : lang === 'ar'
                ? 'إضافة مصروف جاهز لسهولة الاستخدام في شاشة المالية'
                : 'Add Ready-Made Expense Template'}
            </h3>

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
              <p className="py-8 text-center text-xs sm:text-sm text-slate-500">
                {lang === 'ar'
                  ? 'لا توجد مصاريف جاهزة مضافة حالياً. أضف قوالب المصاريف المتكررة أعلاه لسهولة اختيارها في صفحة المالية.'
                  : 'No ready-made expense templates yet. Add templates above for 1-tap use in Finance.'}
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
                    }}
                    aria-label={lang === 'ar' ? `تعديل قالب ${t.title}` : `Edit template ${t.title}`}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 text-[#0B3B68] text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                  </button>
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
            ...custVisits.map(
              (v, idx) =>
                `${idx + 1}. [${v.visitDate}] ${v.problem} — ${formatJod(v.amountJod, 'ar')} (${
                  v.isPaid ? 'مدفوع' : 'غير مدفوع'
                })`
            ),
          ].filter(Boolean);

          if (navigator.clipboard) {
            navigator.clipboard.writeText(lines.join('\n'));
          }
          setCopiedBanner(
            lang === 'ar'
              ? 'تم نسخ كشف حساب الزبون لإرساله عبر واتساب'
              : 'Customer statement copied for WhatsApp'
          );
          setTimeout(() => setCopiedBanner(''), 3500);
        };

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full p-5 sm:p-6 space-y-5 max-h-[90vh] overflow-y-auto">
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

                <button
                  type="button"
                  onClick={() => setStatementCustomer(null)}
                  className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
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
                    {custVisits.map((v) => (
                      <div
                        key={v.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900">{v.problem}</div>
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
                        <div className="flex items-center gap-2 shrink-0 font-mono font-bold">
                          <span>{formatJod(v.amountJod, lang)}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md ${
                              v.isPaid
                                ? 'bg-emerald-50 text-[#1E824C]'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {v.isPaid
                              ? lang === 'ar'
                                ? 'مدفوع'
                                : 'Paid'
                              : lang === 'ar'
                              ? 'غير مدفوع'
                              : 'Unpaid'}
                          </span>
                        </div>
                      </div>
                    ))}
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
              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCopyStatement}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>
                    {lang === 'ar' ? 'نسخ كشف الحساب للواتساب' : 'Copy Statement for WhatsApp'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'طباعة الكشف' : 'Print Statement'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={lang === 'ar' ? 'تأكيد الحذف من الدليل' : 'Confirm Catalog Deletion'}
        itemName={deleteTarget?.label || ''}
        lang={lang}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === 'customer') onDeleteCustomer(deleteTarget.id);
          if (deleteTarget.kind === 'part') onDeletePart(deleteTarget.id);
          if (deleteTarget.kind === 'template')
            onDeleteExpenseTemplate(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
