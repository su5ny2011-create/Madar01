import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { formatWhatsAppUrl } from './logic';

export interface PreparedPdfReport {
  blob: Blob;
  file: File;
  fileName: string;
  hostedPdfUrl: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function sanitizePdfFileName(fileName: string): string {
  const base = fileName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\u0600-\u06FF.-]/g, '');
  const withName = base || 'AlMadar_Report';
  return withName.toLowerCase().endsWith('.pdf') ? withName : `${withName}.pdf`;
}

/**
 * Generates an A4 portrait .pdf file from the report DOM element.
 * Uses `onclone` to force a clean 820px desktop print layout with all tables expanded,
 * ensuring the downloaded .pdf and WhatsApp-shared .pdf are 100% identical on mobile and desktop.
 */
export async function generatePdfFromElement(
  element: HTMLElement,
  fileName: string
): Promise<{ blob: Blob; file: File; fileName: string }> {
  const cleanName = sanitizePdfFileName(fileName);
  const targetWidth = 820;

  element.setAttribute('data-pdf-capture-root', 'true');
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: targetWidth,
      onclone: (clonedDoc) => {
        const clonedTarget = clonedDoc.querySelector(
          '[data-pdf-capture-root="true"]'
        ) as HTMLElement | null;
        if (clonedTarget) {
          clonedTarget.style.width = `${targetWidth}px`;
          clonedTarget.style.maxWidth = `${targetWidth}px`;
          clonedTarget.style.height = 'auto';
          clonedTarget.style.maxHeight = 'none';
          clonedTarget.style.overflow = 'visible';
          clonedTarget.style.margin = '0 auto';
          clonedTarget.style.padding = '24px';
          clonedTarget.style.backgroundColor = '#ffffff';
          clonedTarget.style.borderRadius = '0px';
          clonedTarget.style.border = 'none';
          clonedTarget.style.boxShadow = 'none';

          // Ensure all parent containers do not clip or hide content
          let parent = clonedTarget.parentElement;
          while (parent && parent !== clonedDoc.body) {
            parent.style.overflow = 'visible';
            parent.style.maxHeight = 'none';
            parent.style.height = 'auto';
            parent = parent.parentElement;
          }

          // Ensure all horizontal scroll containers are fully expanded in the PDF
          const scrollContainers = clonedTarget.querySelectorAll('.overflow-x-auto');
          scrollContainers.forEach((sc) => {
            (sc as HTMLElement).style.overflow = 'visible';
            (sc as HTMLElement).style.maxHeight = 'none';
          });

          // Remove any interactive buttons marked no-print inside the capture container
          const noPrintEls = clonedTarget.querySelectorAll('.no-print');
          noPrintEls.forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });
        }
      },
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 7;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const imgHeight = (canvas.height * usableWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = margin;
    const imageAlias = 'ALMADAR_REPORT_CANVAS';

    pdf.addImage(
      imgData,
      'JPEG',
      margin,
      position,
      usableWidth,
      imgHeight,
      imageAlias,
      'FAST'
    );
    heightLeft -= usableHeight;

    while (heightLeft > 2) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(
        imgData,
        'JPEG',
        margin,
        position,
        usableWidth,
        imgHeight,
        imageAlias,
        'FAST'
      );
      heightLeft -= usableHeight;
    }

    const blob = pdf.output('blob');
    const file = new File([blob], cleanName, {
      type: 'application/pdf',
      lastModified: Date.now(),
    });
    return { blob, file, fileName: cleanName };
  } finally {
    element.removeAttribute('data-pdf-capture-root');
  }
}

export async function uploadPdfReportForDirectLink(
  blob: Blob,
  fileName: string
): Promise<string> {
  try {
    const cleanName = sanitizePdfFileName(fileName);
    const pdfBase64 = await blobToDataUrl(blob);
    const response = await fetch('/api/reports/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64, fileName: cleanName }),
    });
    if (response.ok) {
      const data = (await response.json()) as { path?: string };
      if (data?.path) {
        return `${window.location.origin}${data.path}`;
      }
    }
  } catch {
    // Fallback if offline
  }
  return '';
}

