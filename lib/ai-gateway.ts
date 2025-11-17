// lib/ai-gateway.ts
import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModel, LanguageModelV1 } from "ai";

/**
 * Centralised entry point for AI/ML API backed by aimlapi.com's multi-modal gateway.
 * All model requests (language + embeddings) should flow through here so we can
 * manage routing, fallbacks, and future modality support in one place.
 */
const aimlapi = createOpenAI({
  apiKey: process.env.AIMLAPI_API_KEY ?? process.env.OPENAI_API_KEY,
  baseURL: process.env.AIMLAPI_BASE_URL ?? "https://api.aimlapi.com/v1"
});

const DEFAULT_MODELS = {
  reasoning: process.env.AIMLAPI_REASONING_MODEL ?? "gemini-1.5-pro",
  fast: process.env.AIMLAPI_FAST_MODEL ?? "gemini-1.5-flash",
  structured: process.env.AIMLAPI_STRUCTURED_MODEL ?? "gemini-1.5-flash",
  embeddings: process.env.AIMLAPI_EMBEDDING_MODEL ?? "text-embedding-004"
};

export function gatewayModel(preset: keyof typeof DEFAULT_MODELS = "reasoning"): LanguageModelV1 {
  const modelName = DEFAULT_MODELS[preset] ?? DEFAULT_MODELS.reasoning;
  return aimlapi(modelName) as LanguageModelV1;
}

export function reasoningModel(): LanguageModelV1 {
  return gatewayModel("reasoning");
}

export function fastModel(): LanguageModelV1 {
  return gatewayModel("fast");
}

export function structuredModel(): LanguageModelV1 {
  return gatewayModel("structured");
}

export function embeddingModel(): EmbeddingModel<string> {
  return aimlapi.textEmbeddingModel(DEFAULT_MODELS.embeddings);
}

export { aimlapi as aiGatewayClient };
