import { NextResponse } from "next/server";
import path from "node:path";
import { promises as fs } from "node:fs";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

type CellValue = string | number | boolean | Date | null;
type Row = Record<string, CellValue>;

function norm(s: unknown): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function rowsFromSheet(ws: XLSX.WorkSheet): {
  rows: Array<{ body: string; subtitle: string; seen: number; unseen: number; audience: string }>;
  titles: string[];
  headlines: string[];
  bodies: string[];
} {
  const json: Row[] = XLSX.utils.sheet_to_json<Row>(ws, { defval: "", raw: true });

  if (!json.length) return { rows: [], titles: [], headlines: [], bodies: [] };

  const first = json[0];
  const keys = Object.keys(first).map((k) => [k, norm(k)] as const);

  const findKey = (...candidates: string[]) =>
    keys.find(([, k]) => candidates.includes(k))?.[0];

  const bodyKey = findKey("body") ?? findKey("name", "notification");
  const subtitleKey = findKey("subtitle", "date", "datetime", "time", "sentat");
  const seenKey = findKey("seen", "views", "opened");
  const unseenKey = findKey("unseen", "notseen", "unopened", "delivered");
  const audienceKey = findKey("audience", "segment", "country", "region");

  const titleKey = findKey("title");
  const headlineKey = findKey("headline");
  const bodyTextKey = findKey("bodytext", "body_text", "copy", "description");

  const rows: Array<{ body: string; subtitle: string; seen: number; unseen: number; audience: string }> = [];
  const titles: string[] = [];
  const headlines: string[] = [];
  const bodies: string[] = [];

  for (const r of json) {
    const body = bodyKey ? String(r[bodyKey] ?? "") : "";
    const subtitle = subtitleKey ? String(r[subtitleKey] ?? "") : "";
    const seen = seenKey ? Number(r[seenKey] ?? 0) || 0 : 0;
    const unseen = unseenKey ? Number(r[unseenKey] ?? 0) || 0 : 0;
    const audience = audienceKey ? String(r[audienceKey] ?? "") : "";

    if (body || seen || unseen || subtitle || audience) {
      rows.push({ body, subtitle, seen, unseen, audience });
      if (titleKey) titles.push(String(r[titleKey] ?? ""));
      if (headlineKey) headlines.push(String(r[headlineKey] ?? ""));
      if (bodyTextKey) bodies.push(String(r[bodyTextKey] ?? ""));
    }
  }

  return { rows, titles, headlines, bodies };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ file: string }> }
) {
  try {
    const { file: rawName } = await ctx.params;
    const safeName = path.basename(rawName);
    const fullPath = path.join(UPLOAD_DIR, safeName);

    const buf = await fs.readFile(fullPath);
    const wb = XLSX.read(buf, { type: "buffer" });

    let ROWS: Array<{ body: string; subtitle: string; seen: number; unseen: number; audience: string }> = [];
    let TITLES: string[] = [];
    let HEADLINES: string[] = [];
    let BODIES: string[] = [];

    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      if (!ws) continue;
      const { rows, titles, headlines, bodies } = rowsFromSheet(ws);
      if (rows.length) ROWS = ROWS.concat(rows);
      if (titles.length) TITLES = TITLES.concat(titles);
      if (headlines.length) HEADLINES = HEADLINES.concat(headlines);
      if (bodies.length) BODIES = BODIES.concat(bodies);
    }

    const LINE_LABELS = ROWS.map((r) => r.body);
    const LINE_SEEN = ROWS.map((r) => r.seen);

    return NextResponse.json(
      { ok: true as const, file: safeName, ROWS, TITLES, HEADLINES, BODIES, LINE_LABELS, LINE_SEEN },
      { headers: CORS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to parse file";
    return NextResponse.json({ error: message }, { status: 500, headers: CORS });
  }
}







// import { NextResponse } from 'next/server';
// import path from 'node:path';
// import { promises as fs } from 'node:fs';
// import * as XLSX from 'xlsx';

// export const runtime = 'nodejs';
// export const dynamic = 'force-dynamic';

// const CORS = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Methods': 'GET,OPTIONS',
//   'Access-Control-Allow-Headers': 'Content-Type',
// };

// const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// function norm(s: any) {
//   return String(s || '')
//     .trim()
//     .toLowerCase()
//     .replace(/\s+/g, '');
// }

// function rowsFromSheet(ws: XLSX.WorkSheet) {
//   const json: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, {
//     defval: '',
//     raw: true,
//   });

//   if (!json.length) return { rows: [], titles: [], headlines: [], bodies: [] };

//   const first = json[0] as Record<string, any>;
//   const keys = Object.keys(first).map(k => [k, norm(k)] as const);

//   const findKey = (...candidates: string[]) =>
//     keys.find(([orig, k]) => candidates.includes(k))?.[0];

//   const bodyKey = findKey('body') ?? findKey('name', 'notification');
//   const subtitleKey = findKey('subtitle', 'date', 'datetime', 'time', 'sentat');
//   const seenKey = findKey('seen', 'views', 'opened');
//   const unseenKey = findKey('unseen', 'notseen', 'unopened', 'delivered');
//   const audienceKey = findKey('audience', 'segment', 'country', 'region');

//   const titleKey = findKey('title');
//   const headlineKey = findKey('headline');
//   const bodyTextKey = findKey('bodytext', 'body_text', 'copy', 'description');

//   const rows: {
//     body: string; subtitle: string; seen: number; unseen: number; audience: string;
//   }[] = [];

//   const titles: string[] = [];
//   const headlines: string[] = [];
//   const bodies: string[] = [];

//   for (const r of json) {
//     const body = bodyKey ? String(r[bodyKey] ?? '') : '';
//     const subtitle = subtitleKey ? String(r[subtitleKey] ?? '') : '';
//     const seen = Number(r[seenKey as string] ?? 0) || 0;
//     const unseen = Number(r[unseenKey as string] ?? 0) || 0;
//     const audience = audienceKey ? String(r[audienceKey] ?? '') : '';

//     if (body || seen || unseen || subtitle || audience) {
//       rows.push({ body, subtitle, seen, unseen, audience });
//       if (titleKey) titles.push(String(r[titleKey] ?? ''));
//       if (headlineKey) headlines.push(String(r[headlineKey] ?? ''));
//       if (bodyTextKey) bodies.push(String(r[bodyTextKey] ?? ''));
//     }
//   }

//   return { rows, titles, headlines, bodies };
// }

// export async function OPTIONS() {
//   return new NextResponse(null, { status: 204, headers: CORS });
// }

// // NOTE: params is a Promise in newer Next.js – await it!
// export async function GET(
//   _req: Request,
//   ctx: { params: Promise<{ file: string }> }
// ) {
//   try {
//     const { file: rawName } = await ctx.params; // <-- important
//     const safeName = path.basename(rawName);
//     const fullPath = path.join(UPLOAD_DIR, safeName);

//     const buf = await fs.readFile(fullPath);
//     const wb = XLSX.read(buf, { type: 'buffer' });

//     let ROWS: any[] = [];
//     let TITLES: string[] = [];
//     let HEADLINES: string[] = [];
//     let BODIES: string[] = [];

//     wb.SheetNames.forEach((name) => {
//       const ws = wb.Sheets[name];
//       const { rows, titles, headlines, bodies } = rowsFromSheet(ws);
//       if (rows.length) ROWS = ROWS.concat(rows);
//       if (titles.length) TITLES = TITLES.concat(titles);
//       if (headlines.length) HEADLINES = HEADLINES.concat(headlines);
//       if (bodies.length) BODIES = BODIES.concat(bodies);
//     });

//     const LINE_LABELS = ROWS.map((r) => r.body);
//     const LINE_SEEN = ROWS.map((r) => Number(r.seen) || 0);

//     return NextResponse.json(
//       { ok: true, file: safeName, ROWS, TITLES, HEADLINES, BODIES, LINE_LABELS, LINE_SEEN },
//       { headers: CORS }
//     );
// } catch (err: unknown) {
//   const message = err instanceof Error ? err.message : "Upload failed";
//   return NextResponse.json({ error: message }, { status: 500 });
// }

// }
