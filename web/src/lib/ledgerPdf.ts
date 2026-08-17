import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { money, fmtDate } from './hooks';

export interface LedgerPdfEntry {
  date: string;
  voucher: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface LedgerPdfParams {
  partyName: string;
  partyPhone?: string | null;
  /** true when a positive running balance means the party owes Devi Traders (customer);
   *  false when it means Devi Traders owes the party (vendor). Flips the Dr/Cr labels. */
  positiveMeansTheyOweUs: boolean;
  periodLabel: string;
  openingBalance: number;
  openingDateLabel: string;
  entries: LedgerPdfEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

const BRAND_RED: [number, number, number] = [174, 42, 46]; // --primary
const GREEN: [number, number, number] = [5, 150, 105]; // --green
const DEBIT_BG: [number, number, number] = [253, 237, 237];
const CREDIT_BG: [number, number, number] = [230, 245, 239];
const GROUP_BG: [number, number, number] = [245, 246, 250];

/** Dr = the party owes Devi Traders; Cr = Devi Traders owes the party. */
function drCr(balance: number, positiveMeansTheyOweUs: boolean): 'Dr' | 'Cr' {
  const theyOweUs = positiveMeansTheyOweUs ? balance > 0 : balance < 0;
  return theyOweUs ? 'Dr' : 'Cr';
}

function fmtAmt(n: number) {
  return Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Generates and downloads a Khatabook-style statement PDF for one party's ledger. */
export function downloadLedgerPdf(p: LedgerPdfParams) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 32;

  function drawHeaderBand() {
    doc.setFillColor(...BRAND_RED);
    doc.rect(0, 0, pageWidth, 44, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Devi Traders', margin, 27);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Building Material Supplier', pageWidth - margin, 27, { align: 'right' });
  }

  const openingDr = drCr(p.openingBalance, p.positiveMeansTheyOweUs);
  const closingDr = drCr(p.closingBalance, p.positiveMeansTheyOweUs);
  const owesPhrase = closingDr === 'Dr' ? `${p.partyName} will give` : 'Devi Traders will give';

  drawHeaderBand();

  let y = 78;
  doc.setTextColor(20, 22, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(`${p.partyName} Statement`, pageWidth / 2, y, { align: 'center' });
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 105, 130);
  doc.text(`(${p.periodLabel})`, pageWidth / 2, y, { align: 'center' });
  y += 20;

  // Summary box
  const boxTop = y;
  const boxHeight = 54;
  doc.setDrawColor(225, 227, 235);
  doc.roundedRect(margin, boxTop, pageWidth - margin * 2, boxHeight, 4, 4);
  const cols = [
    { label: 'Opening Balance', value: `Rs ${fmtAmt(p.openingBalance)} ${openingDr}`, sub: `(on ${p.openingDateLabel})`, color: openingDr === 'Dr' ? BRAND_RED : GREEN },
    { label: 'Total Debit(-)', value: `Rs ${fmtAmt(p.totalDebit)}`, sub: '', color: [20, 22, 58] as [number, number, number] },
    { label: 'Total Credit(+)', value: `Rs ${fmtAmt(p.totalCredit)}`, sub: '', color: [20, 22, 58] as [number, number, number] },
    { label: 'Net Balance', value: `Rs ${fmtAmt(p.closingBalance)} ${closingDr}`, sub: `(${owesPhrase})`, color: closingDr === 'Dr' ? BRAND_RED : GREEN },
  ];
  const colWidth = (pageWidth - margin * 2) / 4;
  cols.forEach((c, i) => {
    const cx = margin + colWidth * i + colWidth / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 105, 130);
    doc.text(c.label, cx, boxTop + 16, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...c.color);
    doc.text(c.value, cx, boxTop + 32, { align: 'center' });
    if (c.sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(140, 145, 165);
      doc.text(c.sub, cx, boxTop + 44, { align: 'center' });
    }
  });
  y = boxTop + boxHeight + 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 64, 90);
  doc.text(`No. of Entries: ${p.entries.length} (${p.periodLabel})`, margin, y);
  y += 8;

