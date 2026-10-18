import React, { useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { Customer, Language, ScheduleAppointment } from '../types';
import { addDaysStr, getDayName, getTodayStr, getWeekDays } from '../utils/logic';
import { TouchDatePicker, TouchTimePicker } from './TouchDateTimePicker';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface ScheduleCalendarViewProps {
  lang: Language;
  appointments: ScheduleAppointment[];
  customers: Customer[];
  onSaveAppointment: (apt: ScheduleAppointment) => void;
  onDeleteAppointment: (id: string) => void;
}

export const ScheduleCalendarView: React.FC<ScheduleCalendarViewProps> = ({
  lang,
  appointments,
  customers,
  onSaveAppointment,
  onDeleteAppointment,
}) => {
  const [weekRefDate, setWeekRefDate] = useState(getTodayStr());
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(getTodayStr());
  const [time, setTime] = useState('11:00');
  const [type, setType] = useState<ScheduleAppointment['type']>('custom');
  const [status, setStatus] = useState<ScheduleAppointment['status']>('scheduled');
  const [note, setNote] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ScheduleAppointment | null>(
    null
  );

  // Inline Day-Card Quick Entry State for even faster filling inside any day of the week
  const [inlineDayStr, setInlineDayStr] = useState<string | null>(null);
  const [inlineCustomer, setInlineCustomer] = useState('');
  const [inlinePhone, setInlinePhone] = useState('');
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineTime, setInlineTime] = useState('10:30');
  const [inlineNote, setInlineNote] = useState('');

  const weekDays = getWeekDays(weekRefDate);
  const todayStr = getTodayStr();

  const filteredAppointments = appointments.filter((a) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      a.customerName.toLowerCase().includes(q) ||
      a.title.toLowerCase().includes(q) ||
      (a.phone || '').toLowerCase().includes(q) ||
      a.date.includes(q) ||
      (a.note || '').toLowerCase().includes(q)
    );
  });

  const visibleWeekDays =
    selectedDayFilter === 'all' || !weekDays.includes(selectedDayFilter)
      ? weekDays
      : [selectedDayFilter];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !customerName.trim() || !date) return;

    const existing = editingId
      ? appointments.find((a) => a.id === editingId)
      : undefined;

    const record: ScheduleAppointment = {
      id:
        editingId ||
        `apt-custom-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      title: title.trim(),
      customerName: customerName.trim(),
      phone: phone.trim(),
      date,
      time: time || '10:00',
      type: existing?.type || type,
      linkedVisitId: existing?.linkedVisitId,
      status,
      note: note.trim(),
    };

    onSaveAppointment(record);
    setWeekRefDate(date);
    setEditingId(null);
    setTitle('');
    setCustomerName('');
    setPhone('');
    setNote('');
  };

  const handleInlineDaySubmit = (e: React.FormEvent, targetDay: string) => {
    e.preventDefault();
    if (!inlineCustomer.trim() || !inlineTitle.trim()) return;

    const record: ScheduleAppointment = {
      id: `apt-custom-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      title: inlineTitle.trim(),
      customerName: inlineCustomer.trim(),
      phone: inlinePhone.trim(),
      date: targetDay,
      time: inlineTime || '10:30',
      type: 'custom',
      status: 'scheduled',
      note: inlineNote.trim(),
    };

    onSaveAppointment(record);
    setInlineCustomer('');
    setInlinePhone('');
    setInlineTitle('');
    setInlineNote('');
    setInlineDayStr(null);
  };

  const handleEdit = (apt: ScheduleAppointment) => {
    setEditingId(apt.id);
    setTitle(apt.title);
    setCustomerName(apt.customerName);
    setPhone(apt.phone || '');
    setDate(apt.date);
    setTime(apt.time);
    setType(apt.type);
    setStatus(apt.status);
    setNote(apt.note || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleStatus = (apt: ScheduleAppointment) => {
    onSaveAppointment({
      ...apt,
      status: apt.status === 'completed' ? 'scheduled' : 'completed',
    });
  };

  const handleOpenDayQuickAdd = (dayStr: string) => {
    setDate(dayStr);
    setInlineDayStr(inlineDayStr === dayStr ? null : dayStr);
    setInlineCustomer('');
    setInlinePhone('');
    setInlineTitle('');
    setInlineNote('');
  };

  return (
    <div className="space-y-6">
      {/* Spacious Appointment Entry Form */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-7 shadow-sm space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#0B3B68] text-white flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#0B3B68]">
                {editingId
                  ? lang === 'ar'
                    ? 'تعديل موعد في الجدول الأسبوعي'
                    : 'Edit Weekly Appointment'
                  : lang === 'ar'
                  ? 'جدول المواعيد الأسبوعي — تعبئة وإضافة موعد جديد'
                  : 'Weekly Schedule Calendar — Add New Appointment'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                {lang === 'ar'
                  ? 'مساحة واسعة لتعبئة المواعيد، مع ترحيل تلقائي لاسم الزبون إلى صفحة الزبائن'
                  : 'Spacious appointment scheduling with automatic customer sync'}
              </p>
            </div>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setTitle('');
                setCustomerName('');
                setPhone('');
                setNote('');
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء التعديل' : 'Cancel Edit'}
            </button>
          )}
        </div>

        {/* Quick Customer Selector (Only shown if saved customers exist) */}
        {customers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 me-1">
              {lang === 'ar' ? 'اختيار سريع لزبون مسجل:' : 'Quick customer:'}
            </span>
            {customers.slice(0, 8).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCustomerName(c.name);
                  if (c.phone) setPhone(c.phone);
                  if (!title) {
                    setTitle(
                      lang === 'ar'
                        ? `زيارة صيانة: ${c.name}`
                        : `Maintenance Visit: ${c.name}`
                    );
                  }
                }}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 cursor-pointer"
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Spacious Input Fields for Customer, Phone, Title, and Note */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label
              htmlFor="cal-customer"
              className="text-xs sm:text-sm font-bold text-slate-800 block"
            >
              {lang === 'ar' ? 'اسم الزبون أو الشركة *' : 'Customer / Company Name *'}
            </label>
            <input
              id="cal-customer"
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'ادخل اسم الزبون أو الجهة...'
                  : 'Enter customer name...'
              }
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="cal-phone"
              className="text-xs sm:text-sm font-bold text-slate-800 block"
            >
              {lang === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
            </label>
            <input
              id="cal-phone"
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="079XXXXXXX"
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-sm tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="cal-title"
              className="text-xs sm:text-sm font-bold text-slate-800 block"
            >
              {lang === 'ar'
                ? 'عنوان الموعد / تفاصيل المهمة *'
                : 'Appointment Title / Task *'}
            </label>
            <input
              id="cal-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'مثال: صيانة سيرفر، تمديد شبكة، زيارة عقد دوري...'
                  : 'e.g. Server maintenance, network setup...'
              }
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="cal-note"
              className="text-xs sm:text-sm font-bold text-slate-800 block"
            >
              {lang === 'ar' ? 'ملاحظات الموعد أو العنوان' : 'Notes / Location'}
            </label>
            <input
              id="cal-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'الموقع أو تفاصيل إضافية للموعد...'
                  : 'Location or extra details...'
              }
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          </div>
        </div>

        {/* Full-Width Spacious Date & Time Pickers */}
        <div className="space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <TouchDatePicker
              id="cal-date"
              label={lang === 'ar' ? 'تاريخ ويوم الموعد' : 'Appointment Date'}
              value={date}
              onChange={setDate}
              lang={lang}
            />
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <TouchTimePicker
              id="cal-time"
              label={lang === 'ar' ? 'وقت الموعد' : 'Appointment Time'}
              value={time}
              onChange={setTime}
              lang={lang}
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full min-h-[50px] px-6 py-3 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>
            {editingId
              ? lang === 'ar'
                ? 'حفظ تعديلات الموعد'
                : 'Update Appointment'
              : lang === 'ar'
              ? 'إضافة الموعد إلى التقويم الأسبوعي'
              : 'Add Appointment to Weekly Calendar'}
          </span>
        </button>
      </form>

      {/* Weekly Calendar Navigation, Day Filter Strip & Spacious 2-Column Agenda Cards */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-7 shadow-sm space-y-6">
        {/* Top Header & Week Navigation */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-base sm:text-lg font-extrabold text-[#0B3B68]">
                {lang === 'ar' ? 'جدول مواعيد الأسبوع' : 'Weekly Schedule'}
              </h3>
              <div className="flex flex-wrap items-center gap-2 px-3 py-1 rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                <span>{getDayName(weekDays[0], lang)}</span>
                <span dir="ltr" className="font-mono tabular-nums text-[#0B3B68]">
                  {weekDays[0]}
                </span>
                <span>{lang === 'ar' ? 'إلى' : 'to'}</span>
                <span>{getDayName(weekDays[6], lang)}</span>
                <span dir="ltr" className="font-mono tabular-nums text-[#0B3B68]">
                  {weekDays[6]}
                </span>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-600">
              {lang === 'ar'
                ? 'بطاقات أيام واسعة ومميزة لمنع تداخل المواعيد، مع إمكانية تعبئة موعد مباشر داخل أي يوم'
                : 'Spacious day cards with inline quick appointment entry'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input in Schedule */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'ar'
                    ? 'بحث في المواعيد (زبون، مهمة، هاتف)...'
                    : 'Search appointments...'
                }
                aria-label={lang === 'ar' ? 'بحث في المواعيد' : 'Search appointments'}
                className="w-full min-h-[42px] ps-9 pe-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setWeekRefDate(addDaysStr(weekRefDate, -7));
                setSelectedDayFilter('all');
              }}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
              <span>{lang === 'ar' ? 'الأسبوع السابق' : 'Prev Week'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setWeekRefDate(todayStr);
                setSelectedDayFilter('all');
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B3B68] text-white text-xs font-bold cursor-pointer"
            >
              {lang === 'ar' ? 'الأسبوع الحالي' : 'This Week'}
            </button>
            <button
              type="button"
              onClick={() => {
                setWeekRefDate(addDaysStr(weekRefDate, 7));
                setSelectedDayFilter('all');
              }}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>{lang === 'ar' ? 'الأسبوع القادم' : 'Next Week'}</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Distinctive 7-Day Interactive Strip (All Week + 7 Individual Days) */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-slate-700">
              {lang === 'ar'
                ? 'أيام الأسبوع (اضغط على أي يوم للتركيز عليه أو عرض الأسبوع كاملاً):'
                : 'Week Days (Tap any day to focus or view all week):'}
            </span>
            {selectedDayFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedDayFilter('all')}
                className="text-xs font-extrabold text-[#0B3B68] hover:underline cursor-pointer"
              >
                {lang === 'ar'
                  ? 'عرض جميع أيام الأسبوع (7 أيام)'
                  : 'Show All 7 Days'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            <button
              type="button"
              onClick={() => setSelectedDayFilter('all')}
              className={`min-h-[72px] p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                selectedDayFilter === 'all'
                  ? 'bg-[#0B3B68] text-white border-[#0B3B68] shadow-xs'
                  : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="text-xs font-extrabold">
                {lang === 'ar' ? 'كامل الأسبوع' : 'All Week'}
              </span>
              <span
                className={`text-[11px] font-bold ${
                  selectedDayFilter === 'all' ? 'text-amber-300' : 'text-slate-500'
                }`}
              >
                {lang === 'ar' ? '7 أيام' : '7 Days'}
              </span>
            </button>

            {weekDays.map((dayStr) => {
              const isSelected = selectedDayFilter === dayStr;
              const isToday = dayStr === todayStr;
              const count = filteredAppointments.filter(
                (a) => a.date === dayStr
              ).length;
              return (
                <button
                  key={dayStr}
                  type="button"
                  onClick={() =>
                    setSelectedDayFilter(
                      selectedDayFilter === dayStr ? 'all' : dayStr
                    )
                  }
                  className={`min-h-[72px] p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#E58E26] text-white border-[#E58E26] shadow-xs'
                      : isToday
                      ? 'bg-sky-50 text-[#0B3B68] border-[#0B3B68]'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-[#0B3B68]/40'
                  }`}
                >
                  <span className="text-xs font-extrabold whitespace-nowrap">
                    {getDayName(dayStr, lang)}
                  </span>
                  <span
                    dir="ltr"
                    className={`text-[11px] font-mono font-bold tabular-nums ${
                      isSelected ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    {dayStr}
                  </span>
                  <span
                    className={`text-[10px] font-bold ${
                      isSelected
                        ? 'text-amber-100'
                        : count > 0
                        ? 'text-[#1E824C]'
                        : 'text-slate-400'
                    }`}
                  >
                    {lang === 'ar' ? `${count} مواعيد` : `${count} items`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Spacious 2-Column (or Full-Width) Day Panels — Zero Crowding */}
        <div
          className={`grid grid-cols-1 ${
            visibleWeekDays.length > 1 ? 'lg:grid-cols-2' : ''
          } gap-5`}
        >
          {visibleWeekDays.map((dayStr) => {
            const isToday = dayStr === todayStr;
            const dayAppointments = filteredAppointments
              .filter((a) => a.date === dayStr)
              .sort((a, b) => a.time.localeCompare(b.time));
            const isInlineOpen = inlineDayStr === dayStr;

            return (
              <div
                key={dayStr}
                className={`rounded-2xl border p-5 flex flex-col justify-between space-y-4 ${
                  isToday
                    ? 'bg-sky-50/40 border-[#0B3B68] shadow-xs'
                    : 'bg-slate-50/50 border-slate-200'
                }`}
              >
                <div className="space-y-4">
                  {/* Day Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`text-base sm:text-lg font-extrabold ${
                          isToday ? 'text-[#0B3B68]' : 'text-slate-900'
                        }`}
                      >
                        {getDayName(dayStr, lang)}
                      </span>
                      {isToday && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#E58E26] text-white text-xs font-extrabold">
                          {lang === 'ar' ? 'اليوم' : 'Today'}
                        </span>
                      )}
                      <span
                        dir="ltr"
                        className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-mono font-bold tabular-nums text-[#0B3B68]"
                      >
                        {dayStr}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenDayQuickAdd(dayStr)}
                      aria-label={
                        lang === 'ar'
                          ? `تعبئة موعد يوم ${dayStr}`
                          : `Add appointment on ${dayStr}`
                      }
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        isInlineOpen
                          ? 'bg-slate-800 text-white'
                          : 'bg-[#0B3B68] hover:bg-[#155E95] text-white'
                      }`}
                    >
                      {isInlineOpen ? (
                        <>
                          <X className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'إغلاق' : 'Close'}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>
                            {lang === 'ar' ? 'تعبئة موعد' : 'Add Appointment'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Spacious Inline Day Appointment Form */}
                  {isInlineOpen && (
                    <form
                      onSubmit={(e) => handleInlineDaySubmit(e, dayStr)}
                      className="p-4 rounded-xl bg-white border-2 border-[#0B3B68] space-y-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between text-xs font-extrabold text-[#0B3B68]">
                        <span>
                          {lang === 'ar'
                            ? `تعبئة موعد سريع ليوم ${getDayName(dayStr, lang)}`
                            : `Quick Appointment for ${getDayName(dayStr, lang)}`}
                        </span>
                        <span dir="ltr" className="font-mono tabular-nums">
                          {dayStr}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          value={inlineCustomer}
                          onChange={(e) => setInlineCustomer(e.target.value)}
                          placeholder={
                            lang === 'ar' ? 'اسم الزبون أو الشركة *' : 'Customer Name *'
                          }
                          className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
                        />
                        <input
                          type="tel"
                          dir="ltr"
                          value={inlinePhone}
                          onChange={(e) => setInlinePhone(e.target.value)}
                          placeholder="079XXXXXXX"
                          className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs sm:text-sm tabular-nums"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="text"
                          required
                          value={inlineTitle}
                          onChange={(e) => setInlineTitle(e.target.value)}
                          placeholder={
                            lang === 'ar'
                              ? 'عنوان الموعد / المهمة المطلوبة *'
                              : 'Appointment Title / Task *'
                          }
                          className="sm:col-span-2 w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
                        />
                        <input
                          type="time"
                          dir="ltr"
                          value={inlineTime}
                          onChange={(e) => setInlineTime(e.target.value)}
                          className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs sm:text-sm font-bold tabular-nums"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="text"
                          value={inlineNote}
                          onChange={(e) => setInlineNote(e.target.value)}
                          placeholder={
                            lang === 'ar'
                              ? 'العنوان أو ملاحظات إضافية...'
                              : 'Location or notes...'
                          }
                          className="flex-1 min-h-[42px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
                        />
                        <button
                          type="submit"
                          className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>
                            {lang === 'ar' ? 'حفظ الموعد' : 'Save Appointment'}
                          </span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Day Appointments List */}
                  {dayAppointments.length === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <p className="text-xs sm:text-sm text-slate-500">
                        {lang === 'ar'
                          ? 'لا توجد مواعيد مسجلة في هذا اليوم.'
                          : 'No appointments scheduled on this day.'}
                      </p>
                      {!isInlineOpen && (
                        <button
                          type="button"
                          onClick={() => handleOpenDayQuickAdd(dayStr)}
                          className="text-xs font-extrabold text-[#0B3B68] hover:underline cursor-pointer"
                        >
                          {lang === 'ar'
                            ? `+ اضغط هنا لتعبئة موعد جديد يوم ${getDayName(dayStr, lang)}`
                            : `+ Tap here to schedule on ${getDayName(dayStr, lang)}`}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {dayAppointments.map((apt) => {
                        const isDone = apt.status === 'completed';
                        return (
                          <div
                            key={apt.id}
                            className={`p-4 rounded-xl bg-white border space-y-3 shadow-2xs ${
                              isDone
                                ? 'border-emerald-200 bg-emerald-50/30'
                                : 'border-slate-200'
                            }`}
                          >
                            {/* Top Row: Time Badge + Status Toggle */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[#0B3B68] inline-flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-[#E58E26]" />
                                <span
                                  dir="ltr"
                                  className="font-mono text-xs sm:text-sm font-extrabold tabular-nums"
                                >
                                  {apt.time}
                                </span>
                              </span>

                              <button
                                type="button"
                                onClick={() => toggleStatus(apt)}
                                aria-label={
                                  lang === 'ar'
                                    ? `تغيير حالة موعد ${apt.customerName}`
                                    : `Toggle appointment status ${apt.customerName}`
                                }
                                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-extrabold border cursor-pointer ${
                                  isDone
                                    ? 'bg-emerald-50 text-[#1E824C] border-emerald-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {isDone
                                  ? lang === 'ar'
                                    ? 'مكتمل'
                                    : 'Completed'
                                  : lang === 'ar'
                                  ? 'مجدول'
                                  : 'Scheduled'}
                              </button>
                            </div>

                            {/* Customer Name & Task Title */}
                            <div className="space-y-1">
                              <div className="text-sm sm:text-base font-extrabold text-[#0B3B68] leading-relaxed break-words">
                                {apt.customerName}
                              </div>
                              <div className="text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed break-words">
                                {apt.title}
                              </div>
                            </div>

                            {/* Phone & Note Metadata */}
                            {(apt.phone || apt.note) && (
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1">
                                {apt.phone && (
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                                    <Phone className="w-3.5 h-3.5 text-[#1E824C]" />
                                    <span
                                      dir="ltr"
                                      className="font-mono tabular-nums"
                                    >
                                      {apt.phone}
                                    </span>
                                  </span>
                                )}
                                {apt.note && (
                                  <span className="inline-flex items-center gap-1 text-slate-600 break-words">
                                    <FileText className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                    <span>{apt.note}</span>
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Edit & Delete Actions */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => handleEdit(apt)}
                                aria-label={
                                  lang === 'ar'
                                    ? `تعديل موعد ${apt.customerName}`
                                    : `Edit appointment ${apt.customerName}`
                                }
                                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#0B3B68] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(apt)}
                                aria-label={
                                  lang === 'ar'
                                    ? `حذف موعد ${apt.customerName}`
                                    : `Delete appointment ${apt.customerName}`
                                }
                                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={lang === 'ar' ? 'تأكيد حذف الموعد' : 'Confirm Appointment Deletion'}
        itemName={
          deleteTarget
            ? `${deleteTarget.customerName} — ${deleteTarget.title} (${deleteTarget.date} ${deleteTarget.time})`
            : ''
        }
        lang={lang}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteAppointment(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
};

