// app/api/exports/robots/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getProjectPoints, type ProjectPoint } from "@/lib/clustering";
import {
  generateRobotsTxtFromSummary,
  type DisallowCandidate,
  type RobotsSummary
} from "@/lib/generators";

const POPULAR_CRAWLERS = [
  "Googlebot",
  "Googlebot-Image",
  "Bingbot",
  "Bingbot-Mobile",
  "Slurp",
  "DuckDuckBot",
  "Baiduspider",
  "YandexBot"
] as const;

const SEARCH_SEGMENTS = ["search", "results", "finder", "lookup"];
const TAG_SEGMENTS = ["tag", "tags", "topic", "topics", "category", "categories", "label", "labels", "archive", "archives"];
const SERP_HINT_PATTERNS = [/\bserp\b/i, /search results?/i, /internal search/i, /site search/i, /results? page/i];
const TAG_HINT_PATTERNS = [/\btag\b/i, /\btopic\b/i, /\bcategory\b/i, /\barchive\b/i, /listing/i];
const MANUAL_REASON = "Manually supplied forbidden path";
const MAX_SAMPLE_URLS = 3;

const schema = z.object({
  projectId: z.string(),
  rootUrl: z.string().url(),
  lang: z.string().optional(),
  crawlDelay: z.number().int().min(1).max(60).optional(),
  sitemapUrls: z.array(z.string().url()).max(10).optional(),
  agents: z.array(z.string()).min(1).max(16).optional(),
  forbiddenPaths: z.array(z.string()).max(25).optional()
});

type PathStat = { count: number; samples: string[] };
type CandidateAccumulator = {
  pattern: string;
  reasons: Set<string>;
  hints: Set<string>;
  evidenceCount: number;
  sampleUrls: string[];
};
type CandidateStore = Map<string, CandidateAccumulator>;
type ClusterInsight = {
  urls: Set<string>;
  labels: Set<string>;
  serpTexts: Set<string>;
  tagTexts: Set<string>;
};

type PatternAnalysis = {
  candidates: DisallowCandidate[];
  duplicatePatterns: string[];
  stats: {
    totalUrls: number;
    parameterKeys: number;
    flaggedClusters: number;
  };
};

function slugify(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "project";
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeManualPath(entry: string): string {
  if (/^https?:\/\//i.test(entry)) {
    const parsed = safeUrl(entry);
    return parsed?.pathname || "/";
  }
  return entry.startsWith("/") ? entry : `/${entry}`;
}

function collectTextFields(payload: Record<string, any>): string[] {
  const values: string[] = [];
  const pushString = (value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      values.push(value);
    }
  };
  [
    payload.title,
    payload.h1,
    payload.clusterLabel,
    payload.cluster_label,
    payload.clusterSummary,
    payload.clusterIntent,
    payload.intent,
    payload.primaryKeyword,
    payload.clusterPrimaryKeyword
  ].forEach(pushString);
  const arrayCandidates = [
    payload.clusterContentGaps,
    payload.clusterRepresentativeQueries,
    payload.tags,
    payload.clusterTags,
    payload.secondaryKeywords,
    payload.clusterSecondaryKeywords
  ];
  arrayCandidates.forEach((candidate) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(pushString);
    }
  });
  return values;
}

function extractClusterId(payload: Record<string, any>): string | null {
  const candidates = [payload.clusterId, payload.cluster_id, payload.cluster?.id];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const value = typeof candidate === "string" ? candidate : String(candidate);
    if (value.trim()) {
      return value;
    }
  }
  return null;
}

function findSegmentIndex(segments: string[], keywords: string[]): number | null {
  for (let idx = 0; idx < segments.length; idx++) {
    const normalized = segments[idx].replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (keywords.includes(normalized)) {
      return idx;
    }
  }
  return null;
}

function buildPatternFromSegments(segments: string[], depth: number): string | null {
  if (!segments.length || depth <= 0) return null;
  const slice = segments.slice(0, Math.min(depth, segments.length)).filter(Boolean);
  if (!slice.length) return null;
  return `/${slice.join("/")}/`;
}

