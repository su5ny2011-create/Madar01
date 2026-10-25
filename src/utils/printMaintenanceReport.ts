import type { Language, MaintenanceVisit } from '../types';
import { formatJod, getDayName, getTodayStr, isVisitUnpaid } from './logic';

export interface PrintMaintenanceReportOptions {
  visits: MaintenanceVisit[];
  lang: Language;
  titleAr?: string;
  titleEn?: string;
  subtitleAr?: string;
  subtitleEn?: string;
  currentUserFullName?: string;
}

function escapeHtml(val: string | number | undefined | null): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printDailyMaintenanceReport({
  visits,
  lang,
  titleAr = 'تقرير أعمال وطلبات الصيانة اليومية',
  titleEn = 'Daily Maintenance Requests Report',
  subtitleAr,
  subtitleEn,
  currentUserFullName,
}: PrintMaintenanceReportOptions): void {
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const alignStart = isAr ? 'right' : 'left';
  const alignEnd = isAr ? 'left' : 'right';
  const todayStr = getTodayStr();

  const sortedVisits = [...visits].sort((a, b) =>
    `${b.visitDate} ${b.visitTime}`.localeCompare(`${a.visitDate} ${a.visitTime}`)
  );

  const totalCount = sortedVisits.length;
  const resolvedCount = sortedVisits.filter(
    (v) => v.isResolved || v.status === 'resolved'
  ).length;
  const pendingCount = totalCount - resolvedCount;
  const paidTotalJod = sortedVisits
    .filter((v) => v.isPaid)
    .reduce((sum, v) => sum + (Number(v.amountJod) || 0), 0);
  const unpaidTotalJod = sortedVisits
    .filter((v) => isVisitUnpaid(v))
    .reduce((sum, v) => sum + (Number(v.amountJod) || 0), 0);

  const getPaymentMethodLabel = (method?: string) => {
    if (isAr) {
      return method === 'cash'
        ? 'كاش'
        : method === 'check'
        ? 'شيك'
        : 'كلك CliQ';
    }
    return method === 'cash' ? 'Cash' : method === 'check' ? 'Check' : 'CliQ';
  };

  const rowsHtml =
    sortedVisits.length === 0
      ? `<tr><td colspan="8" style="text-align:center;padding:16px;color:#64748b;font-weight:700;">${
          isAr
            ? 'لا توجد طلبات صيانة مطابقة للطباعة حالياً'
            : 'No maintenance requests to print'
        }</td></tr>`
      : sortedVisits
          .map((v, idx) => {
            const isResolved = Boolean(v.isResolved || v.status === 'resolved');
            const isInProgress = v.status === 'in_progress' && !isResolved;
            const statusText = isResolved
              ? isAr
                ? 'منجز (تم الحل)'
                : 'Resolved'
              : isInProgress
              ? isAr
                ? 'جاري العمل'
                : 'In Progress'
              : isAr
              ? 'قيد الانتظار'
              : 'Pending';
            const statusColor = isResolved
              ? '#145A32'
              : isInProgress
              ? '#0B3B68'
              : '#92400e';
            const statusBg = isResolved
              ? '#dcfce7'
              : isInProgress
              ? '#e0f2fe'
              : '#fef3c7';

            let paymentBadge = '';
            let amountDisplay = '';

            if (v.visitType === 'contract') {
              paymentBadge = `<span style="color:#0B3B68;font-weight:800;">${
                isAr ? 'عقد دوري' : 'Contract'
              }</span>`;
              amountDisplay = '-';
            } else if (v.noPayment) {
              paymentBadge = `<span style="color:#475569;font-weight:800;">${
                isAr ? 'بدون دفع' : 'No Payment'
              }</span>`;
              amountDisplay = '0.00';
            } else if (v.isPaid) {
              paymentBadge = `<span style="color:#145A32;font-weight:800;">${
                isAr ? 'مدفوع' : 'Paid'
              } (${getPaymentMethodLabel(v.paymentMethod)})</span>`;
              amountDisplay = formatJod(v.amountJod, lang);
            } else {
              paymentBadge = `<span style="color:#b91c1c;font-weight:800;">${
                isAr ? 'غير مدفوع' : 'Unpaid'
              }</span>`;
              amountDisplay = formatJod(v.amountJod, lang);
            }

            const partsLines: string[] = [];
            if (v.installedParts && v.installedParts.length > 0) {
              partsLines.push(
                `<div style="color:#145A32;font-weight:700;">✓ ${
                  isAr ? 'ركب: ' : 'Installed: '
                }${escapeHtml(v.installedParts.join(' + '))}</div>`
              );
            }
            if (v.requiredParts && v.requiredParts.length > 0) {
              partsLines.push(
                `<div style="color:#92400e;font-weight:700;">• ${
                  isAr ? 'يلزم: ' : 'Required: '
                }${escapeHtml(v.requiredParts.join(' + '))}</div>`
              );
            }

            return `
          <tr>
            <td style="text-align:center;font-weight:700;">${idx + 1}</td>
            <td>
              <div style="font-weight:800;color:#0f172a;">${escapeHtml(v.visitDate)}</div>
              <div style="font-size:10px;color:#64748b;">${escapeHtml(
                getDayName(v.visitDate, lang)
              )} (${escapeHtml(v.visitTime)})</div>
            </td>
            <td>
              <div style="font-weight:800;color:#0B3B68;">${escapeHtml(
                v.customerName
              )}</div>
              ${
                v.phone
                  ? `<div dir="ltr" style="font-size:10px;color:#475569;font-family:monospace;">${escapeHtml(
                      v.phone
                    )}</div>`
                  : ''
              }
              <div style="font-size:9.5px;color:#64748b;">${
                v.visitType === 'contract'
                  ? isAr
                    ? 'عقد صيانة'
                    : 'Contract'
                  : isAr
                  ? 'زيارة صيانة'
                  : 'Single Visit'
              }${
              v.technicianName ? ` · ${escapeHtml(v.technicianName)}` : ''
            }</div>
            </td>
            <td>
              <div style="font-weight:700;color:#0f172a;">${escapeHtml(v.problem)}</div>
              ${
                v.note
                  ? `<div style="font-size:10px;color:#475569;margin-top:2px;">${escapeHtml(
                      v.note
                    )}</div>`
                  : ''
              }
            </td>
            <td style="font-size:10.5px;">
              ${partsLines.length > 0 ? partsLines.join('') : '-'}
            </td>
            <td style="text-align:center;">
              <span style="display:inline-block;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:800;background:${statusBg};color:${statusColor};">
                ${statusText}
              </span>
            </td>
            <td style="font-size:10.5px;">${paymentBadge}</td>
            <td style="text-align:${alignEnd};font-weight:800;font-family:monospace;color:#0B3B68;">
              ${escapeHtml(amountDisplay)}
            </td>
          </tr>`;
          })
          .join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(isAr ? titleAr : titleEn)} - ${todayStr}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 14px;
      background: #ffffff;
      color: #0f172a;
      font-size: 11.5px;
      line-height: 1.45;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #0B3B68;
      padding-bottom: 10px;
      margin-bottom: 12px;
      gap: 12px;
    }
    .brand-title {
      font-size: 17px;
      font-weight: 900;
      color: #0B3B68;
      margin: 0;
    }
    .brand-sub {
      font-size: 11px;
      font-weight: 700;
      color: #E58E26;
      margin: 2px 0 0 0;
    }
    .report-badge {
      display: inline-block;
      background: #0B3B68;
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 7px;
      font-size: 13px;
      font-weight: 800;
      margin-bottom: 4px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 7px 10px;
      background: #f8fafc;
    }
    .kpi-label {
      font-size: 10px;
      font-weight: 700;
      color: #475569;
    }
    .kpi-val {
      font-size: 14px;
      font-weight: 900;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 7px;
      text-align: ${alignStart};
      vertical-align: top;
    }
    th {
      background: #f1f5f9;
      color: #0B3B68;
      font-weight: 800;
      font-size: 10.5px;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="brand-title">شركة المدار لتجارة تكنولوجيا المعلومات</h1>
      <p class="brand-sub" dir="ltr">Al-Madar Information Technology Trading Company</p>
      ${
        subtitleAr || subtitleEn
          ? `<div style="margin-top:4px;font-size:11px;color:#334155;font-weight:700;">${escapeHtml(
              isAr ? subtitleAr : subtitleEn
            )}</div>`
          : ''
      }
    </div>
    <div style="text-align:${alignEnd};">
      <div class="report-badge">${escapeHtml(isAr ? titleAr : titleEn)}</div>
      <div style="font-size:11px;font-weight:700;color:#0f172a;">
        ${isAr ? 'تاريخ التقرير:' : 'Report Date:'} ${escapeHtml(
    getDayName(todayStr, lang)
  )} ${todayStr}
      </div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">${isAr ? 'إجمالي الطلبات' : 'Total Requests'}</div>
      <div class="kpi-val" style="color:#0B3B68;">${totalCount}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${
        isAr ? 'منجز / قيد المتابعة' : 'Resolved / Pending'
      }</div>
      <div class="kpi-val" style="color:#1E824C;">${resolvedCount} / <span style="color:#d97706;">${pendingCount}</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${
        isAr ? 'إجمالي المدفوع (JOD)' : 'Paid Total (JOD)'
      }</div>
      <div class="kpi-val" style="color:#1E824C;">${formatJod(
        paidTotalJod,
        lang
      )}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">${
        isAr ? 'الذمم غير المدفوعة (JOD)' : 'Unpaid Total (JOD)'
      }</div>
      <div class="kpi-val" style="color:#b91c1c;">${formatJod(
        unpaidTotalJod,
        lang
      )}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:28px;text-align:center;">#</th>
        <th style="width:92px;">${isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
        <th style="width:135px;">${isAr ? 'الزبون والهاتف' : 'Customer'}</th>
        <th>${isAr ? 'المشكلة والملاحظات' : 'Problem & Notes'}</th>
        <th style="width:140px;">${isAr ? 'القطع المركبة / اللازمة' : 'Parts'}</th>
        <th style="width:82px;text-align:center;">${isAr ? 'الحالة' : 'Status'}</th>
        <th style="width:92px;">${isAr ? 'حالة الدفع' : 'Payment'}</th>
        <th style="width:80px;text-align:${alignEnd};">${
    isAr ? 'المبلغ' : 'Amount'
  }</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer">
    <div>${
      isAr
        ? 'شركة المدار لتجارة تكنولوجيا المعلومات — نظام إدارة الصيانة والمالية'
        : 'Al-Madar Information Technology Trading Company'
    }</div>
    <div>
      ${isAr ? 'تاريخ الطباعة:' : 'Printed on:'} ${todayStr}${
    currentUserFullName
      ? ` | ${isAr ? 'بواسطة:' : 'By:'} ${escapeHtml(currentUserFullName)}`
      : ''
  }
    </div>
  </div>
</body>
</html>`;

  const existingFrame = document.getElementById(
    'almadar-maintenance-print-frame'
  ) as HTMLIFrameElement | null;
  if (existingFrame && existingFrame.parentNode) {
    existingFrame.parentNode.removeChild(existingFrame);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'almadar-maintenance-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(htmlContent);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.print();
      }
    }, 300);
  } else {
    window.print();
  }
}
