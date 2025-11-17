// lib/embeddings.ts

const GOOGLE_GENAI_BASE_URL =
  process.env.GOOGLE_GENAI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta";
const GOOGLE_GENAI_EMBEDDING_MODEL =
  process.env.GOOGLE_GENAI_EMBEDDING_MODEL ?? "gemini-embedding-001";

function getGoogleApiKey(): string {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY ?? process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing Google Generative AI API key. Set GOOGLE_GENAI_API_KEY or GEMINI_API_KEY to call the Gemini embedding service."
    );
  }

  return apiKey;
}

function getModelIdentifier(): string {
  return GOOGLE_GENAI_EMBEDDING_MODEL.startsWith("models/")
    ? GOOGLE_GENAI_EMBEDDING_MODEL
    : `models/${GOOGLE_GENAI_EMBEDDING_MODEL}`;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = getGoogleApiKey();
  const model = getModelIdentifier();
  const endpoint = `${GOOGLE_GENAI_BASE_URL}/${model}:batchEmbedContents?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model,
        content: {
          parts: [{ text }]
        }
      }))
    })
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(
      `Google Generative AI embeddings failed (${response.status} ${response.statusText}): ${errorPayload}`
    );
  }

  const payload: GoogleBatchEmbedResponse = await response.json();

  if (!payload.embeddings || payload.embeddings.length !== texts.length) {
    throw new Error("Gemini embedding API returned an unexpected response shape.");
  }

  return payload.embeddings.map((embedding) => embedding.values ?? []);
}

type GoogleBatchEmbedResponse = {
  embeddings?: Array<{ values: number[] }>;
};
