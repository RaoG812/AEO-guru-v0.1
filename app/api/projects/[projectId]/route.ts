import { NextRequest, NextResponse } from "next/server";

import { getUserContextFromRequest } from "@/lib/apiUserContext";
import { updateProject } from "@/lib/projectsStore";
import { updateProjectSchema } from "@/lib/projectsSchema";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse> {
  const context = await getUserContextFromRequest(req);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = params;
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "Missing project id" }, { status: 400 });
  }

  const body = await req.json();
  const payload = updateProjectSchema.parse(body);

  try {
    const project = await updateProject(context.supabase, context.userId, projectId, payload);
    return NextResponse.json({ ok: true, project });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return NextResponse.json(
        { ok: false, error: "Project not found" },
        { status: 404 }
      );
    }

    console.error("Failed to update project", error);
    return NextResponse.json({ ok: false, error: "Unable to update project" }, { status: 500 });
  }
}
