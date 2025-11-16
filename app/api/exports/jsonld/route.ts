// app/api/exports/jsonld/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getProjectPoints } from "@/lib/clustering";
import { buildPageContexts } from "@/lib/project-content";
import {
  generateIntentDrivenJsonLd,
  generateFaqJsonLd,
  pageJsonLdValidator,
  faqJsonLdValidator
} from "@/lib/generators";

const requestSchema = z.object({
  projectId: z.string(),
  limit: z.number().int().min(1).max(10).optional(),
  lang: z.string().optional()
});

const jsonLdExportSchema = z.object({
  projectId: z.string(),
  generatedAt: z.string(),
  pages: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().nullable().optional(),
        intent: z.string().nullable().optional(),
        schema: pageJsonLdValidator,
        faq: faqJsonLdValidator
      })
    )
    .min(1)
});

const intentSchemaFallback: Record<string, string> = {
  informational: "Article",
  transactional: "Product",
  navigational: "Article",
  local: "LocalBusiness",
  mixed: "Article"
};

function slugify(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "project";
}

export async function POST(req: NextRequest) {
  const { projectId, limit, lang } = requestSchema.parse(await req.json());
  const points = await getProjectPoints(projectId, { lang, withVectors: false });

  if (!points.length) {
    return NextResponse.json({ error: "No content found for project" }, { status: 404 });
  }

  const contexts = buildPageContexts(points, {
    limit: limit ?? 4,
    maxChars: 2000
  });

  if (contexts.length === 0) {
    return NextResponse.json({ error: "Project does not have usable content" }, { status: 404 });
  }

  const pages = [] as Array<z.infer<typeof jsonLdExportSchema>["pages"][number]>;

  for (const ctx of contexts) {
    const summarySegments = [ctx.title, ctx.h1, ctx.content]
      .filter(Boolean)
      .join(" | ");
    const preferredType = ctx.recommendedSchemas?.[0] ?? intentSchemaFallback[ctx.clusterIntent ?? ""];
    const schema = await generateIntentDrivenJsonLd({
      url: ctx.url,
      title: ctx.title ?? ctx.h1,
      summary: summarySegments,
      projectId,
      preferredType: preferredType ?? undefined,
      intent: ctx.clusterIntent,
      lang: ctx.lang,
      keywords: ctx.primaryKeyword ? [ctx.primaryKeyword] : undefined
    });
    const faq = await generateFaqJsonLd(ctx.url, summarySegments);
    pages.push({
      url: ctx.url,
      title: ctx.title ?? ctx.h1 ?? null,
      intent: ctx.clusterIntent ?? null,
      schema,
      faq
    });
  }

  const payload = jsonLdExportSchema.parse({
    projectId,
    generatedAt: new Date().toISOString(),
    pages
  });

  const filename = `${slugify(projectId)}-jsonld.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
