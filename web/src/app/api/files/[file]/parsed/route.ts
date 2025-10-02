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

/* --------- date/time formatting helpers ---------- */
function zero(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function formatDatePart(v: CellValue): string {
  if (v == null || v === "") return "";
  // Date object
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = zero(v.getMonth() + 1);
    const d = zero(v.getDate());
    return `${y}-${m}-${d}`;
  }
  // Excel serial number
  if (typeof v === "number" && Number.isFinite(v)) {
    const p = XLSX.SSF.parse_date_code(v);
    if (p && p.y && p.m && p.d) {
      return `${p.y}-${zero(p.m)}-${zero(p.d)}`;
    }
  }
  // String (assume already formatted)
  return String(v).trim();
}

function formatTimePart(v: CellValue): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) {
    return `${zero(v.getHours())}:${zero(v.getMinutes())}:${zero(
      v.getSeconds()
    )}`;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const p = XLSX.SSF.parse_date_code(v);
    if (p)
      return `${zero(p.H || 0)}:${zero(p.M || 0)}:${zero(
        Math.floor(p.S || 0)
      )}`;
  }
  // String like "14:30:16" – normalize a bit
  const s = String(v).trim();
  // If "14:30" ensure seconds
  if (/^\d{1,2}:\d{2}$/.test(s)) return `${s}:00`;
  return s;
}
/* ------------------------------------------------- */

function rowsFromSheet(ws: XLSX.WorkSheet): {
  rows: Array<{
    body: string;
    subtitle: string;
    seen: number;
    unseen: number;
    audience: string;
  }>;
  titles: string[];
  headlines: string[];
  bodies: string[];
} {
  const json: Row[] = XLSX.utils.sheet_to_json<Row>(ws, {
    defval: "",
    raw: true,
  });

  if (!json.length) return { rows: [], titles: [], headlines: [], bodies: [] };

  const first = json[0];
  const keys = Object.keys(first).map((k) => [k, norm(k)] as const);

  const findKey = (...candidates: string[]) =>
    keys.find(([, k]) => candidates.includes(k))?.[0];

  // Event name for chart labels & card title
  const eventNameKey = findKey(
    "eventname",
    "event name",
    "name",
    "notification"
  );
  // Body copy (email/push body text) goes to BODIES[]
  const bodyCopyKey = findKey(
    "body",
    "bodytext",
    "body_text",
    "copy",
    "description"
  );

  // date/time keys unchanged
  const subtitleKey = findKey("subtitle", "datetime", "sentat");
  const dateKey = findKey("date", "eventdate");
  const timeKey = findKey("time", "timeist", "time_ist", "eventtime");

  const seenKey = findKey("seen", "views", "opened");
  const unseenKey = findKey("unseen", "notseen", "unopened", "delivered");
  const audienceKey = findKey("audience", "segment", "country", "region");

  const titleKey = findKey("title");
  const headlineKey = findKey("headline");
  const bodyTextKey = findKey("bodytext", "body_text", "copy", "description");

  const rows: Array<{
    body: string;
    subtitle: string;
    seen: number;
    unseen: number;
    audience: string;
  }> = [];
  const titles: string[] = [];
  const headlines: string[] = [];
  const bodies: string[] = [];

  for (const r of json) {
    const body = eventNameKey ? String(r[eventNameKey] ?? "") : "";
    // Build "YYYY-MM-DD HH:mm:ss"
    let subtitle = subtitleKey ? String(r[subtitleKey] ?? "") : "";
    if (!subtitle) {
      const dPart = dateKey ? formatDatePart(r[dateKey]) : "";
      const tPart = timeKey ? formatTimePart(r[timeKey]) : "";
      subtitle = `${dPart}${dPart && tPart ? " " : ""}${tPart}`.trim();
    }

    const seen = seenKey ? Number(r[seenKey] ?? 0) || 0 : 0;
    const unseen = unseenKey ? Number(r[unseenKey] ?? 0) || 0 : 0;
    const audience = audienceKey ? String(r[audienceKey] ?? "") : "";

    if (body || seen || unseen || subtitle || audience) {
      rows.push({ body, subtitle, seen, unseen, audience });
      if (titleKey) titles.push(String(r[titleKey] ?? "")); // marketing title
      if (headlineKey) headlines.push(String(r[headlineKey] ?? ""));
      const copyVal = bodyCopyKey
        ? String(r[bodyCopyKey] ?? "")
        : bodyTextKey
        ? String(r[bodyTextKey] ?? "")
        : "";
      bodies.push(copyVal);
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

    let ROWS: Array<{
      body: string;
      subtitle: string;
      seen: number;
      unseen: number;
      audience: string;
    }> = [];
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
      {
        ok: true as const,
        file: safeName,
        ROWS,
        TITLES,
        HEADLINES,
        BODIES,
        LINE_LABELS,
        LINE_SEEN,
      },
      { headers: CORS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to parse file";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS }
    );
  }
}
