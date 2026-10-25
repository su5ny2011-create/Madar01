import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Camera,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Package,
  Receipt,
  Sparkles,
  Upload,
  Wallet,
  X,
  Eye,
  Wand2,
  RefreshCw,
} from 'lucide-react';
import type { Language, PartItem, PurchasePaymentMethod, PurchaseRecord } from '../types';
import { getTodayStr } from '../utils/logic';
import { compressImage } from '../utils/imageCompressor';
import {
  cleanAndFormatText,
  cleanSupplierName,
  cleanInvoiceNumber,
} from '../utils/textFormatter';

interface EditPurchaseModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  purchaseToEdit?: PurchaseRecord | null;
  parts?: PartItem[];
  existingSuppliers?: string[];
  defaultSupplierName?: string;
  defaultInvoiceDate?: string;
  onSavePurchase: (record: PurchaseRecord) => void;
  defaultPurchasedBy?: string;
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

export const EditPurchaseModal: React.FC<EditPurchaseModalProps> = ({
  lang,
  isOpen,
  onClose,
  purchaseToEdit,
  parts = [],
  existingSuppliers = [],
  defaultSupplierName = '',
  defaultInvoiceDate,
  onSavePurchase,
  defaultPurchasedBy,
}) => {
  const isAddMode = !purchaseToEdit;

  const [partName, setPartName] = useState(purchaseToEdit?.partName || '');
  const [category, setCategory] = useState(
    purchaseToEdit?.category || 'تخزين وهاردوير'
  );
  const [quantity, setQuantity] = useState(
    purchaseToEdit?.quantity !== undefined ? String(purchaseToEdit.quantity) : '1'
  );
  const [unit, setUnit] = useState(purchaseToEdit?.unit || 'قطعة');
  const [unitCostJod, setUnitCostJod] = useState(
    purchaseToEdit?.unitCostJod !== undefined ? String(purchaseToEdit.unitCostJod) : ''
  );
  const [totalCostJod, setTotalCostJod] = useState(
    purchaseToEdit?.totalCostJod !== undefined ? String(purchaseToEdit.totalCostJod) : ''
  );
  const [sellingPriceJod, setSellingPriceJod] = useState(
    purchaseToEdit?.sellingPriceJod !== undefined ? String(purchaseToEdit.sellingPriceJod) : ''
  );
  const [supplierName, setSupplierName] = useState(
    purchaseToEdit?.supplierName || defaultSupplierName || ''
  );
  const [invoiceNumber, setInvoiceNumber] = useState(
    purchaseToEdit?.invoiceNumber || ''
  );
  const [invoiceDate, setInvoiceDate] = useState(
    purchaseToEdit?.invoiceDate || defaultInvoiceDate || getTodayStr()
  );
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>(
    purchaseToEdit?.paymentMethod || 'cash'
  );
  const [notes, setNotes] = useState(purchaseToEdit?.notes || '');
  const [invoiceImageUrl, setInvoiceImageUrl] = useState<string | undefined>(
    purchaseToEdit?.invoiceImageUrl
  );
  const [ocrHighResUrl, setOcrHighResUrl] = useState<string | undefined>(undefined);
  const [isScanningImage, setIsScanningImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [showFullImage, setShowFullImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (purchaseToEdit) {
      setPartName(purchaseToEdit.partName);
      setCategory(purchaseToEdit.category || 'تخزين وهاردوير');
      setQuantity(String(purchaseToEdit.quantity || 1));
      setUnit(purchaseToEdit.unit || 'قطعة');
      setUnitCostJod(String(purchaseToEdit.unitCostJod || ''));
      setTotalCostJod(String(purchaseToEdit.totalCostJod || ''));
      setSellingPriceJod(
        purchaseToEdit.sellingPriceJod !== undefined
          ? String(purchaseToEdit.sellingPriceJod)
          : ''
      );
      setSupplierName(purchaseToEdit.supplierName || '');
      setInvoiceNumber(purchaseToEdit.invoiceNumber || '');
      setInvoiceDate(purchaseToEdit.invoiceDate || defaultInvoiceDate || getTodayStr());
      setPaymentMethod(purchaseToEdit.paymentMethod || 'cash');
      setNotes(purchaseToEdit.notes || '');
      setInvoiceImageUrl(purchaseToEdit.invoiceImageUrl);
      setOcrHighResUrl(undefined);
      setErrorMsg('');
      setInfoMsg('');
      setShowFullImage(false);
    } else {
      setPartName('');
      setCategory('تخزين وهاردوير');
      setQuantity('1');
      setUnit('قطعة');
      setUnitCostJod('');
      setTotalCostJod('');
      setSellingPriceJod('');
      setSupplierName(defaultSupplierName || '');
      setInvoiceNumber('');
      setInvoiceDate(defaultInvoiceDate || getTodayStr());
      setPaymentMethod('cash');
      setNotes('');
      setInvoiceImageUrl(undefined);
      setOcrHighResUrl(undefined);
      setErrorMsg('');
      setInfoMsg('');
      setShowFullImage(false);
    }
  }, [purchaseToEdit, isOpen, defaultSupplierName, defaultInvoiceDate]);

  // Recalculate total cost when quantity or unit cost changes
  const handleUnitCostChange = (val: string) => {
    setUnitCostJod(val);
    const q = parseFloat(quantity) || 1;
    const c = parseFloat(val) || 0;
    if (val !== '') {
      setTotalCostJod(String(Math.round(q * c * 100) / 100));
      if (!sellingPriceJod && c > 0) {
        setSellingPriceJod(String(Math.round(c * 1.35 * 100) / 100));
      }
    }
  };

  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    const q = parseFloat(val) || 0;
    const c = parseFloat(unitCostJod) || 0;
    if (c > 0 && q > 0) {
      setTotalCostJod(String(Math.round(q * c * 100) / 100));
    }
  };

  const handleTotalCostChange = (val: string) => {
    setTotalCostJod(val);
    const tot = parseFloat(val) || 0;
    const q = Math.max(0.1, parseFloat(quantity) || 1);
    if (val !== '' && tot >= 0) {
      const calculatedUnit = Math.round((tot / q) * 100) / 100;
      setUnitCostJod(String(calculatedUnit));
      if (!sellingPriceJod && calculatedUnit > 0) {
        setSellingPriceJod(String(Math.round(calculatedUnit * 1.35 * 100) / 100));
      }
    }
  };

  const handleExtractFromAttachedImage = async (imgDataUrl: string) => {
    setIsScanningImage(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      const res = await fetch('/api/scan-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imgDataUrl,
          mimeType: 'image/jpeg',
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'تعذر قراءة الصورة');
      }
      const data = json.data;
      if (data) {
        if (data.supplierName) setSupplierName(cleanSupplierName(data.supplierName));
        if (data.invoiceNumber) setInvoiceNumber(cleanInvoiceNumber(data.invoiceNumber));
        // Keep the active entry date (defaultInvoiceDate or today) so the invoice appears on the day it was entered
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
          const first = data.items[0];
          const combinedNames =
            data.items.length === 1
              ? cleanAndFormatText(first.partName)
              : data.items
                  .map((it: any) => cleanAndFormatText(it.partName))
                  .filter(Boolean)
                  .join(' + ');
          if (combinedNames) setPartName(combinedNames);
          if (first.category && COMMON_CATEGORIES.includes(first.category)) {
            setCategory(first.category);
          }
          if (data.items.length === 1) {
            const q = Math.max(0.1, Number(first.quantity) || 1);
            const c = Math.max(0, Number(first.unitCostJod) || 0);
            const tot = Math.max(0, Number(first.totalCostJod) || Math.round(q * c * 100) / 100);
            setQuantity(String(q));
            setUnit(cleanAndFormatText(first.unit) || 'قطعة');
            if (c > 0) setUnitCostJod(String(c));
            if (tot > 0) setTotalCostJod(String(tot));
            if (first.suggestedSellingPriceJod > 0) {
              setSellingPriceJod(String(first.suggestedSellingPriceJod));
            }
          } else {
            const sumTotal = data.items.reduce(
              (acc: number, it: any) => acc + (Number(it.totalCostJod) || 0),
              0
            );
            setQuantity('1');
            setUnit('فاتورة');
            setUnitCostJod(String(sumTotal));
            setTotalCostJod(String(sumTotal));
          }
        }
        setInfoMsg(
          lang === 'ar'
            ? 'تم تفريغ وتنسيق بيانات الفاتورة من الصورة بنجاح!'
            : 'Invoice details extracted and formatted!'
        );
        setTimeout(() => setInfoMsg(''), 3500);
      }
    } catch {
      setInfoMsg(
        lang === 'ar'
          ? 'تم إرفاق صورة الفاتورة. يمكنك مراجعة أو كتابة البيانات بالأسفل.'
          : 'Image attached. You can fill in the details below.'
      );
    } finally {
      setIsScanningImage(false);
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)'
          : 'Please select a valid image file'
      );
      return;
    }
    try {
      const highRes = await compressImage(file, 1300, 1300, 0.84);
      const compressed = await compressImage(file, 700, 700, 0.58);
      setInvoiceImageUrl(compressed);
      setOcrHighResUrl(highRes);
      if (isAddMode && !partName.trim()) {
        handleExtractFromAttachedImage(highRes);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        const resUrl = event.target?.result as string;
        setInvoiceImageUrl(resUrl);
        setOcrHighResUrl(resUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBeautifyFields = () => {
    setPartName((v) => cleanAndFormatText(v));
    setSupplierName((v) => cleanSupplierName(v));
    setInvoiceNumber((v) => cleanInvoiceNumber(v));
    setUnit((v) => cleanAndFormatText(v) || 'قطعة');
    setNotes((v) => cleanAndFormatText(v));
    setInfoMsg(
      lang === 'ar'
        ? 'تم تحسين صياغة الكلمات وفصل النصوص المتداخلة بنجاح!'
        : 'Text formatted and cleaned!'
    );
    setTimeout(() => setInfoMsg(''), 3000);
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanedPartName = cleanAndFormatText(partName);
    if (!cleanedPartName) {
      setErrorMsg(
        lang === 'ar' ? 'يرجى إدخال اسم القطعة أو المادة' : 'Please enter part name'
      );
      return;
    }

    const q = Math.max(0.1, parseFloat(quantity) || 1);
    const rawTotal = Math.max(0, parseFloat(totalCostJod) || 0);
    const rawUnit = Math.max(0, parseFloat(unitCostJod) || 0);
    const cost =
      rawUnit > 0
        ? rawUnit
        : rawTotal > 0
        ? Math.round((rawTotal / q) * 100) / 100
        : 0;
    const total =
      rawTotal > 0 ? rawTotal : Math.round(q * cost * 100) / 100;
    const sell = parseFloat(sellingPriceJod) || undefined;

    // Preserve settlement status if editing an already-paid credit invoice
    const isPaidStatus =
      paymentMethod !== 'credit'
        ? true
        : purchaseToEdit?.paymentMethod === 'credit'
        ? Boolean(purchaseToEdit.isPaid)
        : false;

    const record: PurchaseRecord = {
      id:
        purchaseToEdit?.id ||
        `purch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      partName: cleanedPartName,
      category: category.trim() || 'تخزين وهاردوير',
      quantity: q,
      unit: cleanAndFormatText(unit) || 'قطعة',
      unitCostJod: cost,
      totalCostJod: total,
      sellingPriceJod: sell,
      supplierName: cleanSupplierName(supplierName) || undefined,
      invoiceNumber: cleanInvoiceNumber(invoiceNumber) || undefined,
      invoiceDate: invoiceDate || getTodayStr(),
      paymentMethod,
      isPaid: isPaidStatus,
      paidAt: isPaidStatus
        ? purchaseToEdit?.paidAt || invoiceDate
        : undefined,
      notes: cleanAndFormatText(notes) || undefined,
      purchasedBy:
        purchaseToEdit?.purchasedBy || defaultPurchasedBy || 'مدير النظام',
      invoiceImageUrl,
      linkedExpenseId: purchaseToEdit?.linkedExpenseId,
      linkedPartId: purchaseToEdit?.linkedPartId,
      createdAt: purchaseToEdit?.createdAt || new Date().toISOString(),
    };

    onSavePurchase(record);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] my-2 sm:my-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-[#0B3B68] via-indigo-900 to-[#0B3B68] p-4 sm:p-5 text-white shrink-0">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-amber-300 shrink-0">
                <Package className="w-6 h-6" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <h3 className="text-base sm:text-lg font-black tracking-tight leading-snug">
                  {isAddMode
                    ? lang === 'ar'
                      ? 'إضافة فاتورة / شراء قطعة جديدة'
                      : 'Add New Purchase / Invoice'
                    : lang === 'ar'
                    ? 'تعديل بيانات الفاتورة والقطعة'
                    : 'Edit Purchase / Invoice'}
                </h3>
                <p className="text-xs text-sky-100/90 font-medium leading-relaxed">
                  {lang === 'ar'
                    ? 'كتابة واضحة ومنسقة للقطع والأسعار مع ربط تلقائي بالمخزون والمالية'
                    : 'Cleanly formatted part & invoice entry synced with inventory & finance'}
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

        {/* Modal Form */}
        <form
          onSubmit={handleSubmit}
          className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm flex-1"
        >
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold leading-relaxed animate-in fade-in">
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-extrabold flex items-center gap-2 leading-relaxed animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* Invoice Image Attachment & Smart Scan Bar at Top for Fast Entry */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#0B3B68]" />
                <span>
                  {lang === 'ar'
                    ? 'صورة الفاتورة المرفقة (مع قراءة ذكية تلقائية)'
                    : 'Attached Invoice Photo (with AI Auto-Fill)'}
                </span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isScanningImage}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#0B3B68] text-white text-xs font-extrabold flex items-center gap-1.5 hover:bg-[#082a4d] cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'تصوير الفاتورة' : 'Snap Photo'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScanningImage}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-extrabold flex items-center gap-1.5 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>{lang === 'ar' ? 'رفع صورة' : 'Upload'}</span>
                </button>
              </div>
            </div>

            {invoiceImageUrl && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl bg-white border border-slate-200">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={invoiceImageUrl}
                    alt="Invoice"
                    className="w-14 h-14 object-cover rounded-xl border border-slate-300 shrink-0"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-800">
                        {lang === 'ar'
                          ? 'تم إرفاق صورة الفاتورة'
                          : 'Invoice image attached'}
                      </span>
                      {isScanningImage && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-extrabold bg-sky-100 text-sky-900 animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          {lang === 'ar' ? 'جاري قراءة وتنسيق النص...' : 'Scanning...'}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowFullImage(!showFullImage)}
                        className="text-xs text-sky-700 hover:underline font-extrabold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>
                          {showFullImage
                            ? lang === 'ar'
                              ? 'إخفاء المعاينة'
                              : 'Hide'
                            : lang === 'ar'
                            ? 'معاينة مكبرة'
                            : 'Preview'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleExtractFromAttachedImage(
                            ocrHighResUrl || invoiceImageUrl
                          )
                        }
                        disabled={isScanningImage}
                        className="text-xs text-indigo-700 hover:underline font-extrabold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>
                          {lang === 'ar'
                            ? 'تفريغ النص من الصورة بالذكاء الاصطناعي'
                            : 'AI Extract Text'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInvoiceImageUrl(undefined);
                    setOcrHighResUrl(undefined);
                  }}
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 cursor-pointer"
                  title={lang === 'ar' ? 'حذف الصورة' : 'Remove image'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {showFullImage && invoiceImageUrl && (
              <div className="p-2.5 rounded-xl bg-slate-900 flex justify-center animate-in fade-in">
                <img
                  src={ocrHighResUrl || invoiceImageUrl}
                  alt="Invoice Full"
                  className="max-h-64 object-contain rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Quick Part Selector from Catalog */}
          {parts.length > 0 && isAddMode && (
            <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 space-y-2">
              <span className="text-xs font-extrabold text-[#0B3B68] block">
                {lang === 'ar'
                  ? 'اختيار سريع لقطعة مسجلة في الدليل (تعبئة تلقائية):'
                  : 'Quick select from saved parts catalog:'}
              </span>
              <div className="flex flex-wrap items-center gap-2 max-h-28 overflow-y-auto py-0.5">
                {parts.slice(0, 12).map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => {
                      setPartName(cleanAndFormatText(pt.name));
                      if (pt.category) setCategory(pt.category);
                      if (pt.defaultCostJod > 0) {
                        handleUnitCostChange(String(pt.defaultCostJod));
                      }
                      if (pt.defaultPriceJod > 0) {
                        setSellingPriceJod(String(pt.defaultPriceJod));
                      }
                      if (pt.supplierName && !supplierName) {
                        setSupplierName(cleanSupplierName(pt.supplierName));
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#0B3B68] hover:text-white border border-sky-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                  >
                    <bdi>{pt.name}</bdi>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Part Name & Category */}
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs sm:text-sm font-extrabold text-slate-800 block">
                  {lang === 'ar'
                    ? 'اسم القطعة / المادة المشتراة (مكتوب بوضوح):'
                    : 'Part / Item Name:'}{' '}
                  *
                </label>
                <button
                  type="button"
                  onClick={handleBeautifyFields}
                  className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    {lang === 'ar'
                      ? 'تحسين وتنسيق كتابة النص'
                      : 'Format Text'}
                  </span>
                </button>
              </div>

              <input
                type="text"
                required
                dir={lang === 'ar' ? 'rtl' : 'ltr'}
                list="purchase-parts-datalist"
                placeholder={
                  lang === 'ar'
                    ? 'مثال: قرص تخزين صلب Kingston SSD 480GB'
                    : 'e.g., Kingston SSD 480GB'
                }
                value={partName}
                onChange={(e) => {
                  const val = e.target.value;
                  setPartName(val);
                  const matched = parts.find(
                    (pt) => pt.name.trim().toLowerCase() === val.trim().toLowerCase()
                  );
                  if (matched && isAddMode) {
                    if (matched.category) setCategory(matched.category);
                    if (matched.defaultCostJod > 0 && !unitCostJod) {
                      handleUnitCostChange(String(matched.defaultCostJod));
                    }
                    if (matched.defaultPriceJod > 0 && !sellingPriceJod) {
                      setSellingPriceJod(String(matched.defaultPriceJod));
                    }
                  }
                }}
                onBlur={() => setPartName((v) => cleanAndFormatText(v))}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm sm:text-base font-extrabold text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              />
              <datalist id="purchase-parts-datalist">
                {parts.map((pt) => (
                  <option key={pt.id} value={pt.name} />
                ))}
              </datalist>

              {/* Quick Formatted Spec Chips to avoid Arabic/English keyboard switching overlap */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-2xs font-bold text-slate-500 me-1">
                  {lang === 'ar' ? 'كتابة سريعة منسقة:' : 'Quick insert:'}
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
                  'حبر طابعة ليزر',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setPartName((prev) =>
                        prev.trim()
                          ? cleanAndFormatText(`${prev} ${preset}`)
                          : preset
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-[#0B3B68] border border-slate-200 text-2xs font-bold transition-colors cursor-pointer"
                  >
                    <bdi>+ {preset}</bdi>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  {lang === 'ar' ? 'التصنيف:' : 'Category:'}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                >
                  {COMMON_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 block">
                  {lang === 'ar' ? 'اسم المورد أو الشركة:' : 'Supplier Name:'}
                </label>
                <input
                  type="text"
                  list="purchase-suppliers-datalist"
                  dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  placeholder={
                    lang === 'ar'
                      ? 'مثال: شركة النخبة للكمبيوتر'
                      : 'Supplier name'
                  }
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  onBlur={() => setSupplierName((v) => cleanSupplierName(v))}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
                <datalist id="purchase-suppliers-datalist">
                  {existingSuppliers.map((supp) => (
                    <option key={supp} value={supp} />
                  ))}
                </datalist>
                {existingSuppliers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <span className="text-[10px] font-bold text-slate-500 me-0.5">
                      {lang === 'ar' ? 'الموردون:' : 'Suppliers:'}
                    </span>
                    {existingSuppliers.slice(0, 8).map((supp) => (
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
            </div>
          </div>

          {/* Quantity, Unit, Unit Cost, Total Cost */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                {lang === 'ar' ? 'الكمية:' : 'Quantity:'}
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                required
                dir="ltr"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-mono font-bold text-center text-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                {lang === 'ar' ? 'الوحدة:' : 'Unit:'}
              </label>
              <input
                type="text"
                dir="auto"
                placeholder="قطعة / متر"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-bold text-center text-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                {lang === 'ar' ? 'سعر الحبة (د.أ):' : 'Unit Cost:'} *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required={!totalCostJod}
                dir="ltr"
                placeholder="0.00"
                value={unitCostJod}
                onChange={(e) => handleUnitCostChange(e.target.value)}
                className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-mono font-extrabold text-center text-emerald-800"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-emerald-800 block">
                {lang === 'ar' ? 'إجمالي التكلفة:' : 'Total Cost:'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                placeholder="0.00"
                value={totalCostJod}
                onChange={(e) => handleTotalCostChange(e.target.value)}
                className="w-full min-h-[42px] px-3 py-1.5 rounded-xl border border-emerald-400 bg-emerald-50/70 text-xs sm:text-sm font-mono font-black text-center text-emerald-950"
              />
            </div>
          </div>

          {/* Selling Price, Invoice Number, Invoice Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                {lang === 'ar'
                  ? 'سعر البيع للزبون (اختياري):'
                  : 'Selling Price (Optional):'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                placeholder="0.00"
                value={sellingPriceJod}
                onChange={(e) => setSellingPriceJod(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                {lang === 'ar' ? 'رقم الفاتورة / السند:' : 'Invoice Number:'}
              </label>
              <input
                type="text"
                dir="auto"
                placeholder={lang === 'ar' ? 'مثال: INV-108' : 'Invoice #'}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                onBlur={() => setInvoiceNumber((v) => cleanInvoiceNumber(v))}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-700 block">
                {lang === 'ar' ? 'تاريخ الشراء / الفاتورة:' : 'Invoice Date:'}
              </label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              />
            </div>
          </div>

          {/* Payment Method (كاش / كلك / ذمم) */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/90 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#0B3B68]" />
                <span>{lang === 'ar' ? 'طريقة الدفع:' : 'Payment Method:'}</span>
              </label>
              <span className="text-2xs font-extrabold text-amber-900 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300">
                {paymentMethod === 'credit'
                  ? lang === 'ar'
                    ? 'ذمم موردين (آجل)'
                    : 'Credit (Payables)'
                  : paymentMethod === 'cliq'
                  ? lang === 'ar'
                    ? 'دفع فوري عبر كلك'
                    : 'CliQ'
                  : lang === 'ar'
                  ? 'دفع نقدي من الصندوق'
                  : 'Cash Drawer'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`min-h-[46px] px-2.5 py-2 rounded-xl text-xs sm:text-sm font-black border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-300'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50/60'
                }`}
              >
                <DollarSign className="w-4 h-4 shrink-0" />
                <span>{lang === 'ar' ? 'كاش' : 'Cash'}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('cliq')}
                className={`min-h-[46px] px-2.5 py-2 rounded-xl text-xs sm:text-sm font-black border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'cliq'
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm ring-2 ring-indigo-300'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-indigo-50/60'
                }`}
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>{lang === 'ar' ? 'كلك (CliQ)' : 'CliQ'}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('credit')}
                className={`min-h-[46px] px-2.5 py-2 rounded-xl text-xs sm:text-sm font-black border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  paymentMethod === 'credit'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-300'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50/60'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span>{lang === 'ar' ? 'ذمم (آجل)' : 'Credit'}</span>
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 block">
              {lang === 'ar' ? 'ملاحظات إضافية / تفاصيل الكفالة:' : 'Notes / Warranty:'}
            </label>
            <textarea
              rows={2}
              dir="auto"
              placeholder={
                lang === 'ar'
                  ? 'ملاحظات حول الضمان، كفالة القطعة، شروط المورد...'
                  : 'Warranty, supplier notes...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => setNotes((v) => cleanAndFormatText(v))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          </div>

          {/* Footer Submit Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-extrabold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-6 py-2 rounded-xl bg-[#0B3B68] text-white font-black text-xs sm:text-sm hover:bg-[#082a4d] transition-colors cursor-pointer shadow-md flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {isAddMode
                  ? lang === 'ar'
                    ? 'حفظ وإدراج الفاتورة / القطعة'
                    : 'Save & Insert'
                  : lang === 'ar'
                  ? 'حفظ التعديلات'
                  : 'Save Changes'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
