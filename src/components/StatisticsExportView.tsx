import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
  X,
  CheckCircle2,
} from 'lucide-react';
import type { AppState, Language, ReportPeriod } from '../types';
import {
  calculateFinancialSummary,
  formatJod,
  generateCsvContent,
  getDayName,
  getTodayStr,
  isDateInRange,
} from '../utils/logic';
import { FinancialReportPdfModal } from './FinancialReportPdfModal';

interface StatisticsExportViewProps {
  lang: Language;
  state: AppState;
}

export const StatisticsExportView: React.FC<StatisticsExportViewProps> = ({
  lang,
  state,
}) => {
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [referenceDate, setReferenceDate] = useState(getTodayStr());
  const [searchQuery, setSearchQuery] = useState('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [exportNotice, setExportNotice] = useState('');

  const summary = calculateFinancialSummary(state, period, referenceDate);
  const q = searchQuery.trim().toLowerCase();

  const periodVisits = state.visits.filter(
    (v) =>
      isDateInRange(v.visitDate, summary.startDate, summary.endDate) &&
      (!q ||
        v.customerName.toLowerCase().includes(q) ||
        (v.phone || '').toLowerCase().includes(q) ||
        v.problem.toLowerCase().includes(q) ||
        v.installedParts.some((p) => p.toLowerCase().includes(q)) ||
        v.visitDate.includes(q))
  );
  const periodExpenses = state.expenses.filter(
    (e) =>
      isDateInRange(e.date, summary.startDate, summary.endDate) &&
      (!q ||
        e.title.toLowerCase().includes(q) ||
        (e.partType || '').toLowerCase().includes(q) ||
        e.date.includes(q))
  );
  const periodMorningCash = state.morningCash.filter(
    (m) =>
      isDateInRange(m.date, summary.startDate, summary.endDate) &&
      (!q || (m.note || '').toLowerCase().includes(q) || m.date.includes(q))
  );

  const handleExportExcel = () => {
    const csvContent = generateCsvContent(
      periodVisits,
      periodExpenses,
      periodMorningCash,
      summary,
      lang
    );
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `AlMadar_Report_${period}_${referenceDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice(
      lang === 'ar'
        ? 'تم تصدير وتحميل ملف الإكسل (CSV المنسق للغة العربية) بنجاح.'
        : 'Excel report (.csv) exported and downloaded successfully.'
    );
    setTimeout(() => setExportNotice(''), 4000);
  };

  const handleOpenPdfReport = () => {
    setShowPdfPreview(true);
  };

  const periodLabel =
    period === 'daily'
      ? lang === 'ar'
        ? 'ملخص العمل والمالية اليومي'
        : 'Daily Work & Financial Summary'
      : period === 'weekly'
      ? lang === 'ar'
        ? 'ملخص العمل والمالية الأسبوعي'
        : 'Weekly Work & Financial Summary'
      : period === 'monthly'
      ? lang === 'ar'
        ? 'ملخص العمل والمالية الشهري'
        : 'Monthly Work & Financial Summary'
      : lang === 'ar'
      ? 'التقرير الشامل الكامل'
      : 'Complete All-Time Summary';

  return (
    <div className="space-y-6">
      {/* Top Controls & Export Bar */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-6 shadow-sm space-y-5 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#0B3B68] text-white flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-base sm:text-xl font-extrabold text-[#0B3B68] leading-snug break-words">
                {lang === 'ar'
                  ? 'شاشة الإحصاءات والجدول التفصيلي وتصدير التقارير'
                  : 'Statistics, Detailed Table & Report Exports'}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed break-words">
                {lang === 'ar'
                  ? `${periodLabel} (${summary.startDate} إلى ${summary.endDate})`
                  : `${periodLabel} (${summary.startDate} to ${summary.endDate})`}
              </p>
            </div>
          </div>

          {/* Export Buttons: Excel + PDF — Full width on mobile so all text appears completely */}
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <button
              type="button"
              onClick={handleExportExcel}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer text-center leading-snug"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span className="break-words">
                {lang === 'ar'
                  ? 'تصدير ملخص العمل والمالية (Excel)'
                  : 'Export Summary (Excel)'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleOpenPdfReport}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer text-center leading-snug"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="break-words">
                {lang === 'ar'
                  ? 'تصدير ومعاينة التقرير الرسمي (PDF / طباعة)'
                  : 'Export & Preview Official PDF Report'}
              </span>
            </button>
          </div>
        </div>

        {exportNotice && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-bold flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-[#1E824C] shrink-0" />
            <span className="break-words">{exportNotice}</span>
          </div>
        )}

        {/* Direct PDF Export Bar — تصدير التقارير المالية فقط */}
        <div className="pt-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#0B3B68]">
            <Printer className="w-4 h-4 text-[#1E824C] shrink-0" />
            <span className="break-words">
              {lang === 'ar'
                ? 'تصدير التقارير المالية بصيغة PDF (يومي، أسبوعي، شهري، وشامل كامل):'
                : 'Export Financial Reports as PDF (Daily, Weekly, Monthly, Complete All):'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
            {(
              [
                { id: 'daily', ar: 'تصدير اليومي PDF', en: 'Daily PDF' },
                { id: 'weekly', ar: 'تصدير الأسبوعي PDF', en: 'Weekly PDF' },
                { id: 'monthly', ar: 'تصدير الشهري PDF', en: 'Monthly PDF' },
                { id: 'all', ar: 'تصدير الشامل الكامل PDF', en: 'Complete All PDF' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => {
                  setPeriod(btn.id);
                  setShowPdfPreview(true);
                }}
                className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer text-center leading-snug break-words shadow-2xs ${
                  btn.id === 'all'
                    ? 'bg-[#0B3B68] hover:bg-[#155E95] text-white'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-[#145A32] border border-emerald-200'
                }`}
              >
                <FileText
                  className={`w-3.5 h-3.5 shrink-0 ${
                    btn.id === 'all' ? 'text-amber-300' : 'text-[#1E824C]'
                  }`}
                />
                <span>{lang === 'ar' ? btn.ar : btn.en}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Search Input for Detailed Statistics Tables */}
        <div className="relative pt-1">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'ابحث في الجداول التفصيلية (اسم الزبون، المشكلة، القطع المركبة، المصروف، التاريخ)...'
                : 'Search detailed tables (customer, problem, installed parts, expense, date)...'
            }
            aria-label={lang === 'ar' ? 'بحث في الإحصاءات' : 'Search statistics'}
            className="w-full min-h-[46px] ps-10 pe-4 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
          />
        </div>
      </div>

      {/* Summary Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-500">
            {lang === 'ar' ? 'إجمالي زيارات وطلبات الصيانة' : 'Total Maintenance Visits'}
          </div>
          <div className="text-3xl font-mono font-extrabold tabular-nums text-[#0B3B68] mt-2">
            {summary.visitsCount}
          </div>
          <div className="text-xs text-slate-600 mt-2">
            {lang === 'ar'
              ? `تم الحل: ${summary.resolvedVisitsCount} · قيد المتابعة: ${summary.pendingVisitsCount}`
              : `Resolved: ${summary.resolvedVisitsCount} · Pending: ${summary.pendingVisitsCount}`}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-500">
            {lang === 'ar' ? 'مقبوضات الصيانة المدفوعة' : 'Paid Maintenance Revenue'}
          </div>
          <div className="text-3xl font-mono font-extrabold tabular-nums text-[#1E824C] mt-2">
            {formatJod(summary.totalRevenueJod, lang)}
          </div>
          <div className="text-xs text-slate-600 font-mono tabular-nums mt-2">
            {lang === 'ar'
              ? `ذمم غير مدفوعة (${summary.unpaidVisitsCount}): ${formatJod(summary.unpaidTotalJod, lang)}`
              : `Unpaid (${summary.unpaidVisitsCount}): ${formatJod(summary.unpaidTotalJod, lang)}`}
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-500">
            {lang === 'ar' ? 'إجمالي المصاريف التشغيلية' : 'Total Operating Expenses'}
          </div>
          <div className="text-3xl font-mono font-extrabold tabular-nums text-rose-600 mt-2">
            {formatJod(summary.totalExpensesJod, lang)}
          </div>
          <div className="text-xs text-slate-600 font-mono tabular-nums mt-2">
            {lang === 'ar'
              ? `بنزين: ${summary.expensesByCategory.fuel} · سيارة: ${summary.expensesByCategory.car_repair} · قطع: ${summary.expensesByCategory.parts_purchase}`
              : `Fuel: ${summary.expensesByCategory.fuel} · Car: ${summary.expensesByCategory.car_repair} · Parts: ${summary.expensesByCategory.parts_purchase}`}
          </div>
        </div>

        <div className="rounded-2xl bg-[#0B3B68] text-white p-5 shadow-sm">
          <div className="text-xs font-bold text-sky-200">
            {lang === 'ar'
              ? 'صافي الربح التشغيلي (وصافي الصندوق)'
              : 'Net Operating Profit (& Drawer)'}
          </div>
          <div className="text-3xl font-mono font-extrabold tabular-nums text-white mt-2">
            {formatJod(summary.netProfitJod, lang)}
          </div>
          <div className="text-xs text-amber-300 font-mono tabular-nums mt-2">
            {lang === 'ar'
              ? `صافي الكاش بالصندوق: ${formatJod(summary.netCashDrawerJod, lang)}`
              : `Net Drawer Cash: ${formatJod(summary.netCashDrawerJod, lang)}`}
          </div>
        </div>
      </div>

      {/* Full Detailed Table: Maintenance Work */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-extrabold text-[#0B3B68]">
            {lang === 'ar'
              ? `الجدول التفصيلي الكامل لطلبات وزيارات الصيانة (${periodVisits.length})`
              : `Complete Detailed Maintenance Work Table (${periodVisits.length})`}
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-extrabold">
                <th className="py-3 px-3 text-start">{lang === 'ar' ? 'التاريخ والوقت' : 'Date & Time'}</th>
                <th className="py-3 px-3 text-start">{lang === 'ar' ? 'اسم الزبون' : 'Customer'}</th>
                <th className="py-3 px-3 text-start">{lang === 'ar' ? 'المشكلة' : 'Problem'}</th>
                <th className="py-3 px-3 text-start">{lang === 'ar' ? 'القطع المركبة' : 'Installed Parts'}</th>
                <th className="py-3 px-3 text-start">{lang === 'ar' ? 'الزيارة القادمة' : 'Next Visit'}</th>
                <th className="py-3 px-3 text-start">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="py-3 px-3 text-start">{lang === 'ar' ? 'طريقة الدفع' : 'Method'}</th>
                <th className="py-3 px-3 text-end">{lang === 'ar' ? 'المبلغ (JOD)' : 'Amount (JOD)'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {periodVisits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    {lang === 'ar'
                      ? 'لا توجد سجلات صيانة في هذه الفترة.'
                      : 'No maintenance visits in this period.'}
                  </td>
                </tr>
              ) : (
                periodVisits.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700">
                          {getDayName(v.visitDate, lang)}
                        </span>
                        <span dir="ltr" className="font-mono tabular-nums text-[#0B3B68] font-bold">
                          {v.visitDate}
                        </span>
                        <span dir="ltr" className="font-mono tabular-nums text-slate-500">
                          {v.visitTime}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-bold text-[#0B3B68]">
                      {v.customerName}
                      {v.phone ? (
                        <div className="text-[11px] font-mono font-normal text-slate-500">
                          {v.phone}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 px-3 text-slate-800">{v.problem}</td>
                    <td className="py-3 px-3 text-slate-600">
                      {v.installedParts.join(' + ') || '-'}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-slate-600">
                      {v.nextVisitDate || '-'}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={
                          v.isResolved || v.status === 'resolved'
                            ? 'font-bold text-[#1E824C]'
                            : v.status === 'in_progress'
                            ? 'font-bold text-[#0B3B68]'
                            : 'font-bold text-[#E58E26]'
                        }
                      >
                        {v.isResolved || v.status === 'resolved'
                          ? lang === 'ar'
                            ? 'تم الحل'
                            : 'Resolved'
                          : v.status === 'in_progress'
                          ? lang === 'ar'
                            ? 'جاري العمل'
                            : 'In Progress'
                          : lang === 'ar'
                          ? 'قيد الانتظار'
                          : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {v.visitType === 'contract'
                        ? lang === 'ar'
                          ? 'عقد دوري (غير مدفوع)'
                          : 'Contract (Unpaid)'
                        : v.isPaid
                        ? v.paymentMethod === 'cash'
                          ? lang === 'ar'
                            ? 'مدفوع · كاش'
                            : 'Paid · Cash'
                          : v.paymentMethod === 'check'
                          ? lang === 'ar'
                            ? 'مدفوع · شيك'
                            : 'Paid · Check'
                          : lang === 'ar'
                          ? 'مدفوع · كلك'
                          : 'Paid · CliQ'
                        : lang === 'ar'
                        ? 'غير مدفوع'
                        : 'Unpaid'}
                    </td>
                    <td className="py-3 px-3 text-end font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                      {v.visitType === 'contract'
                        ? lang === 'ar'
                          ? 'عقد صيانة'
                          : 'Contract'
                        : formatJod(v.amountJod, lang)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Detailed Table: Financial Expenses & Morning Cash */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="text-base sm:text-lg font-extrabold text-[#0B3B68]">
          {lang === 'ar'
            ? `الجدول التفصيلي للمصاريف والكاش الصباحي (${periodExpenses.length + periodMorningCash.length})`
            : `Complete Detailed Financial Ledger (${periodExpenses.length + periodMorningCash.length})`}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-start border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-extrabold">
                <th className="py-3 px-3 text-start">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="py-3 px-3 text-start">{lang === 'ar' ? 'التصنيف' : 'Category'}</th>
                <th className="py-3 px-3 text-start">{lang === 'ar' ? 'البيان / الوصف' : 'Description'}</th>
                <th className="py-3 px-3 text-start">{lang === 'ar' ? 'نوع القطع' : 'Part Type'}</th>
                <th className="py-3 px-3 text-start">{lang === 'ar' ? 'طريقة الدفع' : 'Method'}</th>
                <th className="py-3 px-3 text-end">{lang === 'ar' ? 'المبلغ (JOD)' : 'Amount (JOD)'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {periodMorningCash.map((m) => (
                <tr key={m.id} className="bg-sky-50/40">
                  <td className="py-3 px-3 font-mono tabular-nums">{m.date}</td>
                  <td className="py-3 px-3 font-bold text-[#0B3B68]">
                    {lang === 'ar' ? 'كاش الصباح (افتتاحي)' : 'Morning Cash Float'}
                  </td>
                  <td className="py-3 px-3 text-slate-700">{m.note || '-'}</td>
                  <td className="py-3 px-3 text-slate-400">-</td>
                  <td className="py-3 px-3">{lang === 'ar' ? 'كاش' : 'Cash'}</td>
                  <td className="py-3 px-3 text-end font-mono font-bold tabular-nums text-[#0B3B68]">
                    +{formatJod(m.amountJod, lang)}
                  </td>
                </tr>
              ))}
              {periodExpenses.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-3 font-mono tabular-nums">{e.date}</td>
                  <td className="py-3 px-3 font-bold text-rose-700">
                    {e.category === 'fuel'
                      ? lang === 'ar'
                        ? 'بنزين'
                        : 'Fuel'
                      : e.category === 'car_repair'
                      ? lang === 'ar'
                        ? 'تصليح سيارة'
                        : 'Car Repair'
                      : e.category === 'parts_purchase'
                      ? lang === 'ar'
                        ? 'شراء قطع'
                        : 'Parts Purchase'
                      : lang === 'ar'
                      ? 'أخرى'
                      : 'Other'}
                  </td>
                  <td className="py-3 px-3 text-slate-800">{e.title}</td>
                  <td className="py-3 px-3 font-semibold text-[#145A32]">
                    {e.partType || '-'}
                  </td>
                  <td className="py-3 px-3">
                    {e.paymentMethod === 'cash'
                      ? lang === 'ar'
                        ? 'كاش'
                        : 'Cash'
                      : e.paymentMethod === 'check'
                      ? lang === 'ar'
                        ? 'شيك'
                        : 'Check'
                      : 'CliQ'}
                  </td>
                  <td className="py-3 px-3 text-end font-mono font-bold tabular-nums text-rose-600">
                    -{formatJod(e.amountJod, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Complete Printable / PDF Official Report Modal */}
      <FinancialReportPdfModal
        isOpen={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        lang={lang}
        state={state}
        initialPeriod={period}
        initialReferenceDate={referenceDate}
        initialScope="all_combined"
      />
    </div>
  );
};
