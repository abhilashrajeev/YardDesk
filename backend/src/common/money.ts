/** Round money to 2 decimals (₹) and quantities to 3 decimals (cft can be fractional). */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
