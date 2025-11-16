export type PageContext = {
  url: string;
  title?: string | null;
  h1?: string | null;
  lang?: string | null;
  clusterId?: string | null;
  clusterLabel?: string | null;
  clusterIntent?: string | null;
  primaryKeyword?: string | null;
  recommendedSchemas?: string[] | null;
  content: string;
};

const DEFAULT_LIMIT = 6;
const DEFAULT_MAX_CHARS = 1800;

type PointLike = { payload?: Record<string, any> };

export function buildPageContexts(
  points: PointLike[],
  options?: { limit?: number; maxChars?: number }
): PageContext[] {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;

  const grouped = new Map<
    string,
    {
      url: string;
      title?: string | null;
      h1?: string | null;
      langCandidates: string[];
      clusterId?: string | null;
      clusterLabel?: string | null;
      clusterIntent?: string | null;
      primaryKeyword?: string | null;
      recommendedSchemas: string[];
      content: string[];
    }
  >();

  for (const point of points) {
    const payload = point?.payload ?? {};
    const url = typeof payload.url === "string" ? payload.url : null;
    if (!url) continue;
    const content = typeof payload.content === "string" ? payload.content : "";
    if (!grouped.has(url)) {
      grouped.set(url, {
        url,
        title: payload.title ?? null,
        h1: payload.h1 ?? null,
        langCandidates: [],
        clusterId: payload.clusterId ?? null,
        clusterLabel: payload.clusterLabel ?? null,
        clusterIntent: payload.clusterIntent ?? payload.intent ?? null,
        primaryKeyword: payload.primaryKeyword ?? payload.clusterPrimaryKeyword ?? null,
        recommendedSchemas: Array.isArray(payload.clusterRecommendedSchemas)
          ? payload.clusterRecommendedSchemas
          : [],
        content: []
      });
    }
    const entry = grouped.get(url)!;
    if (!entry.title && payload.title) entry.title = payload.title;
    if (!entry.h1 && payload.h1) entry.h1 = payload.h1;
    if (!entry.clusterId && payload.clusterId) entry.clusterId = payload.clusterId;
    if (!entry.clusterLabel && payload.clusterLabel) entry.clusterLabel = payload.clusterLabel;
    if (!entry.clusterIntent && (payload.clusterIntent || payload.intent)) {
      entry.clusterIntent = payload.clusterIntent ?? payload.intent;
    }
    if (!entry.primaryKeyword && (payload.primaryKeyword || payload.clusterPrimaryKeyword)) {
      entry.primaryKeyword = payload.primaryKeyword ?? payload.clusterPrimaryKeyword;
    }
    if (
      entry.recommendedSchemas.length === 0 &&
      Array.isArray(payload.clusterRecommendedSchemas)
    ) {
      entry.recommendedSchemas = payload.clusterRecommendedSchemas;
    }
    const lang = typeof payload.lang === "string" ? payload.lang : null;
    if (lang) {
      entry.langCandidates.push(lang);
    }
    if (content) entry.content.push(content);
  }

  const contexts = Array.from(grouped.values())
    .map((entry) => {
      const lang = entry.langCandidates.length
        ? entry.langCandidates.sort(
            (a, b) =>
              entry.langCandidates.filter((item) => item === b).length -
              entry.langCandidates.filter((item) => item === a).length
          )[0]
        : null;
      return {
        url: entry.url,
        title: entry.title ?? null,
        h1: entry.h1 ?? null,
        lang,
        clusterId: entry.clusterId ?? null,
        clusterLabel: entry.clusterLabel ?? null,
        clusterIntent: entry.clusterIntent ?? null,
        primaryKeyword: entry.primaryKeyword ?? null,
        recommendedSchemas: entry.recommendedSchemas.length ? entry.recommendedSchemas : null,
        content: entry.content
          .join("\n")
          .replace(/\s+/g, " ")
          .trim()
      } satisfies PageContext;
    })
    .filter((ctx) => ctx.content.length > 0)
    .sort((a, b) => b.content.length - a.content.length)
    .slice(0, limit)
    .map((ctx) => ({
      ...ctx,
      content: ctx.content.slice(0, maxChars)
    }));

  return contexts;
}
