import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  Banknote,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FileText,
  LayoutGrid,
  List,
  Phone,
  Plus,
  Printer,
  Search,
  Trash2,
  User,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import type {
  Customer,
  Language,
  MaintenanceVisit,
  PartItem,
  ReportPeriod,
} from '../types';
import { formatJod, getDayName, getTodayStr, isVisitUnpaid } from '../utils/logic';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { WorkNotesScannerModal, type ExtractedWorkData } from './WorkNotesScannerModal';
import { EditDailyMaintenanceModal } from './EditDailyMaintenanceModal';
import { DailyMaintenanceReportModal } from './DailyMaintenanceReportModal';

interface MaintenanceViewProps {
  lang: Language;
  visits: MaintenanceVisit[];
  customers: Customer[];
  parts: PartItem[];
  preselectedCustomerName?: string;
  onClearPreselectedCustomer?: () => void;
  onSaveVisit: (visit: MaintenanceVisit) => void;
  onDeleteVisit: (visitId: string) => void;
  onArchiveVisits?: (visitIds?: string[]) => number;
  onUnarchiveVisit?: (visitId: string) => void;
  onUnarchiveVisits?: (visitIds?: string[]) => number;
  onOpenDailyArchive?: () => void;
  initialSection?: 'active' | 'archive' | 'all';
  currentUserFullName: string;
  canDelete?: boolean;
  canTransfer?: boolean;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({
  lang,
  visits,
  customers,
  parts,
  preselectedCustomerName,
  onClearPreselectedCustomer,
  onSaveVisit,
  onDeleteVisit,
  initialSection = 'active',
  currentUserFullName,
  canDelete = true,
}) => {
  // Carender Date Filter: defaults to Today ('YYYY-MM-DD') or 'all'
  const todayStr = useMemo(() => getTodayStr(), []);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(todayStr);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState<boolean>(false);

  const [initialYear, initialMonth] = useMemo(() => {
    const [y, m] = todayStr.split('-').map(Number);
    return [y, m];
  }, [todayStr]);
  const [calendarYear, setCalendarYear] = useState<number>(initialYear);
  const [calendarMonth, setCalendarMonth] = useState<number>(initialMonth);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingModalVisit, setEditingModalVisit] = useState<MaintenanceVisit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceVisit | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [maintenanceReportPeriod, setMaintenanceReportPeriod] = useState<ReportPeriod>('daily');
  const [pendingExtractedData, setPendingExtractedData] = useState<ExtractedWorkData | null>(null);

