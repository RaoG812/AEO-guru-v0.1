// app/api/exports/geo-improvements/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getProjectPoints } from "@/lib/clustering";

const requestSchema = z.object({
  projectId: z.string(),
  limit: z.number().int().min(1).max(12).optional(),
  lang: z.string().optional(),
  fallbackLocation: z.string().optional(),
  intentFocus: z.enum(["local", "all"]).optional()
});

type ClusterRecord = {
  id: string;
  label: string;
  summary: string;
  intent: string;
  primaryKeyword?: string | null;
  secondaryKeywords: string[];
  representativeQueries: string[];
  recommendedSchemas: string[];
  contentGaps: string[];
  urls: Set<string>;
  lang?: string | null;
  score?: number | null;
};

type GeoCandidate = { label: string; score: number };

type GeoImprovement = {
  clusterId: string;
  clusterLabel: string;
  intent: string;
  lang: string;
  location: string;
  primaryKeyword: string | null;
  hero: {
    headline: string;
    subhead: string;
    metaDescription: string;
    callToAction: string;
  };
  sections: Array<{ title: string; body: string; keyMessages: string[] }>;
  faq: Array<{ question: string; answer: string }>;
  recommendedSchemas: string[];
  supportingQueries: string[];
  opportunityScore: number | null;
};

const GEO_ABBREVIATIONS = new Map<string, string>([
  ["NYC", "New York City"],
  ["LA", "Los Angeles"],
  ["L.A.", "Los Angeles"],
  ["SF", "San Francisco"],
  ["UK", "United Kingdom"],
  ["U.K.", "United Kingdom"],
  ["US", "United States"],
  ["U.S.", "United States"],
  ["USA", "United States"],
  ["UAE", "United Arab Emirates"],
  ["EU", "European Union"],
  ["EMEA", "EMEA"],
  ["APAC", "APAC"],
  ["LATAM", "Latin America"],
  ["DACH", "DACH"],
  ["ANZ", "Australia & New Zealand"],
  ["GCC", "GCC"],
  ["MEA", "Middle East & Africa"]
]);

