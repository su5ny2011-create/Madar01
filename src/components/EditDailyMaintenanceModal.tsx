import React, { useState, useEffect, useMemo } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  Phone,
  Plus,
  User,
  Wrench,
  X,
  Lock,
  ArrowLeftRight,
  Search,
  Check,
  Package,
  Minus,
  ChevronDown,
  ChevronUp,
  Wand2,
} from 'lucide-react';
import type {
  Customer,
  Language,
  MaintenanceStatus,
  MaintenanceVisit,
  PartItem,
} from '../types';
import { getTodayStr } from '../utils/logic';
import { formatNotesText, formatPartName, formatSupplierName } from '../utils/textFormatter';
import { TouchDatePicker } from './TouchDateTimePicker';
import { WorkNotesScannerModal, type ExtractedWorkData } from './WorkNotesScannerModal';

interface CommonPartItem {
  id: string;
  name: string;
  category: 'storage' | 'ram' | 'power' | 'network' | 'service' | 'accessories';
  labelAr: string;
  labelEn: string;
}

const COMMON_PARTS_LIBRARY: CommonPartItem[] = [
  // Storage
  { id: 'ssd-120', name: 'SSD 120GB', category: 'storage', labelAr: 'SSD 120GB', labelEn: 'SSD 120GB' },
  { id: 'ssd-240', name: 'SSD 240GB', category: 'storage', labelAr: 'SSD 240GB', labelEn: 'SSD 240GB' },
  { id: 'ssd-480', name: 'SSD 480GB', category: 'storage', labelAr: 'SSD 480GB', labelEn: 'SSD 480GB' },
  { id: 'ssd-1tb', name: 'SSD 1TB', category: 'storage', labelAr: 'SSD 1TB', labelEn: 'SSD 1TB' },
  { id: 'ssd-nvme-256', name: 'SSD NVMe 256GB M.2', category: 'storage', labelAr: 'SSD NVMe 256GB', labelEn: 'SSD NVMe 256GB' },
  { id: 'ssd-nvme-512', name: 'SSD NVMe 512GB M.2', category: 'storage', labelAr: 'SSD NVMe 512GB', labelEn: 'SSD NVMe 512GB' },
  { id: 'hdd-1tb', name: 'هارد ديسك 1TB HDD', category: 'storage', labelAr: 'هارد 1TB HDD', labelEn: 'HDD 1TB' },

  // RAM
  { id: 'ram-4-d3', name: 'RAM 4GB DDR3', category: 'ram', labelAr: 'RAM 4GB DDR3', labelEn: 'RAM 4GB DDR3' },
  { id: 'ram-8-d3', name: 'RAM 8GB DDR3', category: 'ram', labelAr: 'RAM 8GB DDR3', labelEn: 'RAM 8GB DDR3' },
  { id: 'ram-8-d4', name: 'RAM 8GB DDR4', category: 'ram', labelAr: 'RAM 8GB DDR4', labelEn: 'RAM 8GB DDR4' },
  { id: 'ram-16-d4', name: 'RAM 16GB DDR4', category: 'ram', labelAr: 'RAM 16GB DDR4', labelEn: 'RAM 16GB DDR4' },
  { id: 'ram-lap-8', name: 'رام لابتوب 8GB DDR4', category: 'ram', labelAr: 'رام لابتوب 8GB', labelEn: 'Laptop RAM 8GB' },
  { id: 'ram-lap-16', name: 'رام لابتوب 16GB DDR4', category: 'ram', labelAr: 'رام لابتوب 16GB', labelEn: 'Laptop RAM 16GB' },

  // Power
  { id: 'psu-500', name: 'باور سبلاي 500W', category: 'power', labelAr: 'باور سبلاي 500W', labelEn: 'PSU 500W' },
  { id: 'psu-600', name: 'باور سبلاي 600W', category: 'power', labelAr: 'باور سبلاي 600W', labelEn: 'PSU 600W' },
  { id: 'charger-lap', name: 'شاحن لابتوب أصلي', category: 'power', labelAr: 'شاحن لابتوب أصلي', labelEn: 'Laptop Charger' },
  { id: 'power-cable', name: 'كابل باور أصلي', category: 'power', labelAr: 'كابل باور', labelEn: 'Power Cable' },
  { id: 'sata-cable', name: 'كابل داتا ساتا SATA', category: 'power', labelAr: 'كابل ساتا', labelEn: 'SATA Cable' },

  // Network
  { id: 'net-rj45', name: 'كابل شبكة RJ45', category: 'network', labelAr: 'كابل شبكة RJ45', labelEn: 'RJ45 Cable' },
  { id: 'switch-8', name: 'سويتش شبكة 8 بورت', category: 'network', labelAr: 'سويتش 8 بورت', labelEn: '8-Port Switch' },
  { id: 'router-wifi', name: 'راوتر واي فاي Wi-Fi', category: 'network', labelAr: 'راوتر واي فاي', labelEn: 'Wi-Fi Router' },
  { id: 'net-card-usb', name: 'كرت شبكة USB WiFi', category: 'network', labelAr: 'كرت شبكة USB', labelEn: 'USB WiFi' },

  // Services
  { id: 'srv-format', name: 'فورمات وتثبيت ويندوز 10/11', category: 'service', labelAr: 'فورمات وتنزيل ويندوز', labelEn: 'Windows Format/OS' },
  { id: 'srv-clean', name: 'تنظيف مروحة وتغيير معجون حراري', category: 'service', labelAr: 'تنظيف ومعجون حراري', labelEn: 'Cleaning & Paste' },
  { id: 'srv-bios', name: 'فحص وتحديث بيوس BIOS', category: 'service', labelAr: 'فحص وبيوس BIOS', labelEn: 'BIOS Update' },
  { id: 'srv-soft', name: 'تثبيت برامج أوفيس وتعريفات', category: 'service', labelAr: 'أوفيس وبرامج وتعريفات', labelEn: 'Office & Drivers' },

  // Accessories
  { id: 'ink-black', name: 'حبر طابعة أسود', category: 'accessories', labelAr: 'حبر طابعة أسود', labelEn: 'Black Ink' },
  { id: 'ink-color', name: 'حبر طابعة ملون', category: 'accessories', labelAr: 'حبر طابعة ملون', labelEn: 'Color Ink' },
  { id: 'kb-mouse', name: 'كيبورد وماوس USB', category: 'accessories', labelAr: 'كيبورد وماوس USB', labelEn: 'Keyboard & Mouse' },
  { id: 'thermal-paste', name: 'معجون تبريد حراري أصلي', category: 'accessories', labelAr: 'معجون تبريد أصلي', labelEn: 'Thermal Paste' },
];

