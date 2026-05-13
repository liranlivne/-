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
 * Rule: a row whose status is "past" but whose new date is today-or-later
 * cannot really be "past" anymore — the past section means already
 * executed. So we flip it back to "future" (תזרים) and reset its
 * done=true flag (the past execution is no longer truthful for the new
 * date).
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
  const flippedToFuture = prevStatus === 'past' && newDate >= todayIso();
  return {
    status: flippedToFuture ? 'future' : prevStatus,
    done: flippedToFuture ? false : prevDone,
    flippedToFuture,
  };
}
