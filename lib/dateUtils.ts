// Date conversion utilities
// Google Sheets stores dates as DD/MM/YY strings.
// Internally we use ISO format (YYYY-MM-DD) for easy sorting and comparison.

/**
 * Convert from Google Sheets DD/MM/YY format to ISO (YYYY-MM-DD).
 * Accepts D/M/YY, DD/M/YY, D/MM/YY, DD/MM/YY and DD/MM/YYYY variants.
 */
export function sheetDateToIso(sheetDate: string): string {
  if (!sheetDate || typeof sheetDate !== 'string') return '';
  const parts = sheetDate.trim().split('/');
  if (parts.length !== 3) return '';
  let [d, m, y] = parts;
  d = d.padStart(2, '0');
  m = m.padStart(2, '0');
  // Two-digit year -> assume 20YY
  if (y.length === 2) y = '20' + y;
  return `${y}-${m}-${d}`;
}

/**
 * Convert from ISO (YYYY-MM-DD) to sheet format (D/M/YY).
 * Matches how the user has been entering dates.
 */
export function isoToSheetDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  const shortYear = y.slice(-2);
  // Use non-padded day/month to match existing sheet style (e.g. "5/5/26")
  return `${parseInt(d, 10)}/${parseInt(m, 10)}/${shortYear}`;
}

/**
 * Get today's date as ISO string in the user's local timezone.
 */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Add one month to an ISO date, preserving day-of-month when possible.
 * If target month has fewer days (e.g. 31 Jan -> Feb), clamps to last day.
 */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const targetMonth = dt.getMonth() + months;
  dt.setDate(1);
  dt.setMonth(targetMonth);
  const lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(d, lastDay));

  const ny = dt.getFullYear();
  const nm = String(dt.getMonth() + 1).padStart(2, '0');
  const nd = String(dt.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

/**
 * Compute the next occurrence date for a recurring transaction.
 */
export function nextRecurrenceDate(originalIso: string, frequency: string): string {
  if (frequency === 'חודשי') return addMonthsIso(originalIso, 1);
  if (frequency === 'דו-חודשי') return addMonthsIso(originalIso, 2);
  return originalIso;
}

/** True if ISO date is strictly before today. */
export function isPastDate(iso: string): boolean {
  return iso < todayIso();
}

/** True if ISO date equals today. */
export function isToday(iso: string): boolean {
  return iso === todayIso();
}

/** Format ISO date for display in Hebrew. e.g. "15/4/26" */
export function formatDateHe(iso: string): string {
  return isoToSheetDate(iso);
}
