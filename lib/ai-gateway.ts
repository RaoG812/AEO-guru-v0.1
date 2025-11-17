// lib/ai-gateway.ts
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelV1 } from "ai";

/**
 * Centralized Gemini gateway so all LLM calls consistently route through Google.
 */
type GoogleClient = ReturnType<typeof createGoogleGenerativeAI>;

let googleClient: GoogleClient | null = null;

const DEFAULT_MODELS = {
  reasoning:
    process.env.GOOGLE_GENAI_REASONING_MODEL ??
    process.env.AIMLAPI_REASONING_MODEL ??
    "gemini-1.5-pro",
  fast:
    process.env.GOOGLE_GENAI_FAST_MODEL ??
    process.env.AIMLAPI_FAST_MODEL ??
    "gemini-1.5-flash",
  structured:
    process.env.GOOGLE_GENAI_STRUCTURED_MODEL ??
    process.env.AIMLAPI_STRUCTURED_MODEL ??
    "gemini-1.5-flash"
};

function normalizeModelName(model: string): string {
  return model.startsWith("models/") ? model : `models/${model}`;
}

function getGoogleClient(): GoogleClient {
  if (googleClient) {
    return googleClient;
  }

  const apiKey =
    process.env.GOOGLE_GENAI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing Google Generative AI API key. Set GOOGLE_GENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, GOOGLE_API_KEY, or GEMINI_API_KEY."
    );
  }

  googleClient = createGoogleGenerativeAI({
    apiKey
  });

  return googleClient;
}

export function gatewayModel(preset: keyof typeof DEFAULT_MODELS = "reasoning"): LanguageModelV1 {
  const modelName = normalizeModelName(DEFAULT_MODELS[preset] ?? DEFAULT_MODELS.reasoning);
  return getGoogleClient()(modelName) as LanguageModelV1;
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

export { getGoogleClient as aiGatewayClient };
