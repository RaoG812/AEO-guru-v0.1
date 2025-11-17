# AEO Guru

## Gemini configuration

The app now talks exclusively to Google's Gemini models for both reasoning calls and
embeddings. Set one of the following environment variables with your Google AI
key and the gateway will automatically pick it up:

1. `GOOGLE_GENAI_API_KEY`
2. `GOOGLE_GENERATIVE_AI_API_KEY`
3. `GOOGLE_API_KEY` *(this is what Google AI Studio projects provide)*
4. `GEMINI_API_KEY`

If you are using an API key that was issued from a Google AI Studio project,
you don't have to rename it. Simply export it as `GOOGLE_API_KEY` and both the
language-model gateway (`lib/ai-gateway.ts`) and the embedding client
(`lib/embeddings.ts`) will detect it automatically.

### Default model choices

Unless you override the presets with the `GOOGLE_GENAI_*_MODEL` variables, the
gateway now targets the current `-latest` Gemini releases (reasoning →
`gemini-1.5-pro-latest`, fast + structured → `gemini-1.5-flash-latest`). These
model identifiers comply with the v1beta `generateContent` API, avoiding the
`models/gemini-1.5-flash not found` error that older names can trigger.
