import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  Loader2,
  MessageCircle,
  Printer,
  X,
} from 'lucide-react';
import type {
  AppState,
  ExpenseCategory,
  ExpenseRecord,
  Language,
  MaintenanceVisit,
  MorningCashRecord,
  ReportPeriod,
} from '../types';
import {
  calculateFinancialSummary,
  formatJod,
  getDayName,
  getTodayStr,
  isDateInRange,
} from '../utils/logic';
import {
  downloadPdfFromElement,
  preparePdfReport,
  sharePdfReportViaWhatsApp,
  uploadPdfReportForDirectLink,
  type PreparedPdfReport,
} from '../utils/pdfExport';
import { AlMadarLogo } from './AlMadarLogo';

export type FinancialReportScope = 'all_combined' | 'active_only' | 'archived_only';

interface FinancialReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  state: AppState;
  initialPeriod?: ReportPeriod;
  initialReferenceDate?: string;
  initialScope?: FinancialReportScope;
  initialOpenCalendar?: boolean;
  currentUserFullName?: string;
}

interface DayFinancialGroup {
  date: string;
  morningCashList: MorningCashRecord[];
  paidVisitsList: MaintenanceVisit[];
  expensesList: ExpenseRecord[];
  morningJod: number;
  revenueJod: number;
  expensesJod: number;
  netProfitJod: number;
  totalWithMorningJod: number;
  totalMovementsCount: number;
}

