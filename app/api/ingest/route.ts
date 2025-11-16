// app/api/ingest/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { detectOne } from "langdetect";
import { getQdrantClient, COLLECTION, ensureCollection } from "@/lib/qdrant";
import { extractTextFromUrl } from "@/lib/crawler";
import { chunkText } from "@/lib/chunker";
import { embedTexts } from "@/lib/embeddings";

type PayloadSource = "site";

/**
 * Metadata stored along every vector chunk we ingest into Qdrant.
 * The schema is intentionally explicit so downstream consumers can
 * rely on the presence (and nullability) of each attribute.
 */
type ChunkMetadata = {
  projectId: string;
  url: string;
  title: string;
  h1: string;
  type: "page_section";
  chunkIndex: number;
  source: PayloadSource;
  clusterId: string | null;
  intent: string | null;
  lang: string;
  primaryKeyword: string | null;
  score_opportunity: number | null;
};

type ChunkPayload = {
  id: string;
  text: string;
  meta: ChunkMetadata;
};

const bodySchema = z.object({
  projectId: z.string(),
  urls: z.array(z.string().url())
});

const detectLanguage = (text: string) => {
  if (!text.trim()) {
    return "und";
  }

  try {
    return detectOne(text) || "und";
  } catch (error) {
    console.warn("language detection failed", error);
    return "und";
  }
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, urls } = bodySchema.parse(body);

  const chunksPayload: ChunkPayload[] = [];

  for (const url of urls) {
    const { title, h1, content } = await extractTextFromUrl(url);
    const lang = detectLanguage([title, h1, content].join(" "));
    const baseMetadata: Omit<ChunkMetadata, "chunkIndex"> = {
      projectId,
      url,
      title,
      h1,
      type: "page_section",
      source: "site",
      clusterId: null,
      intent: null,
      lang,
      primaryKeyword: null,
      score_opportunity: null
    };
    const chunks = chunkText(content);

    chunks.forEach((text, idx) => {
      chunksPayload.push({
        id: `${projectId}:${url}:${idx}`,
        text,
        meta: {
          ...baseMetadata,
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
        content: c.text
      }
    }))
  });

  return NextResponse.json({
    ok: true,
    points: chunksPayload.length
  });
}
