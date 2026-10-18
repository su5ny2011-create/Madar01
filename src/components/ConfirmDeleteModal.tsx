import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import type { Language } from '../types';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  itemName: string;
  lang: Language;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  itemName,
  lang,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-heading"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3
                id="confirm-delete-heading"
                className="text-base font-bold text-slate-900"
              >
                {title || (lang === 'ar' ? 'تأكيد عملية الحذف' : 'Confirm Deletion')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {lang === 'ar'
                  ? 'هل أنت متأكد من رغبتك في حذف هذا السجل نهائياً؟'
                  : 'Are you sure you want to permanently delete this record?'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={lang === 'ar' ? 'إلغاء' : 'Cancel'}
            className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 break-words">
          {itemName}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
          >
            {lang === 'ar' ? 'تراجع / إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>{lang === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
