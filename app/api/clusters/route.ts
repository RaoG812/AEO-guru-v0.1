// app/api/clusters/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProjectPoints, naiveCluster } from "@/lib/clustering";

const schema = z.object({ projectId: z.string() });

export async function POST(req: NextRequest) {
  const { projectId } = schema.parse(await req.json());
  const points = await getProjectPoints(projectId);
  const clusters = naiveCluster(points);
  // TODO: call LLM to name clusters + compute intent & gaps
  return NextResponse.json({ clusters });
}
