import axios from 'axios';
import { api } from './api';
import { storage } from './storage';
import { outbox } from './outbox';
import { refreshMasterData } from './masterCache';
import type { OutboxItem } from './types';

const K_SALE_IDS = 'sale_id_map';

const endpointFor: Record<string, string> = {
  SALE: '/sales',
  PURCHASE: '/purchases',
  PAYMENT: '/accounts/payments',
};

export interface SyncResult {
  synced: number;
  failed: number;
  remaining: number;
  offline: boolean;
}

/**
 * Push all queued mutations to the backend, oldest first.
 * - Every payload carries a clientUuid, so the server dedupes safe retries.
 * - Sales record their server id so passes created offline can be linked.
 * - A network error stops the run (we're offline); a server rejection flags
 *   the item and moves on.
 */
export async function syncNow(): Promise<SyncResult> {
  const items = (await outbox.all()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const saleIds = await storage.get<Record<string, string>>(K_SALE_IDS, {});
  let synced = 0;
  let failed = 0;

  for (const item of items) {
    try {
      if (item.kind === 'SALE' || item.kind === 'PURCHASE' || item.kind === 'PAYMENT') {
        const res = await api.post(endpointFor[item.kind], item.payload);
        if (item.kind === 'SALE') {
          saleIds[item.clientUuid] = res.data.id;
          await storage.set(K_SALE_IDS, saleIds);
        }
        await outbox.remove(item.clientUuid);
        synced++;
      } else {
        // Gate / loading pass — needs the parent sale's server id.
        const saleId = item.saleClientUuid ? saleIds[item.saleClientUuid] : undefined;
        if (!saleId) {
          await outbox.setError(item.clientUuid, 'Waiting for parent sale to sync');
          failed++;
          continue;
        }
        const path = item.kind === 'GATE_PASS' ? 'gate-pass' : 'loading-pass';
        await api.post(`/sales/${saleId}/${path}`, item.payload);
        await outbox.remove(item.clientUuid);
        synced++;
      }
    } catch (e) {
      // No response object => network/offline: stop and try again later.
      if (axios.isAxiosError(e) && !e.response) {
        return { synced, failed, remaining: await outbox.count(), offline: true };
      }
      // Server rejected the request; flag it and continue.
      const msg = axios.isAxiosError(e) ? (e.response?.data?.message ?? e.message) : String(e);
      await outbox.setError(item.clientUuid, Array.isArray(msg) ? msg.join(', ') : String(msg));
      failed++;
    }
  }

  // Best-effort master-data refresh while we have connectivity.
  try {
    await refreshMasterData();
  } catch {
    /* ignore */
  }

  return { synced, failed, remaining: await outbox.count(), offline: false };
}
