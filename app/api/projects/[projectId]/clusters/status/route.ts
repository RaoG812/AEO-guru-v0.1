export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { getProjectPoints } from "@/lib/clustering";
import { resolveProjectUserContext } from "../../core/context";

type Params = { params: { projectId: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const context = await resolveProjectUserContext(req);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const projectId = params.projectId;
  try {
    const points = await getProjectPoints(projectId, { withVectors: false, limit: 5000 });
    const clusterIds = new Set<string>();
    for (const point of points) {
      const payload = point.payload ?? {};
      const clusterId = typeof payload?.clusterId === "string" ? payload.clusterId.trim() : "";
      if (clusterId) {
        clusterIds.add(clusterId);
      }
    }
    return NextResponse.json({ ok: true, clusterCount: clusterIds.size });
  } catch (error) {
    console.error("clusters:status", error);
    return NextResponse.json(
      { ok: false, error: "Unable to check cluster status" },
      { status: 500 }
    );
  }
}
