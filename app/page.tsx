"use client";

import { useMemo, useState } from "react";

const workspaceBoards = [
  {
    label: "Workspace Alpha",
    title: "Domain Intelligence",
    description: "Establish the semantic perimeter with contextual taxonomies, topic focus, and multi-market nuance.",
    highlights: ["Keyword gravity mapping", "SERP entity audit", "Authority handoff plan"]
  },
  {
    label: "Workspace Beta",
    title: "Content Supply Chain",
    description: "Curate URL batches, blueprint briefs, and align editorial pods with intent coverage heatmaps.",
    highlights: ["Priority cluster briefs", "Schema + metadata kit", "Publishing QA cadence"]
  },
  {
    label: "Workspace Gamma",
    title: "Insights & SLOs",
    description: "Track ingestion health, Qdrant freshness, and downstream agent confidence for executive reporting.",
    highlights: ["Embed health signal", "Collector uptime", "Executive telemetry"]
  }
];

const statusSignals = [
  { label: "Collector", value: "Active", tone: "#a8ffef" },
  { label: "Vector sync", value: "2.1s drift", tone: "#a3b9ff" },
  { label: "Content budget", value: "76% utilized", tone: "#f8f3ff" }
];

const timeline = [
  { time: "09:05", event: "New ingestion window reserved", detail: "Adaptive scheduler locked 35 URLs." },
  { time: "09:22", event: "Crawler sweep completed", detail: "Rendered 28 documents with pristine DOM." },
  { time: "09:35", event: "Embeddings committed", detail: "Qdrant shard sfo-01 updated (45 vectors)." }
];

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

  const totalUrls = useMemo(() => urlsRaw.split("\n").filter(Boolean).length, [urlsRaw]);
  const rootHostname = useMemo(() => {
    if (!rootUrl) {
      return "pending";
    }
    try {
      return new URL(rootUrl).hostname;
    } catch (error) {
      return "draft";
    }
  }, [rootUrl]);

  return (
    <main className="app-shell">
      <div className="content-wrapper">
        <section className="silver-hero">
          <p className="panel-title">AEO Guru</p>
          <h1 className="hero-title">Sleek command center for ingestion, curation, and telemetry.</h1>
          <p className="hero-subtitle">
            Arrange the critical workspaces for domain discovery and ingestion oversight in a single glass dashboard.
            Each touch point is infused with glassmorphism layers, subtle motion, and a silvered palette for instant clarity.
          </p>

          <div className="hero-metrics">
            <article className="metric-card">
              <span>Root authority</span>
              <strong>{rootHostname}</strong>
            </article>
            <article className="metric-card">
              <span>Queued URLs</span>
              <strong>{totalUrls}</strong>
            </article>
            <article className="metric-card">
              <span>Last response</span>
              <strong>{message ? "Received" : "Awaiting"}</strong>
            </article>
          </div>
        </section>

        <section className="ingestion-layout">
          <div className="glass-panel" style={{ minWidth: 0 }}>
            <p className="panel-title">Ingestion cockpit</p>
            <h2 className="panel-heading">Submit domains & orchestrate URLs</h2>
            <form onSubmit={handleIngest} className="form-grid">
              <div>
                <label>Project root URL</label>
                <input
                  type="url"
                  required
                  value={rootUrl}
                  onChange={(e) => setRootUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label>URLs to ingest (one per line)</label>
                <textarea
                  rows={6}
                  value={urlsRaw}
                  onChange={(e) => setUrlsRaw(e.target.value)}
                  placeholder={"https://example.com/page-1\nhttps://example.com/page-2"}
                />
              </div>
              <button type="submit" disabled={loading} className="primary-btn">
                {loading ? "Synchronizing" : "Ingest & Embed"}
              </button>
            </form>
          </div>

          <div className="glass-panel">
            <p className="panel-title">System signals</p>
            <div className="status-grid">
              {statusSignals.map((signal) => (
                <div key={signal.label} className="status-pill" style={{ borderLeft: `4px solid ${signal.tone}` }}>
                  <strong>{signal.label}</strong>
                  <span style={{ color: signal.tone }}>{signal.value}</span>
                </div>
              ))}
            </div>
            <div className="timeline">
              {timeline.map((entry) => (
                <div key={entry.time} className="timeline-entry">
                  <span>{entry.time} · {entry.event}</span>
                  <strong>{entry.detail}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="workspace-grid">
          {workspaceBoards.map((board) => (
            <article key={board.label} className="glass-panel">
              <p className="panel-title">{board.label}</p>
              <h3 className="panel-heading">{board.title}</h3>
              <p style={{ color: "var(--silver-500)", lineHeight: 1.6 }}>{board.description}</p>
              <ul style={{ marginTop: "1rem", paddingLeft: "1.2rem", color: "var(--silver-200)", lineHeight: 1.8 }}>
                {board.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        {message && (
          <div className="result-log">
            <p className="panel-title" style={{ marginBottom: "0.8rem" }}>
              API Response
            </p>
            {message}
          </div>
        )}
      </div>
    </main>
  );
}
