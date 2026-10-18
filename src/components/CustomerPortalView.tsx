import React, { useState } from 'react';
import {
  CheckCircle2,
  Phone,
  Send,
  User as UserIcon,
  Wrench,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type { Language, MaintenanceVisit } from '../types';
import { getTodayStr } from '../utils/logic';
import type { CustomerBookingInput } from '../utils/logic';
import { TouchDatePicker, TouchTimePicker } from './TouchDateTimePicker';
import { AlMadarLogo } from './AlMadarLogo';

interface CustomerPortalViewProps {
  lang: Language;
  onSubmitBooking: (input: CustomerBookingInput) => MaintenanceVisit;
  onNavigateToMaintenance?: () => void;
  onBackToLogin?: () => void;
  recentPortalVisitsCount: number;
}

const PROBLEM_PRESETS = [
  {
    ar: 'صيانة أجهزة حاسوب / لابتوب',
    en: 'PC / Laptop Hardware & OS Maintenance',
  },
  {
    ar: 'انقطاع أو ضعف شبكة الإنترنت والراوتر',
    en: 'Network, Router & Wi-Fi Connectivity Issue',
  },
  {
    ar: 'صيانة السيرفرات والنسخ الاحتياطي',
    en: 'Server & Backup System Maintenance',
  },
  {
    ar: 'صيانة طابعات وأجهزة نقاط البيع (POS)',
    en: 'Printers, Scanners & POS Systems',
  },
  {
    ar: 'أنظمة كاميرات المراقبة وأجهزة البصمة',
    en: 'CCTV Security Cameras & Biometrics',
  },
  {
    ar: 'زيارة عقد صيانة دوري',
    en: 'Scheduled Maintenance Contract Visit',
  },
];

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  lang,
  onSubmitBooking,
  onNavigateToMaintenance,
  onBackToLogin,
  recentPortalVisitsCount,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [date, setDate] = useState(getTodayStr());
  const [phone, setPhone] = useState('');
  const [problemType, setProblemType] = useState('');
  const [time, setTime] = useState('10:30');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedVisit, setSubmittedVisit] = useState<MaintenanceVisit | null>(
    null
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!customerName.trim()) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى إدخال اسم الزبون أو اسم الشركة.'
          : 'Please enter the customer or company name.'
      );
      return;
    }
    if (!problemType.trim()) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى اختيار أو كتابة نوع المشكلة.'
          : 'Please select or enter the problem type.'
      );
      return;
    }
    if (!date) {
      setErrorMsg(
        lang === 'ar' ? 'يرجى اختيار تاريخ الزيارة.' : 'Please select a visit date.'
      );
      return;
    }

    const created = onSubmitBooking({
      customerName: customerName.trim(),
      date,
      phone: phone.trim(),
      problemType: problemType.trim(),
      time: time.trim(),
      note: note.trim(),
    });

    setSubmittedVisit(created);
    setCustomerName('');
    setPhone('');
    setProblemType('');
    setNote('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <AlMadarLogo size="md" showText={false} />
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#0B3B68]">
              {lang === 'ar'
                ? 'شاشة الزبائن — حجز وتسجيل طلب صيانة'
                : 'Customer Portal — Request Maintenance Visit'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              {lang === 'ar'
                ? 'يتم ترحيل الطلب تلقائياً إلى قسم طلبات الصيانة وجدول المواعيد الأسبوعي وسجل الزبائن.'
                : 'Automatically transfers to Maintenance Requests, Weekly Schedule, and Customers Directory.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onBackToLogin && (
            <button
              type="button"
              onClick={onBackToLogin}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs sm:text-sm hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>
                {lang === 'ar' ? 'العودة لتسجيل دخول الموظفين' : 'Back to Staff Login'}
              </span>
            </button>
          )}
          {onNavigateToMaintenance && (
            <button
              type="button"
              onClick={onNavigateToMaintenance}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B3B68] text-white font-bold text-xs sm:text-sm hover:bg-[#155E95] transition-colors cursor-pointer"
            >
              {lang === 'ar'
                ? `عرض طلبات الصيانة (${recentPortalVisitsCount} من البوابة)`
                : `View Maintenance (${recentPortalVisitsCount} Portal)`}
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Notice on Submit */}
      {submittedVisit && (
        <div
          className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-emerald-950 space-y-3"
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1E824C] text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#145A32]">
                  {lang === 'ar'
                    ? 'تم تسجيل طلب الصيانة وترحيله تلقائياً بنجاح!'
                    : 'Maintenance Request Registered & Transferred Automatically!'}
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  {lang === 'ar'
                    ? `تم إدراج طلب "${submittedVisit.customerName}" بتاريخ ${submittedVisit.visitDate} الساعة ${submittedVisit.visitTime} في شاشة طلبات الصيانة والجدول الأسبوعي.`
                    : `Request for "${submittedVisit.customerName}" on ${submittedVisit.visitDate} at ${submittedVisit.visitTime} is now in Maintenance Requests & Weekly Schedule.`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSubmittedVisit(null)}
              className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
            >
              {lang === 'ar' ? 'طلب جديد' : 'New Request'}
            </button>
          </div>

          {onNavigateToMaintenance && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onNavigateToMaintenance}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1E824C] text-white text-xs sm:text-sm font-bold hover:bg-[#145A32] transition-colors cursor-pointer"
              >
                {lang === 'ar'
                  ? 'الانتقال الآن إلى شاشة طلبات الصيانة لمعاينة الطلب المرحّل'
                  : 'Go to Maintenance Requests to View Transferred Ticket'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Booking Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm space-y-6"
      >
        {errorMsg && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold"
          >
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Customer Name */}
          <div className="space-y-2">
            <label
              htmlFor="portal-customer-name"
              className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5"
            >
              <UserIcon className="w-4 h-4 text-[#0B3B68]" />
              <span>{lang === 'ar' ? 'الاسم (اسم الزبون / الجهة)' : 'Customer / Company Name'}</span>
              <span className="text-rose-600">*</span>
            </label>
            <input
              id="portal-customer-name"
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'مثال: شركة الأمل التجارية / السيد محمد...'
                  : 'e.g. Al-Amal Trading Co. / Mr. Mohammad'
              }
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          </div>

          {/* Optional Phone */}
          <div className="space-y-2">
            <label
              htmlFor="portal-customer-phone"
              className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5"
            >
              <Phone className="w-4 h-4 text-[#1E824C]" />
              <span>{lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}</span>
            </label>
            <input
              id="portal-customer-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="079XXXXXXX"
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          </div>
        </div>

        {/* Problem Type with Quick Touch Cards */}
        <div className="space-y-3">
          <label
            htmlFor="portal-problem-type"
            className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5"
          >
            <Wrench className="w-4 h-4 text-[#E58E26]" />
            <span>{lang === 'ar' ? 'نوع المشكلة / الخدمة المطلوبة' : 'Problem Type / Requested Service'}</span>
            <span className="text-rose-600">*</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {PROBLEM_PRESETS.map((preset) => {
              const text = lang === 'ar' ? preset.ar : preset.en;
              const isSelected = problemType === text;
              return (
                <button
                  key={text}
                  type="button"
                  onClick={() => setProblemType(text)}
                  className={`min-h-[48px] p-3 rounded-xl border text-start text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0B3B68] text-white border-[#0B3B68] shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#0B3B68]/50 hover:bg-white'
                  }`}
                >
                  <Sparkles
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-[#E58E26]' : 'text-[#155E95]'
                    }`}
                  />
                  <span>{text}</span>
                </button>
              );
            })}
          </div>

          <input
            id="portal-problem-type"
            type="text"
            required
            value={problemType}
            onChange={(e) => setProblemType(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'أو اكتب وصف المشكلة بالتفصيل هنا...'
                : 'Or describe the issue in detail here...'
            }
            className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
          />
        </div>

        {/* Easy Date Picker */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <TouchDatePicker
            id="portal-visit-date"
            label={lang === 'ar' ? 'تاريخ الزيارة المطلوب' : 'Preferred Visit Date'}
            value={date}
            onChange={setDate}
            lang={lang}
          />
        </div>

        {/* Easy Optional Time Picker */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <TouchTimePicker
            id="portal-visit-time"
            label={lang === 'ar' ? 'الوقت المفضل للزيارة' : 'Preferred Visit Time'}
            value={time}
            onChange={setTime}
            lang={lang}
            optional={true}
          />
        </div>

        {/* Additional Note */}
        <div className="space-y-2">
          <label
            htmlFor="portal-note"
            className="text-xs sm:text-sm font-bold text-slate-800 block"
          >
            {lang === 'ar' ? 'ملاحظات إضافية أو العنوان' : 'Additional Notes or Location'}
          </label>
          <input
            id="portal-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'مثال: الطابق الثالث - مقابل البوابة الشمالية...'
                : 'e.g. 3rd Floor, North Gate...'
            }
            className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
          />
        </div>

        <button
          type="submit"
          className="w-full min-h-[52px] px-6 py-3 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
        >
          <Send className="w-5 h-5 shrink-0" />
          <span>
            {lang === 'ar'
              ? 'إرسال طلب الصيانة وترحيله فوراً لقسم الصيانة'
              : 'Submit & Auto-Transfer Maintenance Request'}
          </span>
        </button>
      </form>
    </div>
  );
};
