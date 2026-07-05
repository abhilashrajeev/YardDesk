/**
 * Business-day helpers. The yard operates in IST (UTC+5:30) while timestamps
 * are stored in UTC, so a business day 'YYYY-MM-DD' spans
 * [date 00:00 IST, next day 00:00 IST) === [date-1 18:30Z, date 18:30Z).
 */
const IST = '+05:30';

/** UTC range [start, end) for an IST business date string 'YYYY-MM-DD'. */
export function istDayRange(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00${IST}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** The @db.Date value to store for a business date (date at UTC midnight). */
export function businessDateValue(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

/** Today's business date 'YYYY-MM-DD' in IST. */
export function todayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}
