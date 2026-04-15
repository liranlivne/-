import { NextRequest, NextResponse } from 'next/server';
import { appendTransaction } from '@/lib/sheets';
import type { TransactionInput } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/transactions
 * Create a new transaction in the תזרים sheet.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TransactionInput & {
      status?: 'future' | 'past';
      imageUrl?: string | null;
    };
    const nowIso = new Date().toISOString();

    const rowNumber = await appendTransaction({
      date: body.date,
      category: body.category,
      description: body.description,
      income: body.income,
      expense: body.expense,
      balance: null,
      frequency: body.frequency,
      done: false,
      updatedAt: nowIso,
      status: body.status ?? 'future',
      imageUrl: body.imageUrl ?? null,
    });

    return NextResponse.json({ ok: true, rowNumber });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
