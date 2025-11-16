import { z } from "zod";
import { generateObject } from "ai";
import type { LanguageModelV1 } from "ai";
import { openai } from "@ai-sdk/openai";

import { embedTexts } from "./embeddings";
import { COLLECTION, ensureCollection, getQdrantClient } from "./qdrant";

const questionSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string(),
        intent: z
          .enum(["informational", "transactional", "navigational", "local", "mixed"])
          .optional()
      })
    )
    .min(3)
    .max(8)
});

export type GeneratedQuestion = z.infer<typeof questionSchema>["questions"][number];

export async function buildAnswerGraphNodes(input: {
  projectId: string;
  clusterId: string;
  clusterLabel: string;
  clusterSummary: string;
  intent: string;
  primaryKeyword: string;
  lang: string;
  primaryUrl?: string | null;
  secondaryKeywords?: string[];
}) {
  const model = openai("gpt-4.1-mini") as LanguageModelV1;
  const { object } = await generateObject({
    model,
    schema: questionSchema,
    prompt: `You maintain an answer graph for an AEO project. Create 3-8 canonical user questions that cover long-tail and short-tail search behavior for the topic below. Keep questions natural and grounded in the same language (${input.lang}).\n\nTopic label: ${input.clusterLabel}\nIntent: ${input.intent}\nPrimary keyword: ${input.primaryKeyword}\nCluster summary:\n${input.clusterSummary}`
  });

  const questions = object.questions;
  if (!questions.length) return [];

  const vectors = await embedTexts(questions.map((item) => item.question));
  await ensureCollection(vectors[0].length);
  const qdrant = getQdrantClient();

  const fallbackUrl =
    input.primaryUrl ?? `https://aeo-guru.local/project/${encodeURIComponent(input.projectId)}`;

  await qdrant.upsert(COLLECTION, {
    wait: true,
    points: questions.map((item, idx) => ({
      id: `${input.clusterId}:query:${Date.now()}:${idx}`,
      vector: vectors[idx],
      payload: {
        projectId: input.projectId,
        type: "query",
        source: "serp",
        url: fallbackUrl,
        title: item.question,
        h1: item.question,
        lang: input.lang,
        content: item.question,
        chunkIndex: idx,
        clusterId: input.clusterId,
        clusterLabel: input.clusterLabel,
        intent: item.intent ?? input.intent,
        primaryKeyword: input.primaryKeyword,
        secondaryKeywords: input.secondaryKeywords ?? [],
        score_opportunity: null
      }
    }))
  });

  return questions;
}
