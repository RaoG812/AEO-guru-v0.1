// app/api/exports/jsonld/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getProjectPoints } from "@/lib/clustering";
import { buildPageContexts } from "@/lib/project-content";
import {
  generateArticleJsonLd,
  generateFaqJsonLd,
  articleJsonLdValidator,
  faqJsonLdValidator
} from "@/lib/generators";

const requestSchema = z.object({
  projectId: z.string(),
  limit: z.number().int().min(1).max(10).optional()
});

const jsonLdExportSchema = z.object({
  projectId: z.string(),
  generatedAt: z.string(),
  pages: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().nullable().optional(),
        article: articleJsonLdValidator,
        faq: faqJsonLdValidator
      })
    )
    .min(1)
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
    limit: limit ?? 4,
    maxChars: 2000
  });

  if (contexts.length === 0) {
    return NextResponse.json(
      { error: "Project does not have usable content" },
      { status: 404 }
    );
  }

  const pages = [] as Array<{
    url: string;
    title: string | null | undefined;
    article: z.infer<typeof articleJsonLdValidator>;
    faq: z.infer<typeof faqJsonLdValidator>;
  }>;

  for (const ctx of contexts) {
    const summarySegments = [ctx.title, ctx.h1, ctx.content]
      .filter(Boolean)
      .join(" | ");
    const [article, faq] = await Promise.all([
      generateArticleJsonLd({
        url: ctx.url,
        title: ctx.title ?? ctx.h1,
        summary: summarySegments,
        projectId
      }),
      generateFaqJsonLd(ctx.url, summarySegments)
    ]);

    pages.push({
      url: ctx.url,
      title: ctx.title ?? ctx.h1 ?? null,
      article,
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
