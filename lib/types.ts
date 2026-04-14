// Core data model types for the cashflow app

export type TransactionStatus = 'future' | 'past' | 'opening';
export type Frequency = '' | 'חודשי' | 'דו-חודשי';

/**
 * A single transaction row.
 * `rowNumber` is the 1-based row index in the Google Sheet
 * (row 1 = header, row 2 = opening balance, rows 3+ = transactions).
 */
export interface Transaction {
  rowNumber: number;
  date: string;          // ISO date string (YYYY-MM-DD) internally
  category: string;
  description: string;
  income: number | null;
  expense: number | null;
  balance: number | null;
  frequency: Frequency;
  done: boolean;
  updatedAt: string | null; // ISO timestamp of last update
  status: TransactionStatus;
}

/**
 * The opening balance lives in row 2 of the sheet.
 * Only the `balance` and `updatedAt` fields are meaningful.
 */
export interface OpeningBalance {
  balance: number;
  updatedAt: string | null;
}

export interface Category {
  name: string;
  rowNumber: number;
}

export interface SheetSnapshot {
  openingBalance: OpeningBalance;
  transactions: Transaction[];
  categories: string[];
}

// Data shape used when creating/editing a transaction from the UI
export interface TransactionInput {
  date: string;
  category: string;
  description: string;
  income: number | null;
  expense: number | null;
  frequency: Frequency;
}
