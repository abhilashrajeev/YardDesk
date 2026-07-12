/** Escapes a single CSV field — wraps in quotes and doubles any embedded quotes if it contains a comma, quote, or newline. */
function csvField(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Builds a CSV from column definitions + rows and triggers a browser download.
 * Opens directly in Excel — no server round-trip or extra dependency needed.
 */
export function downloadCsv<T>(
  filename: string,
  columns: { header: string; value: (row: T) => unknown }[],
  rows: T[],
) {
  const lines = [
    columns.map((c) => csvField(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => csvField(c.value(row))).join(',')),
  ];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
