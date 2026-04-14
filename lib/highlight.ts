// "Recently updated" highlight logic.
// A row is highlighted for 40 hours after its `updatedAt` timestamp.

export const HIGHLIGHT_HOURS = 40;
export const HIGHLIGHT_MS = HIGHLIGHT_HOURS * 60 * 60 * 1000;

export function isRecentlyUpdated(updatedAt: string | null): boolean {
  if (!updatedAt) return false;
  const ts = Date.parse(updatedAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < HIGHLIGHT_MS;
}
