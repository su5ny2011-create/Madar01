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
  Clock,
  Wallet,
  Camera,
  Package,
  X,
  Smartphone,
} from 'lucide-react';
import type { AppState, DailyNote, Language, MaintenanceVisit } from '../types';
import {
  calculateCliqAccountMetrics,
  calculateFinancialSummary,
  formatJod,
  getDayName,
  getTodayStr,
} from '../utils/logic';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { WorkNotesScannerModal, type ExtractedWorkData } from './WorkNotesScannerModal';
import { CliqAccountModal } from './CliqAccountModal';

interface DashboardHomeViewProps {
  lang: Language;
  state: AppState;
  currentUserFullName: string;
  onNavigate: (
    tab:
      | 'dashboard'
      | 'maintenance'
      | 'purchases'
      | 'daily_archive'
      | 'finance'
      | 'advanced_finance'
      | 'catalogs'
      | 'schedule'
      | 'stats'
      | 'users'
      | 'backup'
  ) => void;
  onSaveNote: (note: DailyNote) => void;
  onDeleteNote: (id: string) => void;
  onDeleteVisit?: (id: string) => void;
  onSaveVisit?: (visit: MaintenanceVisit) => void;
  canDelete?: boolean;
}

export const DashboardHomeView: React.FC<DashboardHomeViewProps> = ({
  lang,
  state,
  currentUserFullName,
  onNavigate,
  onSaveNote,
  onDeleteNote,
  onDeleteVisit,
  onSaveVisit,
  canDelete = true,
}) => {
  const todayStr = getTodayStr();
  const dailySummary = calculateFinancialSummary(state, 'daily', todayStr);
  const weeklySummary = calculateFinancialSummary(state, 'weekly', todayStr);
  const cashAdvances = state.cashAdvances || [];
  const totalCashAdvancesJod = Number(
    cashAdvances.reduce((sum, a) => sum + (Number(a.amountJod) || 0), 0).toFixed(2)
  );
  const todayCashAdvances = cashAdvances.filter((a) => a.date === todayStr);
  const todayCashAdvancesCount = todayCashAdvances.length;
  const todayCashAdvancesJod = Number(
    todayCashAdvances.reduce((sum, a) => sum + (Number(a.amountJod) || 0), 0).toFixed(2)
  );

  // CliQ Customer Account Metrics (مفصول عن الكاش)
  const cliqMetrics = calculateCliqAccountMetrics(state, todayStr);
  const [isCliqModalOpen, setIsCliqModalOpen] = useState(false);

  // Daily Note Form State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [notePinned, setNotePinned] = useState(true);
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [recentlyAddedNoteId, setRecentlyAddedNoteId] = useState<string | null>(null);
  const [undoBannerMsg, setUndoBannerMsg] = useState<string>('');
  const [deleteTargetNote, setDeleteTargetNote] = useState<DailyNote | null>(
    null
  );
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const portalVisits = state.visits.filter(
    (v) => v.source === 'customer_portal' && !v.isArchived
  );
  const activeMaintenanceRequests = state.visits.filter(
    (v) => !v.isArchived && !v.isResolved && v.status !== 'resolved'
  );
  const todayAppointments = state.appointments.filter((a) => a.date === todayStr);

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() && !noteContent.trim()) return;

    const noteId =
      editingNoteId ||
      `note-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    const isNew = !editingNoteId;

    const record: DailyNote = {
      id: noteId,
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

    if (isNew) {
      setRecentlyAddedNoteId(noteId);
      setUndoBannerMsg(
        lang === 'ar'
          ? `تمت إضافة عمل اليوم «${record.title}» بنجاح. يمكنك التراجع أو إلغاء الإضافة في أي وقت.`
          : `Added daily work note "${record.title}" successfully.`
      );
      setTimeout(() => {
        setRecentlyAddedNoteId(null);
        setUndoBannerMsg('');
      }, 12000);
    }
  };

  const handleScanNotesInsert = (scannedText: string, mode: 'replace' | 'append') => {
    if (mode === 'append' && noteContent.trim()) {
      setNoteContent(`${noteContent.trim()}\n\n${scannedText.trim()}`);
    } else {
      setNoteContent(scannedText.trim());
    }
    if (!noteTitle.trim()) {
      setNoteTitle(
        lang === 'ar'
          ? `ملاحظات ورقة العمل (${todayStr})`
          : `Work Notes Sheet (${todayStr})`
      );
    }
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
      {/* Top Synchronized Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-stretch">
        <button
          type="button"
          onClick={() => onNavigate('maintenance')}
          className="text-start rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:border-[#0B3B68] transition-colors cursor-pointer h-full flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>
                {lang === 'ar' ? 'طلبات الصيانة' : 'Maintenance Requests'}
              </span>
              <Wrench className="w-4 h-4 text-[#0B3B68]" />
            </div>
            <div className="text-3xl font-mono font-extrabold tabular-nums text-[#0B3B68] mt-2">
              {activeMaintenanceRequests.length}
            </div>
          </div>
          <div className="text-xs text-slate-600 mt-2 pt-2 border-t border-slate-100">
            {lang === 'ar'
              ? `قيد المتابعة: ${activeMaintenanceRequests.length} · إجمالي: ${state.visits.length}`
              : `Active: ${activeMaintenanceRequests.length} · Total: ${state.visits.length}`}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            const el = document.getElementById('daily-work-notes-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          className="text-start rounded-2xl bg-amber-50/70 border border-amber-200 p-5 shadow-sm hover:border-[#E58E26] transition-colors cursor-pointer h-full flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-amber-800">
              <span>
                {lang === 'ar'
                  ? 'ملاحظات ومهام العمل'
                  : 'Daily Work Notes & Tasks'}
              </span>
              <ClipboardList className="w-4 h-4 text-[#E58E26]" />
            </div>
            <div className="text-3xl font-mono font-extrabold tabular-nums text-[#E58E26] mt-2">
              {state.dailyNotes.length}
            </div>
          </div>
          <div className="text-xs text-amber-800/80 mt-2 pt-2 border-t border-amber-200/60">
            {lang === 'ar'
              ? `${state.dailyNotes.filter((n) => !n.isCompleted).length} مهام قيد المتابعة · اضغط للملاحظات`
              : `${state.dailyNotes.filter((n) => !n.isCompleted).length} pending tasks · Click to view`}
          </div>
        </button>

        {/* Morning Cash Box + Employee Cash Advances Box Directly Underneath */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => onNavigate('finance')}
            className="text-start rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:border-[#1E824C] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-bold text-slate-500">
              <span>
                {lang === 'ar'
                  ? 'الكاش الصباحي وصافي الدرج (JOD)'
                  : 'Morning Cash & Drawer (JOD)'}
              </span>
              <Banknote className="w-4 h-4 text-[#1E824C]" />
            </div>
            <div className="text-3xl font-mono font-extrabold tabular-nums text-[#1E824C] mt-2">
              {formatJod(dailySummary.netCashDrawerJod, lang)}
            </div>
            <div className="text-xs text-slate-600 font-mono tabular-nums mt-1.5">
              {lang === 'ar'
                ? `كاش الصباح: ${dailySummary.morningCashJod} · كاش الصيانة: +${dailySummary.revenueByMethod.cash}`
                : `Morning: ${dailySummary.morningCashJod} · Cash: +${dailySummary.revenueByMethod.cash}`}
            </div>
          </button>

          {/* Employee Cash Advances Box directly under Morning Cash Box */}
          <button
            type="button"
            onClick={() => onNavigate('users')}
            className="text-start rounded-2xl bg-rose-50/70 border border-rose-200 p-4 shadow-sm hover:border-rose-500 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-extrabold text-rose-800">
              <span>
                {lang === 'ar' ? 'سلف الموظفين (خصم من الكاش)' : 'Employee Cash Advances'}
              </span>
              <Wallet className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-mono font-extrabold tabular-nums text-rose-600 mt-1.5">
              -{formatJod(todayCashAdvancesJod, lang)}
            </div>
            <div className="text-[11px] text-rose-900/80 font-bold mt-1">
              {lang === 'ar'
                ? `سلف اليوم: ${todayCashAdvancesCount} · إجمالي السلف: ${formatJod(totalCashAdvancesJod, lang)}`
                : `Today: ${todayCashAdvancesCount} · Total: ${formatJod(totalCashAdvancesJod, lang)}`}
            </div>
          </button>
        </div>

        {/* Dedicated CliQ Customer Account Box — مربع حساب الزبون كلك */}
        <button
          type="button"
          onClick={() => setIsCliqModalOpen(true)}
          className="text-start rounded-2xl bg-indigo-50/80 border border-indigo-200 p-5 shadow-sm hover:border-indigo-600 transition-colors cursor-pointer h-full flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
              <span>
                {lang === 'ar' ? 'حساب الزبون كلك (CliQ)' : 'CliQ Customer Account'}
              </span>
              <Smartphone className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-3xl font-mono font-extrabold tabular-nums text-indigo-700 mt-2">
              +{formatJod(cliqMetrics.totalBalanceJod, lang)}
            </div>
            <div className="text-xs text-indigo-950 font-bold mt-1.5">
              {lang === 'ar'
                ? `كلك اليوم: +${formatJod(cliqMetrics.todayBalanceJod, lang)} · ${cliqMetrics.totalTransactionsCount} تحويل`
                : `Today: +${formatJod(cliqMetrics.todayBalanceJod, lang)} · ${cliqMetrics.totalTransactionsCount} transfers`}
            </div>
          </div>
          <div className="text-[11px] text-indigo-900/80 mt-2 pt-2 border-t border-indigo-200/70 font-bold flex items-center justify-between">
            <span className="text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded text-[10px] font-black">
              {lang === 'ar' ? 'مفصول عن الكاش' : 'Not in Cash'}
            </span>
            <span className="text-indigo-800 underline font-black">
              {lang === 'ar' ? 'عرض القائمة' : 'View List'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('schedule')}
          className="text-start rounded-2xl bg-white border border-slate-200 p-5 shadow-sm hover:border-[#E58E26] transition-colors cursor-pointer h-full flex flex-col justify-between"
        >
          <div>
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
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 mt-2 pt-2 border-t border-slate-100">
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
          className="text-start rounded-2xl bg-[#0B3B68] text-white p-5 shadow-sm hover:bg-[#155E95] transition-colors cursor-pointer h-full flex flex-col justify-between"
        >
          <div>
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
          </div>
          <div className="text-xs text-amber-300 mt-2 pt-2 border-t border-white/10">
            {lang === 'ar'
              ? `أنواع القطع: ${state.parts.length} · مصاريف: ${state.expenseTemplates.length}`
              : `Parts: ${state.parts.length} · Templates: ${state.expenseTemplates.length}`}
          </div>
        </button>
      </div>

      {/* Quick Touchscreen Action Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
        <button
          type="button"
          onClick={() => setIsCliqModalOpen(true)}
          className="min-h-[52px] px-4 py-3 rounded-2xl bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <Smartphone className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{lang === 'ar' ? 'حساب كلك (CliQ)' : 'CliQ Account'}</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('maintenance')}
          className="min-h-[52px] px-4 py-3 rounded-2xl bg-[#0B3B68] hover:bg-[#155E95] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <Wrench className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{lang === 'ar' ? 'طلبات الصيانة' : 'Maintenance'}</span>
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
          onClick={() => onNavigate('purchases')}
          className="min-h-[52px] px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <Package className="w-4 h-4 shrink-0" />
          <span>{lang === 'ar' ? 'المشتريات وفواتير القطع' : 'Purchases & Parts'}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('advanced_finance')}
          className="min-h-[52px] px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-[#145A32] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <Wallet className="w-4 h-4 text-[#1E824C] shrink-0" />
          <span>
            {lang === 'ar'
              ? 'المالية المتقدمة والإحصائيات'
              : 'Adv. Finance & Stats'}
          </span>
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
          onClick={() => onNavigate('backup')}
          className="min-h-[52px] px-4 py-3 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-[#0B3B68] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <Database className="w-4 h-4 text-[#1E824C] shrink-0" />
          <span>{lang === 'ar' ? 'نسخة احتياطية (تصدير/استيراد)' : 'Backup & Restore'}</span>
        </button>
      </div>

      {/* Main Split: Daily Notes & Work Summary (Left/Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Notes & Work Summary Panel (7 cols) */}
        <div id="daily-work-notes-section" className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E58E26] text-white flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  {lang === 'ar'
                    ? 'ملاحظات ومهام العمل اليومي'
                    : 'Daily Work Summary & Quick Notes'}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs shrink-0"
            >
              <Camera className="w-4 h-4 text-[#E58E26] shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'تصوير ورقة ملاحظات العمل وإدراجها كتابياً'
                  : 'Scan Work Notes Paper (OCR)'}
              </span>
            </button>
          </div>

          {/* Undo / Cancellation Banner */}
          {undoBannerMsg && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex flex-wrap items-center justify-between gap-3 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-[#1E824C] shrink-0" />
                <span className="font-extrabold text-xs sm:text-sm">{undoBannerMsg}</span>
              </div>
              <div className="flex items-center gap-2">
                {recentlyAddedNoteId && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteNote(recentlyAddedNoteId);
                      setRecentlyAddedNoteId(null);
                      setUndoBannerMsg(
                        lang === 'ar'
                          ? 'تم إلغاء العمل والتراجع عن الإضافة بنجاح.'
                          : 'Work cancelled and undone successfully.'
                      );
                      setTimeout(() => setUndoBannerMsg(''), 4000);
                    }}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'إلغاء العمل اليوم (تراجع)' : 'Undo Added Work'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setUndoBannerMsg('');
                    setRecentlyAddedNoteId(null);
                  }}
                  className="text-amber-800 hover:text-amber-950 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

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
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTargetNote(n)}
                        aria-label={lang === 'ar' ? `حذف أو إلغاء ملاحظة ${n.title}` : `Delete or cancel note ${n.title}`}
                        className="min-h-[38px] px-2.5 py-1 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center gap-1 cursor-pointer text-xs font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'إلغاء' : 'Delete'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Automatic Daily & Weekly Operational Digest (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="pb-2.5 border-b border-slate-100">
            <h3 className="text-base sm:text-lg font-extrabold text-[#0B3B68]">
              {lang === 'ar'
                ? 'ملخص العمليات اليومية'
                : 'Live Operational Summary'}
            </h3>
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

            {/* Employee Cash Advances Box directly under Morning Cash */}
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-extrabold text-rose-900">
                    {lang === 'ar' ? 'سلف الموظفين (خصم من الكاش)' : 'Employee Cash Advances'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('users')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 hover:bg-rose-100 text-rose-800 text-[11px] font-extrabold transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'تسجيل / إدارة السلف' : 'Manage Advances'}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-rose-200/70">
                <span className="text-xs font-bold text-rose-800">
                  {lang === 'ar' ? 'سلف الموظفين المسجلة اليوم' : "Today's Employee Advances"}
                </span>
                <span className="font-mono font-extrabold tabular-nums text-rose-600">
                  -{formatJod(todayCashAdvancesJod, lang)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">
                  {lang === 'ar' ? 'إجمالي سلف الموظفين المسجلة' : 'Total Recorded Advances'}
                </span>
                <span className="font-mono font-extrabold tabular-nums text-rose-700">
                  -{formatJod(totalCashAdvancesJod, lang)}
                </span>
              </div>

              {cashAdvances.length > 0 ? (
                <div className="pt-2 border-t border-rose-200/70 space-y-1.5">
                  {cashAdvances.slice(0, 4).map((adv) => (
                    <div
                      key={adv.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/90 border border-rose-100 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-extrabold text-slate-900">
                          {adv.userFullName}
                        </span>
                        <span className="text-slate-500 mx-1">·</span>
                        <span className="text-slate-600 truncate">
                          {adv.note || adv.date}
                        </span>
                      </div>
                      <span className="font-mono font-extrabold tabular-nums text-rose-600 shrink-0">
                        -{formatJod(adv.amountJod, lang)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] font-bold text-slate-500 pt-1">
                  {lang === 'ar'
                    ? 'لا توجد سلف موظفين مسجلة حالياً.'
                    : 'No employee cash advances recorded yet.'}
                </div>
              )}
            </div>

            {/* Dedicated CliQ Customer Account Row in Digest */}
            <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <span className="font-extrabold text-indigo-950 block text-xs">
                    {lang === 'ar' ? 'حساب الزبون كلك (مفصول عن الكاش)' : 'CliQ Customer Account'}
                  </span>
                  <span className="text-[10px] text-indigo-800/80 block font-bold">
                    {lang === 'ar'
                      ? `إجمالي الرصيد: ${formatJod(cliqMetrics.totalBalanceJod, lang)}`
                      : `Total: ${formatJod(cliqMetrics.totalBalanceJod, lang)}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-extrabold tabular-nums text-indigo-700">
                  +{formatJod(cliqMetrics.todayBalanceJod, lang)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsCliqModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-900 hover:bg-indigo-950 text-white text-[11px] font-black cursor-pointer shadow-2xs transition-colors"
                >
                  {lang === 'ar' ? 'عرض القائمة' : 'View'}
                </button>
              </div>
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

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
              <span className="font-extrabold text-[#145A32]">
                {lang === 'ar'
                  ? 'صافي أرباح اليوم (المقبوضات - المصاريف)'
                  : "Today's Net Profit"}
              </span>
              <span className="font-mono font-extrabold tabular-nums text-[#1E824C]">
                {dailySummary.netProfitJod >= 0 ? '+' : ''}
                {formatJod(dailySummary.netProfitJod, lang)}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 flex items-center justify-between">
              <span className="font-extrabold text-[#0B3B68]">
                {lang === 'ar'
                  ? 'صافي الكاش الفعلي في الدرج (بعد السلف والمصاريف)'
                  : 'Net Cash Drawer (After Advances & Expenses)'}
              </span>
              <span className="font-mono font-extrabold tabular-nums text-[#0B3B68]">
                {formatJod(dailySummary.netCashDrawerJod, lang)}
              </span>
            </div>
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

      {/* Embedded Work Notes OCR Scanner Modal */}
      <WorkNotesScannerModal
        lang={lang}
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onInsertNotes={handleScanNotesInsert}
        currentNotes={noteContent}
        titleCustom={
          lang === 'ar'
            ? 'تصوير ورقة ملاحظات العمل وإدراجها في العمل اليومي'
            : 'Scan Work Notes Sheet to Daily Log'
        }
      />

      {/* CliQ Customer Account Modal */}
      <CliqAccountModal
        isOpen={isCliqModalOpen}
        onClose={() => setIsCliqModalOpen(false)}
        lang={lang}
        state={state}
        onSaveVisit={onSaveVisit}
        onDeleteVisit={onDeleteVisit}
        currentUserFullName={currentUserFullName}
        canDelete={canDelete}
      />
    </div>
  );
};
