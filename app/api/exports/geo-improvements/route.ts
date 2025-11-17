// app/api/exports/geo-improvements/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getProjectPoints } from "@/lib/clustering";
import { generateGeoImprovementBlueprint, geoImprovementSectionValidator } from "@/lib/generators";

const requestSchema = z.object({
  projectId: z.string(),
  limit: z.number().int().min(1).max(10).optional(),
  lang: z.string().optional()
});

const geoExportSchema = z.object({
  projectId: z.string(),
  generatedAt: z.string(),
  recommendations: z
    .array(
      z.object({
        clusterId: z.string(),
        label: z.string(),
        intent: z.string(),
        lang: z.string(),
        primaryKeyword: z.string().nullable(),
        aiOverviewHook: z.string(),
        evergreenSections: z.array(geoImprovementSectionValidator).min(2),
        snippetIdeas: z.array(z.string()).min(2),
        schemaTargets: z.array(z.string()).min(1),
        faqSeeds: z.array(z.string()).min(2),
        internalLinks: z.array(z.string()).min(1)
      })
    )
    .min(1)
});

function slugify(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "project";
}

export async function POST(req: NextRequest) {
  const { projectId, limit, lang } = requestSchema.parse(await req.json());
  const points = await getProjectPoints(projectId, { lang, withVectors: false, limit: 10000 });

  if (!points.length) {
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
    }
  >();

  for (const point of points) {
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
        contentGaps: Array.isArray(payload.clusterContentGaps) ? payload.clusterContentGaps : [],
        recommendedSchemas: Array.isArray(payload.clusterRecommendedSchemas)
          ? payload.clusterRecommendedSchemas
          : [],
        urls: new Set(),
        lang: payload.lang ?? null,
        primaryUrl: payload.clusterPrimaryUrl ?? payload.url ?? null
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
    if (typeof payload.content === "string") {
      entry.summary ||= payload.content;
    }
  }

  const clusterEntries = Array.from(clusterMap.values())
    .filter((entry) => entry.primaryUrl || entry.urls.size)
    .slice(0, limit ?? 4);

  if (!clusterEntries.length) {
    return NextResponse.json({ error: "No annotated clusters" }, { status: 404 });
  }

  const recommendations = [] as Array<z.infer<typeof geoExportSchema>["recommendations"][number]>;

  for (const entry of clusterEntries) {
    const blueprint = await generateGeoImprovementBlueprint({
      projectId,
      clusterLabel: entry.label,
      summary: entry.summary,
      intent: entry.intent,
      lang: entry.lang ?? lang ?? "en",
      primaryKeyword: entry.primaryKeyword,
      secondaryKeywords: entry.secondaryKeywords,
      representativeQueries: entry.representativeQueries,
      contentGaps: entry.contentGaps
    });

    const internalLinks = entry.urls.size
      ? Array.from(entry.urls)
      : entry.primaryUrl
      ? [entry.primaryUrl]
      : [];

    recommendations.push({
      clusterId: entry.id,
      label: entry.label,
      intent: entry.intent,
      lang: entry.lang ?? lang ?? "en",
      primaryKeyword: entry.primaryKeyword ?? null,
      aiOverviewHook: blueprint.aiOverviewHook,
      evergreenSections: blueprint.evergreenSections,
      snippetIdeas: blueprint.snippetIdeas,
      schemaTargets: blueprint.schemaTargets.length
        ? blueprint.schemaTargets
        : entry.recommendedSchemas,
      faqSeeds: blueprint.faqSeeds,
      internalLinks
    });
  }

  const payload = geoExportSchema.parse({
    projectId,
    generatedAt: new Date().toISOString(),
    recommendations
  });

  const filename = `${slugify(projectId)}-geo-improvements.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
