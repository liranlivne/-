import { NextRequest, NextResponse } from 'next/server';
import { readChat, appendChatMessage } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** GET /api/chat - list all messages */
export async function GET() {
  try {
    const messages = await readChat();
    return NextResponse.json({ messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/chat - append a new message */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { author: string; text: string };
    if (!body.author?.trim() || !body.text?.trim()) {
      return NextResponse.json({ error: 'author and text are required' }, { status: 400 });
    }
    const rowNumber = await appendChatMessage(body.author.trim(), body.text.trim());
    return NextResponse.json({ ok: true, rowNumber });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
