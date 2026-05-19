// Transaction status transitions — single source of truth for the
// "moving a past row to today/future restores it to תזרים" rule.
//
// The rule was inlined in two handlers in app/page.tsx (handleSave and
// handleBulkChangeDate). Extracting here so future tweaks (e.g. adding a
// "today is past after 22:00" carve-out, or different semantics for
// recurring rows) land in one place instead of drifting between callers.

import { todayIso } from './dateUtils';

/**
 * Compute the resulting status + done flag when a row's date changes.
 *
 * Rule: a row whose status is "past" but whose new date is *strictly
 * after* today cannot really be "past" — it hasn't happened yet — so
 * we flip it back to "future" (תזרים) and reset its done=true flag.
 *
 * The boundary is strict (`>`, not `>=`): a past row dated *today* is
 * legitimate ("paid it today") and must STAY past. Using `>=` here was
 * a bug — editing any past row dated today (e.g. just fixing its
 * amount) silently kicked it back into תזרים, because at edit time
 * its date equalled todayIso().
 *
 * Any other transition (future → future, future → past-date stays
 * future) preserves the existing status. The user explicitly marking
 * "בוצע" is the only path that moves a row past→past for a backdated
 * row; date changes alone don't move future→past.
 */
export function statusAfterDateChange(
  prevStatus: 'past' | 'future',
  prevDone: boolean,
  newDate: string
): {
  status: 'past' | 'future';
  done: boolean;
  /** True when this call is restoring a past row back to תזרים. */
  flippedToFuture: boolean;
} {
  const flippedToFuture = prevStatus === 'past' && newDate > todayIso();
  return {
    status: flippedToFuture ? 'future' : prevStatus,
    done: flippedToFuture ? false : prevDone,
    flippedToFuture,
  };
}
