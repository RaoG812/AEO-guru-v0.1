// lib/generators.ts
import { generateObject, generateText } from "ai";
import { z } from "zod";
import type { PageContext } from "./project-content";
import { fastModel, reasoningModel, structuredModel } from "./ai-gateway";

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

const allowedSchemaTypes = [
  "Article",
  "BlogPosting",
  "TechArticle",
  "FAQPage",
  "HowTo",
  "Product",
  "LocalBusiness"
] as const;

const baseJsonLdSchema = z
  .object({
    "@context": z.literal("https://schema.org"),
    "@type": z.enum(allowedSchemaTypes),
    url: z.string().url(),
    name: z.string(),
    description: z.string(),
    inLanguage: z.string().min(2),
    keywords: z.array(z.string()).min(2),
    headline: z.string().optional(),
    mainEntityOfPage: z.string().url().optional(),
    datePublished: z.string().optional()
  })
  .passthrough();

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
export type PageJsonLd = z.infer<typeof baseJsonLdSchema>;
export type SemanticCoreSummary = z.infer<typeof semanticCoreSchema>;
export const pageJsonLdValidator = baseJsonLdSchema;
export const faqJsonLdValidator = faqJsonLdSchema;

export async function generateFaqJsonLd(
  url: string,
  clusterSummary: string
): Promise<FaqJsonLd> {
  const model = reasoningModel();
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

type RobotsSummary = {
  rootUrl: string;
  disallowCandidates: string[];
  duplicatePatterns?: string[];
  rationale: string[];
  crawlDelay?: number;
  sitemapUrls?: string[];
  requestedAgents?: string[];
  forbiddenPaths?: string[];
};

export async function generateRobotsTxtFromSummary(summary: RobotsSummary): Promise<string> {
  const { text } = await generateText({
    model: fastModel(),
    prompt: `You are an enterprise technical SEO that writes defensive robots.txt files for modern crawlers. Always:
- address each requested user-agent with its own block before the wildcard
- include a wildcard (*) fallback section
- reflect any crawl-delay and sitemap URLs provided
- describe the intent for disallows using concise # comments so ops teams understand the change
- prefer Allow over Disallow unless explicitly harmful.
- ensure every entry listed in forbiddenPaths is explicitly disallowed for the matching crawlers.

Return ONLY robots.txt content. Avoid extra prose.\n\nContext:\n${JSON.stringify(
      summary,
      null,
      2
    )}`
  });

  return text.trim();
}

export async function generateIntentDrivenJsonLd(input: {
  url: string;
  title?: string | null;
  summary: string;
  projectId: string;
  preferredType?: string | null;
  intent?: string | null;
  lang?: string | null;
  keywords?: string[];
}): Promise<PageJsonLd> {
  const { url, title, summary, projectId, preferredType, intent, lang, keywords } = input;
  const model = structuredModel();
  const { object } = await generateObject({
    model,
    schema: baseJsonLdSchema,
    prompt: `You are an expert in structured data for AI Overviews. Build JSON-LD for one page. Prefer the schema type ${preferredType ?? "that best matches"} based on the intent "${intent ?? "unknown"}". Allowed types: ${allowedSchemaTypes.join(", ")}. Use the same language as the content (${lang ?? "en"}). Return JSON only.\nProject: ${projectId}\nURL: ${url}\nTitle: ${title ?? "(missing)"}\nSummary:\n${summary}\nCandidate keywords: ${(keywords ?? []).join(", ")}`
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

  const model = reasoningModel();
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