function escapeHtml(val: string | number | undefined | null): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const FinancialReportPdfModal: React.FC<FinancialReportPdfModalProps> = ({
  isOpen,
  onClose,
  lang,
  state,
  initialPeriod = 'daily',
  initialReferenceDate,
  initialScope = 'all_combined',
  initialOpenCalendar = false,
}) => {
  const todayStr = getTodayStr();
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [referenceDate, setReferenceDate] = useState<string>(
    initialReferenceDate || todayStr
  );
  const [scope, setScope] = useState<FinancialReportScope>(initialScope);
  const [isCarenderOpen, setIsCarenderOpen] = useState<boolean>(initialOpenCalendar);
  const [calendarYear, setCalendarYear] = useState<number>(() => {
    const [y] = (initialReferenceDate || todayStr).split('-').map(Number);
    return y || new Date().getFullYear();
  });
  const [calendarMonth, setCalendarMonth] = useState<number>(() => {
    const [, m] = (initialReferenceDate || todayStr).split('-').map(Number);
    return m || new Date().getMonth() + 1;
  });
  const [notice, setNotice] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isPreparingPdf, setIsPreparingPdf] = useState<boolean>(false);
  const [preparedPdf, setPreparedPdf] = useState<PreparedPdfReport | null>(null);
  const reportContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPeriod(initialPeriod);
      const targetDate = initialReferenceDate || getTodayStr();
      setReferenceDate(targetDate);
      const [y, m] = targetDate.split('-').map(Number);
      if (y && m) {
        setCalendarYear(y);
        setCalendarMonth(m);
      }
      setScope(initialScope);
      setIsCarenderOpen(Boolean(initialOpenCalendar));
      setNotice('');
      document.body.classList.add('printing-modal-active');
    } else {
      document.body.classList.remove('printing-modal-active');
      setPreparedPdf(null);
      setIsCarenderOpen(false);
    }
    return () => {
      document.body.classList.remove('printing-modal-active');
    };
  }, [isOpen, initialPeriod, initialReferenceDate, initialScope, initialOpenCalendar]);

  const scopedState: AppState = useMemo(() => {
    if (scope === 'active_only') {
      return {
        ...state,
        morningCash: state.morningCash.filter((m) => !m.isArchived),
        expenses: state.expenses.filter((e) => !e.isArchived),
        visits: state.visits.filter((v) => !v.isFinanceArchived),
      };
    }
    if (scope === 'archived_only') {
      return {
        ...state,
        morningCash: state.morningCash.filter((m) => Boolean(m.isArchived)),
        expenses: state.expenses.filter((e) => Boolean(e.isArchived)),
        visits: state.visits.filter((v) => Boolean(v.isFinanceArchived)),
      };
    }
    return state;
  }, [state, scope]);

  const summary = useMemo(
    () => calculateFinancialSummary(scopedState, period, referenceDate),
    [scopedState, period, referenceDate]
  );

  const periodMorningCash = useMemo(
    () =>
      scopedState.morningCash
        .filter((m) => isDateInRange(m.date, summary.startDate, summary.endDate))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [scopedState.morningCash, summary.startDate, summary.endDate]
  );

  const periodExpenses = useMemo(
    () =>
      scopedState.expenses
        .filter((e) => isDateInRange(e.date, summary.startDate, summary.endDate))
        .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)),
    [scopedState.expenses, summary.startDate, summary.endDate]
  );

  const periodPaidVisits = useMemo(
    () =>
      scopedState.visits
        .filter(
          (v) =>
            isDateInRange(v.visitDate, summary.startDate, summary.endDate) &&
            v.isPaid &&
            v.visitType !== 'contract'
        )
        .sort((a, b) =>
          `${b.visitDate} ${b.visitTime}`.localeCompare(`${a.visitDate} ${a.visitTime}`)
        ),
    [scopedState.visits, summary.startDate, summary.endDate]
  );

  // Group all financial records by Day (مفصل على الأيام لسهولة الرؤيا)
  const dayGroups: DayFinancialGroup[] = useMemo(() => {
    const dateSet = new Set<string>();
    periodMorningCash.forEach((m) => {
      if (m.date) dateSet.add(m.date);
    });
    periodPaidVisits.forEach((v) => {
      if (v.visitDate) dateSet.add(v.visitDate);
    });
    periodExpenses.forEach((e) => {
      if (e.date) dateSet.add(e.date);
    });

    if (dateSet.size === 0 && period === 'daily') {
      dateSet.add(referenceDate);
    }

    const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((dateStr) => {
      const morningCashList = periodMorningCash.filter((m) => m.date === dateStr);
      const paidVisitsList = periodPaidVisits.filter((v) => v.visitDate === dateStr);
      const expensesList = periodExpenses.filter((e) => e.date === dateStr);

      const morningJod = morningCashList.reduce(
        (acc, m) => acc + (Number(m.amountJod) || 0),
        0
      );
      const revenueJod = paidVisitsList.reduce(
        (acc, v) => acc + (Number(v.amountJod) || 0),
        0
      );
      const expensesJod = expensesList.reduce(
        (acc, e) => acc + (Number(e.amountJod) || 0),
        0
      );
      const netProfitJod = revenueJod - expensesJod;
      const totalWithMorningJod = morningJod + netProfitJod;

      return {
        date: dateStr,
        morningCashList,
        paidVisitsList,
        expensesList,
        morningJod,
        revenueJod,
        expensesJod,
        netProfitJod,
        totalWithMorningJod,
        totalMovementsCount:
          morningCashList.length + paidVisitsList.length + expensesList.length,
      };
    });
  }, [periodMorningCash, periodPaidVisits, periodExpenses, period, referenceDate]);

  // Build per-day stats across scopedState for the interactive Carender calendar
  const recordedDaysStats = useMemo(() => {
    const map = new Map<
      string,
      {
        dateStr: string;
        count: number;
        morningJod: number;
        revenueJod: number;
        expensesJod: number;
        netProfitJod: number;
      }
    >();

    const ensureDay = (d: string) => {
      if (!map.has(d)) {
        map.set(d, {
          dateStr: d,
          count: 0,
          morningJod: 0,
          revenueJod: 0,
          expensesJod: 0,
          netProfitJod: 0,
        });
      }
      return map.get(d)!;
    };

    scopedState.morningCash.forEach((m) => {
      if (!m.date) return;
      const entry = ensureDay(m.date);
      entry.count += 1;
      entry.morningJod += Number(m.amountJod) || 0;
    });

    scopedState.visits.forEach((v) => {
      if (!v.visitDate || !v.isPaid || v.visitType === 'contract') return;
      const entry = ensureDay(v.visitDate);
      entry.count += 1;
      entry.revenueJod += Number(v.amountJod) || 0;
    });

    scopedState.expenses.forEach((e) => {
      if (!e.date) return;
      const entry = ensureDay(e.date);
      entry.count += 1;
      entry.expensesJod += Number(e.amountJod) || 0;
    });

    map.forEach((entry) => {
      entry.netProfitJod = entry.revenueJod - entry.expensesJod;
    });

    const sortedList = Array.from(map.values()).sort((a, b) =>
      b.dateStr.localeCompare(a.dateStr)
    );

    return { map, sortedList };
  }, [scopedState]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(Date.UTC(calendarYear, calendarMonth - 1, 1));
    const firstDayOfWeek = firstDay.getUTCDay(); // 0=Sun, ..., 6=Sat
    const leadingDays = (firstDayOfWeek + 1) % 7;

    const daysInMonth = new Date(
      Date.UTC(calendarYear, calendarMonth, 0)
    ).getUTCDate();
    const daysInPrevMonth = new Date(
      Date.UTC(calendarYear, calendarMonth - 1, 0)
    ).getUTCDate();

    const cells: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
    }[] = [];

    const prevMonth = calendarMonth === 1 ? 12 : calendarMonth - 1;
    const prevYear = calendarMonth === 1 ? calendarYear - 1 : calendarYear;
    for (let i = leadingDays - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(
        day
      ).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: day, isCurrentMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calendarYear}-${String(calendarMonth).padStart(
        2,
        '0'
      )}-${String(day).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: day, isCurrentMonth: true });
    }

    const remaining = (7 - (cells.length % 7)) % 7;
    const nextMonth = calendarMonth === 12 ? 1 : calendarMonth + 1;
    const nextYear = calendarMonth === 12 ? calendarYear + 1 : calendarYear;
    for (let day = 1; day <= remaining; day++) {
      const dateStr = `${nextYear}-${String(nextMonth).padStart(
        2,
        '0'
      )}-${String(day).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: day, isCurrentMonth: false });
    }

    return cells;
  }, [calendarYear, calendarMonth]);

  const prevRecordedDate = useMemo(() => {
    const older = recordedDaysStats.sortedList.filter(
      (d) => d.dateStr < referenceDate
    );
    return older.length > 0 ? older[0].dateStr : null;
  }, [recordedDaysStats.sortedList, referenceDate]);

  const nextRecordedDate = useMemo(() => {
    const newer = recordedDaysStats.sortedList.filter(
      (d) => d.dateStr > referenceDate
    );
    return newer.length > 0 ? newer[newer.length - 1].dateStr : null;
  }, [recordedDaysStats.sortedList, referenceDate]);

  const selectSpecificDate = (dateStr: string, switchToDaily = false) => {
    setReferenceDate(dateStr);
    const [y, m] = dateStr.split('-').map(Number);
    if (y && m) {
      setCalendarYear(y);
      setCalendarMonth(m);
    }
    if (switchToDaily) {
      setPeriod('daily');
    }
  };

  const handlePrevMonth = () => {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const pdfFileName = `AlMadar_Financial_Report_${period}_${summary.startDate}.pdf`;

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
        // Upload in background for desktop fallback link without blocking local .pdf file readiness
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
    summary.totalRevenueJod,
    summary.totalExpensesJod,
    summary.morningCashJod,
    dayGroups.length,
    pdfFileName,
  ]);

  if (!isOpen) return null;

  const isAr = lang === 'ar';

  const periodTitleAr =
    period === 'daily'
      ? 'التقرير المالي اليومي المفصل'
      : period === 'weekly'
      ? 'التقرير المالي الأسبوعي المفصل على الأيام'
      : period === 'monthly'
      ? 'التقرير المالي الشهري المفصل على الأيام'
      : 'التقرير المالي الشامل المفصل على الأيام';

  const periodTitleEn =
    period === 'daily'
      ? 'Detailed Daily Financial Report'
      : period === 'weekly'
      ? 'Day-by-Day Weekly Financial Report'
      : period === 'monthly'
      ? 'Day-by-Day Monthly Financial Report'
      : 'Day-by-Day Complete Financial Report';

  const dateRangeSubtitle =
    summary.startDate === summary.endDate
      ? `${getDayName(summary.startDate, lang)} · ${summary.startDate}`
      : `${summary.startDate} → ${summary.endDate} (${dayGroups.length} ${
          isAr ? 'أيام' : 'days'
        })`;

  const getCategoryLabel = (cat: ExpenseCategory) => {
    if (isAr) {
      return cat === 'fuel'
        ? 'بنزين'
        : cat === 'car_repair'
        ? 'تصليح سيارة'
        : cat === 'parts_purchase'
        ? 'شراء قطع'
        : 'أخرى';
    }
    return cat === 'fuel'
      ? 'Fuel'
      : cat === 'car_repair'
      ? 'Car Repair'
      : cat === 'parts_purchase'
      ? 'Parts'
      : 'Other';
  };

  const getPaymentMethodLabel = (method?: string) => {
    if (isAr) {
      return method === 'cash' ? 'كاش' : method === 'check' ? 'شيك' : 'CliQ';
    }
    return method === 'cash' ? 'Cash' : method === 'check' ? 'Check' : 'CliQ';
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
          ? `تم تنزيل ملف التقرير المالي (${generated.fileName}) بنجاح!`
          : 'Financial Report .pdf downloaded!'
      );
      setTimeout(() => setNotice(''), 4000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSendPdfWhatsApp = async () => {
    if (!reportContainerRef.current || isGeneratingPdf) return;
    const dateRangeStr =
      summary.startDate === summary.endDate
        ? summary.startDate
        : `${summary.startDate} → ${summary.endDate}`;

    const summaryText = isAr
      ? `📊 ملخص مالي (${dateRangeStr}):\n💰 إجمالي المقبوضات: ${formatJod(summary.totalRevenueJod)}\n🔻 إجمالي المصروفات: ${formatJod(summary.totalExpensesJod)}\n✨ صافي الأرباح: ${formatJod(summary.netProfitJod)}`
      : `📊 Financial Summary (${dateRangeStr}):\n💰 Total Revenue: ${formatJod(summary.totalRevenueJod)}\n🔻 Total Expenses: ${formatJod(summary.totalExpensesJod)}\n✨ Net Profit: ${formatJod(summary.netProfitJod)}`;

    const sharePromise = sharePdfReportViaWhatsApp({
      element: reportContainerRef.current,
      fileName: pdfFileName,
      reportTitle: `${isAr ? periodTitleAr : periodTitleEn} (${dateRangeStr})`,
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

  const handleExportExcelCsv = () => {
    const BOM = '\uFEFF';
    const headers = isAr
      ? ['اليوم', 'التاريخ', 'نوع الحركة', 'البيان / الزبون', 'التفاصيل / العطل', 'طريقة الدفع', 'المبلغ (JOD)']
      : ['Day', 'Date', 'Type', 'Title / Customer', 'Details / Issue', 'Payment Method', 'Amount (JOD)'];

    const rows: (string | number)[][] = [];

    rows.push([
      isAr ? 'ملخص التقرير المالي المفصل على الأيام' : 'Day-by-Day Financial Summary',
      `${summary.startDate} -> ${summary.endDate}`,
      isAr ? `عدد الأيام: ${dayGroups.length}` : `Days: ${dayGroups.length}`,
      isAr ? `كاش الصباح: ${summary.morningCashJod.toFixed(2)}` : `Morning: ${summary.morningCashJod.toFixed(2)}`,
      isAr ? `المقبوضات: +${summary.totalRevenueJod.toFixed(2)}` : `Revenue: +${summary.totalRevenueJod.toFixed(2)}`,
      isAr ? `المصاريف: -${summary.totalExpensesJod.toFixed(2)}` : `Expenses: -${summary.totalExpensesJod.toFixed(2)}`,
      isAr ? `الإجمالي مع الصباح: ${summary.totalBalanceWithMorningJod.toFixed(2)}` : `Total: ${summary.totalBalanceWithMorningJod.toFixed(2)}`,
    ]);
    rows.push([]);

    dayGroups.forEach((dg) => {
      const dayLabel = getDayName(dg.date, lang);
      rows.push([
        dayLabel,
        dg.date,
        isAr ? '=== ملخص اليوم ===' : '=== Day Summary ===',
        isAr ? `كاش الصباح: ${dg.morningJod.toFixed(2)}` : `Morning: ${dg.morningJod.toFixed(2)}`,
        isAr ? `المقبوضات: +${dg.revenueJod.toFixed(2)} | المصاريف: -${dg.expensesJod.toFixed(2)}` : `Rev: +${dg.revenueJod.toFixed(2)} | Exp: -${dg.expensesJod.toFixed(2)}`,
        isAr ? `صافي اليوم: ${dg.netProfitJod.toFixed(2)}` : `Net: ${dg.netProfitJod.toFixed(2)}`,
        dg.totalWithMorningJod.toFixed(2),
      ]);

      dg.morningCashList.forEach((m) => {
        rows.push([
          dayLabel,
          m.date,
          isAr ? 'كاش الصباح' : 'Morning Cash',
          m.note || (isAr ? 'رصيد كاش صباحي' : 'Morning Cash'),
          m.recordedBy || '',
          isAr ? 'كاش' : 'Cash',
          `+${Number(m.amountJod || 0).toFixed(2)}`,
        ]);
      });

      dg.paidVisitsList.forEach((v) => {
        rows.push([
          dayLabel,
          v.visitDate,
          isAr ? 'مقبوضات صيانة' : 'Paid Revenue',
          v.customerName,
          v.problem,
          getPaymentMethodLabel(v.paymentMethod),
          `+${Number(v.amountJod || 0).toFixed(2)}`,
        ]);
      });

      dg.expensesList.forEach((e) => {
        rows.push([
          dayLabel,
          e.date,
          isAr ? `مصروف (${getCategoryLabel(e.category)})` : `Expense (${getCategoryLabel(e.category)})`,
          e.title,
          e.partType || e.note || '',
          getPaymentMethodLabel(e.paymentMethod),
          `-${Number(e.amountJod || 0).toFixed(2)}`,
        ]);
      });

      rows.push([]);
    });

    const csvContent =
      BOM +
      [
        headers.join(','),
        ...rows.map((r) =>
          r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `AlMadar_Financial_Report_${period}_${summary.startDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotice(isAr ? 'تم تنزيل ملف Excel بنجاح!' : 'Excel file downloaded!');
    setTimeout(() => setNotice(''), 4000);
  };

  const buildPrintableHtmlDocument = () => {
    const dir = isAr ? 'rtl' : 'ltr';
    const alignStart = isAr ? 'right' : 'left';
    const alignEnd = isAr ? 'left' : 'right';

    const dailySummaryRowsHtml = dayGroups
      .map((dg, idx) => {
        const netColor = dg.netProfitJod >= 0 ? '#15803d' : '#dc2626';
        return `
        <tr>
          <td style="text-align:center;color:#64748b;font-weight:700;">${idx + 1}</td>
          <td style="font-weight:800;color:#0B3B68;">${escapeHtml(
            getDayName(dg.date, lang)
          )} — <span style="font-family:monospace;">${escapeHtml(dg.date)}</span></td>
          <td style="text-align:center;font-weight:700;">${dg.totalMovementsCount}</td>
          <td style="font-family:monospace;font-weight:700;color:#0B3B68;">${formatJod(
            dg.morningJod,
            lang
          )}</td>
          <td style="font-family:monospace;font-weight:800;color:#15803d;">+${formatJod(
            dg.revenueJod,
            lang
          )}</td>
          <td style="font-family:monospace;font-weight:800;color:#dc2626;">-${formatJod(
            dg.expensesJod,
            lang
          )}</td>
          <td style="font-family:monospace;font-weight:800;color:${netColor};">${
            dg.netProfitJod >= 0 ? '+' : ''
          }${formatJod(dg.netProfitJod, lang)}</td>
          <td style="text-align:${alignEnd};font-family:monospace;font-weight:900;color:#0B3B68;">${formatJod(
            dg.totalWithMorningJod,
            lang
          )}</td>
        </tr>`;
      })
      .join('');

    const dayBlocksHtml =
      dayGroups.length === 0
        ? `<div style="padding:20px;text-align:center;color:#64748b;font-weight:700;border:1px solid #e2e8f0;border-radius:10px;">${
            isAr ? 'لا توجد حركات مالية في هذه الفترة' : 'No financial records in this period'
          }</div>`
        : dayGroups
            .map((dg) => {
              let rowCounter = 0;
              const rows: string[] = [];

              dg.morningCashList.forEach((m) => {
                rowCounter += 1;
                rows.push(`
                  <tr style="background:#f0f9ff;">
                    <td style="text-align:center;color:#64748b;font-weight:700;">${rowCounter}</td>
                    <td><span style="display:inline-block;padding:2px 7px;border-radius:6px;background:#e0f2fe;color:#0B3B68;font-weight:800;font-size:10px;">${
                      isAr ? 'كاش الصباح' : 'Morning Cash'
                    }</span></td>
                    <td style="font-weight:800;color:#0f172a;">${escapeHtml(
                      m.note || (isAr ? 'رصيد كاش الصباح الافتتاحي' : 'Morning Cash Float')
                    )}</td>
                    <td style="color:#475569;font-weight:700;">${isAr ? 'كاش' : 'Cash'}</td>
                    <td style="text-align:${alignEnd};font-family:monospace;font-weight:900;color:#0B3B68;">+${formatJod(
                      m.amountJod,
                      lang
                    )}</td>
                  </tr>
                `);
              });

              dg.paidVisitsList.forEach((v) => {
                rowCounter += 1;
                rows.push(`
                  <tr>
                    <td style="text-align:center;color:#64748b;font-weight:700;">${rowCounter}</td>
                    <td><span style="display:inline-block;padding:2px 7px;border-radius:6px;background:#dcfce7;color:#15803d;font-weight:800;font-size:10px;">${
                      isAr ? 'مقبوضات صيانة' : 'Paid Revenue'
                    }</span></td>
                    <td>
                      <div style="font-weight:800;color:#0f172a;">${escapeHtml(v.customerName)}</div>
                      <div style="font-size:10px;color:#475569;font-weight:700;">${escapeHtml(v.problem)}</div>
                    </td>
                    <td style="color:#334155;font-weight:700;">${escapeHtml(
                      getPaymentMethodLabel(v.paymentMethod)
                    )}</td>
                    <td style="text-align:${alignEnd};font-family:monospace;font-weight:900;color:#15803d;">+${formatJod(
                      v.amountJod,
                      lang
                    )}</td>
                  </tr>
                `);
              });

              dg.expensesList.forEach((e) => {
                rowCounter += 1;
                rows.push(`
                  <tr style="background:#fff1f2;">
                    <td style="text-align:center;color:#64748b;font-weight:700;">${rowCounter}</td>
                    <td><span style="display:inline-block;padding:2px 7px;border-radius:6px;background:#ffe4e6;color:#be123c;font-weight:800;font-size:10px;">${
                      isAr ? 'مصروف' : 'Expense'
                    } · ${escapeHtml(getCategoryLabel(e.category))}</span></td>
                    <td>
                      <div style="font-weight:800;color:#0f172a;">${escapeHtml(e.title)}</div>
                      ${
                        e.partType
                          ? `<div style="font-size:10px;color:#475569;font-weight:700;">${escapeHtml(
                              e.partType
                            )}</div>`
                          : ''
                      }
                    </td>
                    <td style="color:#334155;font-weight:700;">${escapeHtml(
                      getPaymentMethodLabel(e.paymentMethod)
                    )}</td>
                    <td style="text-align:${alignEnd};font-family:monospace;font-weight:900;color:#dc2626;">-${formatJod(
                      e.amountJod,
                      lang
                    )}</td>
                  </tr>
                `);
              });

              const emptyDayRow =
                rows.length === 0
                  ? `<tr><td colspan="5" style="text-align:center;padding:12px;color:#64748b;font-weight:700;">${
                      isAr ? 'لا توجد حركات مسجلة في هذا اليوم' : 'No movements recorded on this day'
                    }</td></tr>`
                  : rows.join('');

              return `
                <div class="day-card">
                  <div class="day-header">
                    <div class="day-title">
                      📅 ${escapeHtml(getDayName(dg.date, lang))} — <span style="font-family:monospace;">${escapeHtml(
                        dg.date
                      )}</span>
                      <span class="day-count">(${dg.totalMovementsCount} ${
                        isAr ? 'حركة' : 'items'
                      })</span>
                    </div>
                    <div class="day-pills">
                      <span class="pill pill-morning">${
                        isAr ? 'كاش الصباح:' : 'Morning:'
                      } ${formatJod(dg.morningJod, lang)}</span>
                      <span class="pill pill-rev">${
                        isAr ? 'المقبوضات:' : 'Revenue:'
                      } +${formatJod(dg.revenueJod, lang)}</span>
                      <span class="pill pill-exp">${
                        isAr ? 'المصاريف:' : 'Expenses:'
                      } -${formatJod(dg.expensesJod, lang)}</span>
                      <span class="pill pill-net">${
                        isAr ? 'صافي اليوم:' : 'Day Net:'
                      } ${dg.netProfitJod >= 0 ? '+' : ''}${formatJod(
                        dg.netProfitJod,
                        lang
                      )}</span>
                      <span class="pill pill-total">${
                        isAr ? 'الإجمالي مع الصباح:' : 'Total:'
                      } ${formatJod(dg.totalWithMorningJod, lang)}</span>
                    </div>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style="width:28px;text-align:center;">#</th>
                        <th style="width:125px;">${isAr ? 'نوع الحركة' : 'Type'}</th>
                        <th>${isAr ? 'البيان / الزبون والتفاصيل' : 'Description / Customer'}</th>
                        <th style="width:90px;">${isAr ? 'طريقة الدفع' : 'Method'}</th>
                        <th style="width:110px;text-align:${alignEnd};">${isAr ? 'المبلغ' : 'Amount'}</th>
                      </tr>
                    </thead>
                    <tbody>${emptyDayRow}</tbody>
                  </table>
                </div>
              `;
            })
            .join('');

    return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(isAr ? periodTitleAr : periodTitleEn)}</title>
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
    .pill-morning { background: rgba(255,255,255,0.15); color: #e0f2fe; }
    .pill-rev { background: #dcfce7; color: #14532d; }
    .pill-exp { background: #ffe4e6; color: #881337; }
    .pill-net { background: #fef3c7; color: #78350f; }
    .pill-total { background: #f59e0b; color: #0f172a; }
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
      <div class="title-pill">${escapeHtml(isAr ? periodTitleAr : periodTitleEn)}</div>
      <div class="date-sub">${escapeHtml(summary.startDate)} → ${escapeHtml(summary.endDate)}</div>
    </div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-label">${isAr ? 'إجمالي كاش الصباح' : 'Morning Cash'}</div><div class="kpi-val" style="color:#0B3B68;">${formatJod(summary.morningCashJod, lang)}</div></div>
    <div class="kpi"><div class="kpi-label">${isAr ? 'إجمالي المقبوضات' : 'Total Revenue'}</div><div class="kpi-val" style="color:#15803d;">+${formatJod(summary.totalRevenueJod, lang)}</div></div>
    <div class="kpi"><div class="kpi-label">${isAr ? 'إجمالي المصاريف' : 'Total Expenses'}</div><div class="kpi-val" style="color:#dc2626;">-${formatJod(summary.totalExpensesJod, lang)}</div></div>
    <div class="kpi" style="background:#0B3B68;color:#fff;"><div class="kpi-label" style="color:#bae6fd;">${isAr ? 'الإجمالي مع الصباح' : 'Total Balance'}</div><div class="kpi-val" style="color:#fcd34d;">${formatJod(summary.totalBalanceWithMorningJod, lang)}</div></div>
  </div>

  ${
    dayGroups.length > 0
      ? `<div class="sec-title">${
          isAr
            ? `جدول ملخص الأيام (${dayGroups.length} يوم)`
            : `Daily Summary Table (${dayGroups.length} Days)`
        }</div>
        <table style="margin-bottom:14px;border:1px solid #cbd5e1;">
          <thead>
            <tr>
              <th style="width:28px;text-align:center;">#</th>
              <th>${isAr ? 'اليوم والتاريخ' : 'Day & Date'}</th>
              <th style="text-align:center;">${isAr ? 'الحركات' : 'Items'}</th>
              <th>${isAr ? 'كاش الصباح' : 'Morning'}</th>
              <th>${isAr ? 'المقبوضات' : 'Revenue'}</th>
              <th>${isAr ? 'المصاريف' : 'Expenses'}</th>
              <th>${isAr ? 'صافي اليوم' : 'Net Profit'}</th>
              <th style="text-align:${alignEnd};">${isAr ? 'الإجمالي مع الصباح' : 'Total Balance'}</th>
            </tr>
          </thead>
          <tbody>${dailySummaryRowsHtml}</tbody>
        </table>`
      : ''
  }

  <div class="sec-title">${
    isAr
      ? 'التفصيل اليومي للحركات المالية (مفصل حسب كل يوم)'
      : 'Day-by-Day Detailed Financial Movements'
  }</div>
  ${dayBlocksHtml}
</body>
</html>`;
  };

  const handlePrintPdf = () => {
    document.body.classList.add('printing-modal-active');
    const htmlContent = buildPrintableHtmlDocument();
    const existingFrame = document.getElementById(
      'almadar-financial-pdf-print-frame'
    ) as HTMLIFrameElement | null;
    if (existingFrame && existingFrame.parentNode) {
      existingFrame.parentNode.removeChild(existingFrame);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'almadar-financial-pdf-print-frame';
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

  const monthNames = {
    ar: [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ],
    en: [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ],
  };

  const calendarWeekdays = [
    { ar: 'سبت', en: 'Sat' },
    { ar: 'أحد', en: 'Sun' },
    { ar: 'إثنين', en: 'Mon' },
    { ar: 'ثلاثاء', en: 'Tue' },
    { ar: 'أربعاء', en: 'Wed' },
    { ar: 'خميس', en: 'Thu' },
    { ar: 'جمعة', en: 'Fri' },
  ];

  return (
    <div
      className="print-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-1.5 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="financial-pdf-modal-title"
    >
      <div className="print-modal-card w-full max-w-4xl rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200 my-1 sm:my-4 overflow-hidden flex flex-col max-h-[96vh]">
        {/* Compact, Mobile-Harmonious Top Action Bar (Hidden in Print) */}
        {/* Compact, Mobile-Harmonious Top Action Bar (Hidden in Print) */}
        <div className="bg-[#0B3B68] text-white p-2.5 sm:p-3.5 space-y-2.5 no-print shrink-0">
          {/* Tier 1: Report Name Display (اسم التقارير مكتوب بوضوح فوق إصدار التقارير) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/15">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <Printer className="w-4 h-4 text-amber-300" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black text-amber-300 block leading-tight">
                  {isAr ? 'اسم التقرير:' : 'Report Name:'}
                </span>
                <h2
                  id="financial-pdf-modal-title"
                  className="text-xs sm:text-sm lg:text-base font-black leading-tight truncate text-white"
                >
                  {isAr ? periodTitleAr : periodTitleEn}
                </h2>
                <p className="text-[10px] sm:text-[11px] text-sky-200 font-bold truncate mt-0.5">
                  {dateRangeSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={handleExportExcelCsv}
                className="min-h-[32px] px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
                <span>Excel</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="min-h-[32px] px-2.5 py-1 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-[11px] sm:text-xs font-extrabold flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>{isAr ? 'إغلاق' : 'Close'}</span>
              </button>
            </div>
          </div>

          {/* Tier 2: Period Tabs + Scope + Carender Button + إصدار التقارير (تحت اسم التقرير مباشرة) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Period Segmented Tabs: يومية | أسبوعية | شهرية | شامل */}
              <div className="grid grid-cols-4 sm:flex items-center gap-1 bg-white/10 p-1 rounded-xl w-full sm:w-auto">
                {(
                  [
                    { id: 'daily', ar: 'يومية', en: 'Daily' },
                    { id: 'weekly', ar: 'أسبوعية', en: 'Weekly' },
                    { id: 'monthly', ar: 'شهرية', en: 'Monthly' },
                    { id: 'all', ar: 'شامل', en: 'All' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPeriod(tab.id)}
                    className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition-all text-center whitespace-nowrap ${
                      period === tab.id
                        ? 'bg-[#E58E26] text-white shadow-2xs'
                        : 'text-sky-100 hover:bg-white/10'
                    }`}
                  >
                    {isAr ? tab.ar : tab.en}
                  </button>
                ))}
              </div>

              {/* Scope Segmented Tabs */}
              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl">
                {(
                  [
                    { id: 'all_combined', ar: 'الكل', en: 'All' },
                    { id: 'active_only', ar: 'النشطة', en: 'Active' },
                    { id: 'archived_only', ar: 'الأرشيف', en: 'Archive' },
                  ] as const
                ).map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setScope(sc.id)}
                    className={`min-h-[28px] px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-extrabold cursor-pointer ${
                      scope === sc.id
                        ? 'bg-white text-[#0B3B68]'
                        : 'text-sky-100 hover:bg-white/10'
                    }`}
                  >
                    {isAr ? sc.ar : sc.en}
                  </button>
                ))}
              </div>

              {/* Carender Date Picker Trigger Button (كبسة تظهر بداخلها carender) */}
              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => prevRecordedDate && selectSpecificDate(prevRecordedDate, true)}
                  disabled={!prevRecordedDate}
                  title={isAr ? 'اليوم المسجل السابق' : 'Previous recorded day'}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 text-white flex items-center justify-center cursor-pointer shrink-0"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <div className="relative inline-block">
                  <button
                    type="button"
                    onClick={() => setIsCarenderOpen((v) => !v)}
                    className={`min-h-[28px] px-2.5 py-0.5 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                      isCarenderOpen
                        ? 'bg-amber-400 text-slate-950 shadow-xs ring-2 ring-amber-400/30'
                        : 'bg-white text-[#0B3B68] hover:bg-sky-50'
                    }`}
                    title={
                      isAr
                        ? 'فتح التقويم (Carender) لتحديد يوم معين بالتقرير'
                        : 'Open Carender to select a specific day'
                    }
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#E58E26] shrink-0" />
                    <span>Carender</span>
                    <span className="font-mono text-[10px]" dir="ltr">
                      ({referenceDate})
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-200 ${
                        isCarenderOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Carender Floating Popover (مضغوط وعائم لتصغير المساحة) */}
                  {isCarenderOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsCarenderOpen(false)}
                      />
                      <div className="absolute z-50 top-full mt-1.5 start-0 w-[285px] sm:w-[305px] p-2.5 rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-2xl space-y-2 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-200">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                              <Calendar className="w-3.5 h-3.5 text-[#E58E26]" />
                            </div>
                            <span className="text-xs font-black text-[#0B3B68]">
                              Carender
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <input
                              type="date"
                              value={referenceDate}
                              onChange={(e) => {
                                if (e.target.value) {
                                  selectSpecificDate(e.target.value, true);
                                  setIsCarenderOpen(false);
                                }
                              }}
                              aria-label={isAr ? 'اختيار تاريخ مباشر' : 'Pick date'}
                              className="h-6 px-1.5 rounded bg-slate-100 border border-slate-300 text-slate-900 font-mono text-[10px] font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => setIsCarenderOpen(false)}
                              className="w-6 h-6 rounded bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 flex items-center justify-center cursor-pointer"
                              title={isAr ? 'إغلاق' : 'Close'}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Month Navigation */}
                        <div className="flex items-center justify-between gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/80">
                          <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="h-6 px-1.5 rounded bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                          >
                            <ChevronRight className="w-3 h-3" />
                            <span>{isAr ? 'السابق' : 'Prev'}</span>
                          </button>

                          <div className="text-[11px] font-black text-[#0B3B68] flex items-center gap-1">
                            <span>{monthNames[lang][calendarMonth - 1]}</span>
                            <span className="font-mono">{calendarYear}</span>
                          </div>

                          <button
                            type="button"
                            onClick={handleNextMonth}
                            className="h-6 px-1.5 rounded bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>{isAr ? 'التالي' : 'Next'}</span>
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                        </div>

                        {/* 7-Column Compact Carender Grid */}
                        <div className="space-y-0.5">
                          <div className="grid grid-cols-7 gap-0.5 text-center">
                            {calendarWeekdays.map((wd, i) => (
                              <div
                                key={i}
                                className="py-0.5 rounded bg-slate-100 text-slate-600 font-bold text-[9px] select-none"
                              >
                                {isAr ? wd.ar : wd.en}
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 gap-0.5">
                            {calendarCells.map((cell) => {
                              const dayStat = recordedDaysStats.map.get(cell.dateStr);
                              const isSelected = referenceDate === cell.dateStr;
                              const isToday = cell.dateStr === todayStr;
                              const hasData = Boolean(dayStat && dayStat.count > 0);

                              return (
                                <button
                                  key={cell.dateStr}
                                  type="button"
                                  onClick={() => {
                                    selectSpecificDate(cell.dateStr, true);
                                    setIsCarenderOpen(false);
                                  }}
                                  className={`h-7 p-0.5 rounded text-center transition-all cursor-pointer relative flex flex-col justify-center items-center border ${
                                    isSelected
                                      ? 'bg-[#0B3B68] text-white border-[#0B3B68] ring-1 ring-amber-400'
                                      : isToday
                                      ? 'border-amber-400 bg-amber-50 hover:bg-amber-100'
                                      : hasData
                                      ? 'bg-white hover:bg-sky-50 border-slate-200'
                                      : cell.isCurrentMonth
                                      ? 'bg-slate-50/70 hover:bg-slate-100 border-slate-100 text-slate-400'
                                      : 'bg-slate-50/30 border-slate-100 text-slate-300 opacity-40'
                                  }`}
                                >
                                  <span
                                    className={`text-[10px] font-mono leading-none ${
                                      isSelected
                                        ? 'text-white font-black'
                                        : isToday
                                        ? 'text-amber-950 font-black'
                                        : cell.isCurrentMonth
                                        ? 'text-slate-800 font-bold'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {cell.dayNum}
                                  </span>
                                  {hasData && (
                                    <span
                                      className={`w-1 h-1 rounded-full shrink-0 ${
                                        isSelected
                                          ? 'bg-amber-300'
                                          : dayStat!.netProfitJod >= 0
                                          ? 'bg-emerald-500'
                                          : 'bg-rose-500'
                                      }`}
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => nextRecordedDate && selectSpecificDate(nextRecordedDate, true)}
                  disabled={!nextRecordedDate}
                  title={isAr ? 'اليوم المسجل التالي' : 'Next recorded day'}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 text-white flex items-center justify-center cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    selectSpecificDate(todayStr, true);
                    setIsCarenderOpen(false);
                  }}
                  className={`min-h-[28px] px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer transition-colors ${
                    referenceDate === todayStr && period === 'daily'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-white/15 hover:bg-white/25 text-white'
                  }`}
                >
                  {isAr ? 'اليوم' : 'Today'}
                </button>
              </div>
            </div>

            {/* Right: إصدار التقارير (أرسال واتس اب، تنزيل، طباعة) */}
            <div className="flex flex-wrap items-center gap-1.5 justify-end">
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
                className="min-h-[34px] px-3 sm:px-3.5 py-1 rounded-xl bg-[#25D366] hover:bg-[#1da851] disabled:opacity-60 text-slate-950 text-[11px] sm:text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
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
                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-[#1E824C] hover:bg-[#145A32] disabled:opacity-60 text-white text-[11px] sm:text-xs font-extrabold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
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
                onClick={handlePrintPdf}
                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] sm:text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
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

        {/* Modern Minimalist Financial Report Body (Captured as PDF — Detailed by Day) */}
        <div className="print-modal-body p-3 sm:p-6 overflow-y-auto bg-slate-50/50 flex-1">
          <div
            ref={reportContainerRef}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-7 space-y-5 max-w-4xl mx-auto"
          >
            {/* Sleek Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-[#0B3B68]">
              <AlMadarLogo size="sm" showText={true} />

              <div className="flex flex-col sm:items-end gap-1">
                <span className="inline-flex items-center px-3 py-1 rounded-lg bg-[#0B3B68] text-white text-xs font-extrabold">
                  {isAr ? periodTitleAr : periodTitleEn}
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-500">
                  {summary.startDate === summary.endDate
                    ? `${getDayName(summary.startDate, lang)} · ${summary.startDate}`
                    : `${summary.startDate} → ${summary.endDate} (${dayGroups.length} ${
                        isAr ? 'أيام' : 'days'
                      })`}
                </span>
              </div>
            </div>

            {/* 4 Essential Financial KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] font-bold text-slate-500">
                  {isAr ? 'إجمالي كاش الصباح' : 'Morning Cash'}
                </div>
                <div className="text-base sm:text-lg font-mono font-black text-[#0B3B68] mt-0.5">
                  {formatJod(summary.morningCashJod, lang)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                <div className="text-[11px] font-bold text-emerald-800">
                  {isAr ? 'إجمالي المقبوضات' : 'Total Revenue'}
                </div>
                <div className="text-base sm:text-lg font-mono font-black text-emerald-700 mt-0.5">
                  +{formatJod(summary.totalRevenueJod, lang)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200/80">
                <div className="text-[11px] font-bold text-rose-800">
                  {isAr ? 'إجمالي المصاريف' : 'Total Expenses'}
                </div>
                <div className="text-base sm:text-lg font-mono font-black text-rose-600 mt-0.5">
                  -{formatJod(summary.totalExpensesJod, lang)}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0B3B68] text-white">
                <div className="text-[11px] font-bold text-sky-200 flex items-center justify-between">
                  <span>{isAr ? 'الإجمالي مع الصباح' : 'Total Balance'}</span>
                  <span className="text-[10px] text-amber-300 font-mono">
                    ({isAr ? 'الربح:' : 'Net:'} {summary.netProfitJod >= 0 ? '+' : ''}
                    {summary.netProfitJod.toFixed(2)})
                  </span>
                </div>
                <div className="text-base sm:text-lg font-mono font-black text-amber-300 mt-0.5">
                  {formatJod(summary.totalBalanceWithMorningJod, lang)}
                </div>
              </div>
            </div>

            {/* Quick Day-by-Day Summary Table (جدول ملخص الأيام السريع لسهولة الرؤية والمقارنة) */}
            {dayGroups.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-extrabold text-[#0B3B68] flex items-center gap-1.5">
                    <span>
                      {isAr
                        ? `جدول ملخص الأيام (${dayGroups.length} يوم)`
                        : `Daily Summary Overview (${dayGroups.length} Days)`}
                    </span>
                  </h3>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 text-[#0B3B68] font-extrabold border-b border-slate-200">
                        <th className="py-2 px-2 text-center w-8">#</th>
                        <th className="py-2 px-3 text-start">{isAr ? 'اليوم والتاريخ' : 'Day & Date'}</th>
                        <th className="py-2 px-2 text-center">{isAr ? 'الحركات' : 'Items'}</th>
                        <th className="py-2 px-2.5 text-start">{isAr ? 'كاش الصباح' : 'Morning'}</th>
                        <th className="py-2 px-2.5 text-start">{isAr ? 'المقبوضات' : 'Revenue'}</th>
                        <th className="py-2 px-2.5 text-start">{isAr ? 'المصاريف' : 'Expenses'}</th>
                        <th className="py-2 px-2.5 text-start">{isAr ? 'صافي اليوم' : 'Day Net'}</th>
                        <th className="py-2 px-3 text-end">{isAr ? 'الإجمالي مع الصباح' : 'Total Balance'}</th>
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
                          <td className="py-2 px-2 text-center font-mono font-bold text-slate-600">
                            {dg.totalMovementsCount}
                          </td>
                          <td className="py-2 px-2.5 font-mono font-bold text-[#0B3B68] whitespace-nowrap">
                            {formatJod(dg.morningJod, lang)}
                          </td>
                          <td className="py-2 px-2.5 font-mono font-black text-emerald-700 whitespace-nowrap">
                            +{formatJod(dg.revenueJod, lang)}
                          </td>
                          <td className="py-2 px-2.5 font-mono font-black text-rose-600 whitespace-nowrap">
                            -{formatJod(dg.expensesJod, lang)}
                          </td>
                          <td
                            className={`py-2 px-2.5 font-mono font-black whitespace-nowrap ${
                              dg.netProfitJod >= 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {dg.netProfitJod >= 0 ? '+' : ''}
                            {formatJod(dg.netProfitJod, lang)}
                          </td>
                          <td className="py-2 px-3 text-end font-mono font-black text-[#0B3B68] whitespace-nowrap bg-sky-50/40">
                            {formatJod(dg.totalWithMorningJod, lang)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Day-by-Day Detailed Financial Movements (التفصيل اليومي المفصل على الأيام لسهولة الرؤيا) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#0B3B68]">
                  {isAr
                    ? 'التفصيل اليومي للحركات المالية (مفصل حسب كل يوم)'
                    : 'Day-by-Day Detailed Financial Breakdown'}
                </h3>
                <span className="text-[11px] font-bold text-slate-500">
                  {isAr
                    ? `${dayGroups.length} يوم · ${
                        periodMorningCash.length + periodPaidVisits.length + periodExpenses.length
                      } حركة مالية`
                    : `${dayGroups.length} Days`}
                </span>
              </div>

              {dayGroups.length === 0 ? (
                <div className="p-6 text-center rounded-xl border border-slate-200 text-slate-400 font-bold text-xs">
                  {isAr
                    ? 'لا توجد حركات مالية مسجلة في هذه الفترة'
                    : 'No financial records in this period'}
                </div>
              ) : (
                dayGroups.map((dg) => {
                  let rowIndex = 0;
                  return (
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
                            ({dg.totalMovementsCount} {isAr ? 'حركة' : 'items'})
                          </span>
                        </div>

                        {/* Day Subtotals Bar */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono font-bold">
                          {dg.morningJod > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-white/15 text-sky-100">
                              {isAr ? 'الصباح:' : 'Morning:'} {formatJod(dg.morningJod, lang)}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-lg bg-emerald-500/25 text-emerald-200 border border-emerald-400/30">
                            {isAr ? 'مقبوضات:' : 'Rev:'} +{formatJod(dg.revenueJod, lang)}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-rose-500/25 text-rose-200 border border-rose-400/30">
                            {isAr ? 'مصاريف:' : 'Exp:'} -{formatJod(dg.expensesJod, lang)}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-300/30 font-black">
                            {isAr ? 'صافي اليوم:' : 'Net:'}{' '}
                            {dg.netProfitJod >= 0 ? '+' : ''}
                            {formatJod(dg.netProfitJod, lang)}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-white text-[#0B3B68] font-black">
                            {isAr ? 'الإجمالي:' : 'Total:'} {formatJod(dg.totalWithMorningJod, lang)}
                          </span>
                        </div>
                      </div>

                      {/* Day Detailed Movements Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100/90 text-[#0B3B68] font-extrabold border-b border-slate-200">
                              <th className="py-2 px-2 text-center w-8">#</th>
                              <th className="py-2 px-3 text-start w-32">{isAr ? 'نوع الحركة' : 'Type'}</th>
                              <th className="py-2 px-3 text-start">
                                {isAr ? 'البيان / الزبون والتفاصيل' : 'Customer / Description'}
                              </th>
                              <th className="py-2 px-2.5 text-start w-28">
                                {isAr ? 'طريقة الدفع' : 'Payment'}
                              </th>
                              <th className="py-2 px-3 text-end w-28">{isAr ? 'المبلغ' : 'Amount'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {dg.totalMovementsCount === 0 ? (
                              <tr>
                                <td colSpan={5} className="p-4 text-center text-slate-400 font-bold">
                                  {isAr
                                    ? 'لا توجد حركات مالية مسجلة في هذا اليوم'
                                    : 'No financial movements on this day'}
                                </td>
                              </tr>
                            ) : (
                              <>
                                {/* 1. Morning Cash for this Day */}
                                {dg.morningCashList.map((m) => {
                                  rowIndex += 1;
                                  return (
                                    <tr key={m.id} className="bg-sky-50/40 hover:bg-sky-50/70">
                                      <td className="py-2 px-2 text-center font-mono text-slate-400 font-bold">
                                        {rowIndex}
                                      </td>
                                      <td className="py-2 px-3 whitespace-nowrap">
                                        <span className="inline-block px-2 py-0.5 rounded-md bg-sky-100 text-[#0B3B68] font-extrabold text-[10px]">
                                          {isAr ? 'كاش الصباح' : 'Morning Cash'}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 font-extrabold text-slate-900">
                                        <bdi>
                                          {m.note ||
                                            (isAr
                                              ? 'رصيد كاش الصباح الافتتاحي'
                                              : 'Opening Morning Cash')}
                                        </bdi>
                                      </td>
                                      <td className="py-2 px-2.5 font-bold text-slate-600">
                                        {isAr ? 'كاش' : 'Cash'}
                                      </td>
                                      <td className="py-2 px-3 text-end font-mono font-black text-[#0B3B68] whitespace-nowrap">
                                        +{formatJod(m.amountJod, lang)}
                                      </td>
                                    </tr>
                                  );
                                })}

                                {/* 2. Paid Maintenance Visits for this Day */}
                                {dg.paidVisitsList.map((v) => {
                                  rowIndex += 1;
                                  return (
                                    <tr key={v.id} className="hover:bg-emerald-50/30">
                                      <td className="py-2 px-2 text-center font-mono text-slate-400 font-bold">
                                        {rowIndex}
                                      </td>
                                      <td className="py-2 px-3 whitespace-nowrap">
                                        <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                                          {isAr ? 'مقبوضات صيانة' : 'Paid Revenue'}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3">
                                        <div className="font-extrabold text-slate-900">
                                          <bdi>{v.customerName}</bdi>
                                        </div>
                                        <div className="text-[11px] font-bold text-slate-600">
                                          <bdi>{v.problem}</bdi>
                                        </div>
                                      </td>
                                      <td className="py-2 px-2.5 font-bold text-slate-700 whitespace-nowrap">
                                        {getPaymentMethodLabel(v.paymentMethod)}
                                      </td>
                                      <td className="py-2 px-3 text-end font-mono font-black text-emerald-700 whitespace-nowrap">
                                        +{formatJod(v.amountJod, lang)}
                                      </td>
                                    </tr>
                                  );
                                })}

                                {/* 3. Operating Expenses for this Day */}
                                {dg.expensesList.map((e) => {
                                  rowIndex += 1;
                                  return (
                                    <tr key={e.id} className="bg-rose-50/25 hover:bg-rose-50/50">
                                      <td className="py-2 px-2 text-center font-mono text-slate-400 font-bold">
                                        {rowIndex}
                                      </td>
                                      <td className="py-2 px-3 whitespace-nowrap">
                                        <span className="inline-block px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold text-[10px]">
                                          {isAr ? 'مصروف' : 'Expense'} · {getCategoryLabel(e.category)}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3">
                                        <div className="font-extrabold text-slate-900">
                                          <bdi>{e.title}</bdi>
                                        </div>
                                        {e.partType && (
                                          <div className="text-[11px] font-bold text-slate-600">
                                            <bdi>{e.partType}</bdi>
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-2 px-2.5 font-bold text-slate-700 whitespace-nowrap">
                                        {getPaymentMethodLabel(e.paymentMethod)}
                                      </td>
                                      <td className="py-2 px-3 text-end font-mono font-black text-rose-600 whitespace-nowrap">
                                        -{formatJod(e.amountJod, lang)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