function normalizeLocationLabel(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const sanitized = raw
    .replace(/[^A-Za-z0-9\s&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!sanitized) return null;
  const abbreviation = GEO_ABBREVIATIONS.get(sanitized.toUpperCase());
  if (abbreviation) return abbreviation;
  if (/^[A-Z]{2,3}$/.test(sanitized)) {
    return sanitized.toUpperCase();
  }
  return sanitized
    .split(" ")
    .map((part) => {
      if (!part) return part;
      if (part.length <= 3) {
        return part.toUpperCase();
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

function addLocationCandidate(
  counts: Map<string, GeoCandidate>,
  label: string | null,
  weight = 1
) {
  if (!label) return;
  const normalized = normalizeLocationLabel(label);
  if (!normalized) return;
  const key = normalized.toLowerCase();
  const existing = counts.get(key);
  if (existing) {
    counts.set(key, { label: existing.label, score: existing.score + weight });
  } else {
    counts.set(key, { label: normalized, score: weight });
  }
}

function extractLocationsFromText(text: string | undefined | null): GeoCandidate[] {
  if (!text) return [];
  const counts = new Map<string, GeoCandidate>();
  if (/near\s+me|nearby|closest\s+(?:office|store|service)/i.test(text)) {
    addLocationCandidate(counts, "Local proximity", 2);
  }

  const connectorRegex = /\b(?:in|near|around|within|serving|for|across)\s+([A-Za-z][A-Za-z\s-]{2,})/gi;
  let match: RegExpExecArray | null;
  while ((match = connectorRegex.exec(text)) !== null) {
    addLocationCandidate(counts, match[1], 1.2);
  }

  const suffixRegex = /([A-Za-z][A-Za-z\s-]{2,})\s+(?:County|City|Province|State|Region|Area)/gi;
  while ((match = suffixRegex.exec(text)) !== null) {
    addLocationCandidate(counts, match[0], 1);
  }

  for (const [token, label] of GEO_ABBREVIATIONS.entries()) {
    const tokenRegex = new RegExp(`\\b${token.replace(/\./g, "\\.")}\\b`, "i");
    if (tokenRegex.test(text)) {
      addLocationCandidate(counts, label, 1.1);
    }
  }

  if (/\bglobal\b/i.test(text) || /\bworldwide\b/i.test(text)) {
    addLocationCandidate(counts, "Global", 0.8);
  }

  if (counts.size === 0 && /\bregion\b/i.test(text)) {
    addLocationCandidate(counts, "Regional", 0.6);
  }

  return Array.from(counts.values());
}

function collectGeoTargets(texts: string[]): string[] {
  const aggregate = new Map<string, GeoCandidate>();
  for (const text of texts) {
    for (const candidate of extractLocationsFromText(text)) {
      const key = candidate.label.toLowerCase();
      const existing = aggregate.get(key);
      if (existing) {
        aggregate.set(key, { label: existing.label, score: existing.score + candidate.score });
      } else {
        aggregate.set(key, candidate);
      }
    }
  }

  return Array.from(aggregate.values())
    .sort((a, b) => b.score - a.score)
    .map((candidate) => candidate.label);
}

function buildSections(
  cluster: ClusterRecord,
  location: string,
  summary: string,
  queries: string[]
): Array<{ title: string; body: string; keyMessages: string[] }> {
  const normalizedSummary = summary?.trim()
    ? summary.trim()
    : `Package proof, testimonials, and topical expertise to win "${cluster.label}" searches.`;
  const localizedSummary = `${normalizedSummary} Reference data points and customer evidence that originate in ${location} to establish topical and geographic authority.`;
  const keyQueries = queries.slice(0, 3);
  return [
    {
      title: "Regional POV",
      body: localizedSummary,
      keyMessages: [
        `Lead with an insight specific to ${location} searchers looking for ${cluster.primaryKeyword ?? cluster.label}.`,
        "Support the insight with product proof, analyst validation, and SME commentary."
      ]
    },
    {
      title: "Experience architecture",
      body: `Structure on-page modules that map to ${cluster.intent} intent and highlight trusted navigation paths for ${location}. Use scannable copy blocks that AI assistants can cite verbatim.`,
      keyMessages: [
        `Surface internal links pointing to ${location}-ready case studies, partner pages, or knowledge articles.`,
        `Reinforce ${cluster.label.toLowerCase()} relevance with schema, tabular data, and KPI snapshots.`
      ]
    },
    {
      title: "Demand activation",
      body: `Close with localized CTAs, service areas, and conversion microcopy aimed at ${location} teams. Embed downloadable assets or service menus that eliminate ambiguity for AI answer engines.`,
      keyMessages: [
        `Summarize how the ${cluster.label.toLowerCase()} team supports on-the-ground stakeholders in ${location}.`,
        `Echo the phrasing from high-value queries${keyQueries.length ? ` such as ${keyQueries.join(", ")}` : ""}.`
      ]
    }
  ];
}

function buildFaqs(
  questions: string[],
  location: string,
  clusterLabel: string,
  summary: string
): Array<{ question: string; answer: string }> {
  const uniqueQuestions = Array.from(new Set(questions)).slice(0, 4);
  if (uniqueQuestions.length === 0) {
    uniqueQuestions.push(`How does this ${clusterLabel.toLowerCase()} solution support teams in ${location}?`);
  }
  const defaultSummary = summary?.trim()
    ? summary.trim()
    : `Outline the workflows, governance, and ROI coverage that ${clusterLabel.toLowerCase()} buyers expect.`;
  return uniqueQuestions.map((question) => {
    const normalizedQuestion = question.includes(location)
      ? question
      : `${question.replace(/\?$/, "")} in ${location}?`;
    const answer = `${defaultSummary} Emphasize why ${location} organizations trust this guidance and cite any service-level agreements, coverage hours, or partner enablement programs.`;
    return { question: normalizedQuestion, answer };
  });
}

function isLocalIntent(intent: string | undefined | null) {
  if (!intent) return false;
  const normalized = intent.toLowerCase();
  return normalized === "local" || normalized === "mixed";
}

export async function POST(req: NextRequest) {
  const { projectId, limit, lang, fallbackLocation, intentFocus } = requestSchema.parse(
    await req.json()
  );
  const locationLimit = limit ?? 5;
  const fallbackLocationLabel = normalizeLocationLabel(fallbackLocation) ?? undefined;
  const preferredLang = lang ?? "en";

  const pagePoints = await getProjectPoints(projectId, { lang, withVectors: false, limit: 10000 });
  const queryPoints = await getProjectPoints(projectId, {
    lang,
    withVectors: false,
    types: ["query"],
    limit: 10000
  });

  if (!pagePoints.length && !queryPoints.length) {
    return NextResponse.json({ error: "No embeddings located for project" }, { status: 404 });
  }

  const clusterMap = new Map<string, ClusterRecord>();

  for (const point of pagePoints) {
    const payload = point.payload ?? {};
    const clusterId = payload.clusterId;
    if (!clusterId) continue;
    if (!clusterMap.has(clusterId)) {
      clusterMap.set(clusterId, {
        id: clusterId,
        label: payload.clusterLabel ?? `Cluster ${clusterId}`,
        summary: payload.clusterSummary ?? "",
        intent: payload.clusterIntent ?? payload.intent ?? "informational",
        primaryKeyword: payload.clusterPrimaryKeyword ?? payload.primaryKeyword ?? null,
        secondaryKeywords: Array.isArray(payload.clusterSecondaryKeywords)
          ? payload.clusterSecondaryKeywords
          : [],
        representativeQueries: Array.isArray(payload.clusterRepresentativeQueries)
          ? payload.clusterRepresentativeQueries
          : [],
        recommendedSchemas: Array.isArray(payload.clusterRecommendedSchemas)
          ? payload.clusterRecommendedSchemas
          : [],
        contentGaps: Array.isArray(payload.clusterContentGaps) ? payload.clusterContentGaps : [],
        urls: new Set(),
        lang: payload.lang ?? null,
        score: typeof payload.score_opportunity === "number" ? payload.score_opportunity : null
      });
    }
    const record = clusterMap.get(clusterId)!;
    if (typeof payload.url === "string") {
      record.urls.add(payload.url);
    }
    if (!record.lang && payload.lang) {
      record.lang = payload.lang;
    }
  }

  const queriesByCluster = new Map<string, string[]>();
  for (const point of queryPoints) {
    const payload = point.payload ?? {};
    const clusterId = payload.clusterId;
    if (!clusterId || typeof payload.content !== "string") continue;
    if (!queriesByCluster.has(clusterId)) {
      queriesByCluster.set(clusterId, []);
    }
    queriesByCluster.get(clusterId)!.push(payload.content);
  }

  const improvements: GeoImprovement[] = [];
  const focus = intentFocus ?? "local";

  for (const record of clusterMap.values()) {
    const canonicalQuestions = queriesByCluster.get(record.id) ?? [];
    const textSources = [
      record.primaryKeyword ?? "",
      ...record.secondaryKeywords,
      ...record.representativeQueries,
      ...canonicalQuestions,
      record.summary
    ].filter((value): value is string => Boolean(value));
    const geoTargets = collectGeoTargets(textSources);
    const qualifies = focus === "all" || geoTargets.length > 0 || isLocalIntent(record.intent);
    if (!qualifies) {
      continue;
    }
    const targets = (geoTargets.length ? geoTargets : fallbackLocationLabel ? [fallbackLocationLabel] : [])
      .slice(0, locationLimit);
    if (!targets.length) {
      continue;
    }

    for (const location of targets) {
      const heroHeadline = `${record.label} — ${location} coverage that AI trusts`;
      const heroSubhead = `Publish structured, cite-ready copy that answers ${location} searchers looking for ${record.primaryKeyword ?? record.label}.`;
      const metaDescription = `Authoritative ${record.label} guidance tailored to ${location}. Reinforce expertise with regional proof points, schema, and evergreen content blocks.`;
      const callToAction = `Talk with our ${record.label} specialists in ${location}`;
      const sectionPlan = buildSections(record, location, record.summary, canonicalQuestions);
      const faq = buildFaqs(canonicalQuestions, location, record.label, record.summary);
      improvements.push({
        clusterId: record.id,
        clusterLabel: record.label,
        intent: record.intent,
        lang: record.lang ?? preferredLang,
        location,
        primaryKeyword: record.primaryKeyword ?? null,
        hero: {
          headline: heroHeadline,
          subhead: heroSubhead,
          metaDescription,
          callToAction
        },
        sections: sectionPlan,
        faq,
        recommendedSchemas: record.recommendedSchemas,
        supportingQueries: Array.from(
          new Set([...record.representativeQueries, ...canonicalQuestions])
        ).slice(0, 8),
        opportunityScore: record.score ?? null
      });
    }
  }

  if (!improvements.length) {
    return NextResponse.json({ error: "No geo improvements detected" }, { status: 404 });
  }

  const payload = {
    projectId,
    artifact: "geo-improvements",
    generatedAt: new Date().toISOString(),
    lang: preferredLang,
    locationLimit,
    intentFocus: focus,
    improvementCount: improvements.length,
    improvements
  };

  const filename = `${projectId.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-")}-geo-improvements.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
