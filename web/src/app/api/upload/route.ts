// src/app/api/upload/route.ts
import { NextResponse } from 'next/server';
import path from 'node:path';
import { promises as fs } from 'node:fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'Missing file' },
        { status: 400, headers: CORS }
      );
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json(
        { ok: false, error: 'Only .xlsx allowed' },
        { status: 400, headers: CORS }
      );
    }

    const arrayBuf = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    // local dev: persist to /uploads
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const safeName = path.basename(file.name);
    const dest = path.join(UPLOAD_DIR, safeName);
    await fs.writeFile(dest, buf);

    return NextResponse.json({ ok: true, name: safeName }, { headers: CORS });
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Upload failed";
  return NextResponse.json({ error: message }, { status: 500 });
}
}
