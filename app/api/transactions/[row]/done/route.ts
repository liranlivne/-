import { NextRequest, NextResponse } from 'next/server';
import {
  updateTransaction,
  appendTransaction,
  readSnapshot,
} from '@/lib/sheets';
import { nextRecurrenceDate, todayIso } from '@/lib/dateUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/transactions/[row]/done
 * Mark a transaction as done (moves it to `past` status with the actual
 * execution date). If it has a recurrence, also creates the next occurrence
 * with status=future based on the original date.
 *
 * Returns information needed for undo:
 *   {
 *     rowNumber,
 *     previousState: { date, status, updatedAt },
 *     createdRowNumber?: number   // if a recurring row was created
 *   }
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ row: string }> }
) {
  try {
    const { row } = await ctx.params;
    const rowNumber = parseInt(row, 10);
    if (!Number.isFinite(rowNumber) || rowNumber < 3) {
      return NextResponse.json({ error: 'Invalid row number' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      executionDate?: string; // ISO; defaults to today
    };
    const executionDate = body.executionDate || todayIso();
    const nowIso = new Date().toISOString();

    const snapshot = await readSnapshot();
    const existing = snapshot.transactions.find((t) => t.rowNumber === rowNumber);
    if (!existing) {
      return NextResponse.json({ error: 'Row not found' }, { status: 404 });
    }

    if (existing.status === 'past') {
      return NextResponse.json({ error: 'Already marked as done' }, { status: 400 });
    }

    // 1. Capture state for undo
    const previousState = {
      date: existing.date,
      status: existing.status,
      updatedAt: existing.updatedAt,
      done: existing.done,
    };

    // 2. Update the existing row: mark done, move to past, use execution date
    await updateTransaction(rowNumber, {
      date: executionDate,
      category: existing.category,
      description: existing.description,
      income: existing.income,
      expense: existing.expense,
      balance: null,
      frequency: existing.frequency,
      done: true,
      updatedAt: nowIso,
      status: 'past',
    });

    // 3. If recurring, create next occurrence based on ORIGINAL date
    let createdRowNumber: number | undefined;
    if (existing.frequency === 'חודשי' || existing.frequency === 'דו-חודשי') {
      const nextDate = nextRecurrenceDate(existing.date, existing.frequency);
      createdRowNumber = await appendTransaction({
        date: nextDate,
        category: existing.category,
        description: existing.description,
        income: existing.income,
        expense: existing.expense,
        balance: null,
        frequency: existing.frequency,
        done: false,
        updatedAt: nowIso,
        status: 'future',
      });
    }

    return NextResponse.json({
      ok: true,
      rowNumber,
      previousState,
      createdRowNumber,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
