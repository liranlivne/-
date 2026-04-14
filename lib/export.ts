// Export utilities: CSV (Excel) and browser print.

import type { Transaction, OpeningBalance } from './types';
import { formatDateHe } from './dateUtils';
import { formatShekel } from './balance';

// ---------- CSV / Excel ----------

/** Escape a cell value for CSV. */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Quote if contains comma, quote, or newline
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build CSV text from filtered transactions. Adds a UTF-8 BOM for Excel. */
export function buildCsv(
  pastTransactions: Transaction[],
  futureTransactions: Transaction[],
  runningBalances: Map<number, number>,
  opening: OpeningBalance
): string {
  const headers = [
    'תאריך',
    'קטגוריה',
    'תיאור',
    'הכנסה',
    'הוצאה',
    'יתרה',
    'תדירות',
    'בוצע',
    'סטטוס',
  ];

  const lines: string[] = [];
  lines.push(headers.map(csvEscape).join(','));

  // Opening balance row
  lines.push(
    [
      '',
      'יתרת פתיחה',
      '',
      '',
      '',
      opening.balance,
      '',
      '',
      'פתיחה',
    ]
      .map(csvEscape)
      .join(',')
  );

  // Past rows (oldest first for export)
  const past = [...pastTransactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of past) {
    lines.push(
      [
        formatDateHe(t.date),
        t.category,
        t.description,
        t.income ?? '',
        t.expense ?? '',
        '', // balance not meaningful for past rows
        t.frequency,
        t.done ? 'כן' : '',
        'עבר',
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  // Future rows with running balance
  const future = [...futureTransactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of future) {
    const bal = runningBalances.get(t.rowNumber);
    lines.push(
      [
        formatDateHe(t.date),
        t.category,
        t.description,
        t.income ?? '',
        t.expense ?? '',
        bal ?? '',
        t.frequency,
        t.done ? 'כן' : '',
        'עתיד',
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  // Prepend BOM so Excel reads Hebrew correctly
  return '\uFEFF' + lines.join('\r\n');
}

/** Trigger download of a CSV string as a file. */
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Build a default filename like "תזרים-2026-04-15.csv". */
export function defaultCsvFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `תזרים-${y}-${m}-${day}.csv`;
}

// ---------- Print ----------

/**
 * Open a print-friendly view in a new window and trigger the browser print dialog.
 * Includes only the filtered data, styled for clean printing.
 */
export function printTransactions(
  pastTransactions: Transaction[],
  futureTransactions: Transaction[],
  runningBalances: Map<number, number>,
  opening: OpeningBalance,
  filterDescription: string = ''
): void {
  const today = formatDateHe(new Date().toISOString().slice(0, 10));

  const tableRows = (rows: Transaction[], withBalance: boolean) =>
    rows
      .map((t) => {
        const bal = withBalance ? runningBalances.get(t.rowNumber) : undefined;
        return `<tr>
          <td>${formatDateHe(t.date)}</td>
          <td>${escapeHtml(t.category)}</td>
          <td>${escapeHtml(t.description)}</td>
          <td class="num income">${t.income ? formatShekel(t.income) : ''}</td>
          <td class="num expense">${t.expense ? formatShekel(t.expense) : ''}</td>
          ${withBalance ? `<td class="num bal ${bal !== undefined && bal < 0 ? 'neg' : ''}">${bal !== undefined ? formatShekel(bal) : ''}</td>` : ''}
          <td>${escapeHtml(t.frequency)}</td>
          <td>${t.done ? '✓' : ''}</td>
        </tr>`;
      })
      .join('');

  const past = [...pastTransactions].sort((a, b) => a.date.localeCompare(b.date));
  const future = [...futureTransactions].sort((a, b) => a.date.localeCompare(b.date));

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<title>תזרים מזומנים — ${today}</title>
<style>
  @page { size: A4; margin: 1.5cm; }
  * { box-sizing: border-box; }
  body { font-family: "Heebo", Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; }
  h1 { color: #2D3A8C; font-size: 22px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 16px; }
  .summary { background: #F5F6FA; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; display: flex; gap: 24px; flex-wrap: wrap; font-size: 13px; }
  .summary b { color: #2D3A8C; }
  h2 { font-size: 15px; margin: 16px 0 6px; color: #2D3A8C; border-bottom: 2px solid #2D3A8C; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #2D3A8C; color: white; padding: 6px 4px; text-align: right; font-weight: 600; }
  th.center, td.center { text-align: center; }
  td { padding: 5px 4px; border-bottom: 1px solid #e5e7eb; }
  td.num { text-align: center; direction: ltr; font-variant-numeric: tabular-nums; }
  td.income { color: #1E7E34; font-weight: 500; }
  td.expense { color: #A32D2D; font-weight: 500; }
  td.bal { font-weight: 700; }
  td.bal.neg { color: #A32D2D; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print {
    body { padding: 0; }
    h2 { break-after: avoid; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>תזרים מזומנים — אויר הרים גגות</h1>
  <div class="sub">הופק בתאריך ${today}${filterDescription ? ' | ' + escapeHtml(filterDescription) : ''}</div>

  <div class="summary">
    <div><b>יתרה נוכחית:</b> ${formatShekel(opening.balance)}</div>
    <div><b>תנועות עתידיות:</b> ${future.length}</div>
    <div><b>תנועות עבר:</b> ${past.length}</div>
  </div>

  ${future.length > 0 ? `
    <h2>תזרים (עתידי)</h2>
    <table>
      <thead>
        <tr>
          <th>תאריך</th>
          <th>קטגוריה</th>
          <th>תיאור</th>
          <th class="center">הכנסה</th>
          <th class="center">הוצאה</th>
          <th class="center">יתרה</th>
          <th class="center">תדירות</th>
          <th class="center">בוצע</th>
        </tr>
      </thead>
      <tbody>${tableRows(future, true)}</tbody>
    </table>
  ` : ''}

  ${past.length > 0 ? `
    <h2>היסטוריה (עבר)</h2>
    <table>
      <thead>
        <tr>
          <th>תאריך</th>
          <th>קטגוריה</th>
          <th>תיאור</th>
          <th class="center">הכנסה</th>
          <th class="center">הוצאה</th>
          <th class="center">תדירות</th>
          <th class="center">בוצע</th>
        </tr>
      </thead>
      <tbody>${tableRows(past, false)}</tbody>
    </table>
  ` : ''}

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=1000,height=700');
  if (!w) {
    alert('נחסם חלון קופץ. אנא אפשר חלונות קופצים ונסה שוב.');
    return;
  }
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
