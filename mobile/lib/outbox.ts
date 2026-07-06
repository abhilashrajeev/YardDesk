import * as Crypto from 'expo-crypto';
import { storage } from './storage';
import type { OutboxItem, OutboxKind } from './types';

const K_OUTBOX = 'outbox';

export const outbox = {
  all: () => storage.get<OutboxItem[]>(K_OUTBOX, []),

  async add(
    kind: OutboxKind,
    payload: Record<string, any>,
    summary: string,
    saleClientUuid?: string,
  ): Promise<OutboxItem> {
    const clientUuid = Crypto.randomUUID();
    const item: OutboxItem = {
      clientUuid,
      kind,
      payload: { ...payload, clientUuid },
      saleClientUuid,
      summary,
      createdAt: new Date().toISOString(),
    };
    const list = await outbox.all();
    list.push(item);
    await storage.set(K_OUTBOX, list);
    return item;
  },

  async remove(clientUuid: string) {
    const list = await outbox.all();
    await storage.set(
      K_OUTBOX,
      list.filter((i) => i.clientUuid !== clientUuid),
    );
  },

  async setError(clientUuid: string, error: string) {
    const list = await outbox.all();
    const idx = list.findIndex((i) => i.clientUuid === clientUuid);
    if (idx >= 0) {
      list[idx].error = error;
      await storage.set(K_OUTBOX, list);
    }
  },

  async count() {
    return (await outbox.all()).length;
  },
};
