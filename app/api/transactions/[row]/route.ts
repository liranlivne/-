import { NextRequest, NextResponse } from 'next/server';
import { updateTransaction, deleteRow, readSnapshot } from '@/lib/sheets';
import type { TransactionInput } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PUT /api/transactions/[row]
 * Update an existing transaction row.
 */
export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ row: string }> }
) {
  try {
    const { row } = await ctx.params;
    const rowNumber = parseInt(row, 10);
    if (!Number.isFinite(rowNumber) || rowNumber < 3) {
      return NextResponse.json({ error: 'Invalid row number' }, { status: 400 });
    }

    const body = (await request.json()) as TransactionInput & {
      status?: 'future' | 'past';
      done?: boolean;
      imageUrl?: string | null;
    };

    // Read current state to preserve fields not in the payload
    const snapshot = await readSnapshot();
    const existing = snapshot.transactions.find((t) => t.rowNumber === rowNumber);
    if (!existing) {
      return NextResponse.json({ error: 'Row not found' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    await updateTransaction(rowNumber, {
      date: body.date ?? existing.date,
      category: body.category ?? existing.category,
      description: body.description ?? existing.description,
      income: body.income ?? existing.income,
      expense: body.expense ?? existing.expense,
      balance: null, // balance is computed client-side, not stored
      frequency: body.frequency ?? existing.frequency,
      done: body.done ?? existing.done,
      updatedAt: nowIso,
      status: body.status ?? existing.status,
      imageUrl: body.imageUrl !== undefined ? body.imageUrl : existing.imageUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/transactions/[row]
 * Remove a transaction row entirely.
 */
export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ row: string }> }
) {
  try {
    const { row } = await ctx.params;
    const rowNumber = parseInt(row, 10);
    if (!Number.isFinite(rowNumber) || rowNumber < 3) {
      return NextResponse.json({ error: 'Invalid row number' }, { status: 400 });
    }
    await deleteRow(rowNumber);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
