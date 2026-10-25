import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileJson,
  RefreshCw,
  Upload,
  AlertTriangle,
  Cloud,
  Search,
  Trash2,
  FileSpreadsheet,
  LogOut,
  FolderOpen,
  ShieldCheck,
} from 'lucide-react';
import type { AppState, Language } from '../types';
import {
  calculateFinancialSummary,
  exportBackupJson,
  generateCsvContent,
  getDayName,
  getTodayStr,
  mergeBackupState,
  validateAndParseBackupJson,
} from '../utils/logic';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  listDriveFiles,
  uploadBackupToDrive,
  downloadDriveFileText,
  deleteDriveFile,
  type DriveFileItem,
} from '../utils/googleDrive';

interface BackupRestoreViewProps {
  lang: Language;
  state: AppState;
  onRestoreState: (nextState: AppState, isFullReplace?: boolean) => void;
  onResetAllData?: () => void;
  canDelete?: boolean;
}

export const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({
  lang,
  state,
  onRestoreState,
  onResetAllData,
  canDelete = true,
}) => {
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [rawJsonInput, setRawJsonInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingReplaceState, setPendingReplaceState] =
    useState<AppState | null>(null);
  const [isConfirmResetAllOpen, setIsConfirmResetAllOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Google Drive Auth & Files State (Privacy mode: no personal email/name stored or shown)
  const [needsAuth, setNeedsAuth] = useState(true);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveSearchQuery, setDriveSearchQuery] = useState('');

  // Mandatory User Confirmation Modals for Mutating/Destructive Google Drive Operations
  const [pendingDriveDelete, setPendingDriveDelete] =
    useState<DriveFileItem | null>(null);
  const [pendingDriveOverwrite, setPendingDriveOverwrite] =
    useState<DriveFileItem | null>(null);

  const loadDriveFilesList = useCallback(
    async (token: string, query?: string) => {
      setIsDriveLoading(true);
      setErrorMessage('');
      try {
        const files = await listDriveFiles(token, query);
        setDriveFiles(files);
      } catch (err) {
        console.error('Failed to list Google Drive files:', err);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : lang === 'ar'
            ? 'تعذر جلب الملفات من Google Drive.'
            : 'Failed to load files from Google Drive.'
        );
      } finally {
        setIsDriveLoading(false);
      }
    },
    [lang]
  );

  useEffect(() => {
    const unsubscribe = initAuth(
      (_user, token) => {
        setDriveToken(token);
        setNeedsAuth(false);
        loadDriveFilesList(token);
      },
      () => {
        setDriveToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, [loadDriveFilesList]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const result = await googleSignIn();
      if (result) {
        setDriveToken(result.accessToken);
        setNeedsAuth(false);
        setStatusMessage(
          lang === 'ar'
            ? 'تم ربط Google Drive بنجاح (وضع الخصوصية مفعل — لا يتم إظهار أي معلومات أو ملفات شخصية).'
            : 'Connected to Google Drive (Privacy mode active — no personal info or files shown).'
        );
        await loadDriveFilesList(result.accessToken, driveSearchQuery);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : lang === 'ar'
          ? 'فشل تسجيل الدخول عبر Google.'
          : 'Google Sign-In failed.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setDriveToken(null);
    setDriveFiles([]);
    setNeedsAuth(true);
    setStatusMessage(
      lang === 'ar'
        ? 'تم تسجيل الخروج من Google Drive.'
        : 'Signed out of Google Drive.'
    );
  };

  const handleUploadNewBackupToDrive = async () => {
    if (!driveToken) {
      setNeedsAuth(true);
      return;
    }
    setIsDriveLoading(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const fileName = `AlMadar_Backup_${getTodayStr()}.json`;
      const jsonContent = exportBackupJson(state);
      const uploaded = await uploadBackupToDrive(
        driveToken,
        fileName,
        jsonContent,
        undefined,
        'application/json'
      );
      setStatusMessage(
        lang === 'ar'
          ? `تم حفظ النسخة الاحتياطية على Google Drive باسم: ${uploaded.name}`
          : `Backup saved to Google Drive as: ${uploaded.name}`
      );
      await loadDriveFilesList(driveToken, driveSearchQuery);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : lang === 'ar'
          ? 'فشل رفع النسخة الاحتياطية إلى Google Drive.'
          : 'Failed to upload backup to Google Drive.'
      );
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleUploadCsvReportToDrive = async () => {
    if (!driveToken) {
      setNeedsAuth(true);
      return;
    }
    setIsDriveLoading(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const fileName = `AlMadar_Report_${getTodayStr()}.csv`;
      const summary = calculateFinancialSummary(state, 'all', getTodayStr());
      const csvContent = generateCsvContent(state, summary, lang);
      const uploaded = await uploadBackupToDrive(
        driveToken,
        fileName,
        csvContent,
        undefined,
        'text/csv'
      );
      setStatusMessage(
        lang === 'ar'
          ? `تم حفظ تقرير الإحصاءات والمالية (CSV) على Google Drive باسم: ${uploaded.name}`
          : `CSV Report uploaded to Google Drive as: ${uploaded.name}`
      );
      await loadDriveFilesList(driveToken, driveSearchQuery);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : lang === 'ar'
          ? 'فشل رفع التقرير إلى Google Drive.'
          : 'Failed to upload CSV report to Google Drive.'
      );
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleConfirmOverwriteDriveFile = async () => {
    if (!driveToken || !pendingDriveOverwrite) return;
    const targetFile = pendingDriveOverwrite;
    setPendingDriveOverwrite(null);
    setIsDriveLoading(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const jsonContent = exportBackupJson(state);
      const updated = await uploadBackupToDrive(
        driveToken,
        targetFile.name,
        jsonContent,
        targetFile.id,
        'application/json'
      );
      setStatusMessage(
        lang === 'ar'
          ? `تم تحديث ملف النسخة الاحتياطية على Google Drive: ${updated.name}`
          : `Updated backup file on Google Drive: ${updated.name}`
      );
      await loadDriveFilesList(driveToken, driveSearchQuery);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : lang === 'ar'
          ? 'فشل تحديث الملف على Google Drive.'
          : 'Failed to update file on Google Drive.'
      );
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleConfirmDeleteDriveFile = async () => {
    if (!driveToken || !pendingDriveDelete) return;
    const targetFile = pendingDriveDelete;
    setPendingDriveDelete(null);
    setIsDriveLoading(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      await deleteDriveFile(driveToken, targetFile.id);
      setStatusMessage(
        lang === 'ar'
          ? `تم حذف الملف "${targetFile.name}" من Google Drive بنجاح.`
          : `Deleted "${targetFile.name}" from Google Drive.`
      );
      await loadDriveFilesList(driveToken, driveSearchQuery);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : lang === 'ar'
          ? 'فشل حذف الملف من Google Drive.'
          : 'Failed to delete file from Google Drive.'
      );
    } finally {
      setIsDriveLoading(false);
    }
  };

  const handleRestoreFromDriveFile = async (file: DriveFileItem) => {
    if (!driveToken) {
      setNeedsAuth(true);
      return;
    }
    setIsDriveLoading(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const text = await downloadDriveFileText(driveToken, file.id);
      const parsed = validateAndParseBackupJson(text);
      applyValidatedState(parsed);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : lang === 'ar'
          ? `تعذر استعادة البيانات من الملف "${file.name}". تأكد أنه ملف نسخة احتياطية صالح.`
          : `Failed to restore from "${file.name}". Make sure it is a valid backup JSON file.`
      );
    } finally {
      setIsDriveLoading(false);
    }
  };

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
                ? 'النسخ الاحتياطي وربط Google Drive'
                : 'System Backup & Google Drive Sync'}
            </h2>
          </div>
        </div>

        {canDelete && onResetAllData && (
          <button
            type="button"
            onClick={() => setIsConfirmResetAllOpen(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer shrink-0"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>
              {lang === 'ar'
                ? 'تفريغ كافة المعلومات والبدء من جديد'
                : 'Clear All Data & Start Fresh'}
            </span>
          </button>
        )}
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

      {/* GOOGLE DRIVE CLOUD SYNC & FILE MANAGER SECTION */}
      <div className="rounded-2xl bg-white border-2 border-[#0B3B68]/20 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-200 text-[#0B3B68] flex items-center justify-center shrink-0">
              <Cloud className="w-6 h-6 text-[#155E95]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-[#0B3B68]">
                {lang === 'ar'
                  ? 'التخزين السحابي عبر Google Drive'
                  : 'Google Drive Cloud Backup'}
              </h3>
            </div>
          </div>

          {/* Official Sign in with Google Button or Connected Status */}
          {needsAuth || !driveToken ? (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="gsi-material-button min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2.5 shadow-2xs transition-colors cursor-pointer shrink-0"
            >
              <div className="gsi-material-button-icon w-5 h-5 shrink-0">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  style={{ display: 'block', width: '100%', height: '100%' }}
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  ></path>
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  ></path>
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  ></path>
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  ></path>
                  <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
              </div>
              <span className="gsi-material-button-contents">
                {isLoggingIn
                  ? lang === 'ar'
                    ? 'جاري الاتصال بـ Google...'
                    : 'Signing in...'
                  : lang === 'ar'
                  ? 'Sign in with Google · ربط Google Drive'
                  : 'Sign in with Google'}
              </span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-[#145A32] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#1E824C]" />
                <span>
                  {lang === 'ar'
                    ? 'متصل بـ Google Drive (وضع الخصوصية — بدون معلومات شخصية)'
                    : 'Google Drive Connected (Privacy Mode)'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleGoogleLogout}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'فصل الحساب' : 'Disconnect'}</span>
              </button>
            </div>
          )}
        </div>

        {!needsAuth && driveToken && (
          <div className="space-y-5">
            {/* Cloud Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                disabled={isDriveLoading}
                onClick={handleUploadNewBackupToDrive}
                className="min-h-[48px] px-4 py-3 rounded-xl bg-[#1E824C] hover:bg-[#145A32] disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
              >
                <Cloud className="w-4 h-4 shrink-0" />
                <span>
                  {lang === 'ar'
                    ? 'حفظ نسخة احتياطية جديدة على Drive (.json)'
                    : 'Save New Backup to Drive (.json)'}
                </span>
              </button>

              <button
                type="button"
                disabled={isDriveLoading}
                onClick={handleUploadCsvReportToDrive}
                className="min-h-[48px] px-4 py-3 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>
                  {lang === 'ar'
                    ? 'رفع تقرير المالية والصيانة إلى Drive (.csv)'
                    : 'Upload Financial & Visits CSV to Drive'}
                </span>
              </button>

              <button
                type="button"
                disabled={isDriveLoading}
                onClick={() => loadDriveFilesList(driveToken, driveSearchQuery)}
                className="min-h-[48px] px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-[#0B3B68] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw
                  className={`w-4 h-4 shrink-0 ${isDriveLoading ? 'animate-spin' : ''}`}
                />
                <span>
                  {lang === 'ar' ? 'تحديث قائمة ملفات Drive' : 'Refresh Drive Files'}
                </span>
              </button>
            </div>

            {/* Search bar for Drive files */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-[#E58E26]" />
                <span>
                  {lang === 'ar'
                    ? `ملفات نسخ النظام في Google Drive (${driveFiles.length})`
                    : `System Backup Files in Google Drive (${driveFiles.length})`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
                  <input
                    type="text"
                    value={driveSearchQuery}
                    onChange={(e) => setDriveSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        loadDriveFilesList(driveToken, driveSearchQuery);
                      }
                    }}
                    placeholder={
                      lang === 'ar'
                        ? 'بحث في ملفات Google Drive...'
                        : 'Search Drive files...'
                    }
                    className="w-full min-h-[40px] ps-9 pe-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => loadDriveFilesList(driveToken, driveSearchQuery)}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#0B3B68] text-white text-xs font-bold cursor-pointer"
                >
                  {lang === 'ar' ? 'بحث' : 'Search'}
                </button>
              </div>
            </div>

            {/* Drive Files List */}
            <div className="rounded-2xl border border-slate-200 divide-y divide-slate-200 max-h-80 overflow-y-auto bg-slate-50/40">
              {isDriveLoading && driveFiles.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  {lang === 'ar'
                    ? 'جاري تحميل الملفات من Google Drive...'
                    : 'Loading files from Google Drive...'}
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  {lang === 'ar'
                    ? 'لا توجد ملفات مطابقة في Google Drive. اضغط على «حفظ نسخة احتياطية جديدة على Drive» أعلاه لإنشاء أول نسخة.'
                    : 'No matching files in Google Drive. Click "Save New Backup to Drive" above.'}
                </div>
              ) : (
                driveFiles.map((file) => {
                  const isJson =
                    file.name.toLowerCase().endsWith('.json') ||
                    file.mimeType === 'application/json';
                  const modDateStr = file.modifiedTime
                    ? file.modifiedTime.slice(0, 10)
                    : '';

                  return (
                    <div
                      key={file.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            dir="ltr"
                            className="text-xs sm:text-sm font-extrabold text-[#0B3B68] truncate"
                          >
                            {file.name}
                          </span>
                          {isJson && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-[#1E824C] border border-emerald-200 text-[11px] font-bold">
                              {lang === 'ar' ? 'ملف نسخة احتياطية JSON' : 'JSON Backup'}
                            </span>
                          )}
                        </div>
                        {modDateStr && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <span>{getDayName(modDateStr, lang)}</span>
                            <span dir="ltr" className="font-mono">
                              {modDateStr}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {isJson && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleRestoreFromDriveFile(file)}
                              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>
                                {lang === 'ar'
                                  ? 'استعادة للنظام'
                                  : 'Restore to App'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPendingDriveOverwrite(file)}
                              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-[#0B3B68] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>
                                {lang === 'ar'
                                  ? 'تحديث بالبيانات الحالية'
                                  : 'Update File'}
                              </span>
                            </button>
                          </>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setPendingDriveDelete(file)}
                            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'حذف من Drive' : 'Delete'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

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
            {lang === 'ar'
              ? 'المشتريات والقطع والمواعيد'
              : 'Purchases, Parts & Calendar'}
          </div>
          <div className="text-2xl font-mono font-extrabold tabular-nums text-slate-900 mt-1">
            {(state.purchases || []).length +
              state.appointments.length +
              state.parts.length +
              state.dailyNotes.length}
          </div>
        </div>
      </div>

      {/* Main Split: Local Export vs Local Import */}
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
                    ? 'تصدير نسخة احتياطية محلية (Export Backup)'
                    : 'Export Local System Backup'}
                </h3>
              </div>
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
            </div>
          </div>

          {/* Import Mode Selector: Smart Merge vs Full Replace */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 block">
              {lang === 'ar' ? 'طريقة الاستيراد (تطبق أيضاً عند الاستعادة من Google Drive):' : 'Import Mode (also applies to Google Drive restore):'}
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

      {/* Factory Reset / Clear All Added Data Card */}
      {canDelete && onResetAllData && (
        <div className="rounded-2xl bg-rose-50/70 border-2 border-rose-200 p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-rose-950">
                {lang === 'ar'
                  ? 'تفريغ كافة البيانات والبدء من جديد'
                  : 'Clear All Added Records & Start Fresh'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsConfirmResetAllOpen(true)}
            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer shrink-0"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>
              {lang === 'ar'
                ? 'تفريغ البيانات والبدء من جديد'
                : 'Reset & Clear All Data'}
            </span>
          </button>
        </div>
      )}

      {/* Confirmation Modal for Overwriting a File on Google Drive (Mandatory User Confirmation) */}
      {pendingDriveOverwrite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-drive-overwrite-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-[#E58E26] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3
                  id="confirm-drive-overwrite-title"
                  className="text-base font-extrabold text-slate-900"
                >
                  {lang === 'ar'
                    ? 'تأكيد تحديث واستبدال الملف في Google Drive'
                    : 'Confirm Overwriting File in Google Drive'}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  {lang === 'ar'
                    ? `هل أنت متأكد من تحديث محتويات الملف "${pendingDriveOverwrite.name}" في Google Drive بالبيانات الحالية للنظام؟`
                    : `Are you sure you want to update the contents of "${pendingDriveOverwrite.name}" in Google Drive with the current system data?`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingDriveOverwrite(null)}
                className="min-h-[44px] rounded-xl border border-slate-300 text-slate-700 font-bold text-sm cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmOverwriteDriveFile}
                className="min-h-[44px] rounded-xl bg-[#0B3B68] text-white font-bold text-sm cursor-pointer"
              >
                {lang === 'ar' ? 'تأكيد التحديث' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting a File from Google Drive (Mandatory User Confirmation) */}
      {pendingDriveDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-drive-delete-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3
                  id="confirm-drive-delete-title"
                  className="text-base font-extrabold text-slate-900"
                >
                  {lang === 'ar'
                    ? 'تأكيد حذف الملف من Google Drive'
                    : 'Confirm Deleting File from Google Drive'}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  {lang === 'ar'
                    ? `هل أنت متأكد من حذف الملف "${pendingDriveDelete.name}" نهائياً من حساب Google Drive الخاص بك؟ لا يمكن التراجع عن هذا الإجراء.`
                    : `Are you sure you want to permanently delete "${pendingDriveDelete.name}" from your Google Drive? This action cannot be undone.`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingDriveDelete(null)}
                className="min-h-[44px] rounded-xl border border-slate-300 text-slate-700 font-bold text-sm cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDriveFile}
                className="min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm cursor-pointer"
              >
                {lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  onRestoreState(pendingReplaceState, true);
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

      {/* Confirmation Modal for Clearing All System Data & Starting Fresh */}
      {isConfirmResetAllOpen && onResetAllData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-reset-all-data-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border-2 border-rose-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3
                  id="confirm-reset-all-data-title"
                  className="text-base font-extrabold text-slate-900"
                >
                  {lang === 'ar'
                    ? 'تأكيد تفريغ كافة معلومات البرنامج والبدء من جديد'
                    : 'Confirm Clearing All System Data'}
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {lang === 'ar'
                    ? 'هل أنت متأكد من رغبتك في مسح كافة الزيارات والزبائن والمشتريات والبيانات المالية والمواعيد للعمل على البرنامج بشكل جديد؟ سيتم الاحتفاظ بحسابات تسجيل الدخول فقط.'
                    : 'Are you sure you want to clear all visits, customers, purchases, finance records, and appointments to start fresh? Only user login accounts will be preserved.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmResetAllOpen(false)}
                className="min-h-[44px] rounded-xl border border-slate-300 text-slate-700 font-bold text-sm cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetAllData();
                  setIsConfirmResetAllOpen(false);
                  setStatusMessage(
                    lang === 'ar'
                      ? 'تم تفريغ كافة المعلومات المضافة في البرنامج بنجاح! النظام جاهز للعمل عليه بشكل جديد.'
                      : 'All added system records have been cleared! The system is ready for a fresh start.'
                  );
                }}
                className="min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm cursor-pointer"
              >
                {lang === 'ar' ? 'نعم، تفريغ الكل' : 'Yes, Clear All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
