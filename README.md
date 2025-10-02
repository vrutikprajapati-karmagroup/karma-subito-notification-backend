# Karma Subito — Backend-only Excel API (Express on Vercel)

This repo exposes your Excel data as JSON for a separate frontend (HTML anywhere).

## Endpoints
- `GET /api/files` → list `.xlsx` files from `/api/data`
- `GET /api/files/:name/parsed` → parsed JSON `{ ROWS, TITLES, HEADLINES, BODIES, LINE_LABELS, LINE_SEEN }`
- `GET /api/files/:name/raw` → stream the raw Excel
- `POST /api/upload` → upload (works locally; Vercel FS is ephemeral)
- `DELETE /api/files/:name` → delete (works locally; needs `DELETE_PASS` env)

> On Vercel: commit `.xlsx` into `/api/data` in Git and deploy. Runtime writes won’t persist.

## Excel shape
- Sheet **ROWS**: `body | subtitle | seen | unseen | audience`
- Sheet **TEXT**: `title | headline | bodyText` (aligned to ROWS length/order)
- Sheet **LINE**: `label | seen` (optional; falls back to ROWS if missing)

## Deploy
1. Push to GitHub.
2. Import into Vercel. The `vercel.json` routes `/api/*` to `api/server.js`.

## Local dev
```bash
npm install
npm run dev
# GET http://localhost:3000/api/files  (if you bind a port wrapper) or use vercel dev:
npm i -g vercel
vercel dev
```