  // Quick Inline Add Bar state
  const [showQuickInlineAdd, setShowQuickInlineAdd] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickProblem, setQuickProblem] = useState('');
  const [quickVisitType, setQuickVisitType] = useState<'visit' | 'contract'>('visit');
  const [quickAmount, setQuickAmount] = useState('');

  // View density mode: 'cards' (compact cards) or 'rows' (ultra-compact table rows)
  const [viewMode, setViewMode] = useState<'cards' | 'rows'>('cards');

  // Notifications
  const [successBanner, setSuccessBanner] = useState('');

  // Filtering & Search: Default to 'active' (الطلبات النشطة) so completed requests leave the active list
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'active' | 'resolved' | 'pending' | 'in_progress' | 'unpaid' | 'portal' | 'all'
  >(initialSection === 'archive' ? 'resolved' : 'active');

  // Selection for Bulk Actions
  const [selectedVisitIds, setSelectedVisitIds] = useState<string[]>([]);
  const [customSelectCount, setCustomSelectCount] = useState<string>('');

  // Compact Status Filter Dropdown Popover
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(e.target as Node)
      ) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // If a customer was preselected (e.g. from customer catalog), open Add modal pre-filled
  useEffect(() => {
    if (preselectedCustomerName) {
      setIsAddModalOpen(true);
    }
  }, [preselectedCustomerName]);

  const monthNames = {
    ar: [
      'يناير',
      'فبراير',
      'مارس',
      'أبريل',
      'مايو',
      'يونيو',
      'يوليو',
      'أغسطس',
      'سبتمبر',
      'أكتوبر',
      'نوفمبر',
      'ديسمبر',
    ],
    en: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
  };

  const calendarWeekdays = [
    { ar: 'السبت', en: 'Sat' },
    { ar: 'الأحد', en: 'Sun' },
    { ar: 'الإثنين', en: 'Mon' },
    { ar: 'الثلاثاء', en: 'Tue' },
    { ar: 'الأربعاء', en: 'Wed' },
    { ar: 'الخميس', en: 'Thu' },
    { ar: 'الجمعة', en: 'Fri' },
  ];

  const calendarCells = useMemo(() => {
    const firstDay = new Date(Date.UTC(calendarYear, calendarMonth - 1, 1));
    const firstDayOfWeek = firstDay.getUTCDay();
    const leadingDays = (firstDayOfWeek + 1) % 7;
    const daysInMonth = new Date(Date.UTC(calendarYear, calendarMonth, 0)).getUTCDate();
    const daysInPrevMonth = new Date(Date.UTC(calendarYear, calendarMonth - 1, 0)).getUTCDate();

    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    const prevMonth = calendarMonth === 1 ? 12 : calendarMonth - 1;
    const prevYear = calendarMonth === 1 ? calendarYear - 1 : calendarYear;
    for (let i = leadingDays - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: day, isCurrentMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: day, isCurrentMonth: true });
    }
    const remaining = (7 - (cells.length % 7)) % 7;
    const nextMonth = calendarMonth === 12 ? 1 : calendarMonth + 1;
    const nextYear = calendarMonth === 12 ? calendarYear + 1 : calendarYear;
    for (let day = 1; day <= remaining; day++) {
      const dateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: day, isCurrentMonth: false });
    }
    return cells;
  }, [calendarYear, calendarMonth]);

  // All recorded maintenance dates (sorted newest first)
  const availableVisitDates = useMemo(() => {
    return Array.from(
      new Set(visits.map((v) => v.visitDate || '').filter(Boolean))
    ).sort((a, b) => b.localeCompare(a));
  }, [visits]);

  const nextVisitDateNav = useMemo(() => {
    if (selectedDateFilter === 'all') return null;
    const newer = availableVisitDates.filter((d) => d > selectedDateFilter);
    return newer.length > 0 ? newer[newer.length - 1] : null;
  }, [availableVisitDates, selectedDateFilter]);

  const prevVisitDateNav = useMemo(() => {
    if (selectedDateFilter === 'all') return null;
    const older = availableVisitDates.filter((d) => d < selectedDateFilter);
    return older.length > 0 ? older[0] : null;
  }, [availableVisitDates, selectedDateFilter]);

  const goToNextVisitDate = () => {
    if (nextVisitDateNav) {
      setSelectedDateFilter(nextVisitDateNav);
      const [y, m] = nextVisitDateNav.split('-').map(Number);
      setCalendarYear(y);
      setCalendarMonth(m);
      setSelectedVisitIds([]);
    }
  };

  const goToPrevVisitDate = () => {
    if (prevVisitDateNav) {
      setSelectedDateFilter(prevVisitDateNav);
      const [y, m] = prevVisitDateNav.split('-').map(Number);
      setCalendarYear(y);
      setCalendarMonth(m);
      setSelectedVisitIds([]);
    }
  };

  const handleJumpToToday = () => {
    const today = getTodayStr();
    const [y, m] = today.split('-').map(Number);
    setCalendarYear(y);
    setCalendarMonth(m);
    setSelectedDateFilter(today);
    setSelectedVisitIds([]);
    setIsCalendarModalOpen(false);
  };

  // Per-day summaries for Carender
  const visitDateSummaries = useMemo(() => {
    return availableVisitDates.map((dStr) => {
      const items = visits.filter((v) => v.visitDate === dStr);
      const activeCount = items.filter(
        (v) => !v.isArchived && !v.isResolved && v.status !== 'resolved'
      ).length;
      const resolvedCount = items.filter(
        (v) => v.isResolved || v.status === 'resolved' || v.isArchived
      ).length;
      const unpaidCount = items.filter((v) => isVisitUnpaid(v)).length;
      const totalAmount = items
        .filter((v) => v.isPaid && v.visitType !== 'contract')
        .reduce((acc, v) => acc + (Number(v.amountJod) || 0), 0);
      return {
        dateStr: dStr,
        count: items.length,
        activeCount,
        resolvedCount,
        unpaidCount,
        totalAmount,
      };
    });
  }, [availableVisitDates, visits]);

  const visitDateSummariesMap = useMemo(() => {
    const map = new Map<string, (typeof visitDateSummaries)[0]>();
    visitDateSummaries.forEach((d) => map.set(d.dateStr, d));
    return map;
  }, [visitDateSummaries]);

  const monthPrefix = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}`;
  const monthVisits = useMemo(
    () => visits.filter((v) => (v.visitDate || '').startsWith(monthPrefix)),
    [visits, monthPrefix]
  );

  // Visits scoped to selectedDateFilter ('all' or specific date)
  const dateScopedVisits = useMemo(() => {
    if (selectedDateFilter === 'all') return visits;
    return visits.filter((v) => v.visitDate === selectedDateFilter);
  }, [visits, selectedDateFilter]);

  // Active / Ongoing maintenance requests (not archived and not resolved)
  const activeSectionVisits = dateScopedVisits.filter(
    (v) => !v.isArchived && !v.isResolved && v.status !== 'resolved'
  );
  // Completed / Resolved / Archived maintenance requests (مرحّلة)
  const completedSectionVisits = dateScopedVisits.filter(
    (v) => v.isArchived || v.isResolved || v.status === 'resolved'
  );
  const waitingSectionVisits = dateScopedVisits.filter(
    (v) => !v.isArchived && !v.isResolved && (v.status === 'pending' || (!v.status && !v.isResolved))
  );
  const inProgressSectionVisits = dateScopedVisits.filter(
    (v) => !v.isArchived && !v.isResolved && v.status === 'in_progress'
  );
  const unpaidSectionVisits = dateScopedVisits.filter((v) => isVisitUnpaid(v));
  const portalSectionVisits = dateScopedVisits.filter(
    (v) => v.source === 'customer_portal' && !v.isArchived && !v.isResolved
  );

  const handleResolveAndTransfer = (v: MaintenanceVisit) => {
    const isCurrentlyResolved = Boolean(v.isResolved || v.status === 'resolved' || v.isArchived);
    if (!isCurrentlyResolved) {
      onSaveVisit({
        ...v,
        status: 'resolved',
        isResolved: true,
        isArchived: true,
        archivedAt: getTodayStr(),
      });
      setSuccessBanner(
        lang === 'ar'
          ? `تم إنهاء مشكلة الزبون «${v.customerName}» وترحيل الطلب بنجاح إلى الطلبات المنتهية.`
          : `Maintenance for "${v.customerName}" resolved and transferred to completed list.`
      );
      setTimeout(() => setSuccessBanner(''), 4500);
    } else {
      // Reopen to active
      onSaveVisit({
        ...v,
        status: 'in_progress',
        isResolved: false,
        isArchived: false,
        archivedAt: undefined,
        autoArchiveExcluded: true,
        autoArchiveExcludedDate: getTodayStr(),
      });
      setSuccessBanner(
        lang === 'ar'
          ? `تمت إعادة طلب الزبون «${v.customerName}» إلى قائمة الطلبات النشطة بنجاح.`
          : `Request for "${v.customerName}" restored to active list.`
      );
      setTimeout(() => setSuccessBanner(''), 4500);
    }
  };

  const cycleVisitStatus = (v: MaintenanceVisit) => {
    const isCurrentlyResolved = Boolean(v.isResolved || v.status === 'resolved' || v.isArchived);
    const cur = v.status || (isCurrentlyResolved ? 'resolved' : 'pending');
    const nextStatus =
      cur === 'pending' ? 'in_progress' : cur === 'in_progress' ? 'resolved' : 'pending';
    const isNowResolved = nextStatus === 'resolved';
    onSaveVisit({
      ...v,
      status: nextStatus,
      isResolved: isNowResolved,
      isArchived: isNowResolved,
      archivedAt: isNowResolved ? getTodayStr() : undefined,
      autoArchiveExcluded: !isNowResolved,
      autoArchiveExcludedDate: !isNowResolved ? getTodayStr() : undefined,
      isPaid: isNowResolved ? v.isPaid : false,
    });
    if (isNowResolved) {
      setSuccessBanner(
        lang === 'ar'
          ? `تم إنهاء مشكلة الزبون «${v.customerName}» وترحيل الطلب إلى المنتهية.`
          : `Request for "${v.customerName}" completed and transferred.`
      );
      setTimeout(() => setSuccessBanner(''), 4000);
    }
  };

  const matchesSearchQuery = (v: MaintenanceVisit, q: string) => {
    if (!q) return true;
    return (
      v.customerName.toLowerCase().includes(q) ||
      v.problem.toLowerCase().includes(q) ||
      Boolean(v.phone && v.phone.includes(q)) ||
      Boolean(v.technicianName && v.technicianName.toLowerCase().includes(q)) ||
      Boolean(v.note && v.note.toLowerCase().includes(q)) ||
      v.visitDate.includes(q) ||
      (v.installedParts || []).some((p) => p.toLowerCase().includes(q)) ||
      (v.requiredParts || []).some((p) => p.toLowerCase().includes(q))
    );
  };

  const handleToggleVisitPaid = (v: MaintenanceVisit) => {
    if (v.noPayment) {
      const isVisitResolved = Boolean(v.isResolved || v.status === 'resolved');
      onSaveVisit({
        ...v,
        noPayment: false,
        isPaid: isVisitResolved,
      });
      return;
    }
    const isVisitResolved = Boolean(v.isResolved || v.status === 'resolved');
    if (!v.isPaid && !isVisitResolved) {
      setSuccessBanner(
        lang === 'ar'
          ? `تنبيه: يجب أن يكون الطلب «منجز (تم الحل)» أولاً قبل تسجيل الدفع للزبون «${v.customerName}».`
          : `Notice: Request for "${v.customerName}" must be marked Completed before marking as Paid.`
      );
      setTimeout(() => setSuccessBanner(''), 4500);
      return;
    }
    onSaveVisit({ ...v, isPaid: !v.isPaid });
  };

  const filteredVisits = dateScopedVisits.filter((v) => {
    const q = searchQuery.trim().toLowerCase();
    if (!matchesSearchQuery(v, q)) return false;
    const isResolved = Boolean(v.isResolved || v.status === 'resolved' || v.isArchived);

    if (statusFilter === 'active') return !isResolved;
    if (statusFilter === 'resolved') return isResolved;
    if (statusFilter === 'in_progress') return !isResolved && v.status === 'in_progress';
    if (statusFilter === 'pending')
      return !isResolved && (v.status === 'pending' || (!v.status && !v.isResolved));
    if (statusFilter === 'unpaid') return isVisitUnpaid(v);
    if (statusFilter === 'portal') return v.source === 'customer_portal' && !isResolved;
    return true;
  });

  // Valid selected IDs among currently displayed visits
  const validSelectedIds = selectedVisitIds.filter((id) =>
    filteredVisits.some((v) => v.id === id)
  );

  const deletableSelectedIds = canDelete ? validSelectedIds : [];

  const toggleVisitSelection = (id: string) => {
    setSelectedVisitIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllDisplayed = () => {
    const allDisplayedIds = filteredVisits.map((v) => v.id);
    const allAlreadySelected =
      allDisplayedIds.length > 0 &&
      allDisplayedIds.every((id) => validSelectedIds.includes(id));

    if (allAlreadySelected) {
      setSelectedVisitIds([]);
    } else {
      setSelectedVisitIds(allDisplayedIds);
    }
  };

  const handleSelectByCount = (countInput?: number) => {
    const num =
      countInput !== undefined
        ? countInput
        : Math.max(0, parseInt(customSelectCount, 10) || 0);
    if (num <= 0) {
      setSelectedVisitIds([]);
      return;
    }
    const targetIds = filteredVisits.slice(0, num).map((v) => v.id);
    setSelectedVisitIds(targetIds);
    setCustomSelectCount(String(targetIds.length));
  };

  const handleSelectCompletedOnly = () => {
    const resolvedIds = filteredVisits
      .filter((v) => v.isResolved || v.status === 'resolved')
      .map((v) => v.id);
    setSelectedVisitIds(resolvedIds);
  };

  const handleBulkDeleteSelected = () => {
    if (deletableSelectedIds.length === 0) return;
    const count = deletableSelectedIds.length;
    deletableSelectedIds.forEach((id) => onDeleteVisit(id));
    setSelectedVisitIds([]);
    setConfirmBulkDelete(false);
    setSuccessBanner(
      lang === 'ar'
        ? `تم حذف (${count}) طلبات صيانة محددة نهائياً.`
        : `Deleted (${count}) selected maintenance requests.`
    );
    setTimeout(() => setSuccessBanner(''), 4500);
  };

  const handleQuickInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCustomer = quickCustomer.trim();
    const cleanProblem = quickProblem.trim();
    if (!cleanCustomer || !cleanProblem) return;

    const matchedCust = customers.find(
      (c) => c.name.toLowerCase() === cleanCustomer.toLowerCase()
    );
    const nowTime = new Date().toTimeString().slice(0, 5) || '10:30';
    const targetDate =
      selectedDateFilter !== 'all' ? selectedDateFilter : getTodayStr();
    const record: MaintenanceVisit = {
      id: `visit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerName: cleanCustomer,
      phone: quickPhone.trim() || matchedCust?.phone || undefined,
      visitType: quickVisitType,
      problem: cleanProblem,
      requiredParts: [],
      installedParts: [],
      visitDate: targetDate,
      visitTime: nowTime,
      isPaid: false,
      amountJod:
        quickVisitType === 'contract'
          ? 0
          : Math.max(0, parseFloat(quickAmount) || 0),
      paymentMethod: 'cash',
      status: 'pending',
      isResolved: false,
      source: 'staff',
      technicianName: currentUserFullName || 'فني الصيانة',
      createdAt: new Date().toISOString(),
    };
    onSaveVisit(record);
    setQuickCustomer('');
    setQuickPhone('');
    setQuickProblem('');
    setQuickAmount('');
    setSuccessBanner(
      lang === 'ar'
        ? `تم تسجيل طلب الصيانة السريع لـ «${record.customerName}» بنجاح.`
        : `Quick maintenance request added for "${record.customerName}".`
    );
    setTimeout(() => setSuccessBanner(''), 3500);
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-2.5 sm:p-3.5 shadow-2xs space-y-2.5">
      {/* Row 1: Compact Carender Date Bar + Action Buttons (بديل الصيانة المتقدمة لسهولة الرجوع للأيام) */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 pb-2 border-b border-slate-100">
        {/* Left: Carender Date Navigation + Today + Show All */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsCalendarModalOpen(true)}
            className="min-h-[34px] px-3 py-1 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>{lang === 'ar' ? '📅 التقويم (Carender)' : 'Carender'}</span>
          </button>

          <button
            type="button"
            onClick={handleJumpToToday}
            className={`min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-colors border ${
              selectedDateFilter === todayStr
                ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
            }`}
            title={lang === 'ar' ? 'عرض طلبات صيانة اليوم' : 'Show Today'}
          >
            <span>{lang === 'ar' ? 'اليوم' : 'Today'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedDateFilter('all');
              setSelectedVisitIds([]);
            }}
            className={`min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors border ${
              selectedDateFilter === 'all'
                ? 'bg-sky-700 text-white border-sky-700 shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
            title={lang === 'ar' ? 'عرض كل الأيام' : 'Show All Days'}
          >
            <span>
              {lang === 'ar'
                ? `عرض الكل (${visits.length})`
                : `Show All (${visits.length})`}
            </span>
          </button>

          {/* Active Date Badge */}
          {selectedDateFilter !== 'all' ? (
            <span className="px-2.5 py-1 rounded-xl bg-sky-50 border border-sky-200 text-[#0B3B68] text-xs font-black flex items-center gap-1">
              <span>{getDayName(selectedDateFilter, lang)}</span>
              <span className="font-mono" dir="ltr">
                ({selectedDateFilter})
              </span>
              <span className="px-1.5 py-0.2 rounded-md bg-[#0B3B68] text-white font-mono text-[10px]" title={lang === 'ar' ? 'طلبات نشطة' : 'Active requests'}>
                {activeSectionVisits.length} {lang === 'ar' ? 'نشط' : 'active'}
              </span>
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-black">
              {lang === 'ar'
                ? `كل الأيام (${activeSectionVisits.length} طلب نشط)`
                : `All Days (${activeSectionVisits.length} active)`}
            </span>
          )}

          {/* Quick Prev / Next Recorded Maintenance Date Arrows */}
          {availableVisitDates.length > 0 && selectedDateFilter !== 'all' && (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                disabled={!prevVisitDateNav}
                onClick={goToPrevVisitDate}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-35 disabled:cursor-not-allowed text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                title={lang === 'ar' ? 'اليوم المسجل السابق' : 'Previous Recorded Day'}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!nextVisitDateNav}
                onClick={goToNextVisitDate}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-35 disabled:cursor-not-allowed text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                title={lang === 'ar' ? 'اليوم المسجل التالي' : 'Next Recorded Day'}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right: Compact Action Buttons */}
        <div className="flex flex-wrap items-center gap-1 justify-between sm:justify-end">
          <div className="flex items-center gap-1 flex-1 sm:flex-initial">
            <button
              type="button"
              onClick={() => {
                setPendingExtractedData(null);
                setIsAddModalOpen(true);
              }}
              className="flex-1 sm:flex-initial min-h-[32px] px-2.5 py-1 rounded-lg bg-[#1E824C] hover:bg-[#145A32] text-white font-extrabold text-[11px] flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>{lang === 'ar' ? 'إضافة طلب' : 'New'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowQuickInlineAdd((prev) => !prev)}
              title={lang === 'ar' ? 'إضافة سريعة في نفس السطر' : 'Quick inline add'}
              className={`min-h-[32px] px-2 py-1 rounded-lg border text-[11px] font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                showQuickInlineAdd
                  ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                  : 'bg-sky-50 hover:bg-sky-100 text-[#0B3B68] border-sky-200'
              }`}
            >
              <Zap className="w-3 h-3 text-[#E58E26] shrink-0" />
              <span>{lang === 'ar' ? 'سريعة' : 'Quick'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="min-h-[32px] px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-[11px] font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-3 h-3 text-[#E58E26] shrink-0" />
              <span>{lang === 'ar' ? 'تصوير' : 'Scan'}</span>
            </button>
          </div>

          {/* View Mode Toggle: Compact Cards vs Ultra-Compact Rows */}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title={lang === 'ar' ? 'عرض بطاقات مدمجة' : 'Compact cards view'}
              className={`p-1 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-[#0B3B68] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('rows')}
              title={lang === 'ar' ? 'عرض صفوف مضغوطة' : 'Ultra-compact rows view'}
              className={`p-1 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer ${
                viewMode === 'rows'
                  ? 'bg-white text-[#0B3B68] shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible 1-Line Quick Inline Request Bar */}
      {showQuickInlineAdd && (
        <form
          onSubmit={handleQuickInlineSubmit}
          className="rounded-xl bg-sky-50/70 border border-sky-200 p-2 flex flex-wrap items-center gap-1.5"
        >
          <div className="flex items-center gap-1 text-xs font-extrabold text-[#0B3B68] px-1">
            <Zap className="w-3.5 h-3.5 text-[#E58E26]" />
            <span>{lang === 'ar' ? 'إضافة سريعة:' : 'Quick Add:'}</span>
          </div>

          <input
            type="text"
            required
            list="quick-inline-customers"
            value={quickCustomer}
            onChange={(e) => {
              const val = e.target.value;
              setQuickCustomer(val);
              const found = customers.find(
                (c) => c.name.toLowerCase() === val.trim().toLowerCase()
              );
              if (found) {
                if (found.phone) setQuickPhone(found.phone);
                if (found.contractType === 'annual' || found.contractType === 'monthly') {
                  setQuickVisitType('contract');
                }
              }
            }}
            placeholder={lang === 'ar' ? 'اسم الزبون / الشركة *' : 'Customer Name *'}
            className="flex-1 min-w-[130px] min-h-[32px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
          />
          <datalist id="quick-inline-customers">
            {customers.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>

          <input
            type="tel"
            dir="ltr"
            value={quickPhone}
            onChange={(e) => setQuickPhone(e.target.value)}
            placeholder={lang === 'ar' ? 'الهاتف' : 'Phone'}
            className="w-28 min-h-[32px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
          />

          <input
            type="text"
            required
            value={quickProblem}
            onChange={(e) => setQuickProblem(e.target.value)}
            placeholder={lang === 'ar' ? 'وصف العطل أو العمل المطلوب *' : 'Problem description *'}
            className="flex-[2] min-w-[160px] min-h-[32px] px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
          />

          <div className="flex items-center rounded-lg bg-white border border-slate-300 p-0.5">
            <button
              type="button"
              onClick={() => setQuickVisitType('visit')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold cursor-pointer ${
                quickVisitType === 'visit'
                  ? 'bg-[#0B3B68] text-white'
                  : 'text-slate-600'
              }`}
            >
              {lang === 'ar' ? 'زيارة' : 'Visit'}
            </button>
            <button
              type="button"
              onClick={() => setQuickVisitType('contract')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold cursor-pointer ${
                quickVisitType === 'contract'
                  ? 'bg-[#0B3B68] text-white'
                  : 'text-slate-600'
              }`}
            >
              {lang === 'ar' ? 'عقد' : 'Contract'}
            </button>
          </div>

          {quickVisitType === 'visit' && (
            <input
              type="number"
              step="0.5"
              min="0"
              dir="ltr"
              value={quickAmount}
              onChange={(e) => setQuickAmount(e.target.value)}
              placeholder="JOD"
              className="w-20 min-h-[32px] px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          )}

          <button
            type="submit"
            className="min-h-[32px] px-3 py-1 rounded-lg bg-[#1E824C] hover:bg-[#145A32] text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'ar' ? 'حفظ' : 'Save'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQuickInlineAdd(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Status Notification Banner */}
      {successBanner && (
        <div
          role="status"
          className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-bold flex flex-wrap items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#1E824C] shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner('')}
            className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Row 2: Compact Status Selector Button (كبسة صغيرة تحدد الحالة لتقليل المساحة وسهولة الاختيار) + Search Box */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* Compact Dropdown Button */}
          <div ref={statusDropdownRef} className="relative">
            {(() => {
              const statusOptions = [
                {
                  id: 'active' as const,
                  ar: 'الطلبات النشطة',
                  en: 'Active Requests',
                  shortAr: 'النشطة',
                  shortEn: 'Active',
                  count: activeSectionVisits.length,
                  icon: Zap,
                  badgeClass: 'bg-[#0B3B68] text-white',
                },
                {
                  id: 'pending' as const,
                  ar: 'في الانتظار',
                  en: 'Pending',
                  shortAr: 'انتظار',
                  shortEn: 'Waiting',
                  count: waitingSectionVisits.length,
                  icon: AlertCircle,
                  badgeClass: 'bg-amber-100 text-amber-900',
                },
                {
                  id: 'in_progress' as const,
                  ar: 'جاري العمل',
                  en: 'In Progress',
                  shortAr: 'جاري العمل',
                  shortEn: 'Working',
                  count: inProgressSectionVisits.length,
                  icon: Wrench,
                  badgeClass: 'bg-sky-100 text-[#0B3B68]',
                },
                {
                  id: 'resolved' as const,
                  ar: 'المنتهية (تم الحل)',
                  en: 'Completed',
                  shortAr: 'المنتهية',
                  shortEn: 'Completed',
                  count: completedSectionVisits.length,
                  icon: CheckCircle2,
                  badgeClass: 'bg-emerald-100 text-[#145A32]',
                },
                {
                  id: 'unpaid' as const,
                  ar: 'ذمم غير مدفوعة',
                  en: 'Unpaid Debts',
                  shortAr: 'ذمم',
                  shortEn: 'Unpaid',
                  count: unpaidSectionVisits.length,
                  icon: Banknote,
                  badgeClass: 'bg-rose-100 text-rose-800',
                },
                {
                  id: 'portal' as const,
                  ar: 'طلبات البوابة الإلكترونية',
                  en: 'Portal Requests',
                  shortAr: 'البوابة',
                  shortEn: 'Portal',
                  count: portalSectionVisits.length,
                  icon: User,
                  badgeClass: 'bg-orange-100 text-orange-900',
                },
                {
                  id: 'all' as const,
                  ar: 'جميع الطلبات (عرض الكل)',
                  en: 'All Requests',
                  shortAr: 'الكل',
                  shortEn: 'All',
                  count: dateScopedVisits.length,
                  icon: List,
                  badgeClass: 'bg-slate-200 text-slate-800',
                },
              ];

              const currentOpt =
                statusOptions.find((o) => o.id === statusFilter) || statusOptions[0];
              const CurrentIcon = currentOpt.icon;

              return (
                <>
                  <button
                    type="button"
                    onClick={() => setIsStatusDropdownOpen((prev) => !prev)}
                    className="min-h-[34px] px-3 py-1 rounded-xl bg-slate-50 hover:bg-white border border-slate-300 text-slate-800 text-xs font-black flex items-center gap-2 cursor-pointer transition-all shadow-2xs hover:border-[#0B3B68]"
                    title={lang === 'ar' ? 'تحديد حالة الطلبات المعروضة' : 'Select Status'}
                  >
                    <CurrentIcon className="w-3.5 h-3.5 text-[#0B3B68] shrink-0" />
                    <span className="font-extrabold text-slate-900">
                      {lang === 'ar' ? currentOpt.shortAr : currentOpt.shortEn}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] font-black tabular-nums ${currentOpt.badgeClass}`}
                    >
                      {currentOpt.count}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                        isStatusDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isStatusDropdownOpen && (
                    <div className="absolute start-0 top-full mt-1.5 w-60 sm:w-64 rounded-2xl bg-white border border-slate-200 shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2.5 py-1 text-2xs font-extrabold text-slate-400 border-b border-slate-100">
                        {lang === 'ar' ? 'اختر حالة الطلبات:' : 'Filter Requests:'}
                      </div>
                      {statusOptions.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = statusFilter === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setStatusFilter(opt.id);
                              setIsStatusDropdownOpen(false);
                            }}
                            className={`w-full min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-extrabold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#0B3B68] text-white shadow-2xs'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon
                                className={`w-3.5 h-3.5 ${
                                  isSelected ? 'text-amber-300' : 'text-slate-500'
                                }`}
                              />
                              <span>{lang === 'ar' ? opt.ar : opt.en}</span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-black tabular-nums ${
                                isSelected ? 'bg-white/20 text-white' : opt.badgeClass
                              }`}
                            >
                              {opt.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none" />
          <input
            id="search-maintenance"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              lang === 'ar'
                ? 'بحث بالزبون، الهاتف، العطل، القطع...'
                : 'Search customer, phone, issue, parts...'
            }
            className="w-full min-h-[34px] ps-8 pe-7 py-1 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute top-1/2 -translate-y-1/2 end-2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Slim Inline Selection & Bulk Action Strip */}
      {filteredVisits.length > 0 && (
        <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleSelectAllDisplayed}
              className="min-h-[26px] px-2.5 py-0.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-[#0B3B68] text-[11px] font-extrabold cursor-pointer"
            >
              {filteredVisits.length > 0 &&
              filteredVisits.every((v) => validSelectedIds.includes(v.id))
                ? lang === 'ar'
                  ? 'إلغاء تحديد الكل'
                  : 'Deselect All'
                : lang === 'ar'
                ? `تحديد الكل (${filteredVisits.length})`
                : `Select All (${filteredVisits.length})`}
            </button>

            <button
              type="button"
              onClick={handleSelectCompletedOnly}
              className="min-h-[26px] px-2.5 py-0.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#145A32] text-[11px] font-extrabold cursor-pointer"
            >
              {lang === 'ar' ? 'تحديد المنتهية' : 'Select Done'}
            </button>

            <div className="hidden sm:flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5">
              <span className="text-[10px] font-bold text-slate-500">
                {lang === 'ar' ? 'أول:' : 'Top:'}
              </span>
              {[5, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleSelectByCount(num)}
                  className="px-1.5 py-0.2 rounded bg-slate-100 hover:bg-[#0B3B68] hover:text-white text-[10px] font-mono font-extrabold text-slate-700 cursor-pointer"
                >
                  {num}
                </button>
              ))}
              <input
                id="custom-select-count-input"
                type="number"
                min="1"
                max={filteredVisits.length}
                dir="ltr"
                value={customSelectCount}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomSelectCount(val);
                  const parsed = parseInt(val, 10);
                  if (!isNaN(parsed) && parsed > 0) {
                    setSelectedVisitIds(
                      filteredVisits.slice(0, parsed).map((v) => v.id)
                    );
                  } else if (val === '') {
                    setSelectedVisitIds([]);
                  }
                }}
                placeholder="#"
                className="w-10 px-1 py-0.2 rounded border border-slate-200 font-mono text-[10px] text-center focus:outline-none"
              />
            </div>

            {validSelectedIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-[#0B3B68] text-white font-mono text-[11px] font-extrabold">
                {lang === 'ar'
                  ? `المحدد: ${validSelectedIds.length}`
                  : `Selected: ${validSelectedIds.length}`}
              </span>
            )}
          </div>

          {deletableSelectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmBulkDelete(true)}
              className="min-h-[26px] px-2.5 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>
                {lang === 'ar'
                  ? `حذف (${deletableSelectedIds.length})`
                  : `Delete (${deletableSelectedIds.length})`}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Visits List: Either Compact Cards or Ultra-Compact Rows */}
      {filteredVisits.length === 0 ? (
        <div className="py-8 text-center space-y-2.5">
          <p className="text-xs sm:text-sm font-bold text-slate-500">
            {selectedDateFilter !== 'all'
              ? lang === 'ar'
                ? `لا توجد طلبات صيانة مسجلة في يوم ${getDayName(selectedDateFilter, lang)} (${selectedDateFilter}).`
                : `No maintenance requests on ${selectedDateFilter}.`
              : lang === 'ar'
              ? 'لا توجد طلبات صيانة مطابقة للفلتر الحالي.'
              : 'No maintenance requests match the current filter.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-[#1E824C] hover:bg-[#145A32] text-white font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'إضافة طلب صيانة' : 'Add Request'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCalendarModalOpen(true)}
              className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-300" />
              <span>{lang === 'ar' ? 'اختيار يوم من التقويم' : 'Open Carender'}</span>
            </button>
            {selectedDateFilter !== 'all' && visits.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedDateFilter('all')}
                className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>
                  {lang === 'ar'
                    ? `عرض الكل (${visits.length})`
                    : `Show All (${visits.length})`}
                </span>
              </button>
            )}
          </div>
        </div>
      ) : viewMode === 'rows' ? (
        /* ULTRA-COMPACT ROW VIEW */
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-extrabold">
                <th className="p-2 w-8 text-center">#</th>
                <th className="p-2 text-start">{lang === 'ar' ? 'الزبون' : 'Customer'}</th>
                <th className="p-2 text-start">{lang === 'ar' ? 'العطل والقطع' : 'Issue & Parts'}</th>
                <th className="p-2 text-start whitespace-nowrap">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="p-2 text-start whitespace-nowrap">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="p-2 text-start whitespace-nowrap">{lang === 'ar' ? 'المبلغ والدفع' : 'Amount'}</th>
                <th className="p-2 text-end whitespace-nowrap">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredVisits.map((v) => {
                const isVisitResolved = Boolean(v.isResolved || v.status === 'resolved' || v.isArchived);
                const isVisitInProgress = v.status === 'in_progress' && !isVisitResolved;
                const isUnpaid = isVisitUnpaid(v);
                const isSelected = validSelectedIds.includes(v.id);
                const canDeleteThisVisit = Boolean(canDelete);

                return (
                  <tr
                    key={v.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-sky-50/70'
                        : isUnpaid
                        ? 'bg-rose-50/45 hover:bg-rose-50/70 border-s-4 border-s-rose-500'
                        : isVisitResolved
                        ? 'bg-emerald-50/20 hover:bg-slate-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleVisitSelection(v.id)}
                        className="w-3.5 h-3.5 rounded text-[#0B3B68] cursor-pointer"
                      />
                    </td>
                    <td className="p-2 font-extrabold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <bdi>{v.customerName}</bdi>
                        {isUnpaid && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-extrabold">
                            {lang === 'ar' ? 'ذمة' : 'Unpaid'}
                          </span>
                        )}
                        {v.visitType === 'contract' && (
                          <span className="px-1.5 py-0.2 rounded bg-sky-100 text-[#0B3B68] text-[10px] font-bold">
                            {lang === 'ar' ? 'عقد' : 'Contract'}
                          </span>
                        )}
                      </div>
                      {v.phone && (
                        <div dir="ltr" className="text-[10px] font-mono text-slate-500">
                          {v.phone}
                        </div>
                      )}
                    </td>
                    <td className="p-2 max-w-xs">
                      <div className="font-semibold text-slate-800 truncate" title={v.problem}>
                        <bdi>{v.problem}</bdi>
                      </div>
                      {(v.installedParts.length > 0 || v.requiredParts.length > 0) && (
                        <div className="text-[10px] text-slate-500 truncate">
                          {v.installedParts.length > 0 && (
                            <span className="text-[#145A32] font-bold me-2">
                              ✓ <bdi>{v.installedParts.join(' + ')}</bdi>
                            </span>
                          )}
                          {v.requiredParts.length > 0 && (
                            <span className="text-amber-800 font-bold">
                              • <bdi>{v.requiredParts.join(' + ')}</bdi>
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-2 whitespace-nowrap font-mono text-[11px] text-slate-600">
                      <div dir="ltr">{v.visitDate}</div>
                      <div dir="ltr" className="text-[10px] text-slate-400">
                        {v.visitTime}
                      </div>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => cycleVisitStatus(v)}
                        title={lang === 'ar' ? 'اضغط لتغيير حالة الطلب' : 'Click to cycle status'}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold cursor-pointer transition-transform active:scale-95 ${
                          isVisitResolved
                            ? 'bg-emerald-100 text-[#145A32]'
                            : isVisitInProgress
                            ? 'bg-sky-100 text-[#0B3B68]'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {isVisitResolved
                          ? lang === 'ar'
                            ? 'منجز'
                            : 'Resolved'
                          : isVisitInProgress
                          ? lang === 'ar'
                            ? 'جاري العمل'
                            : 'In Progress'
                          : lang === 'ar'
                          ? 'انتظار'
                          : 'Waiting'}
                      </button>
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {v.visitType === 'contract' ? (
                        <span className="text-[11px] font-bold text-slate-500">
                          {lang === 'ar' ? 'عقد دوري' : 'Contract'}
                        </span>
                      ) : v.noPayment ? (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-extrabold text-[#0B3B68]">
                          {lang === 'ar' ? 'بدون دفع' : 'No Payment'}
                        </span>
                      ) : (
                        <div>
                          <div className="font-mono font-extrabold text-slate-900">
                            {formatJod(v.amountJod, lang)}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleVisitPaid(v)}
                            className={`text-[10px] font-bold underline cursor-pointer ${
                              v.isPaid ? 'text-[#1E824C]' : 'text-amber-700'
                            }`}
                          >
                            {v.isPaid
                              ? lang === 'ar'
                                ? 'مدفوع'
                                : 'Paid'
                              : lang === 'ar'
                              ? 'غير مدفوع'
                              : 'Unpaid'}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-end whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleResolveAndTransfer(v)}
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-extrabold inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs ${
                            isVisitResolved
                              ? 'border-emerald-300 bg-emerald-50 text-[#145A32] hover:bg-emerald-100'
                              : 'border-emerald-600 bg-[#1E824C] hover:bg-[#145A32] text-white shadow-xs'
                          }`}
                          title={
                            isVisitResolved
                              ? lang === 'ar'
                                ? 'طلب منجز ومرحّل — اضغط لإلغاء الترحيل وإعادته للنشطة'
                                : 'Completed & transferred — click to reopen'
                              : lang === 'ar'
                              ? 'تم الزبون · إنهاء المشكلة وترحيل الطلب'
                              : 'Customer Done · Resolve and transfer request'
                          }
                        >
                          <CheckCircle2
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isVisitResolved ? 'text-[#1E824C]' : 'text-white'
                            }`}
                          />
                          <span>
                            {isVisitResolved
                              ? lang === 'ar'
                                ? 'منجز (مرحّل)'
                                : 'Done (Archived)'
                              : lang === 'ar'
                              ? 'تم الزبون · إنهاء المشكلة'
                              : 'Done / Resolve'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingModalVisit(v)}
                          className="px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-[#0B3B68] hover:bg-indigo-100 text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3 shrink-0" />
                          <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                        </button>
                        {canDeleteThisVisit && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(v)}
                            className="px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-[10px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3 shrink-0" />
                            <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* COMPACT CARDS VIEW */
        <div className="divide-y divide-slate-200/80">
          {filteredVisits.map((v) => {
            const pmLabel =
              v.paymentMethod === 'cash'
                ? lang === 'ar'
                  ? 'كاش'
                  : 'Cash'
                : v.paymentMethod === 'check'
                ? lang === 'ar'
                  ? 'شيك'
                  : 'Check'
                : lang === 'ar'
                ? 'كلك'
                : 'CliQ';

            const isVisitResolved = Boolean(v.isResolved || v.status === 'resolved' || v.isArchived);
            const isVisitInProgress = v.status === 'in_progress' && !isVisitResolved;
            const isUnpaid = isVisitUnpaid(v);
            const isSelected = validSelectedIds.includes(v.id);
            const canDeleteThisVisit = Boolean(canDelete);

            return (
              <div
                key={v.id}
                className={`py-2.5 px-2.5 first:pt-1 last:pb-1 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 transition-colors rounded-xl ${
                  isSelected
                    ? 'bg-sky-50/70 ring-1 ring-[#0B3B68]/25'
                    : isUnpaid
                    ? 'bg-rose-50/45 border-s-4 border-s-rose-500 ring-1 ring-rose-200/80 hover:bg-rose-50/70'
                    : isVisitResolved
                    ? 'bg-emerald-50/20 hover:bg-slate-50/80'
                    : 'hover:bg-slate-50/70'
                }`}
              >
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleVisitSelection(v.id)}
                    aria-label={
                      lang === 'ar'
                        ? `تحديد طلب ${v.customerName}`
                        : `Select ${v.customerName}`
                    }
                    className="mt-1 w-4 h-4 rounded border-slate-300 text-[#0B3B68] focus:ring-[#0B3B68] cursor-pointer shrink-0"
                  />

                  <div className="space-y-1 flex-1 min-w-0">
                    {/* Line 1: Customer Name + Status Badge + Type + Phone + Date + Amount */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="text-sm font-extrabold text-[#0B3B68]">
                          <bdi>{v.customerName}</bdi>
                        </h4>

                        {isUnpaid && (
                          <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-extrabold inline-flex items-center gap-0.5">
                            <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                            <span>{lang === 'ar' ? 'ذمة' : 'Unpaid'}</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => cycleVisitStatus(v)}
                          title={
                            lang === 'ar'
                              ? 'اضغط للتنقل بين: قيد الانتظار ← جاري العمل ← تم الحل'
                              : 'Click to cycle status: Waiting -> In Progress -> Completed'
                          }
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold cursor-pointer transition-transform active:scale-95 ${
                            isVisitResolved
                              ? 'bg-emerald-100 text-[#145A32]'
                              : isVisitInProgress
                              ? 'bg-sky-100 text-[#0B3B68]'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {isVisitResolved
                            ? lang === 'ar'
                              ? 'تم الحل'
                              : 'Completed'
                            : isVisitInProgress
                            ? lang === 'ar'
                              ? 'جاري العمل'
                              : 'In Progress'
                            : lang === 'ar'
                            ? 'قيد الانتظار'
                            : 'Waiting'}
                        </button>

                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-600">
                          {v.visitType === 'contract'
                            ? lang === 'ar'
                              ? 'عقد'
                              : 'Contract'
                            : lang === 'ar'
                            ? 'زيارة'
                            : 'Visit'}
                        </span>

                        {v.source === 'customer_portal' && (
                          <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-900 text-[10px] font-extrabold">
                            {lang === 'ar' ? 'بوابة الزبائن' : 'Portal'}
                          </span>
                        )}

                        {v.phone && (
                          <span
                            dir="ltr"
                            className="text-[11px] font-mono tabular-nums text-slate-500 inline-flex items-center gap-0.5"
                          >
                            <Phone className="w-2.5 h-2.5" />
                            {v.phone}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                          <Calendar className="w-3 h-3 text-[#0B3B68]" />
                          <span dir="ltr">{v.visitDate}</span>
                          <span dir="ltr">({v.visitTime})</span>
                        </span>

                        {v.technicianName && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <User className="w-3 h-3" />
                            <bdi>{v.technicianName}</bdi>
                          </span>
                        )}
                      </div>

                      {/* Compact Amount Pill on Header Row */}
                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 font-mono text-xs font-extrabold tabular-nums text-[#0B3B68] shrink-0">
                        {v.visitType === 'contract'
                          ? lang === 'ar'
                            ? 'عقد دوري'
                            : 'Contract'
                          : v.noPayment
                          ? lang === 'ar'
                            ? 'بدون دفع'
                            : 'No Payment'
                          : formatJod(v.amountJod, lang)}
                      </span>
                    </div>

                    {/* Line 2: Problem Description + Parts + Note inline */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                      <span className="font-bold text-slate-800 leading-snug break-words">
                        <bdi>{v.problem}</bdi>
                      </span>

                      {v.installedParts.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[#145A32] text-[11px] font-bold">
                          {lang === 'ar' ? 'ركب: ' : 'Installed: '}
                          <bdi>{v.installedParts.join(' + ')}</bdi>
                        </span>
                      )}

                      {v.requiredParts.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold">
                          {lang === 'ar' ? 'يلزم: ' : 'Required: '}
                          <bdi>{v.requiredParts.join(' + ')}</bdi>
                        </span>
                      )}

                      {v.nextVisitDate && (
                        <span className="px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[#155E95] text-[11px] font-bold font-mono">
                          {lang === 'ar' ? 'القادمة: ' : 'Next: '}
                          {v.nextVisitDate}
                        </span>
                      )}

                      {v.note && (
                        <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                          <FileText className="w-3 h-3 shrink-0" />
                          <bdi>{v.note}</bdi>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Compact Single-Line Action Bar */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 pt-1.5 lg:pt-0 border-t lg:border-t-0 border-slate-100 w-full lg:w-auto shrink-0">
                  {/* 1. Completion (تم الزبون · إنهاء المشكلة) comes FIRST before Payment (الدفع) */}
                  <button
                    type="button"
                    onClick={() => handleResolveAndTransfer(v)}
                    className={`flex-1 sm:flex-initial min-h-[32px] px-3 py-1 rounded-lg border text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                      isVisitResolved
                        ? 'border-emerald-300 bg-emerald-50 text-[#145A32] hover:bg-emerald-100'
                        : 'border-emerald-600 bg-[#1E824C] hover:bg-[#145A32] text-white shadow-xs'
                    }`}
                    title={
                      isVisitResolved
                        ? lang === 'ar'
                          ? 'طلب منجز ومرحّل — اضغط لإلغاء الترحيل وإعادته للنشطة'
                          : 'Completed & transferred — click to reopen'
                        : lang === 'ar'
                        ? 'تم الزبون · إنهاء المشكلة وترحيل الطلب'
                        : 'Customer Done · Resolve and transfer request'
                    }
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isVisitResolved ? 'text-[#1E824C]' : 'text-white'
                      }`}
                    />
                    <span>
                      {isVisitResolved
                        ? lang === 'ar'
                          ? 'منجز (مرحّل)'
                          : 'Done (Archived)'
                        : lang === 'ar'
                        ? 'تم الزبون · إنهاء المشكلة'
                        : 'Done / Resolve'}
                    </span>
                  </button>

                  {/* 2. Payment Status (الدفع بعد الإنجاز) */}
                  {v.visitType !== 'contract' && (
                    <button
                      type="button"
                      onClick={() => handleToggleVisitPaid(v)}
                      className={`flex-1 sm:flex-initial min-h-[30px] px-2.5 py-1 rounded-lg border text-[11px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                        v.noPayment
                          ? 'border-slate-300 bg-slate-100 text-[#0B3B68] hover:bg-slate-200'
                          : v.isPaid
                          ? 'border-emerald-300 bg-emerald-50 text-[#145A32] hover:bg-emerald-100'
                          : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {v.noPayment
                          ? lang === 'ar'
                            ? 'بدون دفع'
                            : 'No Payment'
                          : v.isPaid
                          ? `${lang === 'ar' ? 'مدفوع' : 'Paid'} (${pmLabel})`
                          : lang === 'ar'
                          ? 'غير مدفوع'
                          : 'Unpaid'}
                      </span>
                    </button>
                  )}

                  {/* 3. Edit (تعديل) */}
                  <button
                    type="button"
                    onClick={() => setEditingModalVisit(v)}
                    className="flex-1 sm:flex-initial min-h-[30px] px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50/90 hover:bg-indigo-100 text-[#0B3B68] text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shadow-2xs"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#155E95] shrink-0" />
                    <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                  </button>

                  {/* 4. Delete (حذف) */}
                  {canDeleteThisVisit && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(v)}
                      aria-label={lang === 'ar' ? `حذف زيارة ${v.customerName}` : `Delete visit`}
                      className="flex-1 sm:flex-initial min-h-[30px] px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50/90 hover:bg-rose-100 text-rose-700 text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sleek & Compact Carender Modal for Maintenance (جدول الأيام والتواريخ بطريقة سهلة وجميلة ولا تأخذ مساحة) */}
      {isCalendarModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 sm:p-4 space-y-2.5 max-h-[90vh] overflow-y-auto">
            {/* Compact Modal Header */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 text-[#0B3B68] flex items-center justify-center shrink-0">
                  <Wrench className="w-4 h-4 text-[#0B3B68]" />
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  {lang === 'ar' ? 'تقويم الصيانة (Carender)' : 'Maintenance Carender'}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleJumpToToday}
                  className={`min-h-[32px] px-2.5 py-1 rounded-xl text-xs font-black cursor-pointer border transition-colors ${
                    selectedDateFilter === todayStr
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                  }`}
                >
                  {lang === 'ar' ? 'اليوم' : 'Today'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDateFilter('all');
                    setSelectedVisitIds([]);
                    setIsCalendarModalOpen(false);
                  }}
                  className={`min-h-[32px] px-2.5 py-1 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    selectedDateFilter === 'all'
                      ? 'bg-sky-700 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {lang === 'ar' ? 'عرض الكل' : 'Show All'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCalendarModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  title={lang === 'ar' ? 'إغلاق' : 'Close'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Month Navigation & Compact Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (calendarMonth === 1) {
                      setCalendarMonth(12);
                      setCalendarYear((y) => y - 1);
                    } else {
                      setCalendarMonth((m) => m - 1);
                    }
                  }}
                  className="min-h-[30px] px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'السابق' : 'Prev'}</span>
                </button>
                <div className="min-h-[30px] px-2.5 py-0.5 rounded-lg bg-sky-50 text-[#0B3B68] border border-sky-200 text-xs font-black flex items-center gap-1">
                  <span>{monthNames[lang][calendarMonth - 1]}</span>
                  <span className="font-mono">{calendarYear}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (calendarMonth === 12) {
                      setCalendarMonth(1);
                      setCalendarYear((y) => y + 1);
                    } else {
                      setCalendarMonth((m) => m + 1);
                    }
                  }}
                  className="min-h-[30px] px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{lang === 'ar' ? 'التالي' : 'Next'}</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="px-2 py-0.5 rounded bg-sky-50 text-[#0B3B68] border border-sky-200 text-[11px] font-black font-mono">
                {lang === 'ar'
                  ? `${monthVisits.length} طلب بالشهر`
                  : `${monthVisits.length} in month`}
              </span>
            </div>

            {/* Quick Recorded Maintenance Dates Strip (لسهولة الرجوع للأيام المسجلة بضغطة واحدة) */}
            {visitDateSummaries.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-extrabold text-slate-500">
                  {lang === 'ar'
                    ? `الأيام المسجلة (${visitDateSummaries.length}):`
                    : `Recorded Days (${visitDateSummaries.length}):`}
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {visitDateSummaries.slice(0, 14).map((d) => {
                    const isActive = selectedDateFilter === d.dateStr;
                    return (
                      <button
                        key={d.dateStr}
                        type="button"
                        onClick={() => {
                          const [y, m] = d.dateStr.split('-').map(Number);
                          setCalendarYear(y);
                          setCalendarMonth(m);
                          setSelectedDateFilter(d.dateStr);
                          setSelectedVisitIds([]);
                          setIsCalendarModalOpen(false);
                        }}
                        className={`shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-[#0B3B68] text-white border-[#0B3B68] shadow-2xs'
                            : 'bg-slate-50 hover:bg-sky-50 text-slate-800 border-slate-200'
                        }`}
                      >
                        <span>{getDayName(d.dateStr, lang)}</span>
                        <span className="font-mono" dir="ltr">
                          {d.dateStr}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-sky-100 text-[#0B3B68]'
                          }`}
                        >
                          {d.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Compact 7-Column Calendar Grid */}
            <div className="space-y-1">
              <div className="grid grid-cols-7 gap-1 text-center">
                {calendarWeekdays.map((wd, i) => (
                  <div
                    key={i}
                    className="py-1 rounded-lg bg-slate-100 text-slate-700 font-black text-[11px] select-none"
                  >
                    {lang === 'ar' ? wd.ar : wd.en}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell) => {
                  const dateStat = visitDateSummariesMap.get(cell.dateStr);
                  const isSelected = selectedDateFilter === cell.dateStr;
                  const isToday = cell.dateStr === todayStr;
                  const hasData = Boolean(dateStat && dateStat.count > 0);

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => {
                        setSelectedDateFilter(cell.dateStr);
                        setSelectedVisitIds([]);
                        setIsCalendarModalOpen(false);
                      }}
                      className={`min-h-[48px] sm:min-h-[52px] p-1 sm:p-1.5 rounded-xl text-start transition-all cursor-pointer relative flex flex-col justify-between border ${
                        isSelected
                          ? 'bg-[#0B3B68] text-white border-[#0B3B68] shadow-sm ring-2 ring-[#0B3B68]/25'
                          : hasData
                          ? cell.isCurrentMonth
                            ? 'bg-sky-50/70 hover:bg-sky-100/80 text-slate-900 border-sky-300 shadow-2xs'
                            : 'bg-sky-50/30 hover:bg-sky-50/60 text-slate-600 border-sky-200/60'
                          : cell.isCurrentMonth
                          ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/80'
                          : 'bg-slate-50/50 hover:bg-slate-100 text-slate-400 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-0.5 w-full">
                        <span
                          className={`text-xs font-mono font-black leading-none ${
                            isSelected
                              ? 'text-white'
                              : isToday
                              ? 'text-amber-600'
                              : cell.isCurrentMonth
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {cell.dayNum}
                        </span>
                        {isToday && (
                          <span
                            className={`text-[9px] font-black px-1 py-0.2 rounded ${
                              isSelected
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {lang === 'ar' ? 'اليوم' : 'Today'}
                          </span>
                        )}
                      </div>

                      {hasData && dateStat ? (
                        <div className="w-full space-y-0.5 mt-0.5">
                          <div
                            className={`text-[10px] font-mono font-black truncate leading-tight px-1 py-0.2 rounded text-center ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : dateStat.unpaidCount > 0
                                ? 'bg-rose-100 text-rose-900'
                                : 'bg-emerald-100/90 text-emerald-900'
                            }`}
                          >
                            {lang === 'ar'
                              ? `${dateStat.count} طلب`
                              : `${dateStat.count} req`}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[9px] text-center opacity-25 font-mono">
                          —
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Add / Edit Maintenance Request Modal */}
      {(isAddModalOpen || Boolean(editingModalVisit)) && (
        <EditDailyMaintenanceModal
          lang={lang}
          visit={editingModalVisit}
          isOpen={isAddModalOpen || Boolean(editingModalVisit)}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingModalVisit(null);
            setPendingExtractedData(null);
            onClearPreselectedCustomer?.();
          }}
          onSave={(savedRecord) => {
            const isEditing = Boolean(editingModalVisit);
            onSaveVisit(savedRecord);
            if (
              selectedDateFilter !== 'all' &&
              savedRecord.visitDate &&
              savedRecord.visitDate !== selectedDateFilter
            ) {
              setSelectedDateFilter(savedRecord.visitDate);
              const [y, m] = savedRecord.visitDate.split('-').map(Number);
              if (y && m) {
                setCalendarYear(y);
                setCalendarMonth(m);
              }
            }
            setIsAddModalOpen(false);
            setEditingModalVisit(null);
            setPendingExtractedData(null);
            onClearPreselectedCustomer?.();
            setSuccessBanner(
              isEditing
                ? lang === 'ar'
                  ? `تم حفظ وتحديث طلب الصيانة لـ «${savedRecord.customerName}» بنجاح.`
                  : `Updated maintenance request for "${savedRecord.customerName}" successfully.`
                : lang === 'ar'
                ? `تمت إضافة طلب الصيانة لـ «${savedRecord.customerName}» بنجاح.`
                : `Added maintenance request for "${savedRecord.customerName}" successfully.`
            );
            setTimeout(() => setSuccessBanner(''), 4000);
          }}
          customers={customers}
          parts={parts}
          defaultTechnicianName={currentUserFullName}
          initialCustomerName={preselectedCustomerName}
          initialExtractedData={pendingExtractedData}
        />
      )}

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        title={
          lang === 'ar'
            ? 'تأكيد حذف زيارة الصيانة'
            : 'Confirm Deleting Maintenance Visit'
        }
        itemName={
          deleteTarget
            ? `${deleteTarget.customerName} — ${deleteTarget.problem} (${deleteTarget.visitDate})`
            : ''
        }
        lang={lang}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteVisit(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />

      <ConfirmDeleteModal
        isOpen={confirmBulkDelete}
        title={
          lang === 'ar'
            ? 'تأكيد حذف طلبات الصيانة المحددة'
            : 'Confirm Deleting Selected Maintenance Requests'
        }
        itemName={
          lang === 'ar'
            ? `سيتم حذف (${deletableSelectedIds.length}) طلبات صيانة محددة نهائياً`
            : `Permanently delete (${deletableSelectedIds.length}) selected maintenance requests`
        }
        lang={lang}
        onCancel={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDeleteSelected}
      />

      <WorkNotesScannerModal
        lang={lang}
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onInsertNotes={(scannedText) => {
          setPendingExtractedData({
            transcribedText: scannedText.trim(),
            problem: scannedText.trim(),
          });
          setIsAddModalOpen(true);
        }}
        onApplyExtractedData={(data) => {
          setPendingExtractedData({
            ...data,
            problem: data.problem || data.transcribedText,
          });
          setIsAddModalOpen(true);
        }}
      />

      <DailyMaintenanceReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        lang={lang}
        allVisits={visits}
        initialPeriod={maintenanceReportPeriod}
        initialReferenceDate={
          selectedDateFilter !== 'all' ? selectedDateFilter : todayStr
        }
        initialVisits={
          validSelectedIds.length > 0
            ? filteredVisits.filter((v) => validSelectedIds.includes(v.id))
            : undefined
        }
        initialScope={validSelectedIds.length > 0 ? 'custom_list' : 'all'}
        currentUserFullName={currentUserFullName}
      />
    </div>
  );
};