function findDominantPattern(urls: string[]): { pattern: string; count: number; samples: string[] } | null {
  const counts = new Map<string, PathStat>();
  for (const url of urls) {
    const parsed = safeUrl(url);
    if (!parsed) continue;
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (!segments.length) continue;
    const depth = Math.min(3, segments.length);
    const pattern = buildPatternFromSegments(segments, depth);
    if (!pattern) continue;
    const stat = counts.get(pattern) ?? { count: 0, samples: [] };
    stat.count += 1;
    if (stat.samples.length < MAX_SAMPLE_URLS) stat.samples.push(url);
    counts.set(pattern, stat);
  }
  const best = Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count)[0];
  if (!best) return null;
  const [pattern, stat] = best;
  const coverage = stat.count / urls.length;
  if (stat.count < 3 || coverage < 0.6) return null;
  return { pattern, count: stat.count, samples: stat.samples };
}

function recordCandidate(
  store: CandidateStore,
  candidate: {
    pattern: string;
    reason?: string;
    hints?: string | string[];
    count?: number;
    sampleUrls?: string[];
  }
) {
  const entry =
    store.get(candidate.pattern) ?? {
      pattern: candidate.pattern,
      reasons: new Set<string>(),
      hints: new Set<string>(),
      evidenceCount: 0,
      sampleUrls: []
    };
  entry.evidenceCount += candidate.count ?? 1;
  if (candidate.reason) {
    entry.reasons.add(candidate.reason);
  }
  const hints = Array.isArray(candidate.hints)
    ? candidate.hints
    : candidate.hints
    ? [candidate.hints]
    : [];
  hints.forEach((hint) => entry.hints.add(hint));
  if (candidate.sampleUrls) {
    for (const sample of candidate.sampleUrls) {
      if (!entry.sampleUrls.includes(sample) && entry.sampleUrls.length < MAX_SAMPLE_URLS) {
        entry.sampleUrls.push(sample);
      }
    }
  }
  store.set(candidate.pattern, entry);
}

function finalizeCandidates(store: CandidateStore): DisallowCandidate[] {
  return Array.from(store.values())
    .sort((a, b) => b.evidenceCount - a.evidenceCount)
    .map((entry) => ({
      pattern: entry.pattern,
      reasons: Array.from(entry.reasons),
      hints: Array.from(entry.hints),
      evidenceCount: entry.evidenceCount,
      sampleUrls: entry.sampleUrls
    }));
}

