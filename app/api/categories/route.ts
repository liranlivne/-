import { NextRequest, NextResponse } from 'next/server';
import { addCategory, overwriteCategories, readSnapshot } from '@/lib/sheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** GET /api/categories - list all categories */
export async function GET() {
  try {
    const snapshot = await readSnapshot();
    return NextResponse.json({ categories: snapshot.categories });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/categories - add a single category */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name: string };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    await addCategory(body.name.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PUT /api/categories - overwrite entire list (used for reorder/delete) */
export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as { categories: string[] };
    if (!Array.isArray(body.categories)) {
      return NextResponse.json({ error: 'categories must be an array' }, { status: 400 });
    }
    const cleaned = body.categories.map((c) => c.trim()).filter(Boolean);
    await overwriteCategories(cleaned);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
