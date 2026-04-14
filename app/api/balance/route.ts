import { NextRequest, NextResponse } from 'next/server';
import { updateOpeningBalance } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** PUT /api/balance - update opening balance (row 2) */
export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { balance: number };
    if (typeof body.balance !== 'number' || !Number.isFinite(body.balance)) {
      return NextResponse.json({ error: 'balance must be a number' }, { status: 400 });
    }
    const nowIso = new Date().toISOString();
    await updateOpeningBalance(body.balance, nowIso);
    return NextResponse.json({ ok: true, updatedAt: nowIso });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