function analyzeProjectPayloads(points: ProjectPoint[]): PatternAnalysis {
  const candidateStore: CandidateStore = new Map();
  const seenUrls = new Set<string>();
  const paramStats = new Map<string, PathStat>();
  const searchStats = new Map<string, PathStat>();
  const tagStats = new Map<string, PathStat>();
  const pathBuckets = new Map<string, PathStat>();
  const clusterMap = new Map<string, ClusterInsight>();

  for (const point of points) {
    const payload = point.payload ?? {};
    const url = typeof payload.url === "string" ? payload.url : null;
    if (!url || seenUrls.has(url)) continue;
    const parsed = safeUrl(url);
    if (!parsed) continue;
    seenUrls.add(url);

    const segments = parsed.pathname.split("/").filter(Boolean);

    parsed.searchParams.forEach((_value, key) => {
      const stat = paramStats.get(key) ?? { count: 0, samples: [] };
      stat.count += 1;
      if (stat.samples.length < MAX_SAMPLE_URLS) stat.samples.push(url);
      paramStats.set(key, stat);
    });

    const searchIdx = findSegmentIndex(segments, SEARCH_SEGMENTS);
    if (searchIdx !== null) {
      const pattern = buildPatternFromSegments(segments, searchIdx + 1);
      if (pattern) {
        const stat = searchStats.get(pattern) ?? { count: 0, samples: [] };
        stat.count += 1;
        if (stat.samples.length < MAX_SAMPLE_URLS) stat.samples.push(url);
        searchStats.set(pattern, stat);
      }
    }

    const tagIdx = findSegmentIndex(segments, TAG_SEGMENTS);
    if (tagIdx !== null) {
      const pattern = buildPatternFromSegments(segments, tagIdx + 1);
      if (pattern) {
        const stat = tagStats.get(pattern) ?? { count: 0, samples: [] };
        stat.count += 1;
        if (stat.samples.length < MAX_SAMPLE_URLS) stat.samples.push(url);
        tagStats.set(pattern, stat);
      }
    }

    if (segments.length) {
      const depth = Math.min(2, segments.length);
      const pattern = buildPatternFromSegments(segments, depth);
      if (pattern) {
        const stat = pathBuckets.get(pattern) ?? { count: 0, samples: [] };
        stat.count += 1;
        if (stat.samples.length < MAX_SAMPLE_URLS) stat.samples.push(url);
        pathBuckets.set(pattern, stat);
      }
    }

    const clusterId = extractClusterId(payload);
    if (clusterId) {
      const entry =
        clusterMap.get(clusterId) ?? {
          urls: new Set<string>(),
          labels: new Set<string>(),
          serpTexts: new Set<string>(),
          tagTexts: new Set<string>()
        };
      entry.urls.add(url);
      const label =
        typeof payload.clusterLabel === "string"
          ? payload.clusterLabel
          : typeof payload.cluster_label === "string"
          ? payload.cluster_label
          : null;
      if (label) {
        entry.labels.add(label);
      }
      const textFields = collectTextFields(payload);
      textFields.forEach((text) => {
        if (SERP_HINT_PATTERNS.some((pattern) => pattern.test(text))) {
          entry.serpTexts.add(text);
        }
        if (TAG_HINT_PATTERNS.some((pattern) => pattern.test(text))) {
          entry.tagTexts.add(text);
        }
      });
      clusterMap.set(clusterId, entry);
    }
  }

  paramStats.forEach(({ count, samples }, key) => {
    if (count < 2) return;
    recordCandidate(candidateStore, {
      pattern: `/*?${key}=`,
      reason: `Query parameter ?${key}= observed on ${count} URLs`,
      hints: "query-parameter",
      count,
      sampleUrls: samples
    });
  });

  searchStats.forEach(({ count, samples }, pattern) => {
    if (count < 2) return;
    recordCandidate(candidateStore, {
      pattern,
      reason: `${count} URLs look like search/SERP listings under ${pattern}`,
      hints: "search-path",
      count,
      sampleUrls: samples
    });
  });

  tagStats.forEach(({ count, samples }, pattern) => {
    if (count < 2) return;
    recordCandidate(candidateStore, {
      pattern,
      reason: `${count} URLs look like tag/category listings under ${pattern}`,
      hints: "tag-path",
      count,
      sampleUrls: samples
    });
  });

  pathBuckets.forEach(({ count, samples }, pattern) => {
    if (count < 4) return;
    recordCandidate(candidateStore, {
      pattern,
      reason: `${count} URLs share the ${pattern} prefix and look duplicative`,
      hints: "duplicate",
      count,
      sampleUrls: samples
    });
  });

  let flaggedClusters = 0;
  clusterMap.forEach((cluster, clusterId) => {
    const urls = Array.from(cluster.urls);
    if (urls.length < 3) return;
    const dominant = findDominantPattern(urls);
    if (!dominant) return;
    flaggedClusters += 1;
    const reasonParts = [
      `Cluster ${clusterId} contributes ${urls.length} URLs`,
      `Dominant path ${dominant.pattern} covers ${dominant.count}`
    ];
    if (cluster.labels.size) {
      reasonParts.push(`Labels: ${Array.from(cluster.labels).slice(0, 2).join(", ")}`);
    }
    if (cluster.serpTexts.size) {
      reasonParts.push(`SERP cues: ${Array.from(cluster.serpTexts).slice(0, 1).join("; ")}`);
    }
    if (cluster.tagTexts.size) {
      reasonParts.push(`Tag cues: ${Array.from(cluster.tagTexts).slice(0, 1).join("; ")}`);
    }
    const hints: string[] = ["cluster"];
    if (cluster.serpTexts.size) hints.push("cluster-serp");
    if (cluster.tagTexts.size) hints.push("cluster-tag");
    recordCandidate(candidateStore, {
      pattern: dominant.pattern,
      reason: reasonParts.join(" | "),
      hints,
      count: dominant.count,
      sampleUrls: dominant.samples
    });
  });

  const candidates = finalizeCandidates(candidateStore);
  const duplicatePatterns = candidates
    .filter((candidate) => candidate.hints?.some((hint) => hint.includes("duplicate")))
    .map((candidate) => candidate.pattern);

  return {
    candidates,
    duplicatePatterns: Array.from(new Set(duplicatePatterns)),
    stats: {
      totalUrls: seenUrls.size,
      parameterKeys: paramStats.size,
      flaggedClusters
    }
  };
}

