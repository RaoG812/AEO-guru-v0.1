// lib/embeddings.ts
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";

const model = openai.textEmbeddingModel("text-embedding-3-small");

export async function embedTexts(texts: string[]): Promise<number[][]> {
  // You can add chunking if texts.length is large
  const { embeddings } = await embedMany({
    model,
    values: texts
  });

  return embeddings;
}
