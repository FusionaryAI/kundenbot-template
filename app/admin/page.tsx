"use client";

import { useState } from "react";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [slug, setSlug] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, slug, url }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Unbekannter Fehler");
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setError(e?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold mb-4">
          Fusionary AI – Website-Importer
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Admin Passwort</label>
            <input
              type="password"
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Tenant-Slug</label>
            <input
              type="text"
              placeholder="z.B. muster-demo"
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Website-URL</label>
            <input
              type="text"
              placeholder="z.B. https://www.kunde.de"
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 px-4 py-2 text-sm font-medium"
          >
            {loading ? "Import läuft..." : "Website importieren"}
          </button>
        </form>

        {error && (
          <div className="mt-4 text-sm text-red-400">Fehler: {error}</div>
        )}

        {result && (
          <div className="mt-4 text-sm text-slate-300 space-y-2">
            <div>
              <strong>Tenant:</strong> {result.tenant?.name} (
              {result.tenant?.slug})
            </div>
            <div>
              <strong>Verarbeitete Seiten:</strong> {result.pages_processed}
            </div>

            {Array.isArray(result.items) && result.items.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-slate-400">
                  Details anzeigen
                </summary>
                <ul className="mt-2 list-disc list-inside text-slate-400">
                  {result.items.map((it: any, i: number) => (
                    <li key={i}>
                      {it.title} – {it.url}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
