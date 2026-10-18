import React, { useState } from 'react';
import {
  Bell,
  CheckCheck,
  Calendar,
  Clock,
  Phone,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import type { AppNotification, Language } from '../types';
import { getDayName } from '../utils/logic';

interface NotificationsCenterProps {
  lang: Language;
  notifications: AppNotification[];
  liveAlert: AppNotification | null;
  onDismissLiveAlert: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAllNotifications: () => void;
  onOpenMaintenanceFromNotification: (notif: AppNotification) => void;
}

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({
  lang,
  notifications,
  liveAlert,
  onDismissLiveAlert,
  onMarkRead,
  onMarkAllRead,
  onDeleteNotification,
  onClearAllNotifications,
  onOpenMaintenanceFromNotification,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      {/* Trigger Button with Unread Counter */}
      <button
        type="button"
        onClick={() => {
          onDismissLiveAlert();
          setIsOpen(true);
        }}
        aria-label={
          lang === 'ar'
            ? `إشعارات طلبات الصيانة (${unreadCount} غير مقروء)`
            : `Maintenance Notifications (${unreadCount} unread)`
        }
        className="relative min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[#0B3B68] flex items-center gap-2 transition-colors cursor-pointer"
      >
        <Bell
          className={`w-4 h-4 ${
            unreadCount > 0 ? 'text-[#E58E26]' : 'text-[#0B3B68]'
          }`}
        />
        <span className="hidden sm:inline text-xs font-extrabold whitespace-nowrap">
          {lang === 'ar' ? 'الإشعارات' : 'Alerts'}
        </span>
        {unreadCount > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-md bg-[#E58E26] text-white font-mono text-[11px] font-extrabold tabular-nums flex items-center justify-center">
            {unreadCount}
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
                  {liveAlert.source === 'staff'
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

          <div className="flex items-center justify-end gap-2 pt-1">
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
                onOpenMaintenanceFromNotification(liveAlert);
                onDismissLiveAlert();
              }}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-xs font-extrabold text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>
                {lang === 'ar'
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
          className="fixed inset-0 z-50 flex items-start justify-center sm:justify-end bg-slate-900/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="notifications-dialog-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden mt-12 sm:mt-14 max-h-[82vh] flex flex-col">
            <div className="p-4 sm:p-5 bg-[#0B3B68] text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-[#E58E26]" />
                <div>
                  <h3
                    id="notifications-dialog-title"
                    className="text-base font-extrabold"
                  >
                    {lang === 'ar'
                      ? 'تنبيهات طلبات الصيانة (الزبائن والمدير)'
                      : 'Maintenance Notifications (Customers & Manager)'}
                  </h3>
                  <p className="text-xs text-sky-200 mt-0.5">
                    {lang === 'ar'
                      ? `غير مقروء: ${unreadCount} · الإجمالي: ${notifications.length}`
                      : `Unread: ${unreadCount} · Total: ${notifications.length}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={lang === 'ar' ? 'إغلاق الإشعارات' : 'Close notifications'}
                className="min-h-[40px] min-w-[40px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {notifications.length > 0 && (
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold text-[#0B3B68] hover:bg-slate-200/70 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4 text-[#1E824C]" />
                  <span>
                    {lang === 'ar' ? 'تحديد الكل كمقروء' : 'Mark all as read'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onClearAllNotifications}
                  className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'مسح الكل' : 'Clear all'}</span>
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto divide-y divide-slate-200 p-3 space-y-2.5">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-xs sm:text-sm text-slate-500 leading-relaxed">
                  {lang === 'ar'
                    ? 'لا توجد إشعارات حالياً. عند إضافة أي طلب صيانة جديد من الزبائن أو المدير سيظهر التنبيه هنا فوراً.'
                    : 'No notifications yet. New maintenance requests from customers or manager will appear here immediately.'}
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
                              n.source === 'staff'
                                ? 'text-[#0B3B68]'
                                : 'text-[#1E824C]'
                            }`}
                          >
                            {n.source === 'staff'
                              ? lang === 'ar'
                                ? 'من المدير / الإدارة'
                                : 'By Manager'
                              : lang === 'ar'
                              ? 'من بوابة الزبائن'
                              : 'Customer Portal'}
                          </span>
                          {!n.isRead && (
                            <span className="text-xs font-extrabold text-[#E58E26]">
                              {lang === 'ar' ? '· جديد' : '· NEW'}
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
                        aria-label={
                          lang === 'ar'
                            ? `حذف إشعار ${n.customerName}`
                            : `Delete notification ${n.customerName}`
                        }
                        className="min-h-[34px] min-w-[34px] rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={() => onMarkRead(n.id)}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                        >
                          {lang === 'ar' ? 'تحديد كمقروء' : 'Mark read'}
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
            </div>
          </div>
        </div>
      )}
    </>
  );
};
