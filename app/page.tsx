"use client";

import Image from "next/image";
import { useMemo, useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type ProjectSchemaRecord = {
  id: string;
  project_id: string;
  schema_definition: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

const supabase = getSupabaseBrowserClient()
        ;
type WorkspaceKey = "alfa" | "beta" | "gamma";

const workspaceBoards: Array<{
  id: WorkspaceKey;
  label: string;
  title: string;
  description: string;
  highlights: string[];
}> = [
  {
    id: "alfa",
    label: "Workspace Alfa",
    title: "Domain Intelligence",
    description:
      "Establish the semantic perimeter with contextual taxonomies, topic focus, and multi-market nuance.",
    highlights: ["Keyword gravity mapping", "SERP entity audit", "Authority handoff plan"]
  },
  {
    id: "beta",
    label: "Workspace Beta",
    title: "Content Supply Chain",
    description:
      "Curate URL batches, blueprint briefs, and align editorial pods with intent coverage heatmaps.",
    highlights: ["Priority cluster briefs", "Schema + metadata kit", "Publishing QA cadence"]
  },
  {
    id: "gamma",
    label: "Workspace Gamma",
    title: "Insights & SLOs",
    description:
      "Track ingestion health, Qdrant freshness, and downstream agent confidence for executive reporting.",
    highlights: ["Embed health signal", "Collector uptime", "Executive telemetry"]
  }
];

const statusSignals = [
  { label: "Collector", value: "Active", tone: "#a8ffef" },
  { label: "Vector sync", value: "2.1s drift", tone: "#a3b9ff" },
  { label: "Content budget", value: "76% utilized", tone: "#f8f3ff" }
];

const hackathonStack = [
  {
    label: "lablab.ai",
    detail: "Hackathon arena",
    logo: "https://www.google.com/s2/favicons?domain=lablab.ai&sz=64"
  },
  {
    label: "OpenAI",
    detail: "Prompt ops",
    logo: "https://www.google.com/s2/favicons?domain=openai.com&sz=64"
  },
  {
    label: "GitHub",
    detail: "Ship + review",
    logo: "https://www.google.com/s2/favicons?domain=github.com&sz=64"
  },
  {
    label: "Gemini API",
    detail: "Optimization core",
    logo: "https://www.google.com/s2/favicons?domain=ai.google&sz=64"
  }
];

const timeline = [
  { time: "09:05", event: "New ingestion window reserved", detail: "Adaptive scheduler locked 35 URLs." },
  { time: "09:22", event: "Crawler sweep completed", detail: "Rendered 28 documents with pristine DOM." },
  { time: "09:35", event: "Embeddings committed", detail: "Qdrant shard sfo-01 updated (45 vectors)." }
];

const betaWorkflowSteps = [
  { id: "briefs", label: "Blueprint briefs" },
  { id: "schema", label: "Schema pass" },
  { id: "qa", label: "Publishing QA" }
];

export default function HomePage() {
  const [rootUrl, setRootUrl] = useState("");
  const [urlsRaw, setUrlsRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceKey | null>(null);
  const [alfaKeyword, setAlfaKeyword] = useState("");
  const [alfaKeywords, setAlfaKeywords] = useState([
    "Semantic perimeter",
    "Market nuance",
    "Topical trust"
  ]);
  const [betaSteps, setBetaSteps] = useState(() =>
    betaWorkflowSteps.map((step) => ({ ...step, done: step.id !== "qa" }))
  );
  const [gammaTargets, setGammaTargets] = useState({ uptime: 99.3, freshness: 88, confidence: 92 });

  const activeBoard = useMemo(
    () => workspaceBoards.find((board) => board.id === activeWorkspace) ?? null,
    [activeWorkspace]
  );
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [projectSchemas, setProjectSchemas] = useState<ProjectSchemaRecord[]>([]);
  const [schemasLoading, setSchemasLoading] = useState(false);
  const [schemasError, setSchemasError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      setSession(updatedSession ?? null);
      if (!updatedSession) {
        setProjectSchemas([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function fetchSchemas() {
      if (!session) {
        setSchemasError(null);
        setProjectSchemas([]);
        return;
      }

      setSchemasLoading(true);
      setSchemasError(null);
      const { data, error } = await supabase
        .from("project_schemas")
        .select("id, project_id, schema_definition, created_at, updated_at")
        .order("updated_at", { ascending: false, nullsFirst: false });

      if (error) {
        setSchemasError(error.message);
        setProjectSchemas([]);
      } else {
        setProjectSchemas(data ?? []);
      }

      setSchemasLoading(false);
    }

    fetchSchemas();
  }, [session]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      setAuthError(error.message);
    }
    setAuthLoading(false);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password
    });
    if (error) {
      setAuthError(error.message);
    }
    setAuthLoading(false);
  }

  async function handleSignOut() {
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
    }
    setAuthLoading(false);
  }

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

  function handleAddAlfaKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!alfaKeyword.trim()) return;
    setAlfaKeywords((prev) => Array.from(new Set([...prev, alfaKeyword.trim()])));
    setAlfaKeyword("");
  }

  function removeAlfaKeyword(keyword: string) {
    setAlfaKeywords((prev) => prev.filter((item) => item !== keyword));
  }

  function toggleBetaStep(stepId: string) {
    setBetaSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, done: !step.done } : step))
    );
  }

  function handleGammaChange(key: keyof typeof gammaTargets, value: number) {
    setGammaTargets((prev) => ({ ...prev, [key]: value }));
  }

  function renderWorkspaceContent(id: WorkspaceKey | null) {
    if (!id) return null;

    if (id === "alfa") {
      return (
        <div className="workspace-body">
          <div className="workspace-section">
            <p className="workspace-label">Focus taxonomy queue</p>
            <div className="chip-grid">
              {alfaKeywords.map((keyword) => (
                <span key={keyword} className="glass-chip">
                  {keyword}
                  <button
                    type="button"
                    aria-label={`Remove ${keyword}`}
                    onClick={() => removeAlfaKeyword(keyword)}
                  >
                    ×
                  </button>
                </span>
              ))}
              {alfaKeywords.length === 0 && (
                <span style={{ color: "var(--silver-500)" }}>Add at least one focus to generate signals.</span>
              )}
            </div>
          </div>

          <form className="inline-form" onSubmit={handleAddAlfaKeyword}>
            <input
              value={alfaKeyword}
              onChange={(event) => setAlfaKeyword(event.target.value)}
              placeholder="Add topical focus"
            />
            <button type="submit" className="primary-btn" disabled={!alfaKeyword.trim()}>
              Queue focus
            </button>
          </form>
        </div>
      );
    }

    if (id === "beta") {
      return (
        <div className="workspace-body">
          <div className="workspace-section">
            <p className="workspace-label">Workflow readiness</p>
            <ul className="workflow-list">
              {betaSteps.map((step) => (
                <li key={step.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={step.done}
                      onChange={() => toggleBetaStep(step.id)}
                    />
                    <span>{step.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    return (
      <div className="workspace-body gamma">
        <div className="workspace-section">
          <p className="workspace-label">Operational targets</p>
          <div className="gauge-grid">
            <label>
              <span>Collector uptime {gammaTargets.uptime.toFixed(1)}%</span>
              <input
                type="range"
                min="95"
                max="100"
                step="0.1"
                value={gammaTargets.uptime}
                onChange={(e) => handleGammaChange("uptime", Number(e.target.value))}
              />
            </label>
            <label>
              <span>Vector freshness {gammaTargets.freshness}%</span>
              <input
                type="range"
                min="70"
                max="100"
                value={gammaTargets.freshness}
                onChange={(e) => handleGammaChange("freshness", Number(e.target.value))}
              />
            </label>
            <label>
              <span>Agent confidence {gammaTargets.confidence}%</span>
              <input
                type="range"
                min="60"
                max="100"
                value={gammaTargets.confidence}
                onChange={(e) => handleGammaChange("confidence", Number(e.target.value))}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <div className="content-wrapper">
        <section className="silver-hero">
          <div className="hero-content">
            <header className="hero-header">
              <div className="hero-heading">
                <h1 className="hero-name">AEO Guru</h1>
                <p className="hero-subline">Powered by Gemini API</p>
              </div>
              <div className="hero-tech-panel">
                <p className="hero-tech-panel-label">Hackathon tech stack</p>
                <div className="hero-tech-grid">
                  {hackathonStack.map((tech) => (
                    <article key={tech.label} className="hero-tech-card">
                      <div className="hero-tech-card-copy">
                        <strong>{tech.label}</strong>
                        <p>{tech.detail}</p>
                      </div>
                      <span className="hero-tech-logo">
                        <Image
                          src={tech.logo}
                          alt={`${tech.label} favicon`}
                          width={28}
                          height={28}
                          loading="lazy"
                        />
                      </span>
                    </article>
                  ))}
                </div>
              </div>
            </header>
            <h2 className="hero-title">Answer Engine Optimization Toolkit</h2>
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
            <button
              key={board.id}
              type="button"
              className="glass-panel workspace-card"
              onClick={() => setActiveWorkspace(board.id)}
              aria-label={`Open ${board.label}`}
            >
              <p className="panel-title">{board.label}</p>
              <h3 className="panel-heading">{board.title}</h3>
              <p style={{ color: "var(--silver-500)", lineHeight: 1.6 }}>{board.description}</p>
              <ul style={{ marginTop: "1rem", paddingLeft: "1.2rem", color: "var(--silver-200)", lineHeight: 1.8 }}>
                {board.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </button>
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
        {activeBoard && (
          <div className="workspace-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-title">
            <div className="modal-overlay" onClick={() => setActiveWorkspace(null)} />
            <div className="modal-shell glass-panel">
              <div className="modal-header">
                <div>
                  <p className="panel-title" id="workspace-title">
                    {activeBoard.label}
                  </p>
                  <h3 className="panel-heading">{activeBoard.title}</h3>
                </div>
                <button className="modal-close" type="button" onClick={() => setActiveWorkspace(null)}>
                  Close
                </button>
              </div>
              <p className="modal-description">{activeBoard.description}</p>
              {renderWorkspaceContent(activeBoard.id)}
            </div>
          </div>
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center">
      <div className="w-full max-w-4xl px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            AEO-guru ingestion console
          </h1>
          <p className="text-neutral-400">
            Seed the semantic core for AEO-guru by submitting your primary domain
            and the URLs you would like embedded and stored in Qdrant. Sign in to
            sync your projects and schema with Supabase.
          </p>
        </div>

        <section className="space-y-4 border border-neutral-800 rounded-2xl p-6 bg-neutral-950/60">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Supabase authentication</h2>
            {session && (
              <button
                onClick={handleSignOut}
                disabled={authLoading}
                className="inline-flex items-center rounded-full border border-white/40 px-3 py-1 text-xs font-medium hover:bg-white hover:text-black transition disabled:opacity-50"
              >
                Sign out
              </button>
            )}
          </div>
          {session ? (
            <p className="text-sm text-neutral-400">
              Signed in as <span className="text-white">{session.user.email}</span>
            </p>
          ) : (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSignIn}>
              <label className="text-sm col-span-2 md:col-span-1">
                <span className="mb-1 block">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
                  placeholder="you@example.com"
                />
              </label>
              <label className="text-sm col-span-2 md:col-span-1">
                <span className="mb-1 block">Password</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
                  placeholder="••••••••"
                />
              </label>
              <div className="col-span-2 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="inline-flex items-center rounded-full border border-white/40 px-4 py-2 text-sm font-medium hover:bg-white hover:text-black transition disabled:opacity-50"
                >
                  {authLoading ? "Processing…" : "Sign in"}
                </button>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={handleSignUp}
                  className="inline-flex items-center rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium hover:border-white/60 transition disabled:opacity-50"
                >
                  Create account
                </button>
              </div>
              {authError && (
                <p className="col-span-2 text-sm text-red-400">{authError}</p>
              )}
            </form>
          )}
        </section>

        {session ? (
          <>
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
                  placeholder={"https://example.com/page-1\nhttps://example.com/page-2"}
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
              <pre className="text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-4 overflow-x-auto">
                {message}
              </pre>
            )}

            <section className="space-y-4 border border-neutral-800 rounded-2xl p-6 bg-neutral-950/60">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Project schemas</h2>
                  <p className="text-sm text-neutral-400">
                    The latest schema definitions stored in Supabase for this account.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (session) {
                      setSchemasLoading(true);
                      supabase
                        .from("project_schemas")
                        .select("id, project_id, schema_definition, created_at, updated_at")
                        .order("updated_at", { ascending: false, nullsFirst: false })
                        .then(({ data, error }) => {
                          if (error) {
                            setSchemasError(error.message);
                            setProjectSchemas([]);
                          } else {
                            setProjectSchemas(data ?? []);
                            setSchemasError(null);
                          }
                          setSchemasLoading(false);
                        });
                    }
                  }}
                  disabled={schemasLoading}
                  className="inline-flex items-center rounded-full border border-white/40 px-3 py-1 text-xs font-medium hover:bg-white hover:text-black transition disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              {schemasLoading && (
                <p className="text-sm text-neutral-400">Loading schema definitions…</p>
              )}

              {schemasError && (
                <p className="text-sm text-red-400">{schemasError}</p>
              )}

              {!schemasLoading && !schemasError && projectSchemas.length === 0 && (
                <p className="text-sm text-neutral-400">
                  No schema definitions have been stored for this account yet.
                </p>
              )}

              <div className="space-y-4">
                {projectSchemas.map((schema) => (
                  <div
                    key={schema.id}
                    className="border border-neutral-800 rounded-xl p-4 bg-black/40"
                  >
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="font-semibold">{schema.project_id}</span>
                      <span className="text-neutral-500">
                        Updated {schema.updated_at ? new Date(schema.updated_at).toLocaleString() : "never"}
                      </span>
                    </div>
                    <pre className="text-xs text-neutral-200 overflow-x-auto">
                      {JSON.stringify(schema.schema_definition, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <p className="text-sm text-neutral-400">
            Sign in above to unlock ingestion controls and view your stored project schema.
          </p>
        )}
      </div>
    </main>
  );
}
