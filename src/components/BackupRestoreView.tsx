import React, { useState, useRef } from 'react';
import {
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileJson,
  RefreshCw,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import type { AppState, Language } from '../types';
import {
  exportBackupJson,
  getTodayStr,
  mergeBackupState,
  validateAndParseBackupJson,
} from '../utils/logic';

interface BackupRestoreViewProps {
  lang: Language;
  state: AppState;
  onRestoreState: (nextState: AppState) => void;
}

export const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({
  lang,
  state,
  onRestoreState,
}) => {
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [rawJsonInput, setRawJsonInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingReplaceState, setPendingReplaceState] =
    useState<AppState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDownloadBackup = () => {
    setErrorMessage('');
    const jsonString = exportBackupJson(state);
    const blob = new Blob([jsonString], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AlMadar_Backup_${getTodayStr()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatusMessage(
      lang === 'ar'
        ? 'تم تصدير وتحميل ملف النسخة الاحتياطية الكاملة (.json) بنجاح!'
        : 'Full backup file (.json) exported and downloaded successfully!'
    );
  };

  const handleCopyBackupToClipboard = async () => {
    setErrorMessage('');
    const jsonString = exportBackupJson(state);
    try {
      await navigator.clipboard.writeText(jsonString);
      setStatusMessage(
        lang === 'ar'
          ? 'تم نسخ بيانات النسخة الاحتياطية إلى الحافظة بنجاح.'
          : 'Backup JSON copied to clipboard successfully.'
      );
    } catch {
      setRawJsonInput(jsonString);
      setStatusMessage(
        lang === 'ar'
          ? 'تم عرض نص النسخة الاحتياطية في مربع النص أدناه.'
          : 'Backup JSON populated in the text box below.'
      );
    }
  };

  const applyValidatedState = (parsedState: AppState) => {
    if (importMode === 'replace') {
      setPendingReplaceState(parsedState);
      return;
    }
    const merged = mergeBackupState(state, parsedState);
    onRestoreState(merged);
    setRawJsonInput('');
    setStatusMessage(
      lang === 'ar'
        ? `تم استيراد ودمج النسخة الاحتياطية بنجاح! (إجمالي الزيارات: ${merged.visits.length}، الزبائن: ${merged.customers.length})`
        : `Backup imported and merged successfully! (Total Visits: ${merged.visits.length}, Customers: ${merged.customers.length})`
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage('');
    setStatusMessage('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '');
        const parsed = validateAndParseBackupJson(text);
        applyValidatedState(parsed);
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : lang === 'ar'
            ? 'فشل قراءة ملف النسخة الاحتياطية.'
            : 'Failed to parse backup file.'
        );
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleImportFromText = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');
    try {
      const parsed = validateAndParseBackupJson(rawJsonInput);
      applyValidatedState(parsed);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : lang === 'ar'
          ? 'بيانات النسخة الاحتياطية غير صالحة.'
          : 'Invalid backup JSON.'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0B3B68] text-white flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#0B3B68]">
              {lang === 'ar'
                ? 'النسخ الاحتياطي — تصدير واستيراد جميع بيانات النظام'
                : 'System Backup — Export & Import Database'}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'ar'
                ? 'حفظ نسخة احتياطية كاملة (طلبات الصيانة، المالية، الزبائن، القطع، المواعيد، المستخدمين) أو استعادتها في أي وقت'
                : 'Export full system data (.json) or restore/merge from an existing backup file'}
            </p>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs sm:text-sm font-bold flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-5 h-5 text-[#1E824C] shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-bold flex items-center gap-2.5"
        >
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Database Contents Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold">
            {lang === 'ar' ? 'سجلات الصيانة' : 'Maintenance Visits'}
          </div>
          <div className="text-2xl font-mono font-extrabold tabular-nums text-[#0B3B68] mt-1">
            {state.visits.length}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold">
            {lang === 'ar' ? 'الزبائن والعقود' : 'Customers & Contracts'}
          </div>
          <div className="text-2xl font-mono font-extrabold tabular-nums text-[#1E824C] mt-1">
            {state.customers.length}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold">
            {lang === 'ar' ? 'الحركات المالية والمصاريف' : 'Financial Records'}
          </div>
          <div className="text-2xl font-mono font-extrabold tabular-nums text-[#E58E26] mt-1">
            {state.expenses.length + state.morningCash.length}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold">
            {lang === 'ar' ? 'المواعيد والقطع والملاحظات' : 'Calendar, Parts & Notes'}
          </div>
          <div className="text-2xl font-mono font-extrabold tabular-nums text-slate-900 mt-1">
            {state.appointments.length +
              state.parts.length +
              state.dailyNotes.length}
          </div>
        </div>
      </div>

      {/* Main Split: Export vs Import */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Export Backup Card */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1E824C] text-white flex items-center justify-center shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  {lang === 'ar'
                    ? 'تصدير نسخة احتياطية كاملة (Export Backup)'
                    : 'Export Full System Backup'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'ar'
                    ? 'حفظ ملف JSON يحتوي على كافة البيانات لنقله إلى جهاز آخر أو حفظه للأمان'
                    : 'Download a complete JSON file to transfer across devices or archive safely'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <div className="font-bold text-slate-800">
                {lang === 'ar'
                  ? 'تشمل النسخة الاحتياطية المصدّرة:'
                  : 'Included in exported backup:'}
              </div>
              <p>
                {lang === 'ar'
                  ? '• جميع طلبات وزيارات وعقود الصيانة وحالات الدفع\n• كاش الصباح وسجل المصاريف والتقارير المالية\n• دليل أسماء الزبائن وأنواع القطع والمصاريف الجاهزة\n• جدول المواعيد الأسبوعي والملاحظات وحسابات المستخدمين'
                  : '• All Maintenance Visits, Contracts & Payment Statuses\n• Morning Cash, Expenses & Financial Ledgers\n• Customers, Parts Catalog & Expense Templates\n• Weekly Schedule, Daily Notes & Users'}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-5 h-5 shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'تحميل ملف النسخة الاحتياطية (JSON)'
                  : 'Download Backup File (.json)'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCopyBackupToClipboard}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[#0B3B68] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Copy className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'نسخ نص النسخة الاحتياطية إلى الحافظة'
                  : 'Copy Backup Data to Clipboard'}
              </span>
            </button>
          </div>
        </div>

        {/* 2. Import / Restore Backup Card */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0B3B68] text-white flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                {lang === 'ar'
                  ? 'استيراد واستعادة نسخة احتياطية (Import Backup)'
                  : 'Import & Restore Backup'}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === 'ar'
                  ? 'استعادة البيانات من ملف نسخة احتياطية (.json) أو عبر لصق البيانات مباشرة'
                  : 'Restore data by uploading a .json backup file or pasting backup JSON'}
              </p>
            </div>
          </div>

          {/* Import Mode Selector: Smart Merge vs Full Replace */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 block">
              {lang === 'ar' ? 'طريقة الاستيراد:' : 'Import Mode:'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                  importMode === 'merge'
                    ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ar'
                    ? 'دمج مع البيانات الحالية (آمن)'
                    : 'Smart Merge (Safe)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                  importMode === 'replace'
                    ? 'bg-[#E58E26] text-white border-[#E58E26]'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ar'
                    ? 'استبدال كامل للبيانات'
                    : 'Full Replace'}
                </span>
              </button>
            </div>
          </div>

          {/* Upload File Trigger */}
          <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center space-y-2">
            <input
              ref={fileInputRef}
              id="backup-file-input"
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="backup-file-input"
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'اختيار ملف النسخة الاحتياطية (.json) من الجهاز'
                  : 'Select Backup File (.json) from Device'}
              </span>
            </label>
          </div>

          {/* Paste JSON Fallback Form */}
          <form onSubmit={handleImportFromText} className="space-y-3">
            <label
              htmlFor="backup-json-textarea"
              className="text-xs font-bold text-slate-700 block"
            >
              {lang === 'ar'
                ? 'أو الصق كود النسخة الاحتياطية (JSON) هنا للاستيراد المباشر:'
                : 'Or paste backup JSON text here to import:'}
            </label>
            <textarea
              id="backup-json-textarea"
              rows={3}
              value={rawJsonInput}
              onChange={(e) => setRawJsonInput(e.target.value)}
              placeholder='{"app": "AL-MADAR-IT-SYSTEM", "data": { ... }}'
              className="w-full p-3 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-800"
            />
            <button
              type="submit"
              disabled={!rawJsonInput.trim()}
              className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-[#E58E26] hover:bg-[#d17d1b] disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'استيراد النسخة الاحتياطية من النص'
                  : 'Import Backup from Text'}
              </span>
            </button>
          </form>
        </div>
      </div>

      {/* Confirmation Modal for Full Replace Restore */}
      {pendingReplaceState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-replace-backup-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-[#E58E26] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3
                  id="confirm-replace-backup-title"
                  className="text-base font-extrabold text-slate-900"
                >
                  {lang === 'ar'
                    ? 'تأكيد استبدال البيانات بالنسخة الاحتياطية'
                    : 'Confirm Full Database Replacement'}
                </h3>
                <p className="text-xs text-slate-500">
                  {lang === 'ar'
                    ? `سيتم استبدال البيانات الحالية بالنسخة المستوردة (${pendingReplaceState.visits.length} زيارة صيانة، ${pendingReplaceState.customers.length} زبون).`
                    : `Current data will be replaced with the backup (${pendingReplaceState.visits.length} visits, ${pendingReplaceState.customers.length} customers).`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingReplaceState(null)}
                className="min-h-[44px] rounded-xl border border-slate-300 text-slate-700 font-bold text-sm cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onRestoreState(pendingReplaceState);
                  setPendingReplaceState(null);
                  setRawJsonInput('');
                  setStatusMessage(
                    lang === 'ar'
                      ? 'تمت استعادة النسخة الاحتياطية الكاملة بنجاح!'
                      : 'Full backup restored successfully!'
                  );
                }}
                className="min-h-[44px] rounded-xl bg-[#0B3B68] text-white font-bold text-sm cursor-pointer"
              >
                {lang === 'ar' ? 'تأكيد الاستعادة' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
