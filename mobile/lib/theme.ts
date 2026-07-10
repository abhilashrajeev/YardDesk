export const colors = {
  bg: '#f1f5f9',
  panel: '#ffffff',
  border: '#e2e8f0',
  text: '#1e293b',
  muted: '#64748b',
  primary: '#b45309',
  primaryDark: '#92400e',
  green: '#16a34a',
  red: '#dc2626',
  dark: '#1e293b',
};

export const money = (n: number | string | null | undefined) =>
  '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const qty = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/** Background color for a payment/txn-status pill. */
export function statusColor(status?: string): string {
  if (status === 'PAID') return colors.green;
  if (status === 'OVERDUE' || status === 'CANCELLED') return colors.red;
  return colors.primary; // PENDING / PART_PAID
}
