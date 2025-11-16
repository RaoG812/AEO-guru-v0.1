// app/api/exports/semantic-core/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dump as toYaml } from "js-yaml";

import { getProjectPoints } from "@/lib/clustering";

const requestSchema = z.object({
  projectId: z.string(),
  limit: z.number().int().min(1).max(25).optional(),
  lang: z.string().optional()
});

function slugify(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "project";
}

export async function POST(req: NextRequest) {
  const { projectId, limit, lang } = requestSchema.parse(await req.json());
  const pagePoints = await getProjectPoints(projectId, { lang, withVectors: false, limit: 10000 });
  const queryPoints = await getProjectPoints(projectId, {
    lang,
    withVectors: false,
    types: ["query"],
    limit: 10000
  });

  if (!pagePoints.length) {
    return NextResponse.json({ error: "No content found for project" }, { status: 404 });
  }

  const clusterMap = new Map<
    string,
    {
      id: string;
      label: string;
      summary: string;
      intent: string;
      primaryKeyword?: string | null;
      secondaryKeywords: string[];
      representativeQueries: string[];
      contentGaps: string[];
      recommendedSchemas: string[];
      urls: Set<string>;
      lang?: string | null;
      primaryUrl?: string | null;
      score?: number | null;
    }
  >();

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
        contentGaps: Array.isArray(payload.clusterContentGaps)
          ? payload.clusterContentGaps
          : [],
        recommendedSchemas: Array.isArray(payload.clusterRecommendedSchemas)
          ? payload.clusterRecommendedSchemas
          : [],
        urls: new Set(),
        lang: payload.lang ?? null,
        primaryUrl: payload.clusterPrimaryUrl ?? payload.url ?? null,
        score: typeof payload.score_opportunity === "number" ? payload.score_opportunity : null
      });
    }
    const entry = clusterMap.get(clusterId)!;
    if (typeof payload.url === "string") {
      entry.urls.add(payload.url);
    }
    if (!entry.primaryUrl && typeof payload.url === "string") {
      entry.primaryUrl = payload.url;
    }
    if (!entry.lang && payload.lang) {
      entry.lang = payload.lang;
    }
  }

  const queriesByCluster = new Map<string, string[]>();
  for (const point of queryPoints) {
    const payload = point.payload ?? {};
    const clusterId = payload.clusterId;
    if (!clusterId) continue;
    if (!queriesByCluster.has(clusterId)) {
      queriesByCluster.set(clusterId, []);
    }
    if (typeof payload.content === "string") {
      queriesByCluster.get(clusterId)!.push(payload.content);
    }
  }

  const clusterEntries = Array.from(clusterMap.values())
    .slice(0, limit ?? clusterMap.size)
    .map((entry) => {
      const canonicalQuestions = queriesByCluster.get(entry.id) ?? [];
      const relatedQueries = Array.from(
        new Set([...entry.representativeQueries, ...canonicalQuestions])
      );
      return {
        clusterId: entry.id,
        label: entry.label,
        intent: entry.intent,
        lang: entry.lang ?? lang ?? "en",
        primaryUrl: entry.primaryUrl ?? null,
        primaryKeyword: entry.primaryKeyword ?? null,
        relatedQueries,
        canonicalQuestions,
        contentGaps: entry.contentGaps,
        recommendedNewPages: entry.contentGaps.map((gap) => `Create or expand coverage for: ${gap}`),
        recommendedSchemas: entry.recommendedSchemas,
        opportunityScore: entry.score ?? null,
        urls: Array.from(entry.urls),
        summary: entry.summary
      };
    })
    .filter((cluster) => cluster.primaryUrl || cluster.urls.length);

  if (!clusterEntries.length) {
    return NextResponse.json({ error: "No clusters annotated" }, { status: 404 });
  }

  const yamlPayload = {
    projectId,
    generatedAt: new Date().toISOString(),
    clusterCount: clusterEntries.length,
    clusters: clusterEntries
  };

  const yaml = toYaml(yamlPayload, { lineWidth: 100 });
  const filename = `${slugify(projectId)}-semantic-core.yaml`;

  return new NextResponse(yaml, {
    headers: {
      "Content-Type": "application/x-yaml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
