// app/api/ingest/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getQdrantClient, COLLECTION, ensureCollection } from "@/lib/qdrant";
import { chunkText } from "@/lib/chunker";
import { embedTexts } from "@/lib/embeddings";
import { collectSitemapUrls, crawlSite, extractTextFromUrl, type ExtractedPage } from "@/lib/crawler";

const bodySchema = z.object({
  projectId: z.string().min(1),
  rootUrl: z.string().url().optional(),
  sitemapUrl: z.string().url().optional(),
  urls: z.array(z.string().url()).optional(),
  limit: z.number().int().min(1).max(60).optional()
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, rootUrl, sitemapUrl, urls = [], limit } = bodySchema.parse(body);

  if (!rootUrl && !sitemapUrl && urls.length === 0) {
    return NextResponse.json({ error: "Provide a rootUrl, sitemapUrl, or urls" }, { status: 400 });
  }

  const crawlLimit = limit ?? 20;
  const crawlResults: ExtractedPage[] = rootUrl ? await crawlSite(rootUrl, { limit: crawlLimit }) : [];
  const crawlMap = new Map(crawlResults.map((page) => [page.url, page]));

  const sitemapUrls = sitemapUrl ? await collectSitemapUrls(sitemapUrl, crawlLimit * 2) : [];
  const manualUrls = urls;
  const targetSet = new Set<string>([...sitemapUrls, ...manualUrls]);
  crawlResults.forEach((page) => targetSet.delete(page.url));

  for (const url of Array.from(targetSet.values())) {
    try {
      const page = await extractTextFromUrl(url);
      crawlMap.set(url, page);
      if (crawlMap.size >= crawlLimit * 2) break;
      await sleep(250);
    } catch (error) {
      console.warn("ingest:failed", url, error);
    }
  }

  if (!crawlMap.size) {
    return NextResponse.json({ error: "No pages extracted" }, { status: 422 });
  }

  const pages = Array.from(crawlMap.values());
  const chunksPayload: { id: string; text: string; meta: Record<string, any> }[] = [];

  for (const page of pages) {
    const chunks = chunkText(page.content);
    chunks.forEach((chunk, idx) => {
      const id = `${projectId}:${page.url}:chunk-${idx}`;
      chunksPayload.push({
        id,
        text: chunk.text,
        meta: {
          projectId,
          type: "page_section",
          url: page.url,
          title: page.title,
          h1: page.h1,
          lang: page.lang,
          chunkIndex: idx,
          chunkParagraphStart: chunk.startParagraph,
          chunkParagraphEnd: chunk.endParagraph,
          source: "site",
          content: chunk.text,
          clusterId: null,
          intent: null,
          primaryKeyword: null,
          secondaryKeywords: [],
          score_opportunity: null
        }
      });
    });
  }

  const vectors = await embedTexts(chunksPayload.map((chunk) => chunk.text));
  await ensureCollection(vectors[0].length);
  const qdrant = getQdrantClient();
  await qdrant.upsert(COLLECTION, {
    wait: true,
    points: chunksPayload.map((chunk, idx) => ({
      id: chunk.id,
      vector: vectors[idx],
      payload: chunk.meta
    }))
  });

  return NextResponse.json({
    ok: true,
    pagesIngested: pages.length,
    sectionsEmbedded: chunksPayload.length
  });
}
