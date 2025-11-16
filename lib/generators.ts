// lib/generators.ts
import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import type { LanguageModelV1 } from "ai";
import { z } from "zod";

const faqSchema = z.object({
  faqs: z.array(
    z.object({
      question: z.string(),
      answer: z.string()
    })
  )
});

export async function generateFaqJsonLd(
  url: string,
  clusterSummary: string
): Promise<any> {
  const model = openai("gpt-4.1") as LanguageModelV1;
  const { object } = await generateObject({
    model,
    schema: faqSchema,
    prompt: `
You are an AEO-focused technical SEO. Based on this cluster summary, create 3-6 concise FAQ Q&A pairs that would help this page be cited by AI answer engines.

Cluster summary:
${clusterSummary}
`
  });

  return {
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
  };
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
