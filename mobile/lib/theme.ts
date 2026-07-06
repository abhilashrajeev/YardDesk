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
