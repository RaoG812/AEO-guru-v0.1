// lib/qdrant.ts
import { QdrantClient } from "@qdrant/js-client-rest";

if (!process.env.QDRANT_URL || !process.env.QDRANT_API_KEY) {
  throw new Error("Missing QDRANT_URL or QDRANT_API_KEY env variables");
}

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY
});

export const COLLECTION = "answergraph_corpus";

export async function ensureCollection(dim: number) {
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
