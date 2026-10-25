import React, { useState, useEffect } from 'react';
import {
  BellRing,
  CheckCircle2,
  Copy,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  X,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import type { Language, MaintenanceVisit } from '../types';
import {
  CLIQ_PAYMENT_INFO,
  formatJod,
  formatWhatsAppUrl,
  generatePaymentReminderMessage,
  type PaymentReminderLanguage,
  type PaymentReminderTemplateType,
} from '../utils/logic';

interface PaymentReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  customerName: string;
  phone?: string;
  unpaidVisits: MaintenanceVisit[];
  onMarkVisitPaid?: (visit: MaintenanceVisit) => void;
  onMarkAllPaid?: (visits: MaintenanceVisit[]) => void;
}

export const PaymentReminderModal: React.FC<PaymentReminderModalProps> = ({
  isOpen,
  onClose,
  lang,
  customerName,
  phone,
  unpaidVisits,
  onMarkVisitPaid,
  onMarkAllPaid,
}) => {
  const [templateType, setTemplateType] = useState<PaymentReminderTemplateType>('polite');
  const [msgLang, setMsgLang] = useState<PaymentReminderLanguage>(
    lang === 'ar' ? 'ar' : 'en'
  );
  const [recipientPhone, setRecipientPhone] = useState<string>(phone || '');
  const [messageText, setMessageText] = useState<string>('');
  const [copiedBanner, setCopiedBanner] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const inferredPhone =
        phone || unpaidVisits.find((v) => v.phone && v.phone.trim())?.phone || '';
      setRecipientPhone(inferredPhone);
      setMsgLang(lang === 'ar' ? 'ar' : 'en');
      setCopiedBanner('');
    }
  }, [isOpen, phone, unpaidVisits, lang]);

  useEffect(() => {
    if (!isOpen) return;
    const generated = generatePaymentReminderMessage({
      customerName,
      phone: recipientPhone,
      unpaidVisits,
      templateType,
      lang: msgLang,
    });
    setMessageText(generated);
  }, [isOpen, customerName, recipientPhone, unpaidVisits, templateType, msgLang]);

  if (!isOpen) return null;

  const totalUnpaidJod = unpaidVisits.reduce(
    (sum, v) => sum + (Number(v.amountJod) || 0),
    0
  );

  const handleCopyMessage = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(messageText);
      }
      setCopiedBanner(
        lang === 'ar'
          ? 'تم نسخ رسالة الدفع بنجاح! يمكنك لصقها وإرسالها للزبون.'
          : 'Payment message copied to clipboard!'
      );
      setTimeout(() => setCopiedBanner(''), 4000);
    } catch {
      setCopiedBanner(
        lang === 'ar'
          ? 'يرجى تحديد النص ونسخه يدوياً.'
          : 'Please select and copy the text manually.'
      );
    }
  };

  const handleCopyCliqInfo = async () => {
    const cliqText =
      lang === 'ar'
        ? `بيانات التحويل عبر كلك (CliQ):\nرقم كلك: ${CLIQ_PAYMENT_INFO.cliqNumber}\nالاسم: ${CLIQ_PAYMENT_INFO.recipientName}\nالبنك: ${CLIQ_PAYMENT_INFO.bankName}`
        : `CliQ Transfer Info:\nCliQ Number: ${CLIQ_PAYMENT_INFO.cliqNumber}\nName: ${CLIQ_PAYMENT_INFO.recipientNameEn}\nBank: ${CLIQ_PAYMENT_INFO.bankNameEn}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(cliqText);
      }
      setCopiedBanner(
        lang === 'ar'
          ? `تم نسخ بيانات كلك (${CLIQ_PAYMENT_INFO.cliqNumber} - ${CLIQ_PAYMENT_INFO.recipientName} - ${CLIQ_PAYMENT_INFO.bankName})`
          : 'CliQ details copied to clipboard!'
      );
      setTimeout(() => setCopiedBanner(''), 3500);
    } catch {
      // ignore
    }
  };

  const handleRegenerateDefault = () => {
    const generated = generatePaymentReminderMessage({
      customerName,
      phone: recipientPhone,
      unpaidVisits,
      templateType,
      lang: msgLang,
    });
    setMessageText(generated);
  };

  const whatsAppUrl = formatWhatsAppUrl(recipientPhone, messageText);
  const cleanSmsPhone = recipientPhone.replace(/[^\d+]/g, '');
  const smsUrl = cleanSmsPhone
    ? `sms:${cleanSmsPhone}?body=${encodeURIComponent(messageText)}`
    : `sms:?body=${encodeURIComponent(messageText)}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-reminder-modal-title"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center shrink-0">
              <BellRing className="w-5 h-5 text-[#E58E26]" />
            </div>
            <div>
              <div className="text-[11px] font-extrabold text-[#E58E26]">
                {lang === 'ar'
                  ? 'شركة المدار لتجارة تكنولوجيا المعلومات · متابعة الذمم والتحصيل'
                  : 'Al-Madar IT · Unpaid Visits & Payment Follow-up'}
              </div>
              <h3
                id="payment-reminder-modal-title"
                className="text-base sm:text-lg font-extrabold text-[#0B3B68]"
              >
                {lang === 'ar'
                  ? `رسالة مطالبة وتذكير بالدفع للزبون: ${customerName}`
                  : `Payment Request Message for: ${customerName}`}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="p-3 rounded-2xl bg-rose-50/80 border border-rose-200 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-rose-800">
                {lang === 'ar' ? 'إجمالي الذمم غير المدفوعة' : 'Total Amount Due'}
              </div>
              <div className="text-lg font-mono font-extrabold text-rose-700 mt-0.5 tabular-nums">
                {formatJod(totalUnpaidJod, lang)}
              </div>
            </div>
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          </div>

          <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-amber-900">
                {lang === 'ar' ? 'عدد الزيارات غير المدفوعة' : 'Unpaid Visits'}
              </div>
              <div className="text-lg font-mono font-extrabold text-amber-900 mt-0.5 tabular-nums">
                {unpaidVisits.length}
              </div>
            </div>
            <Calendar className="w-5 h-5 text-[#E58E26] shrink-0" />
          </div>

          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <label
              htmlFor="reminder-phone-input"
              className="text-[11px] font-bold text-slate-700 flex items-center gap-1"
            >
              <Phone className="w-3 h-3 text-[#0B3B68]" />
              <span>{lang === 'ar' ? 'رقم هاتف الزبون:' : 'Customer Phone:'}</span>
            </label>
            <input
              id="reminder-phone-input"
              type="tel"
              dir="ltr"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="079XXXXXXX"
              className="w-full min-h-[32px] px-2.5 py-1 rounded-xl border border-slate-300 bg-white font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          </div>
        </div>

        {/* Official CliQ Transfer Card */}
        <div className="p-3 rounded-2xl bg-sky-50/90 border border-sky-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-[#0B3B68]">
            <span className="font-extrabold">
              {lang === 'ar' ? 'بيانات التحويل عبر كلك (CliQ):' : 'CliQ Transfer Details:'}
            </span>
            <span
              dir="ltr"
              className="px-2 py-0.5 rounded-lg bg-white border border-sky-200 font-mono font-extrabold text-[#0B3B68]"
            >
              {CLIQ_PAYMENT_INFO.cliqNumber}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-white border border-sky-200 font-extrabold text-slate-800">
              {CLIQ_PAYMENT_INFO.recipientName}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 font-extrabold text-[#145A32]">
              {CLIQ_PAYMENT_INFO.bankName}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyCliqInfo}
            className="min-h-[30px] px-2.5 py-1 rounded-lg bg-[#0B3B68] hover:bg-[#155E95] text-white text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
          >
            <Copy className="w-3 h-3" />
            <span>{lang === 'ar' ? 'نسخ بيانات كلك' : 'Copy CliQ'}</span>
          </button>
        </div>

        {/* Highlighted Unpaid Visits Breakdown List */}
        {unpaidVisits.length > 0 && (
          <div className="rounded-2xl bg-rose-50/40 border border-rose-200/90 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-rose-900 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>
                  {lang === 'ar'
                    ? `الزيارات غير المدفوعة المشمولة بالرسالة (${unpaidVisits.length}):`
                    : `Unpaid Visits Included (${unpaidVisits.length}):`}
                </span>
              </span>
              {onMarkAllPaid && unpaidVisits.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    onMarkAllPaid(unpaidVisits);
                    onClose();
                  }}
                  className="min-h-[28px] px-2.5 py-1 rounded-lg bg-[#1E824C] hover:bg-[#145A32] text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>
                    {lang === 'ar' ? 'تسديد الكل الآن' : 'Mark All Paid'}
                  </span>
                </button>
              )}
            </div>

            <div className="divide-y divide-rose-200/60 max-h-36 overflow-y-auto">
              {unpaidVisits.map((v) => (
                <div
                  key={v.id}
                  className="py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate">
                      <span
                        dir="ltr"
                        className="font-mono text-[11px] text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded me-1.5"
                      >
                        {v.visitDate}
                      </span>
                      <bdi>{v.problem}</bdi>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-extrabold text-rose-700">
                      {formatJod(v.amountJod, lang)}
                    </span>
                    {onMarkVisitPaid && (
                      <button
                        type="button"
                        onClick={() => {
                          onMarkVisitPaid(v);
                          if (unpaidVisits.length <= 1) {
                            onClose();
                          }
                        }}
                        className="px-2 py-0.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-[#145A32] text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                        title={
                          lang === 'ar'
                            ? 'تحديد هذه الزيارة كمنجزة ومدفوعة'
                            : 'Mark this visit as paid'
                        }
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{lang === 'ar' ? 'تم الدفع' : 'Mark Paid'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Template Style & Language Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="text-xs font-extrabold text-slate-700 block">
              {lang === 'ar' ? 'نمط صياغة رسالة الدفع:' : 'Message Template Style:'}
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {(
                [
                  { id: 'polite', ar: 'رسالة راقية ومرتبة', en: 'Polite' },
                  { id: 'detailed', ar: 'كشف تفصيلي', en: 'Detailed' },
                  { id: 'short', ar: 'مختصرة ومباشرة', en: 'Short' },
                ] as const
              ).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplateType(tpl.id)}
                  className={`min-h-[34px] px-2 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    templateType === tpl.id
                      ? 'bg-[#0B3B68] text-white shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {lang === 'ar' ? tpl.ar : tpl.en}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-extrabold text-slate-700 block">
              {lang === 'ar' ? 'لغة الرسالة:' : 'Template Language:'}
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {(
                [
                  { id: 'ar', label: 'العربية' },
                  { id: 'en', label: 'English' },
                  { id: 'bilingual', label: 'عربي + EN' },
                ] as const
              ).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setMsgLang(l.id)}
                  className={`min-h-[34px] px-2 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                    msgLang === l.id
                      ? 'bg-[#0B3B68] text-white shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Editable Pre-filled Message Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="payment-reminder-textarea"
              className="text-xs font-extrabold text-[#0B3B68]"
            >
              {lang === 'ar'
                ? 'نص رسالة التذكير الجاهزة (يمكنك التعديل عليها قبل الإرسال):'
                : 'Pre-filled Reminder Message (Editable before sending):'}
            </label>
            <button
              type="button"
              onClick={handleRegenerateDefault}
              className="text-[11px] font-bold text-slate-500 hover:text-[#0B3B68] inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{lang === 'ar' ? 'إعادة توليد النص' : 'Reset Text'}</span>
            </button>
          </div>
          <textarea
            id="payment-reminder-textarea"
            rows={7}
            dir={msgLang === 'en' ? 'ltr' : 'rtl'}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            className="w-full p-3.5 rounded-2xl border border-slate-300 bg-slate-50/70 focus:bg-white text-xs sm:text-sm font-medium text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
          />
        </div>

        {copiedBanner && (
          <div
            role="status"
            className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[#145A32] text-xs font-extrabold flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-[#1E824C] shrink-0" />
            <span>{copiedBanner}</span>
          </div>
        )}

        {/* Action Buttons Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <button
              type="button"
              onClick={handleCopyMessage}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Copy className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'ar' ? 'نسخ رسالة التذكير' : 'Copy Reminder Message'}
              </span>
            </button>

            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(messageText).catch(() => {});
                }
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'إرسال عبر واتساب (WhatsApp)'
                  : 'Send via WhatsApp'}
              </span>
            </a>

            <a
              href={smsUrl}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-[#E58E26] shrink-0" />
              <span>{lang === 'ar' ? 'رسالة SMS' : 'Send SMS'}</span>
            </a>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
          >
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
