export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE';
export type Unit = 'CFT' | 'BAG' | 'NOS';
export type PaymentMode = 'CASH' | 'UPI' | 'BANK' | 'CREDIT';

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
}

export interface Sale {
  id: string;
  billNo: string | null;
  date: string;
  total: string;
  paymentMode: PaymentMode;
  customer?: { name: string };
}

export interface Purchase {
  id: string;
  invoiceNo: string | null;
  date: string;
  total: string;
  vendor?: { name: string };
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
