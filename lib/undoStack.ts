// Undo stack for reversible operations.
// Session-scoped: stack is cleared on page reload.
// Strategy: each pushed entry carries the data needed to reverse the mutation.

import type { Transaction, Frequency } from './types';
import {
  createTransaction,
  updateTransactionApi,
  deleteTransactionApi,
  updateOpeningBalanceApi,
  replaceCategoriesApi,
} from './apiClient';

// ---------- Entry types ----------

type UndoEntry =
  | {
      kind: 'create';
      createdRowNumber: number;
      /** Snapshot of what was created (so we can match-delete even if row shifted) */
      createdData: {
        date: string;
        category: string;
        description: string;
        income: number | null;
        expense: number | null;
      };
      label: string;
    }
  | {
      kind: 'update';
      rowNumber: number;
      previous: {
        date: string;
        category: string;
        description: string;
        income: number | null;
        expense: number | null;
        frequency: Frequency;
        done: boolean;
        status: 'future' | 'past';
      };
      label: string;
    }
  | {
      kind: 'delete';
      previous: {
        date: string;
        category: string;
        description: string;
        income: number | null;
        expense: number | null;
        frequency: Frequency;
        status: 'future' | 'past';
      };
      label: string;
    }
  | {
      kind: 'done';
      rowNumber: number;
      /** Previous state of the row that was marked done */
      previous: {
        date: string;
        status: 'future' | 'past';
        done: boolean;
      };
      /** If a recurring row was created, its identifying data so we can match-delete */
      createdRowNumber?: number;
      createdData?: {
        date: string;
        category: string;
        description: string;
        income: number | null;
        expense: number | null;
      };
      label: string;
    }
  | {
      kind: 'balance';
      previousBalance: number;
      label: string;
    }
  | {
      kind: 'categories';
      previousList: string[];
      label: string;
    };

// ---------- Stack ----------

const stack: UndoEntry[] = [];
let listeners: Array<() => void> = [];

function notify() {
  for (const l of listeners) l();
}

export function subscribeUndo(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function pushUndo(entry: UndoEntry) {
  stack.push(entry);
  notify();
}

export function canUndo(): boolean {
  return stack.length > 0;
}

export function peekLabel(): string | null {
  return stack.length > 0 ? stack[stack.length - 1].label : null;
}

export function clearUndo() {
  stack.length = 0;
  notify();
}

// ---------- Executing an undo ----------

/**
 * Pop and execute the last undo entry.
 * Returns a label describing what was undone.
 * On success, the caller should refresh data from the server.
 */
export async function performUndo(
  currentTransactions: Transaction[]
): Promise<string | null> {
  const entry = stack.pop();
  notify();
  if (!entry) return null;

  switch (entry.kind) {
    case 'create': {
      // Find the matching row and delete it
      const match = findMatchingRow(currentTransactions, entry.createdData, entry.createdRowNumber);
      if (match) await deleteTransactionApi(match.rowNumber);
      return entry.label;
    }
    case 'update': {
      await updateTransactionApi(entry.rowNumber, {
        date: entry.previous.date,
        category: entry.previous.category,
        description: entry.previous.description,
        income: entry.previous.income,
        expense: entry.previous.expense,
        frequency: entry.previous.frequency,
        done: entry.previous.done,
        status: entry.previous.status,
      });
      return entry.label;
    }
    case 'delete': {
      await createTransaction({
        date: entry.previous.date,
        category: entry.previous.category,
        description: entry.previous.description,
        income: entry.previous.income,
        expense: entry.previous.expense,
        frequency: entry.previous.frequency,
        status: entry.previous.status,
      });
      return entry.label;
    }
    case 'done': {
      // First remove any recurring row that was auto-created
      if (entry.createdData) {
        const match = findMatchingRow(
          currentTransactions,
          entry.createdData,
          entry.createdRowNumber
        );
        if (match) await deleteTransactionApi(match.rowNumber);
      }
      // Then restore original row's state
      await updateTransactionApi(entry.rowNumber, {
        date: entry.previous.date,
        done: entry.previous.done,
        status: entry.previous.status,
      });
      return entry.label;
    }
    case 'balance': {
      await updateOpeningBalanceApi(entry.previousBalance);
      return entry.label;
    }
    case 'categories': {
      await replaceCategoriesApi(entry.previousList);
      return entry.label;
    }
  }
}

function findMatchingRow(
  transactions: Transaction[],
  data: {
    date: string;
    category: string;
    description: string;
    income: number | null;
    expense: number | null;
  },
  preferredRow?: number
): Transaction | null {
  // Prefer exact row-number match first
  if (preferredRow) {
    const byRow = transactions.find((t) => t.rowNumber === preferredRow);
    if (byRow && matchesData(byRow, data)) return byRow;
  }
  // Fall back to matching by content
  return transactions.find((t) => matchesData(t, data)) ?? null;
}

function matchesData(
  t: Transaction,
  data: {
    date: string;
    category: string;
    description: string;
    income: number | null;
    expense: number | null;
  }
): boolean {
  return (
    t.date === data.date &&
    t.category === data.category &&
    t.description === data.description &&
    (t.income ?? null) === (data.income ?? null) &&
    (t.expense ?? null) === (data.expense ?? null)
  );
}
