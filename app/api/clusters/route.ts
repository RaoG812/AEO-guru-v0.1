// app/api/clusters/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import type { LanguageModelV1 } from "ai";
import { google } from "@ai-sdk/google";

import {
  getProjectPoints,
  kMeansCluster,
  type ProjectPoint,
  type Cluster
} from "@/lib/clustering";
import { COLLECTION, getQdrantClient } from "@/lib/qdrant";
import { buildAnswerGraphNodes } from "@/lib/answer-graph";

const schema = z.object({ projectId: z.string(), lang: z.string().optional() });

const clusterMetadataSchema = z.object({
  label: z.string().min(3),
  summary: z.string().min(20),
  intent: z.enum(["informational", "transactional", "navigational", "local", "mixed"]),
  primaryKeyword: z.string().min(3),
  secondaryKeywords: z.array(z.string()).min(2),
  contentGaps: z.array(z.string()).min(1),
  representativeQueries: z.array(z.string()).min(2).max(6),
  recommendedSchemas: z.array(z.string()).min(1)
});

type ClusterMetadata = z.infer<typeof clusterMetadataSchema>;

function idsAreNumbers(ids: Array<string | number>): ids is number[] {
  return ids.every((id) => typeof id === "number");
}

function idsAreStrings(ids: Array<string | number>): ids is string[] {
  return ids.every((id) => typeof id === "string");
}

function buildClusterContext(points: ProjectPoint[], cluster: Cluster) {
  const lookup = new Map<string, ProjectPoint>();
  for (const point of points) {
    lookup.set(String(point.id), point);
  }

  const segments: string[] = [];
  for (const pointId of cluster.pointIds.slice(0, 6)) {
    const point = lookup.get(String(pointId));
    if (!point) continue;
    const payload = point.payload ?? {};
    const url = typeof payload.url === "string" ? payload.url : "";
    const title =
      typeof payload.title === "string"
        ? payload.title
        : typeof payload.h1 === "string"
        ? payload.h1
        : null;
    const content = typeof payload.content === "string" ? payload.content : "";
    const snippet = content.replace(/\s+/g, " ").slice(0, 400);
    segments.push(
      `URL: ${url}\nTitle: ${title ?? "(unknown)"}\nSnippet: ${snippet}`
    );
  }

  return segments.join("\n---\n");
}

function determinePrimaryUrl(points: ProjectPoint[], cluster: Cluster) {
  const lookup = new Map<string, ProjectPoint>();
  for (const point of points) {
    lookup.set(String(point.id), point);
  }
  for (const pointId of cluster.pointIds) {
    const match = lookup.get(String(pointId));
    const url = match?.payload?.url;
    if (typeof url === "string") {
      return url;
    }
  }
  return null;
}

function deriveLang(points: ProjectPoint[], cluster: Cluster) {
  const lookup = new Map<string, ProjectPoint>();
  for (const point of points) {
    lookup.set(String(point.id), point);
  }
  for (const pointId of cluster.pointIds) {
    const match = lookup.get(String(pointId));
    const lang = match?.payload?.lang;
    if (typeof lang === "string") {
      return lang;
    }
  }
  return "en";
}

function clusterPoints(points: ProjectPoint[]) {
  const vectorCount = points.filter(
    (point): point is ProjectPoint & { vector: number[] } =>
      Array.isArray(point.vector) && point.vector.length > 0
  ).length;
  if (vectorCount >= 2) {
    const desiredClusterSize = Math.min(
      40,
      Math.max(8, Math.round(points.length / Math.max(1, Math.log(points.length + 1))))
    );
    const maxClusters = Math.max(
      1,
      Math.min(32, Math.round(points.length / Math.max(1, desiredClusterSize)))
    );
    return kMeansCluster(points, { desiredClusterSize, maxClusters });
  }
  return kMeansCluster(points);
}

