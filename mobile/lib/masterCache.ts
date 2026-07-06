import { api } from './api';
import { storage } from './storage';
import type { Material, Party } from './types';

const K_MATERIALS = 'cache_materials';
const K_CUSTOMERS = 'cache_customers';
const K_VENDORS = 'cache_vendors';

/** Pull master data from the server and cache it for offline form use. */
export async function refreshMasterData() {
  const [materials, customers, vendors] = await Promise.all([
    api.get<Material[]>('/inventory').then((r) => r.data),
    api.get<Party[]>('/customers').then((r) => r.data),
    api.get<Party[]>('/vendors').then((r) => r.data),
  ]);
  await Promise.all([
    storage.set(K_MATERIALS, materials),
    storage.set(K_CUSTOMERS, customers),
    storage.set(K_VENDORS, vendors),
  ]);
  return { materials, customers, vendors };
}

export const cache = {
  materials: () => storage.get<Material[]>(K_MATERIALS, []),
  customers: () => storage.get<Party[]>(K_CUSTOMERS, []),
  vendors: () => storage.get<Party[]>(K_VENDORS, []),
};
