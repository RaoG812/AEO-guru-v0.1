// app/api/projects/[projectId]/vectors/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getProjectPoints, type ProjectPoint } from "@/lib/clustering";

type Distribution = { label: string; count: number };

type VectorSample = {
  id: string;
  url: string | null;
  title: string | null;
  intent: string | null;
  primaryKeyword: string | null;
  lang: string | null;
  magnitude: number | null;
  preview: number[];
};

type VectorSummary = {
  totalPoints: number;
  vectorDimension: number | null;
  avgMagnitude: number | null;
  maxMagnitude: number | null;
  languages: Distribution[];
  intents: Distribution[];
  sources: Distribution[];
  samples: VectorSample[];
};

const searchSchema = z.object({ lang: z.string().optional() });

function computeMagnitude(vector?: number[] | null): number | null {
  if (!Array.isArray(vector) || vector.length === 0) return null;
  const energy = vector.reduce((sum, value) => sum + value * value, 0);
  if (!Number.isFinite(energy)) return null;
  return Math.sqrt(energy);
}

function buildDistribution(
  points: ProjectPoint[],
  pick: (payload: ProjectPoint["payload"] | undefined) => string | null,
  limit = 4
): Distribution[] {
  const counts = new Map<string, number>();
  for (const point of points) {
    const key = pick(point.payload);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function buildSamples(points: ProjectPoint[], limit = 5): VectorSample[] {
  return points
    .filter((point) => Array.isArray(point.vector) && point.vector.length > 0)
    .sort((a, b) => {
      const scoreA = Number(a.payload?.score_opportunity ?? 0);
      const scoreB = Number(b.payload?.score_opportunity ?? 0);
      return scoreB - scoreA;
    })
    .slice(0, limit)
    .map((point) => {
      const payload = point.payload ?? {};
      const url = typeof payload.url === "string" ? payload.url : null;
      const title =
        typeof payload.title === "string"
          ? payload.title
          : typeof payload.h1 === "string"
            ? payload.h1
            : null;
      const intent =
        typeof payload.intent === "string"
          ? payload.intent
          : typeof payload.clusterIntent === "string"
            ? payload.clusterIntent
            : null;
      const primaryKeyword =
        typeof payload.primaryKeyword === "string"
          ? payload.primaryKeyword
          : typeof payload.clusterPrimaryKeyword === "string"
            ? payload.clusterPrimaryKeyword
            : null;
      const lang = typeof payload.lang === "string" ? payload.lang : null;
      return {
        id: String(point.id),
        url,
        title,
        intent,
        primaryKeyword,
        lang,
        magnitude: computeMagnitude(point.vector as number[] | null),
        preview: Array.isArray(point.vector) ? point.vector.slice(0, 8) : []
      };
    });
}

function summarizeVectors(points: ProjectPoint[]): VectorSummary {
  const vectorPoint = points.find((point) => Array.isArray(point.vector) && point.vector.length > 0);
  const magnitudes = points
    .map((point) => computeMagnitude(point.vector as number[] | null))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const avgMagnitude = magnitudes.length
    ? Number((magnitudes.reduce((sum, value) => sum + value, 0) / magnitudes.length).toFixed(3))
    : null;
  const maxMagnitude = magnitudes.length
    ? Number(Math.max(...magnitudes).toFixed(3))
    : null;

  return {
    totalPoints: points.length,
    vectorDimension: vectorPoint?.vector ? vectorPoint.vector.length : null,
    avgMagnitude,
    maxMagnitude,
    languages: buildDistribution(points, (payload) =>
      typeof payload?.lang === "string" ? payload.lang : null
    ),
    intents: buildDistribution(points, (payload) => {
      if (typeof payload?.intent === "string") return payload.intent;
      if (typeof payload?.clusterIntent === "string") return payload.clusterIntent;
      return null;
    }),
    sources: buildDistribution(points, (payload) =>
      typeof payload?.source === "string" ? payload.source : null
    ),
    samples: buildSamples(points)
  };
}

export async function GET(req: NextRequest, context: { params: { projectId: string } }) {
  try {
    const projectId = context.params?.projectId;
    if (!projectId) {
      return NextResponse.json({ ok: false, error: "Missing project id" }, { status: 400 });
    }

    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const { lang } = searchSchema.parse(searchParams);

    const points = await getProjectPoints(projectId, { lang, withVectors: true, limit: 2000 });
    if (!points.length) {
      return NextResponse.json({ ok: true, summary: null });
    }

    const summary = summarizeVectors(points);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("Vector summary failed", error);
    return NextResponse.json(
      { ok: false, error: (error as Error).message ?? "Unable to summarize vectors" },
      { status: 500 }
    );
  }
}
