// app/api/ingest/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getQdrantClient, COLLECTION, ensureCollection } from "@/lib/qdrant";
import { extractTextFromUrl } from "@/lib/crawler";
import { chunkText } from "@/lib/chunker";
import { embedTexts } from "@/lib/embeddings";

const bodySchema = z.object({
  projectId: z.string(),
  urls: z.array(z.string().url())
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, urls } = bodySchema.parse(body);

  const chunksPayload: {
    id: string;
    text: string;
    meta: any;
  }[] = [];

  for (const url of urls) {
    const { title, h1, content } = await extractTextFromUrl(url);
    const chunks = chunkText(content);

    chunks.forEach((text, idx) => {
      chunksPayload.push({
        id: `${projectId}:${url}:${idx}`,
        text,
        meta: {
          projectId,
          url,
          title,
          h1,
          type: "page_section",
          chunkIndex: idx
        }
      });
    });
  }

  if (chunksPayload.length === 0) {
    return NextResponse.json({ ok: true, message: "No content" });
  }

  const vectors = await embedTexts(chunksPayload.map((c) => c.text));

  // Ensure collection with correct dimension
  await ensureCollection(vectors[0].length);

  const qdrant = getQdrantClient();
  await qdrant.upsert(COLLECTION, {
    wait: true,
    points: chunksPayload.map((c, i) => ({
      id: c.id,
      vector: vectors[i],
      payload: {
        ...c.meta,
        content: c.text,
        clusterId: null,
        intent: null,
        source: "site"
      }
    }))
  });

  return NextResponse.json({
    ok: true,
    points: chunksPayload.length
  });
}
