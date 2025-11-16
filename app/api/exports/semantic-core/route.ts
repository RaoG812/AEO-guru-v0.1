// app/api/exports/semantic-core/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dump as toYaml } from "js-yaml";

import { getProjectPoints } from "@/lib/clustering";
import { buildPageContexts } from "@/lib/project-content";
import { generateSemanticCoreSummary } from "@/lib/generators";

const requestSchema = z.object({
  projectId: z.string(),
  limit: z.number().int().min(1).max(15).optional()
});

function slugify(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "project";
}

export async function POST(req: NextRequest) {
  const { projectId, limit } = requestSchema.parse(await req.json());
  const points = await getProjectPoints(projectId);

  if (!points.length) {
    return NextResponse.json(
      { error: "No content found for project" },
      { status: 404 }
    );
  }

  const contexts = buildPageContexts(points, {
    limit: limit ?? 8,
    maxChars: 2200
  });

  if (contexts.length === 0) {
    return NextResponse.json(
      { error: "Project does not have usable content" },
      { status: 404 }
    );
  }

  const semanticCore = await generateSemanticCoreSummary(projectId, contexts);
  const payload = {
    generatedAt: new Date().toISOString(),
    ...semanticCore
  };

  const yaml = toYaml(payload, { lineWidth: 100 });
  const filename = `${slugify(projectId)}-semantic-core.yaml`;

  return new NextResponse(yaml, {
    headers: {
      "Content-Type": "application/x-yaml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
