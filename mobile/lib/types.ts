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
export interface Party {
  id: string;
  name: string;
  phone?: string | null;
}

export interface Line {
  materialId: string;
  quantity: number;
  rate: number;
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
