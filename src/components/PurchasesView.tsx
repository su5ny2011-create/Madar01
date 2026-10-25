import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cpu,
  CreditCard,
  DollarSign,
  Edit3,
  Eye,
  Filter,
  FolderOpen,
  Layers,
  List,
  Lock,
  Package,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import type {
  Language,
  PartItem,
  PurchasePaymentMethod,
  PurchaseRecord,
} from '../types';
import { addDaysStr, formatJod, getDayName, getTodayStr } from '../utils/logic';
import {
  cleanAndFormatText,
  cleanSupplierName,
  cleanInvoiceNumber,
} from '../utils/textFormatter';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { EditPurchaseModal } from './EditPurchaseModal';
import {
  InvoiceScannerModal,
  type ExtractedPurchaseItem,
} from './InvoiceScannerModal';

interface PurchasesViewProps {
  lang: Language;
  purchases: PurchaseRecord[];
  parts: PartItem[];
  suppliers?: string[];
  canDelete?: boolean;
  onSavePurchase: (record: PurchaseRecord) => void;
  onDeletePurchase: (id: string) => void;
  onAddSupplier?: (supplierName: string) => void;
  onRenameSupplier?: (oldName: string, newName: string) => void;
  onDeleteSupplier?: (supplierName: string) => void;
  onSettleCreditPurchase: (
    purchaseId: string,
    settleMethod: 'cash' | 'cliq',
    settleDate: string
  ) => void;
  onBatchInsertPurchases: (
    items: ExtractedPurchaseItem[],
    metadata: {
      supplierName: string;
      invoiceNumber: string;
      invoiceDate: string;
      paymentMethod: PurchasePaymentMethod;
      notes: string;
      invoiceImageUrl?: string;
    }
  ) => void;
  onOpenFinance?: () => void;
  onOpenCatalogs?: () => void;
}

const ALL_SUPPLIERS_TAB = '__ALL__';
const UNASSIGNED_SUPPLIER_TAB = '__NONE__';

function getPurchaseEntryDate(p: PurchaseRecord): string {
  if (typeof p.createdAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(p.createdAt)) {
    return p.createdAt.slice(0, 10);
  }
  return '';
}

function getPurchaseEffectiveDate(p: PurchaseRecord): string {
  const entryDate = getPurchaseEntryDate(p);
  const rawInv = (p.invoiceDate || '').trim().slice(0, 10);
  if (entryDate && (!rawInv || rawInv.slice(0, 4) < entryDate.slice(0, 4))) {
    return entryDate;
  }
  return rawInv || entryDate || getTodayStr();
}