function mergeManualCandidates(
  candidates: DisallowCandidate[],
  manualForbidden: string[]
): DisallowCandidate[] {
  const map = new Map<string, DisallowCandidate>();
  candidates.forEach((candidate) => {
    map.set(candidate.pattern, {
      ...candidate,
      reasons: candidate.reasons ? [...candidate.reasons] : undefined,
      hints: candidate.hints ? [...candidate.hints] : undefined,
      sampleUrls: candidate.sampleUrls ? [...candidate.sampleUrls] : undefined
    });
  });

  manualForbidden.forEach((pattern) => {
    const entry = map.get(pattern);
    if (entry) {
      const reasons = new Set(entry.reasons ?? []);
      reasons.add(MANUAL_REASON);
      entry.reasons = Array.from(reasons);
      const hints = new Set(entry.hints ?? []);
      hints.add("manual");
      entry.hints = Array.from(hints);
      entry.evidenceCount = (entry.evidenceCount ?? 0) + 1;
    } else {
      map.set(pattern, {
        pattern,
        reasons: [MANUAL_REASON],
        hints: ["manual"],
        evidenceCount: 1
      });
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => (b.evidenceCount ?? 0) - (a.evidenceCount ?? 0)
  );
}

export async function POST(req: NextRequest) {
  const { projectId, rootUrl, lang, crawlDelay, sitemapUrls, agents, forbiddenPaths } = schema.parse(
    await req.json()
  );
  const points = await getProjectPoints(projectId, { lang, withVectors: false });

  if (!points.length) {
    return NextResponse.json({ error: "No content" }, { status: 404 });
  }

  const analysis = analyzeProjectPayloads(points);
  const manualForbidden = Array.from(
    new Set(
      (forbiddenPaths ?? [])
        .map((path) => path.trim())
        .filter(Boolean)
        .map((entry) => normalizeManualPath(entry))
    )
  );
  const requestedAgents = Array.from(
    new Set((agents?.length ? agents : POPULAR_CRAWLERS).map((agent) => agent.trim()))
  ).filter(Boolean);

  const disallowCandidates = mergeManualCandidates(analysis.candidates, manualForbidden);
  const rationale = disallowCandidates.flatMap((candidate) =>
    (candidate.reasons ?? []).map((reason) => `${candidate.pattern}: ${reason}`)
  );
  const duplicatePatterns = Array.from(
    new Set([
      ...analysis.duplicatePatterns,
      ...disallowCandidates
        .filter((candidate) => candidate.hints?.some((hint) => hint.includes("duplicate")))
        .map((candidate) => candidate.pattern)
    ])
  );

  const summary: RobotsSummary = {
    rootUrl,
    disallowCandidates,
    duplicatePatterns,
    rationale,
    crawlDelay,
    sitemapUrls,
    requestedAgents: requestedAgents.length
      ? requestedAgents
      : Array.from(POPULAR_CRAWLERS),
    forbiddenPaths: manualForbidden,
    insightStats: analysis.stats
  };

  const robotsTxt = await generateRobotsTxtFromSummary(summary);
  const filename = `${slugify(projectId)}-robots.txt`;

  return new NextResponse(robotsTxt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
