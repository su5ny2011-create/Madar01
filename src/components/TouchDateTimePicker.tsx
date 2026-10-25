import React from 'react';
import { Calendar, Clock, X } from 'lucide-react';
import type { Language } from '../types';
import { addDaysStr, getTodayStr } from '../utils/logic';

interface TouchDatePickerProps {
  label?: string;
  value: string;
  onChange: (dateStr: string) => void;
  lang: Language;
  optional?: boolean;
  mode?: 'visit' | 'next_visit';
  id?: string;
}

const AR_WEEKDAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getWeekdayLabel(dateStr: string, lang: Language): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const dayIdx = dt.getUTCDay();
  return lang === 'ar' ? AR_WEEKDAYS[dayIdx] || '' : EN_WEEKDAYS[dayIdx] || '';
}

export const TouchDatePicker: React.FC<TouchDatePickerProps> = ({
  label,
  value,
  onChange,
  lang,
  optional = false,
  mode = 'visit',
  id,
}) => {
  const today = getTodayStr();
  const tomorrow = addDaysStr(today, 1);
  const afterTomorrow = addDaysStr(today, 2);
  const nextWeek = addDaysStr(today, 7);
  const nextTwoWeeks = addDaysStr(today, 14);
  const nextMonth = addDaysStr(today, 30);

  const quickButtons =
    mode === 'next_visit'
      ? [
          {
            label: lang === 'ar' ? 'بعد أسبوع' : '+1 Week',
            date: nextWeek,
          },
          {
            label: lang === 'ar' ? 'بعد أسبوعين' : '+2 Weeks',
            date: nextTwoWeeks,
          },
          {
            label: lang === 'ar' ? 'بعد شهر' : '+1 Month',
            date: nextMonth,
          },
          {
            label: lang === 'ar' ? 'غداً' : 'Tomorrow',
            date: tomorrow,
          },
        ]
      : [
          {
            label: lang === 'ar' ? 'اليوم' : 'Today',
            date: today,
          },
          {
            label: lang === 'ar' ? 'غداً' : 'Tomorrow',
            date: tomorrow,
          },
          {
            label: lang === 'ar' ? 'بعد غد' : 'In 2 Days',
            date: afterTomorrow,
          },
          {
            label: lang === 'ar' ? 'الأسبوع القادم' : 'Next Week',
            date: nextWeek,
          },
        ];

  const upcomingDays = Array.from({ length: 7 }, (_, i) =>
    addDaysStr(today, i)
  );

  return (
    <div className="space-y-2">
      {/* Header Row with Label & Selected Day & Date Preview */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-xs sm:text-sm font-extrabold text-[#0B3B68] flex items-center gap-2"
        >
          <Calendar className="w-4 h-4 text-[#E58E26] shrink-0" />
          <span>{label}</span>
        </label>

        <div className="flex items-center gap-2">
          {value && (
            <div className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-xs flex items-center gap-2 shadow-2xs">
              <span className="font-extrabold text-[#0B3B68]">
                {getWeekdayLabel(value, lang)}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                |
              </span>
              <span
                dir="ltr"
                className="font-mono font-bold tabular-nums text-[#1E824C]"
              >
                {value}
              </span>
            </div>
          )}

          {optional && value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'مسح' : 'Clear'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Calendar Date Input Only */}
      <div>
        <input
          id={id}
          type="date"
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
        />
      </div>
    </div>
  );
};

interface TouchTimePickerProps {
  label: string;
  value: string;
  onChange: (timeStr: string) => void;
  lang: Language;
  optional?: boolean;
  id?: string;
}

const TIME_SLOTS = [
  { time: '08:30', num: '08:30', periodAr: 'صباحاً', periodEn: 'AM' },
  { time: '09:30', num: '09:30', periodAr: 'صباحاً', periodEn: 'AM' },
  { time: '10:30', num: '10:30', periodAr: 'صباحاً', periodEn: 'AM' },
  { time: '11:30', num: '11:30', periodAr: 'صباحاً', periodEn: 'AM' },
  { time: '12:30', num: '12:30', periodAr: 'ظهراً', periodEn: 'PM' },
  { time: '14:00', num: '02:00', periodAr: 'مساءً', periodEn: 'PM' },
  { time: '15:30', num: '03:30', periodAr: 'مساءً', periodEn: 'PM' },
  { time: '17:00', num: '05:00', periodAr: 'مساءً', periodEn: 'PM' },
];

export const TouchTimePicker: React.FC<TouchTimePickerProps> = ({
  label,
  value,
  onChange,
  lang,
  optional = false,
  id,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="text-xs sm:text-sm font-extrabold text-[#0B3B68] flex items-center gap-2"
        >
          <Clock className="w-4 h-4 text-[#E58E26] shrink-0" />
          <span>{label}</span>
        </label>

        <div className="flex items-center gap-2">
          {value && (
            <span
              dir="ltr"
              className="px-3 py-1 rounded-xl bg-white border border-slate-200 font-mono text-xs font-extrabold tabular-nums text-[#0B3B68]"
            >
              {value}
            </span>
          )}
          {optional && value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'مسح' : 'Clear'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 1-Tap Time Slot Grid with Separated LTR Number & Period */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {TIME_SLOTS.map((slot) => {
          const active = value === slot.time;
          return (
            <button
              key={slot.time}
              type="button"
              onClick={() => onChange(slot.time)}
              className={`min-h-[52px] px-2.5 py-2 rounded-xl border transition-colors flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                active
                  ? 'bg-[#E58E26] text-white border-[#E58E26] shadow-sm'
                  : 'bg-white text-slate-800 border-slate-200 hover:border-[#E58E26] hover:bg-amber-50/40'
              }`}
            >
              <span
                dir="ltr"
                className="text-xs sm:text-sm font-mono font-extrabold tabular-nums"
              >
                {slot.num}
              </span>
              <span
                className={`text-[11px] font-bold ${
                  active ? 'text-amber-100' : 'text-slate-500'
                }`}
              >
                {lang === 'ar' ? slot.periodAr : slot.periodEn}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
        <span className="text-xs font-semibold text-slate-600">
          {lang === 'ar' ? 'أو تحديد وقت مخصص:' : 'Or custom time:'}
        </span>
        <input
          id={id}
          type="time"
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="min-h-[44px] px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0B3B68] sm:w-44"
        />
      </div>
    </div>
  );
};