  // Build table rows, inserting a full-width date-group header before each new day —
  // shows that day's opening balance, same as the sample statement this was modeled on.
  type Row = { date: string; details: string; debit: string; credit: string; balance: string; dr: 'Dr' | 'Cr'; isGroup?: boolean };
  const rows: Row[] = [];
  let runningBefore = p.openingBalance;
  let lastDay = '';
  for (const e of p.entries) {
    const day = fmtDate(e.date);
    if (day !== lastDay) {
      const dr = drCr(runningBefore, p.positiveMeansTheyOweUs);
      rows.push({
        date: '', details: `${day}  (Opening Balance: ${fmtAmt(runningBefore)} ${dr})`,
        debit: '', credit: '', balance: '', dr, isGroup: true,
      });
      lastDay = day;
    }
    rows.push({
      date: day,
      details: e.voucher ? `${e.voucher} — ${e.description}` : e.description,
      debit: e.debit ? fmtAmt(e.debit) : '',
      credit: e.credit ? fmtAmt(e.credit) : '',
      balance: `${fmtAmt(e.balance)} ${drCr(e.balance, p.positiveMeansTheyOweUs)}`,
      dr: drCr(e.balance, p.positiveMeansTheyOweUs),
    });
    runningBefore = e.balance;
  }

  // A colSpan cell only keeps the content of the cell it's declared on — the rest of
  // that row's array is ignored — so group-header rows are a single-cell array, not
  // the usual 5, with the spanning + styling set inline rather than via didParseCell.
  const body = rows.map((r) =>
    r.isGroup
      ? [{ content: r.details, colSpan: 5, styles: { fillColor: GROUP_BG, fontStyle: 'bold' as const, halign: 'left' as const } }]
      : [r.date, r.details, r.debit, r.credit, r.balance],
  );

  autoTable(doc, {
    startY: y,
    margin: { top: 52, bottom: 40, left: margin, right: margin },
    head: [['Date', 'Details', 'Debit(-)', 'Credit(+)', 'Balance']],
    body,
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, lineColor: [225, 227, 235], lineWidth: 0.5, textColor: [20, 22, 58] },
    headStyles: { fillColor: [245, 246, 250], textColor: [20, 22, 58], fontStyle: 'bold', lineWidth: 0.5 },
    columnStyles: {
      0: { cellWidth: 55 },
      2: { halign: 'right', cellWidth: 75 },
      3: { halign: 'right', cellWidth: 75 },
      4: { halign: 'right', cellWidth: 85, fontStyle: 'bold' },
    },
    didParseCell(data) {
      const row = rows[data.row.index];
      if (!row || row.isGroup || data.section !== 'body') return;
      if (data.column.index === 2 && row.debit) data.cell.styles.fillColor = DEBIT_BG;
      if (data.column.index === 3 && row.credit) data.cell.styles.fillColor = CREDIT_BG;
      if (data.column.index === 4) data.cell.styles.textColor = row.dr === 'Dr' ? BRAND_RED : GREEN;
    },
    didDrawPage(data) {
      // Page 1's band is already drawn above (it sits under the title/summary box,
      // which render before autoTable starts) — redrawing it here would just stack an
      // identical, wasted copy in the PDF's text layer.
      if (data.pageNumber > 1) drawHeaderBand();
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(140, 145, 165);
      doc.text('Devi Traders', margin, pageH - 20);
    },
  });

  // Grand total + generated-at stamp, right after the table on whichever page it ends on.
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  autoTable(doc, {
    startY: finalY,
    margin: { left: margin, right: margin },
    body: [['Grand Total', '', fmtAmt(p.totalDebit), fmtAmt(p.totalCredit), `${fmtAmt(p.closingBalance)} ${closingDr}`]],
    styles: { font: 'helvetica', fontSize: 9.5, fontStyle: 'bold', cellPadding: 6, fillColor: [245, 246, 250], textColor: [20, 22, 58] },
    columnStyles: {
      0: { cellWidth: 55 + 175 },
      2: { halign: 'right', cellWidth: 75 },
      3: { halign: 'right', cellWidth: 75 },
      4: { halign: 'right', cellWidth: 85, textColor: closingDr === 'Dr' ? BRAND_RED : GREEN },
    },
  });

  const stampY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 145, 165);
  const now = new Date();
  const stamp = now.toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, day: '2-digit', month: 'short', year: '2-digit' });
  doc.text(`Report Generated : ${stamp}`, margin, stampY);

  const totalPages = doc.getNumberOfPages();
  if (totalPages > 1) {
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(140, 145, 165);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageH - 20, { align: 'right' });
    }
  }

  doc.save(`${p.partyName}-statement-${new Date().toISOString().slice(0, 10)}.pdf`);
}
