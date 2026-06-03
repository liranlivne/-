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
  /** Not tracked — income row, exempt category, or back-catalog. No indicator. */
  | 'none'
  /** Paid (past) expense, in scope, no file. Red — get the invoice. */
  | 'missing'
  /** File attached but not yet sent to Morning. Orange — send it. */
  | 'attachedNotSent'
  /** File attached AND sent to Morning. Green — fully done. */
  | 'sent'
  /** Future (not-yet-paid) expense, in scope, no file. Neutral hint. */
  | 'neutral';

/**
 * Decide the invoice state for a row. Pipeline (2026-06 spec):
 *   income / exempt category / before tracking-start → none
 *   in scope, no file:    past → missing (red),  future → neutral (gray)
 *   in scope, file:        not sent → attachedNotSent (orange),  sent → sent (green)
 *
 * The tracking-start cutoff gates BOTH red and orange — historical attached
 * files just keep their plain 📎 (state 'none'), they don't turn orange.
 */
export function invoiceState(t: Transaction): InvoiceState {
  if (!t.expense || t.expense <= 0) return 'none';
  if (INVOICE_EXEMPT_CATEGORIES.includes(t.category)) return 'none';
  if (t.date < INVOICE_TRACKING_START) return 'none';

  if (!t.imageUrl) {
    return t.status === 'past' ? 'missing' : 'neutral';
  }
  return t.morningSent ? 'sent' : 'attachedNotSent';
}

/** Red rows — an invoice still needs to be obtained from the supplier. */
export function isInvoiceMissing(t: Transaction): boolean {
  return invoiceState(t) === 'missing';
}

/** Orange rows — invoice in hand, not yet sent to Morning. */
export function isAwaitingMorning(t: Transaction): boolean {
  return invoiceState(t) === 'attachedNotSent';
}
