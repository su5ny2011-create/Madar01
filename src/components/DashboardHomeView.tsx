import React, { useState } from 'react';
import {
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Pin,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Wrench,
  BarChart3,
  Database,
} from 'lucide-react';
import type { AppState, DailyNote, Language } from '../types';
import {
  calculateFinancialSummary,
  formatJod,
  getDayName,
  getTodayStr,
} from '../utils/logic';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface DashboardHomeViewProps {
  lang: Language;
  state: AppState;
  currentUserFullName: string;
  onNavigate: (
    tab:
      | 'dashboard'
      | 'maintenance'
      | 'finance'
      | 'catalogs'
      | 'schedule'
      | 'stats'
      | 'users'
      | 'backup'
  ) => void;
  onSaveNote: (note: DailyNote) => void;
  onDeleteNote: (id: string) => void;
}

export const DashboardHomeView: React.FC<DashboardHomeViewProps> = ({
  lang,
  state,
  currentUserFullName,
  onNavigate,
  onSaveNote,
  onDeleteNote,
}) => {
  const todayStr = getTodayStr();
  const dailySummary = calculateFinancialSummary(state, 'daily', todayStr);
  const weeklySummary = calculateFinancialSummary(state, 'weekly', todayStr);

  // Daily Note Form State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [notePinned, setNotePinned] = useState(true);
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [deleteTargetNote, setDeleteTargetNote] = useState<DailyNote | null>(
    null
  );

  const todayVisits = state.visits.filter((v) => v.visitDate === todayStr);
  const portalVisits = state.visits.filter((v) => v.source === 'customer_portal');
  const todayAppointments = state.appointments.filter((a) => a.date === todayStr);

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() && !noteContent.trim()) return;

    const record: DailyNote = {
      id: editingNoteId || `note-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      date: todayStr,
      title:
        noteTitle.trim() ||
        (lang === 'ar' ? 'ملاحظة عمل يومية' : 'Daily Work Note'),
      content: noteContent.trim(),
      isPinned: notePinned,
      isCompleted: false,
      author: currentUserFullName,
      createdAt: `${todayStr}`,
    };

    onSaveNote(record);
    setEditingNoteId(null);
    setNoteTitle('');
    setNoteContent('');
  };

  const noteQ = noteSearchQuery.trim().toLowerCase();
  const sortedNotes = [...state.dailyNotes]
    .filter(
      (n) =>
        !noteQ ||
        n.title.toLowerCase().includes(noteQ) ||
        n.content.toLowerCase().includes(noteQ) ||
        n.date.includes(noteQ)
    )
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.id.localeCompare(a.id);
    });

  return (
    <div className="space-y-6">
      {/* Top 4 Synchronized Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('maintenance')}
          className="text-start rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:border-[#0B3B68] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>
              {lang === 'ar' ? 'طلبات وزيارات الصيانة' : 'Maintenance Requests'}
            </span>
            <Wrench className="w-4 h-4 text-[#0B3B68]" />
          </div>
          <div className="text-3xl font-mono font-extrabold tabular-nums text-[#0B3B68] mt-2">
            {state.visits.length}
          </div>
          <div className="text-xs text-slate-600 mt-1.5">
            {lang === 'ar'
              ? `اليوم: ${todayVisits.length} · من بوابة الزبائن: ${portalVisits.length}`
              : `Today: ${todayVisits.length} · Portal: ${portalVisits.length}`}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('finance')}
          className="text-start rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:border-[#1E824C] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>
              {lang === 'ar'
                ? 'صافي الكاش بالصندوق اليوم (JOD)'
                : 'Net Drawer Cash Today (JOD)'}
            </span>
            <Banknote className="w-4 h-4 text-[#1E824C]" />
          </div>
          <div className="text-3xl font-mono font-extrabold tabular-nums text-[#1E824C] mt-2">
            {formatJod(dailySummary.netCashDrawerJod, lang)}
          </div>
          <div className="text-xs text-slate-600 font-mono tabular-nums mt-1.5">
            {lang === 'ar'
              ? `كاش الصباح: ${dailySummary.morningCashJod} · مقبوضات: ${dailySummary.totalRevenueJod}`
              : `Morning: ${dailySummary.morningCashJod} · Rev: ${dailySummary.totalRevenueJod}`}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('schedule')}
          className="text-start rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:border-[#E58E26] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>
              {lang === 'ar'
                ? 'جدول المواعيد الأسبوعي'
                : 'Weekly Schedule Calendar'}
            </span>
            <Calendar className="w-4 h-4 text-[#E58E26]" />
          </div>
          <div className="text-3xl font-mono font-extrabold tabular-nums text-slate-900 mt-2">
            {state.appointments.length}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 mt-1.5">
            <span>{lang === 'ar' ? 'مواعيد اليوم' : 'Today'}</span>
            <span className="font-bold text-[#0B3B68]">
              ({getDayName(todayStr, lang)})
            </span>
            <span dir="ltr" className="font-mono tabular-nums font-bold">
              {todayStr}: {todayAppointments.length}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('catalogs')}
          className="text-start rounded-2xl bg-[#0B3B68] text-white p-5 shadow-sm hover:bg-[#155E95] transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-bold text-sky-200">
            <span>
              {lang === 'ar'
                ? 'الزبائن وعقود الصيانة والقطع'
                : 'Customers, Contracts & Parts'}
            </span>
            <Building2 className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-3xl font-mono font-extrabold tabular-nums text-white mt-2">
            {state.customers.length}
          </div>
          <div className="text-xs text-amber-300 mt-1.5">
            {lang === 'ar'
              ? `أنواع القطع المسجلة: ${state.parts.length} · مصاريف جاهزة: ${state.expenseTemplates.length}`
              : `Saved Parts: ${state.parts.length} · Templates: ${state.expenseTemplates.length}`}
          </div>
        </button>
      </div>

      {/* Quick Touchscreen Action Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => onNavigate('maintenance')}
          className="min-h-[52px] px-4 py-3 rounded-2xl bg-[#0B3B68] hover:bg-[#155E95] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <Wrench className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{lang === 'ar' ? 'تسجيل زيارة صيانة' : 'New Maintenance Visit'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('finance')}
          className="min-h-[52px] px-4 py-3 rounded-2xl bg-[#1E824C] hover:bg-[#145A32] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <Banknote className="w-4 h-4 shrink-0" />
          <span>{lang === 'ar' ? 'كاش الصباح والمصاريف' : 'Morning Cash & Expenses'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('schedule')}
          className="min-h-[52px] px-4 py-3 rounded-2xl bg-[#E58E26] hover:bg-[#d17d1b] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <Calendar className="w-4 h-4 shrink-0" />
          <span>{lang === 'ar' ? 'جدول المواعيد الأسبوعي' : 'Weekly Schedule'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('stats')}
          className="min-h-[52px] px-4 py-3 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-[#0B3B68] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <BarChart3 className="w-4 h-4 text-[#0B3B68] shrink-0" />
          <span>{lang === 'ar' ? 'الإحصاءات وتصدير التقارير' : 'Statistics & Export'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('backup')}
          className="col-span-2 sm:col-span-1 min-h-[52px] px-4 py-3 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-[#0B3B68] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <Database className="w-4 h-4 text-[#1E824C] shrink-0" />
          <span>{lang === 'ar' ? 'نسخة احتياطية (تصدير/استيراد)' : 'Backup & Restore'}</span>
        </button>
      </div>

      {/* Main Split: Daily Notes & Work Summary (Left/Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Notes & Work Summary Panel (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E58E26] text-white flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  {lang === 'ar'
                    ? 'ملاحظات العمل وملخص العمل اليومي على الصفحة الرئيسية'
                    : 'Daily Work Summary & Quick Notes'}
                </h2>
                <p className="text-xs text-slate-500">
                  {lang === 'ar'
                    ? 'سجّل ملاحظاتك السريعة ومهام الصيانة أو ملخص العمل اليومي للفريق'
                    : 'Add quick operational notes, reminders, and daily work summaries'}
                </p>
              </div>
            </div>
          </div>

          {/* Add / Edit Note Form */}
          <form
            onSubmit={handleNoteSubmit}
            className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder={
                    lang === 'ar'
                      ? 'عنوان الملاحظة أو ملخص اليوم...'
                      : 'Note title or daily summary header...'
                  }
                  aria-label={lang === 'ar' ? 'عنوان الملاحظة' : 'Note title'}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-900"
                />
              </div>
              <button
                type="button"
                onClick={() => setNotePinned(!notePinned)}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                  notePinned
                    ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                <Pin className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'تثبيت في الأعلى' : 'Pin Note'}</span>
              </button>
            </div>

            <textarea
              rows={2}
              required
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'اكتب تفاصيل الملاحظة أو مهام اليوم لتسهيل العمل...'
                  : 'Write note details or daily tasks...'
              }
              aria-label={lang === 'ar' ? 'محتوى الملاحظة' : 'Note content'}
              className="w-full p-3.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900"
            />

            <div className="flex items-center justify-end gap-2">
              {editingNoteId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingNoteId(null);
                    setNoteTitle('');
                    setNoteContent('');
                  }}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              )}
              <button
                type="submit"
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {editingNoteId
                    ? lang === 'ar'
                      ? 'حفظ تعديل الملاحظة'
                      : 'Update Note'
                    : lang === 'ar'
                    ? 'إضافة ملاحظة عمل'
                    : 'Add Work Note'}
                </span>
              </button>
            </div>
          </form>

          {/* Search in Daily Notes */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
            <input
              type="text"
              value={noteSearchQuery}
              onChange={(e) => setNoteSearchQuery(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'ابحث في ملاحظات العمل اليومية...'
                  : 'Search daily work notes...'
              }
              aria-label={lang === 'ar' ? 'بحث في الملاحظات اليومية' : 'Search daily notes'}
              className="w-full min-h-[44px] ps-10 pe-4 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          </div>

          {/* Saved Notes List */}
          <div className="space-y-3">
            {sortedNotes.map((n) => (
              <div
                key={n.id}
                className={`p-4 rounded-2xl border transition-colors ${
                  n.isCompleted
                    ? 'bg-slate-50 border-slate-200 opacity-80'
                    : n.isPinned
                    ? 'bg-amber-50/40 border-amber-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onSaveNote({ ...n, isCompleted: !n.isCompleted })
                        }
                        aria-label={
                          lang === 'ar'
                            ? `تحديد الملاحظة كمكتملة ${n.title}`
                            : `Mark note completed ${n.title}`
                        }
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center cursor-pointer ${
                          n.isCompleted
                            ? 'bg-[#1E824C] border-[#1E824C] text-white'
                            : 'bg-white border-slate-300 text-transparent'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <h3
                        className={`text-sm font-extrabold ${
                          n.isCompleted
                            ? 'line-through text-slate-400'
                            : 'text-[#0B3B68]'
                        }`}
                      >
                        {n.title}
                      </h3>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-700">
                        <span>{getDayName(n.date, lang)}</span>
                        <span dir="ltr" className="font-mono tabular-nums">
                          {n.date}
                        </span>
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed ps-8">
                      {n.content}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNoteId(n.id);
                        setNoteTitle(n.title);
                        setNoteContent(n.content);
                        setNotePinned(n.isPinned);
                      }}
                      aria-label={lang === 'ar' ? `تعديل ملاحظة ${n.title}` : `Edit note ${n.title}`}
                      className="min-h-[38px] min-w-[38px] rounded-xl border border-slate-200 bg-white text-[#0B3B68] hover:bg-slate-50 flex items-center justify-center cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTargetNote(n)}
                      aria-label={lang === 'ar' ? `حذف ملاحظة ${n.title}` : `Delete note ${n.title}`}
                      className="min-h-[38px] min-w-[38px] rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Automatic Daily & Weekly Operational Digest (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base sm:text-lg font-extrabold text-[#0B3B68]">
              {lang === 'ar'
                ? 'ملخص الترحيل التلقائي بين الصفحات'
                : 'Live Cross-Page Synchronization Digest'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === 'ar'
                ? 'تتحدث هذه الأرقام لحظياً عند أي إضافة في الصيانة أو المالية أو بوابة الزبائن'
                : 'Updates live whenever Maintenance, Finance, or Customer Portal changes'}
            </p>
          </div>

          <div className="space-y-3 text-xs sm:text-sm">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-700">
                {lang === 'ar' ? 'كاش الصباح المسجل اليوم' : "Today's Morning Cash"}
              </span>
              <span className="font-mono font-extrabold tabular-nums text-[#0B3B68]">
                {formatJod(dailySummary.morningCashJod, lang)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-700">
                {lang === 'ar'
                  ? 'مقبوضات الصيانة اليوم (كاش + شيك + كلك)'
                  : "Today's Maintenance Revenue"}
              </span>
              <span className="font-mono font-extrabold tabular-nums text-[#1E824C]">
                +{formatJod(dailySummary.totalRevenueJod, lang)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-700">
                {lang === 'ar'
                  ? 'مصاريف اليوم (بنزين + سيارة + شراء قطع)'
                  : "Today's Expenses"}
              </span>
              <span className="font-mono font-extrabold tabular-nums text-rose-600">
                -{formatJod(dailySummary.totalExpensesJod, lang)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 flex items-center justify-between">
              <span className="font-extrabold text-[#0B3B68]">
                {lang === 'ar'
                  ? 'صافي إيرادات الأسبوع الحالي'
                  : 'Current Week Net Profit'}
              </span>
              <span className="font-mono font-extrabold tabular-nums text-[#0B3B68]">
                {formatJod(weeklySummary.netProfitJod, lang)}
              </span>
            </div>
          </div>

          {/* Today's Visits Quick List */}
          <div className="pt-2 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold text-slate-700">
                {lang === 'ar'
                  ? `زيارات ومواعيد اليوم (${todayVisits.length})`
                  : `Today's Visits (${todayVisits.length})`}
              </h4>
              <button
                type="button"
                onClick={() => onNavigate('maintenance')}
                className="text-xs font-bold text-[#155E95] hover:underline cursor-pointer"
              >
                {lang === 'ar' ? 'عرض الكل' : 'View All'}
              </button>
            </div>

            {todayVisits.map((v) => (
              <div
                key={v.id}
                className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-2"
              >
                <div>
                  <div className="text-xs font-extrabold text-[#0B3B68]">
                    {v.customerName}
                  </div>
                  <div className="text-[11px] text-slate-600">{v.problem}</div>
                </div>
                <div className="text-end shrink-0">
                  <div className="text-xs font-mono font-bold tabular-nums text-slate-900">
                    {formatJod(v.amountJod, lang)}
                  </div>
                  <div
                    className={`text-[10px] font-bold ${
                      v.isResolved ? 'text-[#1E824C]' : 'text-[#E58E26]'
                    }`}
                  >
                    {v.isResolved
                      ? lang === 'ar'
                        ? 'تم الحل'
                        : 'Resolved'
                      : lang === 'ar'
                      ? 'قيد المتابعة'
                      : 'Pending'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={!!deleteTargetNote}
        title={lang === 'ar' ? 'تأكيد حذف الملاحظة' : 'Confirm Note Deletion'}
        itemName={deleteTargetNote?.title || ''}
        lang={lang}
        onCancel={() => setDeleteTargetNote(null)}
        onConfirm={() => {
          if (deleteTargetNote) {
            onDeleteNote(deleteTargetNote.id);
            setDeleteTargetNote(null);
          }
        }}
      />
    </div>
  );
};
