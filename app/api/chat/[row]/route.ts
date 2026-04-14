import { NextRequest, NextResponse } from 'next/server';
import { deleteChatMessage } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** DELETE /api/chat/[row] - remove a single message. */
export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ row: string }> }
) {
  try {
    const { row } = await ctx.params;
    const rowNumber = parseInt(row, 10);
    if (!Number.isFinite(rowNumber) || rowNumber < 2) {
      return NextResponse.json({ error: 'Invalid row number' }, { status: 400 });
    }
    await deleteChatMessage(rowNumber);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
