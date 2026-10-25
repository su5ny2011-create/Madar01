import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  Receipt,
  CheckCircle2,
  AlertCircle,
  X,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  Building2,
  Wand2,
  FileText,
} from 'lucide-react';
import type { Language, PurchasePaymentMethod } from '../types';
import { formatJod, getTodayStr } from '../utils/logic';
import { compressImage } from '../utils/imageCompressor';
import {
  cleanAndFormatText,
  cleanSupplierName,
  cleanInvoiceNumber,
} from '../utils/textFormatter';

export interface ExtractedPurchaseItem {
  id?: string;
  partName: string;
  category: string;
  quantity: number;
  unit: string;
  unitCostJod: number;
  totalCostJod: number;
  suggestedSellingPriceJod?: number;
}

export interface ExtractedInvoiceData {
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  paymentMethod?: PurchasePaymentMethod;
  notes?: string;
  totalCostJod?: number;
  items: ExtractedPurchaseItem[];
}

interface InvoiceScannerModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  existingSuppliers?: string[];
  defaultSupplierName?: string;
  defaultInvoiceDate?: string;
  onApplyExtractedPurchases: (
    items: ExtractedPurchaseItem[],
    metadata: {
      supplierName: string;
      invoiceNumber: string;
      invoiceDate: string;
      paymentMethod: PurchasePaymentMethod;
      notes: string;
      invoiceImageUrl?: string;
    }
  ) => void;
}

const COMMON_CATEGORIES = [
  'تخزين وهاردوير',
  'شبكات وكابلات',
  'كاميرات ومراقبة',
  'قطع غيار وطابعات',
  'محولات وكهرباء',
  'إكسسوارات وملحقات',
  'أخرى',
];

