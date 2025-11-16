"use client";

import Image from "next/image";
import { useCallback, useMemo, useState, useEffect } from "react";
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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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
    if (session) {
      setIsAuthModalOpen(false);
    }
  }, [session]);

  const refreshSchemas = useCallback(async () => {
    if (!session) {
      setSchemasError(null);
      setProjectSchemas([]);
      setSchemasLoading(false);
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
  }, [session]);

  useEffect(() => {
    refreshSchemas();
  }, [refreshSchemas]);

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
    setIsAuthModalOpen(false);
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

  function openAuthModal() {
    setAuthError(null);
    setIsAuthModalOpen(true);
  }

  function closeAuthModal() {
    setAuthError(null);
    setIsAuthModalOpen(false);
  }

  const ingestionDisabled = !session || loading;
  const ingestionButtonLabel = session
    ? loading
      ? "Synchronizing"
      : "Ingest & Embed"
    : "Sign in to ingest";

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
              <div className="hero-aside">
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
                <div className="hero-auth-card">
                  <p className="hero-auth-label">Supabase link</p>
                  {session ? (
                    <>
                      <p className="hero-auth-status">Signed in and ready</p>
                      <div className="session-pill">
                        <span>{session.user.email}</span>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={handleSignOut}
                          disabled={authLoading}
                        >
                          {authLoading ? "Signing out" : "Sign out"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="hero-auth-status">Connect Supabase to orchestrate ingestion.</p>
                      <button type="button" className="ghost-btn" onClick={openAuthModal}>
                        Login with Supabase
                      </button>
                    </>
                  )}
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
              <div className="ingestion-actions">
                <button type="submit" disabled={ingestionDisabled} className="primary-btn">
                  {ingestionButtonLabel}
                </button>
                {!session && (
                  <p className="form-hint">Log in with Supabase to activate ingestion.</p>
                )}
              </div>
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
                  <span>
                    {entry.time} · {entry.event}
                  </span>
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

        <section className="glass-panel supabase-console">
          <div className="supabase-header">
            <div>
              <p className="panel-title">Schema telemetry</p>
              <h3 className="panel-heading">Supabase sync</h3>
            </div>
            <div className="supabase-actions">
              {session ? (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={refreshSchemas}
                  disabled={schemasLoading}
                >
                  {schemasLoading ? "Refreshing…" : "Refresh"}
                </button>
              ) : (
                <button type="button" className="ghost-btn" onClick={openAuthModal}>
                  Login to sync
                </button>
              )}
            </div>
          </div>
          <p className="supabase-description">
            Inspect the schema definitions persisted per project whenever Supabase authentication is active.
          </p>
          {session ? (
            <div className="schema-stream">
              {schemasLoading && <p className="supabase-hint">Loading schema definitions…</p>}
              {schemasError && <p className="supabase-error">{schemasError}</p>}
              {!schemasLoading && !schemasError && projectSchemas.length === 0 && (
                <p className="supabase-hint">No schema definitions stored for this account yet.</p>
              )}
              <div className="schema-list">
                {projectSchemas.map((schema) => (
                  <article key={schema.id} className="schema-card">
                    <div className="schema-meta">
                      <span>{schema.project_id}</span>
                      <span>
                        {schema.updated_at ? new Date(schema.updated_at).toLocaleString() : "never"}
                      </span>
                    </div>
                    <pre className="schema-json">{JSON.stringify(schema.schema_definition, null, 2)}</pre>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <p className="supabase-hint">Sign in to view Supabase schema telemetry.</p>
          )}
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
        )}
        {isAuthModalOpen && (
          <div className="workspace-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
            <div className="modal-overlay" onClick={closeAuthModal} />
            <div className="modal-shell glass-panel">
              <div className="modal-header">
                <div>
                  <p className="panel-title" id="auth-modal-title">
                    Supabase authentication
                  </p>
                  <h3 className="panel-heading">Secure access</h3>
                </div>
                <button className="modal-close" type="button" onClick={closeAuthModal}>
                  Close
                </button>
              </div>
              {session ? (
                <div className="auth-success">
                  <p>You are signed in as {session.user.email}.</p>
                  <button type="button" className="ghost-btn" onClick={handleSignOut} disabled={authLoading}>
                    {authLoading ? "Signing out" : "Sign out"}
                  </button>
                </div>
              ) : (
                <form className="auth-form" onSubmit={handleSignIn}>
                  <label>
                    Email
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </label>
                  {authError && <p className="supabase-error">{authError}</p>}
                  <div className="auth-actions">
                    <button type="submit" disabled={authLoading} className="primary-btn">
                      {authLoading ? "Processing" : "Sign in"}
                    </button>
                    <button type="button" className="ghost-btn" disabled={authLoading} onClick={handleSignUp}>
                      Create account
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
