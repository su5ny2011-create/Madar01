export type Language = 'ar' | 'en';

export type UserRole = 'manager' | 'technician';

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

export interface PartItem {
  id: string;
  name: string;
  category: string;
  defaultCostJod: number;
  defaultPriceJod: number;
  stockQty: number;
  notes?: string;
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
  amountJod: number;
  paymentMethod: PaymentMethod;
  isResolved: boolean;
  note?: string;
  source: 'staff' | 'customer_portal';
  technicianName?: string;
  createdAt: string;
}

export interface MorningCashRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amountJod: number;
  note?: string;
  recordedBy: string;
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
  source?: 'customer_portal' | 'staff';
  isRead: boolean;
  createdAt: string;
}

export interface AppState {
  users: User[];
  customers: Customer[];
  parts: PartItem[];
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
