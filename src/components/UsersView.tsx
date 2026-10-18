import React, { useState } from 'react';
import {
  Edit3,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';
import type { Language, User, UserRole } from '../types';
import { getTodayStr } from '../utils/logic';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface UsersViewProps {
  lang: Language;
  users: User[];
  currentUser: User;
  onSaveUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({
  lang,
  users,
  currentUser,
  onSaveUser,
  onDeleteUser,
}) => {
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

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isManager = currentUser.role === 'manager';
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

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <p className="text-xs text-slate-500">
              {lang === 'ar'
                ? 'إضافة مستخدمين جدد، تغيير كلمات المرور، وتحديد الصلاحيات'
                : 'Add users, change passwords, and manage role permissions'}
            </p>
          </div>
        </div>
      </div>

      {!isManager ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-base font-extrabold text-[#0B3B68]">
            {lang === 'ar'
              ? `حسابك الحالي: ${currentUser.fullName} (فني صيانة)`
              : `Current Account: ${currentUser.fullName} (Technician)`}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            {lang === 'ar'
              ? 'صلاحية إضافة أو حذف المستخدمين مخصصة لحساب "مدير" (admin). يمكنك تغيير كلمة المرور الخاصة بك أدناه:'
              : 'Adding or removing users requires Manager (admin) permission. You can change your own password below:'}
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
            <span>{lang === 'ar' ? 'تغيير كلمة المرور الخاصة بي' : 'Change My Password'}</span>
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
                placeholder={lang === 'ar' ? 'م. سامي العلي...' : 'Eng. Sami...'}
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
                placeholder="sami"
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
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      u.role === 'manager' ? 'text-[#0B3B68]' : 'text-[#1E824C]'
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
                <div className="text-xs text-slate-500 font-mono tabular-nums">
                  {lang === 'ar' ? 'اسم المستخدم: ' : 'Username: '}
                  <strong className="text-slate-800">{u.username}</strong>
                  {u.phone ? ` · ${u.phone}` : ''}
                </div>
              </div>

              {isManager && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordTargetUser(u);
                      setNewPasswordInput(u.password);
                    }}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#E58E26]" />
                    <span>{lang === 'ar' ? 'تغيير كلمة المرور' : 'Change Password'}</span>
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
                    }}
                    aria-label={lang === 'ar' ? `تعديل المستخدم ${u.username}` : `Edit user ${u.username}`}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[#0B3B68] text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                  </button>

                  {!isLastManager && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(u)}
                      aria-label={lang === 'ar' ? `حذف المستخدم ${u.username}` : `Delete user ${u.username}`}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                    </button>
                  )}
                </div>
              )}
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
            <h3 id="change-pass-title" className="text-base font-extrabold text-[#0B3B68]">
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

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={lang === 'ar' ? 'تأكيد حذف المستخدم' : 'Confirm User Deletion'}
        itemName={
          deleteTarget ? `${deleteTarget.fullName} (${deleteTarget.username})` : ''
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
    </div>
  );
};
