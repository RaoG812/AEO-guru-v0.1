// lib/qdrant.ts
import { QdrantClient } from "@qdrant/js-client-rest";

let qdrantClient: QdrantClient | null = null;

export function getQdrantClient() {
  if (!qdrantClient) {
    const url = process.env.QDRANT_URL;
    const apiKey = process.env.QDRANT_API_KEY;
    if (!url || !apiKey) {
      throw new Error("Missing QDRANT_URL or QDRANT_API_KEY env variables");
    }
    qdrantClient = new QdrantClient({ url, apiKey });
  }

  return qdrantClient;
}

export const COLLECTION = "aeo_guru_corpus";

async function ensureKeywordIndex(fieldName: string) {
  const qdrant = getQdrantClient();
  try {
    await qdrant.createPayloadIndex(COLLECTION, {
      field_name: fieldName,
      field_schema: {
        type: "keyword"
      }
    });
  } catch (error) {
    const message = (error as Error)?.message ?? "";
    if (!message.toLowerCase().includes("already exists")) {
      throw error;
    }
  }
}

export async function ensureCollection(dim: number) {
  const qdrant = getQdrantClient();
  const collections = await qdrant.getCollections();
  const exists = collections.collections?.some((c) => c.name === COLLECTION);

  if (!exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: {
        size: dim,
        distance: "Cosine"
      }
    });
  }

  await Promise.all([
    ensureKeywordIndex("projectId"),
    ensureKeywordIndex("type"),
    ensureKeywordIndex("source"),
    ensureKeywordIndex("lang")
  ]);
}
