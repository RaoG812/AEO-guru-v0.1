// lib/embeddings.ts
import { embedMany } from "ai";

import { embeddingModel } from "./ai-gateway";

const model = embeddingModel();

export async function embedTexts(texts: string[]): Promise<number[][]> {
  // You can add chunking if texts.length is large
  const { embeddings } = await embedMany({
    model,
    values: texts
  });

  return embeddings;
}