async function annotateCluster(
  model: LanguageModelV1,
  projectId: string,
  points: ProjectPoint[],
  cluster: Cluster
): Promise<ClusterMetadata> {
  const context = buildClusterContext(points, cluster) || "No content";
  const { object } = await generateObject({
    model,
    schema: clusterMetadataSchema,
    prompt: `You are an AI Overviews strategist. Based on the following content sections for project ${projectId}, identify what unifies them. Provide a concise label, the dominant search intent, a primary keyword, 3+ secondary keywords, 2-6 representative queries, at least one content gap, and schema types that would help this topic win AI Overviews. Respond with JSON that matches the schema exactly.\n\nSections:\n${context}`
  });

  return object;
}

function computeOpportunityScore(size: number) {
  return Math.min(100, Math.round(40 + size * 4));
}

async function persistClusterMetadata(
  cluster: Cluster,
  metadata: ClusterMetadata,
  options: { primaryUrl: string | null; score: number; lang: string }
) {
  const qdrant = getQdrantClient();
  let pointIds: string[] | number[];
  if (idsAreNumbers(cluster.pointIds)) {
    pointIds = cluster.pointIds;
  } else if (idsAreStrings(cluster.pointIds)) {
    pointIds = cluster.pointIds;
  } else {
    pointIds = cluster.pointIds.map((id) => id.toString());
  }
  await qdrant.setPayload(COLLECTION, {
    points: pointIds,
    payload: {
      clusterId: cluster.id,
      clusterLabel: metadata.label,
      clusterSummary: metadata.summary,
      clusterIntent: metadata.intent,
      clusterPrimaryKeyword: metadata.primaryKeyword,
      clusterSecondaryKeywords: metadata.secondaryKeywords,
      clusterKeywords: [metadata.primaryKeyword, ...metadata.secondaryKeywords],
      clusterRepresentativeQueries: metadata.representativeQueries,
      clusterContentGaps: metadata.contentGaps,
      clusterRecommendedSchemas: metadata.recommendedSchemas,
      clusterSize: cluster.pointIds.length,
      clusterPrimaryUrl: options.primaryUrl,
      clusterLang: options.lang,
      clusterOpportunityScore: options.score,
      intent: metadata.intent,
      primaryKeyword: metadata.primaryKeyword,
      secondaryKeywords: metadata.secondaryKeywords,
      score_opportunity: options.score
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, lang } = schema.parse(await req.json());
    const points = await getProjectPoints(projectId, { lang, withVectors: true });

    if (!points.length) {
      return NextResponse.json({ clusters: [] });
    }

    const clusters = clusterPoints(points);
    const model = google("gemini-2.0-flash-lite") as LanguageModelV1;

    const enrichedClusters: Array<
      Cluster & { metadata: ClusterMetadata; questions: string[]; lang: string; primaryUrl: string | null; score: number }
    > = [];
    for (const cluster of clusters) {
      const metadata = await annotateCluster(model, projectId, points, cluster);
      const primaryUrl = determinePrimaryUrl(points, cluster);
      const langForCluster = lang ?? deriveLang(points, cluster);
      const score = computeOpportunityScore(cluster.pointIds.length);
      await persistClusterMetadata(cluster, metadata, { primaryUrl, score, lang: langForCluster });
      const generatedQuestions = await buildAnswerGraphNodes({
        projectId,
        clusterId: cluster.id,
        clusterLabel: metadata.label,
        clusterSummary: metadata.summary,
        intent: metadata.intent,
        primaryKeyword: metadata.primaryKeyword,
        lang: langForCluster,
        primaryUrl,
        secondaryKeywords: metadata.secondaryKeywords
      });
      enrichedClusters.push({
        ...cluster,
        metadata,
        questions: generatedQuestions.map((q) => q.question),
        lang: langForCluster,
        primaryUrl,
        score
      });
    }

    return NextResponse.json({
      clusters: enrichedClusters.map((cluster) => ({
        id: cluster.id,
        pointIds: cluster.pointIds,
        size: cluster.pointIds.length,
        metadata: cluster.metadata,
        lang: cluster.lang,
        primaryUrl: cluster.primaryUrl,
        opportunityScore: cluster.score,
        questions: cluster.questions
      }))
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
