// Client-side running-balance computation.

import type { Transaction, OpeningBalance } from './types';

export interface BalanceColor {
  bg: string;
  fg: string;
}

export function getBalanceColor(balance: number): BalanceColor {
  if (balance >= 0) {
    return { bg: 'var(--color-balance-positive-bg)', fg: 'var(--color-balance-positive-fg)' };
  }
  if (balance >= -80000) {
    return { bg: 'var(--color-balance-warning-bg)', fg: 'var(--color-balance-warning-fg)' };
  }
  return { bg: 'var(--color-balance-danger-bg)', fg: 'var(--color-balance-danger-fg)' };
}

/**
 * Compute the running balance across future (and today) transactions.
 * Past transactions are ignored per the spec.
 * Balance starts from the opening balance and accumulates forward.
 */
export function computeRunningBalances(
  transactions: Transaction[],
  opening: OpeningBalance
): Map<number, number> {
  const result = new Map<number, number>();

  // Sort future transactions by date, then by rowNumber for stable order
  const future = transactions
    .filter((t) => t.status !== 'past')
    .slice()
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.rowNumber - b.rowNumber;
    });

  let running = opening.balance;
  for (const t of future) {
    running = running + (t.income ?? 0) - (t.expense ?? 0);
    result.set(t.rowNumber, running);
  }

  return result;
}

/** Format a number as Hebrew shekels with thousand separators. */
export function formatShekel(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  const abs = Math.abs(n).toLocaleString('he-IL', { maximumFractionDigits: 0 });
  return n < 0 ? `-₪${abs}` : `₪${abs}`;
}
