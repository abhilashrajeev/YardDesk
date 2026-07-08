export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE';
export type Unit = 'CFT' | 'BAG' | 'NOS' | 'TON';
export type PaymentMode = 'CASH' | 'UPI' | 'BANK' | 'CREDIT';
export type PaymentStatus = 'PAID' | 'PART_PAID' | 'PENDING' | 'OVERDUE';

export const TON_TO_CFT = 21;

export interface User {
  id: string;
  name: string;
  role: Role;
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
  items?: LineItem[];
  paidAmount?: number;
  balance?: number;
  paymentStatus?: PaymentStatus;
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
  items?: LineItem[];
  paidAmount?: number;
  balance?: number;
  paymentStatus?: PaymentStatus;
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
