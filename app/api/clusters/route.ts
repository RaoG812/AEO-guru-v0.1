// app/api/clusters/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import type { LanguageModelV1 } from "ai";
import { openai } from "@ai-sdk/openai";

import {
  getProjectPoints,
  kMeansCluster,
  type ProjectPoint,
  type Cluster
} from "@/lib/clustering";
import { COLLECTION, getQdrantClient } from "@/lib/qdrant";

const schema = z.object({ projectId: z.string() });

const clusterMetadataSchema = z.object({
  label: z.string().min(3),
  summary: z.string().min(10),
  intent: z.string().min(3),
  keywords: z.array(z.string()).min(3),
  contentGaps: z.array(z.string()).min(1),
  representativeQueries: z.array(z.string()).min(1).max(5)
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
    prompt: `You are an AI Overviews strategist. Based on the following content sections for project ${projectId}, identify what unifies them. Provide a concise label, primary audience intent, 3-6 specific keywords, 2-5 representative queries, and any clear content gaps or unmet needs. Respond with JSON that matches the schema exactly.\n\nSections:\n${context}`
  });

  return object;
}

async function persistClusterMetadata(
  cluster: Cluster,
  metadata: ClusterMetadata
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
      clusterKeywords: metadata.keywords,
      clusterRepresentativeQueries: metadata.representativeQueries,
      clusterContentGaps: metadata.contentGaps,
      clusterSize: cluster.pointIds.length
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const { projectId } = schema.parse(await req.json());
    const points = await getProjectPoints(projectId);

    if (!points.length) {
      return NextResponse.json({ clusters: [] });
    }

    const clusters = kMeansCluster(points);
    const model = openai("gpt-4.1-mini") as LanguageModelV1;

    const enrichedClusters: Array<Cluster & { metadata: ClusterMetadata }> = [];
    for (const cluster of clusters) {
      const metadata = await annotateCluster(model, projectId, points, cluster);
      await persistClusterMetadata(cluster, metadata);
      enrichedClusters.push({ ...cluster, metadata });
    }

    return NextResponse.json({
      clusters: enrichedClusters.map((cluster) => ({
        id: cluster.id,
        pointIds: cluster.pointIds,
        size: cluster.pointIds.length,
        metadata: cluster.metadata
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
