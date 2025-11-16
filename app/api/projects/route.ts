import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { addProject, listProjects } from "@/lib/projectsStore";

const createProjectSchema = z.object({
  id: z
    .string()
    .min(1, "Project id is required")
    .regex(/^[a-zA-Z0-9-_]+$/, "Project id can only include letters, numbers, dashes and underscores"),
  name: z.string().min(1).optional(),
  rootUrl: z.string().url(),
  sitemapUrl: z.string().url().optional()
});

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json({ ok: true, projects });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const payload = createProjectSchema.parse(body);

  try {
    const project = await addProject(payload);
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
