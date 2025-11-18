# AEO Guru

AEO Guru is an Answer Engine Optimization (AEO) workspace that crawls projects, vectors their content with Google's Gemini models, clusters intent-rich sections, and lets analysts export structured artifacts from one Next.js 14 codebase.

## Overview
- **Single workspace repo** – the live demo, Supabase SQL migrations, and the `/presentation` deck live side-by-side so stakeholders can diff the implementation and story from one place.
- **Gemini-only AI calls** – `lib/ai-gateway.ts` and `lib/embeddings.ts` centralize the Google client so reasoning, fast tasks, and embeddings all share the same API key handling and default presets.
- **Supabase + Qdrant persistence** – Supabase stores the project metadata and workspace notes with enforced RLS, while Qdrant holds the `aeo_guru_corpus` vector collection plus keyword payload indexes.
- **Presentation deck baked in** – visit `/presentation` (statically served from `public/presentation/index.html`) for a narrated walkthrough of the tech decisions and product framing.

## Tech backbone (presentation snapshots)
The presentation's "Technology Backbone" slide highlights the providers glued together inside this repo. Reuse the assets under `public/presentation/` or hotlink them below for quick context.

<p align="center">
  <img src="public/presentation/google%20deep.png" alt="Google Gemini card from the tech backbone slide" width="140" />
  <img src="public/presentation/supabase.png" alt="Supabase card from the tech backbone slide" width="140" />
  <img src="public/presentation/qdrant.png" alt="Qdrant card from the tech backbone slide" width="140" />
  <img src="public/presentation/vercel.png" alt="Next.js runtime card from the tech backbone slide" width="140" />
  <img src="public/presentation/github.png" alt="GitHub card from the tech backbone slide" width="140" />
</p>

## Repository structure
| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Client-side dashboard that drives the ingest → cluster → export workflows, Supabase auth modal, and workspace panels. |
| `app/api/` | Route handlers for ingesting crawls, computing clusters, exporting semantic cores, and managing projects. Each route keeps Next.js runtime metadata alongside Zod validation. |
| `lib/` | Shared services covering the Gemini gateway, Qdrant helpers, Supabase clients, content chunker, crawler, clustering utilities, and store abstractions. |
| `data/supabase.sql` | Postgres tables plus RLS policies for `projects`, `project_schemas`, and the workspace-specific tables the UI depends on. Apply this file to your Supabase project to stay in sync. |
| `public/presentation/` | Self-contained HTML deck, PNG assets, and styles that mirror the product narrative. Next.js rewrites `/presentation` directly to this artifact for zero server cost. |

## Core workflows
1. **Ingest** – `app/api/ingest/route.ts` accepts a project ID plus any combination of root URLs, sitemaps, or manual URLs. It crawls up to 20 pages per run, chunks text into 320–1200 character slices, embeds them through Gemini, and upserts the payloads into the `aeo_guru_corpus` Qdrant collection.
2. **Cluster** – vector points are fetched back out of Qdrant and grouped via `lib/clustering.ts` (a k-means helper tuned for ~20 section clusters, with a deterministic fallback when too little data exists).
3. **Workspace authoring** – the dashboard stores semantic-core YAML, manual notes, and per-cluster annotations through Supabase via `lib/projectCoreStore.ts`, making it simple to diff exports with the stored context.
4. **Exports** – the export cockpit lets analysts pull semantic cores, JSON-LD bundles, robots.txt updates, and geo-intent artifacts in one place, all backed by the `/api/exports/*` routes.

## Environment variables
| Variable | Purpose |
| --- | --- |
| `GOOGLE_GENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` / `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Any of these satisfy the Gemini gateway and embedding clients for both reasoning calls and batch embeddings.
| `GOOGLE_GENAI_REASONING_MODEL`, `GOOGLE_GENAI_FAST_MODEL`, `GOOGLE_GENAI_STRUCTURED_MODEL`, `GOOGLE_GENAI_EMBEDDING_MODEL` | Optional overrides if you want to point at custom Gemini releases instead of the baked-in defaults.
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required for both browser and server Supabase clients so auth + RLS-protected tables function.
| `QDRANT_URL` / `QDRANT_API_KEY` | Used by the Qdrant REST client when provisioning or querying the `aeo_guru_corpus` collection.

## Running locally
1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure environment**
   - Copy your Supabase project URL + anon key into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Provide a Gemini API key and (optionally) override model IDs.
   - Point `QDRANT_URL` and `QDRANT_API_KEY` at a cloud-hosted collection or a local docker container.
   - Apply `data/supabase.sql` to your Supabase Postgres instance to create the tables + policies referenced by the UI.
3. **Run the app**
   ```bash
   npm run dev
   ```
   Next.js serves the dashboard at `http://localhost:3000` and rewrites `/presentation` to the static deck for demos.

## Presentation deck
Need a narrated version? Open `/presentation` while the dev server runs (or inspect `public/presentation/index.html` directly) to grab the same slides referenced in the README. The deck includes the technology backbone, target problem framing, and export callouts that stay versioned with the code.
