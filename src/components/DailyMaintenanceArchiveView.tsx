import React, { useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  Phone,
  Printer,
  Search,
  Trash2,
  Wrench,
} from 'lucide-react';
import type { Customer, Language, MaintenanceVisit, PartItem } from '../types';
import { formatJod, getDayName, getTodayStr, isVisitUnpaid } from '../utils/logic';
import { TouchDatePicker } from './TouchDateTimePicker';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { EditDailyMaintenanceModal } from './EditDailyMaintenanceModal';
import { DailyMaintenanceReportModal } from './DailyMaintenanceReportModal';

interface DailyMaintenanceArchiveViewProps {
  lang: Language;
  visits: MaintenanceVisit[];
  customers?: Customer[];
  parts?: PartItem[];
  onSaveVisit: (visit: MaintenanceVisit) => void;
  onUnarchiveVisit: (visitId: string) => void;
  onUnarchiveVisits?: (visitIds?: string[]) => number;
  onDeleteVisit: (visitId: string) => void;
  onBackToActiveRequests: () => void;
  canDelete?: boolean;
  canTransfer?: boolean;
  currentUserFullName?: string;
}

export const DailyMaintenanceArchiveView: React.FC<
  DailyMaintenanceArchiveViewProps
> = ({
  lang,
  visits,
  customers = [],
  parts = [],
  onSaveVisit,
  onUnarchiveVisit,
  onUnarchiveVisits,
  onDeleteVisit,
  onBackToActiveRequests,
  canDelete = true,
  canTransfer = true,
  currentUserFullName = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'resolved' | 'pending' | 'paid' | 'unpaid'
  >('all');
  const [statusBanner, setStatusBanner] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceVisit | null>(
    null
  );
  const [editingVisit, setEditingVisit] = useState<MaintenanceVisit | null>(
    null
  );
  const [printModalVisits, setPrintModalVisits] = useState<MaintenanceVisit[] | null>(null);

  // All visits archived into Daily Maintenance Requests
  const archivedVisits = visits.filter((v) => Boolean(v.isArchived));

  const filteredVisits = archivedVisits.filter((v) => {
    const isVisitResolved = Boolean(v.isResolved || v.status === 'resolved');
    if (selectedDate && v.visitDate !== selectedDate) return false;
    if (statusFilter === 'resolved' && !isVisitResolved) return false;
    if (statusFilter === 'pending' && isVisitResolved) return false;
    if (statusFilter === 'paid' && !v.isPaid) return false;
    if (statusFilter === 'unpaid' && !isVisitUnpaid(v))
      return false;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const hay = `${v.customerName} ${v.problem} ${v.phone || ''} ${
      v.note || ''
    } ${v.requiredParts.join(' ')} ${v.installedParts.join(' ')} ${
      v.technicianName || ''
    } ${v.visitDate}`.toLowerCase();
    return hay.includes(q);
  });

  // Group filtered visits by visitDate (descending)
  const uniqueDates = Array.from(
    new Set(filteredVisits.map((v) => v.visitDate))
  ).sort((a, b) => b.localeCompare(a));

  const totalArchivedCount = archivedVisits.length;
  const resolvedArchivedCount = archivedVisits.filter(
    (v) => v.isResolved || v.status === 'resolved'
  ).length;
  const paidArchivedTotalJod = archivedVisits
    .filter((v) => v.isPaid)
    .reduce((acc, v) => acc + (Number(v.amountJod) || 0), 0);
  const unpaidArchivedTotalJod = archivedVisits
    .filter((v) => isVisitUnpaid(v))
    .reduce((acc, v) => acc + (Number(v.amountJod) || 0), 0);
  const todayStr = getTodayStr();

  const activeVisitsCount = visits.filter((v) => !v.isArchived).length;

  return (
    <div className="space-y-5">
      {/* Side-by-Side Page Switcher: طلبات الصيانة بجانب صفحة القديمة */}
      <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
        <button
          type="button"
          onClick={onBackToActiveRequests}
          className="min-h-[42px] px-3 py-2 rounded-xl bg-slate-50 hover:bg-sky-50 text-[#0B3B68] border border-slate-200/80 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Wrench className="w-4 h-4 text-[#155E95] shrink-0" />
          <span>{lang === 'ar' ? 'طلبات الصيانة اليومية' : 'Maintenance Requests'}</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 text-2xs font-mono">
            {activeVisitsCount}
          </span>
        </button>

        <button
          type="button"
          className="min-h-[42px] px-3 py-2 rounded-xl bg-[#0B3B68] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          <Archive className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{lang === 'ar' ? 'صفحة الطلبات القديمة' : 'Old Requests Archive'}</span>
          <span className="px-2 py-0.5 rounded-full bg-white/15 text-2xs font-mono">
            {totalArchivedCount}
          </span>
        </button>
      </div>

      {/* Page Header */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0B3B68] text-white flex items-center justify-center shrink-0">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#0B3B68]">
              {lang === 'ar'
                ? 'طلبات القديمة — أرشيف وسجل الطلبات المرحّلة'
                : 'Old Requests — Archived Maintenance Log'}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'ar'
                ? 'تُؤرشف الطلبات في صفحة «طلبات القديمة» تلقائياً عند انتهاء اليوم أو عبر كبسة ترحيل الطلبات المنتهية دون ضياع أي معلومات مالية أو فنية'
                : 'Requests are archived in Old Requests automatically at the end of the day or via the Transfer Completed button without losing any data'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPrintModalVisits(filteredVisits)}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 shrink-0" />
            <span>{lang === 'ar' ? 'طباعة التقرير / واتس اب' : 'Print / WhatsApp'}</span>
          </button>

          {canTransfer && onUnarchiveVisits && filteredVisits.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const count = onUnarchiveVisits(filteredVisits.map((v) => v.id));
                if (count > 0) {
                  setStatusBanner(
                    lang === 'ar'
                      ? `تم إرجاع (${count}) طلبات إلى صفحة طلبات الصيانة النشطة بنجاح.`
                      : `Restored (${count}) requests to active Maintenance Requests.`
                  );
                  setTimeout(() => setStatusBanner(''), 4500);
                }
              }}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
            >
              <ArchiveRestore className="w-4 h-4 text-[#E58E26] shrink-0" />
              <span>
                {lang === 'ar'
                  ? `إرجاع الكل للنشطة (${filteredVisits.length})`
                  : `Restore All (${filteredVisits.length})`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onBackToActiveRequests}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <Wrench className="w-4 h-4 shrink-0" />
            <span>
              {lang === 'ar'
                ? 'العودة إلى صفحة طلبات الصيانة النشطة'
                : 'Back to Active Maintenance Requests'}
            </span>
          </button>
        </div>
      </div>

      {statusBanner && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs sm:text-sm font-bold flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#1E824C] shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            type="button"
            onClick={onBackToActiveRequests}
            className="min-h-[34px] px-3 py-1 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-300" />
            <span>{lang === 'ar' ? 'الانتقال إلى طلبات الصيانة' : 'Open Maintenance Requests'}</span>
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold">
            {lang === 'ar'
              ? 'إجمالي طلبات القديمة'
              : 'Total Old Requests'}
          </div>
          <div className="text-2xl font-mono font-extrabold tabular-nums text-[#0B3B68] mt-1">
            {totalArchivedCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold">
            {lang === 'ar' ? 'طلبات منجزة (تم الحل)' : 'Completed Requests'}
          </div>
          <div className="text-2xl font-mono font-extrabold tabular-nums text-[#1E824C] mt-1">
            {resolvedArchivedCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold">
            {lang === 'ar'
              ? 'إجمالي المحصّل في السجل اليومي'
              : 'Collected Revenue (JOD)'}
          </div>
          <div className="text-xl sm:text-2xl font-mono font-extrabold tabular-nums text-[#1E824C] mt-1">
            {formatJod(paidArchivedTotalJod, lang)}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold">
            {lang === 'ar' ? 'ذمم غير مدفوعة' : 'Unpaid Balance (JOD)'}
          </div>
          <div className="text-xl sm:text-2xl font-mono font-extrabold tabular-nums text-amber-700 mt-1">
            {formatJod(unpaidArchivedTotalJod, lang)}
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
          {/* Date Filter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                {lang === 'ar'
                  ? 'تصفية حسب تاريخ اليوم'
                  : 'Filter by Day Date'}
              </span>
              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="text-xs font-bold text-[#E58E26] hover:underline cursor-pointer"
                >
                  {lang === 'ar' ? 'عرض كل الأيام' : 'Show All Days'}
                </button>
              )}
            </div>
            <TouchDatePicker
              id="daily-archive-date-filter"
              value={selectedDate}
              onChange={setSelectedDate}
              lang={lang}
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 block">
              {lang === 'ar' ? 'حالة الطلب أو الدفع' : 'Request / Payment Status'}
            </span>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
              {(
                [
                  { id: 'all', ar: 'الكل', en: 'All' },
                  { id: 'resolved', ar: 'تم الحل', en: 'Resolved' },
                  { id: 'pending', ar: 'قيد المتابعة', en: 'Pending' },
                  { id: 'paid', ar: 'مدفوع', en: 'Paid' },
                  { id: 'unpaid', ar: 'غير مدفوع', en: 'Unpaid' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`min-h-[38px] flex-1 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-[#0B3B68] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang === 'ar' ? tab.ar : tab.en}
                </button>
              ))}
            </div>
          </div>

          {/* Search Input */}
          <div className="space-y-1.5">
            <label
              htmlFor="daily-archive-search"
              className="text-xs font-bold text-slate-700 block"
            >
              {lang === 'ar'
                ? 'بحث في طلبات القديمة'
                : 'Search Old Requests'}
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                id="daily-archive-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? 'ابحث بالزبون، الهاتف، العطل، القطع، أو التاريخ...'
                    : 'Search customer, phone, issue, parts, or date...'
                }
                className="w-full min-h-[44px] ps-9 pe-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grouped Daily Maintenance Requests */}
      {uniqueDates.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-12 text-center space-y-3 shadow-sm">
          <Archive className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm sm:text-base font-extrabold text-slate-800">
            {lang === 'ar'
              ? 'لا توجد طلبات قديمة مطابقة للفلتر الحالي'
              : 'No old requests match the current filter'}
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {lang === 'ar'
              ? 'تنتقل الطلبات إلى هذه الصفحة تلقائياً عند انتهاء اليوم، كما يمكنك ترحيل الطلبات المنتهية فوراً من صفحة «طلبات الصيانة».'
              : 'Requests move here automatically when the day ends, or you can transfer completed requests from the Maintenance page.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {uniqueDates.map((dateStr) => {
            const dayVisits = filteredVisits.filter(
              (v) => v.visitDate === dateStr
            );
            const dayTotalJod = dayVisits.reduce(
              (acc, v) => acc + (Number(v.amountJod) || 0),
              0
            );

            return (
              <div
                key={dateStr}
                className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Day Group Header */}
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-[#0B3B68]" />
                    <span className="text-sm sm:text-base font-extrabold text-[#0B3B68]">
                      {getDayName(dateStr, lang)}
                    </span>
                    <span
                      dir="ltr"
                      className="font-mono text-xs sm:text-sm font-extrabold text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200"
                    >
                      {dateStr}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                    <span className="text-slate-600">
                      {lang === 'ar'
                        ? `عدد الطلبات: ${dayVisits.length}`
                        : `Requests: ${dayVisits.length}`}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono font-extrabold text-[#1E824C]">
                      {formatJod(dayTotalJod, lang)}
                    </span>

                    <button
                      type="button"
                      onClick={() => setPrintModalVisits(dayVisits)}
                      className="min-h-[32px] px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-[#0B3B68] text-[11px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#155E95] shrink-0" />
                      <span>{lang === 'ar' ? 'طباعة اليوم' : 'Print Day'}</span>
                    </button>

                    {canTransfer && onUnarchiveVisits && (
                      <button
                        type="button"
                        onClick={() => {
                          const count = onUnarchiveVisits(
                            dayVisits.map((v) => v.id)
                          );
                          if (count > 0) {
                            setStatusBanner(
                              lang === 'ar'
                                ? `تم إرجاع طلبات يوم (${dateStr}) وعددها (${count}) إلى طلبات الصيانة النشطة.`
                                : `Restored (${count}) requests from (${dateStr}) to active Maintenance Requests.`
                            );
                            setTimeout(() => setStatusBanner(''), 4500);
                          }
                        }}
                        className="min-h-[34px] px-3 py-1 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 text-[11px] sm:text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5 text-[#E58E26] shrink-0" />
                        <span>{lang === 'ar' ? 'إرجاع اليوم' : 'Restore Day'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Day Visits List */}
                <div className="divide-y divide-slate-200 p-4 sm:p-5">
                  {dayVisits.map((v) => {
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
                        className="py-4 first:pt-1 last:pb-1 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors px-2 rounded-xl"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base font-extrabold text-[#0B3B68]">
                              <bdi>{v.customerName}</bdi>
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
                                <span
                                  className="text-slate-300"
                                  aria-hidden="true"
                                >
                                  ·
                                </span>
                                <span className="text-xs font-bold text-[#E58E26]">
                                  {lang === 'ar'
                                    ? 'وارد من شاشة الزبائن'
                                    : 'From Customer Portal'}
                                </span>
                              </>
                            )}
                            {v.phone && (
                              <>
                                <span
                                  className="text-slate-300"
                                  aria-hidden="true"
                                >
                                  ·
                                </span>
                                <span className="text-xs font-mono tabular-nums text-slate-600 inline-flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {v.phone}
                                </span>
                              </>
                            )}
                          </div>

                          <p className="text-sm font-semibold text-slate-800 leading-relaxed break-words">
                            <bdi>{v.problem}</bdi>
                          </p>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1.5 text-slate-800 font-bold bg-slate-100 px-3 py-1 rounded-lg">
                              <Clock className="w-3.5 h-3.5 text-[#E58E26]" />
                              <span dir="ltr" className="font-mono tabular-nums">
                                {v.visitTime}
                              </span>
                            </span>
                            {v.nextVisitDate && (
                              <span className="inline-flex items-center gap-1.5 text-[#155E95] font-bold bg-sky-50 px-3 py-1 rounded-lg border border-sky-200">
                                <span>
                                  {lang === 'ar'
                                    ? 'الزيارة القادمة:'
                                    : 'Next Visit:'}
                                </span>
                                <span>{getDayName(v.nextVisitDate, lang)}</span>
                                <span
                                  dir="ltr"
                                  className="font-mono tabular-nums"
                                >
                                  {v.nextVisitDate}
                                </span>
                              </span>
                            )}
                            {v.requiredParts.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {lang === 'ar'
                                    ? 'القطع اللازمة: '
                                    : 'Required: '}
                                  <strong className="text-slate-800">
                                    <bdi>{v.requiredParts.join(' + ')}</bdi>
                                  </strong>
                                </span>
                              </>
                            )}
                            {v.installedParts.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#145A32]">
                                  {lang === 'ar'
                                    ? 'تم تركيب: '
                                    : 'Installed: '}
                                  <strong>
                                    <bdi>{v.installedParts.join(' + ')}</bdi>
                                  </strong>
                                </span>
                              </>
                            )}
                          </div>

                          {v.note && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 leading-relaxed break-words">
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                              <bdi>{v.note}</bdi>
                            </p>
                          )}
                        </div>

                        {/* Compact Single-Line Action Bar: منجز قبل الدفع + تعديل + إرجاع + حذف */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 w-full lg:w-auto shrink-0">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-mono text-xs font-extrabold tabular-nums text-[#0B3B68] shrink-0">
                            {v.visitType === 'contract'
                              ? lang === 'ar'
                                ? 'عقد دوري'
                                : 'Contract'
                              : v.noPayment
                              ? lang === 'ar'
                                ? 'بدون دفع'
                                : 'No Payment'
                              : formatJod(v.amountJod, lang)}
                          </span>

                          {/* 1. Completion Status (منجز قبل الدفع) */}
                          <button
                            type="button"
                            onClick={() => {
                              const isResolved = Boolean(
                                v.isResolved || v.status === 'resolved'
                              );
                              const nextResolved = !isResolved;
                              onSaveVisit({
                                ...v,
                                isResolved: nextResolved,
                                status: nextResolved ? 'resolved' : 'pending',
                                isPaid: nextResolved ? v.isPaid : false,
                              });
                            }}
                            className={`flex-1 sm:flex-initial min-h-[32px] px-2.5 py-1 rounded-lg border text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                              v.isResolved || v.status === 'resolved'
                                ? 'border-emerald-300 bg-emerald-50 text-[#145A32] hover:bg-emerald-100'
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <CheckCircle2
                              className={`w-3.5 h-3.5 shrink-0 ${
                                v.isResolved || v.status === 'resolved'
                                  ? 'text-[#1E824C]'
                                  : 'text-slate-400'
                              }`}
                            />
                            <span>
                              {v.isResolved || v.status === 'resolved'
                                ? lang === 'ar'
                                  ? 'منجز'
                                  : 'Done'
                                : lang === 'ar'
                                ? 'إنجاز'
                                : 'Resolve'}
                            </span>
                          </button>

                          {/* 2. Payment Status (الدفع بعد الإنجاز) */}
                          {v.visitType !== 'contract' && (
                            <button
                              type="button"
                              onClick={() => {
                                const isResolved = Boolean(
                                  v.isResolved || v.status === 'resolved'
                                );
                                if (v.noPayment) {
                                  onSaveVisit({
                                    ...v,
                                    noPayment: false,
                                    isPaid: isResolved,
                                  });
                                  return;
                                }
                                if (!v.isPaid && !isResolved) {
                                  setStatusBanner(
                                    lang === 'ar'
                                      ? `تنبيه: يجب أن يكون الطلب «منجز (تم الحل)» أولاً قبل تسجيل الدفع للزبون «${v.customerName}».`
                                      : `Notice: Request for "${v.customerName}" must be marked Completed before marking as Paid.`
                                  );
                                  setTimeout(() => setStatusBanner(''), 4500);
                                  return;
                                }
                                onSaveVisit({ ...v, isPaid: !v.isPaid });
                              }}
                              className={`flex-1 sm:flex-initial min-h-[32px] px-2.5 py-1 rounded-lg border text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                                v.noPayment
                                  ? 'border-slate-300 bg-slate-100 text-[#0B3B68] hover:bg-slate-200'
                                  : v.isPaid
                                  ? 'border-emerald-300 bg-emerald-50 text-[#145A32] hover:bg-emerald-100'
                                  : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                              }`}
                            >
                              <Banknote className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {v.noPayment
                                  ? lang === 'ar'
                                    ? 'بدون دفع'
                                    : 'No Payment'
                                  : v.isPaid
                                  ? `${lang === 'ar' ? 'مدفوع' : 'Paid'} (${pmLabel})`
                                  : lang === 'ar'
                                  ? 'غير مدفوع'
                                  : 'Unpaid'}
                              </span>
                            </button>
                          )}

                          {/* 3. Edit (تعديل) */}
                          <button
                            type="button"
                            onClick={() => setEditingVisit(v)}
                            aria-label={
                              lang === 'ar'
                                ? `تعديل طلب ${v.customerName}`
                                : `Edit visit ${v.customerName}`
                            }
                            className="flex-1 sm:flex-initial min-h-[32px] px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50/90 hover:bg-indigo-100 text-[#0B3B68] text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-[#155E95] shrink-0" />
                            <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                          </button>

                          {/* 4. Restore (إرجاع) */}
                          {canTransfer && (
                            <button
                              type="button"
                              onClick={() => {
                                onUnarchiveVisit(v.id);
                                setStatusBanner(
                                  lang === 'ar'
                                    ? `تم إرجاع طلب "${v.customerName}" إلى صفحة طلبات الصيانة النشطة.`
                                    : `Restored "${v.customerName}" to active Maintenance Requests.`
                                );
                                setTimeout(() => setStatusBanner(''), 4000);
                              }}
                              title={
                                lang === 'ar'
                                  ? 'إرجاع للطلبات النشطة'
                                  : 'Restore to Active'
                              }
                              className="flex-1 sm:flex-initial min-h-[32px] px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50/90 hover:bg-amber-100 text-amber-900 text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5 text-[#E58E26] shrink-0" />
                              <span>{lang === 'ar' ? 'إرجاع' : 'Restore'}</span>
                            </button>
                          )}

                          {/* 5. Delete (حذف) */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(v)}
                              aria-label={
                                lang === 'ar'
                                  ? `حذف زيارة ${v.customerName}`
                                  : `Delete visit ${v.customerName}`
                              }
                              className="flex-1 sm:flex-initial min-h-[32px] px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50/90 hover:bg-rose-100 text-rose-700 text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
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
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Daily Maintenance Request Modal */}
      {editingVisit && (
        <EditDailyMaintenanceModal
          lang={lang}
          visit={editingVisit}
          isOpen={Boolean(editingVisit)}
          onClose={() => setEditingVisit(null)}
          onSave={(updated) => {
            onSaveVisit(updated);
            setEditingVisit(null);
            setStatusBanner(
              lang === 'ar'
                ? `تم حفظ وتحديث طلب الصيانة لـ «${updated.customerName}» بنجاح دون ضياع أي معلومات.`
                : `Updated maintenance request for "${updated.customerName}" successfully without data loss.`
            );
            setTimeout(() => setStatusBanner(''), 4500);
          }}
          customers={customers}
          parts={parts}
          defaultTechnicianName={currentUserFullName}
        />
      )}

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={
          lang === 'ar'
            ? 'تأكيد حذف طلب الصيانة المؤرشف'
            : 'Confirm Deleting Archived Maintenance Request'
        }
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
            setStatusBanner(
              lang === 'ar'
                ? 'تم حذف طلب الصيانة من الأرشيف بنجاح.'
                : 'Maintenance request deleted successfully.'
            );
            setTimeout(() => setStatusBanner(''), 4000);
          }
        }}
      />

      <DailyMaintenanceReportModal
        isOpen={Boolean(printModalVisits)}
        onClose={() => setPrintModalVisits(null)}
        lang={lang}
        allVisits={visits}
        initialVisits={printModalVisits || undefined}
        initialPeriod="all"
        initialReferenceDate={printModalVisits?.[0]?.visitDate || undefined}
        initialScope="custom_list"
        currentUserFullName={currentUserFullName}
      />
    </div>
  );
};