/**
 * Generates the local .pdf File & Blob immediately (without blocking on network upload).
 */
export async function preparePdfReport(
  element: HTMLElement,
  fileName: string
): Promise<PreparedPdfReport> {
  const { blob, file, fileName: cleanName } = await generatePdfFromElement(
    element,
    fileName
  );
  return {
    blob,
    file,
    fileName: cleanName,
    hostedPdfUrl: '',
  };
}

export function triggerBrowserPdfDownload(blob: Blob, fileName: string): void {
  const cleanName = sanitizePdfFileName(fileName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function downloadPdfFromElement(
  element: HTMLElement,
  fileName: string,
  preGenerated?: PreparedPdfReport | null
): Promise<PreparedPdfReport> {
  const cleanName = sanitizePdfFileName(fileName);
  if (preGenerated && preGenerated.fileName === cleanName) {
    triggerBrowserPdfDownload(preGenerated.blob, cleanName);
    return preGenerated;
  }
  const generated = await preparePdfReport(element, cleanName);
  triggerBrowserPdfDownload(generated.blob, cleanName);
  return generated;
}

/**
 * Shares the exact same .pdf file via WhatsApp.
 * 1. First attempts native Web Share Level 2 (`navigator.share({ files: [pdfFile] })`) synchronously
 *    on the user click gesture so WhatsApp attaches the actual `.pdf` binary document directly.
 * 2. If the browser/desktop environment does not support native file sharing, downloads the `.pdf`
 *    file to the device AND opens WhatsApp with a direct `.pdf` download link.
 */
export async function sharePdfReportViaWhatsApp(options: {
  element: HTMLElement;
  fileName: string;
  phone?: string;
  reportTitle: string;
  summaryText?: string;
  preGenerated?: PreparedPdfReport | null;
}): Promise<'shared_native_pdf' | 'sent_pdf_link_and_downloaded'> {
  const cleanName = sanitizePdfFileName(options.fileName);

  // 1. Synchronous native file share when `preGenerated` is ready in memory.
  // Calling `navigator.share({ files: [file] })` BEFORE any `await` preserves transient user activation.
  // Passing ONLY `files: [pdfFile]` guarantees WhatsApp receives the actual .pdf file as a document attachment.
  if (
    options.preGenerated &&
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function'
  ) {
    try {
      const pdfFile =
        options.preGenerated.file && options.preGenerated.file.name === cleanName
          ? options.preGenerated.file
          : new File([options.preGenerated.blob], cleanName, {
              type: 'application/pdf',
              lastModified: Date.now(),
            });

      if (navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
        });
        return 'shared_native_pdf';
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        return 'shared_native_pdf';
      }
    }
  }

  // 2. Generate or use pre-generated PDF
  const prepared =
    options.preGenerated && options.preGenerated.fileName === cleanName
      ? options.preGenerated
      : await preparePdfReport(options.element, cleanName);

  // 3. Native file share fallback
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function'
  ) {
    try {
      if (navigator.canShare({ files: [prepared.file] })) {
        await navigator.share({
          files: [prepared.file],
        });
        return 'shared_native_pdf';
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        return 'shared_native_pdf';
      }
    }
  }

  // 4. Desktop fallback where Web Share API for files isn't supported:
  // Immediately download the exact .pdf file to user's device so they have the .pdf file.
  triggerBrowserPdfDownload(prepared.blob, cleanName);

  // Open WhatsApp without page link writing ("وليس كتابة صفحة pdf")
  const waMessage = `📄 مرفق ملف التقرير: ${cleanName}`;
  const encoded = encodeURIComponent(waMessage);
  const waUrl = options.phone
    ? formatWhatsAppUrl(options.phone, waMessage)
    : `https://api.whatsapp.com/send?text=${encoded}`;

  const waLink = document.createElement('a');
  waLink.href = waUrl;
  waLink.target = '_blank';
  waLink.rel = 'noopener noreferrer';
  document.body.appendChild(waLink);
  waLink.click();
  document.body.removeChild(waLink);

  return 'sent_pdf_link_and_downloaded';
}
