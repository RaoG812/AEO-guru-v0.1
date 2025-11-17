export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getProjectCore, upsertProjectCore } from "@/lib/projectCoreStore";
import { resolveProjectUserContext } from "./context";

const clusterNoteSchema = z.object({
  labelOverride: z.string().max(160).optional(),
  note: z.string().max(4000).optional(),
  keywords: z.array(z.string().min(1).max(80)).max(20).optional()
});

const corePayloadSchema = z.object({
  semanticCoreYaml: z.string().max(20000).optional(),
  manualNotes: z.string().max(8000).optional(),
  clusterNotes: z.record(clusterNoteSchema).optional()
});

type Params = { params: { projectId: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const context = await resolveProjectUserContext(req);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const projectId = params.projectId;
  try {
    const record = await getProjectCore(context.supabase, context.userId, projectId);
    return NextResponse.json({
      ok: true,
      core: {
        projectId,
        semanticCoreYaml: record?.semanticCoreYaml ?? "",
        manualNotes: record?.manualNotes ?? "",
        clusterNotes: record?.clusterNotes ?? {},
        updatedAt: record?.updatedAt ?? null
      }
    });
  } catch (error) {
    console.error("core:get", error);
    return NextResponse.json({ ok: false, error: "Unable to load project core" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const context = await resolveProjectUserContext(req);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const projectId = params.projectId;
  const body = await req.json();
  const payload = corePayloadSchema.parse(body);
  try {
    const record = await upsertProjectCore(context.supabase, context.userId, projectId, {
      semanticCoreYaml: payload.semanticCoreYaml ?? null,
      manualNotes: payload.manualNotes ?? null,
      clusterNotes: payload.clusterNotes ?? {}
    });
    return NextResponse.json({
      ok: true,
      core: {
        projectId,
        semanticCoreYaml: record.semanticCoreYaml ?? "",
        manualNotes: record.manualNotes ?? "",
        clusterNotes: record.clusterNotes ?? {},
        updatedAt: record.updatedAt
      }
    });
  } catch (error) {
    console.error("core:put", error);
    return NextResponse.json({ ok: false, error: "Unable to save project core" }, { status: 500 });
  }
}
