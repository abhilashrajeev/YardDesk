/**
 * Formats a partially-typed Indian vehicle registration number as the user types:
 * state (2 letters) - RTO code (up to 2 digits) - series (1-2 letters) - number (up to 4 digits),
 * e.g. "KL-01-AA-0123". Series is 1 or 2 letters since older/rural registrations often use just one.
 */
export function formatVehicleNumber(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  let i = 0;

  let state = '';
  while (i < clean.length && /[A-Z]/.test(clean[i]) && state.length < 2) {
    state += clean[i];
    i++;
  }
  let rto = '';
  while (i < clean.length && /[0-9]/.test(clean[i]) && rto.length < 2) {
    rto += clean[i];
    i++;
  }
  let series = '';
  while (i < clean.length && /[A-Z]/.test(clean[i]) && series.length < 2) {
    series += clean[i];
    i++;
  }
  let num = '';
  while (i < clean.length && /[0-9]/.test(clean[i]) && num.length < 4) {
    num += clean[i];
    i++;
  }

  return [state, rto, series, num].filter(Boolean).join('-');
}
