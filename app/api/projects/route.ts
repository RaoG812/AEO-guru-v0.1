import { NextRequest, NextResponse } from "next/server";

import { addProject, listProjects } from "@/lib/projectsStore";
import { createProjectSchema } from "@/lib/projectsSchema";
import { getSupabaseServiceRoleClient } from "@/lib/supabaseServerClient";

async function getUserIdFromRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await listProjects(userId);
    return NextResponse.json({ ok: true, projects });
  } catch (error) {
    console.error("Failed to list projects", error);
    return NextResponse.json({ ok: false, error: "Unable to load projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const payload = createProjectSchema.parse(body);

  try {
    const project = await addProject(userId, payload);
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
