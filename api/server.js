// api/server.js — Backend-only Excel API (Express) for Vercel
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Multer storage (works for local/dev; Vercel FS is read-only/ephemeral at runtime)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DATA_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._\-\s()%]+/g,'_');
    cb(null, safe);
  }
});
const upload = multer({ storage });

// --- Helpers ---
function sheetToJSONSafe(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function parseWorkbook(filePath) {
  const wb = XLSX.readFile(filePath);

  // Expected sheets (flexible headers; case-insensitive)
  const rRows = sheetToJSONSafe(wb, 'ROWS');
  const rText = sheetToJSONSafe(wb, 'TEXT');
  const rLine = sheetToJSONSafe(wb, 'LINE');

  const ROWS = rRows.map(r => ({
    body: String(r.body ?? r.Body ?? r.BODY ?? ''),
    subtitle: String(r.subtitle ?? r.Subtitle ?? r.SUBTITLE ?? ''),
    seen: Number(r.seen ?? r.Seen ?? r.SEEN ?? 0),
    unseen: Number(r.unseen ?? r.Unseen ?? r.UNSEEN ?? 0),
    audience: String(r.audience ?? r.Audience ?? r.AUDIENCE ?? '')
  }));

  const TITLES    = ROWS.map((_,i)=> String((rText[i]?.title)    ?? rText[i]?.Title    ?? ''));
  const HEADLINES = ROWS.map((_,i)=> String((rText[i]?.headline) ?? rText[i]?.Headline ?? ''));
  const BODIES    = ROWS.map((_,i)=> String((rText[i]?.bodyText) ?? rText[i]?.BodyText ?? rText[i]?.body ?? ''));

  const LINE_LABELS = (rLine.length ? rLine : ROWS).map(x => String(x.label ?? x.Label ?? x.body ?? ''));
  const LINE_SEEN   = (rLine.length ? rLine : ROWS).map(x => Number(x.seen  ?? x.Seen  ?? x.seen ?? 0));

  return { ROWS, TITLES, HEADLINES, BODIES, LINE_LABELS, LINE_SEEN };
}

// --- Routes ---

// 1) List available Excel files
app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR)
      .filter(n => n.toLowerCase().endsWith('.xlsx'))
      .map(n => {
        const p = path.join(DATA_DIR, n);
        const st = fs.statSync(p);
        return { name: n, size: st.size, mtime: st.mtimeMs };
      })
      .sort((a,b)=> b.mtime - a.mtime);
    res.json({ ok: true, files });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 2) Parsed JSON for a specific file
app.get('/api/files/:name/parsed', (req, res) => {
  try {
    const name = req.params.name;
    if (!/^[\w.\- %()]+$/.test(name) || !name.toLowerCase().endsWith('.xlsx')) {
      return res.status(400).json({ ok:false, error:'Bad filename' });
    }
    const p = path.join(DATA_DIR, name);
    if (!fs.existsSync(p)) return res.status(404).json({ ok:false, error:'Not found' });
    const data = parseWorkbook(p);
    res.json({ ok:true, file:name, ...data });
  } catch (e) {
    res.status(500).json({ ok:false, error:e.message });
  }
});

// 3) Stream raw Excel file (optional for debugging/download)
app.get('/api/files/:name/raw', (req, res) => {
  const name = req.params.name;
  if (!/^[\w.\- %()]+$/.test(name) || !name.toLowerCase().endsWith('.xlsx')) {
    return res.status(400).send('Bad filename');
  }
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) return res.status(404).send('Not found');
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  fs.createReadStream(p).pipe(res);
});

// 4) Upload (local/dev only)
app.post('/api/upload', upload.single('file'), (req,res) => {
  if (!req.file) return res.status(400).json({ ok:false, error:'No file' });
  res.json({ ok:true, saved:req.file.filename });
});

// 5) Delete (local/dev only; guarded)
app.delete('/api/files/:name', (req,res) => {
  const ADMIN_PASS = process.env.DELETE_PASS || 'change-this-password';
  const pass = req.headers['x-admin-pass'] || req.query.password || (req.body && req.body.password);
  if (pass !== ADMIN_PASS) return res.status(403).json({ ok:false, error:'Wrong password' });
  const name = req.params.name;
  if (!/^[\w.\- %()]+$/.test(name) || !name.toLowerCase().endsWith('.xlsx')) {
    return res.status(400).json({ ok:false, error:'Bad filename' });
  }
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) return res.status(404).json({ ok:false, error:'Not found' });
  fs.unlinkSync(p);
  res.json({ ok:true, deleted:name });
});

// Vercel handler
module.exports = app;
