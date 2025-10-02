import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  const dir = path.join(process.cwd(), "uploads");
  try {
    const names = await readdir(dir);
    const files = await Promise.all(
      names.map(async (name) => {
        const s = await stat(path.join(dir, name));
        return { name, size: s.size, mtime: s.mtime };
      })
    );
    return NextResponse.json(files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime()));
  } catch {
    return NextResponse.json([]);
  }
}