function doesPurchaseMatchDate(p: PurchaseRecord, targetDate: string): boolean {
  if (targetDate === 'all') return true;
  const eff = getPurchaseEffectiveDate(p);
  const rawInv = (p.invoiceDate || '').trim().slice(0, 10);
  const entry = getPurchaseEntryDate(p);
  return eff === targetDate || rawInv === targetDate || (Boolean(entry) && entry === targetDate);
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  lang,
  purchases: rawPurchases = [],
  parts = [],
  suppliers = [],
  canDelete = true,
  onSavePurchase,
  onDeletePurchase,
  onAddSupplier,
  onRenameSupplier,
  onDeleteSupplier,
  onSettleCreditPurchase,
  onBatchInsertPurchases,
  onOpenFinance,
  onOpenCatalogs,
}) => {
  // Normalize purchases so any OCR-hallucinated past year (e.g. 2024) aligns with the actual entry date (createdAt)
  const purchases = useMemo(
    () =>
      rawPurchases.map((p) => {
        const effDate = getPurchaseEffectiveDate(p);
        if (p.invoiceDate !== effDate) {
          return { ...p, invoiceDate: effDate };
        }
        return p;
      }),
    [rawPurchases]
  );

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRecord | null>(null);
  const [modalDefaultSupplier, setModalDefaultSupplier] = useState<string>('');
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseRecord | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Supplier sub-page / tab state ('__ALL__' = Main Purchases Page, or supplier name) + Suppliers Modal (similar to Carender)
  const [selectedSupplierTab, setSelectedSupplierTab] = useState<string>(ALL_SUPPLIERS_TAB);
  const [isSuppliersModalOpen, setIsSuppliersModalOpen] = useState<boolean>(false);
  const [supplierModalSearch, setSupplierModalSearch] = useState<string>('');
  const [supplierModalFilter, setSupplierModalFilter] = useState<'all' | 'unpaid'>('all');
  const [isAddingSupplierPage, setIsAddingSupplierPage] = useState(false);
  const [newSupplierPageName, setNewSupplierPageName] = useState('');

  // Edit Supplier Page Modal state
  const [editingSupplierName, setEditingSupplierName] = useState<string | null>(null);
  const [editedSupplierInput, setEditedSupplierInput] = useState('');

  // Delete Supplier Page Confirmation Modal state
  const [supplierToDelete, setSupplierToDelete] = useState<{
    name: string;
    itemsCount: number;
    totalCostJod: number;
    unpaidCostJod: number;
  } | null>(null);

  // Quick Inline Add Form in Main Purchases Page
  const [showQuickAddBar, setShowQuickAddBar] = useState(false);
  const [quickPartName, setQuickPartName] = useState('');
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [quickQty, setQuickQty] = useState('1');
  const [quickUnitCost, setQuickUnitCost] = useState('');
  const [quickPaymentMethod, setQuickPaymentMethod] = useState<PurchasePaymentMethod>('cash');
  const [quickCategory, setQuickCategory] = useState('تخزين وهاردوير');
  const [quickInvoiceNo, setQuickInvoiceNo] = useState('');

  // Settle credit modal state (supports single purchase or batch invoice/supplier items)
  const [settleTargets, setSettleTargets] = useState<PurchaseRecord[]>([]);
  const [settleMethod, setSettleMethod] = useState<'cash' | 'cliq'>('cash');
  const [settleDate, setSettleDate] = useState(getTodayStr());

  // Search, Filter & View Mode state (Default to 'invoices' so invoices entered on any date show clearly)
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<'all' | PurchasePaymentMethod | 'unpaid'>(
    'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'items' | 'invoices'>('invoices');
  const [successBanner, setSuccessBanner] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>(getTodayStr());

  // Carender Calendar State for Purchases
  const todayStr = useMemo(() => getTodayStr(), []);
  const [initialYear, initialMonth] = useMemo(() => {
    const [y, m] = todayStr.split('-').map(Number);
    return [y, m];
  }, [todayStr]);
  const [calendarYear, setCalendarYear] = useState<number>(initialYear);
  const [calendarMonth, setCalendarMonth] = useState<number>(initialMonth);
  const [isPurchasesCalendarModalOpen, setIsPurchasesCalendarModalOpen] = useState<boolean>(false);

  const monthNames = {
    ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
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

  // Build list of all Supplier Pages (from custom suppliers + purchases + parts) with stats
  const supplierPages = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        itemsCount: number;
        invoicesSet: Set<string>;
        latestDate: string;
        totalCostJod: number;
        unpaidCostJod: number;
        unpaidCount: number;
      }
    >();

    const ensureSupplier = (rawName?: string) => {
      if (!rawName) return null;
      const cleaned = cleanSupplierName(rawName);
      if (!cleaned) return null;
      const key = cleaned.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: cleaned,
          itemsCount: 0,
          invoicesSet: new Set<string>(),
          latestDate: '',
          totalCostJod: 0,
          unpaidCostJod: 0,
          unpaidCount: 0,
        });
      }
      return map.get(key)!;
    };

    suppliers.forEach((s) => ensureSupplier(s));
    parts.forEach((pt) => {
      if (pt.supplierName) ensureSupplier(pt.supplierName);
    });
    purchases.forEach((p) => {
      const entry = ensureSupplier(p.supplierName);
      if (entry) {
        entry.itemsCount += 1;
        const pDate = getPurchaseEffectiveDate(p);
        const invKey = p.invoiceNumber ? `inv-${p.invoiceNumber}-${pDate}` : `date-${pDate}-${p.paymentMethod}`;
        entry.invoicesSet.add(invKey);
        if (pDate > entry.latestDate) {
          entry.latestDate = pDate;
        }
        entry.totalCostJod =
          Math.round((entry.totalCostJod + (p.totalCostJod || 0)) * 100) / 100;
        if (p.paymentMethod === 'credit' && !p.isPaid) {
          entry.unpaidCount += 1;
          entry.unpaidCostJod =
            Math.round((entry.unpaidCostJod + (p.totalCostJod || 0)) * 100) / 100;
        }
      }
    });

    return Array.from(map.values())
      .map((s) => ({
        name: s.name,
        itemsCount: s.itemsCount,
        invoicesCount: s.invoicesSet.size,
        latestDate: s.latestDate,
        totalCostJod: s.totalCostJod,
        unpaidCostJod: s.unpaidCostJod,
        unpaidCount: s.unpaidCount,
      }))
      .sort((a, b) => {
        if (b.itemsCount !== a.itemsCount) return b.itemsCount - a.itemsCount;
        return a.name.localeCompare(b.name, 'ar');
      });
  }, [purchases, parts, suppliers]);

  const allSupplierNames = useMemo(
    () => supplierPages.map((s) => s.name),
    [supplierPages]
  );

  const filteredSupplierPagesForModal = useMemo(() => {
    const q = supplierModalSearch.trim().toLowerCase();
    return supplierPages.filter((s) => {
      if (supplierModalFilter === 'unpaid' && s.unpaidCostJod <= 0) {
        return false;
      }
      if (q && !s.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [supplierPages, supplierModalSearch, supplierModalFilter]);

  const unassignedPurchases = useMemo(
    () => purchases.filter((p) => !cleanSupplierName(p.supplierName || '')),
    [purchases]
  );

  const supplierScopedPurchases = useMemo(() => {
    if (selectedSupplierTab === ALL_SUPPLIERS_TAB) {
      return purchases;
    }
    if (selectedSupplierTab === UNASSIGNED_SUPPLIER_TAB) {
      return unassignedPurchases;
    }
    const targetLower = selectedSupplierTab.trim().toLowerCase();
    return purchases.filter(
      (p) => cleanSupplierName(p.supplierName || '').toLowerCase() === targetLower
    );
  }, [purchases, unassignedPurchases, selectedSupplierTab]);

  // Smart supplier selector: if selecting a supplier that has no items on the currently selected single date,
  // automatically switch to 'all' dates so all of that supplier's historical invoices immediately show up!
  const handleSelectSupplier = (targetTab: string) => {
    setSelectedSupplierTab(targetTab);
    setMethodFilter('all');
    setCategoryFilter('all');
    setSearchQuery('');
    setIsSuppliersModalOpen(false);

    if (targetTab !== ALL_SUPPLIERS_TAB && selectedDateFilter !== 'all') {
      const targetItems =
        targetTab === UNASSIGNED_SUPPLIER_TAB
          ? unassignedPurchases
          : purchases.filter(
              (p) =>
                cleanSupplierName(p.supplierName || '').toLowerCase() ===
                targetTab.trim().toLowerCase()
            );
      const hasOnCurrentDate = targetItems.some((p) =>
        doesPurchaseMatchDate(p, selectedDateFilter)
      );
      if (!hasOnCurrentDate && targetItems.length > 0) {
        setSelectedDateFilter('all');
      }
    }
  };

  // Smart date selector: resets active secondary filters and ensures if a supplier was selected
  // that has no records on the newly chosen date (while other suppliers do), we show all suppliers for that date
  const handleSelectPurchaseDate = (targetDate: string) => {
    setSelectedDateFilter(targetDate);
    setMethodFilter('all');
    setCategoryFilter('all');
    setSearchQuery('');
    if (targetDate !== 'all') {
      const [y, m] = targetDate.split('-').map(Number);
      if (y && m) {
        setCalendarYear(y);
        setCalendarMonth(m);
      }
      if (selectedSupplierTab !== ALL_SUPPLIERS_TAB) {
        const hasForActiveSupplier = supplierScopedPurchases.some((p) =>
          doesPurchaseMatchDate(p, targetDate)
        );
        const hasForAnySupplier = purchases.some((p) =>
          doesPurchaseMatchDate(p, targetDate)
        );
        if (!hasForActiveSupplier && hasForAnySupplier) {
          setSelectedSupplierTab(ALL_SUPPLIERS_TAB);
        }
      }
    }
    setIsPurchasesCalendarModalOpen(false);
  };

  const supplierAllTotalCost = supplierScopedPurchases.reduce(
    (acc, p) => acc + (p.totalCostJod || 0),
    0
  );
  const supplierAllUnpaidPurchases = supplierScopedPurchases.filter(
    (p) => p.paymentMethod === 'credit' && !p.isPaid
  );
  const supplierAllUnpaidTotal = supplierAllUnpaidPurchases.reduce(
    (acc, p) => acc + (p.totalCostJod || 0),
    0
  );

  // Purchases scoped to both active Supplier Page and active Date Filter
  const dateAndSupplierScopedPurchases = useMemo(() => {
    if (selectedDateFilter === 'all') return supplierScopedPurchases;
    return supplierScopedPurchases.filter((p) =>
      doesPurchaseMatchDate(p, selectedDateFilter)
    );
  }, [supplierScopedPurchases, selectedDateFilter]);

  const totalPurchasesCost = dateAndSupplierScopedPurchases.reduce(
    (acc, p) => acc + (p.totalCostJod || 0),
    0
  );

  const cashPurchases = dateAndSupplierScopedPurchases.filter(
    (p) => p.paymentMethod === 'cash'
  );
  const cashPurchasesTotal = cashPurchases.reduce(
    (acc, p) => acc + (p.totalCostJod || 0),
    0
  );

  const cliqPurchases = dateAndSupplierScopedPurchases.filter(
    (p) => p.paymentMethod === 'cliq'
  );
  const cliqPurchasesTotal = cliqPurchases.reduce(
    (acc, p) => acc + (p.totalCostJod || 0),
    0
  );

  const creditPurchases = dateAndSupplierScopedPurchases.filter(
    (p) => p.paymentMethod === 'credit'
  );
  const unpaidCreditPurchases = creditPurchases.filter((p) => !p.isPaid);
  const creditUnpaidTotal = unpaidCreditPurchases.reduce(
    (acc, p) => acc + (p.totalCostJod || 0),
    0
  );

  const isMainPurchasesPage = selectedSupplierTab === ALL_SUPPLIERS_TAB;

  const activeSupplierData = useMemo(() => {
    if (isMainPurchasesPage || selectedSupplierTab === UNASSIGNED_SUPPLIER_TAB) {
      return null;
    }
    return (
      supplierPages.find(
        (s) => s.name.toLowerCase() === selectedSupplierTab.toLowerCase()
      ) || {
        name: selectedSupplierTab,
        itemsCount: supplierScopedPurchases.length,
        invoicesCount: 0,
        latestDate: '',
        totalCostJod: supplierAllTotalCost,
        unpaidCostJod: supplierAllUnpaidTotal,
        unpaidCount: supplierAllUnpaidPurchases.length,
      }
    );
  }, [
    isMainPurchasesPage,
    selectedSupplierTab,
    supplierPages,
    supplierScopedPurchases,
    supplierAllTotalCost,
    supplierAllUnpaidTotal,
    supplierAllUnpaidPurchases,
  ]);

  const availablePurchaseDates = useMemo(() => {
    const dateSet = new Set<string>();
    supplierScopedPurchases.forEach((p) => {
      const eff = getPurchaseEffectiveDate(p);
      if (eff) dateSet.add(eff);
      const entry = getPurchaseEntryDate(p);
      if (entry) dateSet.add(entry);
    });
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  }, [supplierScopedPurchases]);

  const nextPurchaseDate = useMemo(() => {
    const refDate = selectedDateFilter === 'all' ? todayStr : selectedDateFilter;
    const newer = availablePurchaseDates.filter((d) => d > refDate);
    return newer.length > 0 ? newer[newer.length - 1] : null;
  }, [availablePurchaseDates, selectedDateFilter, todayStr]);

  const prevPurchaseDate = useMemo(() => {
    const refDate = selectedDateFilter === 'all' ? todayStr : selectedDateFilter;
    const older = availablePurchaseDates.filter((d) => d < refDate);
    return older.length > 0 ? older[0] : null;
  }, [availablePurchaseDates, selectedDateFilter, todayStr]);

  // Step 1 calendar day back (اليوم السابق) or jump to previous recorded date
  const handleStepPrevDay = () => {
    const baseDate = selectedDateFilter === 'all' ? todayStr : selectedDateFilter;
    const prevCalDay = addDaysStr(baseDate, -1);
    handleSelectPurchaseDate(prevCalDay);
  };

  // Step 1 calendar day forward (اليوم التالي)
  const handleStepNextDay = () => {
    const baseDate = selectedDateFilter === 'all' ? todayStr : selectedDateFilter;
    const nextCalDay = addDaysStr(baseDate, 1);
    handleSelectPurchaseDate(nextCalDay);
  };

  const goToNextPurchaseDate = () => {
    if (nextPurchaseDate) {
      handleSelectPurchaseDate(nextPurchaseDate);
    } else {
      handleStepNextDay();
    }
  };

  const goToPrevPurchaseDate = () => {
    if (prevPurchaseDate) {
      handleSelectPurchaseDate(prevPurchaseDate);
    } else {
      handleStepPrevDay();
    }
  };

  const handleJumpToTodayPurchases = () => {
    handleSelectPurchaseDate(getTodayStr());
  };

  const purchaseDateSummaries = useMemo(() => {
    return availablePurchaseDates.map((dStr) => {
      const items = supplierScopedPurchases.filter((p) =>
        doesPurchaseMatchDate(p, dStr)
      );
      const totalCost = items.reduce((acc, p) => acc + (p.totalCostJod || 0), 0);
      const unpaidCost = items
        .filter((p) => p.paymentMethod === 'credit' && !p.isPaid)
        .reduce((acc, p) => acc + (p.totalCostJod || 0), 0);
      return {
        dateStr: dStr,
        count: items.length,
        totalCost,
        unpaidCost,
      };
    });
  }, [availablePurchaseDates, supplierScopedPurchases]);

  const monthPrefix = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}`;
  const monthPurchases = useMemo(
    () =>
      supplierScopedPurchases.filter((p) =>
        getPurchaseEffectiveDate(p).startsWith(monthPrefix)
      ),
    [supplierScopedPurchases, monthPrefix]
  );
  const monthTotalCost = useMemo(
    () => monthPurchases.reduce((acc, p) => acc + (p.totalCostJod || 0), 0),
    [monthPurchases]
  );

  const purchaseDateSummariesMap = useMemo(() => {
    const map = new Map<string, (typeof purchaseDateSummaries)[0]>();
    purchaseDateSummaries.forEach((d) => map.set(d.dateStr, d));
    return map;
  }, [purchaseDateSummaries]);

  // Resolve shared invoice image across sibling items of the same invoice
  const sharedInvoiceImagesMap = useMemo(() => {
    const map = new Map<string, string>();
    purchases.forEach((p) => {
      if (p.invoiceImageUrl) {
        const key = `${p.invoiceNumber || ''}|${p.supplierName || ''}|${getPurchaseEffectiveDate(p)}`;
        if (!map.has(key)) {
          map.set(key, p.invoiceImageUrl);
        }
      }
    });
    return map;
  }, [purchases]);

  const getPurchaseImageUrl = (p: PurchaseRecord): string | undefined => {
    if (p.invoiceImageUrl) return p.invoiceImageUrl;
    if (p.invoiceNumber || p.supplierName) {
      const key = `${p.invoiceNumber || ''}|${p.supplierName || ''}|${getPurchaseEffectiveDate(p)}`;
      return sharedInvoiceImagesMap.get(key);
    }
    return undefined;
  };

  const filteredPurchases = useMemo(() => {
    return supplierScopedPurchases.filter((p) => {
      if (selectedDateFilter !== 'all') {
        if (!doesPurchaseMatchDate(p, selectedDateFilter)) return false;
      }

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.partName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q)) ||
        getPurchaseEffectiveDate(p).includes(q);

      if (!matchesSearch) return false;

      if (methodFilter === 'unpaid') {
        return p.paymentMethod === 'credit' && !p.isPaid;
      }
      if (methodFilter !== 'all' && p.paymentMethod !== methodFilter) {
        return false;
      }

      if (categoryFilter !== 'all' && p.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [supplierScopedPurchases, searchQuery, methodFilter, categoryFilter, selectedDateFilter]);

  // Group filtered purchases by invoice for the 'invoices' view mode
  const groupedInvoices = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        invoiceNumber: string;
        supplierName: string;
        invoiceDate: string;
        paymentMethod: PurchasePaymentMethod;
        notes?: string;
        imageUrl?: string;
        items: PurchaseRecord[];
        totalCostJod: number;
        unpaidItems: PurchaseRecord[];
      }
    >();

    filteredPurchases.forEach((p) => {
      const invNum = cleanInvoiceNumber(p.invoiceNumber || '');
      const supp = cleanSupplierName(p.supplierName || '');
      const effectiveDate = getPurchaseEffectiveDate(p);
      const groupKey = invNum
        ? `inv-${invNum}-${supp}-${effectiveDate}`
        : supp
        ? `supp-${supp}-${effectiveDate}-${p.paymentMethod}`
        : `single-${p.id}`;

      const existing = groups.get(groupKey);
      const resolvedImg = getPurchaseImageUrl(p);

      if (existing) {
        existing.items.push(p);
        existing.totalCostJod =
          Math.round((existing.totalCostJod + (p.totalCostJod || 0)) * 100) / 100;
        if (p.paymentMethod === 'credit' && !p.isPaid) {
          existing.unpaidItems.push(p);
        }
        if (!existing.imageUrl && resolvedImg) {
          existing.imageUrl = resolvedImg;
        }
        if (!existing.notes && p.notes) {
          existing.notes = p.notes;
        }
      } else {
        groups.set(groupKey, {
          key: groupKey,
          invoiceNumber: invNum,
          supplierName: supp,
          invoiceDate: effectiveDate,
          paymentMethod: p.paymentMethod,
          notes: p.notes,
          imageUrl: resolvedImg,
          items: [p],
          totalCostJod: p.totalCostJod || 0,
          unpaidItems: p.paymentMethod === 'credit' && !p.isPaid ? [p] : [],
        });
      }
    });

    return Array.from(groups.values());
  }, [filteredPurchases, sharedInvoiceImagesMap]);

  // Extract unique categories for filter dropdown
  const uniqueCategories = useMemo(
    () => Array.from(new Set(purchases.map((p) => p.category).filter(Boolean))),
    [purchases]
  );

  const handleCreateSupplierPage = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanSupplierName(newSupplierPageName);
    if (!cleaned) return;
    if (onAddSupplier) {
      onAddSupplier(cleaned);
    }
    handleSelectSupplier(cleaned);
    setNewSupplierPageName('');
    setIsAddingSupplierPage(false);
    setSuccessBanner(
      lang === 'ar'
        ? `تم إنشاء وفتح صفحة المورد «${cleaned}» بنجاح.`
        : `Supplier page "${cleaned}" created.`
    );
    setTimeout(() => setSuccessBanner(''), 3500);
  };

  const handleStartRenameSupplier = (supplierName: string) => {
    setEditingSupplierName(supplierName);
    setEditedSupplierInput(supplierName);
  };

  const handleConfirmRenameSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplierName) return;
    const cleaned = cleanSupplierName(editedSupplierInput);
    if (!cleaned) return;
    if (onRenameSupplier) {
      onRenameSupplier(editingSupplierName, cleaned);
    }
    if (selectedSupplierTab.toLowerCase() === editingSupplierName.toLowerCase()) {
      setSelectedSupplierTab(cleaned);
    }
    setSuccessBanner(
      lang === 'ar'
        ? `تم تعديل اسم المورد من «${editingSupplierName}» إلى «${cleaned}» وتحديث كافة سجلاته بنجاح.`
        : `Supplier renamed to "${cleaned}" successfully.`
    );
    setEditingSupplierName(null);
    setEditedSupplierInput('');
    setTimeout(() => setSuccessBanner(''), 4000);
  };

  const handleStartDeleteSupplier = (supplier: {
    name: string;
    itemsCount: number;
    totalCostJod: number;
    unpaidCostJod: number;
  }) => {
    if (!canDelete) return;
    setSupplierToDelete(supplier);
  };

  const handleConfirmDeleteSupplier = () => {
    if (!supplierToDelete || !canDelete) return;
    const name = supplierToDelete.name;
    if (onDeleteSupplier) {
      onDeleteSupplier(name);
    }
    if (selectedSupplierTab.toLowerCase() === name.toLowerCase()) {
      setSelectedSupplierTab(ALL_SUPPLIERS_TAB);
    }
    setSuccessBanner(
      lang === 'ar'
        ? `تم حذف صفحة المورد «${name}» بنجاح وتحويل قطعه لمشتريات عامة دون فقدان أي بيانات مالية.`
        : `Supplier page "${name}" deleted.`
    );
    setSupplierToDelete(null);
    setTimeout(() => setSuccessBanner(''), 4500);
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPart = cleanAndFormatText(quickPartName);
    const cost = Math.max(0, parseFloat(quickUnitCost) || 0);
    const qty = Math.max(0.1, parseFloat(quickQty) || 1);
    if (!cleanedPart || cost <= 0) return;

    const cleanedSupp = cleanSupplierName(quickSupplierName);
    const total = Math.round(qty * cost * 100) / 100;
    const isPaid = quickPaymentMethod !== 'credit';

    const activeTargetDate =
      selectedDateFilter !== 'all' ? selectedDateFilter : getTodayStr();

    const record: PurchaseRecord = {
      id: `purch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      partName: cleanedPart,
      category: quickCategory || 'تخزين وهاردوير',
      quantity: qty,
      unit: 'قطعة',
      unitCostJod: cost,
      totalCostJod: total,
      sellingPriceJod: Math.round(cost * 1.35 * 100) / 100,
      supplierName: cleanedSupp || undefined,
      invoiceNumber: cleanInvoiceNumber(quickInvoiceNo) || undefined,
      invoiceDate: activeTargetDate,
      paymentMethod: quickPaymentMethod,
      isPaid,
      paidAt: isPaid ? activeTargetDate : undefined,
      purchasedBy: 'مدير النظام',
      createdAt: new Date().toISOString(),
    };

    if (cleanedSupp && onAddSupplier) {
      onAddSupplier(cleanedSupp);
    }
    onSavePurchase(record);
    setQuickPartName('');
    setQuickUnitCost('');
    setQuickQty('1');
    setQuickInvoiceNo('');
    setSuccessBanner(
      lang === 'ar'
        ? `تمت إضافة «${cleanedPart}»${cleanedSupp ? ` في صفحة المورد (${cleanedSupp})` : ''} بنجاح.`
        : `Added "${cleanedPart}" successfully.`
    );
    setTimeout(() => setSuccessBanner(''), 3500);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget || !canDelete) return;
    onDeletePurchase(deleteTarget.id);
    setSuccessBanner(
      lang === 'ar'
        ? `تم حذف القطعة «${cleanAndFormatText(deleteTarget.partName)}» وإلغاء أثرها بنجاح.`
        : `Part "${cleanAndFormatText(deleteTarget.partName)}" deleted successfully.`
    );
    setDeleteTarget(null);
    setTimeout(() => setSuccessBanner(''), 4000);
  };

  const handleConfirmSettle = () => {
    if (settleTargets.length === 0) return;
    const totalSettled = settleTargets.reduce(
      (acc, t) => acc + (t.totalCostJod || 0),
      0
    );
    settleTargets.forEach((target) => {
      onSettleCreditPurchase(target.id, settleMethod, settleDate);
    });
    setSuccessBanner(
      lang === 'ar'
        ? `تم تسديد الذمة بقيمة ${formatJod(totalSettled, lang)} عبر (${
            settleMethod === 'cash' ? 'كاش' : 'كلك'
          }) وترحيلها إلى المصاريف بنجاح.`
        : `Credit settled (${formatJod(totalSettled, lang)}) successfully.`
    );
    setSettleTargets([]);
    setTimeout(() => setSuccessBanner(''), 4000);
  };

  const openAddPurchaseFromMainPage = (prefillSupplier: string = '') => {
    setEditingPurchase(null);
    setModalDefaultSupplier(prefillSupplier);
    setIsAddModalOpen(true);
  };

  const openScanInvoiceFromMainPage = (prefillSupplier: string = '') => {
    setModalDefaultSupplier(prefillSupplier);
    setIsScannerModalOpen(true);
  };

  return (
    <div className="space-y-2.5 animate-in fade-in duration-150">
      {/* Compact Responsive Header Bar */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0B3B68] via-[#104b80] to-[#0B3B68] px-3.5 py-2.5 sm:px-4 sm:py-3 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-amber-300">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm sm:text-base lg:text-lg font-black tracking-tight text-white leading-tight">
                  {lang === 'ar'
                    ? 'المشتريات وفواتير الموردين'
                    : 'Purchases & Supplier Invoices'}
                </h1>
                <span className="text-[10px] sm:text-[11px] font-bold text-sky-200/90">
                  {lang === 'ar'
                    ? `· ${purchases.length} قطعة · ${supplierPages.length} مورد`
                    : `· ${purchases.length} items · ${supplierPages.length} suppliers`}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Action Buttons */}
          {isMainPurchasesPage ? (
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowQuickAddBar((v) => !v)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  showQuickAddBar
                    ? 'bg-white text-[#0B3B68] border-white'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إضافة سريعة' : 'Quick Add'}</span>
              </button>

              <button
                type="button"
                onClick={() => openScanInvoiceFromMainPage('')}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-transform active:scale-98 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                <span>{lang === 'ar' ? 'تصوير فاتورة' : 'Scan Invoice'}</span>
              </button>

              <button
                type="button"
                onClick={() => openAddPurchaseFromMainPage('')}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-xs transition-transform active:scale-98 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>{lang === 'ar' ? 'إضافة فاتورة / قطعة' : 'Add Purchase'}</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedSupplierTab(ALL_SUPPLIERS_TAB)}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ar'
                    ? 'العودة لصفحة المشتريات الرئيسية'
                    : 'Back to Main'}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  openAddPurchaseFromMainPage(
                    selectedSupplierTab === UNASSIGNED_SUPPLIER_TAB
                      ? ''
                      : selectedSupplierTab
                  )
                }
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ar'
                    ? 'إضافة مشتريات (من الرئيسية)'
                    : 'Add Purchase'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Inline Add Bar */}
      {isMainPurchasesPage && showQuickAddBar && (
        <form
          onSubmit={handleQuickAddSubmit}
          className="p-2.5 sm:p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 shadow-2xs space-y-2 animate-in fade-in"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {lang === 'ar'
                  ? 'إضافة سريعة لقطعة مشتراة (من صفحة المشتريات الرئيسية):'
                  : 'Quick Add Purchase (Main Page):'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setShowQuickAddBar(false)}
              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 lg:grid-cols-8 gap-1.5">
            <input
              type="text"
              required
              dir="auto"
              placeholder={lang === 'ar' ? 'اسم القطعة *' : 'Part Name *'}
              value={quickPartName}
              onChange={(e) => setQuickPartName(e.target.value)}
              className="col-span-2 min-h-[34px] px-2.5 py-1 rounded-lg border border-emerald-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
            <input
              type="text"
              list="quick-suppliers-datalist"
              dir="auto"
              placeholder={lang === 'ar' ? 'اسم المورد (لصفحته)' : 'Supplier Name'}
              value={quickSupplierName}
              onChange={(e) => setQuickSupplierName(e.target.value)}
              className="col-span-2 sm:col-span-1 lg:col-span-2 min-h-[34px] px-2.5 py-1 rounded-lg border border-emerald-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
            <datalist id="quick-suppliers-datalist">
              {allSupplierNames.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <input
              type="number"
              step="0.1"
              min="0.1"
              dir="ltr"
              placeholder={lang === 'ar' ? 'الكمية' : 'Qty'}
              value={quickQty}
              onChange={(e) => setQuickQty(e.target.value)}
              className="min-h-[34px] px-2 py-1 rounded-lg border border-emerald-300 bg-white text-xs font-mono font-bold text-center text-slate-900"
            />
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              dir="ltr"
              placeholder={lang === 'ar' ? 'سعر الحبة *' : 'Unit Cost *'}
              value={quickUnitCost}
              onChange={(e) => setQuickUnitCost(e.target.value)}
              className="min-h-[34px] px-2 py-1 rounded-lg border border-emerald-300 bg-white text-xs font-mono font-bold text-center text-emerald-900"
            />
            <select
              value={quickPaymentMethod}
              onChange={(e) =>
                setQuickPaymentMethod(e.target.value as PurchasePaymentMethod)
              }
              className="min-h-[34px] px-2 py-1 rounded-lg border border-emerald-300 bg-white text-xs font-bold text-slate-800"
            >
              <option value="cash">{lang === 'ar' ? 'دفع كاش' : 'Cash'}</option>
              <option value="cliq">{lang === 'ar' ? 'دفع كلك' : 'CliQ'}</option>
              <option value="credit">{lang === 'ar' ? 'ذمم (آجل)' : 'Credit'}</option>
            </select>
            <button
              type="submit"
              className="min-h-[34px] px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{lang === 'ar' ? 'حفظ' : 'Save'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          role="status"
          className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold shadow-2xs animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenFinance && (
              <button
                type="button"
                onClick={onOpenFinance}
                className="min-h-[28px] px-2.5 py-0.5 rounded-lg bg-[#0B3B68] hover:bg-[#155E95] text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
              >
                <Wallet className="w-3 h-3 text-amber-300" />
                <span>{lang === 'ar' ? 'المالية' : 'Finance'}</span>
              </button>
            )}
            {onOpenCatalogs && (
              <button
                type="button"
                onClick={onOpenCatalogs}
                className="min-h-[28px] px-2.5 py-0.5 rounded-lg bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
              >
                <Cpu className="w-3 h-3 text-emerald-700" />
                <span>{lang === 'ar' ? 'القطع' : 'Parts'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSuccessBanner('')}
              className="text-emerald-700 hover:text-emerald-900 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Compact Dual Navigation Bars: 1) Carender (التقويم) + 2) Suppliers (الموردون - بنفس طريقة التقويم لسهولة الاستخدام) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        {/* 1. Compact Purchases Carender Bar & Always-Visible Today / Prev Day / Show All */}
        <div className="rounded-2xl bg-white border border-slate-200 px-3 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 text-[#0B3B68] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-[#0B3B68]" />
            </div>
            <span className="text-xs font-black text-slate-900">
              {lang === 'ar' ? 'التقويم:' : 'Date:'}
            </span>

            {selectedDateFilter !== 'all' ? (
              <span className="px-2.5 py-1 rounded-xl bg-sky-50 border border-sky-200 text-[#0B3B68] text-xs font-black flex items-center gap-1">
                <span>
                  {selectedDateFilter === todayStr
                    ? lang === 'ar'
                      ? 'اليوم:'
                      : 'Today:'
                    : ''}
                </span>
                <span>{getDayName(selectedDateFilter, lang)}</span>
                <span className="font-mono" dir="ltr">
                  ({selectedDateFilter})
                </span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-black">
                {lang === 'ar'
                  ? `كل التواريخ (${availablePurchaseDates.length})`
                  : `All Dates (${availablePurchaseDates.length})`}
              </span>
            )}

            {/* Explicit Step-by-Step Previous Day / Next Day Navigation */}
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={handleStepPrevDay}
                className="min-h-[30px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-800 hover:text-[#0B3B68] border border-slate-200 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                title={
                  lang === 'ar'
                    ? 'الرجوع إلى اليوم السابق وعرض فواتيره'
                    : 'Previous Day'
                }
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'اليوم السابق' : 'Prev Day'}</span>
              </button>
              <button
                type="button"
                onClick={handleStepNextDay}
                className="min-h-[30px] px-1.5 py-0.5 rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-800 hover:text-[#0B3B68] border border-slate-200 text-[11px] font-black flex items-center justify-center cursor-pointer transition-colors"
                title={lang === 'ar' ? 'اليوم التالي' : 'Next Day'}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Carender Modal + Today + Show All Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsPurchasesCalendarModalOpen(true)}
              className="min-h-[34px] px-3 py-1 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-sky-200 shrink-0" />
              <span>{lang === 'ar' ? '📅 التقويم (Carender)' : 'Carender'}</span>
            </button>

            <button
              type="button"
              onClick={handleJumpToTodayPurchases}
              className={`min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-colors border ${
                selectedDateFilter === todayStr
                  ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
              }`}
              title={lang === 'ar' ? 'عرض مشتريات اليوم' : 'Show Today'}
            >
              <span>{lang === 'ar' ? 'اليوم' : 'Today'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPurchaseDate('all')}
              className={`min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors border ${
                selectedDateFilter === 'all'
                  ? 'bg-sky-700 text-white border-sky-700 shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
              title={lang === 'ar' ? 'عرض كل التواريخ' : 'Show All Dates'}
            >
              <span>
                {lang === 'ar'
                  ? `الكل (${availablePurchaseDates.length})`
                  : `All (${availablePurchaseDates.length})`}
              </span>
            </button>
          </div>
        </div>

        {/* 2. Compact Suppliers Bar (الموردون - بنفس طريقة التقويم لسهولة الاستخدام) */}
        <div className="rounded-2xl bg-white border border-slate-200 px-3 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-[#0B3B68] flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-xs font-black text-slate-900">
              {lang === 'ar' ? 'الموردون:' : 'Suppliers:'}
            </span>

            {!isMainPurchasesPage ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-xl bg-sky-50 border border-sky-200 text-[#0B3B68] text-xs font-black flex items-center gap-1.5 max-w-[200px] sm:max-w-[240px]">
                  <span className="truncate" dir="auto">
                    {selectedSupplierTab === UNASSIGNED_SUPPLIER_TAB
                      ? lang === 'ar'
                        ? 'مشتريات عامة'
                        : 'General'
                      : selectedSupplierTab}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0B3B68] text-white shrink-0">
                    {supplierScopedPurchases.length}
                  </span>
                </span>

                {supplierAllUnpaidTotal > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSettleTargets(supplierAllUnpaidPurchases);
                      setSettleMethod('cash');
                      setSettleDate(getTodayStr());
                    }}
                    className="min-h-[28px] px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    title={lang === 'ar' ? 'تسديد ذمم المورد' : 'Settle Supplier Debt'}
                  >
                    <CheckCircle2 className="w-3 h-3 text-rose-600" />
                    <span>
                      {lang === 'ar'
                        ? `تسديد (${formatJod(supplierAllUnpaidTotal, lang)})`
                        : `Settle (${formatJod(supplierAllUnpaidTotal, lang)})`}
                    </span>
                  </button>
                )}

                {activeSupplierData && (
                  <button
                    type="button"
                    onClick={() => handleStartRenameSupplier(activeSupplierData.name)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    title={lang === 'ar' ? 'تعديل اسم المورد' : 'Rename Supplier'}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#0B3B68]" />
                  </button>
                )}

                {activeSupplierData && canDelete && (
                  <button
                    type="button"
                    onClick={() => handleStartDeleteSupplier(activeSupplierData)}
                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                    title={lang === 'ar' ? 'حذف صفحة المورد' : 'Delete Supplier'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-black">
                {lang === 'ar'
                  ? `كل الموردين (${supplierPages.length} مورد)`
                  : `All Suppliers (${supplierPages.length})`}
              </span>
            )}
          </div>

          {/* Suppliers Popup Button + Show All Suppliers + Quick Add Supplier */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsSuppliersModalOpen(true)}
              className="min-h-[34px] px-3 py-1 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              <Building2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>
                {lang === 'ar'
                  ? `🏢 الموردون (${supplierPages.length})`
                  : `Suppliers (${supplierPages.length})`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectSupplier(ALL_SUPPLIERS_TAB)}
              className={`min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-colors border ${
                isMainPurchasesPage
                  ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
              }`}
              title={lang === 'ar' ? 'عرض كل الموردين' : 'All Suppliers'}
            >
              <span>{lang === 'ar' ? 'الكل' : 'All'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAddingSupplierPage(true);
                setIsSuppliersModalOpen(true);
              }}
              className="min-h-[34px] px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#0B3B68] border border-sky-200 text-xs font-black flex items-center gap-1 cursor-pointer transition-colors"
              title={lang === 'ar' ? 'إضافة مورد جديد' : 'Add Supplier'}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? '+ مورد' : '+ New'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Unified 4-KPI Strip (Works for both Main Purchases and Active Supplier / Date) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="py-2 px-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-500 truncate">
              {lang === 'ar'
                ? `إجمالي الفواتير (${groupedInvoices.length} فاتورة)`
                : `Total (${groupedInvoices.length} inv)`}
            </div>
            <bdi className="text-sm sm:text-base font-black text-slate-900 font-mono tabular-nums block">
              {formatJod(totalPurchasesCost, lang)}
            </bdi>
          </div>
          <div className="w-7 h-7 rounded-lg bg-[#0B3B68]/10 text-[#0B3B68] flex items-center justify-center shrink-0">
            <Package className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="py-2 px-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-500 truncate">
              {lang === 'ar'
                ? `كاش (${cashPurchases.length})`
                : `Cash (${cashPurchases.length})`}
            </div>
            <bdi className="text-sm sm:text-base font-black text-emerald-700 font-mono tabular-nums block">
              {formatJod(cashPurchasesTotal, lang)}
            </bdi>
          </div>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="py-2 px-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-500 truncate">
              {lang === 'ar'
                ? `كلك (${cliqPurchases.length})`
                : `CliQ (${cliqPurchases.length})`}
            </div>
            <bdi className="text-sm sm:text-base font-black text-indigo-700 font-mono tabular-nums block">
              {formatJod(cliqPurchasesTotal, lang)}
            </bdi>
          </div>
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="py-2 px-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-500 truncate">
              {lang === 'ar'
                ? `ذمم متبقية (${unpaidCreditPurchases.length})`
                : `Unpaid (${unpaidCreditPurchases.length})`}
            </div>
            <bdi className="text-sm sm:text-base font-black text-amber-700 font-mono tabular-nums block">
              {formatJod(creditUnpaidTotal, lang)}
            </bdi>
          </div>
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Building2 className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Compact Filter, Search, and View Switcher Toolbar */}
      <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              dir="auto"
              placeholder={
                isMainPurchasesPage
                  ? lang === 'ar'
                    ? 'بحث باسم القطعة، المورد، رقم الفاتورة...'
                    : 'Search part, supplier, invoice #...'
                  : lang === 'ar'
                  ? `بحث داخل صفحة المورد (${selectedSupplierTab === UNASSIGNED_SUPPLIER_TAB ? 'بدون مورد' : selectedSupplierTab})...`
                  : 'Search in supplier page...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[36px] ps-8 pe-7 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68] focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Category Dropdown */}
            {uniqueCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              >
                <option value="all">
                  {lang === 'ar' ? 'كل التصنيفات' : 'All Categories'}
                </option>
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Payment Method Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setMethodFilter('all')}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer ${
                  methodFilter === 'all'
                    ? 'bg-[#0B3B68] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {lang === 'ar'
                  ? `الكل (${dateAndSupplierScopedPurchases.length})`
                  : `All (${dateAndSupplierScopedPurchases.length})`}
              </button>

              <button
                type="button"
                onClick={() => setMethodFilter('cash')}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer flex items-center gap-1 ${
                  methodFilter === 'cash'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
                }`}
              >
                <span>
                  {lang === 'ar'
                    ? `كاش (${cashPurchases.length})`
                    : `Cash (${cashPurchases.length})`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMethodFilter('cliq')}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer flex items-center gap-1 ${
                  methodFilter === 'cliq'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-800'
                }`}
              >
                <span>
                  {lang === 'ar'
                    ? `كلك (${cliqPurchases.length})`
                    : `CliQ (${cliqPurchases.length})`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMethodFilter('credit')}
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer flex items-center gap-1 ${
                  methodFilter === 'credit'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-800'
                }`}
              >
                <span>
                  {lang === 'ar'
                    ? `ذمم (${creditPurchases.length})`
                    : `Credit (${creditPurchases.length})`}
                </span>
              </button>

              {unpaidCreditPurchases.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMethodFilter('unpaid')}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer flex items-center gap-1 ${
                    methodFilter === 'unpaid'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  <AlertCircle className="w-3 h-3" />
                  <span>
                    {lang === 'ar'
                      ? `غير مسددة (${unpaidCreditPurchases.length})`
                      : `Unpaid (${unpaidCreditPurchases.length})`}
                  </span>
                </button>
              )}
            </div>

            {/* View Mode Toggle: Items vs Grouped Invoices */}
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('items')}
                className={`min-h-[28px] px-2.5 py-0.5 rounded-md text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'items'
                    ? 'bg-[#0B3B68] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3 h-3" />
                <span>{lang === 'ar' ? 'القطع' : 'Items'}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('invoices')}
                className={`min-h-[28px] px-2.5 py-0.5 rounded-md text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'invoices'
                    ? 'bg-[#0B3B68] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>
                  {lang === 'ar'
                    ? `الفواتير (${groupedInvoices.length})`
                    : `Invoices (${groupedInvoices.length})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main List / View Content */}
      {filteredPurchases.length === 0 ? (
        <div className="text-center py-6 px-4 rounded-2xl bg-white border border-dashed border-slate-300 shadow-2xs space-y-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-[#0B3B68] mx-auto flex items-center justify-center">
            <Package className="w-4 h-4" />
          </div>
          <h3 className="text-xs sm:text-sm font-extrabold text-slate-800">
            {selectedDateFilter !== 'all'
              ? (lang === 'ar'
                  ? `لا توجد مشتريات مسجلة بتاريخ (${selectedDateFilter})`
                  : `No purchases recorded for (${selectedDateFilter})`)
              : isMainPurchasesPage
              ? (lang === 'ar'
                  ? 'لا توجد فواتير أو مشتريات مطابقة'
                  : 'No matching purchases or invoices')
              : (lang === 'ar'
                  ? `لا توجد مشتريات مسجلة في صفحة المورد «${selectedSupplierTab}» حالياً`
                  : `No purchases for "${selectedSupplierTab}" yet`)}
          </h3>
          {selectedDateFilter !== 'all' && availablePurchaseDates.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleStepPrevDay}
                className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-extrabold cursor-pointer flex items-center gap-1"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'الرجوع لليوم السابق' : 'Previous Day'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectPurchaseDate('all')}
                className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-extrabold cursor-pointer shadow-2xs"
              >
                {lang === 'ar'
                  ? `عرض كل التواريخ المسجلة (${availablePurchaseDates.length})`
                  : `Show All Recorded Dates (${availablePurchaseDates.length})`}
              </button>
              <button
                type="button"
                onClick={() => handleSelectPurchaseDate(availablePurchaseDates[0])}
                className="min-h-[34px] px-3.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#0B3B68] border border-sky-200 text-xs font-extrabold cursor-pointer"
              >
                {lang === 'ar'
                  ? `آخر تاريخ مسجل (${availablePurchaseDates[0]})`
                  : `Latest Recorded Date (${availablePurchaseDates[0]})`}
              </button>
            </div>
          )}
        </div>
      ) : viewMode === 'invoices' ? (
        /* GROUPED INVOICES VIEW */
        <div className="space-y-2">
          {groupedInvoices.map((inv) => {
            const hasUnpaid = inv.unpaidItems.length > 0;
            return (
              <div
                key={inv.key}
                className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2"
              >
                {/* Invoice Group Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    {inv.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(inv.imageUrl!)}
                        className="w-9 h-9 rounded-lg border border-slate-200 overflow-hidden relative group shrink-0 cursor-pointer bg-slate-50"
                        title={
                          lang === 'ar'
                            ? 'معاينة صورة الفاتورة'
                            : 'View invoice image'
                        }
                      >
                        <img
                          src={inv.imageUrl}
                          alt="Invoice"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Eye className="w-3 h-3" />
                        </div>
                      </button>
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-sky-50 text-[#0B3B68] border border-sky-100 flex items-center justify-center shrink-0">
                        <Receipt className="w-4 h-4 text-[#0B3B68]" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {inv.supplierName ? (
                          <button
                            type="button"
                            onClick={() => handleSelectSupplier(inv.supplierName)}
                            className="text-xs sm:text-sm font-black text-[#0B3B68] hover:underline cursor-pointer"
                            title={
                              lang === 'ar'
                                ? 'فتح صفحة هذا المورد'
                                : 'Open supplier page'
                            }
                          >
                            <bdi>{inv.supplierName}</bdi>
                          </button>
                        ) : (
                          <h3 className="text-xs sm:text-sm font-black text-slate-900">
                            {lang === 'ar' ? 'فاتورة مشتريات عامة' : 'Purchase Invoice'}
                          </h3>
                        )}
                        {inv.invoiceNumber && (
                          <span className="text-[11px] font-mono font-bold text-slate-600">
                            <bdi>#{inv.invoiceNumber}</bdi>
                          </span>
                        )}
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <bdi>{inv.invoiceDate}</bdi>
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="text-[11px] font-bold text-slate-700">
                          {lang === 'ar'
                            ? `${inv.items.length} قطع`
                            : `${inv.items.length} items`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <bdi className="text-sm sm:text-base font-black text-emerald-800 font-mono tabular-nums">
                      {formatJod(inv.totalCostJod, lang)}
                    </bdi>

                    {hasUnpaid && (
                      <button
                        type="button"
                        onClick={() => {
                          setSettleTargets(inv.unpaidItems);
                          setSettleMethod('cash');
                          setSettleDate(getTodayStr());
                        }}
                        className="min-h-[28px] px-2.5 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[11px] flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>
                          {lang === 'ar' ? 'تسديد الفاتورة' : 'Settle Invoice'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Items inside this invoice */}
                <div className="divide-y divide-slate-100">
                  {inv.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="py-1.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-4 h-4 rounded bg-slate-100 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 text-xs">
                          <span
                            dir="auto"
                            className="font-bold text-slate-900 truncate"
                          >
                            {cleanAndFormatText(item.partName)}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-[11px] text-slate-500">
                            {item.category}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-[11px] text-slate-600">
                            {lang === 'ar' ? 'الكمية:' : 'Qty:'}{' '}
                            <strong className="font-mono text-slate-900">
                              <bdi>
                                {item.quantity} {item.unit || 'قطعة'}
                              </bdi>
                            </strong>
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-[11px] text-slate-600">
                            {lang === 'ar' ? 'الحبة:' : 'Unit:'}{' '}
                            <strong className="font-mono text-emerald-800">
                              <bdi>{formatJod(item.unitCostJod, lang)}</bdi>
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 ps-6 sm:ps-0">
                        <bdi className="text-xs font-black text-slate-900 font-mono tabular-nums">
                          {formatJod(item.totalCostJod, lang)}
                        </bdi>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPurchase(item);
                            setIsAddModalOpen(true);
                          }}
                          className="p-1 rounded text-[#0B3B68] hover:bg-sky-50 cursor-pointer"
                          title={lang === 'ar' ? 'تعديل' : 'Edit'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title={lang === 'ar' ? 'حذف' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* INDIVIDUAL ITEMS VIEW */
        <div className="space-y-1.5">
          {filteredPurchases.map((purchase) => {
            const isCredit = purchase.paymentMethod === 'credit';
            const isPaid = purchase.isPaid;
            const resolvedImageUrl = getPurchaseImageUrl(purchase);
            const formattedPartName = cleanAndFormatText(purchase.partName);
            const formattedSupplier = purchase.supplierName
              ? cleanSupplierName(purchase.supplierName)
              : '';
            const formattedInvoiceNo = purchase.invoiceNumber
              ? cleanInvoiceNumber(purchase.invoiceNumber)
              : '';
            const formattedNotes = purchase.notes
              ? cleanAndFormatText(purchase.notes)
              : '';

            return (
              <div
                key={purchase.id}
                className="py-2 px-2.5 sm:px-3 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-2"
              >
                {/* Left/Middle info container */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {/* Compact Thumbnail or Icon */}
                  {resolvedImageUrl ? (
                    <button
                      type="button"
                      onClick={() => setPreviewImage(resolvedImageUrl)}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg border border-slate-200 overflow-hidden relative group shrink-0 cursor-pointer bg-slate-50"
                      title={
                        lang === 'ar'
                          ? 'معاينة صورة الفاتورة'
                          : 'View invoice image'
                      }
                    >
                      <img
                        src={resolvedImageUrl}
                        alt="Invoice"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye className="w-3 h-3" />
                      </div>
                    </button>
                  ) : (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-100 text-[#0B3B68] border border-slate-200/70 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                  )}

                  {/* Details */}
                  <div className="space-y-0.5 flex-1 min-w-0">
                    {/* Line 1: Part Name + Supplier Page Link + Payment Status */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-tight">
                      <h4
                        dir="auto"
                        className="text-xs sm:text-sm font-black text-slate-900 break-words"
                      >
                        {formattedPartName}
                      </h4>

                      {formattedSupplier && (
                        <button
                          type="button"
                          onClick={() => handleSelectSupplier(formattedSupplier)}
                          className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#0B3B68] hover:underline cursor-pointer"
                          title={
                            lang === 'ar'
                              ? `فتح صفحة المورد: ${formattedSupplier}`
                              : `Open supplier page: ${formattedSupplier}`
                          }
                        >
                          <Building2 className="w-3 h-3 text-amber-600 shrink-0" />
                          <bdi>{formattedSupplier}</bdi>
                        </button>
                      )}

                      <span aria-hidden="true" className="text-slate-300">·</span>

                      <span className="text-[11px] font-bold text-slate-500">
                        {purchase.category}
                      </span>

                      <span aria-hidden="true" className="text-slate-300">·</span>

                      {purchase.paymentMethod === 'cash' && (
                        <span className="text-[11px] font-extrabold text-emerald-700">
                          {lang === 'ar' ? 'كاش' : 'Cash'}
                        </span>
                      )}

                      {purchase.paymentMethod === 'cliq' && (
                        <span className="text-[11px] font-extrabold text-indigo-700">
                          {lang === 'ar' ? 'كلك' : 'CliQ'}
                        </span>
                      )}

                      {purchase.paymentMethod === 'credit' && (
                        <span
                          className={`text-[11px] font-extrabold ${
                            isPaid ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {isPaid
                            ? lang === 'ar'
                              ? 'ذمة مسددة'
                              : 'Settled'
                            : lang === 'ar'
                            ? 'ذمة غير مسددة'
                            : 'Unpaid Credit'}
                        </span>
                      )}
                    </div>

                    {/* Line 2: Compact typographic metadata */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600">
                      <span>
                        {lang === 'ar' ? 'الكمية:' : 'Qty:'}{' '}
                        <bdi className="font-mono font-black text-slate-900">
                          {purchase.quantity}{' '}
                          {purchase.unit || (lang === 'ar' ? 'قطعة' : 'pcs')}
                        </bdi>
                      </span>

                      <span aria-hidden="true" className="text-slate-300">·</span>

                      <span>
                        {lang === 'ar' ? 'سعر الحبة:' : 'Unit:'}{' '}
                        <bdi className="font-mono font-black text-emerald-800">
                          {formatJod(purchase.unitCostJod, lang)}
                        </bdi>
                      </span>

                      {purchase.sellingPriceJod !== undefined &&
                        purchase.sellingPriceJod > 0 && (
                          <>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span>
                              {lang === 'ar' ? 'البيع:' : 'Sell:'}{' '}
                              <bdi className="font-mono font-bold text-sky-800">
                                {formatJod(purchase.sellingPriceJod, lang)}
                              </bdi>
                            </span>
                          </>
                        )}

                      {formattedInvoiceNo && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span>
                            {lang === 'ar' ? 'فاتورة:' : 'Inv:'}{' '}
                            <bdi className="font-mono font-bold text-slate-800">
                              #{formattedInvoiceNo}
                            </bdi>
                          </span>
                        </>
                      )}

                      <span aria-hidden="true" className="text-slate-300">·</span>

                      <span className="font-mono text-slate-500 text-[10px]">
                        <bdi>{purchase.invoiceDate}</bdi>
                      </span>

                      {formattedNotes && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span
                            dir="auto"
                            className="text-amber-900 truncate max-w-xs"
                            title={formattedNotes}
                          >
                            {formattedNotes}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Cost & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-2 shrink-0 pt-1.5 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <bdi className="text-xs sm:text-sm font-black text-slate-900 font-mono tabular-nums">
                    {formatJod(purchase.totalCostJod, lang)}
                  </bdi>

                  <div className="flex items-center gap-1">
                    {isCredit && !isPaid && (
                      <button
                        type="button"
                        onClick={() => {
                          setSettleTargets([purchase]);
                          setSettleMethod('cash');
                          setSettleDate(getTodayStr());
                        }}
                        className="min-h-[26px] px-2 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>{lang === 'ar' ? 'تسديد' : 'Settle'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setEditingPurchase(purchase);
                        setIsAddModalOpen(true);
                      }}
                      className="min-h-[26px] px-2 py-0.5 rounded-lg border border-sky-200 bg-sky-50 hover:bg-sky-100 text-[#0B3B68] font-extrabold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                      title={lang === 'ar' ? 'تعديل' : 'Edit'}
                    >
                      <Edit3 className="w-3 h-3 text-[#155E95] shrink-0" />
                      <span>{lang === 'ar' ? 'تعديل' : 'Edit'}</span>
                    </button>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(purchase)}
                        className="min-h-[26px] px-2 py-0.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-extrabold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                        title={lang === 'ar' ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="w-3 h-3 shrink-0" />
                        <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Supplier Name Modal */}
      {editingSupplierName && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#0B3B68]" />
                <span>
                  {lang === 'ar'
                    ? 'تعديل اسم صفحة المورد'
                    : 'Edit Supplier Page Name'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingSupplierName(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRenameSupplier} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  {lang === 'ar'
                    ? 'اسم المورد الحالي:'
                    : 'Current Supplier Name:'}
                </label>
                <div className="px-3 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
                  <bdi>{editingSupplierName}</bdi>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-800 block">
                  {lang === 'ar'
                    ? 'الاسم الجديد للمورد:'
                    : 'New Supplier Name:'}{' '}
                  *
                </label>
                <input
                  type="text"
                  required
                  dir="auto"
                  placeholder={
                    lang === 'ar'
                      ? 'مثال: شركة النخبة للتكنولوجيا'
                      : 'New supplier name'
                  }
                  value={editedSupplierInput}
                  onChange={(e) => setEditedSupplierInput(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-sky-300 bg-sky-50/30 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68] focus:bg-white"
                />
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                {lang === 'ar'
                  ? 'ملاحظة: سيتم تحديث هذا الاسم في جميع فواتير وقطع المورد المسجلة مسبقاً تلقائياً.'
                  : 'Note: All existing purchases and parts from this supplier will be updated.'}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSupplierName(null)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="min-h-[38px] px-5 py-1.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'حفظ التعديل' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Supplier Page Modal (Admin Only with Strict Confirmation) */}
      {supplierToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {lang === 'ar'
                    ? 'تأكيد حذف صفحة المورد'
                    : 'Confirm Delete Supplier Page'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">
                {lang === 'ar' ? (
                  <>
                    هل أنت متأكد من حذف صفحة المورد{' '}
                    <span className="text-rose-600 font-black">
                      «{supplierToDelete.name}»
                    </span>
                    ؟
                  </>
                ) : (
                  <>
                    Are you sure you want to delete supplier page{' '}
                    <span className="text-rose-600 font-black">
                      "{supplierToDelete.name}"
                    </span>
                    ?
                  </>
                )}
              </p>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span>{lang === 'ar' ? 'القطع المسجلة للمورد:' : 'Items:'}</span>
                  <strong className="font-mono font-bold">
                    {supplierToDelete.itemsCount}{' '}
                    {lang === 'ar' ? 'قطعة' : 'items'}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>{lang === 'ar' ? 'إجمالي المشتريات:' : 'Total Cost:'}</span>
                  <strong className="font-mono font-bold">
                    {formatJod(supplierToDelete.totalCostJod, lang)}
                  </strong>
                </div>
                {supplierToDelete.unpaidCostJod > 0 && (
                  <div className="flex items-center justify-between text-rose-700 font-extrabold">
                    <span>{lang === 'ar' ? 'ذمم متبقية غير مسددة:' : 'Unpaid Debt:'}</span>
                    <strong className="font-mono">
                      {formatJod(supplierToDelete.unpaidCostJod, lang)}
                    </strong>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                {lang === 'ar'
                  ? '🔒 أمان البيانات: لن يتم حذف فواتير الشراء أو المبالغ من النظام، بل ستتحول القطع التابعة له إلى "مشتريات عامة" للحفاظ على دقة الحسابات والمخزون.'
                  : 'Data Safety: Purchase records and financials will not be deleted, they will simply be unassigned to General Purchases.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer hover:bg-slate-50"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSupplier}
                className="min-h-[40px] px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ar' ? 'نعم، حذف صفحة المورد' : 'Yes, Delete Page'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-w-2xl max-h-[90vh] bg-white rounded-3xl p-3.5 overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-200 gap-4">
              <span className="text-xs sm:text-sm font-black text-slate-800">
                {lang === 'ar'
                  ? 'معاينة صورة الفاتورة المرفقة'
                  : 'Original Invoice Image'}
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={previewImage}
              alt="Full Invoice"
              className="max-h-[75vh] w-auto object-contain rounded-xl mx-auto"
            />
          </div>
        </div>
      )}

      {/* Settle Debt Modal */}
      {settleTargets.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>
                  {lang === 'ar' ? 'تسديد ذمة المورد' : 'Settle Supplier Debt'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setSettleTargets([])}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1 leading-relaxed">
              <div>
                {lang === 'ar' ? 'القطع المستحقة:' : 'Items:'}{' '}
                <strong className="font-bold">
                  {settleTargets.length === 1
                    ? cleanAndFormatText(settleTargets[0].partName)
                    : `${settleTargets.length} قطع مستحقة`}
                </strong>
              </div>
              <div>
                {lang === 'ar' ? 'المورد:' : 'Supplier:'}{' '}
                <strong className="font-bold">
                  {settleTargets[0].supplierName || 'غير محدد'}
                </strong>
              </div>
              <div>
                {lang === 'ar' ? 'إجمالي المبلغ المستحق:' : 'Total Due Amount:'}{' '}
                <bdi className="text-sm font-black font-mono text-amber-950">
                  {formatJod(
                    settleTargets.reduce(
                      (acc, t) => acc + (t.totalCostJod || 0),
                      0
                    ),
                    lang
                  )}
                </bdi>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                {lang === 'ar' ? 'طريقة السداد للمورد' : 'Settlement Method'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettleMethod('cash')}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-black border flex items-center justify-center gap-1.5 cursor-pointer ${
                    settleMethod === 'cash'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'كاش من الصندوق' : 'Cash Drawer'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettleMethod('cliq')}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-black border flex items-center justify-center gap-1.5 cursor-pointer ${
                    settleMethod === 'cliq'
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? 'كلك / تحويل' : 'CliQ Transfer'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                {lang === 'ar' ? 'تاريخ السداد' : 'Settlement Date'}
              </label>
              <input
                type="date"
                value={settleDate}
                onChange={(e) => setSettleDate(e.target.value)}
                className="w-full min-h-[38px] px-3 py-1 rounded-xl border border-slate-300 bg-white font-bold text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSettleTargets([])}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmSettle}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ar'
                    ? 'تأكيد السداد والترحيل للمالية'
                    : 'Confirm & Settle'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Purchase Modal */}
      <EditPurchaseModal
        lang={lang}
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingPurchase(null);
          setModalDefaultSupplier('');
        }}
        purchaseToEdit={editingPurchase}
        parts={parts}
        existingSuppliers={allSupplierNames}
        defaultSupplierName={modalDefaultSupplier}
        defaultInvoiceDate={
          selectedDateFilter !== 'all' ? selectedDateFilter : getTodayStr()
        }
        onSavePurchase={(record) => {
          if (record.supplierName && onAddSupplier) {
            onAddSupplier(record.supplierName);
          }
          onSavePurchase(record);
          setSuccessBanner(
            lang === 'ar'
              ? `تم حفظ الفاتورة / القطعة «${record.partName}»${
                  record.supplierName ? ` وإدراجها في صفحة المورد (${record.supplierName})` : ''
                } بنجاح.`
              : `Purchase "${record.partName}" saved & linked to finance.`
          );
          setTimeout(() => setSuccessBanner(''), 4000);
        }}
      />

      {/* Invoice Scanner Modal */}
      <InvoiceScannerModal
        lang={lang}
        isOpen={isScannerModalOpen}
        onClose={() => {
          setIsScannerModalOpen(false);
          setModalDefaultSupplier('');
        }}
        existingSuppliers={allSupplierNames}
        defaultSupplierName={modalDefaultSupplier}
        defaultInvoiceDate={
          selectedDateFilter !== 'all' ? selectedDateFilter : getTodayStr()
        }
        onApplyExtractedPurchases={(items, metadata) => {
          if (metadata.supplierName && onAddSupplier) {
            onAddSupplier(metadata.supplierName);
          }
          onBatchInsertPurchases(items, metadata);
          setSuccessBanner(
            lang === 'ar'
              ? `تم إدراج (${items.length}) قطعة من الفاتورة${
                  metadata.supplierName ? ` في صفحة المورد (${metadata.supplierName})` : ''
                } بنجاح!`
              : `Successfully inserted (${items.length}) parts from invoice!`
          );
          setTimeout(() => setSuccessBanner(''), 4500);
        }}
      />

      {/* Confirm Delete Purchase Item Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        lang={lang}
        title={lang === 'ar' ? 'تأكيد حذف قطعة المشتريات' : 'Confirm Delete Part'}
        itemName={
          deleteTarget
            ? `${cleanAndFormatText(deleteTarget.partName)} (${formatJod(
                deleteTarget.totalCostJod,
                lang
              )})`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Sleek & Compact Carender Calendar Modal Popup for Purchases */}
      {isPurchasesCalendarModalOpen && (
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
                  <Calendar className="w-4 h-4 text-[#0B3B68]" />
                </div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  {lang === 'ar' ? 'تقويم المشتريات (Carender)' : 'Purchases Calendar'}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    handleStepPrevDay();
                    setIsPurchasesCalendarModalOpen(false);
                  }}
                  className="min-h-[32px] px-2.5 py-1 rounded-xl text-xs font-black cursor-pointer border bg-slate-100 hover:bg-sky-100 text-slate-800 border-slate-200 transition-colors"
                >
                  {lang === 'ar' ? 'اليوم السابق' : 'Prev Day'}
                </button>
                <button
                  type="button"
                  onClick={handleJumpToTodayPurchases}
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
                    handleSelectPurchaseDate('all');
                    setIsPurchasesCalendarModalOpen(false);
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
                  onClick={() => setIsPurchasesCalendarModalOpen(false)}
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

              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 text-[11px] font-black font-mono">
                {formatJod(monthTotalCost, lang)}
              </span>
            </div>

            {/* Quick Recorded Purchase Dates Strip (لسهولة القفز لأي تاريخ مسجل بضغطة واحدة) */}
            {purchaseDateSummaries.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-extrabold text-slate-500">
                  {lang === 'ar'
                    ? `التواريخ المسجلة (${purchaseDateSummaries.length}):`
                    : `Recorded Dates (${purchaseDateSummaries.length}):`}
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {purchaseDateSummaries.slice(0, 12).map((d) => {
                    const isActive = selectedDateFilter === d.dateStr;
                    return (
                      <button
                        key={d.dateStr}
                        type="button"
                        onClick={() => {
                          handleSelectPurchaseDate(d.dateStr);
                          setIsPurchasesCalendarModalOpen(false);
                        }}
                        className={`shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-[#0B3B68] text-white border-[#0B3B68] shadow-2xs'
                            : 'bg-slate-50 hover:bg-sky-50 text-slate-800 border-slate-200'
                        }`}
                      >
                        <span className="font-mono" dir="ltr">{d.dateStr}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {formatJod(d.totalCost, lang)}
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
                  const dateStat = purchaseDateSummariesMap.get(cell.dateStr);
                  const isSelected = selectedDateFilter === cell.dateStr;
                  const isToday = cell.dateStr === todayStr;
                  const hasData = Boolean(dateStat && dateStat.count > 0);

                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => {
                        handleSelectPurchaseDate(cell.dateStr);
                        setIsPurchasesCalendarModalOpen(false);
                      }}
                      className={`min-h-[48px] sm:min-h-[52px] p-1 sm:p-1.5 rounded-xl text-start transition-all cursor-pointer relative flex flex-col justify-between border ${
                        isSelected
                          ? 'bg-sky-100 border-[#0B3B68] ring-2 ring-[#0B3B68] shadow-2xs'
                          : isToday
                          ? 'border-amber-400 bg-amber-50 hover:bg-amber-100'
                          : hasData
                          ? 'bg-white hover:bg-sky-50 border-slate-200 hover:border-sky-300 shadow-2xs'
                          : cell.isCurrentMonth
                          ? 'bg-slate-50/70 hover:bg-slate-100 border-slate-100 text-slate-400'
                          : 'bg-slate-50/30 border-slate-100 text-slate-300 opacity-35'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs font-black font-mono leading-none ${
                            isSelected
                              ? 'text-[#0B3B68]'
                              : isToday
                              ? 'text-amber-900'
                              : cell.isCurrentMonth
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {cell.dayNum}
                        </span>

                        <div className="flex items-center gap-0.5">
                          {isToday && (
                            <span className="px-1 py-0.2 rounded bg-amber-500 text-white text-[8px] font-black leading-none">
                              {lang === 'ar' ? 'اليوم' : 'Today'}
                            </span>
                          )}
                          {hasData && (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                      </div>

                      {hasData ? (
                        <div className="w-full overflow-hidden text-[9px] sm:text-[10px] font-bold leading-tight font-mono truncate text-emerald-700">
                          {Math.round(dateStat!.totalCost)} {lang === 'ar' ? 'د' : 'JOD'}
                        </div>
                      ) : (
                        <div className="text-[9px] text-slate-300 font-mono leading-none">-</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sleek & Compact Suppliers Modal Popup (الموردون - بنفس طريقة التقويم Carender لسهولة الاستخدام) */}
      {isSuppliersModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 sm:p-4 space-y-3 max-h-[90vh] overflow-y-auto">
            {/* Compact Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-[#0B3B68] flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    {lang === 'ar'
                      ? `دليل الموردين (${supplierPages.length})`
                      : `Suppliers Directory (${supplierPages.length})`}
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSelectSupplier(ALL_SUPPLIERS_TAB)}
                  className={`min-h-[32px] px-2.5 py-1 rounded-xl text-xs font-black cursor-pointer border transition-colors ${
                    isMainPurchasesPage
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                  }`}
                >
                  {lang === 'ar' ? 'كل الموردين' : 'All Suppliers'}
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddingSupplierPage((v) => !v)}
                  className="min-h-[32px] px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#0B3B68] border border-sky-200 text-xs font-black flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{lang === 'ar' ? '+ مورد جديد' : '+ New Supplier'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSuppliersModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                  title={lang === 'ar' ? 'إغلاق' : 'Close'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Inline Quick Create Supplier Form */}
            {isAddingSupplierPage && (
              <form
                onSubmit={handleCreateSupplierPage}
                className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-sky-50/70 border border-sky-200 animate-in fade-in"
              >
                <input
                  type="text"
                  required
                  dir="auto"
                  placeholder={
                    lang === 'ar'
                      ? 'اسم المورد الجديد (مثال: شركة الخدمة السريعة)...'
                      : 'Enter new supplier name...'
                  }
                  value={newSupplierPageName}
                  onChange={(e) => setNewSupplierPageName(e.target.value)}
                  className="flex-1 min-w-[180px] min-h-[36px] px-3 py-1.5 rounded-xl border border-sky-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
                <button
                  type="submit"
                  className="min-h-[36px] px-4 py-1.5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-extrabold cursor-pointer"
                >
                  {lang === 'ar' ? 'حفظ وفتح المورد' : 'Save & Open'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingSupplierPage(false);
                    setNewSupplierPageName('');
                  }}
                  className="min-h-[36px] px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </form>
            )}

            {/* Search & Unpaid Filter inside Suppliers Modal */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/80">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  dir="auto"
                  placeholder={
                    lang === 'ar' ? 'بحث سريع باسم المورد...' : 'Search supplier...'
                  }
                  value={supplierModalSearch}
                  onChange={(e) => setSupplierModalSearch(e.target.value)}
                  className="w-full min-h-[34px] ps-8 pe-7 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
                {supplierModalSearch && (
                  <button
                    type="button"
                    onClick={() => setSupplierModalSearch('')}
                    className="absolute end-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSupplierModalFilter('all')}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition-colors ${
                    supplierModalFilter === 'all'
                      ? 'bg-[#0B3B68] text-white'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {lang === 'ar'
                    ? `الكل (${supplierPages.length})`
                    : `All (${supplierPages.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setSupplierModalFilter('unpaid')}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition-colors ${
                    supplierModalFilter === 'unpaid'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  {lang === 'ar'
                    ? `ذمم غير مسددة (${
                        supplierPages.filter((s) => s.unpaidCostJod > 0).length
                      })`
                    : `Unpaid (${
                        supplierPages.filter((s) => s.unpaidCostJod > 0).length
                      })`}
                </button>
              </div>
            </div>

            {/* Suppliers Interactive Cards Grid (Similar to Calendar Cells for 1-click access) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredSupplierPagesForModal.map((s) => {
                const isSelected =
                  selectedSupplierTab.toLowerCase() === s.name.toLowerCase();
                const hasUnpaid = s.unpaidCostJod > 0;
                return (
                  <div
                    key={s.name}
                    className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-sky-50/90 border-[#0B3B68] ring-2 ring-[#0B3B68] shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-sky-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectSupplier(s.name)}
                        className="text-start flex-1 min-w-0 group cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-[#0B3B68] shrink-0" />
                          <h4
                            dir="auto"
                            className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-[#0B3B68] truncate"
                          >
                            {s.name}
                          </h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-bold">
                          <span>
                            {lang === 'ar'
                              ? `${s.itemsCount} قطعة`
                              : `${s.itemsCount} items`}
                          </span>
                          {s.latestDate && (
                            <>
                              <span>·</span>
                              <span className="font-mono" dir="ltr">
                                {s.latestDate}
                              </span>
                            </>
                          )}
                        </div>
                      </button>

                      <div className="text-end shrink-0">
                        <bdi className="text-xs sm:text-sm font-black text-emerald-800 font-mono block">
                          {formatJod(s.totalCostJod, lang)}
                        </bdi>
                        {hasUnpaid ? (
                          <span className="inline-block px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[10px] font-black font-mono">
                            {lang === 'ar' ? 'ذمة:' : 'Due:'}{' '}
                            {formatJod(s.unpaidCostJod, lang)}
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            {lang === 'ar' ? 'مسدد بالكامل' : 'Settled'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick 1-Click Actions for this Supplier */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSelectSupplier(s.name)}
                          className="min-h-[28px] px-2.5 py-0.5 rounded-lg bg-[#0B3B68] hover:bg-[#155E95] text-white text-[11px] font-extrabold cursor-pointer"
                        >
                          {lang === 'ar' ? 'عرض الفواتير' : 'View Invoices'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsSuppliersModalOpen(false);
                            openAddPurchaseFromMainPage(s.name);
                          }}
                          className="min-h-[28px] px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-extrabold cursor-pointer flex items-center gap-0.5"
                          title={lang === 'ar' ? 'إضافة فاتورة للمورد' : 'Add Invoice'}
                        >
                          <Plus className="w-3 h-3" />
                          <span>{lang === 'ar' ? 'فاتورة' : 'Add'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsSuppliersModalOpen(false);
                            openScanInvoiceFromMainPage(s.name);
                          }}
                          className="min-h-[28px] px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-[11px] font-extrabold cursor-pointer flex items-center gap-0.5"
                          title={lang === 'ar' ? 'تصوير فاتورة للمورد' : 'Scan Invoice'}
                        >
                          <Camera className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsSuppliersModalOpen(false);
                            handleStartRenameSupplier(s.name);
                          }}
                          className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                          title={lang === 'ar' ? 'تعديل الاسم' : 'Rename'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsSuppliersModalOpen(false);
                              handleStartDeleteSupplier(s);
                            }}
                            className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title={lang === 'ar' ? 'حذف المورد' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* General Unassigned Purchases Card (if any) */}
              {unassignedPurchases.length > 0 && supplierModalFilter === 'all' && (
                <div
                  className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                    selectedSupplierTab === UNASSIGNED_SUPPLIER_TAB
                      ? 'bg-sky-50/90 border-[#0B3B68] ring-2 ring-[#0B3B68]'
                      : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectSupplier(UNASSIGNED_SUPPLIER_TAB)}
                      className="text-start flex-1 min-w-0 cursor-pointer"
                    >
                      <h4 className="text-xs sm:text-sm font-black text-slate-800">
                        {lang === 'ar'
                          ? '📁 مشتريات عامة (بدون اسم مورد)'
                          : '📁 General Purchases'}
                      </h4>
                      <span className="text-[11px] text-slate-500 font-bold">
                        {lang === 'ar'
                          ? `${unassignedPurchases.length} قطعة`
                          : `${unassignedPurchases.length} items`}
                      </span>
                    </button>
                    <bdi className="text-xs sm:text-sm font-black text-slate-800 font-mono">
                      {formatJod(
                        unassignedPurchases.reduce(
                          (acc, p) => acc + (p.totalCostJod || 0),
                          0
                        ),
                        lang
                      )}
                    </bdi>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleSelectSupplier(UNASSIGNED_SUPPLIER_TAB)}
                      className="min-h-[28px] px-2.5 py-0.5 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-[11px] font-extrabold cursor-pointer"
                    >
                      {lang === 'ar' ? 'عرض المشتريات العامة' : 'View General'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
