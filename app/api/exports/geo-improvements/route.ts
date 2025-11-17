// app/api/exports/geo-improvements/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getProjectPoints } from "@/lib/clustering";

const requestSchema = z.object({
  projectId: z.string(),
  limit: z.number().int().min(1).max(25).optional(),
  lang: z.string().optional(),
  tone: z.string().min(3).max(80).optional()
});

const DEFAULT_TONE = "Product-led";

type ClusterDescriptor = {
  id: string;
  label: string;
  summary: string;
  intent: string;
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  contentGaps: string[];
  representativeQueries: string[];
  recommendedSchemas: string[];
  lang?: string | null;
  primaryUrl?: string | null;
  score?: number | null;
};

type GeoModule = {
  clusterId: string;
  label: string;
  lang: string;
  intent: string;
  primaryKeyword: string | null;
  opportunityScore: number | null;
  targetUrl: string | null;
  secondaryKeywords: string[];
  contentGaps: string[];
  recommendedSchemas: string[];
  aiSignals: {
    representativeQueries: string[];
    canonicalQuestions: string[];
  };
  geoPlaybook: {
    tone: string;
    aiVisibilityPlay: {
      headline: string;
      summary: string;
      supportingPoints: string[];
    };
    staticBlocks: Array<{ type: string; heading: string; body: string }>;
    faq: Array<{ question: string; answer: string }>;
  };
};

function slugify(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "project";
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => Boolean(entry));
}

function formatList(values: string[], fallback: string) {
  if (!values.length) return fallback;
  if (values.length === 1) return values[0];
  const last = values[values.length - 1];
  return `${values.slice(0, -1).join(", ")} and ${last}`;
}

function buildFaqAnswer(question: string, entry: ClusterDescriptor, tone: string) {
  const keyword = entry.primaryKeyword ?? entry.label;
  const summary = entry.summary || `Own the conversation around ${keyword}.`;
  const gap = entry.contentGaps[0] ?? null;
  const schema = entry.recommendedSchemas[0] ?? null;
  const related = entry.secondaryKeywords.slice(0, 2);
  const pieces = [
    `${tone} guidance: ${summary}`,
    `Lead with ${keyword} to satisfy ${entry.intent} intent when answering "${question}".`,
    gap ? `Close the documented gap "${gap}" with a definitive explainer.` : null,
    related.length ? `Reference related entities such as ${formatList(related, related[0])}.` : null,
    schema ? `Mark this block up with ${schema} schema to boost AI comprehension.` : null
  ].filter(Boolean) as string[];
  return pieces.join(" ");
}

