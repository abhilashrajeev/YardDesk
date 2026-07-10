export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE';
export type Unit = 'CFT' | 'BAG' | 'NOS' | 'TON';
export type PaymentMode = 'CASH' | 'UPI' | 'BANK' | 'CREDIT';
export type PaymentStatus = 'PAID' | 'PART_PAID' | 'PENDING' | 'OVERDUE';
export type Permission = 'SALES' | 'PURCHASES' | 'PAYMENTS' | 'STOCK' | 'EXPENSES';

export const ALL_PERMISSIONS: { value: Permission; label: string }[] = [
  { value: 'SALES', label: 'Sales & Billing' },
  { value: 'PURCHASES', label: 'Purchases' },
  { value: 'PAYMENTS', label: 'Payments' },
  { value: 'STOCK', label: 'Stock adjustments' },
  { value: 'EXPENSES', label: 'Expenses' },
];

export const TON_TO_CFT = 21;

export interface User {
  id: string;
  name: string;
  phone: string;
  role: Role;
  permissions: Permission[];
}

export interface StaffUser {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  createdAt: string;
}


export interface Material {
  id: string;
  name: string;
  unit: Unit;
  currentStock: string;
  defaultRate?: string | null;
  // Rate for buying in the material's own unit.
  purchaseRate?: string | null;
  // Rate for buying by the ton; its presence is what offers "buy by the ton" on the purchase form.
  purchaseRateTon?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  creditLimit: string;
  openingBalance: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone?: string | null;
  openingBalance: string;
}

export interface Vehicle {
  id: string;
  number: string;
  type?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  capacity?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  isActive?: boolean;
}

export interface LineInput {
  materialId: string;
  quantity: number;
  rate: number;
  // Unit this line is transacted in — only meaningful for purchases (sales
  // always transact in the material's own unit).
  unit?: Unit;
}

export interface LineItem extends LineInput {
  id: string;
  amount: string;
  material?: { name: string; unit: Unit };
}

export type TxnStatus = 'CONFIRMED' | 'CANCELLED';

export interface Sale {
  id: string;
  billNo: string | null;
  date: string;
  freight?: string;
  discount?: string;
  subTotal?: string;
  total: string;
  paymentMode: PaymentMode;
  customer?: { name: string };
  customerId?: string;
  vehicleId?: string | null;
  items?: LineItem[];
  paidAmount?: number;
  balance?: number;
  paymentStatus?: PaymentStatus;
  gatePass?: { passNo: string | null } | null;
  loadingPass?: { passNo: string | null } | null;
  status?: TxnStatus;
  notes?: string | null;
}

export interface Purchase {
  id: string;
  invoiceNo: string | null;
  date: string;
  freight?: string;
  subTotal?: string;
  total: string;
  vendor?: { name: string };
  vendorId?: string;
  vehicle?: { number: string } | null;
  vehicleId?: string | null;
  items?: LineItem[];
  paidAmount?: number;
  balance?: number;
  paymentStatus?: PaymentStatus;
  status?: TxnStatus;
  notes?: string | null;
}

export interface Payment {
  id: string;
  date: string;
  direction: 'IN' | 'OUT';
  mode: PaymentMode;
  amount: string;
  reference?: string | null;
  notes?: string | null;
  partyType: 'CUSTOMER' | 'VENDOR';
  customerId?: string | null;
  vendorId?: string | null;
  customer?: { name: string } | null;
  vendor?: { name: string } | null;
  voided?: boolean;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description?: string | null;
  amount: string;
  mode: PaymentMode;
  createdBy?: { name: string };
  createdAt: string;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  summary: string;
  before?: unknown;
  after?: unknown;
  user?: { name: string };
  createdAt: string;
}

export interface Outstanding {
  id: string;
  name: string;
  phone?: string | null;
  balance: number;
}

export interface DailyReport {
  from: string;
  to: string;
  sales: { count: number; total: number };
  purchases: { count: number; total: number };
  payments: { collected: number; paidOut: number };
  expenses: { count: number; total: number };
  creditGiven: number;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  isRead: boolean;
  createdAt: string;
}
