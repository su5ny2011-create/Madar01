import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileText,
  Loader2,
  MessageCircle,
  Printer,
  Send,
  X,
} from 'lucide-react';
import type { Language, MaintenanceVisit, ReportPeriod } from '../types';
import {
  formatJod,
  getDayName,
  getPeriodRange,
  getTodayStr,
  isDateInRange,
  isVisitUnpaid,
} from '../utils/logic';
import {
  downloadPdfFromElement,
  preparePdfReport,
  sanitizePdfFileName,
  sharePdfReportViaWhatsApp,
  uploadPdfReportForDirectLink,
  type PreparedPdfReport,
} from '../utils/pdfExport';
import { AlMadarLogo } from './AlMadarLogo';

export type MaintenanceReportScope =
  | 'custom_list'
  | 'today'
  | 'active'
  | 'archive'
  | 'all';

interface DailyMaintenanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  allVisits: MaintenanceVisit[];
  initialVisits?: MaintenanceVisit[];
  initialPeriod?: ReportPeriod;
  initialReferenceDate?: string;
  initialScope?: MaintenanceReportScope;
  initialTitleAr?: string;
  initialTitleEn?: string;
  currentUserFullName?: string;
}

interface DayMaintenanceGroup {
  date: string;
  visits: MaintenanceVisit[];
  totalCount: number;
  resolvedCount: number;
  pendingCount: number;
  paidTotalJod: number;
  unpaidTotalJod: number;
}

function escapeHtml(val: string | number | undefined | null): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const DailyMaintenanceReportModal: React.FC<
  DailyMaintenanceReportModalProps
