export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE';
export type Unit = 'CFT' | 'BAG' | 'NOS' | 'TON';
export type PaymentMode = 'CASH' | 'UPI' | 'BANK' | 'CREDIT';
export type PaymentStatus = 'PAID' | 'PART_PAID' | 'PENDING' | 'OVERDUE';
export type TxnStatus = 'CONFIRMED' | 'CANCELLED';
export type Permission = 'SALES' | 'PURCHASES' | 'PAYMENTS' | 'STOCK' | 'EXPENSES';

export const ALL_PERMISSIONS: { value: Permission; label: string }[] = [
  { value: 'SALES', label: 'Sales & Billing' },
  { value: 'PURCHASES', label: 'Purchases' },
  { value: 'PAYMENTS', label: 'Payments' },
  { value: 'STOCK', label: 'Stock adjustments' },
  { value: 'EXPENSES', label: 'Expenses' },
];

export interface User {
  id: string;
  name: string;
  role: Role;
  permissions: Permission[];
}

export interface Material {
  id: string;
  name: string;
  unit: Unit;
  currentStock: string;
  defaultRate?: string | null;
  purchaseRate?: string | null;
  purchaseRateTon?: string | null;
}
export interface Party {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  creditLimit?: string;
  openingBalance?: string;
}

export interface Vehicle {
  id: string;
  number: string;
  type?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  capacity?: string | null;
  isActive?: boolean;
}

export interface Line {
  materialId: string;
  quantity: number;
  rate: number;
  unit?: Unit;
}

export interface LineItem extends Line {
  id: string;
  amount: string;
  material?: { name: string; unit: Unit };
}

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
  status?: TxnStatus;
  gatePass?: { passNo: string | null } | null;
  loadingPass?: { passNo: string | null } | null;
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
}

export interface Payment {
  id: string;
  date: string;
  direction: 'IN' | 'OUT';
  mode: PaymentMode;
  amount: string;
  reference?: string | null;
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

export interface StaffUser {
  id: string;
  name: string;
  phone: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  createdAt: string;
}

/** A queued mutation awaiting sync to the backend. */
export type OutboxKind = 'SALE' | 'PURCHASE' | 'PAYMENT' | 'GATE_PASS' | 'LOADING_PASS';

export interface OutboxItem {
  clientUuid: string;
  kind: OutboxKind;
  /** Request body sent to the backend (already includes clientUuid). */
  payload: Record<string, any>;
  /** For passes: the clientUuid of the SALE this pass belongs to (resolved at sync). */
  saleClientUuid?: string;
  createdAt: string;
  /** Human summary for the pending list. */
  summary: string;
  error?: string;
}