export interface EditDailyMaintenanceModalProps {
  lang: Language;
  visit?: MaintenanceVisit | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedVisit: MaintenanceVisit) => void;
  mode?: 'add' | 'edit';
  customers?: Customer[];
  parts?: PartItem[];
  defaultTechnicianName?: string;
  initialCustomerName?: string;
  initialExtractedData?: ExtractedWorkData | null;
}

export const EditDailyMaintenanceModal: React.FC<
  EditDailyMaintenanceModalProps
> = ({
  lang,
  visit,
  isOpen,
  onClose,
  onSave,
  mode = visit ? 'edit' : 'add',
  customers = [],
  parts = [],
  defaultTechnicianName = '',
  initialCustomerName = '',
  initialExtractedData = null,
}) => {
  if (!isOpen) return null;
  if (mode === 'edit' && !visit) return null;

  return (
    <EditDailyMaintenanceModalContent
      lang={lang}
      visit={visit || null}
      mode={mode}
      onClose={onClose}
      onSave={onSave}
      customers={customers}
      parts={parts}
      defaultTechnicianName={defaultTechnicianName}
      initialCustomerName={initialCustomerName}
      initialExtractedData={initialExtractedData}
    />
  );
};

const EditDailyMaintenanceModalContent: React.FC<{
  lang: Language;
  visit: MaintenanceVisit | null;
  mode: 'add' | 'edit';
  onClose: () => void;
  onSave: (updatedVisit: MaintenanceVisit) => void;
  customers: Customer[];
  parts: PartItem[];
  defaultTechnicianName: string;
  initialCustomerName: string;
  initialExtractedData: ExtractedWorkData | null;
}> = ({
  lang,
  visit,
  mode,
  onClose,
  onSave,
  customers,
  parts,
  defaultTechnicianName,
  initialCustomerName,
  initialExtractedData,
}) => {
  const isAddMode = mode === 'add' || !visit;

  const [customerName, setCustomerName] = useState(
    visit?.customerName || initialCustomerName || ''
  );
  const [phone, setPhone] = useState(visit?.phone || '');
  const [visitType, setVisitType] = useState<'contract' | 'visit'>(
    visit?.visitType || 'visit'
  );
  const [problem, setProblem] = useState(visit?.problem || '');
  const [technicianName, setTechnicianName] = useState(
    visit?.technicianName || defaultTechnicianName || ''
  );
  const [visitDate, setVisitDate] = useState(visit?.visitDate || getTodayStr());
  const [visitTime, setVisitTime] = useState(visit?.visitTime || '10:30');
  const [nextVisitDate, setNextVisitDate] = useState(
    visit?.nextVisitDate || ''
  );
  const [requiredParts, setRequiredParts] = useState<string[]>(
    visit?.requiredParts ? [...visit.requiredParts] : []
  );
  const [installedParts, setInstalledParts] = useState<string[]>(
    visit?.installedParts ? [...visit.installedParts] : []
  );
  const [activePartTarget, setActivePartTarget] = useState<'installed' | 'required'>('installed');
  const [showPartsCatalog, setShowPartsCatalog] = useState(false);
  const [partCategoryTab, setPartCategoryTab] = useState<
    'all' | 'storage' | 'ram' | 'power' | 'network' | 'service' | 'accessories' | 'catalog'
  >('all');
  const [partSearchQuery, setPartSearchQuery] = useState('');
  const [justAddedPartName, setJustAddedPartName] = useState<string | null>(null);
  const [amountJod, setAmountJod] = useState<string>(
    visit?.amountJod !== undefined && visit?.amountJod !== null && visit.amountJod > 0
      ? String(visit.amountJod)
      : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check' | 'cliq'>(
    visit?.paymentMethod || 'cash'
  );
  const [isPaid, setIsPaid] = useState<boolean>(Boolean(visit?.isPaid));
  const [noPayment, setNoPayment] = useState<boolean>(Boolean(visit?.noPayment));
  const [status, setStatus] = useState<MaintenanceStatus>(() => {
    if (visit?.status) return visit.status;
    if (visit?.isResolved) return 'resolved';
    return 'pending';
  });
  const [note, setNote] = useState(visit?.note || '');
  const [errorMsg, setErrorMsg] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Synchronize modal state when visit or initial customer/technician changes
  useEffect(() => {
    if (visit) {
      setCustomerName(visit.customerName || '');
      setPhone(visit.phone || '');
      setVisitType(visit.visitType || 'visit');
      setProblem(visit.problem || '');
      setTechnicianName(visit.technicianName || defaultTechnicianName || '');
      setVisitDate(visit.visitDate || getTodayStr());
      setVisitTime(visit.visitTime || '10:30');
      setNextVisitDate(visit.nextVisitDate || '');
      setRequiredParts(visit.requiredParts ? [...visit.requiredParts] : []);
      setInstalledParts(visit.installedParts ? [...visit.installedParts] : []);
      setAmountJod(
        visit.amountJod !== undefined && visit.amountJod !== null && visit.amountJod > 0
          ? String(visit.amountJod)
          : ''
      );
      setPaymentMethod(visit.paymentMethod || 'cash');
      setIsPaid(Boolean(visit.isPaid));
      setNoPayment(Boolean(visit.noPayment));
      setStatus(visit.status || (visit.isResolved ? 'resolved' : 'pending'));
      setNote(visit.note || '');
      setErrorMsg('');
    } else {
      setCustomerName(initialExtractedData?.customerName || initialCustomerName || '');
      setPhone(initialExtractedData?.phone || '');
      setVisitType('visit');
      setProblem(initialExtractedData?.problem || '');
      setTechnicianName(defaultTechnicianName || '');
      setVisitDate(getTodayStr());
      setVisitTime('10:30');
      setNextVisitDate('');
      setRequiredParts(initialExtractedData?.requiredParts ? [...initialExtractedData.requiredParts] : []);
      setInstalledParts(initialExtractedData?.installedParts ? [...initialExtractedData.installedParts] : []);
      setAmountJod(
        initialExtractedData?.amountJod && initialExtractedData.amountJod > 0
          ? String(initialExtractedData.amountJod)
          : ''
      );
      setPaymentMethod('cash');
      setIsPaid(false);
      setNoPayment(false);
      setStatus('pending');
      setNote(
        initialExtractedData?.transcribedText ||
          initialExtractedData?.notesSummary ||
          ''
      );
      setErrorMsg('');
    }
  }, [visit, defaultTechnicianName, initialCustomerName, initialExtractedData]);

  // If initial customer name is set and phone is empty, try looking up in customers
  useEffect(() => {
    if (initialCustomerName && !phone) {
      const match = customers.find(
        (c) => c.name.toLowerCase() === initialCustomerName.toLowerCase()
      );
      if (match) {
        if (match.phone) setPhone(match.phone);
        const isContract = match.contractType !== 'on_demand';
        setVisitType(isContract ? 'contract' : 'visit');
        if (isContract) {
          setAmountJod('');
          setIsPaid(false);
        }
      }
    }
  }, [initialCustomerName, customers, phone]);

  const handleSelectCustomer = (c: Customer) => {
    setCustomerName(c.name);
    if (c.phone) setPhone(c.phone);
    const isContract = c.contractType !== 'on_demand';
    setVisitType(isContract ? 'contract' : 'visit');
    if (isContract) {
      setAmountJod('');
      setIsPaid(false);
    }
  };

  const handleCustomerNameChange = (val: string) => {
    setCustomerName(val);
    const matched = customers.find(
      (c) => c.name.trim().toLowerCase() === val.trim().toLowerCase()
    );
    if (matched) {
      if (matched.phone && !phone) setPhone(matched.phone);
      if (matched.contractType !== 'on_demand') {
        setVisitType('contract');
        setAmountJod('');
        setIsPaid(false);
      }
    }
  };

  const parsePartItem = (raw: string) => {
    const match = raw.match(/^(.*?)\s*\(x(\d+)\)$/i);
    if (match) {
      return { baseName: match[1].trim(), qty: parseInt(match[2], 10) || 1 };
    }
    return { baseName: raw.trim(), qty: 1 };
  };

  const formatPartItem = (baseName: string, qty: number) => {
    if (qty <= 1) return baseName;
    return `${baseName} (x${qty})`;
  };

  const isPartAdded = (partName: string) => {
    const clean = partName.trim().toLowerCase();
    const instItem = installedParts.find(
      (p) => parsePartItem(p).baseName.toLowerCase() === clean
    );
    if (instItem) return { target: 'installed' as const, qty: parsePartItem(instItem).qty };
    const reqItem = requiredParts.find(
      (p) => parsePartItem(p).baseName.toLowerCase() === clean
    );
    if (reqItem) return { target: 'required' as const, qty: parsePartItem(reqItem).qty };
    return null;
  };

  const handleQuickAddPart = (partName: string, target?: 'installed' | 'required') => {
    const clean = partName.trim();
    if (!clean) return;
    const dest = target || activePartTarget;
    const { baseName } = parsePartItem(clean);

    if (dest === 'installed') {
      const existingIdx = installedParts.findIndex(
        (p) => parsePartItem(p).baseName.toLowerCase() === baseName.toLowerCase()
      );
      if (existingIdx >= 0) {
        const current = parsePartItem(installedParts[existingIdx]);
        const updated = [...installedParts];
        updated[existingIdx] = formatPartItem(current.baseName, current.qty + 1);
        setInstalledParts(updated);
      } else {
        setInstalledParts([...installedParts, clean]);
      }
    } else {
      const existingIdx = requiredParts.findIndex(
        (p) => parsePartItem(p).baseName.toLowerCase() === baseName.toLowerCase()
      );
      if (existingIdx >= 0) {
        const current = parsePartItem(requiredParts[existingIdx]);
        const updated = [...requiredParts];
        updated[existingIdx] = formatPartItem(current.baseName, current.qty + 1);
        setRequiredParts(updated);
      } else {
        setRequiredParts([...requiredParts, clean]);
      }
    }

    setJustAddedPartName(clean);
    setPartSearchQuery('');
    setTimeout(() => {
      setJustAddedPartName((cur) => (cur === clean ? null : cur));
    }, 1800);
  };

  const handleIncrementPartQty = (partStr: string, listType: 'installed' | 'required') => {
    const parsed = parsePartItem(partStr);
    const updatedName = formatPartItem(parsed.baseName, parsed.qty + 1);
    if (listType === 'installed') {
      setInstalledParts(installedParts.map((p) => (p === partStr ? updatedName : p)));
    } else {
      setRequiredParts(requiredParts.map((p) => (p === partStr ? updatedName : p)));
    }
  };

  const handleDecrementPartQty = (partStr: string, listType: 'installed' | 'required') => {
    const parsed = parsePartItem(partStr);
    if (parsed.qty > 1) {
      const updatedName = formatPartItem(parsed.baseName, parsed.qty - 1);
      if (listType === 'installed') {
        setInstalledParts(installedParts.map((p) => (p === partStr ? updatedName : p)));
      } else {
        setRequiredParts(requiredParts.map((p) => (p === partStr ? updatedName : p)));
      }
    } else {
      if (listType === 'installed') {
        setInstalledParts(installedParts.filter((p) => p !== partStr));
      } else {
        setRequiredParts(requiredParts.filter((p) => p !== partStr));
      }
    }
  };

  const handleTogglePartDestination = (
    partStr: string,
    currentDest: 'installed' | 'required'
  ) => {
    if (currentDest === 'installed') {
      setInstalledParts(installedParts.filter((p) => p !== partStr));
      if (!requiredParts.includes(partStr)) {
        setRequiredParts([...requiredParts, partStr]);
      }
    } else {
      setRequiredParts(requiredParts.filter((p) => p !== partStr));
      if (!installedParts.includes(partStr)) {
        setInstalledParts([...installedParts, partStr]);
      }
    }
  };

  const handleRemovePart = (partStr: string, currentDest: 'installed' | 'required') => {
    if (currentDest === 'installed') {
      setInstalledParts(installedParts.filter((p) => p !== partStr));
    } else {
      setRequiredParts(requiredParts.filter((p) => p !== partStr));
    }
  };

  const handleAddCustomPart = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = partSearchQuery.trim();
    if (!val) return;
    handleQuickAddPart(val);
  };

  const filteredQuickParts = useMemo(() => {
    const q = partSearchQuery.trim().toLowerCase();
    let list = COMMON_PARTS_LIBRARY;
    if (partCategoryTab !== 'all' && partCategoryTab !== 'catalog') {
      list = list.filter((it) => it.category === partCategoryTab);
    }
    if (q) {
      list = list.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.labelAr.toLowerCase().includes(q) ||
          it.labelEn.toLowerCase().includes(q)
      );
    }
    return list;
  }, [partCategoryTab, partSearchQuery]);

  const filteredCatalogParts = useMemo(() => {
    const q = partSearchQuery.trim().toLowerCase();
    if (!q && partCategoryTab !== 'catalog') return parts.slice(0, 15);
    return parts.filter(
      (pt) =>
        !q ||
        pt.name.toLowerCase().includes(q) ||
        pt.category.toLowerCase().includes(q)
    );
  }, [parts, partSearchQuery, partCategoryTab]);

  const searchResultsList = useMemo(() => {
    const q = partSearchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: { name: string; categoryLabel: string; isFromCatalog: boolean; price?: number }[] = [];

    parts.forEach((pt) => {
      if (pt.name.toLowerCase().includes(q) || pt.category.toLowerCase().includes(q)) {
        results.push({
          name: pt.name,
          categoryLabel: pt.category,
          isFromCatalog: true,
          price: pt.defaultPriceJod,
        });
      }
    });

    COMMON_PARTS_LIBRARY.forEach((lib) => {
      if (
        lib.name.toLowerCase().includes(q) ||
        lib.labelAr.toLowerCase().includes(q) ||
        lib.labelEn.toLowerCase().includes(q)
      ) {
        if (!results.some((r) => r.name.toLowerCase() === lib.name.toLowerCase())) {
          results.push({
            name: lib.name,
            categoryLabel: lib.labelAr,
            isFromCatalog: false,
          });
        }
      }
    });

    return results.slice(0, 6);
  }, [partSearchQuery, parts]);

  const handleScanNotesInsert = (scannedText: string, scanMode: 'replace' | 'append') => {
    if (scanMode === 'append' && note.trim()) {
      setNote(`${note.trim()}\n\n[ملاحظات الورقة]:\n${scannedText.trim()}`);
    } else {
      setNote(scannedText.trim());
    }
  };

  const handleApplyExtractedData = (data: ExtractedWorkData) => {
    const textToInsert = data.transcribedText || data.notesSummary || '';
    if (textToInsert) {
      if (note.trim()) {
        setNote(`${note.trim()}\n\n${textToInsert.trim()}`);
      } else {
        setNote(textToInsert.trim());
      }
    }
    if (data.customerName && !customerName) {
      setCustomerName(data.customerName);
    }
    if (data.phone && !phone) {
      setPhone(data.phone);
    }
    if (data.problem && !problem) {
      setProblem(data.problem);
    }
    if (data.amountJod && (!amountJod || amountJod === '0')) {
      setAmountJod(String(data.amountJod));
    }
    if (data.installedParts && data.installedParts.length > 0) {
      const merged = Array.from(
        new Set([...installedParts, ...data.installedParts])
      );
      setInstalledParts(merged);
    }
    if (data.requiredParts && data.requiredParts.length > 0) {
      const merged = Array.from(
        new Set([...requiredParts, ...data.requiredParts])
      );
      setRequiredParts(merged);
    }
  };

  const quickCommonProblems = [
    { ar: 'فحص وصيانة عامة', en: 'General Maintenance' },
    { ar: 'صيانة دورية لعقد', en: 'Contract Visit' },
    { ar: 'مشكلة طابعة وشبكات', en: 'Printer/Network' },
    { ar: 'تبديل قطع تالفة', en: 'Replace Parts' },
    { ar: 'تنزيل نظام وسوفتوير', en: 'OS & Software' },
  ];

  // Compute total price of installed parts that match store catalog prices
  const installedCatalogPartsTotal = useMemo(() => {
    let sum = 0;
    for (const raw of installedParts) {
      const { baseName, qty } = parsePartItem(raw);
      const matched = parts.find(
        (pt) => pt.name.trim().toLowerCase() === baseName.toLowerCase()
      );
      if (matched && matched.defaultPriceJod > 0) {
        sum += matched.defaultPriceJod * qty;
      }
    }
    return Math.round(sum * 100) / 100;
  }, [installedParts, parts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanCustomer = formatSupplierName(customerName) || customerName.trim();
    if (!cleanCustomer) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى إدخال أو اختيار اسم الزبون أو الجهة'
          : 'Please enter or select customer name'
      );
      return;
    }

    const cleanProblem = formatNotesText(problem) || problem.trim();
    if (!cleanProblem) {
      setErrorMsg(
        lang === 'ar'
          ? 'يرجى كتابة وصف المشكلة أو نوع العمل المطلوب'
          : 'Please enter the issue or requested maintenance work'
      );
      return;
    }

    // If the user typed a part name in the search box and clicked Save without clicking "+ Add", include it automatically
    let finalInstalled = [...installedParts];
    let finalRequired = [...requiredParts];
    const pendingPart = formatPartName(partSearchQuery);
    if (pendingPart) {
      if (activePartTarget === 'installed') {
        if (!finalInstalled.some((p) => parsePartItem(p).baseName.toLowerCase() === pendingPart.toLowerCase())) {
          finalInstalled.push(pendingPart);
        }
      } else {
        if (!finalRequired.some((p) => parsePartItem(p).baseName.toLowerCase() === pendingPart.toLowerCase())) {
          finalRequired.push(pendingPart);
        }
      }
    }

    const finalNoPayment = visitType === 'contract' ? false : noPayment;
    const finalAmount =
      visitType === 'contract' || finalNoPayment
        ? 0
        : Math.max(0, parseFloat(amountJod) || 0);
    const finalIsPaid =
      visitType === 'contract' || finalNoPayment ? false : isPaid;
    const finalTechnician = isAddMode
      ? defaultTechnicianName || 'فني الصيانة'
      : technicianName.trim() || defaultTechnicianName || undefined;
    const todayStr = getTodayStr();
    const chosenDate = visitDate || todayStr;

    const record: MaintenanceVisit = {
      id: visit?.id || `visit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerName: cleanCustomer,
      phone: phone.trim() || undefined,
      visitType,
      problem: cleanProblem,
      technicianName: finalTechnician,
      visitDate: chosenDate,
      visitTime: visitTime || '10:30',
      nextVisitDate: nextVisitDate.trim() || undefined,
      requiredParts: finalRequired,
      installedParts: finalInstalled,
      amountJod: finalAmount,
      paymentMethod,
      isPaid: finalIsPaid,
      noPayment: finalNoPayment,
      status,
      isResolved: status === 'resolved',
      note: formatNotesText(note) || undefined,
      source: visit?.source || 'staff',
      createdAt: visit?.createdAt || new Date().toISOString(),
      isArchived: visit?.isArchived || false,
      archivedAt: visit?.archivedAt,
      autoArchiveExcluded:
        visit?.autoArchiveExcluded ?? (!visit?.isArchived && chosenDate < todayStr ? true : undefined),
      isFinanceArchived: visit?.isFinanceArchived,
      financeArchivedAt: visit?.financeArchivedAt,
      financeAutoArchiveExcluded: visit?.financeAutoArchiveExcluded,
    };

    onSave(record);
    onClose();
  };

  const totalPartsCount = installedParts.length + requiredParts.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-3 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] my-2 animate-in fade-in zoom-in-95 duration-150">
        {/* Compact Header */}
        <div className="bg-[#0B3B68] text-white px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                isAddMode
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  : 'bg-white/10 text-amber-300'
              }`}
            >
              {isAddMode ? (
                <Plus className="w-4 h-4 text-emerald-300" />
              ) : (
                <Edit3 className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                {isAddMode
                  ? lang === 'ar'
                    ? 'إضافة طلب صيانة جديد'
                    : 'New Maintenance Request'
                  : lang === 'ar'
                  ? `تعديل طلب: ${customerName || visit?.customerName}`
                  : `Edit Request: ${customerName || visit?.customerName}`}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 text-2xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
              title={lang === 'ar' ? 'تصوير ورقة ملاحظات العمل وتفريغها' : 'Scan Work Notes'}
            >
              <Camera className="w-3.5 h-3.5 text-amber-300" />
              <span>{lang === 'ar' ? 'تصوير ورقة عمل' : 'Scan Notes'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-3.5 sm:p-4 space-y-3 flex-1">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <X className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Horizontal Quick Customer Chips (Single Compact Scrollable Strip) */}
          {customers.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-2xs font-extrabold text-slate-500 shrink-0">
                {lang === 'ar' ? 'زبائن مسجلون:' : 'Customers:'}
              </span>
              {customers.slice(0, 12).map((c) => {
                const isSelected = customerName.trim().toLowerCase() === c.name.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCustomer(c)}
                    className={`px-2 py-0.5 rounded-lg text-2xs font-bold border transition-colors cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#0B3B68]/40 hover:bg-sky-50'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Row 1: Customer Name (5 cols) + Phone (4 cols) + Visit Type (3 cols) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-5 space-y-1">
              <label htmlFor="edit-cust-name" className="text-2xs font-extrabold text-slate-700 block">
                {lang === 'ar' ? 'اسم الزبون / الجهة *' : 'Customer Name *'}
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none" />
                <input
                  id="edit-cust-name"
                  type="text"
                  required
                  list="registered-customers-datalist"
                  value={customerName}
                  onChange={(e) => handleCustomerNameChange(e.target.value)}
                  placeholder={lang === 'ar' ? 'اسم الزبون أو الشركة...' : 'Customer name...'}
                  className="w-full h-9 ps-8 pe-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
                <datalist id="registered-customers-datalist">
                  {customers.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="sm:col-span-4 space-y-1">
              <label htmlFor="edit-cust-phone" className="text-2xs font-extrabold text-slate-700 block">
                {lang === 'ar' ? 'رقم الهاتف' : 'Phone'}
              </label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none" />
                <input
                  id="edit-cust-phone"
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="079xxxxxxx"
                  className="w-full h-9 ps-8 pe-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
              </div>
            </div>

            <div className="sm:col-span-3 space-y-1">
              <span className="text-2xs font-extrabold text-slate-700 block">
                {lang === 'ar' ? 'نوع الزيارة' : 'Visit Type'}
              </span>
              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-slate-100 border border-slate-200 h-9">
                <button
                  type="button"
                  onClick={() => setVisitType('visit')}
                  className={`rounded-lg text-2xs font-extrabold transition-colors cursor-pointer ${
                    visitType === 'visit'
                      ? 'bg-[#0B3B68] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang === 'ar' ? 'زيارة عادية' : 'Single'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVisitType('contract');
                    setAmountJod('');
                    setIsPaid(false);
                  }}
                  className={`rounded-lg text-2xs font-extrabold transition-colors cursor-pointer ${
                    visitType === 'contract'
                      ? 'bg-[#0B3B68] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lang === 'ar' ? 'عقد دوري' : 'Contract'}
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Problem Description + Inline Quick Tags + Format Button */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <div className="flex items-center gap-1.5">
                <label htmlFor="edit-problem-desc" className="text-2xs font-extrabold text-slate-700">
                  {lang === 'ar' ? 'وصف العطل أو العمل المطلوب *' : 'Issue / Work Description *'}
                </label>
                {problem.trim() && (
                  <button
                    type="button"
                    onClick={() => setProblem(formatNotesText(problem))}
                    className="px-1.5 py-0.5 rounded bg-sky-50 hover:bg-sky-100 text-[#0B3B68] border border-sky-200 text-[10px] font-extrabold inline-flex items-center gap-0.5 cursor-pointer"
                    title={lang === 'ar' ? 'تحسين وتنسيق النص لمنع التداخل' : 'Format text'}
                  >
                    <Wand2 className="w-2.5 h-2.5" />
                    <span>{lang === 'ar' ? 'تنسيق النص' : 'Format'}</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {quickCommonProblems.map((tag, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setProblem((prev) => (prev ? `${prev} + ${tag.ar}` : tag.ar))}
                    className="px-1.5 py-0.5 rounded-md bg-slate-100 hover:bg-sky-50 hover:text-[#0B3B68] text-[10px] font-bold text-slate-600 border border-slate-200/80 transition-colors cursor-pointer"
                  >
                    +{lang === 'ar' ? tag.ar : tag.en}
                  </button>
                ))}
              </div>
            </div>
            <input
              id="edit-problem-desc"
              type="text"
              required
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder={lang === 'ar' ? 'اكتب وصف المشكلة أو اختر من الاختصارات أعلاه...' : 'Issue description...'}
              className="w-full h-9 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          </div>

          {/* Row 3: Visit Date + Visit Time + Next Visit Date + Technician (All 4 in 1 compact row) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="space-y-1">
              <span className="text-2xs font-extrabold text-slate-700 block">
                {lang === 'ar' ? 'تاريخ الزيارة *' : 'Visit Date *'}
              </span>
              <TouchDatePicker
                id="edit-visit-date"
                value={visitDate}
                onChange={setVisitDate}
                lang={lang}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="edit-visit-time" className="text-2xs font-extrabold text-slate-700 block">
                {lang === 'ar' ? 'الوقت (اختياري)' : 'Time (Opt)'}
              </label>
              <input
                id="edit-visit-time"
                type="time"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                className="w-full min-h-[38px] px-2.5 py-1 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
              />
            </div>

            <div className="space-y-1">
              <span className="text-2xs font-extrabold text-slate-700 block">
                {lang === 'ar' ? 'زيارة قادمة (اختياري)' : 'Next Visit'}
              </span>
              <TouchDatePicker
                id="edit-next-visit-date"
                value={nextVisitDate}
                onChange={setNextVisitDate}
                lang={lang}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="edit-tech-name" className="text-2xs font-extrabold text-slate-700 flex items-center justify-between">
                <span>{lang === 'ar' ? 'الفني المسؤول' : 'Technician'}</span>
                {isAddMode && <Lock className="w-2.5 h-2.5 text-amber-600" />}
              </label>
              <input
                id="edit-tech-name"
                type="text"
                readOnly={isAddMode}
                value={isAddMode ? defaultTechnicianName || technicianName || 'فني الصيانة' : technicianName}
                onChange={(e) => {
                  if (!isAddMode) setTechnicianName(e.target.value);
                }}
                className={`w-full min-h-[38px] px-2.5 py-1 rounded-xl border text-xs font-bold ${
                  isAddMode
                    ? 'border-slate-200 bg-slate-100 text-slate-700 cursor-not-allowed'
                    : 'border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]'
                }`}
              />
            </div>
          </div>

          {/* Row 4: Status (منجز قبل الدفع) & Financials Combined Compactly */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            {/* Status Selector (5 cols) — Comes FIRST before Payment */}
            <div className="sm:col-span-5 space-y-1">
              <span className="text-2xs font-extrabold text-slate-700 block">
                {lang === 'ar' ? '1. حالة إنجاز الطلب (منجز قبل الدفع):' : '1. Request Status:'}
              </span>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setStatus('pending');
                    setIsPaid(false);
                  }}
                  className={`h-9 px-2 rounded-lg text-2xs font-extrabold border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    status === 'pending'
                      ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'
                  }`}
                >
                  <Clock className="w-3 h-3 shrink-0" />
                  <span className="truncate">{lang === 'ar' ? 'انتظار' : 'Pending'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStatus('in_progress');
                    setIsPaid(false);
                  }}
                  className={`h-9 px-2 rounded-lg text-2xs font-extrabold border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    status === 'in_progress'
                      ? 'bg-[#0B3B68] text-white border-[#0B3B68] shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-sky-50'
                  }`}
                >
                  <Wrench className="w-3 h-3 shrink-0" />
                  <span className="truncate">{lang === 'ar' ? 'جاري العمل' : 'Working'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStatus('resolved');
                    setErrorMsg('');
                  }}
                  className={`h-9 px-2 rounded-lg text-2xs font-extrabold border flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    status === 'resolved'
                      ? 'bg-[#1E824C] text-white border-[#145A32] shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span className="truncate">{lang === 'ar' ? 'منجز (تم الحل)' : 'Resolved'}</span>
                </button>
              </div>
            </div>

            {/* Financials (7 cols) */}
            <div className="sm:col-span-7">
              {visitType === 'contract' ? (
                <div className="h-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50/90 border border-amber-200">
                  <span className="text-2xs font-extrabold text-amber-900">
                    {lang === 'ar' ? 'عقد صيانة دوري — بدون رسوم مفردة' : 'Periodic Contract — No single fee'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-200/70 text-amber-950 text-[10px] font-extrabold shrink-0">
                    {lang === 'ar' ? 'غير مدفوع' : 'Unpaid'}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-12 gap-1.5">
                  <div className="col-span-1 sm:col-span-3 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <label htmlFor="edit-amount-jod" className="text-2xs font-extrabold text-slate-700 block">
                        {lang === 'ar' ? 'المبلغ (د.أ)' : 'Amount'}
                      </label>
                      {installedCatalogPartsTotal > 0 && !noPayment && (
                        <button
                          type="button"
                          onClick={() => {
                            setNoPayment(false);
                            setAmountJod(String(installedCatalogPartsTotal));
                          }}
                          className="text-[10px] font-extrabold text-emerald-700 hover:underline cursor-pointer"
                          title={lang === 'ar' ? 'إدراج مجموع أسعار القطع المركبة' : 'Use parts total'}
                        >
                          {installedCatalogPartsTotal} د.أ
                        </button>
                      )}
                    </div>
                    <input
                      id="edit-amount-jod"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      disabled={noPayment}
                      value={noPayment ? '' : amountJod}
                      onChange={(e) => {
                        setNoPayment(false);
                        setAmountJod(e.target.value);
                      }}
                      className={`w-full h-9 px-2 py-1 rounded-lg border text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0B3B68] ${
                        noPayment
                          ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'border-slate-300 bg-white text-slate-900'
                      }`}
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-3 space-y-1">
                    <label htmlFor="edit-pay-method" className="text-2xs font-extrabold text-slate-700 block">
                      {lang === 'ar' ? 'طريقة الدفع' : 'Method'}
                    </label>
                    <select
                      id="edit-pay-method"
                      disabled={noPayment}
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'check' | 'cliq')}
                      className={`w-full h-9 px-1.5 py-1 rounded-lg border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0B3B68] ${
                        noPayment
                          ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'border-slate-300 bg-white text-slate-900'
                      }`}
                    >
                      <option value="cash">{lang === 'ar' ? 'كاش' : 'Cash'}</option>
                      <option value="cliq">{lang === 'ar' ? 'كلك CliQ' : 'CliQ'}</option>
                      <option value="check">{lang === 'ar' ? 'شيك' : 'Check'}</option>
                    </select>
                  </div>

                  <div className="col-span-2 sm:col-span-6 space-y-1">
                    <span className="text-2xs font-extrabold text-slate-700 block">
                      {lang === 'ar' ? '2. حالة الدفع' : '2. Payment'}
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (noPayment) {
                            setNoPayment(false);
                            if (status === 'resolved') {
                              setIsPaid(true);
                              setErrorMsg('');
                            }
                            return;
                          }
                          if (!isPaid && status !== 'resolved') {
                            setErrorMsg(
                              lang === 'ar'
                                ? 'يجب تحديد حالة الطلب كـ «منجز (تم الحل)» أولاً قبل تفعيل الدفع.'
                                : 'Please mark request as Resolved before marking as Paid.'
                            );
                            return;
                          }
                          setErrorMsg('');
                          setIsPaid(!isPaid);
                        }}
                        className={`w-full h-9 px-2 rounded-lg text-2xs font-extrabold border transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                          isPaid && !noPayment
                            ? 'bg-[#1E824C] text-white border-[#1E824C] shadow-2xs'
                            : !noPayment
                            ? 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {isPaid && !noPayment
                            ? lang === 'ar'
                              ? 'تم الدفع'
                              : 'Paid'
                            : lang === 'ar'
                            ? 'غير مدفوع'
                            : 'Unpaid'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const nextNoPay = !noPayment;
                          setNoPayment(nextNoPay);
                          if (nextNoPay) {
                            setIsPaid(false);
                            setAmountJod('');
                            setErrorMsg('');
                          }
                        }}
                        className={`w-full h-9 px-2 rounded-lg text-2xs font-extrabold border transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                          noPayment
                            ? 'bg-[#0B3B68] text-white border-[#0B3B68] shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-sky-50'
                        }`}
                      >
                        <X className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {lang === 'ar' ? 'بدون دفع' : 'No Payment'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 5: Ultra-Compact Spare Parts Section (Collapsible Quick Library) */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
            {/* Single compact bar: Target toggle + Search input + Quick Catalog toggle */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center p-0.5 rounded-lg bg-slate-200/80 border border-slate-300 text-2xs font-extrabold shrink-0">
                <button
                  type="button"
                  onClick={() => setActivePartTarget('installed')}
                  className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                    activePartTarget === 'installed'
                      ? 'bg-[#1E824C] text-white shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <span>{lang === 'ar' ? 'مركبة' : 'Installed'}</span>
                  <span className="px-1 rounded-full bg-black/15 text-[10px] font-mono">
                    {installedParts.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePartTarget('required')}
                  className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                    activePartTarget === 'required'
                      ? 'bg-[#0B3B68] text-white shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <span>{lang === 'ar' ? 'مطلوبة' : 'Required'}</span>
                  <span className="px-1 rounded-full bg-black/15 text-[10px] font-mono">
                    {requiredParts.length}
                  </span>
                </button>
              </div>

              {/* Search / Custom Part Input */}
              <div className="relative flex-1 min-w-[160px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={partSearchQuery}
                  onChange={(e) => setPartSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomPart();
                    }
                  }}
                  placeholder={
                    lang === 'ar'
                      ? `اكتب اسم قطعة (${activePartTarget === 'installed' ? 'مركبة' : 'مطلوبة'}) واضغط Enter...`
                      : 'Type or search part...'
                  }
                  className="w-full h-8 ps-8 pe-7 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
                />
                {partSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPartSearchQuery('')}
                    className="absolute top-1/2 -translate-y-1/2 end-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                {/* Autocomplete Dropdown */}
                {partSearchQuery.trim() && searchResultsList.length > 0 && (
                  <div className="absolute z-30 start-0 end-0 mt-1 p-1.5 bg-white rounded-xl border border-slate-300 shadow-lg space-y-0.5">
                    {searchResultsList.map((item, idx) => {
                      const partState = isPartAdded(item.name);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleQuickAddPart(item.name)}
                          className="w-full text-start px-2 py-1.5 rounded-lg hover:bg-sky-50 flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Plus className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-extrabold text-slate-800 truncate">{item.name}</span>
                          </div>
                          {partState && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold shrink-0">
                              ✓ x{partState.qty}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleAddCustomPart()}
                className={`h-8 px-2.5 rounded-lg text-white text-2xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0 ${
                  activePartTarget === 'installed'
                    ? 'bg-[#1E824C] hover:bg-[#145A32]'
                    : 'bg-[#0B3B68] hover:bg-[#155E95]'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إضافة' : 'Add'}</span>
              </button>

              {/* Toggle Quick Parts Catalog Button */}
              <button
                type="button"
                onClick={() => setShowPartsCatalog((prev) => !prev)}
                className={`h-8 px-2.5 rounded-lg border text-2xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
                  showPartsCatalog
                    ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                    : 'bg-white text-[#0B3B68] border-slate-300 hover:bg-sky-50'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'قطع سريعة' : 'Quick Parts'}</span>
                {showPartsCatalog ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {justAddedPartName && (
              <div className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-2xs font-bold flex items-center justify-between">
                <span>
                  ✓ {lang === 'ar' ? `تمت إضافة «${justAddedPartName}»` : `Added "${justAddedPartName}"`}
                </span>
                <button type="button" onClick={() => setJustAddedPartName(null)}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Collapsible Quick Chips Catalog (Hidden by default to save space!) */}
            {showPartsCatalog && (
              <div className="space-y-1.5 pt-1 border-t border-slate-200 animate-in fade-in duration-150">
                <div className="flex flex-wrap gap-1">
                  {[
                    { id: 'all', label: lang === 'ar' ? 'الكل' : 'All' },
                    { id: 'storage', label: lang === 'ar' ? 'تخزين SSD' : 'Storage' },
                    { id: 'ram', label: lang === 'ar' ? 'رامات RAM' : 'RAM' },
                    { id: 'power', label: lang === 'ar' ? 'باور وشواحن' : 'Power' },
                    { id: 'service', label: lang === 'ar' ? 'صيانة وفورمات' : 'Service' },
                    { id: 'network', label: lang === 'ar' ? 'شبكات' : 'Network' },
                    { id: 'accessories', label: lang === 'ar' ? 'إكسسوارات' : 'Accessories' },
                    ...(parts.length > 0
                      ? [{ id: 'catalog', label: lang === 'ar' ? `المستودع (${parts.length})` : `Store (${parts.length})` }]
                      : []),
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setPartCategoryTab(cat.id as any)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition-colors cursor-pointer border ${
                        partCategoryTab === cat.id
                          ? 'bg-[#0B3B68] text-white border-[#0B3B68]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-1.5 bg-white rounded-lg border border-slate-200">
                  {(partCategoryTab === 'catalog' ? filteredCatalogParts : filteredQuickParts).map((item: any) => {
                    const displayLabel = partCategoryTab === 'catalog' ? item.name : lang === 'ar' ? item.labelAr : item.labelEn;
                    const partState = isPartAdded(item.name);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleQuickAddPart(item.name)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border flex items-center gap-1 transition-all cursor-pointer ${
                          partState
                            ? partState.target === 'installed'
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : 'bg-sky-50 border-sky-300 text-[#0B3B68]'
                            : 'bg-slate-50 hover:bg-sky-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        {partState ? (
                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                        ) : (
                          <Plus className="w-2.5 h-2.5 text-[#0B3B68] shrink-0" />
                        )}
                        <span>{displayLabel}</span>
                        {partState && (
                          <span className="text-[10px] font-mono font-extrabold px-1 rounded bg-white">
                            x{partState.qty}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Compact Unified Display of Added Parts (Only takes space when parts exist!) */}
            {totalPartsCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {installedParts.map((partStr, idx) => {
                  const parsed = parsePartItem(partStr);
                  return (
                    <div
                      key={`inst-${idx}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-2xs font-bold text-emerald-950"
                    >
                      <span className="text-[10px] font-extrabold text-emerald-700">
                        {lang === 'ar' ? 'مركب:' : 'Inst:'}
                      </span>
                      <span className="truncate max-w-[140px]">{parsed.baseName}</span>
                      <div className="flex items-center bg-white rounded border border-emerald-200 px-0.5">
                        <button
                          type="button"
                          onClick={() => handleDecrementPartQty(partStr, 'installed')}
                          className="w-3.5 h-3.5 text-slate-500 hover:text-rose-600 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-[10px] font-mono font-extrabold px-1 text-emerald-900">
                          x{parsed.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleIncrementPartQty(partStr, 'installed')}
                          className="w-3.5 h-3.5 text-slate-500 hover:text-emerald-700 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTogglePartDestination(partStr, 'installed')}
                        title={lang === 'ar' ? 'نقل إلى مطلوبة' : 'Move to Required'}
                        className="p-0.5 text-emerald-700 hover:bg-emerald-200/70 rounded cursor-pointer"
                      >
                        <ArrowLeftRight className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePart(partStr, 'installed')}
                        className="p-0.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}

                {requiredParts.map((partStr, idx) => {
                  const parsed = parsePartItem(partStr);
                  return (
                    <div
                      key={`req-${idx}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-50 border border-sky-300 text-2xs font-bold text-[#0B3B68]"
                    >
                      <span className="text-[10px] font-extrabold text-sky-700">
                        {lang === 'ar' ? 'مطلوب:' : 'Req:'}
                      </span>
                      <span className="truncate max-w-[140px]">{parsed.baseName}</span>
                      <div className="flex items-center bg-white rounded border border-sky-200 px-0.5">
                        <button
                          type="button"
                          onClick={() => handleDecrementPartQty(partStr, 'required')}
                          className="w-3.5 h-3.5 text-slate-500 hover:text-rose-600 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-[10px] font-mono font-extrabold px-1 text-[#0B3B68]">
                          x{parsed.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleIncrementPartQty(partStr, 'required')}
                          className="w-3.5 h-3.5 text-slate-500 hover:text-[#0B3B68] flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTogglePartDestination(partStr, 'required')}
                        title={lang === 'ar' ? 'نقل إلى مركبة' : 'Move to Installed'}
                        className="p-0.5 text-[#0B3B68] hover:bg-sky-200/70 rounded cursor-pointer"
                      >
                        <ArrowLeftRight className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePart(partStr, 'required')}
                        className="p-0.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Row 6: Compact Work Notes */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="edit-visit-note"
                  className="text-2xs font-extrabold text-slate-700 flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5 text-[#0B3B68]" />
                  <span>{lang === 'ar' ? 'ملاحظات فنية (اختياري):' : 'Technical Notes (Opt):'}</span>
                </label>
                {note.trim() && (
                  <button
                    type="button"
                    onClick={() => setNote(formatNotesText(note))}
                    className="px-1.5 py-0.5 rounded bg-sky-50 hover:bg-sky-100 text-[#0B3B68] border border-sky-200 text-[10px] font-extrabold inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <Wand2 className="w-2.5 h-2.5" />
                    <span>{lang === 'ar' ? 'تنسيق النص' : 'Format'}</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-2 py-0.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 text-[11px] font-extrabold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Camera className="w-3 h-3 text-[#E58E26]" />
                <span>{lang === 'ar' ? 'تصوير ورقة ملاحظات' : 'Scan Paper'}</span>
              </button>
            </div>

            <textarea
              id="edit-visit-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                lang === 'ar'
                  ? 'أي ملاحظات إضافية للعمل اليومي...'
                  : 'Additional work notes...'
              }
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0B3B68]"
            />
          </div>

          {/* Compact Footer Submit */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              type="submit"
              className="h-9 px-5 rounded-xl bg-[#0B3B68] hover:bg-[#155E95] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              {isAddMode ? (
                <>
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>{lang === 'ar' ? 'حفظ طلب الصيانة' : 'Save Request'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Embedded Work Notes Scanner Modal */}
      <WorkNotesScannerModal
        lang={lang}
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onInsertNotes={handleScanNotesInsert}
        onApplyExtractedData={handleApplyExtractedData}
        currentNotes={note}
        titleCustom={
          lang === 'ar'
            ? 'تصوير ورقة ملاحظات العمل وتفريغها في الطلب'
            : 'Scan Work Notes Sheet to Request'
        }
      />
    </div>
  );
};
