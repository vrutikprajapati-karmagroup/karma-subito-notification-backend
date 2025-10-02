"use client";

import { useEffect, useState } from "react";

type FileInfo = { name: string; size: number; mtime: string | Date };

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function fetchFiles() {
    const res = await fetch("/api/files");
    const data = await res.json();
    setFiles(data);
  }

  useEffect(() => { fetchFiles(); }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMsg(`Uploaded: ${data.fileName}`);
      setFile(null);
      await fetchFiles();
    } else {
      setMsg(data.error || "Upload failed");
    }
  }

  return (
    <main className="min-h-screen p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Excel Uploader</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
        className="border border-gray-300 rounded px-2 py-1"
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          // className="block"
        />
        <button
          disabled={!file || busy}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          {busy ? "Uploading..." : "Upload"}
        </button>
      </form>

      {msg && <p className="text-sm">{msg}</p>}

      <div className="space-y-2">
        <h2 className="text-xl font-medium">Stored Files</h2>
        <ul className="list-disc pl-5">
          {files.map((f : any) => (
            <li key={f.name} className="break-all">
              <a href={`/api/files/${encodeURIComponent(f.name)}`} className="underline">
                {f.name}
              </a>{" "}
              <span className="text-sm text-gray-500">
                ({(f.size / 1024).toFixed(1)} KB)
              </span>
            </li>
          ))}
          {files.length === 0 && <li>No files yet.</li>}
        </ul>
      </div>
    </main>
  );
}
