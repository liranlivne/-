// Supplier-invoice tracking.
//
// Each EXPENSE row (except a fixed set of exempt categories) is expected to
// have a supplier invoice attached. "Attached" reuses the existing per-row
// file (imageUrl / sheet column K) — no extra storage needed. State per the
// owner's spec (2026-06): only two actionable colors, green (done) or red
// (needs action). Future-dated expenses show a neutral hint, not an alarm.

import type { Transaction } from './types';

/**
 * Categories that never require an invoice (salaries, loans, taxes, etc.).
 * Matched against Transaction.category by exact string. Owner-provided list,
 * 2026-06. If categories are renamed in the sheet, update here too.
 */
export const INVOICE_EXEMPT_CATEGORIES: readonly string[] = [
  'שכר עובדים',
  'לא ידוע בינתיים',
  'הלוואה',
  'ביטוח לאומי',
  'מס הכנסה',
  'הו"ק',
  'הפרשות',
  'ביטוח',
  'כרטיס אשראי',
  'מע"מ',
];

/**
 * Invoice tracking starts here (ISO YYYY-MM-DD). Expenses dated before this
 * are back-catalog the owner isn't chasing — they never turn red. Owner set
 * 2026-06-01.
 */
export const INVOICE_TRACKING_START = '2026-06-01';

export type InvoiceState =
  /** Not tracked — income row, or an exempt category. No indicator. */
  | 'none'
  /** Expense with a file attached. Green. */
  | 'attached'
  /** Paid (past) expense, in scope, no file. Red — needs action. */
  | 'missing'
  /** Future (not-yet-paid) expense, in scope, no file. Neutral hint. */
  | 'neutral';

/**
 * Decide the invoice state for a row. `status` is the past/future/opening
 * bucket; only 'past' expenses raise the red alarm.
 */
export function invoiceState(t: Transaction): InvoiceState {
  // Only expense rows participate.
  if (!t.expense || t.expense <= 0) return 'none';
  // Exempt categories never need an invoice.
  if (INVOICE_EXEMPT_CATEGORIES.includes(t.category)) return 'none';
  // A physically-attached file is the only thing that marks it done.
  if (t.imageUrl) return 'attached';
  // Back-catalog (before tracking start) is never flagged.
  if (t.date < INVOICE_TRACKING_START) return 'none';
  // No file: red once it's been paid, neutral while still upcoming.
  return t.status === 'past' ? 'missing' : 'neutral';
}

/** True for rows that still need an invoice action (the red ones). */
export function isInvoiceMissing(t: Transaction): boolean {
  return invoiceState(t) === 'missing';
}
