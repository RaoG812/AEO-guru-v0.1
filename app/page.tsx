"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProjectRecord = {
  id: string;
  name?: string;
  rootUrl: string;
  sitemapUrl?: string | null;
  createdAt: string;
};

type ClusterResponse = {
  id: string;
  size: number;
  metadata: {
    label: string;
    summary: string;
    intent: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    contentGaps: string[];
    representativeQueries: string[];
    recommendedSchemas: string[];
  };
  lang: string;
  primaryUrl: string | null;
  opportunityScore: number;
  questions: string[];
};

type StatusState = {
  ingest: boolean;
  clusters: boolean;
  download: boolean;
  projects: boolean;
};

const initialStatus: StatusState = {
  ingest: false,
  clusters: false,
  download: false,
  projects: false
};

const heroStack = [
  {
    label: "Vercel",
    icon: (
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
        <path d="m12 5 7 12H5z" fill="currentColor" />
      </svg>
    )
  },
  {
    label: "Supabase",
    icon: (
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
        <path
          d="M8.5 4h7.2c1 0 1.6 1.1.9 2l-3.1 3.9h3.8c.8 0 1.2.9.7 1.5l-6 8.4c-.8 1-2.5.1-2-1.1l2.1-5H7.4c-.9 0-1.5-1-.9-1.8l4.2-5.4H8.5c-.9 0-1.5-1-.9-1.8Z"
          fill="currentColor"
        />
      </svg>
    )
  },
  {
    label: "Qdrant",
    icon: (
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
        <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M12 5.5v13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M6.5 12h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  },
  {
    label: "Gemini AI",
    icon: (
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
        <circle cx="9" cy="9" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="15" cy="15" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M9 12.3c1.6 1 3.4 1 5 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    )
  }
];

const vectorPhrases = [
  "Taxonomy",
  "Taxonomical Knowledgebase",
  "Taxonomy BI",
  "Entity Graph",
  "Context Map",
  "Answer Graph",
  "Schema Blocks",
  "FAQ Targets",
  "Intent Drafts",
  "SERP Gaps",
  "Topical Authority",
  "Vector Payloads",
  "Structured Snippets",
  "AI Overview Hooks",
  "Conversation Seeds"
];

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getFilenameFromDisposition(disposition: string | null) {
  if (!disposition) return null;
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return match ? match[1] : null;
}

export default function HomePage() {
  const heroRef = useRef<HTMLElement | null>(null);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectForm, setProjectForm] = useState({ id: "", rootUrl: "", sitemapUrl: "" });
  const [ingestForm, setIngestForm] = useState({ rootUrl: "", sitemapUrl: "", urls: "" });
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [status, setStatus] = useState<StatusState>(initialStatus);
  const [ingestMessage, setIngestMessage] = useState<string>("");
  const [clusterMessage, setClusterMessage] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [vectorIndex, setVectorIndex] = useState(0);
  const [vectorDirection, setVectorDirection] = useState<"horizontal" | "vertical">("horizontal");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  function pushLog(message: string) {
    setLogs((prev) => [message, ...prev].slice(0, 12));
  }

  const refreshProjects = useCallback(async () => {
    setStatus((prev) => ({ ...prev, projects: true }));
    try {
      const res = await fetch("/api/projects");
      const json = await res.json();
      if (json.ok) {
        setProjects(json.projects);
        const fallback = json.projects[0];
        let selectionChanged = false;
        setSelectedProjectId((prev) => {
          if (prev) return prev;
          selectionChanged = Boolean(fallback?.id);
          return fallback?.id ?? "";
        });
        if (selectionChanged && fallback) {
          setIngestForm((prev) => ({
            ...prev,
            rootUrl: fallback.rootUrl,
            sitemapUrl: fallback.sitemapUrl ?? ""
          }));
        }
      }
    } finally {
      setStatus((prev) => ({ ...prev, projects: false }));
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    const heroNode = heroRef.current;
    if (!heroNode) return;

    const setDefaultPosition = () => {
      const rect = heroNode.getBoundingClientRect();
      heroNode.style.setProperty("--cursor-x", `${rect.width / 2}px`);
      heroNode.style.setProperty("--cursor-y", `${rect.height / 2}px`);
    };

    setDefaultPosition();
    heroNode.style.setProperty("--lens-opacity", "0.3");

    const handlePointerMove = (event: PointerEvent) => {
      const rect = heroNode.getBoundingClientRect();
      heroNode.style.setProperty("--cursor-x", `${event.clientX - rect.left}px`);
      heroNode.style.setProperty("--cursor-y", `${event.clientY - rect.top}px`);
      heroNode.style.setProperty("--lens-opacity", "0.85");
    };

    const handlePointerLeave = () => {
      heroNode.style.setProperty("--lens-opacity", "0.25");
      setDefaultPosition();
    };

    heroNode.addEventListener("pointermove", handlePointerMove);
    heroNode.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("resize", setDefaultPosition);

    return () => {
      heroNode.removeEventListener("pointermove", handlePointerMove);
      heroNode.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("resize", setDefaultPosition);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setVectorIndex((prev) => {
        const next = (prev + 1) % vectorPhrases.length;
        if (next === 0) {
          setVectorDirection("vertical");
        } else {
          setVectorDirection(Math.random() > 0.7 ? "vertical" : "horizontal");
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const activeVectorPhrase = vectorPhrases[vectorIndex];
  const vectorPhraseKey = `${vectorIndex}-${vectorDirection}`;

  async function handleCreateProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!projectForm.id || !projectForm.rootUrl) return;
    const payload = {
      id: projectForm.id.trim(),
      rootUrl: projectForm.rootUrl.trim(),
      sitemapUrl: projectForm.sitemapUrl.trim() || undefined
    };
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      pushLog(`Created project ${payload.id}`);
      setProjectForm({ id: "", rootUrl: "", sitemapUrl: "" });
      await refreshProjects();
      setSelectedProjectId(payload.id);
      setIngestForm({
        rootUrl: payload.rootUrl,
        sitemapUrl: payload.sitemapUrl ?? "",
        urls: ""
      });
    } else {
      const json = await res.json();
      pushLog(json.error ?? "Unable to create project");
    }
  }

  function handleSelectProject(id: string) {
    setSelectedProjectId(id);
    const project = projects.find((item) => item.id === id);
    if (project) {
      setIngestForm((prev) => ({
        ...prev,
        rootUrl: project.rootUrl,
        sitemapUrl: project.sitemapUrl ?? ""
      }));
    }
  }

  async function handleIngest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedProjectId) return;
    setStatus((prev) => ({ ...prev, ingest: true }));
    setIngestMessage("Working…");
    const urls = ingestForm.urls
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          rootUrl: ingestForm.rootUrl || selectedProject?.rootUrl,
          sitemapUrl: ingestForm.sitemapUrl || selectedProject?.sitemapUrl,
          urls
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setIngestMessage(json.error ?? "Ingestion failed");
        pushLog(`Ingestion failed: ${json.error ?? res.statusText}`);
      } else {
        setIngestMessage(
          `Embedded ${json.sectionsEmbedded} sections across ${json.pagesIngested} pages`
        );
        pushLog(`Ingested ${json.pagesIngested} pages for ${selectedProjectId}`);
      }
    } catch (error) {
      setIngestMessage((error as Error).message);
    } finally {
      setStatus((prev) => ({ ...prev, ingest: false }));
    }
  }

  async function handleCluster(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedProjectId) return;
    setStatus((prev) => ({ ...prev, clusters: true }));
    setClusterMessage("Building clusters…");
    try {
      const res = await fetch("/api/clusters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId })
      });
      const json = await res.json();
      if (!res.ok) {
        setClusterMessage(json.error ?? "Unable to build clusters");
        pushLog(`Cluster build failed: ${json.error ?? res.statusText}`);
      } else {
        setClusters(json.clusters ?? []);
        setClusterMessage(`Generated ${json.clusters?.length ?? 0} clusters`);
        pushLog(`Refreshed clusters for ${selectedProjectId}`);
      }
    } catch (error) {
      setClusterMessage((error as Error).message);
    } finally {
      setStatus((prev) => ({ ...prev, clusters: false }));
    }
  }

  async function handleDownload(
    endpoint: string,
    filenameFallback: string,
    bodyOverrides?: Record<string, unknown>
  ) {
    if (!selectedProjectId) return;
    setStatus((prev) => ({ ...prev, download: true }));
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          ...bodyOverrides
        })
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        pushLog(json.error ?? `Download failed: ${res.statusText}`);
        return;
      }
      const blob = await res.blob();
      const suggested = getFilenameFromDisposition(res.headers.get("Content-Disposition"));
      const fileUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = fileUrl;
      anchor.download = suggested ?? `${selectedProjectId}-${filenameFallback}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(fileUrl);
      pushLog(`Downloaded ${filenameFallback}`);
    } finally {
      setStatus((prev) => ({ ...prev, download: false }));
    }
  }

  const clusterLang = clusters[0]?.lang;

  return (
    <main className="app-shell">
      <div className="content-wrapper">
        <section className="silver-hero" ref={heroRef}>
          <div className="hero-logo-clear" aria-hidden="true" />
          <div className="hero-lens" aria-hidden="true" />
          <div className="hero-outline" aria-hidden="true" />
          <div className="hero-content">
            <div className="hero-header">
              <div className="hero-heading">
                <p className="hero-subline">Answer Engine Ops</p>
                <h1>AEO Guru</h1>
                <div className="hero-intro-copy">
                  <div className="vector-scroller" aria-live="polite">
                    <span className="vector-scroller-label">Vector enrichment</span>
                    <div className={`vector-window ${vectorDirection}`}>
                      <span key={vectorPhraseKey} className="vector-token">
                        {activeVectorPhrase}
                      </span>
                    </div>
                  </div>
                  <p className="hero-description">
                    AEO Guru orchestrates crawls, embeddings, clustering, and schema so your site is optimized for
                    AI-first search experiences—pushing beyond classic SEO playbooks. Build enriched payloads,
                    intent-aware clusters, and JSON-LD artifacts that help Gemini, Bing Copilot, and Google Overviews
                    cite your answers when people ask real questions.
                  </p>
                </div>
              </div>
              <div className="hero-aside">
                <div className="hero-tech-panel">
                  <p className="hero-tech-panel-label">Technology by</p>
                  <div className="hero-tech-grid">
                    {heroStack.map((item) => (
                      <div className="hero-tech-item" key={item.label}>
                        <div className="hero-tech-icon" aria-hidden="true">
                          {item.icon}
                        </div>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="hero-status-stack">
                  <div className="hero-status-card">
                    <p>Projects</p>
                    <strong>{projects.length}</strong>
                  </div>
                  <div className="hero-status-card">
                    <p>Clusters</p>
                    <strong>{clusters.length}</strong>
                  </div>
                  <div className="hero-status-card">
                    <p>Last activity</p>
                    <strong>{logs[0] ?? "Awaiting activity"}</strong>
                  </div>
                </div>
                <div className="hero-status-pills">
                  <span className={`status-pill ${status.projects ? "active" : ""}`}>
                    Projects {status.projects ? "refreshing" : "synced"}
                  </span>
                  <span className={`status-pill ${status.ingest ? "active" : ""}`}>
                    Ingestion {status.ingest ? "running" : "idle"}
                  </span>
                  <span className={`status-pill ${status.clusters ? "active" : ""}`}>
                    Clusters {status.clusters ? "building" : "ready"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel-grid">
          <article className="panel-card wide-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Project registry</p>
                <h2>Choose or create a workspace</h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={refreshProjects}
                disabled={status.projects}
              >
                {status.projects ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            <div className="form-grid">
              <form className="stacked-form" onSubmit={handleCreateProject}>
                <label className="field-label">
                  Project ID
                  <input
                    className="text-input"
                    value={projectForm.id}
                    onChange={(e) => setProjectForm((prev) => ({ ...prev, id: e.target.value }))}
                    required
                  />
                </label>
                <label className="field-label">
                  Root URL
                  <input
                    className="text-input"
                    value={projectForm.rootUrl}
                    onChange={(e) => setProjectForm((prev) => ({ ...prev, rootUrl: e.target.value }))}
                    required
                  />
                </label>
                <label className="field-label">
                  Sitemap URL (optional)
                  <input
                    className="text-input"
                    value={projectForm.sitemapUrl}
                    onChange={(e) => setProjectForm((prev) => ({ ...prev, sitemapUrl: e.target.value }))}
                    placeholder="https://example.com/sitemap.xml"
                  />
                </label>
                <button type="submit" className="primary-button">
                  Save project
                </button>
              </form>
              <div className="project-list-card">
                <p className="muted">Active projects</p>
                {status.projects ? (
                  <p className="muted">Loading projects…</p>
                ) : (
                  <ul className="project-list">
                    {projects.map((project) => (
                      <li
                        key={project.id}
                        className={`project-item ${selectedProjectId === project.id ? "selected" : ""}`}
                        onClick={() => handleSelectProject(project.id)}
                      >
                        <div>
                          <strong>{project.id}</strong>
                          <span>{project.rootUrl}</span>
                        </div>
                        <time>{formatDate(project.createdAt)}</time>
                      </li>
                    ))}
                    {projects.length === 0 && <li className="project-item muted">No projects yet.</li>}
                  </ul>
                )}
              </div>
            </div>
          </article>

          <article className="panel-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Ingestion</p>
                <h2>Embed crawl output</h2>
              </div>
              {selectedProject && <span className="pill">{selectedProject.id}</span>}
            </div>
            {selectedProject ? (
              <form className="stacked-form" onSubmit={handleIngest}>
                <label className="field-label">
                  Root URL
                  <input
                    className="text-input"
                    value={ingestForm.rootUrl}
                    onChange={(e) => setIngestForm((prev) => ({ ...prev, rootUrl: e.target.value }))}
                    required
                  />
                </label>
                <label className="field-label">
                  Sitemap URL
                  <input
                    className="text-input"
                    value={ingestForm.sitemapUrl}
                    onChange={(e) => setIngestForm((prev) => ({ ...prev, sitemapUrl: e.target.value }))}
                  />
                </label>
                <label className="field-label">
                  Additional URLs (one per line)
                  <textarea
                    className="text-area"
                    value={ingestForm.urls}
                    onChange={(e) => setIngestForm((prev) => ({ ...prev, urls: e.target.value }))}
                    placeholder="https://example.com/about\nhttps://example.com/blog/post"
                  />
                </label>
                <button type="submit" className="primary-button" disabled={status.ingest}>
                  {status.ingest ? "Embedding…" : "Ingest & Embed"}
                </button>
                {ingestMessage && <p className="muted">{ingestMessage}</p>}
              </form>
            ) : (
              <p className="muted">Select a project to unlock ingestion.</p>
            )}
          </article>

          <article className="panel-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Clustering</p>
                <h2>Semantic core + exports</h2>
              </div>
              <span className="pill">{clusters.length} clusters</span>
            </div>
            {selectedProject ? (
              <>
                <form className="stacked-form" onSubmit={handleCluster}>
                  <p className="muted">
                    Group embeddings into topic clusters, label intents, and spin up an answer graph of canonical
                    questions.
                  </p>
                  <button type="submit" className="primary-button" disabled={status.clusters}>
                    {status.clusters ? "Analyzing…" : "Build clusters"}
                  </button>
                  {clusterMessage && <p className="muted">{clusterMessage}</p>}
                </form>
                <div className="download-grid">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={status.download || clusters.length === 0}
                    onClick={() =>
                      handleDownload("/api/exports/semantic-core", "semantic-core.yaml", { lang: clusterLang })
                    }
                  >
                    Semantic core YAML
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={status.download || clusters.length === 0}
                    onClick={() => handleDownload("/api/exports/jsonld", "jsonld.json", { lang: clusterLang })}
                  >
                    JSON-LD bundle
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={status.download || clusters.length === 0}
                    onClick={() =>
                      handleDownload("/api/exports/robots", "robots.txt", {
                        rootUrl: selectedProject?.rootUrl,
                        lang: clusterLang
                      })
                    }
                  >
                    robots.txt
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Select a project to build clusters and exports.</p>
            )}
          </article>

          <article className="panel-card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Activity</p>
                <h2>Latest log entries</h2>
              </div>
              <span className="pill">{logs.length} events</span>
            </div>
            <ul className="log-list">
              {logs.map((entry, idx) => (
                <li key={`${entry}-${idx}`}>{entry}</li>
              ))}
              {logs.length === 0 && <li className="muted">No activity yet.</li>}
            </ul>
          </article>
        </section>

        {clusters.length > 0 && (
          <section className="cluster-section">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Topic clusters</p>
                <h2>Answer graph overview</h2>
              </div>
              <span className="pill">{clusters.length} total</span>
            </div>
            <div className="cluster-grid">
              {clusters.map((cluster) => (
                <article key={cluster.id} className="cluster-card">
                  <header>
                    <div>
                      <p className="eyebrow">{cluster.metadata.intent}</p>
                      <h3>{cluster.metadata.label}</h3>
                    </div>
                    <span className="pill">Score {cluster.opportunityScore ?? "–"}</span>
                  </header>
                  <p className="muted">{cluster.metadata.summary}</p>
                  <dl>
                    <div>
                      <dt>Primary URL</dt>
                      <dd>{cluster.primaryUrl ?? "Unknown"}</dd>
                    </div>
                    <div>
                      <dt>Primary keyword</dt>
                      <dd>{cluster.metadata.primaryKeyword}</dd>
                    </div>
                    <div>
                      <dt>Recommended schema</dt>
                      <dd>
                        {cluster.metadata.recommendedSchemas.map((schema) => (
                          <span key={schema} className="schema-chip">
                            {schema}
                          </span>
                        ))}
                      </dd>
                    </div>
                  </dl>
                  <div className="question-list">
                    <p>Canonical questions</p>
                    <div>
                      {cluster.questions.slice(0, 4).map((question) => (
                        <span key={question}>{question}</span>
                      ))}
                    </div>
                  </div>
                  <div className="gap-list">
                    <p>Content gaps</p>
                    <ul>
                      {cluster.metadata.contentGaps.map((gap) => (
                        <li key={gap}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
