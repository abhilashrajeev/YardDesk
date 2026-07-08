import { useCallback, useEffect, useState } from 'react';
import { api, apiError } from '../api/client';

/** Fired whenever a notification is read/generated, so the topbar badge (a
 * separate component instance) knows to refetch its unread count. */
export const notificationsBus = new EventTarget();
export const notifyNotificationsChanged = () => notificationsBus.dispatchEvent(new Event('changed'));

/** Simple GET hook with loading/error and a refetch. */
export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get<T>(url);
      setData(res.data);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch, setData };
}

export const money = (n: number | string | null | undefined) =>
  '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const qty = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/** CSS pill class for a payment status (PAID / PART_PAID / PENDING / OVERDUE). */
export const statusPillClass = (status?: string) =>
  status === 'PAID' ? 'pos' : status === 'OVERDUE' ? 'neg' : 'warn';
