// lib/generators.ts
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import type { LanguageModelV1 } from "ai";
import { z } from "zod";
import type { PageContext } from "./project-content";

const faqPairsSchema = z.object({
  faqs: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string()
      })
    )
    .min(3)
});

const faqJsonLdSchema = z.object({
  "@context": z.literal("https://schema.org"),
  "@type": z.literal("FAQPage"),
  mainEntity: z.array(
    z.object({
      "@type": z.literal("Question"),
      name: z.string(),
      acceptedAnswer: z.object({
        "@type": z.literal("Answer"),
        text: z.string()
      })
    })
  ),
  url: z.string().url()
});

const articleSchema = z.object({
  "@context": z.literal("https://schema.org"),
  "@type": z.enum(["Article", "TechArticle", "BlogPosting"]),
  headline: z.string(),
  description: z.string(),
  mainEntityOfPage: z.string().url(),
  keywords: z.array(z.string()).min(2),
  inLanguage: z.string().default("en"),
  author: z
    .object({
      "@type": z.literal("Organization"),
      name: z.string()
    })
    .optional(),
  publisher: z
    .object({
      "@type": z.literal("Organization"),
      name: z.string()
    })
    .optional(),
  datePublished: z.string(),
  image: z.union([z.string().url(), z.array(z.string().url())]).optional()
});

const semanticCoreSchema = z.object({
  projectId: z.string(),
  executiveSummary: z.string(),
  focusTopics: z
    .array(
      z.object({
        topic: z.string(),
        audienceIntent: z.string(),
        supportingQueries: z.array(z.string()).min(1),
        recommendedActions: z.array(z.string()).min(1)
      })
    )
    .min(1),
  keyPages: z
    .array(
      z.object({
        url: z.string().url(),
        title: z.string().optional(),
        primaryIntent: z.string(),
        supportingContent: z.array(z.string()).min(1),
        schemaOpportunities: z.array(z.string()).min(1)
      })
    )
    .min(1)
});

export type FaqJsonLd = z.infer<typeof faqJsonLdSchema>;
export type ArticleJsonLd = z.infer<typeof articleSchema>;
export type SemanticCoreSummary = z.infer<typeof semanticCoreSchema>;
export const articleJsonLdValidator = articleSchema;
export const faqJsonLdValidator = faqJsonLdSchema;

export async function generateFaqJsonLd(
  url: string,
  clusterSummary: string
): Promise<FaqJsonLd> {
  const model = openai("gpt-4.1") as LanguageModelV1;
  const { object } = await generateObject({
    model,
    schema: faqPairsSchema,
    prompt: `You are an AEO-focused technical SEO. Based on this cluster summary, create 3-6 concise FAQ Q&A pairs that would help this page be cited by AI answer engines.\n\nCluster summary:\n${clusterSummary}`
  });

  const faqJsonLd = faqJsonLdSchema.parse({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": object.faqs.map((f) => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.answer
      }
    })),
    "url": url
  });

  return faqJsonLd;
}

export async function generateRobotsTxtFromSummary(summary: {
  rootUrl: string;
  disallowCandidates: string[];
}): Promise<string> {
  const { text } = await generateText({
    model: openai("gpt-4.1-mini") as LanguageModelV1,
    prompt: `You generate minimal, safe robots.txt for SEO. Output ONLY robots.txt content.\n\nInput:\n${JSON.stringify(
      summary,
      null,
      2
    )}`
  });

  return text.trim();
}

export async function generateArticleJsonLd(input: {
  url: string;
  title?: string | null;
  summary: string;
  projectId: string;
}): Promise<ArticleJsonLd> {
  const { url, title, summary, projectId } = input;
  const model = openai("gpt-4.1-mini") as LanguageModelV1;
  const { object } = await generateObject({
    model,
    schema: articleSchema,
    prompt: `You are an expert in structured data for AI Overviews. Craft an Article JSON-LD object for the page below. Return JSON only.\nProject: ${projectId}\nURL: ${url}\nTitle: ${title ?? "(missing)"}\nSummary:\n${summary}`
  });

  return object;
}

export async function generateSemanticCoreSummary(
  projectId: string,
  contexts: PageContext[]
): Promise<SemanticCoreSummary> {
  if (contexts.length === 0) {
    throw new Error("No content available for semantic core generation");
  }

  const model = openai("gpt-4.1") as LanguageModelV1;
  const { object } = await generateObject({
    model,
    schema: semanticCoreSchema,
    prompt: `You are an AEO strategist creating a semantic core for project ${projectId}. Use the following page contexts to describe focus topics, intents, and schema opportunities. Respond with JSON that matches the schema exactly.\n\nPage contexts:\n${JSON.stringify(
      contexts,
      null,
      2
    )}`
  });

  return object;
}
