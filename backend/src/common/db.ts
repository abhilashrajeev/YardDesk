/**
 * Options for multi-step interactive transactions.
 * The default 5s timeout is too tight for a cloud DB (Neon) with per-query
 * network latency plus occasional serverless compute wake-up.
 */
export const TXN_OPTIONS = { maxWait: 15000, timeout: 30000 };
