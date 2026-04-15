import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/upload
 * Accepts a multipart/form-data upload with a single file under the "file" key.
 * Uploads it to Vercel Blob storage and returns the public URL.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Basic validation: size and type
    const MAX_SIZE = 8 * 1024 * 1024; // 8 MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `הקובץ גדול מדי (${Math.round(file.size / 1024 / 1024)}MB). מקסימום 8MB.` },
        { status: 400 }
      );
    }

    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/gif',
      'application/pdf',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `סוג קובץ לא נתמך: ${file.type}. יש להעלות JPG, PNG, WebP, HEIC, GIF או PDF.` },
        { status: 400 }
      );
    }

    // Generate a safe filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const safeName = `tzrim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    const blob = await put(safeName, file, {
      access: 'public',
      contentType: file.type,
    });

    return NextResponse.json({ ok: true, url: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
