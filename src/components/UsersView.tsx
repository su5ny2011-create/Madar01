import React, { useState, useMemo, useRef } from 'react';
import {
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Filter,
  KeyRound,
  MinusCircle,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import type {
  AppState,
  CashAdvanceRecord,
  Language,
  User,
  UserRole,
} from '../types';
import { isUserAdmin } from '../types';
import {
  calculateFinancialSummary,
  formatJod,
  getDayName,
  getTodayStr,
} from '../utils/logic';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface UsersViewProps {
  lang: Language;
  users: User[];
  currentUser: User;
  state: AppState;
  onSaveUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onSaveCashAdvance: (advance: CashAdvanceRecord) => void;
  onDeleteCashAdvance: (advanceId: string) => void;
}

function getCurrentTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;
}

export const UsersView: React.FC<UsersViewProps> = ({
  lang,
  users,
  currentUser,
  state,
  onSaveUser,
  onDeleteUser,
  onSaveCashAdvance,
  onDeleteCashAdvance,
}) => {
  const todayStr = getTodayStr();
  const isManager = isUserAdmin(currentUser);

  // User Management Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('technician');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Quick Change Password Modal
  const [passwordTargetUser, setPasswordTargetUser] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');

  // User Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Cash Advance ("نظام السلف من الكاش") Form & Filter State
  const advanceFormRef = useRef<HTMLFormElement>(null);
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [selectedAdvanceUserId, setSelectedAdvanceUserId] = useState<string>(
    currentUser.id
  );
  const [advanceAmount, setAdvanceAmount] = useState<string>('');
  const [advanceDate, setAdvanceDate] = useState<string>(todayStr);
  const [advanceTime, setAdvanceTime] = useState<string>(() => getCurrentTimeStr());
  const [advanceNote, setAdvanceNote] = useState<string>('');
  const [advanceErrorMsg, setAdvanceErrorMsg] = useState<string>('');
  const [advanceSuccessMsg, setAdvanceSuccessMsg] = useState<string>('');
  const [advanceFilterUserId, setAdvanceFilterUserId] = useState<string>('all');
  const [advanceSearchQuery, setAdvanceSearchQuery] = useState<string>('');
  const [deleteAdvanceTarget, setDeleteAdvanceTarget] =
    useState<CashAdvanceRecord | null>(null);

  // Active daily financial summary to show exact Cash Drawer & Deduction impact
  const activeScopedState: AppState = useMemo(
    () => ({
      ...state,
      morningCash: (state.morningCash || []).filter((m) => !m.isArchived),
      expenses: (state.expenses || []).filter((e) => !e.isArchived),
      visits: (state.visits || []).filter((v) => !v.isFinanceArchived),
    }),
    [state]
  );

  const todayFinancialSummary = useMemo(
    () => calculateFinancialSummary(activeScopedState, 'daily', todayStr),
    [activeScopedState, todayStr]
  );

  const cashAdvances = useMemo(() => {
    const list = state.cashAdvances || [];
    return [...list].sort((a, b) =>
      `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
    );
  }, [state.cashAdvances]);

  const todayAdvancesTotalJod = useMemo(
    () =>
      cashAdvances
        .filter((a) => a.date === todayStr)
        .reduce((sum, a) => sum + (Number(a.amountJod) || 0), 0),
    [cashAdvances, todayStr]
  );

  const allTimeAdvancesTotalJod = useMemo(
    () =>
      cashAdvances.reduce((sum, a) => sum + (Number(a.amountJod) || 0), 0),
    [cashAdvances]
  );

  const cashDrawerBeforeTodayAdvancesJod = useMemo(
    () =>
      Number(
        (
          todayFinancialSummary.netCashDrawerJod + todayAdvancesTotalJod
        ).toFixed(2)
      ),
    [todayFinancialSummary.netCashDrawerJod, todayAdvancesTotalJod]
  );

  // Per-User Cash Advance Statistics (تطبق على كل المستخدمين)
  const userAdvanceStats = useMemo(() => {
    const map = new Map<
      string,
      {
        userId: string;
        count: number;
        todayJod: number;
        totalJod: number;
        lastAdvanceDate?: string;
      }
    >();

    for (const u of users) {
      map.set(u.id, {
        userId: u.id,
        count: 0,
        todayJod: 0,
        totalJod: 0,
      });
    }

    for (const adv of cashAdvances) {
      const matchedUser =
        users.find((u) => u.id === adv.userId) ||
        users.find(
          (u) => u.username.toLowerCase() === (adv.username || '').toLowerCase()
        );
      const key = matchedUser ? matchedUser.id : adv.userId;
      const existing = map.get(key) || {
        userId: key,
        count: 0,
        todayJod: 0,
        totalJod: 0,
      };
      const amt = Number(adv.amountJod) || 0;
      existing.count += 1;
      existing.totalJod = Number((existing.totalJod + amt).toFixed(2));
      if (adv.date === todayStr) {
        existing.todayJod = Number((existing.todayJod + amt).toFixed(2));
      }
      if (
        !existing.lastAdvanceDate ||
        adv.date > existing.lastAdvanceDate
      ) {
        existing.lastAdvanceDate = adv.date;
      }
      map.set(key, existing);
    }

    return map;
  }, [users, cashAdvances, todayStr]);

  const currentUserStats = userAdvanceStats.get(currentUser.id) || {
    userId: currentUser.id,
    count: 0,
    todayJod: 0,
    totalJod: 0,
  };

  const selectedAdvanceUser = useMemo(
    () =>
      users.find((u) => u.id === selectedAdvanceUserId) || currentUser,
    [users, selectedAdvanceUserId, currentUser]
  );

  const filteredAdvances = useMemo(() => {
    const aq = advanceSearchQuery.trim().toLowerCase();
    return cashAdvances.filter((adv) => {
      if (advanceFilterUserId !== 'all') {
        const matchesUser =
          adv.userId === advanceFilterUserId ||
          users
            .find((u) => u.id === advanceFilterUserId)
            ?.username.toLowerCase() === (adv.username || '').toLowerCase();
        if (!matchesUser) return false;
      }
      if (!aq) return true;
      const hay = `${adv.userFullName} ${adv.username} ${adv.note || ''} ${
        adv.date
      } ${adv.amountJod}`.toLowerCase();
      return hay.includes(aq);
    });
  }, [cashAdvances, advanceFilterUserId, advanceSearchQuery, users]);

  // Preview of cash deduction when typing amount
  const parsedInputAmount = useMemo(() => {
    const n = parseFloat(advanceAmount);
    return Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : 0;
  }, [advanceAmount]);

  const previousEditingAmount = useMemo(() => {
    if (!editingAdvanceId) return 0;
    const found = cashAdvances.find((a) => a.id === editingAdvanceId);
    return found && found.date === todayStr ? Number(found.amountJod) || 0 : 0;
  }, [editingAdvanceId, cashAdvances, todayStr]);

  const projectedNetCashDrawerJod = useMemo(() => {
    return Number(
      (
        todayFinancialSummary.netCashDrawerJod +
        previousEditingAmount -
        (advanceDate === todayStr ? parsedInputAmount : 0)
      ).toFixed(2)
    );
  }, [
    todayFinancialSummary.netCashDrawerJod,
    previousEditingAmount,
    advanceDate,
    todayStr,
    parsedInputAmount,
  ]);

  const q = searchQuery.trim().toLowerCase();
  const filteredUsers = users.filter(
    (u) =>
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
  );

  const resetForm = () => {
    setEditingId(null);
    setUsername('');
    setPassword('');
    setFullName('');
    setRole('technician');
    setPhone('');
    setErrorMsg('');
  };

  const resetAdvanceForm = () => {
    setEditingAdvanceId(null);
    setSelectedAdvanceUserId(currentUser.id);
    setAdvanceAmount('');
    setAdvanceDate(todayStr);
    setAdvanceTime(getCurrentTimeStr());
    setAdvanceNote('');
    setAdvanceErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !fullName.trim() || !password.trim()) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى تعبئة اسم المستخدم وكلمة المرور والاسم الكامل.'
          : 'Username, password, and full name are required.'
      );
      return;
    }

    const duplicate = users.find(
      (u) => u.username.toLowerCase() === cleanUsername && u.id !== editingId
    );
    if (duplicate) {
      setErrorMsg(
        lang === 'ar'
          ? 'اسم المستخدم هذا مستخدم بالفعل، يرجى اختيار اسم آخر.'
          : 'This username is already taken.'
      );
      return;
    }

    const record: User = {
      id: editingId || `user-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      username: cleanUsername,
      password: password.trim(),
      fullName: fullName.trim(),
      role,
      phone: phone.trim(),
      active: true,
      createdAt: getTodayStr(),
    };

    onSaveUser(record);
    setSuccessMsg(
      editingId
        ? lang === 'ar'
          ? 'تم تحديث بيانات وصلاحيات المستخدم بنجاح.'
          : 'User details and role updated.'
        : lang === 'ar'
        ? 'تمت إضافة المستخدم الجديد بنجاح.'
        : 'New user added successfully.'
    );
    resetForm();
  };

  const handleAdvanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdvanceErrorMsg('');
    setAdvanceSuccessMsg('');

    const amountVal = parseFloat(advanceAmount);
    if (!Number.isFinite(amountVal) || amountVal <= 0) {
      setAdvanceErrorMsg(
        lang === 'ar'
          ? 'يرجى إدخال مبلغ السلفة المسحوب من الكاش بشكل صحيح (أكبر من صفر).'
          : 'Please enter a valid cash advance amount greater than zero.'
      );
      return;
    }

    const targetUser =
      users.find((u) => u.id === selectedAdvanceUserId) || currentUser;

    const existingAdvance = editingAdvanceId
      ? cashAdvances.find((a) => a.id === editingAdvanceId)
      : undefined;

    const advanceId =
      editingAdvanceId ||
      `adv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const record: CashAdvanceRecord = {
      id: advanceId,
      userId: targetUser.id,
      userFullName: targetUser.fullName,
      username: targetUser.username,
      amountJod: Number(amountVal.toFixed(2)),
      date: advanceDate || todayStr,
      time: advanceTime || getCurrentTimeStr(),
      note: advanceNote.trim(),
      recordedBy: currentUser.fullName,
      linkedExpenseId:
        existingAdvance?.linkedExpenseId || `exp-adv-${advanceId}`,
      createdAt: existingAdvance?.createdAt || new Date().toISOString(),
      updatedAt: Date.now(),
    };

    onSaveCashAdvance(record);
    setAdvanceSuccessMsg(
      editingAdvanceId
        ? lang === 'ar'
          ? `تم تعديل سلفة الكاش للمستخدم (${targetUser.fullName}) وتحديث خصم الكاش بقيمة ${formatJod(
              record.amountJod,
              lang
            )} بنجاح.`
          : `Updated cash advance for ${targetUser.fullName} (${formatJod(
              record.amountJod,
              lang
            )}).`
        : lang === 'ar'
        ? `تم تسجيل سلفة من الكاش للمستخدم (${targetUser.fullName}) وخصم مبلغ (${formatJod(
            record.amountJod,
            lang
          )}) من الكاش بنجاح.`
        : `Recorded cash advance for ${targetUser.fullName} and deducted ${formatJod(
            record.amountJod,
            lang
          )} from cash.`
    );
    resetAdvanceForm();
    setTimeout(() => setAdvanceSuccessMsg(''), 4500);
  };

  const handleEditAdvance = (adv: CashAdvanceRecord) => {
    setEditingAdvanceId(adv.id);
    const matchedUser =
      users.find((u) => u.id === adv.userId) ||
      users.find(
        (u) => u.username.toLowerCase() === (adv.username || '').toLowerCase()
      );
    setSelectedAdvanceUserId(matchedUser ? matchedUser.id : currentUser.id);
    setAdvanceAmount(String(adv.amountJod));
    setAdvanceDate(adv.date || todayStr);
    setAdvanceTime(adv.time || '10:00');
    setAdvanceNote(adv.note || '');
    setAdvanceErrorMsg('');
    advanceFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handlePasswordChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser || !newPasswordInput.trim()) return;
    onSaveUser({
      ...passwordTargetUser,
      password: newPasswordInput.trim(),
    });
    setPasswordTargetUser(null);
    setNewPasswordInput('');
    setSuccessMsg(
      lang === 'ar'
        ? 'تم تغيير كلمة المرور بنجاح.'
        : 'Password changed successfully.'
    );
  };

  const [showAdvancesLog, setShowAdvancesLog] = useState<boolean>(true);
  const amountInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      {/* ===================================================================== */}
      {/* COMPACT CASH ADVANCE BAR (شريط السلف المختصر والسريع من الكاش) */}
      {/* ===================================================================== */}
      <div className="rounded-2xl bg-white border border-slate-200 p-3.5 sm:p-4 shadow-xs space-y-3">
        {/* Compact Header: Title + Logged-in User + Cash Drawer Summary + Log Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#0B3B68] text-white flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-amber-300" />
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-[#0B3B68]">
              {lang === 'ar' ? 'سلف الموظفين من الكاش' : 'Employee Cash Advances'}
            </h3>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#145A32] text-[11px] font-extrabold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {lang === 'ar'
                ? `قيد الدخول: ${currentUser.fullName}`
                : `Logged in: ${currentUser.fullName}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono font-extrabold">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
              {lang === 'ar' ? 'الكاش قبل السلف: ' : 'Before: '}
              <strong className="text-[#0B3B68]">
                {formatJod(cashDrawerBeforeTodayAdvancesJod, lang)}
              </strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
              {lang === 'ar' ? 'سلف اليوم: ' : 'Today: '}
              <strong>-{formatJod(todayAdvancesTotalJod, lang)}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[#145A32]">
              {lang === 'ar' ? 'الكاش المتبقي: ' : 'Remaining: '}
              <strong>{formatJod(todayFinancialSummary.netCashDrawerJod, lang)}</strong>
            </span>
            <button
              type="button"
              onClick={() => setShowAdvancesLog((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#0B3B68] font-sans font-extrabold cursor-pointer"
            >
              {showAdvancesLog
                ? lang === 'ar'
                  ? `إخفاء السجل (${cashAdvances.length})`
                  : `Hide Log (${cashAdvances.length})`
                : lang === 'ar'
                ? `عرض السجل (${cashAdvances.length})`
                : `Show Log (${cashAdvances.length})`}
            </button>
          </div>
        </div>

        {/* Alerts */}
        {advanceErrorMsg && (
          <div
            role="alert"
            className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-between"
          >
            <span>{advanceErrorMsg}</span>
            <button
              type="button"
              onClick={() => setAdvanceErrorMsg('')}
              className="text-rose-600 hover:text-rose-900 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {advanceSuccessMsg && (
          <div
            role="status"
            className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#1E824C] shrink-0" />
              <span>{advanceSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setAdvanceSuccessMsg('')}
              className="text-emerald-700 hover:text-emerald-950 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Single-Row Quick Add / Edit Cash Advance Form */}
        <form
          ref={advanceFormRef}
          onSubmit={handleAdvanceSubmit}
          className={`rounded-xl border p-2.5 sm:p-3 transition-all ${
            editingAdvanceId
              ? 'bg-amber-50/70 border-amber-300'
              : 'bg-slate-50/90 border-slate-200'
          }`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            {/* 1. User Select (3 cols) */}
            <div className="sm:col-span-3">
              <select
                aria-label={lang === 'ar' ? 'الموظف المستفيد من السلفة' : 'Employee'}
                value={selectedAdvanceUser.id}
                onChange={(e) => setSelectedAdvanceUserId(e.target.value)}
                className="w-full h-[38px] px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-extrabold text-[#0B3B68] focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                    {u.id === currentUser.id
                      ? lang === 'ar'
                        ? ' (قيد الدخول)'
                        : ' (Logged in)'
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Amount Input + Quick Preset Buttons (4 cols) */}
            <div className="sm:col-span-4 flex items-center gap-1">
              <input
                ref={amountInputRef}
                id="advance-amount-input"
                type="number"
                step="0.25"
                min="0.25"
                required
                dir="ltr"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder={lang === 'ar' ? 'المبلغ (د.أ)' : 'Amount (JOD)'}
                className="w-24 sm:w-28 h-[38px] px-2.5 rounded-lg border border-slate-300 bg-white font-mono text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68] shrink-0"
              />
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {[5, 10, 20, 50].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAdvanceAmount(String(val))}
                    className={`h-[34px] px-2 rounded-lg border text-[11px] font-mono font-extrabold transition-colors cursor-pointer shrink-0 ${
                      advanceAmount === String(val)
                        ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Note & Date (3 cols) */}
            <div className="sm:col-span-3 flex items-center gap-1.5">
              <input
                id="advance-note-input"
                type="text"
                value={advanceNote}
                onChange={(e) => setAdvanceNote(e.target.value)}
                placeholder={lang === 'ar' ? 'ملاحظة (اختياري)...' : 'Note (optional)...'}
                className="w-full h-[38px] px-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              />
              <input
                id="advance-date-input"
                type="date"
                required
                dir="ltr"
                value={advanceDate}
                onChange={(e) => setAdvanceDate(e.target.value)}
                className="w-[118px] h-[38px] px-2 rounded-lg border border-slate-300 bg-white font-mono text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B3B68] shrink-0"
              />
            </div>

            {/* 4. Submit / Cancel Buttons (2 cols) */}
            <div className="sm:col-span-2 flex items-center gap-1">
              <button
                type="submit"
                className="w-full h-[38px] px-3 rounded-lg bg-[#1E824C] hover:bg-[#145A32] text-white font-extrabold text-xs flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {editingAdvanceId
                    ? lang === 'ar'
                      ? 'حفظ التعديل'
                      : 'Update'
                    : parsedInputAmount > 0
                    ? lang === 'ar'
                      ? `خصم -${parsedInputAmount}`
                      : `Deduct -${parsedInputAmount}`
                    : lang === 'ar'
                    ? 'تسجيل سلفة'
                    : 'Add Advance'}
                </span>
              </button>
              {editingAdvanceId && (
                <button
                  type="button"
                  onClick={resetAdvanceForm}
                  title={lang === 'ar' ? 'إلغاء التعديل' : 'Cancel Edit'}
                  className="h-[38px] px-2 rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer flex items-center justify-center shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Compact User Filter Strip + Collapsible Scrollable Log */}
        {showAdvancesLog && (
          <div className="space-y-2 pt-1">
            {/* Horizontal User Filter Pills + Search */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAdvanceFilterUserId('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border transition-colors cursor-pointer ${
                    advanceFilterUserId === 'all'
                      ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {lang === 'ar'
                    ? `الكل (${cashAdvances.length})`
                    : `All (${cashAdvances.length})`}
                </button>
                {users.map((u) => {
                  const st = userAdvanceStats.get(u.id);
                  const total = st?.totalJod || 0;
                  const isSelectedFilter = advanceFilterUserId === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setAdvanceFilterUserId(isSelectedFilter ? 'all' : u.id)
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border flex items-center gap-1 transition-colors cursor-pointer ${
                        isSelectedFilter
                          ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>{u.fullName}</span>
                      <span
                        className={`font-mono ${
                          isSelectedFilter ? 'text-amber-300' : 'text-rose-600'
                        }`}
                      >
                        -{formatJod(total, lang)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {cashAdvances.length > 2 && (
                <div className="relative w-full sm:w-52">
                  <Search className="w-3 h-3 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={advanceSearchQuery}
                    onChange={(e) => setAdvanceSearchQuery(e.target.value)}
                    placeholder={
                      lang === 'ar' ? 'بحث سريع في السلف...' : 'Search advances...'
                    }
                    className="w-full h-[30px] ps-7 pe-6 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-[11px] text-slate-900 focus:outline-none"
                  />
                  {advanceSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setAdvanceSearchQuery('')}
                      className="absolute top-1/2 -translate-y-1/2 end-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Compact Scrollable Advances List */}
            {filteredAdvances.length === 0 ? (
              <div className="text-center py-3 text-xs font-bold text-slate-400 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                {lang === 'ar'
                  ? 'لا توجد سلف مسجلة.'
                  : 'No cash advances recorded.'}
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {filteredAdvances.map((adv) => (
                  <div
                    key={adv.id}
                    className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="font-extrabold text-[#0B3B68]">
                        {adv.userFullName}
                      </span>
                      <span
                        dir="ltr"
                        className="font-mono text-[11px] text-slate-500"
                      >
                        {adv.date} {adv.time}
                      </span>
                      {adv.note && (
                        <span className="text-slate-600 truncate max-w-[220px]">
                          · {adv.note}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono font-black text-rose-600">
                        -{formatJod(adv.amountJod, lang)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleEditAdvance(adv)}
                        aria-label={
                          lang === 'ar'
                            ? `تعديل سلفة ${adv.userFullName}`
                            : `Edit advance ${adv.userFullName}`
                        }
                        className="p-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-[#0B3B68] cursor-pointer"
                        title={lang === 'ar' ? 'تعديل' : 'Edit'}
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#E58E26]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteAdvanceTarget(adv)}
                        aria-label={
                          lang === 'ar'
                            ? `حذف سلفة ${adv.userFullName}`
                            : `Delete advance ${adv.userFullName}`
                        }
                        className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                        title={lang === 'ar' ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* USER ACCOUNTS & PERMISSIONS SECTION (إدارة حسابات المستخدمين) */}
      {/* ===================================================================== */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#0B3B68] text-white flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#0B3B68]">
              {lang === 'ar'
                ? 'إدارة المستخدمين والصلاحيات (مدير / فني صيانة)'
                : 'Users & Role Permissions (Manager / Maintenance Technician)'}
            </h2>
          </div>
        </div>
      </div>

      {!isManager ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-base font-extrabold text-[#0B3B68]">
            {lang === 'ar'
              ? `حسابك الحالي: ${currentUser.fullName} (فني صيانة — قيد تسجيل الدخول)`
              : `Current Account: ${currentUser.fullName} (Technician — Logged In)`}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            {lang === 'ar'
              ? 'صلاحية إضافة أو حذف حسابات المستخدمين مخصصة لحساب "مدير" (admin). يمكنك تسجيل السلف من الكاش أعلاه أو تغيير كلمة المرور الخاصة بك أدناه:'
              : 'Adding or removing user accounts requires Manager (admin) permission. You can record cash advances above or change your password below:'}
          </p>
          <button
            type="button"
            onClick={() => {
              setPasswordTargetUser(currentUser);
              setNewPasswordInput(currentUser.password);
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0B3B68] text-white text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span>
              {lang === 'ar'
                ? 'تغيير كلمة المرور الخاصة بي'
                : 'Change My Password'}
            </span>
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900">
              {editingId
                ? lang === 'ar'
                  ? 'تعديل بيانات المستخدم وصلاحياته'
                  : 'Edit User & Permissions'
                : lang === 'ar'
                ? 'إضافة مستخدم جديد'
                : 'Add New User'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء التعديل' : 'Cancel'}
              </button>
            )}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold"
            >
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold"
            >
              {successMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="user-fullname"
                className="text-xs font-bold text-slate-700 block"
              >
                {lang === 'ar' ? 'الاسم الكامل للمستخدم *' : 'Full Name *'}
              </label>
              <input
                id="user-fullname"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={lang === 'ar' ? 'عبدالله...' : 'Abdullah...'}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="user-username"
                className="text-xs font-bold text-slate-700 block"
              >
                {lang === 'ar' ? 'اسم المستخدم (للدخول) *' : 'Username *'}
              </label>
              <input
                id="user-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="abdullah"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="user-password"
                className="text-xs font-bold text-slate-700 block"
              >
                {lang === 'ar' ? 'كلمة المرور *' : 'Password *'}
              </label>
              <input
                id="user-password"
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="user-phone"
                className="text-xs font-bold text-slate-700 block"
              >
                {lang === 'ar' ? 'رقم الهاتف (اختياري)' : 'Phone (Optional)'}
              </label>
              <input
                id="user-phone"
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="079XXXXXXX"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm tabular-nums"
              />
            </div>

            {/* Role Selector: Manager vs Technician */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 block">
                {lang === 'ar' ? 'الصلاحية *' : 'Role Permission *'}
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setRole('technician')}
                  className={`min-h-[44px] px-2 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 cursor-pointer ${
                    role === 'technician'
                      ? 'bg-[#1E824C] text-white border-[#1E824C]'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'فني صيانة' : 'Technician'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('manager')}
                  className={`min-h-[44px] px-2 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 cursor-pointer ${
                    role === 'manager'
                      ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'مدير' : 'Manager'}</span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white font-bold text-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>
              {editingId
                ? lang === 'ar'
                  ? 'حفظ تعديلات المستخدم'
                  : 'Save User Changes'
                : lang === 'ar'
                ? 'إضافة المستخدم وتفعيل الصلاحية'
                : 'Add User'}
            </span>
          </button>
        </form>
      )}

      {/* Users Search & Table */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'ابحث عن مستخدم بالاسم الكامل أو اسم الدخول أو رقم الهاتف...'
                : 'Search users by full name, username, or phone...'
            }
            aria-label={lang === 'ar' ? 'بحث في المستخدمين' : 'Search users'}
            className="w-full min-h-[46px] ps-10 pe-4 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
          />
        </div>

        <div className="divide-y divide-slate-200">
          {filteredUsers.map((u) => {
            const isLastManager =
              u.role === 'manager' &&
              users.filter((usr) => usr.role === 'manager').length <= 1;
            const isLoggedUser = u.id === currentUser.id;
            const uStats = userAdvanceStats.get(u.id);

            return (
              <div
                key={u.id}
                className="py-4 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#0B3B68]" />
                    <span className="text-base font-extrabold text-slate-900">
                      {u.fullName}
                    </span>
                    {isLoggedUser && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#145A32] border border-emerald-300 text-xs font-black">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        {lang === 'ar'
                          ? 'قيد تسجيل الدخول حالياً'
                          : 'Currently Logged In'}
                      </span>
                    )}
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        u.role === 'manager'
                          ? 'text-[#0B3B68]'
                          : 'text-[#1E824C]'
                      }`}
                    >
                      {u.role === 'manager'
                        ? lang === 'ar'
                          ? 'مدير النظام (صلاحيات كاملة)'
                          : 'Manager (Full Access)'
                        : lang === 'ar'
                        ? 'فني صيانة'
                        : 'Maintenance Technician'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                    <span>
                      {lang === 'ar' ? 'اسم المستخدم: ' : 'Username: '}
                      <strong className="text-slate-800">{u.username}</strong>
                      {u.phone ? ` · ${u.phone}` : ''}
                    </span>
                    {uStats && uStats.totalJod > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-extrabold">
                        {lang === 'ar'
                          ? `إجمالي السلف من الكاش: -${formatJod(
                              uStats.totalJod,
                              lang
                            )}`
                          : `Total Advances: -${formatJod(
                              uStats.totalJod,
                              lang
                            )}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAdvanceUserId(u.id);
                      advanceFormRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                      setTimeout(() => amountInputRef.current?.focus(), 200);
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#145A32] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'ar' ? '+ سلفة سريعة' : '+ Quick Advance'}
                    </span>
                  </button>

                  {isManager && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordTargetUser(u);
                          setNewPasswordInput(u.password);
                        }}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-[#E58E26]" />
                        <span>
                          {lang === 'ar'
                            ? 'تغيير كلمة المرور'
                            : 'Change Password'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(u.id);
                          setFullName(u.fullName);
                          setUsername(u.username);
                          setPassword(u.password);
                          setRole(u.role);
                          setPhone(u.phone || '');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        aria-label={
                          lang === 'ar'
                            ? `تعديل المستخدم ${u.username}`
                            : `Edit user ${u.username}`
                        }
                        className="min-h-[40px] px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-[#0B3B68] text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#E58E26]" />
                        <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                      </button>

                      {!isLastManager && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(u)}
                          aria-label={
                            lang === 'ar'
                              ? `حذف المستخدم ${u.username}`
                              : `Delete user ${u.username}`
                          }
                          className="min-h-[40px] px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Change Password Modal */}
      {passwordTargetUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="change-pass-title"
        >
          <form
            onSubmit={handlePasswordChangeSubmit}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4"
          >
            <h3
              id="change-pass-title"
              className="text-base font-extrabold text-[#0B3B68]"
            >
              {lang === 'ar'
                ? `تغيير كلمة المرور — ${passwordTargetUser.fullName}`
                : `Change Password — ${passwordTargetUser.fullName}`}
            </h3>
            <div className="space-y-1.5">
              <label
                htmlFor="new-pass-input"
                className="text-xs font-bold text-slate-700 block"
              >
                {lang === 'ar' ? 'كلمة المرور الجديدة' : 'New Password'}
              </label>
              <input
                id="new-pass-input"
                type="text"
                required
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPasswordTargetUser(null)}
                className="min-h-[44px] rounded-xl border border-slate-300 text-slate-700 font-bold text-sm cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-[#0B3B68] text-white font-bold text-sm cursor-pointer"
              >
                {lang === 'ar' ? 'حفظ كلمة المرور' : 'Save Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm Delete User Modal */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={lang === 'ar' ? 'تأكيد حذف المستخدم' : 'Confirm User Deletion'}
        itemName={
          deleteTarget
            ? `${deleteTarget.fullName} (${deleteTarget.username})`
            : ''
        }
        lang={lang}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteUser(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />

      {/* Confirm Delete Cash Advance Modal (التأكيد قبل الحذف) */}
      <ConfirmDeleteModal
        isOpen={!!deleteAdvanceTarget}
        title={
          lang === 'ar'
            ? 'تأكيد حذف السلفة النقدية وإرجاع المبلغ إلى الكاش'
            : 'Confirm Deleting Cash Advance & Restoring Cash'
        }
        itemName={
          deleteAdvanceTarget
            ? `${deleteAdvanceTarget.userFullName} — ${formatJod(
                deleteAdvanceTarget.amountJod,
                lang
              )} (${deleteAdvanceTarget.date})${
                deleteAdvanceTarget.note ? ` · ${deleteAdvanceTarget.note}` : ''
              }`
            : ''
        }
        lang={lang}
        onCancel={() => setDeleteAdvanceTarget(null)}
        onConfirm={() => {
          if (deleteAdvanceTarget) {
            onDeleteCashAdvance(deleteAdvanceTarget.id);
            if (editingAdvanceId === deleteAdvanceTarget.id) {
              resetAdvanceForm();
            }
            setDeleteAdvanceTarget(null);
            setAdvanceSuccessMsg(
              lang === 'ar'
                ? 'تم حذف السلفة النقدية وإرجاع المبلغ المخصوم إلى الكاش بنجاح.'
                : 'Cash advance deleted and amount restored to cash drawer.'
            );
            setTimeout(() => setAdvanceSuccessMsg(''), 4000);
          }
        }}
      />
    </div>
  );
};
