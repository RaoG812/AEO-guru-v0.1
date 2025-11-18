import { NextRequest, NextResponse } from "next/server";

import { getUserContextFromRequest } from "@/lib/apiUserContext";
import { addProject, listProjects } from "@/lib/projectsStore";
import { createProjectSchema } from "@/lib/projectsSchema";

export async function GET(req: NextRequest) {
  const context = await getUserContextFromRequest(req);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await listProjects(context.supabase, context.userId);
    return NextResponse.json({ ok: true, projects });
  } catch (error) {
    console.error("Failed to list projects", error);
    return NextResponse.json({ ok: false, error: "Unable to load projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const context = await getUserContextFromRequest(req);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const payload = createProjectSchema.parse(body);

  try {
    const project = await addProject(context.supabase, context.userId, payload);
    return NextResponse.json({ ok: true, project }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_ALREADY_EXISTS") {
      return NextResponse.json(
        { ok: false, error: "Project with this id already exists" },
        { status: 409 }
      );
    }

    console.error("Failed to create project", error);
    return NextResponse.json({ ok: false, error: "Unable to create project" }, { status: 500 });
  }
}
