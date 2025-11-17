export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dump as toYaml } from "js-yaml";

import { getProjectPoints } from "@/lib/clustering";
import { buildPageContexts } from "@/lib/project-content";
import { generateSemanticCoreSummary } from "@/lib/generators";
import { resolveProjectUserContext } from "../context";

const enlargePayloadSchema = z
  .object({
    limit: z.number().int().min(3).max(12).optional(),
    maxChars: z.number().int().min(500).max(5000).optional(),
    manualNotes: z.string().max(8000).optional(),
    semanticCoreYaml: z.string().max(20000).optional()
  })
  .optional();

type Params = { params: { projectId: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const context = await resolveProjectUserContext(req);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch (error) {
    body = {};
  }

  const payload = enlargePayloadSchema.parse(body) ?? {};
  const projectId = params.projectId;

  try {
    const points = await getProjectPoints(projectId, { withVectors: false, limit: 10000 });
    if (!points.length) {
      return NextResponse.json(
        { ok: false, error: "No crawl insights available for this project" },
        { status: 404 }
      );
    }

    const contexts = buildPageContexts(points, {
      limit: payload.limit ?? 6,
      maxChars: payload.maxChars ?? 2000
    });

    if (!contexts.length) {
      return NextResponse.json(
        { ok: false, error: "No usable contexts detected for this project" },
        { status: 404 }
      );
    }

    const summary = await generateSemanticCoreSummary(projectId, contexts, {
      manualNotes: payload.manualNotes,
      semanticCoreYaml: payload.semanticCoreYaml
    });

    const yaml = toYaml(
      {
        projectId,
        generatedAt: new Date().toISOString(),
        executiveSummary: summary.executiveSummary,
        focusTopics: summary.focusTopics,
        keyPages: summary.keyPages
      },
      { lineWidth: 100 }
    );

    const records = contexts.map((ctx) => ({
      url: ctx.url,
      title: ctx.title ?? ctx.h1 ?? null,
      clusterLabel: ctx.clusterLabel ?? null,
      intent: ctx.clusterIntent ?? null,
      primaryKeyword: ctx.primaryKeyword ?? null,
      lang: ctx.lang ?? null,
      recommendedSchemas: ctx.recommendedSchemas ?? [],
      excerpt: ctx.content.slice(0, 280)
    }));

    return NextResponse.json({
      ok: true,
      semanticCoreYaml: yaml,
      summary,
      records
    });
  } catch (error) {
    console.error("core:enlarge", error);
    return NextResponse.json(
      { ok: false, error: "Unable to enlarge the core" },
      { status: 500 }
    );
  }
}