function buildGeoModule(
  entry: ClusterDescriptor,
  canonicalQuestions: string[],
  tone: string,
  fallbackLang?: string
): GeoModule {
  const sanitizedTone = tone.trim() || DEFAULT_TONE;
  const lang = entry.lang ?? fallbackLang ?? "en";
  const primaryKeyword = entry.primaryKeyword ?? entry.label;
  const opportunityHook = entry.contentGaps[0] ?? `Expand static coverage for ${primaryKeyword}`;
  const supportingPoints = [
    `Anchor the module around ${primaryKeyword} to win ${entry.intent} intents.`,
    entry.secondaryKeywords.length
      ? `Weave in related entities like ${formatList(entry.secondaryKeywords.slice(0, 4), entry.secondaryKeywords[0])}.`
      : null,
    entry.contentGaps.length
      ? `Address the gap${entry.contentGaps.length > 1 ? "s" : ""}: ${entry.contentGaps
          .slice(0, 3)
          .join("; ")}.`
      : null,
    entry.recommendedSchemas.length
      ? `Ship structured data (${entry.recommendedSchemas.join(", ")}) to signal topical depth.`
      : null
  ].filter(Boolean) as string[];

  const faqSeeds = (canonicalQuestions.length ? canonicalQuestions : entry.representativeQueries).slice(0, 5);
  const faq = faqSeeds.map((question) => ({
    question,
    answer: buildFaqAnswer(question, entry, sanitizedTone)
  }));

  const staticBlocks = [
    {
      type: "overview",
      heading: `${entry.label} opportunity`,
      body: `${entry.summary || `Capture AI-ready demand for ${primaryKeyword}.`} ${opportunityHook}.`
    },
    {
      type: "ai-play",
      heading: "AI visibility play",
      body: `Launch a ${entry.intent} landing section in a ${sanitizedTone.toLowerCase()} voice that answers ${primaryKeyword} searches end-to-end.`
    },
    {
      type: "cta",
      heading: "Editorial next step",
      body: `Publish the FAQ block below verbatim as static content and pair it with ${formatList(
        entry.recommendedSchemas.length ? entry.recommendedSchemas : ["FAQ"],
        "FAQ"
      )} schema to maximize answer engine lift.`
    }
  ];

  return {
    clusterId: entry.id,
    label: entry.label,
    lang,
    intent: entry.intent,
    primaryKeyword,
    opportunityScore: entry.score ?? null,
    targetUrl: entry.primaryUrl ?? null,
    secondaryKeywords: entry.secondaryKeywords,
    contentGaps: entry.contentGaps,
    recommendedSchemas: entry.recommendedSchemas,
    aiSignals: {
      representativeQueries: entry.representativeQueries,
      canonicalQuestions: faqSeeds
    },
    geoPlaybook: {
      tone: sanitizedTone,
      aiVisibilityPlay: {
        headline: `${entry.label} GEO improvement`,
        summary: opportunityHook,
        supportingPoints: supportingPoints.length
          ? supportingPoints
          : [`Anchor the cluster around ${primaryKeyword} with authoritative copy.`]
      },
      staticBlocks,
      faq
    }
  };
}

export async function POST(req: NextRequest) {
  const { projectId, limit, lang, tone } = requestSchema.parse(await req.json());
  const pagePoints = await getProjectPoints(projectId, { lang, withVectors: false, limit: 10000 });

  if (!pagePoints.length) {
    return NextResponse.json({ error: "No content found for project" }, { status: 404 });
  }

  const clusterMap = new Map<string, ClusterDescriptor>();
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
        secondaryKeywords: ensureStringArray(payload.clusterSecondaryKeywords ?? payload.secondaryKeywords),
        contentGaps: ensureStringArray(payload.clusterContentGaps),
        representativeQueries: ensureStringArray(payload.clusterRepresentativeQueries),
        recommendedSchemas: ensureStringArray(payload.clusterRecommendedSchemas),
        lang: payload.lang ?? null,
        primaryUrl: payload.clusterPrimaryUrl ?? payload.url ?? null,
        score: typeof payload.score_opportunity === "number" ? payload.score_opportunity : null
      });
    }
    const entry = clusterMap.get(clusterId)!;
    if (!entry.lang && payload.lang) {
      entry.lang = payload.lang;
    }
    if (!entry.primaryUrl && typeof payload.url === "string") {
      entry.primaryUrl = payload.url;
    }
    const queries = ensureStringArray(payload.clusterRepresentativeQueries);
    if (queries.length) {
      entry.representativeQueries = Array.from(new Set([...entry.representativeQueries, ...queries]));
    }
  }

  if (!clusterMap.size) {
    return NextResponse.json({ error: "No clusters annotated" }, { status: 404 });
  }

  const queryPoints = await getProjectPoints(projectId, {
    lang,
    withVectors: false,
    types: ["query"],
    limit: 5000
  });
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

  const entries = Array.from(clusterMap.values()).slice(0, limit ?? clusterMap.size);
  const modules = entries.map((entry) => buildGeoModule(entry, queriesByCluster.get(entry.id) ?? [], tone ?? DEFAULT_TONE, lang));

  if (!modules.length) {
    return NextResponse.json({ error: "No GEO improvements available" }, { status: 404 });
  }

  const payload = {
    projectId,
    generatedAt: new Date().toISOString(),
    tone: tone ?? DEFAULT_TONE,
    moduleCount: modules.length,
    modules
  };

  const filename = `${slugify(projectId)}-geo-improvements.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
