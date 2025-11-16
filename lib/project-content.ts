// lib/project-content.ts
export type PageContext = {
  url: string;
  title?: string | null;
  h1?: string | null;
  content: string;
};

const DEFAULT_LIMIT = 6;
const DEFAULT_MAX_CHARS = 1800;

export function buildPageContexts(
  points: Array<{ payload?: Record<string, any> }>,
  options?: { limit?: number; maxChars?: number }
): PageContext[] {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;

  const grouped = new Map<
    string,
    { url: string; title?: string | null; h1?: string | null; content: string[] }
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
        content: []
      });
    }
    const entry = grouped.get(url)!;
    if (!entry.title && payload.title) entry.title = payload.title;
    if (!entry.h1 && payload.h1) entry.h1 = payload.h1;
    if (content) entry.content.push(content);
  }

  const contexts = Array.from(grouped.values())
    .map((entry) => ({
      url: entry.url,
      title: entry.title ?? null,
      h1: entry.h1 ?? null,
      content: entry.content
        .join("\n")
        .replace(/\s+/g, " ")
        .trim()
    }))
    .filter((ctx) => ctx.content.length > 0)
    .sort((a, b) => b.content.length - a.content.length)
    .slice(0, limit)
    .map((ctx) => ({
      ...ctx,
      content: ctx.content.slice(0, maxChars)
    }));

  return contexts;
}
