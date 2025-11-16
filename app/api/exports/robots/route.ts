// app/api/exports/robots/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getProjectPoints } from "@/lib/clustering";
import { generateRobotsTxtFromSummary } from "@/lib/generators";

const schema = z.object({
  projectId: z.string(),
  rootUrl: z.string().url(),
  lang: z.string().optional()
});

function collectPatterns(urls: string[]) {
  const disallow = new Set<string>();
  const rationale: string[] = [];
  const duplicatePatterns: string[] = [];
  const paramKeys = new Set<string>();
  const pathBuckets = new Map<string, number>();

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      if (parsed.searchParams.size) {
        parsed.searchParams.forEach((_value, key) => paramKeys.add(key));
      }
      if (/\/search/i.test(pathname)) {
        disallow.add(`${pathname.split("/search")[0]}/search/`);
        rationale.push("Search result listings add little value");
      }
      if (/\/(tag|category|topics)\//i.test(pathname)) {
        const parts = pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          disallow.add(`/${parts[0]}/${parts[1]}/`);
          rationale.push("Tag/category archive detected");
        }
      }
      const key = pathname
        .split("/")
        .filter(Boolean)
        .slice(0, 2)
        .join("/");
      if (key) {
        pathBuckets.set(key, (pathBuckets.get(key) ?? 0) + 1);
      }
    } catch {
      // ignore invalid url
    }
  }

  if (paramKeys.size) {
    paramKeys.forEach((key) => {
      disallow.add(`/*?${key}=`);
      rationale.push(`Parameter ?${key} detected across pages`);
    });
  }

  pathBuckets.forEach((count, key) => {
    if (count >= 4) {
      duplicatePatterns.push(`/${key}/`);
      rationale.push(`High volume of URLs under /${key}/ looks duplicative (${count})`);
    }
  });

  return { disallow: Array.from(disallow), duplicatePatterns, rationale };
}

export async function POST(req: NextRequest) {
  const { projectId, rootUrl, lang } = schema.parse(await req.json());
  const points = await getProjectPoints(projectId, { lang, withVectors: false });

  if (!points.length) {
    return NextResponse.json({ error: "No content" }, { status: 404 });
  }

  const urls = Array.from(
    new Set(
      points
        .map((point) => point.payload?.url)
        .filter((url): url is string => typeof url === "string")
    )
  );

  const patternSummary = collectPatterns(urls);
  const summary = {
    rootUrl,
    disallowCandidates: patternSummary.disallow,
    duplicatePatterns: patternSummary.duplicatePatterns,
    rationale: patternSummary.rationale
  };

  const robotsTxt = await generateRobotsTxtFromSummary(summary);

  return new NextResponse(robotsTxt, {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}
