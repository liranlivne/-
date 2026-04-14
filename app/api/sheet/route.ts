import { NextResponse } from 'next/server';
import { readSnapshot } from '@/lib/sheets';

export const dynamic = 'force-dynamic'; // never cache
export const revalidate = 0;

export async function GET() {
  try {
    const snapshot = await readSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
