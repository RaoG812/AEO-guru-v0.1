"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { load as parseYaml } from "js-yaml";
import type { JSX, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { FiFileText, FiShare2, FiUpload } from "react-icons/fi";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { StoredClusterNote } from "@/lib/projectCoreStore";

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

type ClusterNoteDraft = {
  labelOverride: string;
  note: string;
  keywordsDraft: string;
};

type SemanticCoreWorkspace = {
  semanticCoreYaml: string;
  manualNotes: string;
  clusterNotes: Record<string, ClusterNoteDraft>;
  updatedAt: string | null;
};

type AssociatedRecord = {
  url: string;
  title?: string | null;
  clusterLabel?: string | null;
  intent?: string | null;
  primaryKeyword?: string | null;
  lang?: string | null;
  recommendedSchemas: string[];
  excerpt: string;
};

type VectorDistribution = { label: string; count: number };

type VectorSampleSummary = {
  id: string;
  url: string | null;
  title: string | null;
  intent: string | null;
  primaryKeyword: string | null;
  lang: string | null;
  magnitude: number | null;
  preview: number[];
};

type ProjectVectorSummary = {
  totalPoints: number;
  vectorDimension: number | null;
  avgMagnitude: number | null;
  maxMagnitude: number | null;
  languages: VectorDistribution[];
  intents: VectorDistribution[];
  sources: VectorDistribution[];
  samples: VectorSampleSummary[];
};

type SemanticDigestTopic = {
  topic: string;
  intent: string | null;
  queries: string[];
  actions: string[];
};

type SemanticDigestPage = {
  title: string | null;
  url: string | null;
  intent: string | null;
  schema: string[];
  supporting: string[];
};

type SemanticDigest = {
  label: string;
  summary: string | null;
  focusTopics: SemanticDigestTopic[];
  keyPages: SemanticDigestPage[];
  error?: string | null;
};

type StatusState = {
  ingest: boolean;
  clusters: boolean;
  download: boolean;
  projects: boolean;
};

type WorkflowKey = "ingest" | "cluster" | "outputs";

type WorkflowTile = {
  key: WorkflowKey;
  label: string;
  title: string;
  meta: string;
  icon: JSX.Element;
  isComplete: boolean;
};

type DockButton = {
  label: string;
  icon: JSX.Element;
  action: () => void;
  disabled?: boolean;
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

const INTENT_COLOR_MAP: Record<string, string> = {
  informational: "#7C8CFF",
  transactional: "#FF9F68",
  navigational: "#4CD4A9",
  local: "#F6C945",
  mixed: "#E76BF3"
};

const POPULAR_USER_AGENTS = [
  "Googlebot",
  "Googlebot-Image",
  "Bingbot",
  "Bingbot-Mobile",
  "Slurp",
  "DuckDuckBot",
  "Baiduspider",
  "YandexBot"
] as const;

type PopularAgent = (typeof POPULAR_USER_AGENTS)[number];

type GeoIntentFocus = "local" | "all";

type ExportCockpitState = {
  semanticCore: {
    limit: string;
    lang: string;
  };
  jsonld: {
    limit: string;
    lang: string;
  };
  robots: {
    lang: string;
    rootUrl: string;
    crawlDelay: string;
    sitemapUrls: string;
    additionalAgents: string;
    agents: Record<PopularAgent, boolean>;
    forbiddenPaths: string;
  };
  geo: {
    lang: string;
    limit: string;
    intentFocus: GeoIntentFocus;
    fallbackLocation: string;
  };
};

type ExportArtifactKey = "semantic" | "jsonld" | "robots" | "geo";

const emptyWorkspace: SemanticCoreWorkspace = {
  semanticCoreYaml: "",
  manualNotes: "",
  clusterNotes: {},
  updatedAt: null
};

type SemanticSegment = { label: string; body: string };

function splitSemanticSegments(raw: string): SemanticSegment[] {
  const segments: SemanticSegment[] = [];
  let label = "Base semantic core";
  let cursor = 0;
  const markerRegex = /^#\s*Enlarge run[^\n]*$/gim;
  let match: RegExpExecArray | null;
  while ((match = markerRegex.exec(raw))) {
    const chunk = raw.slice(cursor, match.index).trim();
    if (chunk) {
      segments.push({ label, body: chunk });
    }
    label = match[0].replace(/^#\s*/, "").trim() || "Enlarge run";
    cursor = match.index + match[0].length;
    while (raw[cursor] === "\n" || raw[cursor] === "\r") {
      cursor += 1;
    }
  }
  const tail = raw.slice(cursor).trim();
  if (tail) {
    segments.push({ label, body: tail });
  }
  return segments;
}

function coerceString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeStrings(value: unknown, limit?: number): string[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is string => item.length > 0);
  if (typeof limit === "number") {
    return normalized.slice(0, limit);
  }
  return normalized;
}

function buildSemanticDigestsFromYaml(raw: string | null | undefined): SemanticDigest[] {
  const yaml = raw?.trim();
  if (!yaml) return [];
  const segments = splitSemanticSegments(yaml);
  return segments.map((segment) => {
    try {
      const parsed = parseYaml(segment.body);
      if (!parsed || typeof parsed !== "object") {
        return {
          label: segment.label,
          summary: null,
          focusTopics: [],
          keyPages: [],
          error: "Segment is missing semantic core fields"
        };
      }
      const record = parsed as Record<string, any>;
      const summary = coerceString(record.executiveSummary);
      const focusTopics = Array.isArray(record.focusTopics)
        ? record.focusTopics
            .map((item: any) => {
              const topic = coerceString(item?.topic);
              if (!topic) return null;
              return {
                topic,
                intent: coerceString(item?.audienceIntent),
                queries: normalizeStrings(item?.supportingQueries, 3),
                actions: normalizeStrings(item?.recommendedActions, 3)
              };
            })
            .filter((item): item is SemanticDigestTopic => Boolean(item))
            .slice(0, 3)
        : [];
      const keyPages = Array.isArray(record.keyPages)
        ? record.keyPages
            .map((item: any) => {
              const url = coerceString(item?.url);
              const title = coerceString(item?.title);
              if (!url && !title) return null;
              return {
                title,
                url,
                intent: coerceString(item?.primaryIntent),
                schema: normalizeStrings(item?.schemaOpportunities, 3),
                supporting: normalizeStrings(item?.supportingContent, 3)
              };
            })
            .filter((item): item is SemanticDigestPage => Boolean(item))
            .slice(0, 3)
        : [];
      return {
        label: segment.label,
        summary,
        focusTopics,
        keyPages,
        error: null
      };
    } catch (error) {
      console.warn("Unable to parse semantic core YAML", error);
      return {
        label: segment.label,
        summary: null,
        focusTopics: [],
        keyPages: [],
        error: "Invalid YAML block"
      };
    }
  });
}

function formatMagnitude(value: number | null): string {
  return typeof value === "number" ? value.toFixed(2) : "–";
}

function buildDefaultAgentSelection(): Record<PopularAgent, boolean> {
  return POPULAR_USER_AGENTS.reduce(
    (acc, agent) => {
      acc[agent] = true;
      return acc;
    },
    {} as Record<PopularAgent, boolean>
  );
}

function parseNumberInRange(value: string, min: number, max: number): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return Math.min(Math.max(parsed, min), max);
}

function splitMultilineList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitKeywordDraft(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeForbiddenPath(entry: string): string | null {
  if (!entry) return null;
  const trimmed = entry.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return url.pathname || "/";
    } catch {
      return trimmed;
    }
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function collectAgents(
  agentState: Record<PopularAgent, boolean>,
  additionalAgents: string
): string[] {
  const selectedAgents = Object.entries(agentState)
    .filter(([, enabled]) => enabled)
    .map(([agent]) => agent);
  const customAgents = splitMultilineList(additionalAgents);
  return Array.from(new Set([...selectedAgents, ...customAgents]));
}

type ExportAttributesMap = Record<
  ExportArtifactKey,
  { title: string; attributes: Array<{ label: string; value: string }> }
>;

const ARTIFACT_TITLES: Record<ExportArtifactKey, string> = {
  semantic: "Semantic core YAML",
  jsonld: "JSON-LD bundle",
  robots: "robots.txt",
  geo: "GEO improvements"
};

const HERO_LENS_BASE_RADIUS = 140;
const HERO_LENS_BLINK_RADIUS = 520;
const HERO_LENS_RESET_DELAY = 450;

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
  const lensBlinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRobotsProjectRef = useRef<string | null>(null);
  const workspaceSectionRef = useRef<HTMLElement | null>(null);
  const workspaceScrollPendingRef = useRef(false);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectForm, setProjectForm] = useState({ id: "", rootUrl: "", sitemapUrl: "" });
  const [ingestForm, setIngestForm] = useState({ rootUrl: "", sitemapUrl: "", urls: "" });
  const [clusters, setClusters] = useState<ClusterResponse[]>([]);
  const [coreWorkspace, setCoreWorkspace] = useState<SemanticCoreWorkspace>(emptyWorkspace);
  const [coreLoading, setCoreLoading] = useState(false);
  const [coreSaving, setCoreSaving] = useState(false);
  const [coreMessage, setCoreMessage] = useState<string | null>(null);
  const [coreEnlarging, setCoreEnlarging] = useState(false);
  const [associatedRecords, setAssociatedRecords] = useState<AssociatedRecord[]>([]);
  const [vectorSummary, setVectorSummary] = useState<ProjectVectorSummary | null>(null);
  const [vectorSummaryLoading, setVectorSummaryLoading] = useState(false);
  const [vectorSummaryError, setVectorSummaryError] = useState<string | null>(null);
  const [vectorSummaryRefreshKey, setVectorSummaryRefreshKey] = useState(0);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [vectorSourcesOpen, setVectorSourcesOpen] = useState(false);
  const [vectorSamplesExpanded, setVectorSamplesExpanded] = useState(false);
  const [status, setStatus] = useState<StatusState>(initialStatus);
  const [ingestMessage, setIngestMessage] = useState<string>("");
  const [clusterMessage, setClusterMessage] = useState<string>("");
  const [clusterInventory, setClusterInventory] = useState<{ checking: boolean; count: number }>(
    {
      checking: false,
      count: 0
    }
  );
  const [logs, setLogs] = useState<string[]>([]);
  const [vectorIndex, setVectorIndex] = useState(0);
  const [vectorDirection, setVectorDirection] = useState<"horizontal" | "vertical">("horizontal");
  const [heroInView, setHeroInView] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authMode, setAuthMode] = useState<"signIn" | "signUp">("signIn");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowKey | null>(null);
  const [exportCockpit, setExportCockpit] = useState<ExportCockpitState>(() => ({
    semanticCore: { limit: "12", lang: "" },
    jsonld: { limit: "4", lang: "" },
    robots: {
      lang: "",
      rootUrl: "",
      crawlDelay: "5",
      sitemapUrls: "",
      additionalAgents: "",
      agents: buildDefaultAgentSelection(),
      forbiddenPaths: ""
    },
    geo: {
      lang: "",
      limit: "5",
      intentFocus: "local",
      fallbackLocation: "Local market"
    }
  }));
  const [activeExportKey, setActiveExportKey] = useState<ExportArtifactKey | null>(null);
  const [activeCockpitCard, setActiveCockpitCard] = useState<ExportArtifactKey | null>(null);
  const scrollWorkspaceIntoView = useCallback(() => {
    const workspaceNode = workspaceSectionRef.current;
    if (!workspaceNode) {
      return;
    }

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        workspaceNode.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    } else {
      workspaceNode.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);
  const [exportPreviews, setExportPreviews] = useState<
    Partial<Record<ExportArtifactKey, string>>
  >({});
  const [insightsModalOpen, setInsightsModalOpen] = useState(false);
  const [insightsUnlocked, setInsightsUnlocked] = useState(false);
  const [insightsRequested, setInsightsRequested] = useState(false);
  const [insightsMessage, setInsightsMessage] = useState<string | null>(null);
  const [insightsFullscreen, setInsightsFullscreen] = useState(false);
  const [manualSummaryExpanded, setManualSummaryExpanded] = useState(true);
  const [semanticYamlExpanded, setSemanticYamlExpanded] = useState(true);
  const manualNotesFieldId = useId();
  const semanticYamlFieldId = useId();
  const projectPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [projectPulseId, setProjectPulseId] = useState<string | null>(null);

  const supabase = useMemo<SupabaseClient | null>(() => {
    try {
      return getSupabaseBrowserClient();
    } catch (error) {
      console.error("Unable to initialize Supabase client", error);
      return null;
    }
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const accessToken = session?.access_token ?? null;

  useEffect(() => {
    if (!selectedProjectId) {
      lastRobotsProjectRef.current = null;
      setExportCockpit((prev) => ({
        ...prev,
        robots: { ...prev.robots, rootUrl: "" }
      }));
      return;
    }

    if (lastRobotsProjectRef.current === selectedProjectId) {
      return;
    }

    lastRobotsProjectRef.current = selectedProjectId;
    setExportCockpit((prev) => ({
      ...prev,
      robots: { ...prev.robots, rootUrl: selectedProject?.rootUrl ?? "" }
    }));
  }, [selectedProjectId, selectedProject?.rootUrl]);

  useEffect(() => {
    if (!supabase) return;

    let isActive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isActive) return;
      setSession(data.session ?? null);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!clusters.length) {
      setActiveClusterId(null);
      return;
    }
    setActiveClusterId((prev) => {
      if (prev && clusters.some((cluster) => cluster.id === prev)) {
        return prev;
      }
      return clusters[0]?.id ?? null;
    });
  }, [clusters]);

  useEffect(() => () => {
    if (projectPulseTimeoutRef.current) {
      clearTimeout(projectPulseTimeoutRef.current);
      projectPulseTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!selectedProjectId) {
      setVectorSummary(null);
      setVectorSummaryError(null);
      setVectorSummaryLoading(false);
      return;
    }
    setVectorSummaryLoading(true);
    setVectorSummaryError(null);
    (async () => {
      try {
        const res = await fetch(`/api/projects/${selectedProjectId}/vectors`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error ?? "Unable to inspect vectors");
        }
        setVectorSummary(json.summary ?? null);
      } catch (error) {
        if (cancelled) return;
        setVectorSummary(null);
        setVectorSummaryError((error as Error).message);
      } finally {
        if (!cancelled) {
          setVectorSummaryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, vectorSummaryRefreshKey]);

  useEffect(() => {
    if (coreLoading || !workspaceScrollPendingRef.current) {
      return;
    }

    workspaceScrollPendingRef.current = false;
    scrollWorkspaceIntoView();
  }, [coreLoading, scrollWorkspaceIntoView]);

  useEffect(() => {
    if (!selectedProjectId || !accessToken) {
      setCoreWorkspace(emptyWorkspace);
      setCoreMessage(null);
      return;
    }

    let cancelled = false;
    setCoreLoading(true);
    setCoreMessage(null);

    fetch(`/api/projects/${selectedProjectId}/core`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error ?? "Unable to load workspace");
        }
        if (cancelled) return;
        const nextWorkspace: SemanticCoreWorkspace = {
          semanticCoreYaml: json.core?.semanticCoreYaml ?? "",
          manualNotes: json.core?.manualNotes ?? "",
          clusterNotes: Object.entries(json.core?.clusterNotes ?? {}).reduce(
            (acc, [clusterId, note]: [string, StoredClusterNote]) => {
              acc[clusterId] = {
                labelOverride: note?.labelOverride ?? "",
                note: note?.note ?? "",
                keywordsDraft: (note?.keywords ?? []).join(", ")
              };
              return acc;
            },
            {} as Record<string, ClusterNoteDraft>
          ),
          updatedAt: json.core?.updatedAt ?? null
        };
        setCoreWorkspace(nextWorkspace);
      })
      .catch((error) => {
        if (!cancelled) {
          setCoreMessage((error as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCoreLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, accessToken]);

  useEffect(() => {
    setAssociatedRecords([]);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }
    const project = projects.find((item) => item.id === selectedProjectId);
    if (project) {
      setProjectForm({
        id: project.id,
        rootUrl: project.rootUrl,
        sitemapUrl: project.sitemapUrl ?? ""
      });
    }
  }, [projects, selectedProjectId]);
 
  useEffect(() => {    
    setInsightsUnlocked(false);
    setInsightsModalOpen(false);
    setInsightsMessage(null);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !accessToken) {
      setClusterInventory({ checking: false, count: 0 });
      return;
    }

    let cancelled = false;
    setClusterInventory({ checking: true, count: 0 });

    fetch(`/api/projects/${selectedProjectId}/clusters/status`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error ?? "Unable to check cluster status");
        }
        if (!cancelled) {
          setClusterInventory({ checking: false, count: json.clusterCount ?? 0 });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClusterInventory({ checking: false, count: 0 });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, accessToken]);

  function pushLog(message: string) {
    setLogs((prev) => [message, ...prev].slice(0, 12));
  }

  function updateClusterNote(clusterId: string, patch: Partial<ClusterNoteDraft>) {
    setCoreWorkspace((prev) => ({
      ...prev,
      clusterNotes: {
        ...prev.clusterNotes,
        [clusterId]: {
          labelOverride: prev.clusterNotes[clusterId]?.labelOverride ?? "",
          note: prev.clusterNotes[clusterId]?.note ?? "",
          keywordsDraft: prev.clusterNotes[clusterId]?.keywordsDraft ?? "",
          ...patch
        }
      }
    }));
  }

  const refreshProjects = useCallback(async () => {
    if (!accessToken) {
      setProjects([]);
      setSelectedProjectId("");
      return;
    }

    setStatus((prev) => ({ ...prev, projects: true }));
    try {
      const res = await fetch("/api/projects", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const json = await res.json();
      if (res.ok && json.ok) {
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
      } else if (res.status === 401) {
        setProjects([]);
        setSelectedProjectId("");
      }
    } finally {
      setStatus((prev) => ({ ...prev, projects: false }));
    }
  }, [accessToken]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    const heroNode = heroRef.current;
    if (!heroNode) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setHeroInView(entry.isIntersecting);
      },
      { threshold: 0.25 }
    );

    observer.observe(heroNode);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const heroNode = heroRef.current;
    if (!heroNode || !heroInView) return;

    const setDefaultPosition = () => {
      const rect = heroNode.getBoundingClientRect();
      heroNode.style.setProperty("--cursor-x", `${rect.width / 2}px`);
      heroNode.style.setProperty("--cursor-y", `${rect.height / 2}px`);
    };

    const resetLensRadius = () => {
      heroNode.style.setProperty("--lens-radius", `${HERO_LENS_BASE_RADIUS}px`);
    };

    const clearBlinkTimeout = () => {
      if (lensBlinkTimeoutRef.current) {
        clearTimeout(lensBlinkTimeoutRef.current);
        lensBlinkTimeoutRef.current = null;
      }
    };

    setDefaultPosition();
    resetLensRadius();
    heroNode.style.setProperty("--lens-opacity", "0.3");
    heroNode.style.setProperty("--reveal-opacity", "0");

    const handlePointerMove = (event: PointerEvent) => {
      clearBlinkTimeout();
      const rect = heroNode.getBoundingClientRect();
      heroNode.style.setProperty("--cursor-x", `${event.clientX - rect.left}px`);
      heroNode.style.setProperty("--cursor-y", `${event.clientY - rect.top}px`);
      heroNode.style.setProperty("--lens-opacity", "0.85");
      heroNode.style.setProperty("--reveal-opacity", "1");
      resetLensRadius();
    };

    const handlePointerLeave = () => {
      clearBlinkTimeout();
      heroNode.style.setProperty("--lens-opacity", "0.25");
      heroNode.style.setProperty("--reveal-opacity", "0");
      setDefaultPosition();
      heroNode.style.setProperty("--lens-radius", `${HERO_LENS_BLINK_RADIUS}px`);

      lensBlinkTimeoutRef.current = setTimeout(() => {
        resetLensRadius();
      }, HERO_LENS_RESET_DELAY);
    };

    heroNode.addEventListener("pointermove", handlePointerMove);
    heroNode.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("resize", setDefaultPosition);

    return () => {
      clearBlinkTimeout();
      heroNode.removeEventListener("pointermove", handlePointerMove);
      heroNode.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("resize", setDefaultPosition);
    };
  }, [heroInView]);

  useEffect(() => {
    if (heroInView) return;
    const heroNode = heroRef.current;
    if (!heroNode) return;
    heroNode.style.setProperty("--lens-opacity", "0.2");
    heroNode.style.setProperty("--reveal-opacity", "0");
  }, [heroInView]);

  useEffect(() => {
    if (!clusters.length) {
      setActiveExportKey(null);
    }
  }, [clusters.length]);

  useEffect(() => {
    if (!vectorSummary?.sources?.length) {
      setVectorSourcesOpen(false);
    }
  }, [vectorSummary]);

  useEffect(() => {
    setVectorSamplesExpanded(false);
  }, [vectorSummary?.totalPoints]);

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
  const userEmail = session?.user?.email ?? (session?.user?.user_metadata as { email?: string })?.email;
  const sourceVectorCount = useMemo(() => {
    if (!vectorSummary?.sources?.length) return 0;
    return vectorSummary.sources.reduce((sum, source) => sum + source.count, 0);
  }, [vectorSummary]);

  function openLoginModal() {
    setLoginModalOpen(true);
    setAuthError(null);
    setAuthMessage(null);
  }

  function closeLoginModal() {
    setLoginModalOpen(false);
    setAuthError(null);
    setAuthMessage(null);
  }

  function handleClusterDockAction() {
    if (typeof document === "undefined") return;
    const clusterSection = document.querySelector(".cluster-section");
    if (clusterSection) {
      clusterSection.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    document
      .querySelector(".workflow-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    handleTileActivate("cluster");
  }

  async function handleAuthSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) {
      setAuthError("Supabase client is not configured.");
      return;
    }
    const email = authForm.email.trim();
    const password = authForm.password.trim();
    if (!email || !password) {
      setAuthError("Email and password are required.");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      if (authMode === "signUp") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && data.session) {
          setAuthMessage("Account created. Redirecting…");
          closeLoginModal();
        } else {
          setAuthMessage("Check your email to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthMessage("Signed in successfully.");
        closeLoginModal();
      }
      setAuthForm({ email: "", password: "" });
    } catch (error) {
      setAuthError((error as Error).message ?? "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  function handleLogin() {
    if (session) {
      pushLog("Already signed in");
      return;
    }
    pushLog("Initiated login from dock");
    openLoginModal();
  }

  const openInsightsModal = useCallback(() => {
    if (!insightsUnlocked) return;
    setInsightsRequested(false);
    setInsightsMessage(null);
    setInsightsFullscreen(false);
    setInsightsModalOpen(true);
  }, [insightsUnlocked]);

  const closeInsightsModal = useCallback(() => {
    setInsightsRequested(false);
    setInsightsMessage(null);
    setInsightsFullscreen(false);
    setInsightsModalOpen(false);
  }, []);

  const toggleInsightsFullscreen = useCallback(() => {
    setInsightsFullscreen((prev) => !prev);
  }, []);

  const handleGenerateInsights = useCallback(() => {
    setInsightsRequested(true);
    if (!clusters.length) {
      setInsightsMessage("Run ingestion and clustering to unlock fresh insights.");
      return;
    }
    const sorted = [...clusters].sort(
      (a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0)
    );
    const primary = sorted[0];
    const supporting = sorted.slice(1, 3);
    const supportingLabels = supporting
      .map((cluster) => `${cluster.metadata.label} (${cluster.metadata.intent})`)
      .join(" and ");
    const geoCluster = sorted.find((cluster) => cluster.metadata.intent === "local");
    const improvement = primary.metadata.contentGaps[0] ?? "capture missing product proof";
    const summaryParts = [
      `Lead with ${primary.metadata.label} (${primary.metadata.intent}) and tighten how you ${improvement}.`
    ];
    if (supportingLabels) {
      summaryParts.push(`Also reinforce ${supportingLabels} to balance the answer graph.`);
    }
    if (geoCluster) {
      summaryParts.push(
        `GEO spotlight: tailor snippets for ${
          geoCluster.metadata.primaryKeyword || geoCluster.metadata.label
        } searchers so assistants can cite localized proof.`
      );
    }
    const narrative = summaryParts.join(" ");
    setInsightsMessage(narrative);
    pushLog("Prepared AEO/GEO insight preview");
  }, [clusters]);

  const dockButtons: DockButton[] = [
    {
      label: "Home",
      icon: (
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
          <path
            d="m4 11 8-7 8 7v8.5c0 .3-.2.5-.5.5H4.5c-.3 0-.5-.2-.5-.5z"
            fill="currentColor"
          />
        </svg>
      ),
      action: () => heroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    },
    {
      label: "Projects",
      icon: (
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
          <path
            d="M5 6h14c.6 0 1 .4 1 1v10c0 .6-.4 1-1 1H5c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1zm0 4h14M9 6v12"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      ),
      action: () =>
        document
          .querySelector(".project-controls")
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
    },
    {
      label: "Clusters",
      icon: (
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <circle cx="12" cy="12" r="2.4" fill="currentColor" />
        </svg>
      ),
      action: handleClusterDockAction
    },
    {
      label: "Login",
      icon: (
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
          <path
            d="M12 4h6c.6 0 1 .4 1 1v14c0 .6-.4 1-1 1h-6M8 8l-4 4 4 4m-4-4h11"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
      action: handleLogin
    },
    {
      label: "Insights",
      icon: (
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
          <path
            d="M12 3.5 13.6 9h5.4l-4.3 3.2 1.6 5.4L12 14.4 7.7 17.6l1.6-5.4L5 9h5.4z"
            fill="currentColor"
          />
        </svg>
      ),
      action: openInsightsModal,
      disabled: !insightsUnlocked
    }
  ];

  async function handleSaveProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!projectForm.id || !projectForm.rootUrl) return;
    if (!accessToken) {
      pushLog("Sign in to save a project first.");
      openLoginModal();
      return;
    }

    const trimmedId = projectForm.id.trim();
    const payload = {
      rootUrl: projectForm.rootUrl.trim(),
      sitemapUrl: projectForm.sitemapUrl.trim() || undefined
    };
    const projectExists = projects.some((project) => project.id === trimmedId);
    const endpoint = projectExists ? `/api/projects/${trimmedId}` : "/api/projects";
    const method = projectExists ? "PATCH" : "POST";
    const body = projectExists ? payload : { id: trimmedId, ...payload };

    const res = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok || json?.ok === false) {
      pushLog(json?.error ?? "Unable to save project");
      return;
    }

    pushLog(`${projectExists ? "Updated" : "Created"} project ${trimmedId}`);
    if (!projectExists) {
      setProjectForm({ id: "", rootUrl: "", sitemapUrl: "" });
    }
    await refreshProjects();
    setSelectedProjectId(trimmedId);
    setIngestForm((prev) => ({
      ...prev,
      rootUrl: payload.rootUrl,
      sitemapUrl: payload.sitemapUrl ?? "",
      ...(projectExists ? {} : { urls: "" })
    }));
  }

  function handleSelectProject(id: string) {
    if (projectPulseTimeoutRef.current) {
      clearTimeout(projectPulseTimeoutRef.current);
    }
    setProjectPulseId(id);
    projectPulseTimeoutRef.current = setTimeout(() => {
      setProjectPulseId((current) => (current === id ? null : current));
      projectPulseTimeoutRef.current = null;
    }, 650);
    const project = projects.find((item) => item.id === id);
    if (project) {
      setIngestForm((prev) => ({
        ...prev,
        rootUrl: project.rootUrl,
        sitemapUrl: project.sitemapUrl ?? ""
      }));
      setProjectForm({
        id: project.id,
        rootUrl: project.rootUrl,
        sitemapUrl: project.sitemapUrl ?? ""
      });
    }

    if (id === selectedProjectId) {
      scrollWorkspaceIntoView();
      return;
    }

    workspaceScrollPendingRef.current = true;
    if (accessToken) {
      setCoreLoading(true);
    } else {
      scrollWorkspaceIntoView();
      workspaceScrollPendingRef.current = false;
    }
    setSelectedProjectId(id);
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
        setVectorSummaryRefreshKey((prev) => prev + 1);
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
        setClusterInventory({ checking: false, count: json.clusters?.length ?? 0 });
        pushLog(`Refreshed clusters for ${selectedProjectId}`);
        const clusterCount = json.clusters?.length ?? 0;
        const ready = clusterCount > 0;
        setInsightsUnlocked(ready);
        setInsightsRequested(false);
        setInsightsMessage(null);
        if (ready) {
          setInsightsModalOpen(true);
        } else {
          setInsightsModalOpen(false);
        }
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
    bodyOverrides?: Record<string, unknown>,
    previewKey?: ExportArtifactKey
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
      const previewTextPromise = blob.text();
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
      if (previewKey) {
        const previewText = (await previewTextPromise).slice(0, 8000);
        setExportPreviews((prev) => ({ ...prev, [previewKey]: previewText }));
      }
    } finally {
      setStatus((prev) => ({ ...prev, download: false }));
    }
  }

  function triggerExport(
    key: ExportArtifactKey,
    endpoint: string,
    filenameFallback: string,
    bodyOverrides?: Record<string, unknown>
  ) {
    setActiveExportKey(key);
    void handleDownload(endpoint, filenameFallback, bodyOverrides, key);
  }

  function buildClusterNotePayload(notes: Record<string, ClusterNoteDraft>): Record<string, StoredClusterNote> {
    return Object.entries(notes).reduce((acc, [clusterId, note]) => {
      const normalizedKeywords = splitKeywordDraft(note.keywordsDraft ?? "");
      acc[clusterId] = {
        labelOverride: note.labelOverride?.trim() ? note.labelOverride.trim() : undefined,
        note: note.note?.trim() ? note.note.trim() : undefined,
        keywords: normalizedKeywords.length ? normalizedKeywords : undefined
      };
      return acc;
    }, {} as Record<string, StoredClusterNote>);
  }

  async function handleEnlargeCore() {
    if (!selectedProjectId || !accessToken) return;
    setCoreEnlarging(true);
    setCoreMessage(null);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/core/enlarge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          manualNotes: coreWorkspace.manualNotes?.trim() ? coreWorkspace.manualNotes : undefined,
          semanticCoreYaml: coreWorkspace.semanticCoreYaml?.trim()
            ? coreWorkspace.semanticCoreYaml
            : undefined
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Unable to enlarge core");
      }
      if (typeof json.semanticCoreYaml === "string" && json.semanticCoreYaml.trim()) {
        const timestamp = new Date().toLocaleString();
        setCoreWorkspace((prev) => {
          const trimmed = prev.semanticCoreYaml.trim();
          const appended = trimmed
            ? `${trimmed}\n\n# Enlarge run ${timestamp}\n${json.semanticCoreYaml}`
            : json.semanticCoreYaml;
          return { ...prev, semanticCoreYaml: appended };
        });
      }
      const normalizedRecords = Array.isArray(json.records)
        ? json.records
            .filter((record: any) => typeof record?.url === "string")
            .map((record: any) => ({
              url: record.url as string,
              title: typeof record?.title === "string" ? record.title : null,
              clusterLabel: typeof record?.clusterLabel === "string" ? record.clusterLabel : null,
              intent: typeof record?.intent === "string" ? record.intent : null,
              primaryKeyword:
                typeof record?.primaryKeyword === "string" ? record.primaryKeyword : null,
              lang: typeof record?.lang === "string" ? record.lang : null,
              recommendedSchemas: Array.isArray(record?.recommendedSchemas)
                ? record.recommendedSchemas.filter((item: unknown): item is string => typeof item === "string")
                : [],
              excerpt: typeof record?.excerpt === "string" ? record.excerpt : ""
            }))
        : [];
      setAssociatedRecords(normalizedRecords);
      setCoreMessage("Core enlarged using latest crawl insights.");
      pushLog(`Enlarged core for ${selectedProjectId}`);
    } catch (error) {
      setCoreMessage((error as Error).message);
    } finally {
      setCoreEnlarging(false);
    }
  }

  async function handleSaveWorkspace() {
    if (!selectedProjectId || !accessToken) return;
    setCoreSaving(true);
    setCoreMessage(null);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/core`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          semanticCoreYaml: coreWorkspace.semanticCoreYaml,
          manualNotes: coreWorkspace.manualNotes,
          clusterNotes: buildClusterNotePayload(coreWorkspace.clusterNotes)
        })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Unable to save workspace");
      }
      setCoreWorkspace((prev) => ({
        ...prev,
        updatedAt: json.core?.updatedAt ?? new Date().toISOString()
      }));
      setCoreMessage("Workspace saved");
      pushLog("Updated semantic core workspace");
    } catch (error) {
      setCoreMessage((error as Error).message);
    } finally {
      setCoreSaving(false);
    }
  }

  const clusterLang = clusters[0]?.lang;
  const hasExistingIngestion = (vectorSummary?.totalPoints ?? 0) > 0;
  const hasExistingClusters = clusterInventory.count > 0 || clusters.length > 0;

  const lastSavedLabel = coreWorkspace.updatedAt
    ? new Date(coreWorkspace.updatedAt).toLocaleString()
    : "Not saved yet";

  const activeCluster = activeClusterId
    ? clusters.find((cluster) => cluster.id === activeClusterId) ?? null
    : null;

  const activeClusterNote = activeCluster
    ? coreWorkspace.clusterNotes[activeCluster.id] ?? {
        labelOverride: "",
        note: "",
        keywordsDraft: ""
      }
    : null;

  const semanticCoreDigests = useMemo(
    () => buildSemanticDigestsFromYaml(coreWorkspace.semanticCoreYaml),
    [coreWorkspace.semanticCoreYaml]
  );

  const maxClusterSize = useMemo(() => {
    if (!clusters.length) return 1;
    return Math.max(...clusters.map((cluster) => cluster.size));
  }, [clusters]);

  const maxClusterScore = useMemo(() => {
    if (!clusters.length) return 1;
    return Math.max(...clusters.map((cluster) => cluster.opportunityScore ?? 0));
  }, [clusters]);

  const overallOptimizationScore = useMemo(() => {
    if (!clusters.length) return null;
    const baseScore =
      clusters.reduce((sum, cluster) => sum + (cluster.opportunityScore ?? 0), 0) /
      clusters.length;
    const geoClusters = clusters.filter((cluster) => cluster.metadata.intent === "local");
    const geoCoverage = geoClusters.length ? geoClusters.length / clusters.length : 0;
    const geoBonus = geoClusters.length ? Math.min(15, 6 + geoCoverage * 18) : 0;
    const combinedScore = Math.min(100, Math.round(baseScore + geoBonus));
    let summary: string;
    if (combinedScore >= 85) {
      summary = "Assistant-ready blend of answer depth and localized proof.";
    } else if (combinedScore >= 70) {
      summary = "Strong coverage—tighten supporting snippets to climb higher.";
    } else {
      summary = "Grow semantic clusters and cite local proof to lift authority.";
    }
    const geoNote = geoClusters.length
      ? `Local intent coverage ${Math.round(geoCoverage * 100)}%`
      : "Add localized proof to unlock GEO boost.";
    return {
      value: combinedScore,
      base: Math.round(baseScore),
      geoBonus: Math.round(geoBonus),
      summary,
      geoNote
    };
  }, [clusters]);

  const semanticCoreOverrides = useMemo(() => {
    const payload: Record<string, unknown> = {};
    const limit = parseNumberInRange(exportCockpit.semanticCore.limit, 1, 25);
    const lang = exportCockpit.semanticCore.lang || clusterLang;
    if (lang) payload.lang = lang;
    if (limit) payload.limit = limit;
    return payload;
  }, [exportCockpit.semanticCore, clusterLang]);

  const jsonldOverrides = useMemo(() => {
    const payload: Record<string, unknown> = {};
    const limit = parseNumberInRange(exportCockpit.jsonld.limit, 1, 10);
    const lang = exportCockpit.jsonld.lang || clusterLang;
    if (lang) payload.lang = lang;
    if (limit) payload.limit = limit;
    return payload;
  }, [exportCockpit.jsonld, clusterLang]);

  const robotsOverrides = useMemo<
    (Record<string, unknown> & { rootUrl: string }) | null
  >(() => {
    const rootUrl = exportCockpit.robots.rootUrl || selectedProject?.rootUrl;
    if (!rootUrl) {
      return null;
    }
    const payload: Record<string, unknown> & { rootUrl: string } = { rootUrl };
    const lang = exportCockpit.robots.lang || clusterLang;
    if (lang) payload.lang = lang;
    const crawlDelay = parseNumberInRange(exportCockpit.robots.crawlDelay, 1, 60);
    if (crawlDelay) payload.crawlDelay = crawlDelay;
    const sitemapUrls = splitMultilineList(exportCockpit.robots.sitemapUrls);
    if (sitemapUrls.length) payload.sitemapUrls = sitemapUrls;
    const agents = collectAgents(exportCockpit.robots.agents, exportCockpit.robots.additionalAgents);
    if (agents.length) payload.agents = agents;
    const forbiddenPaths = splitMultilineList(exportCockpit.robots.forbiddenPaths)
      .map(normalizeForbiddenPath)
      .filter((value): value is string => Boolean(value));
    if (forbiddenPaths.length) payload.forbiddenPaths = forbiddenPaths;
    return payload;
  }, [exportCockpit.robots, selectedProject?.rootUrl, clusterLang]);

  const canGenerateRobots = Boolean(robotsOverrides?.rootUrl);

  const geoOverrides = useMemo(() => {
    const payload: Record<string, unknown> = {};
    const lang = exportCockpit.geo.lang || clusterLang;
    const limit = parseNumberInRange(exportCockpit.geo.limit, 1, 12);
    const fallback = exportCockpit.geo.fallbackLocation?.trim();
    const focus: GeoIntentFocus = exportCockpit.geo.intentFocus === "all" ? "all" : "local";
    if (lang) payload.lang = lang;
    if (limit) payload.limit = limit;
    if (fallback) payload.fallbackLocation = fallback;
    payload.intentFocus = focus;
    return payload;
  }, [exportCockpit.geo, clusterLang]);

  const exportAttributes = useMemo<ExportAttributesMap>(() => {
    const semanticLimitValue = parseNumberInRange(exportCockpit.semanticCore.limit, 1, 25);
    const jsonldLimitValue = parseNumberInRange(exportCockpit.jsonld.limit, 1, 10);
    const robotsCrawlDelay = parseNumberInRange(exportCockpit.robots.crawlDelay, 1, 60);
    const sitemapList = splitMultilineList(exportCockpit.robots.sitemapUrls);
    const fallbackSitemaps = selectedProject?.sitemapUrl ? [selectedProject.sitemapUrl] : [];
    const agentList = collectAgents(exportCockpit.robots.agents, exportCockpit.robots.additionalAgents);
    const forbiddenList = splitMultilineList(exportCockpit.robots.forbiddenPaths)
      .map(normalizeForbiddenPath)
      .filter((value): value is string => Boolean(value));
    const semanticLangLabel = exportCockpit.semanticCore.lang || clusterLang || "Project default";
    const jsonldLangLabel = exportCockpit.jsonld.lang || clusterLang || "Project default";
    const robotsLangLabel = exportCockpit.robots.lang || clusterLang || "Project default";
    const rootUrlLabel = exportCockpit.robots.rootUrl || selectedProject?.rootUrl || "Set a root URL";
    const geoLimitValue = parseNumberInRange(exportCockpit.geo.limit, 1, 12);
    const geoLangLabel = exportCockpit.geo.lang || clusterLang || "Project default";
    const geoFallbackLabel = exportCockpit.geo.fallbackLocation?.trim() || "Local market";
    const geoFocusLabel =
      exportCockpit.geo.intentFocus === "all" ? "All intents" : "Local-first";
    return {
      semantic: {
        title: ARTIFACT_TITLES.semantic,
        attributes: [
          { label: "Language", value: semanticLangLabel ?? "Project default" },
          { label: "Cluster limit", value: semanticLimitValue ? `${semanticLimitValue}` : "All clusters" }
        ]
      },
      jsonld: {
        title: ARTIFACT_TITLES.jsonld,
        attributes: [
          { label: "Language", value: jsonldLangLabel ?? "Project default" },
          {
            label: "Representative pages",
            value: jsonldLimitValue ? `${jsonldLimitValue}` : "4 (default)"
          }
        ]
      },
      robots: {
        title: ARTIFACT_TITLES.robots,
        attributes: [
          { label: "Root URL", value: rootUrlLabel },
          { label: "Language", value: robotsLangLabel ?? "Project default" },
          {
            label: "Crawl delay",
            value: robotsCrawlDelay ? `${robotsCrawlDelay}s` : "Not specified"
          },
          {
            label: "Sitemaps",
            value: sitemapList.length
              ? sitemapList.join(", ")
              : fallbackSitemaps.join(", ") || "None provided"
          },
          {
            label: "Target agents",
            value: agentList.length ? agentList.join(", ") : "All popular crawlers"
          },
          {
            label: "Forbidden pages",
            value: forbiddenList.length ? forbiddenList.join(", ") : "None specified"
          }
        ]
      },
      geo: {
        title: ARTIFACT_TITLES.geo,
        attributes: [
          { label: "Language", value: geoLangLabel ?? "Project default" },
          { label: "Intent focus", value: geoFocusLabel },
          {
            label: "Location limit",
            value: geoLimitValue ? `${geoLimitValue}` : "5 (default)"
          },
          { label: "Fallback location", value: geoFallbackLabel }
        ]
      }
    };
  }, [exportCockpit, clusterLang, selectedProject?.rootUrl, selectedProject?.sitemapUrl]);

  const renderAttributesPanel = useCallback(() => {
    if (!activeExportKey) return null;
    const config = exportAttributes[activeExportKey];
    if (!config) return null;
    const previewText = exportPreviews[activeExportKey];
    return (
      <section className="export-attributes-panel" aria-live="polite">
        <div className="export-attributes-header">
          <div>
            <p className="eyebrow">Attributes</p>
            <h4>{config.title}</h4>
          </div>
          <button type="button" className="ghost-button small" onClick={() => setActiveExportKey(null)}>
            Hide
          </button>
        </div>
        <dl className="export-attributes-grid">
          {config.attributes.map((item) => (
            <div key={`${config.title}-${item.label}`} className="attribute-row">
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        <div className="export-preview">
          <p className="muted">{previewText ? "Latest download preview" : "Download to view preview"}</p>
          {previewText ? <pre>{previewText}</pre> : <div className="preview-placeholder">No preview captured yet.</div>}
        </div>
      </section>
    );
  }, [activeExportKey, exportAttributes, exportPreviews]);

  const renderCockpitSummary = useCallback(
    (key: ExportArtifactKey, limit = 2) => {
      const config = exportAttributes[key];
      if (!config) return null;
      return (
        <dl className="cockpit-summary">
          {config.attributes.slice(0, limit).map((item) => (
            <div key={`${key}-${item.label}`} className="cockpit-summary-row">
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      );
    },
    [exportAttributes]
  );

  const toggleCockpitCard = useCallback((key: ExportArtifactKey) => {
    setActiveCockpitCard((prev) => (prev === key ? null : key));
  }, []);

  const handleCockpitKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, key: ExportArtifactKey) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCockpitCard(key);
      }
    },
    [toggleCockpitCard]
  );

  const workflowTiles = useMemo<WorkflowTile[]>(() => {
    const hasProjects = projects.length > 0 || Boolean(selectedProjectId);
    const hasClusters = clusters.length > 0;
    const hasExports = Object.keys(exportPreviews).length > 0;
    return [
      {
        key: "ingest",
        label: "Ingest",
        title: "Embed crawl output",
        meta: selectedProjectId ? selectedProjectId : "No project",
        icon: <FiUpload />,
        isComplete: hasProjects
      },
      {
        key: "cluster",
        label: "Cluster",
        title: "Semantic core",
        meta: clusters.length ? `${clusters.length} groups` : "Idle",
        icon: <FiShare2 />,
        isComplete: hasClusters
      },
      {
        key: "outputs",
        label: "Outputs",
        title: "Exports",
        meta: hasExports ? "Downloads" : "Awaiting data",
        icon: <FiFileText />,
        isComplete: hasExports
      }
    ];
  }, [clusters.length, exportPreviews, projects.length, selectedProjectId]);

  const activeTile = useMemo(
    () => (activeWorkflow ? workflowTiles.find((tile) => tile.key === activeWorkflow) ?? null : null),
    [activeWorkflow, workflowTiles]
  );

  const renderWorkflowVector = useCallback((key: WorkflowKey) => {
    switch (key) {
      case "ingest":
        return (
          <span className="workflow-vector workflow-vector-ingest" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        );
      case "cluster":
        return (
          <span className="workflow-vector workflow-vector-cluster" aria-hidden="true">
            <svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet">
              <g className="branch level-one">
                <line x1="60" y1="60" x2="60" y2="20" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="60" y1="60" x2="102" y2="55" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="60" y1="60" x2="18" y2="55" vectorEffect="non-scaling-stroke" pathLength={1} />
              </g>
              <g className="nodes level-one">
                <circle cx="60" cy="20" r="4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="102" cy="55" r="4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="18" cy="55" r="4" vectorEffect="non-scaling-stroke" pathLength={1} />
              </g>
              <g className="branch level-two">
                <line x1="60" y1="20" x2="45" y2="10" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="60" y1="20" x2="75" y2="10" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="60" y1="20" x2="60" y2="4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="102" y1="55" x2="116" y2="45" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="102" y1="55" x2="114" y2="70" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="102" y1="55" x2="92" y2="72" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="18" y1="55" x2="4" y2="45" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="18" y1="55" x2="6" y2="72" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="18" y1="55" x2="30" y2="72" vectorEffect="non-scaling-stroke" pathLength={1} />
              </g>
              <g className="nodes level-two">
                <circle cx="45" cy="10" r="3" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="75" cy="10" r="3" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="60" cy="4" r="3" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="116" cy="45" r="3" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="114" cy="70" r="3" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="92" cy="72" r="3" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="4" cy="45" r="3" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="6" cy="72" r="3" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="30" cy="72" r="3" vectorEffect="non-scaling-stroke" pathLength={1} />
              </g>
              <g className="branch level-three">
                <line x1="45" y1="10" x2="39" y2="4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="45" y1="10" x2="44" y2="2" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="75" y1="10" x2="81" y2="4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="75" y1="10" x2="76" y2="2" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="60" y1="4" x2="54" y2="0" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="60" y1="4" x2="66" y2="0" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="116" y1="45" x2="122" y2="38" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="116" y1="45" x2="120" y2="34" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="114" y1="70" x2="122" y2="78" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="114" y1="70" x2="122" y2="68" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="92" y1="72" x2="96" y2="84" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="92" y1="72" x2="100" y2="80" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="4" y1="45" x2="2" y2="36" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="4" y1="45" x2="0" y2="40" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="6" y1="72" x2="2" y2="82" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="6" y1="72" x2="0" y2="80" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="30" y1="72" x2="26" y2="84" vectorEffect="non-scaling-stroke" pathLength={1} />
                <line x1="30" y1="72" x2="36" y2="84" vectorEffect="non-scaling-stroke" pathLength={1} />
              </g>
              <g className="nodes level-three">
                <circle cx="39" cy="4" r="2.4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="44" cy="2" r="2.4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="81" cy="4" r="2.4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="76" cy="2" r="2.4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="54" cy="0" r="2.2" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="66" cy="0" r="2.2" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="122" cy="38" r="2.6" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="120" cy="34" r="2.6" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="122" cy="78" r="2.6" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="122" cy="68" r="2.6" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="96" cy="84" r="2.4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="100" cy="80" r="2.4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="2" cy="36" r="2.4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="0" cy="40" r="2.4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="2" cy="82" r="2.4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="0" cy="80" r="2.4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="26" cy="84" r="2.4" vectorEffect="non-scaling-stroke" pathLength={1} />
                <circle cx="36" cy="84" r="2.4" vectorEffect="non-scaling-stroke" pathLength={1} />
              </g>
            </svg>
          </span>
        );
      case "outputs":
      default:
        return (
          <span className="workflow-vector workflow-vector-outputs" aria-hidden="true">
            <span className="sheet">
              <span className="sheet-line" />
              <span className="sheet-line" />
              <span className="sheet-line" />
              <span className="sheet-line" />
              <span className="sheet-line" />
              <span className="sheet-line" />
            </span>
          </span>
        );
    }
  }, []);

  const handleTileActivate = useCallback((key: WorkflowKey) => {
    setActiveWorkflow((previous) => (previous === key ? null : key));
  }, []);

  const renderWorkflowContent = (key: WorkflowKey) => {
    switch (key) {
      case "ingest":
        return (
          <div className="workflow-panel">
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
                    placeholder={"https://example.com/about\nhttps://example.com/blog/post"}
                  />
                </label>
                <div className="ingest-actions">
                  <button type="submit" className="primary-button" disabled={status.ingest}>
                    {status.ingest
                      ? "Embedding…"
                      : hasExistingIngestion
                      ? "Restart ingestion"
                      : "Start ingestion"}
                  </button>
                  {hasExistingIngestion && (
                    <button
                      type="button"
                      className="ghost-button compact"
                      onClick={() => {
                        setActiveWorkflow("cluster");
                        scrollWorkspaceIntoView();
                      }}
                    >
                      Proceed to clusters
                    </button>
                  )}
                </div>
                {ingestMessage && <p className="muted">{ingestMessage}</p>}
              </form>
            ) : (
              <p className="muted">Select a project to unlock ingestion.</p>
            )}
          </div>
        );
      case "cluster":
        return (
          <div className="workflow-panel">
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
                  <div className="cluster-action-row">
                    <button type="submit" className="primary-button" disabled={status.clusters}>
                      {status.clusters
                        ? "Analyzing…"
                        : hasExistingClusters
                        ? "Rebuild Cluster"
                        : "Build clusters"}
                    </button>
                    {hasExistingClusters && (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={handleEnlargeCore}
                        disabled={coreEnlarging || !selectedProjectId}
                      >
                        {coreEnlarging ? "Expanding…" : "Enlarge core"}
                      </button>
                    )}
                  </div>
                  {clusterMessage && <p className="muted">{clusterMessage}</p>}
                </form>
                <section className="export-cockpit" aria-label="Export control cockpit">
                  <div className="cockpit-header">
                    <div>
                      <p className="eyebrow">Export cockpit</p>
                      <h3>Precisely configure each artifact</h3>
                    </div>
                    <p className="muted">
                      Override language, scope, crawler rules, or geo playbooks before downloading YAML, JSON-LD,
                      robots.txt, or GEO improvements.
                    </p>
                  </div>
                  <div className="export-cockpit-grid">
                    <section
                      className="export-cockpit-card"
                      aria-label="Semantic core options"
                      data-active={activeCockpitCard === "semantic" ? "true" : undefined}
                    >
                      <div
                        className="cockpit-card-toggle"
                        role="button"
                        tabIndex={0}
                        aria-expanded={activeCockpitCard === "semantic"}
                        aria-controls="cockpit-semantic-panel"
                        onClick={() => toggleCockpitCard("semantic")}
                        onKeyDown={(event) => handleCockpitKeyDown(event, "semantic")}
                      >
                        <div>
                          <h4>Semantic core YAML</h4>
                          <p className="muted cockpit-helper">Limit how many annotated clusters are exported.</p>
                        </div>
                        {renderCockpitSummary("semantic")}
                      </div>
                      <div
                        id="cockpit-semantic-panel"
                        className="cockpit-card-body"
                        aria-hidden={activeCockpitCard !== "semantic"}
                      >
                        <label className="field-label">
                          Language override
                          <input
                            className="text-input"
                            placeholder={clusterLang ?? "en"}
                            value={exportCockpit.semanticCore.lang}
                            onChange={(e) =>
                              setExportCockpit((prev) => ({
                                ...prev,
                                semanticCore: { ...prev.semanticCore, lang: e.target.value }
                              }))
                            }
                          />
                        </label>
                        <label className="field-label">
                          Cluster limit (1-25)
                          <input
                            className="text-input"
                            type="number"
                            min={1}
                            max={25}
                            value={exportCockpit.semanticCore.limit}
                            onChange={(e) =>
                              setExportCockpit((prev) => ({
                                ...prev,
                                semanticCore: { ...prev.semanticCore, limit: e.target.value }
                              }))
                            }
                          />
                        </label>
                      </div>
                    </section>
                    <section
                      className="export-cockpit-card"
                      aria-label="JSON-LD options"
                      data-active={activeCockpitCard === "jsonld" ? "true" : undefined}
                    >
                      <div
                        className="cockpit-card-toggle"
                        role="button"
                        tabIndex={0}
                        aria-expanded={activeCockpitCard === "jsonld"}
                        aria-controls="cockpit-jsonld-panel"
                        onClick={() => toggleCockpitCard("jsonld")}
                        onKeyDown={(event) => handleCockpitKeyDown(event, "jsonld")}
                      >
                        <div>
                          <h4>JSON-LD bundle</h4>
                          <p className="muted cockpit-helper">
                            Control how many representative pages are expanded into schema.
                          </p>
                        </div>
                        {renderCockpitSummary("jsonld")}
                      </div>
                      <div
                        id="cockpit-jsonld-panel"
                        className="cockpit-card-body"
                        aria-hidden={activeCockpitCard !== "jsonld"}
                      >
                        <label className="field-label">
                          Language override
                          <input
                            className="text-input"
                            placeholder={clusterLang ?? "en"}
                            value={exportCockpit.jsonld.lang}
                            onChange={(e) =>
                              setExportCockpit((prev) => ({
                                ...prev,
                                jsonld: { ...prev.jsonld, lang: e.target.value }
                              }))
                            }
                          />
                        </label>
                        <label className="field-label">
                          Page limit (1-10)
                          <input
                            className="text-input"
                            type="number"
                            min={1}
                            max={10}
                            value={exportCockpit.jsonld.limit}
                            onChange={(e) =>
                              setExportCockpit((prev) => ({
                                ...prev,
                                jsonld: { ...prev.jsonld, limit: e.target.value }
                              }))
                            }
                          />
                        </label>
                      </div>
                    </section>
                    <section
                      className="export-cockpit-card"
                      aria-label="GEO improvement options"
                      data-active={activeCockpitCard === "geo" ? "true" : undefined}
                    >
                      <div
                        className="cockpit-card-toggle"
                        role="button"
                        tabIndex={0}
                        aria-expanded={activeCockpitCard === "geo"}
                        aria-controls="cockpit-geo-panel"
                        onClick={() => toggleCockpitCard("geo")}
                        onKeyDown={(event) => handleCockpitKeyDown(event, "geo")}
                      >
                        <div>
                          <h4>GEO improvements</h4>
                          <p className="muted cockpit-helper">
                            Shape the blueprint for static, cite-ready geo landing pages.
                          </p>
                        </div>
                        {renderCockpitSummary("geo", 3)}
                      </div>
                      <div
                        id="cockpit-geo-panel"
                        className="cockpit-card-body"
                        aria-hidden={activeCockpitCard !== "geo"}
                      >
                        <label className="field-label">
                          Language override
                          <input
                            className="text-input"
                            placeholder={clusterLang ?? "en"}
                            value={exportCockpit.geo.lang}
                            onChange={(e) =>
                              setExportCockpit((prev) => ({
                                ...prev,
                                geo: { ...prev.geo, lang: e.target.value }
                              }))
                            }
                          />
                        </label>
                        <label className="field-label">
                          Location limit (1-12)
                          <input
                            className="text-input"
                            type="number"
                            min={1}
                            max={12}
                            value={exportCockpit.geo.limit}
                            onChange={(e) =>
                              setExportCockpit((prev) => ({
                                ...prev,
                                geo: { ...prev.geo, limit: e.target.value }
                              }))
                            }
                          />
                        </label>
                        <label className="field-label">
                          Intent focus
                          <select
                            className="text-input"
                            value={exportCockpit.geo.intentFocus}
                            onChange={(e) =>
                              setExportCockpit((prev) => ({
                                ...prev,
                                geo: {
                                  ...prev.geo,
                                  intentFocus: e.target.value as GeoIntentFocus
                                }
                              }))
                            }
                          >
                            <option value="local">Local-first</option>
                            <option value="all">All intents</option>
                          </select>
                        </label>
                        <label className="field-label">
                          Fallback location label
                          <input
                            className="text-input"
                            placeholder="Local market"
                            value={exportCockpit.geo.fallbackLocation}
                            onChange={(e) =>
                              setExportCockpit((prev) => ({
                                ...prev,
                                geo: { ...prev.geo, fallbackLocation: e.target.value }
                              }))
                            }
                          />
                        </label>
                      </div>
                    </section>
                    <section
                      className="export-cockpit-card"
                      aria-label="robots.txt options"
                      data-active={activeCockpitCard === "robots" ? "true" : undefined}
                    >
                      <div
                        className="cockpit-card-toggle"
                        role="button"
                        tabIndex={0}
                        aria-expanded={activeCockpitCard === "robots"}
                        aria-controls="cockpit-robots-panel"
                        onClick={() => toggleCockpitCard("robots")}
                        onKeyDown={(event) => handleCockpitKeyDown(event, "robots")}
                      >
                        <div>
                          <h4>robots.txt</h4>
                          <p className="muted cockpit-helper">
                            Target popular crawlers with bespoke rules and include sitemaps before shipping.
                          </p>
                        </div>
                        {renderCockpitSummary("robots", 3)}
                      </div>
                      <div
                        id="cockpit-robots-panel"
                        className="cockpit-card-body"
                        aria-hidden={activeCockpitCard !== "robots"}
                      >
                        <label className="field-label">
                          Root URL
                          <input
                            className="text-input"
                            value={exportCockpit.robots.rootUrl}
                            placeholder={selectedProject?.rootUrl ?? "https://example.com"}
                            onChange={(e) =>
                              setExportCockpit((prev) => ({
                                ...prev,
                                robots: { ...prev.robots, rootUrl: e.target.value }
                              }))
                            }
                          />
                        </label>
                        <label className="field-label">
                          Language preference
                          <input
                            className="text-input"
                            placeholder={clusterLang ?? "en"}
                            value={exportCockpit.robots.lang}
                            onChange={(e) =>
                              setExportCockpit((prev) => ({
                                ...prev,
                                robots: { ...prev.robots, lang: e.target.value }
                              }))
                            }
                          />
                        </label>
                        <label className="field-label">
                          Crawl-delay seconds (1-60)
                          <input
                            className="text-input"
                            type="number"
                            min={1}
                            max={60}
                            value={exportCockpit.robots.crawlDelay}
                            onChange={(e) =>
                              setExportCockpit((prev) => ({
                                ...prev,
                                robots: { ...prev.robots, crawlDelay: e.target.value }
                              }))
                            }
                          />
                        </label>
                        <label className="field-label">
                          Sitemap URLs (one per line)
                          <textarea
                            className="text-area"
                            rows={3}
                            placeholder={selectedProject?.sitemapUrl ?? "https://example.com/sitemap.xml"}
                            value={exportCockpit.robots.sitemapUrls}
                            onChange={(e) =>
                              setExportCockpit((prev) => ({
                                ...prev,
                                robots: { ...prev.robots, sitemapUrls: e.target.value }
                              }))
                            }
                          />
                        </label>
                        <div className="field-label">
                          <span>Popular user-agents</span>
                          <div className="checkbox-grid">
                            {POPULAR_USER_AGENTS.map((agent) => (
                              <label key={agent} className="cockpit-checkbox">
                                <input
                                  type="checkbox"
                                  checked={exportCockpit.robots.agents[agent]}
                                  onChange={() =>
                                    setExportCockpit((prev) => ({
                                      ...prev,
                                      robots: {
                                        ...prev.robots,
                                        agents: {
                                          ...prev.robots.agents,
                                          [agent]: !prev.robots.agents[agent]
                                        }
                                      }
                                    }))
                                  }
                                />
                                <span>{agent}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <label className="field-label">
                          Additional user-agents (comma or newline separated)
                          <textarea
                            className="text-area"
                            rows={2}
                            placeholder="GPTBot, MegaIndex"
                            value={exportCockpit.robots.additionalAgents}
                            onChange={(e) =>
                              setExportCockpit((prev) => ({
                                ...prev,
                                robots: { ...prev.robots, additionalAgents: e.target.value }
                              }))
                            }
                          />
                        </label>
                        <label className="field-label">
                          Forbidden pages (paths or URLs)
                          <textarea
                            className="text-area"
                            rows={3}
                            placeholder={"/checkout\n/private/report"}
                            value={exportCockpit.robots.forbiddenPaths}
                            onChange={(e) =>
                              setExportCockpit((prev) => ({
                                ...prev,
                                robots: { ...prev.robots, forbiddenPaths: e.target.value }
                              }))
                            }
                          />
                        </label>
                      </div>
                    </section>
                  </div>
                </section>
                <div className="download-grid">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={status.download || clusters.length === 0}
                    onClick={() =>
                      triggerExport(
                        "semantic",
                        "/api/exports/semantic-core",
                        "semantic-core.yaml",
                        semanticCoreOverrides
                      )
                    }
                  >
                    Semantic core YAML
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={status.download || clusters.length === 0}
                    onClick={() =>
                      triggerExport("jsonld", "/api/exports/jsonld", "jsonld.json", jsonldOverrides)
                    }
                  >
                    JSON-LD bundle
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={status.download || clusters.length === 0}
                    onClick={() =>
                      triggerExport(
                        "geo",
                        "/api/exports/geo-improvements",
                        "geo-improvements.json",
                        geoOverrides
                      )
                    }
                  >
                    GEO improvements
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={status.download || clusters.length === 0 || !canGenerateRobots}
                    onClick={() =>
                      robotsOverrides &&
                      triggerExport("robots", "/api/exports/robots", "robots.txt", robotsOverrides)
                    }
                  >
                    robots.txt
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Select a project to build clusters and exports.</p>
            )}
          </div>
        );
      case "outputs":
        return (
          <div className="workflow-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Outputs</p>
                <h2>Preview exports</h2>
              </div>
              <span className="pill">{clusters.length} ready</span>
            </div>
            {clusters.length === 0 ? (
              <p className="muted">Run clustering to unlock structured downloads.</p>
            ) : (
              <div className="outputs-preview">
                <div className="download-grid compact">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={status.download}
                    onClick={() =>
                      triggerExport(
                        "semantic",
                        "/api/exports/semantic-core",
                        "semantic-core.yaml",
                        semanticCoreOverrides
                      )
                    }
                  >
                    Semantic core
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={status.download}
                    onClick={() =>
                      triggerExport("jsonld", "/api/exports/jsonld", "jsonld.json", jsonldOverrides)
                    }
                  >
                    JSON-LD
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={status.download}
                    onClick={() =>
                      triggerExport(
                        "geo",
                        "/api/exports/geo-improvements",
                        "geo-improvements.json",
                        geoOverrides
                      )
                    }
                  >
                    GEO improvements
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={status.download || !canGenerateRobots}
                    onClick={() =>
                      robotsOverrides &&
                      triggerExport("robots", "/api/exports/robots", "robots.txt", robotsOverrides)
                    }
                  >
                    robots.txt
                  </button>
                </div>
                {renderAttributesPanel()}
                <div className="outputs-grid">
                  {clusters.slice(0, 3).map((cluster) => (
                    <div key={cluster.id} className="outputs-card">
                      <p className="eyebrow">{cluster.metadata.intent}</p>
                      <strong>{cluster.metadata.label}</strong>
                      <p className="muted">{cluster.metadata.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="app-shell">
      <nav className="dock-nav" aria-label="Primary">
        {dockButtons.map((button) => (
          <button key={button.label} type="button" onClick={button.action} disabled={button.disabled}>
            <span className="dock-icon" aria-hidden="true">
              {button.icon}
            </span>
            <span className="dock-label">{button.label}</span>
          </button>
        ))}
      </nav>
      <div className="content-wrapper">
        <section className={`silver-hero${heroInView ? "" : " is-paused"}`} ref={heroRef}>
          <div className="hero-logo-clear" aria-hidden="true" />
          <div className="hero-lens" aria-hidden="true" />
          <div className="hero-outline" aria-hidden="true" />
          <div className="hero-content">
            <div className="hero-header">
              <div className="hero-heading">
                <p className="hero-subline">Answer Engine Optimization</p>
                <h1>AEO Guru</h1>
                <div className="hero-auth-controls">
                  {session ? (
                    <>
                      <span className="user-pill">Signed in as {userEmail ?? "user"}</span>
                      <button type="button" className="ghost-button small" onClick={handleSignOut}>
                        Sign out
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={openLoginModal}
                      disabled={!supabase}
                    >
                      Sign in
                    </button>
                  )}
                </div>
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
                    AI-first search experiences—pushing beyond classic SEO playbooks.
                  </p>
                </div>
              </div>
              <div className="hero-aside">
                <div className="hero-tech-panel">
                  <p className="hero-tech-panel-label">Technology by</p>
                  <ul className="hero-tech-grid">
                    {heroStack.map((item) => (
                      <li key={item.label}>
                        <span className="hero-tech-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                        <span className="hero-tech-label">{item.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className="hero-insights">
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
              <div className="hero-score-card" aria-live="polite">
                <div className="hero-score-head">
                  <p className="eyebrow">AEO/GEO optimization score</p>
                  {overallOptimizationScore ? (
                    <>
                      <div className="hero-score-value">
                        <strong>{overallOptimizationScore.value}</strong>
                        <span>/100</span>
                      </div>
                      <p className="muted">{overallOptimizationScore.summary}</p>
                      <div className="hero-score-breakdown">
                        <span>Semantic avg {overallOptimizationScore.base}</span>
                        <span>
                          {overallOptimizationScore.geoBonus > 0
                            ? `GEO boost +${overallOptimizationScore.geoBonus}`
                            : "GEO boost +0"}
                        </span>
                        <span>{overallOptimizationScore.geoNote}</span>
                      </div>
                    </>
                  ) : (
                    <p className="muted">Ingest a crawl to unlock your optimization score.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="project-controls" aria-label="Project controls">
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
              <form className="stacked-form" onSubmit={handleSaveProject}>
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
                {coreLoading && selectedProjectId && (
                  <div className="project-card-loading" role="status" aria-live="polite">
                    <span className="project-card-spinner" aria-hidden="true" />
                    <div className="project-card-loading-text">
                      <strong>Loading workspace</strong>
                      <span>Centering {selectedProjectId}</span>
                    </div>
                  </div>
                )}
                {status.projects ? (
                  <p className="muted">Loading projects…</p>
                ) : projects.length === 0 ? (
                  <div className="empty-project-state">
                    <div className="empty-project-logo" aria-hidden="true">
                      <svg viewBox="0 0 64 64" role="img" aria-hidden="true">
                        <defs>
                          <linearGradient id="registryGradient" x1="0%" x2="100%" y1="0%" y2="100%">
                            <stop offset="0%" stopColor="#a7c4ff" />
                            <stop offset="100%" stopColor="#6a8bff" />
                          </linearGradient>
                        </defs>
                        <rect x="8" y="10" width="48" height="44" rx="10" fill="url(#registryGradient)" opacity="0.25" />
                        <rect x="14" y="16" width="36" height="10" rx="5" stroke="url(#registryGradient)" strokeWidth="2" fill="none" />
                        <rect x="14" y="30" width="18" height="8" rx="4" fill="url(#registryGradient)" opacity="0.8" />
                        <rect x="34" y="30" width="16" height="8" rx="4" fill="url(#registryGradient)" opacity="0.5" />
                        <rect x="14" y="42" width="22" height="6" rx="3" fill="url(#registryGradient)" opacity="0.6" />
                      </svg>
                    </div>
                    <h3>Awaiting your first project</h3>
                    <p>
                      Use the form on the left to register a workspace. Once saved, it will appear here so you can
                      ingest URLs and build clusters.
                    </p>
                  </div>
                ) : (
                  <ul className="project-list">
                    {projects.map((project) => (
                      <li
                        key={project.id}
                        className={`project-item ${selectedProjectId === project.id ? "selected" : ""}`}
                        onClick={() => handleSelectProject(project.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleSelectProject(project.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selectedProjectId === project.id}
                        data-pulse={projectPulseId === project.id ? "true" : undefined}
                      >
                        <div>
                          <strong>{project.id}</strong>
                          <span>{project.rootUrl}</span>
                        </div>
                        <time>{formatDate(project.createdAt)}</time>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </article>
        </section>

        <section
          className="workflow-section"
          aria-label="Workflow timeline"
          ref={workspaceSectionRef}
        >
          <div className="workflow-timeline">
            <div className="workflow-timeline-flow">
              {workflowTiles.map((tile, index) => {
                const isActive = tile.key === activeWorkflow;
                const showConnector = index < workflowTiles.length - 1;
                return (
                  <div
                    key={tile.key}
                    className={`workflow-stage ${tile.isComplete ? "is-complete" : ""} ${
                      isActive ? "is-active" : ""
                    } ${showConnector ? "has-connector" : "no-connector"}`}
                  >
                    <button
                      type="button"
                      className="workflow-stage-button"
                      onClick={() => handleTileActivate(tile.key)}
                      aria-pressed={isActive}
                      aria-expanded={isActive}
                    >
                      <span className="workflow-icon" aria-hidden="true">
                        {tile.icon}
                      </span>
                      <div className="workflow-text">
                        <span className="workflow-label">{tile.label}</span>
                        <span className="workflow-meta">{tile.meta}</span>
                      </div>
                      {renderWorkflowVector(tile.key)}
                    </button>
                    {showConnector && <span className="workflow-connector" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          </div>
          {activeTile && (
            <div className="workflow-workspace" role="group" aria-live="polite" key={activeWorkflow}>
              <div className="workflow-workspace-header">
                <span className="workflow-icon large" aria-hidden="true">
                  {activeTile.icon}
                </span>
                <div>
                  <p className="eyebrow">Workspace</p>
                  <h3>{activeTile.title}</h3>
                </div>
              </div>
              <div className="workflow-body">{renderWorkflowContent(activeTile.key)}</div>
            </div>
          )}
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
            <div className="core-workbench">
              <div>
                <p className="eyebrow">Cluster map</p>
                <p className="muted">Bubble size reflects sections captured; higher on the chart equals stronger opportunity.</p>
              </div>
              <div className="core-workbench-grid">
                <div className="cluster-left-column">
                  <div className="cluster-map" aria-live="polite">
                    <svg viewBox="0 0 520 300" role="img" aria-label="Cluster opportunity map">
                      <rect x="0" y="0" width="520" height="300" fill="transparent" stroke="#2d2f38" />
                      <line x1="40" y1="260" x2="500" y2="260" stroke="#2d2f38" strokeDasharray="4 4" />
                      <line x1="40" y1="40" x2="40" y2="260" stroke="#2d2f38" strokeDasharray="4 4" />
                      {clusters.map((cluster) => {
                        const x = 40 + (cluster.size / maxClusterSize) * 440;
                        const y = 260 - ((cluster.opportunityScore ?? 0) / maxClusterScore) * 220;
                        const radius = 10 + (cluster.size / maxClusterSize) * 18;
                        const isActive = cluster.id === activeClusterId;
                        const fill = INTENT_COLOR_MAP[cluster.metadata.intent] ?? "#8891a5";
                        return (
                          <g
                            key={cluster.id}
                            className="cluster-map-node"
                            transform={`translate(${x}, ${y})`}
                            onClick={() => setActiveClusterId(cluster.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setActiveClusterId(cluster.id);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isActive}
                          >
                            <circle r={radius} fill={fill} opacity={isActive ? 0.95 : 0.65} />
                            <circle r={radius + 4} fill="none" stroke={isActive ? "#fff" : "transparent"} strokeWidth={2} />
                            <title>{`${cluster.metadata.label} (${cluster.size} sections)`}</title>
                            <text textAnchor="middle" y={radius + 16} className="cluster-map-label">
                              {cluster.metadata.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                    <ul className="cluster-map-legend">
                      <li>
                        <span className="legend-dot informational" /> Informational
                      </li>
                      <li>
                        <span className="legend-dot transactional" /> Transactional
                      </li>
                      <li>
                        <span className="legend-dot navigational" /> Navigational
                      </li>
                      <li>
                        <span className="legend-dot local" /> Local
                      </li>
                      <li>
                        <span className="legend-dot mixed" /> Mixed
                      </li>
                    </ul>
                  </div>
                  <article className="semantic-panel semantic-digest-panel">
                    <div className="core-header">
                      <div>
                        <p className="eyebrow">Semantic digest</p>
                        <p className="muted">UX view of basic + enlarged core material.</p>
                      </div>
                      {semanticCoreDigests.length > 1 && (
                        <span className="pill">{semanticCoreDigests.length} slices</span>
                      )}
                    </div>
                    {semanticCoreDigests.length === 0 ? (
                      <p className="muted">Paste semantic-core.yaml to unlock a structured digest.</p>
                    ) : (
                      <div className="semantic-digest-cards">
                        {semanticCoreDigests.map((digest, index) => (
                          <div key={`${digest.label}-${index}`} className="semantic-digest-card">
                            <div className="semantic-digest-head">
                              <strong>{digest.label}</strong>
                              {digest.summary && <p className="muted">{digest.summary}</p>}
                            </div>
                            {digest.error ? (
                              <p className="error-text small">{digest.error}</p>
                            ) : (
                              <div className="semantic-digest-groups">
                                <div>
                                  <p className="eyebrow">Focus topics</p>
                                  {digest.focusTopics.length === 0 ? (
                                    <p className="muted">No focus topics parsed.</p>
                                  ) : (
                                    <ul className="semantic-list">
                                      {digest.focusTopics.map((topic, topicIndex) => (
                                        <li key={`${topic.topic}-${topicIndex}`}>
                                          <div className="semantic-topic-head">
                                            <strong>{topic.topic}</strong>
                                            {topic.intent && <span>{topic.intent}</span>}
                                          </div>
                                          <div className="semantic-topic-body">
                                            {topic.queries.length > 0 && (
                                              <span>Queries: {topic.queries.join(", ")}</span>
                                            )}
                                            {topic.actions.length > 0 && (
                                              <span>Actions: {topic.actions.join(" · ")}</span>
                                            )}
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                <div>
                                  <p className="eyebrow">Key pages</p>
                                  {digest.keyPages.length === 0 ? (
                                    <p className="muted">No key pages parsed.</p>
                                  ) : (
                                    <ul className="semantic-list">
                                      {digest.keyPages.map((page, pageIndex) => (
                                        <li key={`${page.url ?? page.title ?? pageIndex}-${pageIndex}`}>
                                          <div className="semantic-topic-head">
                                            <strong>{page.title ?? page.url ?? "Untitled"}</strong>
                                            {page.intent && <span>{page.intent}</span>}
                                          </div>
                                          {page.url && <p className="muted semantic-url">{page.url}</p>}
                                          <div className="semantic-topic-body">
                                            {page.schema.length > 0 && (
                                              <span>Schema: {page.schema.join(", ")}</span>
                                            )}
                                            {page.supporting.length > 0 && (
                                              <span>Support: {page.supporting.join(" · ")}</span>
                                            )}
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                  {activeCluster && activeClusterNote && (
                    <div className="cluster-note-editor">
                      <div className="cluster-note-header">
                        <div>
                          <p className="eyebrow">Focused cluster</p>
                          <strong>{activeCluster.metadata.label}</strong>
                        </div>
                        <span className="pill">{activeCluster.metadata.intent}</span>
                      </div>
                      <label className="field-label">
                        Label override
                        <input
                          type="text"
                          className="text-input"
                          value={activeClusterNote.labelOverride}
                          onChange={(event) =>
                            updateClusterNote(activeCluster.id, { labelOverride: event.target.value })
                          }
                          placeholder="Human-friendly label for exports"
                        />
                      </label>
                      <label className="field-label">
                        Enrichment notes
                        <textarea
                          className="text-input"
                          rows={4}
                          value={activeClusterNote.note}
                          onChange={(event) =>
                            updateClusterNote(activeCluster.id, { note: event.target.value })
                          }
                          placeholder="Add SME quotes, POV, or experiments to run."
                        />
                      </label>
                      <label className="field-label">
                        Priority keywords
                        <input
                          type="text"
                          className="text-input"
                          value={activeClusterNote.keywordsDraft}
                          onChange={(event) =>
                            updateClusterNote(activeCluster.id, { keywordsDraft: event.target.value })
                          }
                          placeholder="keyword a, keyword b, keyword c"
                        />
                      </label>
                    </div>
                  )}
                </div>
                <div className="core-notes">
                  <div className="core-header">
                    <p className="eyebrow">Semantic core workspace</p>
                    <p className="muted">{coreLoading ? "Loading…" : `Last saved: ${lastSavedLabel}`}</p>
                  </div>
                  <div className="collapsible-field">
                    <div className="collapsible-head">
                      <div>
                        <label className="collapsible-title" htmlFor={manualNotesFieldId}>
                          Manual core summary
                        </label>
                        <p className="muted small">Capture POVs, blockers, and macro recommendations.</p>
                      </div>
                      <button
                        type="button"
                        className="collapsible-toggle"
                        aria-expanded={manualSummaryExpanded}
                        aria-controls={manualNotesFieldId}
                        onClick={() => setManualSummaryExpanded((prev) => !prev)}
                      >
                        {manualSummaryExpanded ? "Collapse" : "Expand"}
                      </button>
                    </div>
                    {manualSummaryExpanded && (
                      <textarea
                        id={manualNotesFieldId}
                        className="text-input"
                        rows={4}
                        value={coreWorkspace.manualNotes}
                        onChange={(event) =>
                          setCoreWorkspace((prev) => ({ ...prev, manualNotes: event.target.value }))
                        }
                        placeholder="Capture POVs, blockers, and macro recommendations for this project."
                      />
                    )}
                  </div>
                  <div className="collapsible-field">
                    <div className="collapsible-head">
                      <div>
                        <label className="collapsible-title" htmlFor={semanticYamlFieldId}>
                          Semantic core YAML
                        </label>
                        <p className="muted small">Keep a living reference of semantic-core.yaml.</p>
                      </div>
                      <button
                        type="button"
                        className="collapsible-toggle"
                        aria-expanded={semanticYamlExpanded}
                        aria-controls={semanticYamlFieldId}
                        onClick={() => setSemanticYamlExpanded((prev) => !prev)}
                      >
                        {semanticYamlExpanded ? "Collapse" : "Expand"}
                      </button>
                    </div>
                    {semanticYamlExpanded && (
                      <textarea
                        id={semanticYamlFieldId}
                        className="text-input code"
                        rows={6}
                        value={coreWorkspace.semanticCoreYaml}
                        onChange={(event) =>
                          setCoreWorkspace((prev) => ({ ...prev, semanticCoreYaml: event.target.value }))
                        }
                        placeholder="Paste or refine the semantic-core.yaml export to keep a living reference."
                      />
                    )}
                  </div>
                  <div className="semantic-core-visualizer" aria-live="polite">
                    <article className="semantic-panel">
                      <div className="core-header">
                        <div>
                          <p className="eyebrow">Qdrant vector lab</p>
                          <p className="muted">Peek at the embeddings driving this semantic core.</p>
                        </div>
                        {vectorSummary?.vectorDimension ? (
                          <span className="pill">{vectorSummary.vectorDimension} dims</span>
                        ) : null}
                      </div>
                      {!selectedProjectId ? (
                        <p className="muted">Select a project to visualize its Qdrant vectors.</p>
                      ) : vectorSummaryLoading ? (
                        <p className="muted">Inspecting vector store…</p>
                      ) : vectorSummaryError ? (
                        <p className="error-text small">{vectorSummaryError}</p>
                      ) : vectorSummary ? (
                        <>
                          <div className="vector-metrics">
                            <div className="vector-metric">
                              <p className="eyebrow">Vectors</p>
                              <strong>{vectorSummary.totalPoints.toLocaleString()}</strong>
                              <span className="muted">records captured</span>
                            </div>
                            <div className="vector-metric">
                              <p className="eyebrow">Avg magnitude</p>
                              <strong>{formatMagnitude(vectorSummary.avgMagnitude)}</strong>
                              <span className="muted">Peak {formatMagnitude(vectorSummary.maxMagnitude)}</span>
                            </div>
                            <div className="vector-metric">
                              <p className="eyebrow">Top languages</p>
                              <div className="vector-distribution">
                                {vectorSummary.languages.length > 0 ? (
                                  vectorSummary.languages.map((lang) => (
                                    <span key={`lang-${lang.label}`}>
                                      {lang.label} · {lang.count}
                                    </span>
                                  ))
                                ) : (
                                  <span>No language signals</span>
                                )}
                              </div>
                            </div>
                            <div className="vector-metric">
                              <p className="eyebrow">Dominant intents</p>
                              <div className="vector-distribution">
                                {vectorSummary.intents.length > 0 ? (
                                  vectorSummary.intents.map((intent) => (
                                    <span key={`intent-${intent.label}`}>
                                      {intent.label} · {intent.count}
                                    </span>
                                  ))
                                ) : (
                                  <span>Awaiting annotations</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {vectorSummary.sources.length > 0 && sourceVectorCount > 0 && (
                            <div className="vector-sources">
                              <button
                                type="button"
                                className="link-button small"
                                onClick={() => setVectorSourcesOpen(true)}
                              >
                                View source breakdown ({sourceVectorCount.toLocaleString()} pages)
                              </button>
                            </div>
                          )}
                          {vectorSummary.samples.length > 0 ? (
                            <div className="vector-samples-shell">
                              <div className="vector-samples-head">
                                <p className="eyebrow">Sample vectors</p>
                                <button
                                  type="button"
                                  className="ghost-button small"
                                  onClick={() => setVectorSamplesExpanded((prev) => !prev)}
                                  aria-expanded={vectorSamplesExpanded}
                                >
                                  {vectorSamplesExpanded
                                    ? "Hide samples"
                                    : `Preview ${vectorSummary.samples.length} samples`}
                                </button>
                              </div>
                              {vectorSamplesExpanded ? (
                                <ul className="vector-samples">
                                  {vectorSummary.samples.map((sample) => (
                                    <li key={sample.id} className="vector-sample">
                                      <div className="vector-sample-head">
                                        <div>
                                          <strong>{sample.title ?? sample.url ?? sample.id}</strong>
                                          {sample.url && <p className="muted vector-url">{sample.url}</p>}
                                        </div>
                                        <div className="vector-sample-meta">
                                          {sample.intent && <span>{sample.intent}</span>}
                                          {sample.lang && <span>{sample.lang}</span>}
                                          {sample.primaryKeyword && <span>{sample.primaryKeyword}</span>}
                                        </div>
                                      </div>
                                      <div className="vector-sample-meta">
                                        <span>Magnitude: {formatMagnitude(sample.magnitude)}</span>
                                        <span>Preview slice</span>
                                      </div>
                                      <div className="vector-preview" aria-label="Vector preview values">
                                        {sample.preview.length > 0 ? (
                                          sample.preview.map((value, index) => (
                                            <span key={`${sample.id}-${index}`}>
                                              {Number.isFinite(value) ? Number(value).toFixed(2) : "0.00"}
                                            </span>
                                          ))
                                        ) : (
                                          <span>No preview available</span>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="muted small">
                                  Peek at enriched vectors without flooding the workspace layout.
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="muted">No enriched vectors sampled yet.</p>
                          )}
                        </>
                      ) : (
                        <p className="muted">Vector embeddings not available. Ingest a crawl to get started.</p>
                      )}
                    </article>
                  </div>
                  <div className="core-actions">
                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleSaveWorkspace}
                      disabled={coreSaving || !selectedProjectId}
                    >
                      {coreSaving ? "Saving…" : "Save workspace"}
                    </button>
                  </div>
                  {coreMessage && <p className="muted">{coreMessage}</p>}
                  {associatedRecords.length > 0 && (
                    <div className="associated-records">
                      <div className="core-header">
                        <div>
                          <p className="eyebrow">Associated records</p>
                          <p className="muted">
                            Fresh crawl insights that informed the latest expansion.
                          </p>
                        </div>
                        <span className="pill">{associatedRecords.length}</span>
                      </div>
                      <ul className="associated-records-list">
                        {associatedRecords.map((record) => {
                          const schemaPreview = record.recommendedSchemas.slice(0, 2).join(", ");
                          const key = `${record.url}-${record.primaryKeyword ?? ""}-${record.clusterLabel ?? ""}`;
                          return (
                            <li key={key} className="associated-record">
                              <div className="associated-record-head">
                                <div>
                                  <strong>{record.title ?? record.url}</strong>
                                  <p className="muted associated-record-url">{record.url}</p>
                                </div>
                                <div className="associated-record-meta">
                                  {record.clusterLabel && <span>{record.clusterLabel}</span>}
                                  {record.intent && <span>{record.intent}</span>}
                                </div>
                              </div>
                              <p className="associated-record-excerpt">{record.excerpt}</p>
                              <div className="associated-record-meta">
                                {record.primaryKeyword && <span>Keyword: {record.primaryKeyword}</span>}
                                {schemaPreview && <span>Schema: {schemaPreview}</span>}
                                <a href={record.url} target="_blank" rel="noreferrer">
                                  Open URL
                                </a>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
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
      {insightsModalOpen && (
        <div
          className={`insights-backdrop${insightsFullscreen ? " fullscreen" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="insights-modal-title"
          onClick={closeInsightsModal}
        >
          <div
            className={`insights-panel${insightsFullscreen ? " fullscreen" : ""}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="insights-header">
              <p className="eyebrow">Assistant</p>
              <div className="insights-actions">
                <button
                  type="button"
                  className="ghost-button small"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleInsightsFullscreen();
                  }}
                >
                  {insightsFullscreen ? "Exit fullscreen" : "Fullscreen"}
                </button>
                <button type="button" className="ghost-button small" onClick={closeInsightsModal}>
                  Dismiss
                </button>
              </div>
            </div>
            <h3 id="insights-modal-title">AEO/GEO insights ready</h3>
            <p className="muted">
              Invite the assistant to interpret your clustered dataset and highlight what to improve next.
            </p>
            <button type="button" className="insights-cta" onClick={handleGenerateInsights}>
              Get insights
            </button>
            <div className="insights-message" aria-live="polite">
              {insightsRequested
                ? insightsMessage ?? "Interpreting the latest crawl insights…"
                : "Tap the button above to generate a tailored summary from your clustered dataset."}
            </div>
          </div>
        </div>
      )}
      {vectorSourcesOpen && vectorSummary?.sources.length ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vector-sources-title"
          onClick={() => setVectorSourcesOpen(false)}
        >
          <div className="modal-panel vector-sources-panel" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">Vector lab</p>
                <h2 id="vector-sources-title">Source breakdown</h2>
              </div>
              <button type="button" className="ghost-button small" onClick={() => setVectorSourcesOpen(false)}>
                Close
              </button>
            </div>
            <p className="muted small">Source annotations grouped by URL, sitemap, or manual uploads.</p>
            <ul className="vector-source-list">
              {vectorSummary.sources.map((source) => (
                <li key={`source-${source.label}`} className="vector-source-item">
                  <strong>{source.label}</strong>
                  <span className="vector-source-count">{source.count.toLocaleString()} vectors</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {loginModalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          onClick={closeLoginModal}
        >
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">{authMode === "signIn" ? "Welcome back" : "Join the beta"}</p>
                <h2 id="auth-modal-title">{authMode === "signIn" ? "Sign in" : "Create account"}</h2>
              </div>
              <button type="button" className="ghost-button small" onClick={closeLoginModal}>
                Close
              </button>
            </div>
            {supabase ? (
              <>
                <form className="stacked-form" onSubmit={handleAuthSubmit}>
                  <label className="field-label">
                    Email
                    <input
                      type="email"
                      className="text-input"
                      value={authForm.email}
                      onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="field-label">
                    Password
                    <input
                      type="password"
                      className="text-input"
                      value={authForm.password}
                      onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                      required
                    />
                  </label>
                  {authError && <p className="error-text">{authError}</p>}
                  {authMessage && <p className="success-text">{authMessage}</p>}
                  <button type="submit" className="primary-button" disabled={authLoading}>
                    {authLoading
                      ? "Working…"
                      : authMode === "signIn"
                        ? "Sign in"
                        : "Create account"}
                  </button>
                </form>
                <p className="muted switcher">
                  {authMode === "signIn" ? "Need an account?" : "Already registered?"}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setAuthMode((prev) => (prev === "signIn" ? "signUp" : "signIn"));
                      setAuthError(null);
                      setAuthMessage(null);
                    }}
                  >
                    {authMode === "signIn" ? "Create one" : "Sign in"}
                  </button>
                </p>
              </>
            ) : (
              <p className="error-text">
                Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and
                NEXT_PUBLIC_SUPABASE_ANON_KEY to enable authentication.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
