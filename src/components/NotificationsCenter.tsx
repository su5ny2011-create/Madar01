import React, { useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCheck,
  Calendar,
  Clock,
  Phone,
  Smartphone,
  Trash2,
  Volume2,
  Wrench,
  X,
  CheckCircle2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import type {
  AppNotification,
  Customer,
  Language,
  MaintenanceVisit,
} from '../types';
import { formatJod, getDayName, isVisitUnpaid } from '../utils/logic';
import {
  getNotificationPermissionStatus,
  isMobileNotificationEnabledInApp,
  requestMobileNotificationPermission,
  sendPwaNotification,
  setMobileNotificationEnabledInApp,
} from '../utils/pwaNotifications';
import { PaymentReminderModal } from './PaymentReminderModal';

interface NotificationsCenterProps {
  lang: Language;
  notifications: AppNotification[];
  visits?: MaintenanceVisit[];
  customers?: Customer[];
  liveAlert: AppNotification | null;
  onDismissLiveAlert: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearReadNotifications?: () => void;
  onClearAllNotifications: () => void;
  onOpenMaintenanceFromNotification: (notif: AppNotification) => void;
  onOpenScheduleFromNotification?: (notif: AppNotification) => void;
  onOpenCustomersPage?: () => void;
  onSaveVisit?: (visit: MaintenanceVisit) => void;
  canDelete?: boolean;
}

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({
  lang,
  notifications,
  visits = [],
  customers = [],
  liveAlert,
  onDismissLiveAlert,
  onMarkRead,
  onMarkAllRead,
  onDeleteNotification,
  onClearReadNotifications,
  onClearAllNotifications,
  onOpenMaintenanceFromNotification,
  onOpenScheduleFromNotification,
  onOpenCustomersPage,
  onSaveVisit,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'payments'>('all');
  const [permState, setPermState] = useState(getNotificationPermissionStatus());
  const [mobileEnabled, setMobileEnabled] = useState(
    isMobileNotificationEnabledInApp()
  );
  const [testBanner, setTestBanner] = useState('');
  const [reminderTarget, setReminderTarget] = useState<{
    customerName: string;
    phone?: string;
    unpaidVisits: MaintenanceVisit[];
  } | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const readCount = notifications.filter((n) => Boolean(n.isRead)).length;
  const unpaidVisits = visits.filter((v) => isVisitUnpaid(v));

  // Group unpaid visits by customer name
  const unpaidByCustomerMap = new Map<
    string,
    { customerName: string; phone?: string; visits: MaintenanceVisit[]; totalJod: number }
  >();
  unpaidVisits.forEach((v) => {
    const key = v.customerName.trim().toLowerCase();
    const existing = unpaidByCustomerMap.get(key);
    const matchedCust = customers.find(
      (c) => c.name.trim().toLowerCase() === key
    );
    const resolvedPhone = v.phone || matchedCust?.phone || '';
    if (existing) {
      existing.visits.push(v);
      existing.totalJod += Number(v.amountJod) || 0;
      if (!existing.phone && resolvedPhone) existing.phone = resolvedPhone;
    } else {
      unpaidByCustomerMap.set(key, {
        customerName: v.customerName,
        phone: resolvedPhone,
        visits: [v],
        totalJod: Number(v.amountJod) || 0,
      });
    }
  });
  const unpaidCustomerGroups = Array.from(unpaidByCustomerMap.values());
  const totalBadgeCount = unreadCount + unpaidCustomerGroups.length;

  const handleEnableMobileNotifications = async () => {
    const res = await requestMobileNotificationPermission();
    setPermState(res);
    setMobileEnabled(true);
    await sendPwaNotification({
      title:
        lang === 'ar'
          ? 'شركة المدار — تم تفعيل إشعارات الهاتف بنجاح!'
          : 'Al-Madar IT — Mobile Notifications Enabled!',
      body:
        lang === 'ar'
          ? 'ستصلك إشعارات طلبات الصيانة وتنبيهات المواعيد قبل 30 دقيقة تلقائياً على الهاتف.'
          : 'You will now receive maintenance alerts and 30-minute calendar reminders on your phone.',
      tag: 'almadar-enable-confirm',
    });
    setTestBanner(
      lang === 'ar'
        ? 'تم تفعيل الإشعارات الصوتية وإشعارات الهاتف والمتصفح (PWA) بنجاح!'
        : 'Mobile & PWA notifications activated successfully!'
    );
    setTimeout(() => setTestBanner(''), 4000);
  };

  return (
    <>
      {/* Trigger Button with Unread + Unpaid Counter */}
      <button
        type="button"
        onClick={() => {
          onDismissLiveAlert();
          setIsOpen(true);
        }}
        aria-label={
          lang === 'ar'
            ? `إشعارات البرنامج وتذكير الدفع (${totalBadgeCount})`
            : `Program & Payment Notifications (${totalBadgeCount})`
        }
        className="relative min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#0B3B68] flex items-center gap-2 transition-colors cursor-pointer"
      >
        <Bell
          className={`w-4 h-4 ${
            totalBadgeCount > 0 ? 'text-[#E58E26]' : 'text-[#0B3B68]'
          }`}
        />
        <span className="hidden sm:inline text-xs font-extrabold whitespace-nowrap">
          {lang === 'ar' ? 'الإشعارات' : 'Alerts'}
        </span>
        {totalBadgeCount > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-md bg-[#E58E26] text-white font-mono text-[11px] font-extrabold tabular-nums flex items-center justify-center">
            {totalBadgeCount}
          </span>
        )}
      </button>

      {/* Live Toast Alert Banner when a New Maintenance Request (Customer or Manager) is Registered */}
      {liveAlert && (
        <div
          role="alert"
          className="fixed top-20 start-4 end-4 sm:start-auto sm:end-6 sm:w-96 z-50 rounded-2xl bg-[#0B3B68] text-white p-4 shadow-2xl border-2 border-[#E58E26] space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#E58E26] text-white flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-amber-300">
                  {liveAlert.source === 'calendar_reminder'
                    ? lang === 'ar'
                      ? 'تنبيه موعد صيانة مجدول — قبل 30 دقيقة!'
                      : 'Scheduled Maintenance Reminder — 30 Mins Before!'
                    : liveAlert.source === 'staff'
                    ? lang === 'ar'
                      ? 'تنبيه طلب صيانة جديد — من المدير / الإدارة!'
                      : 'New Maintenance Request — By Manager!'
                    : lang === 'ar'
                    ? 'تنبيه طلب صيانة جديد — من بوابة الزبائن!'
                    : 'New Maintenance Request — Customer Portal!'}
                </div>
                <div className="text-sm font-extrabold text-white mt-0.5 leading-snug">
                  {liveAlert.customerName}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismissLiveAlert}
              aria-label={lang === 'ar' ? 'إغلاق التنبيه' : 'Dismiss alert'}
              className="min-h-[34px] min-w-[34px] rounded-lg text-sky-200 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs sm:text-sm text-sky-100 leading-relaxed">
            {liveAlert.message}
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onDeleteNotification(liveAlert.id);
                onDismissLiveAlert();
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-xs font-extrabold text-white flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'قراءة ومسح الإشعار' : 'Read & Clear'}</span>
            </button>

            <button
              type="button"
              onClick={onDismissLiveAlert}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
            >
              {lang === 'ar' ? 'لاحقاً' : 'Later'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (
                  liveAlert.source === 'calendar_reminder' &&
                  onOpenScheduleFromNotification
                ) {
                  onOpenScheduleFromNotification(liveAlert);
                } else {
                  onOpenMaintenanceFromNotification(liveAlert);
                }
                onDismissLiveAlert();
              }}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-xs font-extrabold text-white flex items-center gap-1.5 cursor-pointer"
            >
              {liveAlert.source === 'calendar_reminder' ? (
                <Calendar className="w-3.5 h-3.5" />
              ) : (
                <Wrench className="w-3.5 h-3.5" />
              )}
              <span>
                {liveAlert.source === 'calendar_reminder'
                  ? lang === 'ar'
                    ? 'فتح في جدول المواعيد'
                    : 'Open in Schedule'
                  : lang === 'ar'
                  ? 'فتح في طلبات الصيانة'
                  : 'Open in Maintenance'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Notifications Drawer / Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center sm:justify-end bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notifications-dialog-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden mt-10 sm:mt-14 max-h-[85vh] flex flex-col">
            <div className="p-4 bg-[#0B3B68] text-white space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-5 h-5 text-[#E58E26]" />
                  <div>
                    <h3
                      id="notifications-dialog-title"
                      className="text-sm sm:text-base font-extrabold"
                    >
                      {lang === 'ar'
                        ? 'إشعارات البرنامج وتذكير الدفع للزبائن'
                        : 'Program Alerts & Payment Reminders'}
                    </h3>
                    <p className="text-xs text-sky-200 mt-0.5">
                      {lang === 'ar'
                        ? `إشعارات الدفع: ${unpaidCustomerGroups.length} · تنبيهات الصيانة: ${notifications.length}`
                        : `Payment Alerts: ${unpaidCustomerGroups.length} · System Alerts: ${notifications.length}`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label={lang === 'ar' ? 'إغلاق الإشعارات' : 'Close notifications'}
                  className="min-h-[38px] min-w-[38px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Switcher inside Notifications Center: All vs Payment Reminders */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/10 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    activeTab === 'all'
                      ? 'bg-white text-[#0B3B68] shadow-2xs'
                      : 'text-sky-100 hover:bg-white/10'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {lang === 'ar'
                      ? `كل الإشعارات (${notifications.length + unpaidCustomerGroups.length})`
                      : `All Alerts (${notifications.length + unpaidCustomerGroups.length})`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('payments')}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    activeTab === 'payments'
                      ? 'bg-[#E58E26] text-white shadow-2xs'
                      : 'text-amber-200 hover:bg-white/10'
                  }`}
                >
                  <BellRing className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {lang === 'ar'
                      ? `إشعارات وتذكير الدفع (${unpaidCustomerGroups.length})`
                      : `Payment Reminders (${unpaidCustomerGroups.length})`}
                  </span>
                </button>
              </div>
            </div>

            {/* Mobile & PWA Notification Activation Control Panel */}
            <div className="p-3 bg-sky-50/90 border-b border-sky-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#0B3B68] shrink-0" />
                  <span className="text-xs font-extrabold text-[#0B3B68]">
                    {lang === 'ar'
                      ? 'إشعارات الهاتف والمتصفح (قبل الموعد بـ 30 دقيقة)'
                      : 'Mobile & PWA Alerts (30m before appointment)'}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-extrabold ${
                    mobileEnabled && permState === 'granted'
                      ? 'text-[#1E824C]'
                      : 'text-[#E58E26]'
                  }`}
                >
                  {mobileEnabled && permState === 'granted'
                    ? lang === 'ar'
                      ? 'مفعّلة على الهاتف ✓'
                      : 'Active on Phone ✓'
                    : lang === 'ar'
                    ? 'جاهزة للتفعيل'
                    : 'Ready to Enable'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleEnableMobileNotifications}
                  className="min-h-[34px] px-3 py-1 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'ar'
                      ? 'تفعيل الإشعارات على الهاتف'
                      : 'Enable Mobile Notifications'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await handleEnableMobileNotifications();
                  }}
                  className="min-h-[34px] px-3 py-1 rounded-xl border border-[#0B3B68] bg-white hover:bg-slate-50 text-[#0B3B68] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#E58E26]" />
                  <span>
                    {lang === 'ar'
                      ? 'تجربة إشعار وصوت الهاتف'
                      : 'Test Phone Alert'}
                  </span>
                </button>

                {mobileEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !mobileEnabled;
                      setMobileNotificationEnabledInApp(next);
                      setMobileEnabled(next);
                    }}
                    className="min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 cursor-pointer"
                  >
                    {lang === 'ar' ? 'إيقاف مؤقت' : 'Mute'}
                  </button>
                )}
              </div>

              {testBanner && (
                <div className="p-2 rounded-lg bg-emerald-100/80 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#1E824C] shrink-0" />
                  <span>{testBanner}</span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* PAYMENT NOTIFICATIONS & REMINDERS SECTION */}
              {unpaidCustomerGroups.length > 0 && (
                <div className="rounded-2xl bg-rose-50/70 border border-rose-200 p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-900">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        {lang === 'ar'
                          ? `إشعارات الدفع وتذكير الزبائن (${unpaidCustomerGroups.length})`
                          : `Payment Reminders (${unpaidCustomerGroups.length})`}
                      </span>
                    </div>
                    {onOpenCustomersPage && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onOpenCustomersPage();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-100 text-[#0B3B68] border border-rose-200 text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Building2 className="w-3 h-3 text-[#0B3B68]" />
                        <span>{lang === 'ar' ? 'فتح صفحة الزبائن' : 'Customers Page'}</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {unpaidCustomerGroups.map((group) => (
                      <div
                        key={group.customerName}
                        className="p-2.5 rounded-xl bg-white border border-rose-200 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-extrabold text-[#0B3B68] flex items-center gap-1.5">
                            <bdi>{group.customerName}</bdi>
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-extrabold">
                              {lang === 'ar'
                                ? `${group.visits.length} زيارة غير مدفوعة`
                                : `${group.visits.length} unpaid`}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono font-extrabold text-rose-700">
                            {lang === 'ar' ? 'المبلغ المستحق: ' : 'Due: '}
                            {formatJod(group.totalJod, lang)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setReminderTarget({
                              customerName: group.customerName,
                              phone: group.phone,
                              unpaidVisits: group.visits,
                            })
                          }
                          className="min-h-[34px] px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                        >
                          <BellRing className="w-3.5 h-3.5 text-[#E58E26]" />
                          <span>{lang === 'ar' ? 'تذكير بالدفع' : 'Payment Reminder'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'payments' && unpaidCustomerGroups.length === 0 && (
                <div className="py-10 text-center text-xs sm:text-sm text-slate-500">
                  {lang === 'ar'
                    ? 'لا توجد ذمم أو زيارات غير مدفوعة حالياً. جميع الزيارات مسددة بالكامل.'
                    : 'No unpaid visits right now. All visits are settled.'}
                </div>
              )}

              {/* SYSTEM & MAINTENANCE NOTIFICATIONS — Available for ALL Users to Read & Clear */}
              {activeTab === 'all' && (
                <>
                  {notifications.length > 0 && (
                    <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={onMarkAllRead}
                        className="min-h-[32px] px-2.5 py-1 rounded-lg text-xs font-bold text-[#0B3B68] hover:bg-slate-200/70 flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCheck className="w-4 h-4 text-[#1E824C]" />
                        <span>
                          {lang === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all as read'}
                        </span>
                      </button>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {readCount > 0 && onClearReadNotifications && (
                          <button
                            type="button"
                            onClick={onClearReadNotifications}
                            className="min-h-[32px] px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-extrabold text-rose-700 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>
                              {lang === 'ar'
                                ? `مسح المقروءة (${readCount})`
                                : `Clear Read (${readCount})`}
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={onClearAllNotifications}
                          className="min-h-[32px] px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-extrabold text-white flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>
                            {lang === 'ar'
                              ? `مسح الكل (${notifications.length})`
                              : `Clear All (${notifications.length})`}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {notifications.length === 0 && unpaidCustomerGroups.length === 0 ? (
                    <div className="py-10 text-center text-xs sm:text-sm text-slate-500 leading-relaxed">
                      {lang === 'ar'
                        ? 'لا توجد إشعارات حالياً. عند إضافة أي طلب صيانة جديد أو وجود تذكير دفع أو اقتراب موعد صيانة سيظهر التنبيه هنا فوراً.'
                        : 'No notifications yet.'}
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-4 rounded-xl border transition-colors space-y-2.5 ${
                          !n.isRead
                            ? 'bg-amber-50/50 border-[#E58E26]'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-extrabold text-[#0B3B68]">
                                {n.customerName}
                              </span>
                              <span className="text-slate-300" aria-hidden="true">
                                ·
                              </span>
                              <span
                                className={`text-xs font-bold ${
                                  n.source === 'calendar_reminder'
                                    ? 'text-[#E58E26]'
                                    : n.source === 'staff'
                                    ? 'text-[#0B3B68]'
                                    : 'text-[#1E824C]'
                                }`}
                              >
                                {n.source === 'calendar_reminder'
                                  ? lang === 'ar'
                                    ? 'تذكير موعد (قبل 30 دقيقة)'
                                    : 'Calendar Reminder (30m)'
                                  : n.source === 'staff'
                                  ? lang === 'ar'
                                    ? 'من المدير / الإدارة'
                                    : 'By Manager'
                                  : lang === 'ar'
                                  ? 'من بوابة الزبائن'
                                  : 'Customer Portal'}
                              </span>
                              {!n.isRead ? (
                                <span className="text-xs font-extrabold text-[#E58E26]">
                                  {lang === 'ar' ? '· جديد' : '· NEW'}
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-[#1E824C]">
                                  {lang === 'ar' ? '· مقروء ✓' : '· Read ✓'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm font-semibold text-slate-700 leading-relaxed">
                              {n.message}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => onDeleteNotification(n.id)}
                            title={
                              lang === 'ar'
                                ? 'مسح الإشعار'
                                : 'Delete notification'
                            }
                            aria-label={
                              lang === 'ar'
                                ? `مسح إشعار ${n.customerName}`
                                : `Delete notification ${n.customerName}`
                            }
                            className="min-h-[34px] min-w-[34px] rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-[#0B3B68]">
                            <Calendar className="w-3.5 h-3.5 text-[#0B3B68]" />
                            <span>{getDayName(n.visitDate, lang)}</span>
                            <span dir="ltr" className="font-mono tabular-nums">
                              {n.visitDate}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-800">
                            <Clock className="w-3.5 h-3.5 text-[#E58E26]" />
                            <span dir="ltr" className="font-mono tabular-nums">
                              {n.visitTime}
                            </span>
                          </span>
                          {n.phone && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-700">
                              <Phone className="w-3.5 h-3.5 text-[#1E824C]" />
                              <span dir="ltr" className="font-mono tabular-nums">
                                {n.phone}
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                          {!n.isRead ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onMarkRead(n.id)}
                                className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                              >
                                {lang === 'ar' ? 'تحديد كمقروء' : 'Mark read'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteNotification(n.id)}
                                className="min-h-[36px] px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{lang === 'ar' ? 'قراءة ومسح' : 'Read & Clear'}</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onDeleteNotification(n.id)}
                              className="min-h-[36px] px-3 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>
                                {lang === 'ar'
                                  ? 'مسح الإشعار بعد القراءة'
                                  : 'Clear Read Notification'}
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              onOpenMaintenanceFromNotification(n);
                              setIsOpen(false);
                            }}
                            className="min-h-[36px] px-3 py-1 rounded-lg bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>
                              {lang === 'ar'
                                ? 'معاينة في طلبات الصيانة'
                                : 'View in Maintenance'}
                            </span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Reminder Modal Triggered from Program Notifications */}
      <PaymentReminderModal
        isOpen={Boolean(reminderTarget)}
        onClose={() => setReminderTarget(null)}
        lang={lang}
        customerName={reminderTarget?.customerName || ''}
        phone={reminderTarget?.phone}
        unpaidVisits={reminderTarget?.unpaidVisits || []}
        onMarkVisitPaid={
          onSaveVisit
            ? (visit) => {
                onSaveVisit({
                  ...visit,
                  isResolved: true,
                  status: 'resolved',
                  isPaid: true,
                });
                setReminderTarget((prev) => {
                  if (!prev) return null;
                  const remaining = prev.unpaidVisits.filter(
                    (u) => u.id !== visit.id
                  );
                  return remaining.length > 0
                    ? { ...prev, unpaidVisits: remaining }
                    : null;
                });
              }
            : undefined
        }
        onMarkAllPaid={
          onSaveVisit
            ? (visitsToPay) => {
                visitsToPay.forEach((v) =>
                  onSaveVisit({
                    ...v,
                    isResolved: true,
                    status: 'resolved',
                    isPaid: true,
                  })
                );
                setReminderTarget(null);
              }
            : undefined
        }
      />
    </>
  );
};
