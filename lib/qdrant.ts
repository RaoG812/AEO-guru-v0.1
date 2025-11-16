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

export async function ensureCollection(dim: number) {
  const qdrant = getQdrantClient();
  const collections = await qdrant.getCollections();
  const exists = collections.collections?.some(
    (c) => c.name === COLLECTION
  );

  if (!exists) {
    await qdrant.createCollection(COLLECTION, {
      vectors: {
        size: dim,
        distance: "Cosine"
      }
    });
  }
}
