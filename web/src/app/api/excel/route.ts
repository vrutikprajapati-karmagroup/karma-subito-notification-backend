import { NextResponse } from "next/server";
import path from "path";
import { readdir, stat } from "fs/promises";

export const runtime = "nodejs";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
  try {
    const uploadsDir = path.join(process.cwd(), "uploads");
    let files: Array<{ name: string; size: number; mtime: Date }> = [];

    try {
      const names = await readdir(uploadsDir);
      const excelNames = names.filter((n) => /\.(xlsx|xls)$/i.test(n));

      files = await Promise.all(
        excelNames.map(async (name) => {
          const s = await stat(path.join(uploadsDir, name));
          return { name, size: s.size, mtime: s.mtime };
        })
      );
    } catch {
      files = [];
    }

    files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    const envBase = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "");
    const reqUrl = new URL(req.url);
    const detectedBase = `${reqUrl.protocol}//${reqUrl.host}`;
    const baseUrl = envBase || detectedBase;

    const data = files.map((f) => ({
      name: f.name,
      size: f.size,
      mtime: f.mtime.toISOString(),
      url: `${baseUrl}/api/files/${encodeURIComponent(f.name)}`,
    }));

    return NextResponse.json({ files: data }, { headers: corsHeaders() });
 } catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Upload failed";
  return NextResponse.json({ error: message }, { status: 500 });
}

}
