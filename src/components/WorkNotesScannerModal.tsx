import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw,
  X,
  Plus,
  Eye,
  Wand2,
} from 'lucide-react';
import type { Language } from '../types';
import { compressImage } from '../utils/imageCompressor';
import { formatNotesText, formatPartName, formatSupplierName } from '../utils/textFormatter';

export interface ExtractedWorkData {
  transcribedText: string;
  notesSummary?: string;
  customerName?: string;
  phone?: string;
  problem?: string;
  technicianName?: string;
  requiredParts?: string[];
  installedParts?: string[];
  amountJod?: number | null;
}

interface WorkNotesScannerModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  onInsertNotes: (text: string, mode: 'replace' | 'append') => void;
  onApplyExtractedData?: (data: ExtractedWorkData) => void;
  titleCustom?: string;
  currentNotes?: string;
}

export const WorkNotesScannerModal: React.FC<WorkNotesScannerModalProps> = ({
  lang,
  isOpen,
  onClose,
  onInsertNotes,
  onApplyExtractedData,
  titleCustom,
  currentNotes = '',
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [isScanning, setIsScanning] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [extractedData, setExtractedData] = useState<ExtractedWorkData | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Reset modal state every time it opens so stale scan results never persist
  useEffect(() => {
    if (isOpen) {
      setImagePreview(null);
      setIsScanning(false);
      setTranscribedText('');
      setExtractedData(null);
      setErrorMsg('');
      setCopySuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)'
          : 'Please select a valid image file (JPG, PNG, WebP)'
      );
      return;
    }

    setErrorMsg('');
    setImageMime('image/jpeg');

    try {
      const compressedDataUrl = await compressImage(file, 1200, 1200, 0.78);
      setImagePreview(compressedDataUrl);
      triggerScan(compressedDataUrl, 'image/jpeg');
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImagePreview(dataUrl);
        triggerScan(dataUrl, file.type || 'image/jpeg');
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerScan = async (base64Img: string, mime: string) => {
    setIsScanning(true);
    setErrorMsg('');
    setTranscribedText('');
    setExtractedData(null);

    try {
      const res = await fetch('/api/scan-work-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Img,
          mimeType: mime,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'فشل في قراءة ورقة الملاحظات');
      }

      const data: ExtractedWorkData = json.data;
      const text = formatNotesText(data.transcribedText || data.notesSummary || '');
      setTranscribedText(text);
      setExtractedData({
        ...data,
        transcribedText: text,
        customerName: data.customerName ? formatSupplierName(data.customerName) : '',
        problem: data.problem ? formatNotesText(data.problem) : '',
        installedParts: (data.installedParts || []).map((p) => formatPartName(p)).filter(Boolean),
        requiredParts: (data.requiredParts || []).map((p) => formatPartName(p)).filter(Boolean),
      });
    } catch (err: any) {
      console.error('Scan error:', err);
      setErrorMsg(
        err?.message ||
          (lang === 'ar'
            ? 'تعذر قراءة الورقة بالذكاء الاصطناعي. تأكد من وضوح الصورة والإضاءة، أو اكتب الملاحظات يدوياً.'
            : 'Could not read work sheet. Ensure proper lighting and focus, or write notes manually.')
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleCopyText = () => {
    if (!transcribedText) return;
    navigator.clipboard.writeText(transcribedText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleFormatText = () => {
    if (!transcribedText) return;
    setTranscribedText(formatNotesText(transcribedText));
  };

  const handleApplyAll = () => {
    const cleanText = formatNotesText(transcribedText);
    if (onApplyExtractedData && (extractedData || cleanText)) {
      onApplyExtractedData({
        ...(extractedData || {}),
        transcribedText: cleanText,
        notesSummary: cleanText || extractedData?.notesSummary,
      });
    } else if (cleanText) {
      onInsertNotes(cleanText, currentNotes ? 'append' : 'replace');
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-3">
        {/* Modal Header */}
        <div className="bg-[#0B3B68] text-white px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>
                  {titleCustom ||
                    (lang === 'ar'
                      ? 'تصوير ورقة ملاحظات العمل وتفريغها كتابياً'
                      : 'Scan & Transcribe Work Notes Sheet')}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-900 uppercase">
                  OCR / AI
                </span>
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Action Trigger Buttons (Camera vs Upload) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="min-h-[48px] p-3 rounded-xl border-2 border-dashed border-[#0B3B68] bg-sky-50/70 hover:bg-sky-100/70 transition-colors flex items-center justify-center gap-2.5 text-slate-800 font-extrabold text-xs sm:text-sm cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-[#0B3B68] text-white flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div className="text-start">
                <div className="text-[#0B3B68]">
                  {lang === 'ar' ? 'التقاط بالكاميرا الآن' : 'Snap with Camera'}
                </div>
                <div className="text-[11px] text-slate-500 font-normal">
                  {lang === 'ar' ? 'كاميرا الهاتف أو التابلت' : 'Mobile / Tablet camera'}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[48px] p-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2.5 text-slate-800 font-extrabold text-xs sm:text-sm cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div className="text-start">
                <div className="text-slate-800">
                  {lang === 'ar' ? 'اختيار صورة من الجهاز' : 'Upload Image File'}
                </div>
                <div className="text-[11px] text-slate-500 font-normal">
                  {lang === 'ar' ? 'من المعرض أو المستندات' : 'From gallery or files'}
                </div>
              </div>
            </button>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Image Thumbnail and Retake Option */}
          {imagePreview && (
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={imagePreview}
                  alt="Work notes scan preview"
                  className="w-12 h-12 object-cover rounded-lg border border-slate-300 shrink-0 bg-white"
                />
                <div className="truncate">
                  <div className="text-xs font-bold text-slate-800 truncate">
                    {lang === 'ar' ? 'صورة ورقة العمل' : 'Work notes photo'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {lang === 'ar' ? 'تم تفريغ النص وتنسيقه لمنع التداخل' : 'Transcribed & formatted'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => triggerScan(imagePreview, imageMime)}
                disabled={isScanning}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-[#0B3B68] hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{lang === 'ar' ? 'إعادة القراءة' : 'Re-scan'}</span>
              </button>
            </div>
          )}

          {/* Loading Animation while scanning */}
          {isScanning && (
            <div className="p-5 rounded-xl bg-sky-50 border border-sky-200 text-center space-y-2">
              <div className="relative w-10 h-10 mx-auto">
                <div className="w-10 h-10 rounded-full border-4 border-sky-200 border-t-[#0B3B68] animate-spin" />
                <Sparkles className="w-4 h-4 text-[#E58E26] absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-[#0B3B68]">
                {lang === 'ar'
                  ? 'جاري قراءة ورقة الملاحظات وتنسيق الكلمات...'
                  : 'Analyzing and transcribing work notes...'}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-bold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {/* Transcribed Text Result & Review Area */}
          {(transcribedText || (!isScanning && imagePreview)) && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#1E824C]" />
                  <span className="text-xs font-extrabold text-slate-800">
                    {lang === 'ar'
                      ? 'النص المفرغ من الورقة (قابل للتعديل):'
                      : 'Transcribed Text (Editable):'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleFormatText}
                    disabled={!transcribedText}
                    className="px-2.5 py-1 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-[#0B3B68] text-2xs font-extrabold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Wand2 className="w-3 h-3 text-[#155E95]" />
                    <span>{lang === 'ar' ? 'تحسين النص' : 'Format'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyText}
                    disabled={!transcribedText}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-2xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {copySuccess ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-[#1E824C]" />
                        <span className="text-[#1E824C]">{lang === 'ar' ? 'تم النسخ' : 'Copied'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-500" />
                        <span>{lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <textarea
                value={transcribedText}
                onChange={(e) => setTranscribedText(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? 'سيظهر هنا النص المكتوب على الورقة تلقائياً، ويمكنك تعديله...'
                    : 'Extracted text from the paper will appear here...'
                }
                rows={4}
                className="w-full p-3 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              />

              {/* Extracted Editable Metadata Summary if detected */}
              {extractedData &&
                (extractedData.customerName ||
                  extractedData.problem ||
                  (extractedData.installedParts && extractedData.installedParts.length > 0) ||
                  extractedData.amountJod) && (
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2 text-xs">
                    <div className="font-extrabold text-[#0B3B68] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#E58E26]" />
                      <span>
                        {lang === 'ar'
                          ? 'بيانات مستخرجة من الورقة (قابلة للتعديل قبل الإدراج):'
                          : 'Detected Structured Data (Editable):'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-slate-500 block text-[10px] font-bold mb-0.5">
                          {lang === 'ar' ? 'الزبون' : 'Customer'}
                        </label>
                        <input
                          type="text"
                          value={extractedData.customerName || ''}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, customerName: e.target.value })
                          }
                          className="w-full h-8 px-2 rounded-lg bg-white border border-amber-200 text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="text-slate-500 block text-[10px] font-bold mb-0.5">
                          {lang === 'ar' ? 'العطل / المهمة' : 'Problem'}
                        </label>
                        <input
                          type="text"
                          value={extractedData.problem || ''}
                          onChange={(e) =>
                            setExtractedData({ ...extractedData, problem: e.target.value })
                          }
                          className="w-full h-8 px-2 rounded-lg bg-white border border-amber-200 text-xs font-bold text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="text-slate-500 block text-[10px] font-bold mb-0.5">
                          {lang === 'ar' ? 'المبلغ (د.أ)' : 'Amount (JOD)'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={extractedData.amountJod ?? ''}
                          onChange={(e) =>
                            setExtractedData({
                              ...extractedData,
                              amountJod: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="w-full h-8 px-2 rounded-lg bg-white border border-amber-200 text-xs font-mono font-bold text-slate-900"
                        />
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Quick Technician Guide */}
          {!imagePreview && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#0B3B68] shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'وجّه الكاميرا بشكل مستقيم فوق ورقة العمل بإضاءة واضحة، وسيتم تفريغ النص وتنسيقه تلقائياً.'
                  : 'Hold camera straight over the work notes paper with clear lighting.'}
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {currentNotes && transcribedText && (
              <button
                type="button"
                onClick={() => {
                  onInsertNotes(formatNotesText(transcribedText), 'append');
                  onClose();
                }}
                className="h-9 px-3.5 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 text-[#0B3B68] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إضافة للملاحظات الحالية' : 'Append'}</span>
              </button>
            )}

            <button
              type="button"
              disabled={!transcribedText && !extractedData?.customerName}
              onClick={handleApplyAll}
              className="h-9 px-4 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                {lang === 'ar'
                  ? 'إدراج وتعبئة البيانات في الطلب'
                  : 'Insert & Fill Request'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
