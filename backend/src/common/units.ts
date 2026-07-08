import { Unit } from '@prisma/client';

/** Fixed conversion: aggregates are often bought by weight, sold by volume. */
export const TON_TO_CFT = 21;

export function convertQty(quantity: number, from: Unit, to: Unit): number {
  if (from === to) return quantity;
  if (from === Unit.TON && to === Unit.CFT) return quantity * TON_TO_CFT;
  if (from === Unit.CFT && to === Unit.TON) return quantity / TON_TO_CFT;
  return quantity;
}
