// app/page.tsx
import { useState } from "react";

export default function HomePage() {
  const [rootUrl, setRootUrl] = useState("");
  const [urlsRaw, setUrlsRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const urls = urlsRaw
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    const res = await fetch("/api/ingest", {
      method: "POST",
      body: JSON.stringify({
        projectId: rootUrl,
        urls
      })
    });

    const json = await res.json();
    setLoading(false);
    setMessage(JSON.stringify(json, null, 2));
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center">
      <div className="w-full max-w-3xl px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
          AnswerGraph
        </h1>
        <p className="text-neutral-400 mb-8">
          Build a semantic core and AEO-ready schema from your content corpus,
          backed by Qdrant.
        </p>

        <form
          onSubmit={handleIngest}
          className="space-y-6 border border-neutral-800 rounded-2xl p-6 bg-neutral-950/60"
        >
          <div>
            <label className="block text-sm mb-1">Project root URL</label>
            <input
              type="url"
              required
              value={rootUrl}
              onChange={(e) => setRootUrl(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">
              URLs to ingest (one per line)
            </label>
            <textarea
              rows={6}
              value={urlsRaw}
              onChange={(e) => setUrlsRaw(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
              placeholder="https://example.com/page-1&#10;https://example.com/page-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center rounded-full border border-white/40 px-4 py-2 text-sm font-medium hover:bg-white hover:text-black transition disabled:opacity-50"
          >
            {loading ? "Ingesting…" : "Ingest & Embed"}
          </button>
        </form>

        {message && (
          <pre className="mt-8 text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-4 overflow-x-auto">
            {message}
          </pre>
        )}
      </div>
    </main>
  );
}