> = ({
  isOpen,
  onClose,
  lang,
  allVisits,
  initialVisits,
  initialPeriod = 'daily',
  initialReferenceDate,
  initialScope = 'all',
  initialTitleAr,
  initialTitleEn,
}) => {
  const todayStr = getTodayStr();
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [referenceDate, setReferenceDate] = useState<string>(
    initialReferenceDate || todayStr
  );
  const [scope, setScope] = useState<MaintenanceReportScope>(initialScope);
  const [notice, setNotice] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isPreparingPdf, setIsPreparingPdf] = useState<boolean>(false);
  const [preparedPdf, setPreparedPdf] = useState<PreparedPdfReport | null>(null);
  const reportContainerRef = useRef<HTMLDivElement>(null);

  // Interactive Carender Popover State (كبسة تظهر بداخلها carender)
  const [isCarenderOpen, setIsCarenderOpen] = useState<boolean>(false);
  const [calendarYear, setCalendarYear] = useState<number>(() => {
    const initDate = initialReferenceDate || todayStr;
    const y = parseInt(initDate.split('-')[0], 10);
    return isNaN(y) ? new Date().getFullYear() : y;
  });
  const [calendarMonth, setCalendarMonth] = useState<number>(() => {
    const initDate = initialReferenceDate || todayStr;
    const m = parseInt(initDate.split('-')[1], 10);
    return isNaN(m) ? new Date().getMonth() + 1 : m;
  });

  // Sync calendar view month/year when referenceDate changes
  useEffect(() => {
    if (referenceDate) {
      const parts = referenceDate.split('-').map(Number);
      if (parts[0] && parts[1]) {
        setCalendarYear(parts[0]);
        setCalendarMonth(parts[1]);
      }
    }
  }, [referenceDate]);

  useEffect(() => {
    if (isOpen) {
      setPeriod(initialPeriod);
      if (initialReferenceDate) {
        setReferenceDate(initialReferenceDate);
      }
      setScope(initialScope);
      setNotice('');
      document.body.classList.add('printing-modal-active');
    } else {
      document.body.classList.remove('printing-modal-active');
      setPreparedPdf(null);
    }
    return () => {
      document.body.classList.remove('printing-modal-active');
    };
  }, [isOpen, initialPeriod, initialReferenceDate, initialScope]);

  const dateRange = useMemo(
    () => getPeriodRange(period, referenceDate),
    [period, referenceDate]
  );

  const displayedVisits = useMemo(() => {
    let base: MaintenanceVisit[] = [];
    if (scope === 'custom_list' && initialVisits && initialVisits.length > 0) {
      base = initialVisits;
    } else if (scope === 'active') {
      base = allVisits.filter((v) => !v.isArchived);
    } else if (scope === 'archive') {
      base = allVisits.filter((v) => Boolean(v.isArchived));
    } else {
      base = allVisits;
    }

    return base
      .filter((v) =>
        isDateInRange(v.visitDate, dateRange.startDate, dateRange.endDate)
      )
      .sort((a, b) =>
        `${b.visitDate} ${b.visitTime}`.localeCompare(`${a.visitDate} ${a.visitTime}`)
      );
  }, [allVisits, initialVisits, scope, dateRange.startDate, dateRange.endDate]);

  // Group visits by Day (مفصل على الأيام لسهولة الرؤيا)
  const dayGroups: DayMaintenanceGroup[] = useMemo(() => {
    const dateSet = new Set<string>();
    displayedVisits.forEach((v) => {
      if (v.visitDate) dateSet.add(v.visitDate);
    });

    if (dateSet.size === 0 && period === 'daily') {
      dateSet.add(referenceDate);
    }

    const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((dateStr) => {
      const visits = displayedVisits.filter((v) => v.visitDate === dateStr);
      const totalCount = visits.length;
      const resolvedCount = visits.filter(
        (v) => v.isResolved || v.status === 'resolved'
      ).length;
      const pendingCount = totalCount - resolvedCount;
      const paidTotalJod = visits
        .filter((v) => v.isPaid && v.visitType !== 'contract')
        .reduce((sum, v) => sum + (Number(v.amountJod) || 0), 0);
      const unpaidTotalJod = visits
        .filter((v) => isVisitUnpaid(v))
        .reduce((sum, v) => sum + (Number(v.amountJod) || 0), 0);

      return {
        date: dateStr,
        visits,
        totalCount,
        resolvedCount,
        pendingCount,
        paidTotalJod,
        unpaidTotalJod,
      };
    });
  }, [displayedVisits, period, referenceDate]);

  const pdfFileName = sanitizePdfFileName(
    `AlMadar_Maintenance_Report_${period}_${dateRange.startDate}.pdf`
  );

  // Pre-generate the exact .pdf file immediately whenever the modal opens or filters change
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setPreparedPdf(null);
    setIsPreparingPdf(true);
    const timer = setTimeout(async () => {
      if (!reportContainerRef.current || cancelled) {
        if (!cancelled) setIsPreparingPdf(false);
        return;
      }
      try {
        const ready = await preparePdfReport(reportContainerRef.current, pdfFileName);
        if (cancelled) return;
        setPreparedPdf(ready);
        setIsPreparingPdf(false);
        uploadPdfReportForDirectLink(ready.blob, ready.fileName).then((url) => {
          if (!cancelled && url) {
            setPreparedPdf((prev) =>
              prev && prev.fileName === ready.fileName
                ? { ...prev, hostedPdfUrl: url }
                : prev
            );
          }
        });
      } catch {
        if (!cancelled) setIsPreparingPdf(false);
      }
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    isOpen,
    period,
    referenceDate,
    scope,
    displayedVisits.length,
    dayGroups.length,
    pdfFileName,
  ]);

  const isAr = lang === 'ar';
  const totalCount = displayedVisits.length;
  const resolvedCount = displayedVisits.filter(
    (v) => v.isResolved || v.status === 'resolved'
  ).length;
  const pendingCount = totalCount - resolvedCount;
  const paidTotalJod = displayedVisits
    .filter((v) => v.isPaid && v.visitType !== 'contract')
    .reduce((sum, v) => sum + (Number(v.amountJod) || 0), 0);
  const unpaidTotalJod = displayedVisits
    .filter((v) => isVisitUnpaid(v))
    .reduce((sum, v) => sum + (Number(v.amountJod) || 0), 0);

  const reportTitleAr =
    initialTitleAr ||
    (period === 'daily'
      ? 'تقرير الصيانة اليومي المفصل'
      : period === 'weekly'
      ? 'تقرير الصيانة الأسبوعي المفصل على الأيام'
      : period === 'monthly'
      ? 'تقرير الصيانة الشهري المفصل على الأيام'
      : 'تقرير الصيانة الشامل المفصل على الأيام');

  const reportTitleEn =
    initialTitleEn ||
    (period === 'daily'
      ? 'Detailed Daily Maintenance Report'
      : period === 'weekly'
      ? 'Day-by-Day Weekly Maintenance Report'
      : period === 'monthly'
      ? 'Day-by-Day Monthly Maintenance Report'
      : 'Day-by-Day Maintenance Report');

  const dateRangeSubtitle =
    dateRange.startDate === dateRange.endDate
      ? `${getDayName(dateRange.startDate, lang)} · ${dateRange.startDate}`
      : `${dateRange.startDate} → ${dateRange.endDate} (${dayGroups.length} ${
          isAr ? 'أيام' : 'days'
        })`;

  const getPaymentMethodLabel = (method?: string) => {
    if (isAr) {
      return method === 'cash' ? 'كاش' : method === 'check' ? 'شيك' : 'CliQ';
    }
    return method === 'cash' ? 'Cash' : method === 'check' ? 'Check' : 'CliQ';
  };

  // Recorded visit dates set for calendar badges
  const recordedVisitDates = useMemo(() => {
    const set = new Set<string>();
    allVisits.forEach((v) => {
      if (v.visitDate) set.add(v.visitDate);
    });
    return set;
  }, [allVisits]);

  // Calendar cells for interactive Carender (7 columns: Sun-Sat)
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(calendarYear, calendarMonth - 1, 1);
    const leadingDays = firstDayOfMonth.getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();
    const daysInPrevMonth = new Date(calendarYear, calendarMonth - 1, 0).getDate();

    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    const prevMonth = calendarMonth === 1 ? 12 : calendarMonth - 1;
    const prevYear = calendarMonth === 1 ? calendarYear - 1 : calendarYear;

    for (let i = leadingDays - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: day, isCurrentMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: day, isCurrentMonth: true });
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    const nextMonth = calendarMonth === 12 ? 1 : calendarMonth + 1;
    const nextYear = calendarMonth === 12 ? calendarYear + 1 : calendarYear;
    for (let day = 1; day <= remaining; day++) {
      const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: day, isCurrentMonth: false });
    }

    return cells;
  }, [calendarYear, calendarMonth]);

  const weekdays = [
    { ar: 'أحد', en: 'Sun' },
    { ar: 'إثنين', en: 'Mon' },
    { ar: 'ثلاثاء', en: 'Tue' },
    { ar: 'أربعاء', en: 'Wed' },
    { ar: 'خميس', en: 'Thu' },
    { ar: 'جمعة', en: 'Fri' },
    { ar: 'سبت', en: 'Sat' },
  ];

  const handleCarenderPrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleCarenderNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const handleCarenderSelectDay = (dateStr: string) => {
    setReferenceDate(dateStr);
    if (scope === 'custom_list') {
      setScope('all');
    }
    setIsCarenderOpen(false);
  };

  const handleCarenderJumpToday = () => {
    const today = getTodayStr();
    const [y, m] = today.split('-').map(Number);
    setCalendarYear(y);
    setCalendarMonth(m);
    setReferenceDate(today);
    if (scope === 'custom_list') {
      setScope('all');
    }
    setIsCarenderOpen(false);
  };

  const handleDownloadPdf = async () => {
    if (!reportContainerRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const generated = await downloadPdfFromElement(
        reportContainerRef.current,
        pdfFileName,
        preparedPdf
      );
      if (!preparedPdf) {
        setPreparedPdf(generated);
      }
      setNotice(
        isAr
          ? `تم تنزيل ملف تقرير الصيانة (${generated.fileName}) بنجاح!`
          : 'Maintenance Report .pdf downloaded!'
      );
      setTimeout(() => setNotice(''), 4000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSendPdfWhatsApp = async () => {
    if (!reportContainerRef.current || isGeneratingPdf) return;

    const summaryText = isAr
      ? `📊 ملخص: إجمالي الطلبات: ${totalCount} | منجز: ${resolvedCount} | قيد المتابعة: ${pendingCount}\n💰 المحصل: ${formatJod(paidTotalJod)} | الذمم: ${formatJod(unpaidTotalJod)}`
      : `📊 Summary: Requests: ${totalCount} | Resolved: ${resolvedCount} | Pending: ${pendingCount}\n💰 Paid: ${formatJod(paidTotalJod)} | Unpaid: ${formatJod(unpaidTotalJod)}`;

    const sharePromise = sharePdfReportViaWhatsApp({
      element: reportContainerRef.current,
      fileName: pdfFileName,
      reportTitle: `${isAr ? reportTitleAr : reportTitleEn} (${dateRangeSubtitle})`,
      summaryText,
      preGenerated: preparedPdf,
    });

    setIsGeneratingPdf(true);
    try {
      const result = await sharePromise;
      setNotice(
        result === 'shared_native_pdf'
          ? isAr
            ? `تم فتح واتس اب لإرسال ملف (${pdfFileName}) كـ مستند PDF (.pdf) مباشرة!`
            : 'Opened WhatsApp with the .pdf file attached as a document!'
          : isAr
          ? `تم تنزيل ملف (${pdfFileName}) بصيغة PDF وفتح واتس اب لإرفاقه كـ مستند!`
          : '.pdf report downloaded and opened WhatsApp!'
      );
      setTimeout(() => setNotice(''), 6000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const buildPrintableHtmlDocument = () => {
    const dir = isAr ? 'rtl' : 'ltr';
    const alignStart = isAr ? 'right' : 'left';
    const alignEnd = isAr ? 'left' : 'right';

    const dailyOverviewRowsHtml = dayGroups
      .map(
        (dg, idx) => `
        <tr>
          <td style="text-align:center;color:#64748b;font-weight:700;">${idx + 1}</td>
          <td style="font-weight:800;color:#0B3B68;">${escapeHtml(
            getDayName(dg.date, lang)
          )} — <span style="font-family:monospace;">${escapeHtml(dg.date)}</span></td>
          <td style="text-align:center;font-weight:800;color:#0B3B68;">${dg.totalCount}</td>
          <td style="text-align:center;font-weight:800;color:#15803d;">${
            dg.resolvedCount
          } / <span style="color:#d97706;">${dg.pendingCount}</span></td>
          <td style="font-family:monospace;font-weight:800;color:#15803d;">${formatJod(
            dg.paidTotalJod,
            lang
          )}</td>
          <td style="text-align:${alignEnd};font-family:monospace;font-weight:800;color:#dc2626;">${formatJod(
            dg.unpaidTotalJod,
            lang
          )}</td>
        </tr>`
      )
      .join('');

    const dayBlocksHtml =
      dayGroups.length === 0
        ? `<div style="padding:20px;text-align:center;color:#64748b;font-weight:700;border:1px solid #e2e8f0;border-radius:10px;">${
            isAr ? 'لا توجد طلبات صيانة في هذه الفترة' : 'No maintenance requests in this period'
          }</div>`
        : dayGroups
            .map((dg) => {
              const visitRowsHtml = dg.visits
                .map((v, idx) => {
                  const isResolved = Boolean(v.isResolved || v.status === 'resolved');
                  const statusText = isResolved
                    ? isAr
                      ? 'منجز'
                      : 'Resolved'
                    : v.status === 'in_progress'
                    ? isAr
                      ? 'جاري العمل'
                      : 'Working'
                    : isAr
                    ? 'انتظار'
                    : 'Pending';
                  const statusBg = isResolved
                    ? '#dcfce7'
                    : v.status === 'in_progress'
                    ? '#e0f2fe'
                    : '#fef3c7';
                  const statusColor = isResolved
                    ? '#15803d'
                    : v.status === 'in_progress'
                    ? '#0B3B68'
                    : '#b45309';

                  let paymentLabel = '';
                  let paymentColor = '#0f172a';
                  if (v.visitType === 'contract') {
                    paymentLabel = isAr ? 'عقد صيانة' : 'Contract';
                    paymentColor = '#0B3B68';
                  } else if (v.noPayment) {
                    paymentLabel = isAr ? 'بدون دفع' : 'No Payment';
                    paymentColor = '#475569';
                  } else if (v.isPaid) {
                    paymentLabel = `${formatJod(v.amountJod, lang)} (${
                      isAr ? 'مدفوع' : 'Paid'
                    } - ${getPaymentMethodLabel(v.paymentMethod)})`;
                    paymentColor = '#15803d';
                  } else {
                    paymentLabel = `${formatJod(v.amountJod, lang)} (${
                      isAr ? 'غير مدفوع' : 'Unpaid'
                    })`;
                    paymentColor = '#dc2626';
                  }

                  const partsArr: string[] = [];
                  if (v.installedParts?.length) {
                    partsArr.push(
                      `<span style="color:#15803d;">✓ ${escapeHtml(
                        v.installedParts.join(' + ')
                      )}</span>`
                    );
                  }
                  if (v.requiredParts?.length) {
                    partsArr.push(
                      `<span style="color:#b45309;">• ${escapeHtml(
                        v.requiredParts.join(' + ')
                      )}</span>`
                    );
                  }

                  return `
                    <tr>
                      <td style="text-align:center;color:#64748b;font-weight:700;">${idx + 1}</td>
                      <td style="font-family:monospace;font-size:10.5px;color:#475569;font-weight:700;">${escapeHtml(
                        v.visitTime || '-'
                      )}</td>
                      <td>
                        <div style="font-weight:800;color:#0f172a;">${escapeHtml(v.customerName)}</div>
                        ${
                          v.phone
                            ? `<div dir="ltr" style="font-size:10px;color:#64748b;font-family:monospace;">${escapeHtml(
                                v.phone
                              )}</div>`
                            : ''
                        }
                      </td>
                      <td>
                        <div style="font-weight:700;color:#0f172a;">${escapeHtml(v.problem)}</div>
                        ${
                          partsArr.length > 0
                            ? `<div style="font-size:10px;font-weight:700;margin-top:2px;">${partsArr.join(
                                ' &nbsp;|&nbsp; '
                              )}</div>`
                            : ''
                        }
                      </td>
                      <td style="text-align:center;">
                        <span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:800;background:${statusBg};color:${statusColor};">
                          ${statusText}
                        </span>
                      </td>
                      <td style="text-align:${alignEnd};font-weight:800;color:${paymentColor};font-size:11px;">
                        ${paymentLabel}
                      </td>
                    </tr>`;
                })
                .join('');

              return `
                <div class="day-card">
                  <div class="day-header">
                    <div class="day-title">
                      📅 ${escapeHtml(getDayName(dg.date, lang))} — <span style="font-family:monospace;">${escapeHtml(
                        dg.date
                      )}</span>
                      <span class="day-count">(${dg.totalCount} ${
                        isAr ? 'طلب' : 'requests'
                      })</span>
                    </div>
                    <div class="day-pills">
                      <span class="pill pill-res">${
                        isAr ? 'منجز:' : 'Resolved:'
                      } ${dg.resolvedCount} | ${
                        isAr ? 'متابعة:' : 'Pending:'
                      } ${dg.pendingCount}</span>
                      <span class="pill pill-paid">${
                        isAr ? 'المدفوع:' : 'Paid:'
                      } ${formatJod(dg.paidTotalJod, lang)}</span>
                      <span class="pill pill-unpaid">${
                        isAr ? 'الذمم:' : 'Unpaid:'
                      } ${formatJod(dg.unpaidTotalJod, lang)}</span>
                    </div>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style="width:28px;text-align:center;">#</th>
                        <th style="width:62px;">${isAr ? 'الوقت' : 'Time'}</th>
                        <th style="width:140px;">${isAr ? 'الزبون' : 'Customer'}</th>
                        <th>${isAr ? 'العطل والقطع' : 'Problem & Parts'}</th>
                        <th style="width:80px;text-align:center;">${isAr ? 'الحالة' : 'Status'}</th>
                        <th style="width:130px;text-align:${alignEnd};">${isAr ? 'الدفع والمبلغ' : 'Payment'}</th>
                      </tr>
                    </thead>
                    <tbody>${visitRowsHtml}</tbody>
                  </table>
                </div>
              `;
            })
            .join('');

    return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(isAr ? reportTitleAr : reportTitleEn)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; font-family: 'Cairo', sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 12px; background: #fff; color: #0f172a; font-size: 11px; }
    .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 2px solid #0B3B68; }
    .brand { font-size: 16px; font-weight: 900; color: #0B3B68; margin: 0; }
    .title-pill { background: #0B3B68; color: #fff; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 800; display: inline-block; }
    .date-sub { font-size: 11px; color: #64748b; font-weight: 700; margin-top: 3px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; background: #f8fafc; }
    .kpi-label { font-size: 10px; font-weight: 700; color: #64748b; }
    .kpi-val { font-size: 14px; font-weight: 900; margin-top: 2px; font-family: monospace; }
    .sec-title { font-size: 12px; font-weight: 900; color: #0B3B68; margin: 12px 0 6px 0; }
    .day-card { border: 1.5px solid #cbd5e1; border-radius: 10px; overflow: hidden; margin-bottom: 14px; page-break-inside: avoid; }
    .day-header { background: #0B3B68; color: #fff; padding: 7px 10px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px; }
    .day-title { font-size: 12px; font-weight: 900; }
    .day-count { font-size: 10px; color: #bae6fd; margin-inline-start: 6px; font-weight: 700; }
    .day-pills { display: flex; flex-wrap: wrap; gap: 4px; }
    .pill { padding: 2px 7px; border-radius: 6px; font-size: 9.5px; font-weight: 800; font-family: monospace; }
    .pill-res { background: rgba(255,255,255,0.15); color: #e0f2fe; }
    .pill-paid { background: #dcfce7; color: #14532d; }
    .pill-unpaid { background: #ffe4e6; color: #881337; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: ${alignStart}; vertical-align: middle; }
    th { background: #f1f5f9; color: #0B3B68; font-weight: 800; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="brand">${isAr ? 'شركة المدار لتجارة تكنولوجيا المعلومات' : 'Al-Madar Information Technology'}</h1>
    </div>
    <div style="text-align:${alignEnd};">
      <div class="title-pill">${escapeHtml(isAr ? reportTitleAr : reportTitleEn)}</div>
      <div class="date-sub">${escapeHtml(dateRangeSubtitle)}</div>
    </div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">${isAr ? 'إجمالي الطلبات' : 'Requests'}</div><div class="kpi-val" style="color:#0B3B68;">${totalCount}</div></div>
    <div class="kpi"><div class="kpi-label">${isAr ? 'منجز / متابعة' : 'Resolved / Pending'}</div><div class="kpi-val" style="color:#15803d;">${resolvedCount} / <span style="color:#d97706;">${pendingCount}</span></div></div>
    <div class="kpi"><div class="kpi-label">${isAr ? 'المدفوع' : 'Paid'}</div><div class="kpi-val" style="color:#15803d;">${formatJod(paidTotalJod, lang)}</div></div>
    <div class="kpi"><div class="kpi-label">${isAr ? 'الذمم' : 'Unpaid'}</div><div class="kpi-val" style="color:#dc2626;">${formatJod(unpaidTotalJod, lang)}</div></div>
  </div>

  ${
    dayGroups.length > 1
      ? `<div class="sec-title">${
          isAr
            ? `جدول ملخص أيام الصيانة (${dayGroups.length} يوم)`
            : `Daily Maintenance Summary (${dayGroups.length} Days)`
        }</div>
        <table style="margin-bottom:14px;border:1px solid #cbd5e1;">
          <thead>
            <tr>
              <th style="width:28px;text-align:center;">#</th>
              <th>${isAr ? 'اليوم والتاريخ' : 'Day & Date'}</th>
              <th style="text-align:center;">${isAr ? 'عدد الطلبات' : 'Requests'}</th>
              <th style="text-align:center;">${isAr ? 'منجز / متابعة' : 'Resolved / Pending'}</th>
              <th>${isAr ? 'المحصّل المدفوع' : 'Paid Total'}</th>
              <th style="text-align:${alignEnd};">${isAr ? 'الذمم غير المدفوعة' : 'Unpaid'}</th>
            </tr>
          </thead>
          <tbody>${dailyOverviewRowsHtml}</tbody>
        </table>`
      : ''
  }

  <div class="sec-title">${
    isAr
      ? 'التفصيل اليومي لطلبات الصيانة (مفصل حسب كل يوم)'
      : 'Day-by-Day Detailed Maintenance Requests'
  }</div>
  ${dayBlocksHtml}
</body>
</html>`;
  };

  const handlePrintNow = () => {
    document.body.classList.add('printing-modal-active');
    const htmlContent = buildPrintableHtmlDocument();
    const existingFrame = document.getElementById(
      'almadar-maint-pdf-print-frame'
    ) as HTMLIFrameElement | null;
    if (existingFrame && existingFrame.parentNode) {
      existingFrame.parentNode.removeChild(existingFrame);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'almadar-maint-pdf-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.print();
      }
    } else {
      window.print();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="print-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-maint-report-modal-title"
    >
      <div className="print-modal-card w-full max-w-4xl rounded-3xl bg-white shadow-2xl border border-slate-200 my-2 sm:my-6 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Top Control Bar (No-Print) */}
        <div className="bg-[#0B3B68] text-white p-3 sm:p-4 space-y-2.5 no-print shrink-0">
          {/* Tier 1: Report Title Display (اسم التقارير مكتوب بوضوح فوق إصدار التقارير) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-white/15">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-amber-300" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-black text-amber-300 block leading-tight">
                  {isAr ? 'اسم التقرير:' : 'Report Name:'}
                </span>
                <h2
                  id="daily-maint-report-modal-title"
                  className="text-sm sm:text-base lg:text-lg font-black text-white leading-tight truncate"
                >
                  {isAr ? reportTitleAr : reportTitleEn}
                </h2>
                <span className="text-[11px] font-mono font-bold text-sky-200 block mt-0.5 leading-tight truncate">
                  {dateRangeSubtitle}
                </span>
              </div>
            </div>

            {/* Period Switcher (يومي | أسبوعي | شهري | شامل) + Close Button */}
            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
              <div className="grid grid-cols-4 gap-1 bg-white/10 p-1 rounded-xl">
                {(
                  [
                    { id: 'daily', ar: 'يومي', en: 'Daily' },
                    { id: 'weekly', ar: 'أسبوعي', en: 'Weekly' },
                    { id: 'monthly', ar: 'شهري', en: 'Monthly' },
                    { id: 'all', ar: 'شامل', en: 'All' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriod(p.id)}
                    className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer transition-all text-center ${
                      period === p.id
                        ? 'bg-[#E58E26] text-white shadow-2xs'
                        : 'text-sky-100 hover:bg-white/10'
                    }`}
                  >
                    {isAr ? p.ar : p.en}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
                <span>{isAr ? 'إغلاق' : 'Close'}</span>
              </button>
            </div>
          </div>

          {/* Tier 2: محددات التقرير + كبسة Carender + إصدار التقارير (تحت اسم التقرير مباشرة) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-1">
            {/* Left: Scope + Carender Button (كبسة تظهر بداخلها carender) */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Scope Tabs: الكل | النشطة | الأرشيف */}
              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl">
                {initialVisits && initialVisits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setScope('custom_list')}
                    className={`min-h-[30px] px-2 py-0.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                      scope === 'custom_list'
                        ? 'bg-white text-[#0B3B68]'
                        : 'text-sky-100 hover:bg-white/10'
                    }`}
                  >
                    {isAr ? `المحددة (${initialVisits.length})` : `Selected (${initialVisits.length})`}
                  </button>
                )}
                {(
                  [
                    { id: 'all', ar: 'الكل', en: 'All' },
                    { id: 'active', ar: 'النشطة', en: 'Active' },
                    { id: 'archive', ar: 'الأرشيف', en: 'Archive' },
                  ] as const
                ).map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setScope(sc.id)}
                    className={`min-h-[30px] px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                      scope === sc.id
                        ? 'bg-white text-[#0B3B68]'
                        : 'text-sky-100 hover:bg-white/10'
                    }`}
                  >
                    {isAr ? sc.ar : sc.en}
                  </button>
                ))}
              </div>

              {/* Carender Toggle Button: كبسة صغيرة تفتح بداخلها carender لتصغير المساحة */}
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={() => setIsCarenderOpen((prev) => !prev)}
                  className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all border ${
                    isCarenderOpen
                      ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xs ring-2 ring-amber-400/30'
                      : 'bg-white text-[#0B3B68] hover:bg-sky-50 border-white/20'
                  }`}
                  title={isAr ? 'فتح تقويم Carender لتحديد يوم التقرير' : 'Open Carender to select date'}
                >
                  <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Carender</span>
                  <span className="font-mono text-[10px] font-bold" dir="ltr">
                    ({referenceDate})
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${
                      isCarenderOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Floating Compact Carender Popover */}
                {isCarenderOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsCarenderOpen(false)}
                    />
                    <div className="absolute z-50 top-full mt-1.5 start-0 w-[285px] sm:w-[300px] rounded-2xl bg-white text-slate-800 p-2.5 shadow-2xl border border-slate-200 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-black text-[#0B3B68]">
                            Carender
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleCarenderJumpToday}
                            className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black cursor-pointer transition-colors"
                          >
                            {isAr ? 'اليوم' : 'Today'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCarenderPrevMonth}
                            className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                            title={isAr ? 'الشهر السابق' : 'Prev Month'}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <span
                            className="font-mono text-[11px] font-bold text-[#0B3B68] px-1 text-center"
                            dir="ltr"
                          >
                            {calendarYear}-{String(calendarMonth).padStart(2, '0')}
                          </span>
                          <button
                            type="button"
                            onClick={handleCarenderNextMonth}
                            className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                            title={isAr ? 'الشهر التالي' : 'Next Month'}
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsCarenderOpen(false)}
                            className="w-6 h-6 rounded-md bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 flex items-center justify-center cursor-pointer ms-0.5"
                            title={isAr ? 'إغلاق' : 'Close'}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 7 Columns Weekday Header */}
                      <div className="grid grid-cols-7 gap-0.5 text-center">
                        {weekdays.map((wd, i) => (
                          <div
                            key={i}
                            className="text-[9px] font-extrabold text-slate-500 py-0.5 bg-slate-50 rounded"
                          >
                            {isAr ? wd.ar : wd.en}
                          </div>
                        ))}
                      </div>

                      {/* Days Grid */}
                      <div className="grid grid-cols-7 gap-0.5">
                        {calendarCells.map((cell) => {
                          const isSelected = cell.dateStr === referenceDate;
                          const isToday = cell.dateStr === todayStr;
                          const hasVisits = recordedVisitDates.has(cell.dateStr);

                          return (
                            <button
                              key={cell.dateStr}
                              type="button"
                              onClick={() => handleCarenderSelectDay(cell.dateStr)}
                              className={`relative h-7 p-0.5 rounded text-[11px] font-mono font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[#0B3B68] text-white shadow-xs z-10 ring-1 ring-amber-400'
                                  : isToday
                                  ? 'bg-amber-100 text-amber-950 font-black border border-amber-300'
                                  : cell.isCurrentMonth
                                  ? 'bg-slate-50 hover:bg-sky-50 text-slate-800 border border-slate-200/60'
                                  : 'bg-slate-50/30 text-slate-400 border border-transparent'
                              }`}
                            >
                              <span className="leading-none">{cell.dayNum}</span>
                              {hasVisits && (
                                <span
                                  className={`w-1 h-1 rounded-full ${
                                    isSelected ? 'bg-amber-300' : 'bg-emerald-600'
                                  }`}
                                  title={isAr ? 'يوجد طلبات صيانة' : 'Has visits'}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Right: إصدار التقارير (Action buttons: واتس اب، تنزيل، طباعة) */}
            <div className="flex flex-wrap items-center gap-1.5 self-stretch sm:self-auto justify-end">
              <span className="text-[11px] font-black text-amber-300 px-1 hidden md:inline">
                {isAr ? 'إصدار التقرير:' : 'Export:'}
              </span>

              <button
                type="button"
                onClick={handleSendPdfWhatsApp}
                disabled={isGeneratingPdf}
                title={
                  isAr
                    ? 'أرسال التقارير واتس اب كملف .pdf مباشرة'
                    : 'Send Report via WhatsApp as .pdf'
                }
                className="min-h-[34px] px-3 sm:px-3.5 py-1 rounded-xl bg-[#25D366] hover:bg-[#1da851] disabled:opacity-60 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MessageCircle className="w-3.5 h-3.5" />
                )}
                <span>
                  {isGeneratingPdf
                    ? isAr
                      ? 'جاري التجهيز...'
                      : 'Preparing...'
                    : isAr
                    ? 'أرسال التقارير واتس اب'
                    : 'Send WhatsApp'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-[#1E824C] hover:bg-[#145A32] disabled:opacity-60 text-white text-xs font-extrabold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span>{isAr ? 'تنزيل (.pdf)' : 'PDF'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrintNow}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-sky-200" />
                <span>{isAr ? 'طباعة' : 'Print'}</span>
              </button>
            </div>
          </div>



          {notice && (
            <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-300/40 text-emerald-100 text-xs font-extrabold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>{notice}</span>
            </div>
          )}
        </div>

        {/* Modern Minimalist Printable & PDF Capture Body (Detailed by Day) */}
        <div className="print-modal-body p-3 sm:p-6 overflow-y-auto bg-slate-50/50 flex-1">
          <div
            ref={reportContainerRef}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-7 space-y-5 max-w-4xl mx-auto"
          >
            {/* Sleek Modern Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-[#0B3B68]">
              <AlMadarLogo size="sm" showText={true} />

              <div className="flex flex-col sm:items-end gap-1">
                <span className="inline-flex items-center px-3 py-1 rounded-lg bg-[#0B3B68] text-white text-xs font-extrabold">
                  {isAr ? reportTitleAr : reportTitleEn}
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {dateRangeSubtitle}
                </span>
              </div>
            </div>

            {/* 4 Essential KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] font-bold text-slate-500">
                  {isAr ? 'إجمالي الطلبات' : 'Requests'}
                </div>
                <div className="text-lg font-mono font-black text-[#0B3B68] mt-0.5">
                  {totalCount}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                <div className="text-[11px] font-bold text-emerald-800">
                  {isAr ? 'منجز / متابعة' : 'Resolved / Pending'}
                </div>
                <div className="text-lg font-mono font-black text-emerald-700 mt-0.5">
                  {resolvedCount}{' '}
                  <span className="text-slate-300 font-normal">/</span>{' '}
                  <span className="text-amber-600">{pendingCount}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                <div className="text-[11px] font-bold text-emerald-800">
                  {isAr ? 'إجمالي المدفوع' : 'Paid Total'}
                </div>
                <div className="text-lg font-mono font-black text-emerald-700 mt-0.5">
                  {formatJod(paidTotalJod, lang)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200/80">
                <div className="text-[11px] font-bold text-rose-800">
                  {isAr ? 'الذمم غير المدفوعة' : 'Unpaid'}
                </div>
                <div className="text-lg font-mono font-black text-rose-600 mt-0.5">
                  {formatJod(unpaidTotalJod, lang)}
                </div>
              </div>
            </div>

            {/* Quick Day-by-Day Maintenance Summary Table when multiple days exist */}
            {dayGroups.length > 1 && (
              <div className="space-y-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#0B3B68]">
                  {isAr
                    ? `جدول ملخص أيام الصيانة (${dayGroups.length} يوم)`
                    : `Daily Maintenance Summary (${dayGroups.length} Days)`}
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 text-[#0B3B68] font-extrabold border-b border-slate-200">
                        <th className="py-2 px-2 text-center w-8">#</th>
                        <th className="py-2 px-3 text-start">{isAr ? 'اليوم والتاريخ' : 'Day & Date'}</th>
                        <th className="py-2 px-2 text-center">{isAr ? 'عدد الطلبات' : 'Requests'}</th>
                        <th className="py-2 px-2.5 text-center">{isAr ? 'منجز / متابعة' : 'Resolved / Pending'}</th>
                        <th className="py-2 px-2.5 text-start">{isAr ? 'المحصّل المدفوع' : 'Paid'}</th>
                        <th className="py-2 px-3 text-end">{isAr ? 'الذمم غير المدفوعة' : 'Unpaid'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dayGroups.map((dg, idx) => (
                        <tr key={dg.date} className="hover:bg-slate-50/80">
                          <td className="py-2 px-2 text-center font-mono text-slate-400 font-bold">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-extrabold text-[#0B3B68] whitespace-nowrap">
                            <span>{getDayName(dg.date, lang)}</span>{' '}
                            <span className="font-mono text-slate-600" dir="ltr">
                              ({dg.date})
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-black text-[#0B3B68]">
                            {dg.totalCount}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono font-bold">
                            <span className="text-emerald-700">{dg.resolvedCount}</span>
                            <span className="text-slate-300 mx-1">/</span>
                            <span className="text-amber-600">{dg.pendingCount}</span>
                          </td>
                          <td className="py-2 px-2.5 font-mono font-black text-emerald-700 whitespace-nowrap">
                            {formatJod(dg.paidTotalJod, lang)}
                          </td>
                          <td className="py-2 px-3 text-end font-mono font-black text-rose-600 whitespace-nowrap">
                            {formatJod(dg.unpaidTotalJod, lang)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Day-by-Day Detailed Maintenance Requests (التفصيل اليومي لطلبات الصيانة مفصل حسب كل يوم) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#0B3B68]">
                  {isAr
                    ? 'التفصيل اليومي لطلبات الصيانة (مفصل حسب كل يوم)'
                    : 'Day-by-Day Detailed Maintenance Requests'}
                </h3>
                <span className="text-[11px] font-bold text-slate-500">
                  {isAr
                    ? `${dayGroups.length} يوم · ${totalCount} طلب صيانة`
                    : `${dayGroups.length} Days · ${totalCount} Requests`}
                </span>
              </div>

              {dayGroups.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-slate-200 text-slate-400 font-bold text-xs">
                  {isAr ? 'لا توجد طلبات صيانة في هذه الفترة' : 'No maintenance requests in this period'}
                </div>
              ) : (
                dayGroups.map((dg) => (
                  <div
                    key={dg.date}
                    className="rounded-2xl border-2 border-slate-200 overflow-hidden shadow-2xs bg-white"
                  >
                    {/* Distinct Day Banner */}
                    <div className="bg-[#0B3B68] text-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-extrabold text-xs">
                          {getDayName(dg.date, lang)}
                        </span>
                        <span className="font-mono font-black text-xs sm:text-sm text-white" dir="ltr">
                          {dg.date}
                        </span>
                        <span className="text-[11px] font-bold text-sky-200">
                          ({dg.totalCount} {isAr ? 'طلب صيانة' : 'requests'})
                        </span>
                      </div>

                      {/* Day Subtotals Bar */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono font-bold">
                        <span className="px-2 py-0.5 rounded-lg bg-white/15 text-sky-100">
                          {isAr ? 'منجز:' : 'Resolved:'} {dg.resolvedCount} |{' '}
                          {isAr ? 'متابعة:' : 'Pending:'} {dg.pendingCount}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/25 text-emerald-200 border border-emerald-400/30">
                          {isAr ? 'المدفوع:' : 'Paid:'} {formatJod(dg.paidTotalJod, lang)}
                        </span>
                        {dg.unpaidTotalJod > 0 && (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-500/25 text-rose-200 border border-rose-400/30">
                            {isAr ? 'الذمم:' : 'Unpaid:'} {formatJod(dg.unpaidTotalJod, lang)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Day Requests Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100/90 text-[#0B3B68] font-extrabold border-b border-slate-200">
                            <th className="py-2 px-2 text-center w-8">#</th>
                            <th className="py-2 px-2 text-start w-16">{isAr ? 'الوقت' : 'Time'}</th>
                            <th className="py-2 px-3 text-start w-40">{isAr ? 'الزبون' : 'Customer'}</th>
                            <th className="py-2 px-3 text-start">{isAr ? 'العطل والقطع' : 'Issue & Parts'}</th>
                            <th className="py-2 px-2.5 text-center w-24">{isAr ? 'الحالة' : 'Status'}</th>
                            <th className="py-2 px-3 text-end w-36">{isAr ? 'الدفع والمبلغ' : 'Payment'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dg.visits.map((v, idx) => {
                            const isResolved = Boolean(v.isResolved || v.status === 'resolved');
                            return (
                              <tr key={v.id} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-400">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-2 font-mono text-[11px] font-bold text-slate-600 whitespace-nowrap" dir="ltr">
                                  {v.visitTime || '-'}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-extrabold text-slate-900">
                                    <bdi>{v.customerName}</bdi>
                                  </div>
                                  {v.phone && (
                                    <div dir="ltr" className="text-[10px] font-mono text-slate-500">
                                      {v.phone}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-800">
                                    <bdi>{v.problem}</bdi>
                                  </div>
                                  {(v.installedParts.length > 0 || v.requiredParts.length > 0) && (
                                    <div className="flex flex-wrap gap-1.5 mt-1 text-[10px] font-bold">
                                      {v.installedParts.map((p, i) => (
                                        <span key={`inst-${i}`} className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                          ✓ {p}
                                        </span>
                                      ))}
                                      {v.requiredParts.map((p, i) => (
                                        <span key={`req-${i}`} className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                                          • {p}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-2.5 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                      isResolved
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : v.status === 'in_progress'
                                        ? 'bg-sky-100 text-[#0B3B68]'
                                        : 'bg-amber-100 text-amber-900'
                                    }`}
                                  >
                                    {isResolved
                                      ? isAr
                                        ? 'منجز'
                                        : 'Resolved'
                                      : v.status === 'in_progress'
                                      ? isAr
                                        ? 'جاري العمل'
                                        : 'Working'
                                      : isAr
                                      ? 'انتظار'
                                      : 'Pending'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-end whitespace-nowrap">
                                  {v.visitType === 'contract' ? (
                                    <span className="font-bold text-[#0B3B68] text-xs">
                                      {isAr ? 'عقد صيانة' : 'Contract'}
                                    </span>
                                  ) : v.noPayment ? (
                                    <span className="font-bold text-slate-400 text-xs">
                                      {isAr ? 'بدون دفع' : 'No Payment'}
                                    </span>
                                  ) : (
                                    <div>
                                      <div
                                        className={`font-mono font-black text-xs ${
                                          v.isPaid ? 'text-emerald-700' : 'text-rose-600'
                                        }`}
                                      >
                                        {formatJod(v.amountJod, lang)}
                                      </div>
                                      <div className="text-[10px] font-bold text-slate-500">
                                        {v.isPaid
                                          ? `${isAr ? 'مدفوع' : 'Paid'} (${getPaymentMethodLabel(
                                              v.paymentMethod
                                            )})`
                                          : isAr
                                          ? 'ذمة غير مدفوعة'
                                          : 'Unpaid'}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
