export type Language = 'ar' | 'en';

export type UserRole = 'manager' | 'technician' | 'admin';

export interface User {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  active: boolean;
  createdAt: string;
}

export function isUserAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  return (
    user.role === 'manager' ||
    user.role === 'admin' ||
    user.username?.toLowerCase() === 'admin'
  );
}

export type ContractType = 'annual' | 'monthly' | 'on_demand';

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  contractType: ContractType;
  contractFeeJod?: number;
  contractEndDate?: string;
  notes?: string;
  createdAt: string;
}

export type PurchasePaymentMethod = 'cash' | 'cliq' | 'credit';

export interface PurchaseRecord {
  id: string;
  partName: string;
  category: string;
  quantity: number;
  unit: string; // 'قطعة' | 'متر' | 'علبة' | 'حبة'
  unitCostJod: number;
  totalCostJod: number;
  sellingPriceJod?: number;
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate: string; // YYYY-MM-DD
  paymentMethod: PurchasePaymentMethod; // 'cash' (كاش) | 'cliq' (كلك) | 'credit' (ذمم)
  isPaid: boolean;
  paidAt?: string;
  notes?: string;
  purchasedBy?: string;
  invoiceImageUrl?: string;
  linkedExpenseId?: string;
  linkedPartId?: string;
  createdAt: string;
}

export interface PartItem {
  id: string;
  name: string;
  category: string;
  defaultCostJod: number;
  defaultPriceJod: number;
  stockQty: number;
  unit?: string;
  supplierName?: string;
  invoiceNumber?: string;
  purchaseDate?: string;
  paymentMethod?: PurchasePaymentMethod;
  notes?: string;
  invoiceImageUrl?: string;
  linkedPurchaseId?: string;
}

export type ExpenseCategory = 'fuel' | 'car_repair' | 'parts_purchase' | 'other';

export interface ExpenseTemplate {
  id: string;
  title: string;
  category: ExpenseCategory;
  defaultAmountJod: number;
  partType?: string;
  notes?: string;
}

export type PaymentMethod = 'cash' | 'check' | 'cliq';

export type MaintenanceStatus = 'pending' | 'in_progress' | 'resolved';

export interface MaintenanceVisit {
  id: string;
  customerId?: string;
  customerName: string;
  phone?: string;
  visitType: 'contract' | 'visit';
  problem: string;
  requiredParts: string[];
  installedParts: string[];
  visitDate: string; // YYYY-MM-DD
  visitTime: string; // HH:mm
  nextVisitDate?: string; // YYYY-MM-DD
  isPaid: boolean;
  noPayment?: boolean;
  amountJod: number;
  paymentMethod: PaymentMethod;
  status?: MaintenanceStatus; // 'pending' (قيد الانتظار) | 'in_progress' (جاري العمل) | 'resolved' (منتهية)
  isResolved: boolean;
  note?: string;
  source: 'staff' | 'customer_portal';
  technicianName?: string;
  createdAt: string;
  isArchived?: boolean;
  archivedAt?: string;
  autoArchiveExcluded?: boolean;
  autoArchiveExcludedDate?: string;
  isFinanceArchived?: boolean;
  financeArchivedAt?: string;
  financeAutoArchiveExcluded?: boolean;
  financeAutoArchiveExcludedDate?: string;
  profitTransferredToMorningCash?: boolean;
}

export interface MorningCashRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amountJod: number;
  note?: string;
  recordedBy: string;
  isArchived?: boolean;
  archivedAt?: string;
  autoArchiveExcluded?: boolean;
  autoArchiveExcludedDate?: string;
}

export interface ExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  category: ExpenseCategory;
  title: string;
  partType?: string; // Required/used when category === 'parts_purchase'
  amountJod: number;
  paymentMethod: PaymentMethod;
  note?: string;
  recordedBy: string;
  isArchived?: boolean;
  archivedAt?: string;
  autoArchiveExcluded?: boolean;
  autoArchiveExcludedDate?: string;
  linkedPurchaseId?: string;
  linkedCashAdvanceId?: string;
  profitTransferredToMorningCash?: boolean;
}

export interface CashAdvanceRecord {
  id: string;
  userId: string;
  userFullName: string;
  username: string;
  amountJod: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  note?: string;
  recordedBy: string;
  linkedExpenseId?: string;
  createdAt: string;
  updatedAt?: number;
}

export interface ScheduleAppointment {
  id: string;
  title: string;
  customerName: string;
  phone?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: 'maintenance' | 'next_visit' | 'contract_check' | 'custom';
  linkedVisitId?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  note?: string;
  reminderSent30Min?: boolean;
}

export interface DailyNote {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  content: string;
  isPinned: boolean;
  isCompleted: boolean;
  author: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  customerName: string;
  phone?: string;
  visitDate: string;
  visitTime: string;
  linkedVisitId: string;
  source?: 'customer_portal' | 'staff' | 'calendar_reminder';
  isRead: boolean;
  createdAt: string;
}

export interface AppState {
  users: User[];
  customers: Customer[];
  parts: PartItem[];
  purchases?: PurchaseRecord[];
  suppliers?: string[];
  cashAdvances?: CashAdvanceRecord[];
  expenseTemplates: ExpenseTemplate[];
  visits: MaintenanceVisit[];
  morningCash: MorningCashRecord[];
  expenses: ExpenseRecord[];
  appointments: ScheduleAppointment[];
  dailyNotes: DailyNote[];
  notifications?: AppNotification[];
}

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'all';

export interface FinancialSummary {
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  morningCashJod: number;
  totalRevenueJod: number;
  revenueByMethod: {
    cash: number;
    check: number;
    cliq: number;
  };
  totalExpensesJod: number;
  expensesByCategory: {
    fuel: number;
    car_repair: number;
    parts_purchase: number;
    other: number;
  };
  cashExpensesJod: number;
  netCashDrawerJod: number; // Morning Cash + Cash Revenue - Cash Expenses
  netProfitJod: number; // Total Revenue - Total Expenses
  totalBalanceWithMorningJod: number; // Morning Cash + Total Revenue - Total Expenses
  visitsCount: number;
  resolvedVisitsCount: number;
  pendingVisitsCount: number;
  paidVisitsCount: number;
  unpaidVisitsCount: number;
  unpaidTotalJod: number;
  portalRequestsCount: number;
}
