// src/app/api/files/route.ts
import { NextResponse } from 'next/server';
import path from 'node:path';
import { promises as fs } from 'node:fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const names = await fs.readdir(UPLOAD_DIR);

    const files = await Promise.all(
      names
        .filter(n => n.toLowerCase().endsWith('.xlsx'))
        .map(async (name) => {
          const stat = await fs.stat(path.join(UPLOAD_DIR, name));
          return { name, size: stat.size, mtime: stat.mtime };
        })
    );

    return NextResponse.json({ ok: true, files }, { headers: CORS });
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Upload failed";
  return NextResponse.json({ error: message }, { status: 500 });
}

}
