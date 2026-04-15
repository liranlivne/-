// Frontend wrappers around our /api routes.

import type { SheetSnapshot, TransactionInput, Frequency } from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export async function fetchSnapshot(): Promise<SheetSnapshot> {
  const res = await fetch('/api/sheet', { cache: 'no-store' });
  return json<SheetSnapshot>(res);
}

export async function createTransaction(
  input: TransactionInput & { status?: 'future' | 'past'; imageUrl?: string | null }
): Promise<{ rowNumber: number }> {
  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return json<{ rowNumber: number }>(res);
}

export async function updateTransactionApi(
  rowNumber: number,
  input: Partial<
    TransactionInput & {
      status: 'future' | 'past';
      done: boolean;
      imageUrl: string | null;
    }
  >
): Promise<void> {
  const res = await fetch(`/api/transactions/${rowNumber}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  await json<{ ok: true }>(res);
}

export async function uploadFileApi(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  const data = await json<{ url: string }>(res);
  return data.url;
}

export async function deleteTransactionApi(rowNumber: number): Promise<void> {
  const res = await fetch(`/api/transactions/${rowNumber}`, {
    method: 'DELETE',
  });
  await json<{ ok: true }>(res);
}

export async function markDoneApi(
  rowNumber: number,
  executionDate: string
): Promise<{
  previousState: { date: string; status: string; done: boolean };
  createdRowNumber?: number;
}> {
  const res = await fetch(`/api/transactions/${rowNumber}/done`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ executionDate }),
  });
  return json(res);
}

export async function updateOpeningBalanceApi(balance: number): Promise<void> {
  const res = await fetch('/api/balance', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ balance }),
  });
  await json<{ ok: true }>(res);
}

export async function addCategoryApi(name: string): Promise<void> {
  const res = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  await json<{ ok: true }>(res);
}

export async function replaceCategoriesApi(categories: string[]): Promise<void> {
  const res = await fetch('/api/categories', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categories }),
  });
  await json<{ ok: true }>(res);
}

export type { Frequency };
