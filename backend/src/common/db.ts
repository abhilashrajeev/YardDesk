/**
 * Options for multi-step interactive transactions.
 * The default 5s timeout is too tight for a cloud DB (Neon) with per-query
 * network latency plus occasional serverless compute wake-up.
 */
export const TXN_OPTIONS = { maxWait: 15000, timeout: 30000 };

/**
 * True when a write failed on a unique-constraint violation (Prisma P2002).
 * Used by the create flows: if a request carrying a clientUuid loses a race with
 * an identical earlier request (a slow request that was retried), the unique index
 * on clientUuid rejects the second one — the caller then returns the record the
 * first request already saved instead of failing or saving it twice.
 */
export function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as { code?: string }).code === 'P2002'
  );
}
