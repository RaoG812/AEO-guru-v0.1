// app/api/exports/robots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProjectPoints } from "@/lib/clustering";
import { generateRobotsTxtFromSummary } from "@/lib/generators";

const schema = z.object({
  projectId: z.string(),
  rootUrl: z.string().url()
});

export async function POST(req: NextRequest) {
  const { projectId, rootUrl } = schema.parse(await req.json());
  const points = await getProjectPoints(projectId);

  // super dumb heuristics: mark query-like URLs as disallow candidates
  const urls = Array.from(new Set(points.map((p) => p.payload?.url as string)));
  const disallowCandidates = urls.filter(
    (u) => u.includes("?") || u.includes("/search") || u.includes("/tag/")
  );

  const summary = {
    rootUrl,
    disallowCandidates
  };

  const robotsTxt = await generateRobotsTxtFromSummary(summary);

  return new NextResponse(robotsTxt, {
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}
