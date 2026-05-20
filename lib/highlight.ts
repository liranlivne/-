// "Recently updated" highlight logic.
// A row is highlighted for 24 hours after its `updatedAt` timestamp.

const HIGHLIGHT_MS = 24 * 60 * 60 * 1000;

export function isRecentlyUpdated(updatedAt: string | null): boolean {
  if (!updatedAt) return false;
  const ts = Date.parse(updatedAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < HIGHLIGHT_MS;
}
