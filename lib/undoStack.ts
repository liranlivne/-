// Undo/Redo stack for reversible operations.
// Session-scoped: stacks are cleared on page reload.
//
// Each "HistoryEntry" stores enough information to do() the action and undo() it.
// - New action  → push to undoStack, clear redoStack
// - Ctrl+Z      → pop from undoStack, apply undo, push to redoStack
// - Ctrl+Y      → pop from redoStack, apply do, push to undoStack

import type { Transaction, Frequency } from './types';
import {
  createTransaction,
  updateTransactionApi,
  deleteTransactionApi,
  updateOpeningBalanceApi,
  replaceCategoriesApi,
  markDoneApi,
} from './apiClient';
import { todayIso } from './dateUtils';

// ---------- Entry types ----------

type TxData = {
  date: string;
  category: string;
  description: string;
  income: number | null;
  expense: number | null;
  frequency: Frequency;
};

export type HistoryEntry =
  | {
      kind: 'create';
      /** Data used to create the row (used for redo) */
      data: TxData & { status: 'future' | 'past' };
      /** Row number that was created (used to find & delete for undo) */
      createdRowNumber: number;
      label: string;
    }
  | {
      kind: 'update';
      rowNumber: number;
      /** State before the action (used for undo) */
      before: TxData & { done: boolean; status: 'future' | 'past' };
      /** State after the action (used for redo) */
      after: TxData & { done: boolean; status: 'future' | 'past' };
      label: string;
    }
  | {
      kind: 'delete';
      /** Data of the deleted row (used to recreate on undo) */
      data: TxData & { status: 'future' | 'past' };
      /** Row number before deletion (used for redo to find the recreated row) */
      originalRowNumber: number;
      label: string;
    }
  | {
      kind: 'done';
      rowNumber: number;
      /** Before: the state of the row when it was marked done */
      before: { date: string; status: 'future' | 'past'; done: boolean };
      /** The execution date used when marking done (for redo) */
      executionDate: string;
      /** The recurring row that got auto-created (if any) */
      createdRowNumber?: number;
      createdData?: TxData;
      label: string;
    }
  | {
      kind: 'balance';
      before: number;
      after: number;
      label: string;
    }
  | {
      kind: 'categories';
      before: string[];
      after: string[];
      label: string;
    };

// ---------- Stacks ----------

const undoStack: HistoryEntry[] = [];
const redoStack: HistoryEntry[] = [];
let listeners: Array<() => void> = [];

function notify() {
  for (const l of listeners) l();
}

export function subscribeHistory(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

/** Push a new action - clears the redo stack. */
export function pushUndo(entry: HistoryEntry) {
  undoStack.push(entry);
  redoStack.length = 0;
  notify();
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

export function peekUndoLabel(): string | null {
  return undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null;
}

export function peekRedoLabel(): string | null {
  return redoStack.length > 0 ? redoStack[redoStack.length - 1].label : null;
}

// Back-compat alias - the old code used these names
export const subscribeUndo = subscribeHistory;
export const peekLabel = peekUndoLabel;

export function clearHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
  notify();
}

// ---------- Undo ----------

/**
 * Pop and reverse the last action.
 * On success, the caller should refresh data from the server.
 */
export async function performUndo(
  currentTransactions: Transaction[]
): Promise<string | null> {
  const entry = undoStack.pop();
  if (!entry) return null;

  try {
    await applyReverse(entry, currentTransactions);
    redoStack.push(entry);
    return entry.label;
  } catch (err) {
    // If undo failed, put it back
    undoStack.push(entry);
    throw err;
  } finally {
    notify();
  }
}

/**
 * Pop and re-apply the last undone action.
 */
export async function performRedo(
  currentTransactions: Transaction[]
): Promise<string | null> {
  const entry = redoStack.pop();
  if (!entry) return null;

  try {
    const updated = await applyForward(entry, currentTransactions);
    undoStack.push(updated);
    return entry.label;
  } catch (err) {
    redoStack.push(entry);
    throw err;
  } finally {
    notify();
  }
}

// ---------- Implementations ----------

async function applyReverse(entry: HistoryEntry, transactions: Transaction[]) {
  switch (entry.kind) {
    case 'create': {
      const match = findByData(transactions, entry.data, entry.createdRowNumber);
      if (match) await deleteTransactionApi(match.rowNumber);
      return;
    }
    case 'update': {
      await updateTransactionApi(entry.rowNumber, {
        date: entry.before.date,
        category: entry.before.category,
        description: entry.before.description,
        income: entry.before.income,
        expense: entry.before.expense,
        frequency: entry.before.frequency,
        done: entry.before.done,
        status: entry.before.status,
      });
      return;
    }
    case 'delete': {
      // Recreate the deleted row
      await createTransaction({
        date: entry.data.date,
        category: entry.data.category,
        description: entry.data.description,
        income: entry.data.income,
        expense: entry.data.expense,
        frequency: entry.data.frequency,
        status: entry.data.status,
      });
      return;
    }
    case 'done': {
      // Remove any recurring row auto-created
      if (entry.createdData) {
        const match = findByData(transactions, entry.createdData, entry.createdRowNumber);
        if (match) await deleteTransactionApi(match.rowNumber);
      }
      // Restore original row state
      await updateTransactionApi(entry.rowNumber, {
        date: entry.before.date,
        done: entry.before.done,
        status: entry.before.status,
      });
      return;
    }
    case 'balance': {
      await updateOpeningBalanceApi(entry.before);
      return;
    }
    case 'categories': {
      await replaceCategoriesApi(entry.before);
      return;
    }
  }
}

async function applyForward(
  entry: HistoryEntry,
  transactions: Transaction[]
): Promise<HistoryEntry> {
  switch (entry.kind) {
    case 'create': {
      const res = await createTransaction({
        date: entry.data.date,
        category: entry.data.category,
        description: entry.data.description,
        income: entry.data.income,
        expense: entry.data.expense,
        frequency: entry.data.frequency,
        status: entry.data.status,
      });
      return { ...entry, createdRowNumber: res.rowNumber };
    }
    case 'update': {
      await updateTransactionApi(entry.rowNumber, {
        date: entry.after.date,
        category: entry.after.category,
        description: entry.after.description,
        income: entry.after.income,
        expense: entry.after.expense,
        frequency: entry.after.frequency,
        done: entry.after.done,
        status: entry.after.status,
      });
      return entry;
    }
    case 'delete': {
      // We need to find the (recreated) row and delete it
      const match = findByData(transactions, entry.data, entry.originalRowNumber);
      if (match) await deleteTransactionApi(match.rowNumber);
      return entry;
    }
    case 'done': {
      const res = await markDoneApi(entry.rowNumber, entry.executionDate);
      return {
        ...entry,
        createdRowNumber: res.createdRowNumber,
      };
    }
    case 'balance': {
      await updateOpeningBalanceApi(entry.after);
      return entry;
    }
    case 'categories': {
      await replaceCategoriesApi(entry.after);
      return entry;
    }
  }
}

// ---------- Helpers ----------

function findByData(
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
  if (preferredRow) {
    const byRow = transactions.find((t) => t.rowNumber === preferredRow);
    if (byRow && matchesData(byRow, data)) return byRow;
  }
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

// Re-export for callers
export { todayIso };
