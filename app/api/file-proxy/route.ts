import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/file-proxy?url=<vercel-blob-url>
 *
 * Streams an attached invoice file back through our own origin so the browser
 * can turn it into a File object for the Web Share API (sharing to WhatsApp).
 * Fetching the Blob URL directly from the page can hit CORS; same-origin via
 * this proxy never does.
 *
 * SSRF guard: only *.blob.vercel-storage.com hosts are allowed.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'missing url' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'bad url' }, { status: 400 });
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.blob.vercel-storage.com')) {
    return NextResponse.json({ error: 'forbidden host' }, { status: 403 });
  }

  const upstream = await fetch(url);
  if (!upstream.ok) {
    return NextResponse.json({ error: `upstream ${upstream.status}` }, { status: 502 });
  }
  const buf = await upstream.arrayBuffer();
  const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'private, max-age=60',
    },
  });
}