export const InvoiceScannerModal: React.FC<InvoiceScannerModalProps> = ({
  lang,
  isOpen,
  onClose,
  existingSuppliers = [],
  defaultSupplierName = '',
  defaultInvoiceDate,
  onApplyExtractedPurchases,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrHighResImage, setOcrHighResImage] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [formatSuccessMsg, setFormatSuccessMsg] = useState('');
  const [showFullImage, setShowFullImage] = useState(false);

  // Extracted and editable invoice fields
  const [supplierName, setSupplierName] = useState(defaultSupplierName || '');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(defaultInvoiceDate || getTodayStr());
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ExtractedPurchaseItem[]>([]);

  // Item currently being added manually to the list
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [newItemUnit, setNewItemUnit] = useState('قطعة');
  const [newItemCost, setNewItemCost] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('تخزين وهاردوير');
  const [newItemSellPrice, setNewItemSellPrice] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Reset modal state cleanly when opened
  useEffect(() => {
    if (isOpen) {
      setImagePreview(null);
      setOcrHighResImage(null);
      setIsScanning(false);
      setErrorMsg('');
      setFormatSuccessMsg('');
      setShowFullImage(false);
      setSupplierName(defaultSupplierName || '');
      setInvoiceNumber('');
      setInvoiceDate(defaultInvoiceDate || getTodayStr());
      setPaymentMethod('cash');
      setNotes('');
      setItems([]);
      setNewItemName('');
      setNewItemQty('1');
      setNewItemUnit('قطعة');
      setNewItemCost('');
      setNewItemCategory('تخزين وهاردوير');
      setNewItemSellPrice('');
    }
  }, [isOpen, defaultSupplierName, defaultInvoiceDate]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى اختيار ملف صورة صالح للفاتورة (JPG, PNG, WebP)'
          : 'Please select a valid invoice image (JPG, PNG, WebP)'
      );
      return;
    }

    setErrorMsg('');
    setImageMime('image/jpeg');

    try {
      // High clarity copy for AI OCR text extraction
      const highResDataUrl = await compressImage(file, 1300, 1300, 0.84);
      // Lightweight copy for database storage so it never gets stripped
      const storageDataUrl = await compressImage(file, 700, 700, 0.58);
      setImagePreview(storageDataUrl);
      setOcrHighResImage(highResDataUrl);
      triggerScan(highResDataUrl, 'image/jpeg');
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setImagePreview(dataUrl);
        setOcrHighResImage(dataUrl);
        triggerScan(dataUrl, file.type || 'image/jpeg');
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerScan = async (base64Img: string, mime: string) => {
    setIsScanning(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/scan-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Img,
          mimeType: mime,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'تعذر معالجة صورة الفاتورة');
      }

      const data: ExtractedInvoiceData = json.data;
      if (data) {
        if (data.supplierName) setSupplierName(cleanSupplierName(data.supplierName));
        if (data.invoiceNumber) setInvoiceNumber(cleanInvoiceNumber(data.invoiceNumber));
        // Keep the entry date (defaultInvoiceDate or today) so the invoice is always recorded on the date it was entered
        if (!invoiceDate) {
          setInvoiceDate(defaultInvoiceDate || getTodayStr());
        }
        if (
          data.paymentMethod === 'cash' ||
          data.paymentMethod === 'cliq' ||
          data.paymentMethod === 'credit'
        ) {
          setPaymentMethod(data.paymentMethod);
        }
        if (data.notes) setNotes(cleanAndFormatText(data.notes));

        if (Array.isArray(data.items) && data.items.length > 0) {
          const parsedItems: ExtractedPurchaseItem[] = data.items.map((it, idx) => {
            const qty = Math.max(0.1, Number(it.quantity) || 1);
            const rawUnitCost = Math.max(0, Number(it.unitCostJod) || 0);
            const rawTotal = Math.max(0, Number(it.totalCostJod) || 0);
            const cost =
              rawUnitCost > 0
                ? rawUnitCost
                : rawTotal > 0
                ? Math.round((rawTotal / qty) * 100) / 100
                : 0;
            const total =
              rawTotal > 0 ? rawTotal : Math.round(qty * cost * 100) / 100;
            const sell =
              Number(it.suggestedSellingPriceJod) ||
              (cost > 0 ? Math.round(cost * 1.35 * 100) / 100 : undefined);

            const formattedName =
              cleanAndFormatText(it.partName) || `قطعة رقم ${idx + 1}`;
            const matchedCategory = COMMON_CATEGORIES.includes(it.category)
              ? it.category
              : 'تخزين وهاردوير';

            return {
              id: `item-${Date.now()}-${idx}`,
              partName: formattedName,
              category: matchedCategory,
              quantity: qty,
              unit: cleanAndFormatText(it.unit) || 'قطعة',
              unitCostJod: cost,
              totalCostJod: total,
              suggestedSellingPriceJod: sell && sell > 0 ? sell : undefined,
            };
          });
          setItems(parsedItems);
        } else {
          const fallbackTotal = Math.max(0, Number(data.totalCostJod) || 0);
          setItems([
            {
              id: `item-${Date.now()}-1`,
              partName: 'مشتريات فاتورة قطع غيار',
              category: 'تخزين وهاردوير',
              quantity: 1,
              unit: 'فاتورة',
              unitCostJod: fallbackTotal,
              totalCostJod: fallbackTotal,
              suggestedSellingPriceJod:
                fallbackTotal > 0
                  ? Math.round(fallbackTotal * 1.35 * 100) / 100
                  : undefined,
            },
          ]);
        }
      }
    } catch (err: any) {
      console.warn('Scan invoice warning:', err);
      setErrorMsg(
        lang === 'ar'
          ? 'تم إرفاق صورة الفاتورة بنجاح. يمكنك كتابة أو تعديل القطع بالأسفل أو إعادة المسح.'
          : 'Invoice attached. You can review and enter items below or try scanning again.'
      );
      if (items.length === 0) {
        setItems([
          {
            id: `item-${Date.now()}-1`,
            partName: '',
            category: 'تخزين وهاردوير',
            quantity: 1,
            unit: 'قطعة',
            unitCostJod: 0,
            totalCostJod: 0,
          },
        ]);
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Beautify & format all text fields to prevent any overlapping or messy writing
  const handleBeautifyAllText = () => {
    setSupplierName((prev) => cleanSupplierName(prev));
    setInvoiceNumber((prev) => cleanInvoiceNumber(prev));
    setNotes((prev) => cleanAndFormatText(prev));
    setNewItemName((prev) => cleanAndFormatText(prev));
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        partName: cleanAndFormatText(item.partName),
        unit: cleanAndFormatText(item.unit) || 'قطعة',
      }))
    );
    setFormatSuccessMsg(
      lang === 'ar'
        ? 'تم تحسين وتنسيق صياغة جميع النصوص وفصل الكلمات المتداخلة بنجاح!'
        : 'All text fields formatted and cleaned successfully!'
    );
    setTimeout(() => setFormatSuccessMsg(''), 3000);
  };

  const handleAddItem = () => {
    const cleanedName = cleanAndFormatText(newItemName);
    if (!cleanedName) return;
    const qty = Math.max(0.1, parseFloat(newItemQty) || 1);
    const unitCost = Math.max(0, parseFloat(newItemCost) || 0);
    const sellPrice =
      parseFloat(newItemSellPrice) ||
      (unitCost > 0 ? Math.round(unitCost * 1.35 * 100) / 100 : undefined);
    const total = Math.round(qty * unitCost * 100) / 100;

    const newItem: ExtractedPurchaseItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      partName: cleanedName,
      category: newItemCategory,
      quantity: qty,
      unit: cleanAndFormatText(newItemUnit) || 'قطعة',
      unitCostJod: unitCost,
      totalCostJod: total,
      suggestedSellingPriceJod: sellPrice,
    };

    setItems([...items, newItem]);
    setNewItemName('');
    setNewItemCost('');
    setNewItemQty('1');
    setNewItemSellPrice('');
    setErrorMsg('');
  };

  const handleRemoveItem = (idxToRemove: number) => {
    setItems(items.filter((_, idx) => idx !== idxToRemove));
  };

  const handleUpdateItemField = (
    idx: number,
    field: keyof ExtractedPurchaseItem,
    val: any
  ) => {
    setItems(
      items.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: val };
        if (field === 'quantity' || field === 'unitCostJod') {
          const q = field === 'quantity' ? Math.max(0.1, Number(val) || 0) : item.quantity;
          const c = field === 'unitCostJod' ? Math.max(0, Number(val) || 0) : item.unitCostJod;
          updated.totalCostJod = Math.round(q * c * 100) / 100;
          if (field === 'unitCostJod' && c > 0 && !item.suggestedSellingPriceJod) {
            updated.suggestedSellingPriceJod = Math.round(c * 1.35 * 100) / 100;
          }
        } else if (field === 'totalCostJod') {
          const tot = Math.max(0, Number(val) || 0);
          const q = Math.max(0.1, item.quantity || 1);
          updated.unitCostJod = Math.round((tot / q) * 100) / 100;
        }
        return updated;
      })
    );
  };

  const grandTotalCost = items.reduce((acc, it) => acc + (it.totalCostJod || 0), 0);

  const handleConfirmAndInsert = () => {
    // Include any pending item typed in the quick-add row so user work is never lost
    const finalItems = [...items];
    if (newItemName.trim().length > 0) {
      const qty = Math.max(0.1, parseFloat(newItemQty) || 1);
      const unitCost = Math.max(0, parseFloat(newItemCost) || 0);
      const sellPrice =
        parseFloat(newItemSellPrice) ||
        (unitCost > 0 ? Math.round(unitCost * 1.35 * 100) / 100 : undefined);
      finalItems.push({
        id: `item-${Date.now()}-pending`,
        partName: cleanAndFormatText(newItemName),
        category: newItemCategory,
        quantity: qty,
        unit: cleanAndFormatText(newItemUnit) || 'قطعة',
        unitCostJod: unitCost,
        totalCostJod: Math.round(qty * unitCost * 100) / 100,
        suggestedSellingPriceJod: sellPrice,
      });
    }

    const validItems = finalItems
      .map((it) => ({
        ...it,
        partName: cleanAndFormatText(it.partName),
      }))
      .filter((it) => it.partName.length > 0);

    if (validItems.length === 0) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى إدخال اسم قطعة واحدة على الأقل لإدراج الفاتورة'
          : 'Please provide at least one valid item name'
      );
      return;
    }

    onApplyExtractedPurchases(validItems, {
      supplierName:
        cleanSupplierName(supplierName) ||
        (lang === 'ar' ? 'مورد غير محدد' : 'Unknown Supplier'),
      invoiceNumber: cleanInvoiceNumber(invoiceNumber),
      invoiceDate: invoiceDate || getTodayStr(),
      paymentMethod,
      notes: cleanAndFormatText(notes),
      invoiceImageUrl: imagePreview || undefined,
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] my-2 sm:my-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#0B3B68] via-indigo-900 to-[#0B3B68] p-4 sm:p-5 text-white shrink-0">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-amber-300 shrink-0">
                <Receipt className="w-6 h-6" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                    {lang === 'ar'
                      ? 'تصوير وإضافة فاتورة مشتريات وقطع غيار'
                      : 'Smart Invoice & Parts Scanner'}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-amber-400/20 text-amber-300 border border-amber-300/30 shrink-0">
                    <Sparkles className="w-3 h-3" />
                    {lang === 'ar' ? 'قراءة وتنسيق ذكي' : 'Smart AI OCR'}
                  </span>
                </div>
                <p className="text-xs text-sky-100/90 font-medium leading-relaxed">
                  {lang === 'ar'
                    ? 'التقط صورة الفاتورة أو ارفعها لتفريغ القطع وتنسيق صياغة الأسماء والأسعار بشكل مرتب وواضح'
                    : 'Snap or upload an invoice to extract and neatly format items, costs & supplier details'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-800 text-xs sm:text-sm flex-1">
          {/* Top Camera / File Capture Bar */}
          <div className="p-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-[#0B3B68]/10 text-[#0B3B68] flex items-center justify-center shrink-0">
                <Camera className="w-6 h-6" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <h4 className="font-extrabold text-slate-900 text-sm leading-snug">
                  {imagePreview
                    ? lang === 'ar'
                      ? 'تم إرفاق صورة الفاتورة وتفريغ النصوص'
                      : 'Invoice image attached & processed'
                    : lang === 'ar'
                    ? 'تصوير الفاتورة بالكاميرا أو رفع صورتها'
                    : 'Snap or upload invoice image'}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {lang === 'ar'
                    ? 'يقوم النظام بفصل الكلمات العربية والإنجليزية والأرقام تلقائياً لمنع تداخل الكلام'
                    : 'Automatically separates Arabic, English & numbers for clean readability'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
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

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isScanning}
                className="flex-1 sm:flex-none min-h-[42px] px-4 py-2 rounded-xl bg-[#0B3B68] text-white font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-[#082a4d] transition-colors cursor-pointer shadow-xs disabled:opacity-60"
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span>{lang === 'ar' ? 'تصوير بالكاميرا' : 'Camera'}</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="flex-1 sm:flex-none min-h-[42px] px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors cursor-pointer shadow-xs disabled:opacity-60"
              >
                <Upload className="w-4 h-4 text-slate-500 shrink-0" />
                <span>{lang === 'ar' ? 'رفع صورة من الجهاز' : 'Upload Image'}</span>
              </button>
            </div>
          </div>

          {/* Alerts / Notifications */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 text-xs font-bold leading-relaxed animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {formatSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2.5 text-xs font-extrabold leading-relaxed animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{formatSuccessMsg}</span>
            </div>
          )}

          {/* Image Preview & Scanning Indicator */}
          {imagePreview && (
            <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={imagePreview}
                  alt="Invoice Preview"
                  className="w-16 h-16 object-cover rounded-xl border border-slate-300 shadow-2xs shrink-0"
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                      {lang === 'ar' ? 'صورة الفاتورة المرفقة' : 'Attached Invoice'}
                    </span>
                    {isScanning && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-sky-100 text-sky-900 border border-sky-200 animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        {lang === 'ar'
                          ? 'جاري قراءة وتنسيق الكلام بالذكاء الاصطناعي...'
                          : 'AI scanning & formatting text...'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {lang === 'ar'
                      ? 'يمكنك تكبير الصورة للمقارنة أو إعادة المسح أو تحسين صياغة النصوص بضغطة زر'
                      : 'View full image, re-scan, or auto-format extracted text'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFullImage(!showFullImage)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {showFullImage
                      ? lang === 'ar'
                        ? 'إخفاء الصورة'
                        : 'Hide'
                      : lang === 'ar'
                      ? 'معاينة مكبرة'
                      : 'Preview'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    triggerScan(ocrHighResImage || imagePreview, imageMime)
                  }
                  disabled={isScanning}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-800 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`}
                  />
                  <span>{lang === 'ar' ? 'إعادة قراءة الفاتورة' : 'Re-scan'}</span>
                </button>
              </div>
            </div>
          )}

          {showFullImage && imagePreview && (
            <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex justify-center animate-in fade-in">
              <img
                src={ocrHighResImage || imagePreview}
                alt="Full Invoice"
                className="max-h-80 object-contain rounded-xl"
              />
            </div>
          )}

          {/* Invoice Metadata (Supplier, Number, Date, Payment Method, Notes) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0B3B68]" />
                <span>
                  {lang === 'ar'
                    ? 'بيانات الفاتورة الأساسية والمورد'
                    : 'Invoice & Supplier Details'}
                </span>
              </h4>

              <button
                type="button"
                onClick={handleBeautifyAllText}
                className="min-h-[34px] px-3 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                title={
                  lang === 'ar'
                    ? 'إصلاح تداخل الحروف وترتيب الكلمات العربية والإنجليزية'
                    : 'Clean and format all text fields'
                }
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {lang === 'ar'
                    ? 'تحسين وتنسيق طريقة كتابة الكلام'
                    : 'Format & Clean Text'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  {lang === 'ar' ? 'اسم المورد / الشركة:' : 'Supplier Name:'}
                </label>
                <input
                  type="text"
                  list="scanner-suppliers-datalist"
                  dir="auto"
                  placeholder={
                    lang === 'ar' ? 'مثال: شركة النخبة للكمبيوتر' : 'Supplier name'
                  }
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  onBlur={() => setSupplierName((v) => cleanSupplierName(v))}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-bold text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
                <datalist id="scanner-suppliers-datalist">
                  {existingSuppliers.map((supp) => (
                    <option key={supp} value={supp} />
                  ))}
                </datalist>
                {existingSuppliers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    {existingSuppliers.slice(0, 6).map((supp) => (
                      <button
                        key={supp}
                        type="button"
                        onClick={() => setSupplierName(supp)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border transition-colors cursor-pointer ${
                          supplierName.trim() === supp
                            ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                            : 'bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-[#0B3B68] border-slate-200'
                        }`}
                      >
                        <bdi>{supp}</bdi>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  {lang === 'ar' ? 'رقم الفاتورة / السند:' : 'Invoice #:'}
                </label>
                <input
                  type="text"
                  dir="auto"
                  placeholder={lang === 'ar' ? 'مثال: INV-9042' : 'Invoice number'}
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  onBlur={() => setInvoiceNumber((v) => cleanInvoiceNumber(v))}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  {lang === 'ar' ? 'تاريخ الفاتورة:' : 'Invoice Date:'}
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  {lang === 'ar' ? 'طريقة الدفع:' : 'Payment Method:'}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`min-h-[44px] px-2 py-1.5 rounded-xl text-xs font-black border flex items-center justify-center cursor-pointer transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {lang === 'ar' ? 'كاش' : 'Cash'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cliq')}
                    className={`min-h-[44px] px-2 py-1.5 rounded-xl text-xs font-black border flex items-center justify-center cursor-pointer transition-all ${
                      paymentMethod === 'cliq'
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {lang === 'ar' ? 'كلك' : 'CliQ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('credit')}
                    className={`min-h-[44px] px-2 py-1.5 rounded-xl text-xs font-black border flex items-center justify-center cursor-pointer transition-all ${
                      paymentMethod === 'credit'
                        ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {lang === 'ar' ? 'ذمم' : 'Credit'}
                  </button>
                </div>
              </div>
            </div>

            {/* Invoice Notes Field */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {lang === 'ar'
                    ? 'ملاحظات الفاتورة / شروط الكفالة (اختياري):'
                    : 'Invoice Notes / Warranty:'}
                </span>
              </label>
              <input
                type="text"
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
                placeholder={
                  lang === 'ar'
                    ? 'مثال: كفالة سنة كاملة على القطع من تاريخ الفاتورة...'
                    : 'Warranty or invoice notes...'
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => setNotes((v) => cleanAndFormatText(v))}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50/60 focus:bg-white text-xs sm:text-sm font-medium text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              />
            </div>
          </div>

          {/* Extracted Items Section */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">
                    {lang === 'ar'
                      ? `القطع والمواد في الفاتورة (${items.length})`
                      : `Invoice Items (${items.length})`}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {lang === 'ar'
                      ? 'كل قطعة مفصولة في بطاقة واضحة لتسهيل قراءة وتعديل الاسم والسعر بدون تداخل'
                      : 'Each item is clearly separated for easy editing'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-extrabold text-slate-700">
                <span>
                  {lang === 'ar' ? 'إجمالي الفاتورة:' : 'Invoice Total:'}
                </span>
                <bdi className="text-sm sm:text-base font-black text-emerald-800 font-mono">
                  {formatJod(grandTotalCost, lang)}
                </bdi>
              </div>
            </div>

            {/* Items List */}
            {items.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
                <Receipt className="w-8 h-8 mx-auto text-slate-400" />
                <div className="space-y-1">
                  <p className="font-extrabold text-xs sm:text-sm text-slate-700">
                    {lang === 'ar'
                      ? 'لا توجد قطع مضافة في اللائحة حالياً'
                      : 'No items in the list yet'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {lang === 'ar'
                      ? 'التقط صورة الفاتورة بالأعلى لتفريغها تلقائياً، أو أضف القطع من النموذج أدناه'
                      : 'Snap an invoice photo above or add items manually below'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200 hover:border-slate-300 transition-all space-y-3.5 shadow-2xs"
                  >
                    {/* Item Card Header */}
                    <div className="flex flex-wrap items-center justify-between pb-2.5 border-b border-slate-200 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#0B3B68] text-white text-xs font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs sm:text-sm font-black text-slate-900">
                          {lang === 'ar'
                            ? `بيانات القطعة / المادة #${idx + 1}`
                            : `Part #${idx + 1} Details`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateItemField(
                              idx,
                              'partName',
                              cleanAndFormatText(item.partName)
                            )
                          }
                          className="px-2.5 py-1 rounded-xl bg-white hover:bg-amber-50 text-slate-700 border border-slate-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title={
                            lang === 'ar'
                              ? 'ترتيب وتنسيق كتابة الاسم'
                              : 'Format name'
                          }
                        >
                          <Wand2 className="w-3 h-3 text-amber-600" />
                          <span>{lang === 'ar' ? 'تنسيق الاسم' : 'Format'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="px-2.5 py-1 rounded-xl text-rose-600 hover:bg-rose-50 bg-white border border-rose-200 text-xs font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'حذف' : 'Remove'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Part Name Input: Spacious, clear direction, high contrast */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-slate-700 block">
                        {lang === 'ar'
                          ? 'اسم القطعة أو المادة (مكتوب بوضوح بدون تداخل):'
                          : 'Part / Item Name:'}
                      </label>
                      <input
                        type="text"
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        value={item.partName}
                        onChange={(e) =>
                          handleUpdateItemField(idx, 'partName', e.target.value)
                        }
                        onBlur={(e) =>
                          handleUpdateItemField(
                            idx,
                            'partName',
                            cleanAndFormatText(e.target.value)
                          )
                        }
                        placeholder={
                          lang === 'ar'
                            ? 'مثال: قرص تخزين صلب Kingston SSD 240GB'
                            : 'e.g., Kingston SSD 240GB'
                        }
                        className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm sm:text-base font-extrabold text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                      />
                    </div>

                    {/* Item Specs Grid: Clean 2-col on mobile, 3-col on tablet, 6-col on desktop so labels never overlap */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
                      {/* Category */}
                      <div className="col-span-2 sm:col-span-1 lg:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-600 block">
                          {lang === 'ar' ? 'التصنيف:' : 'Category:'}
                        </label>
                        <select
                          value={item.category}
                          onChange={(e) =>
                            handleUpdateItemField(idx, 'category', e.target.value)
                          }
                          className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                        >
                          {COMMON_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 block">
                          {lang === 'ar' ? 'الكمية:' : 'Quantity:'}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          dir="ltr"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItemField(
                              idx,
                              'quantity',
                              parseFloat(e.target.value) || 1
                            )
                          }
                          className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-mono font-black text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                        />
                      </div>

                      {/* Unit */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 block">
                          {lang === 'ar' ? 'الوحدة:' : 'Unit:'}
                        </label>
                        <input
                          type="text"
                          dir="auto"
                          value={item.unit}
                          onChange={(e) =>
                            handleUpdateItemField(idx, 'unit', e.target.value)
                          }
                          placeholder={lang === 'ar' ? 'قطعة' : 'Unit'}
                          className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                        />
                      </div>

                      {/* Unit Cost JOD */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-600 block">
                          {lang === 'ar' ? 'سعر الحبة (د.أ):' : 'Unit Cost:'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          dir="ltr"
                          value={item.unitCostJod || ''}
                          onChange={(e) =>
                            handleUpdateItemField(
                              idx,
                              'unitCostJod',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0.00"
                          className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-mono font-black text-center text-emerald-800 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                        />
                      </div>

                      {/* Total Cost JOD (Editable too!) */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-emerald-800 block">
                          {lang === 'ar' ? 'المجموع (د.أ):' : 'Total Cost:'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          dir="ltr"
                          value={item.totalCostJod || ''}
                          onChange={(e) =>
                            handleUpdateItemField(
                              idx,
                              'totalCostJod',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0.00"
                          className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-emerald-400 bg-emerald-50/80 text-xs sm:text-sm font-mono font-black text-center text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Manual Quick Add Row */}
            <div className="p-4 sm:p-5 rounded-2xl bg-sky-50/70 border border-sky-200/90 space-y-3.5">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#0B3B68]" />
                <span className="text-xs sm:text-sm font-black text-sky-950">
                  {lang === 'ar'
                    ? 'إضافة قطعة أو مادة جديدة إلى هذه الفاتورة:'
                    : 'Add item to this invoice:'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-slate-700 block">
                    {lang === 'ar' ? 'اسم القطعة والمواصفات:' : 'Part Name & Specs:'}
                  </label>
                  <input
                    type="text"
                    dir={lang === 'ar' ? 'rtl' : 'ltr'}
                    placeholder={
                      lang === 'ar'
                        ? 'اكتب اسم القطعة بوضوح... (مثال: رام لابتوب DDR4 8GB Kingston)'
                        : 'Type part name clearly...'
                    }
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onBlur={() => setNewItemName((v) => cleanAndFormatText(v))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddItem();
                      }
                    }}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-sky-300 bg-white text-xs sm:text-sm font-bold text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                  />

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-2xs font-bold text-slate-500 me-1">
                      {lang === 'ar' ? 'إدراج سريع منسق:' : 'Quick insert:'}
                    </span>
                    {[
                      'قرص صلب SSD 240GB',
                      'قرص صلب SSD 480GB',
                      'رام DDR4 8GB',
                      'رام DDR4 16GB',
                      'كيبل شبكة Cat6',
                      'سويتش شبكة 8 بورت',
                      'باور سبلاي 500W',
                      'شاحن لابتوب أصلي',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          setNewItemName((prev) =>
                            prev.trim()
                              ? cleanAndFormatText(`${prev} ${preset}`)
                              : preset
                          )
                        }
                        className="px-2 py-0.5 rounded-lg bg-white hover:bg-sky-100 text-slate-700 hover:text-[#0B3B68] border border-sky-200 text-2xs font-bold transition-colors cursor-pointer"
                      >
                        <bdi>+ {preset}</bdi>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">
                      {lang === 'ar' ? 'التصنيف:' : 'Category:'}
                    </label>
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-sky-300 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                    >
                      {COMMON_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">
                      {lang === 'ar' ? 'الكمية:' : 'Qty:'}
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      dir="ltr"
                      placeholder="1"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(e.target.value)}
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-sky-300 bg-white text-xs sm:text-sm font-mono font-bold text-center"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 block">
                      {lang === 'ar' ? 'سعر الحبة (د.أ):' : 'Unit Cost:'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      dir="ltr"
                      placeholder="0.00"
                      value={newItemCost}
                      onChange={(e) => setNewItemCost(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddItem();
                        }
                      }}
                      className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-sky-300 bg-white text-xs sm:text-sm font-mono font-black text-center text-emerald-800"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      <span>
                        {lang === 'ar' ? 'إضافة إلى الفاتورة' : 'Add to Invoice'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs font-bold text-slate-600 leading-relaxed">
            {lang === 'ar' ? (
              <span>
                سيتم حفظ وإدراج{' '}
                <strong className="text-slate-900">
                  {items.length + (newItemName.trim() ? 1 : 0)}
                </strong>{' '}
                قطعة في سجل الفواتير والمخزن وربطها بالمالية تلقائياً.
              </span>
            ) : (
              <span>
                Will insert{' '}
                <strong>{items.length + (newItemName.trim() ? 1 : 0)}</strong>{' '}
                parts into purchases, inventory & finance.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleConfirmAndInsert}
              disabled={items.length === 0 && !newItemName.trim()}
              className="flex-1 sm:flex-none min-h-[44px] px-6 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs sm:text-sm hover:bg-emerald-700 transition-colors cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'اعتماد وحفظ الفاتورة والقطع'
                  : 'Save & Confirm Invoice'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
