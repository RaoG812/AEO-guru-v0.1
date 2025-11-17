import type { SupabaseClient } from "@supabase/supabase-js";

const TABLE = "project_cores";

export type StoredClusterNote = {
  labelOverride?: string | null;
  note?: string | null;
  keywords?: string[] | null;
};

export type ProjectCoreRecord = {
  projectId: string;
  ownerUserId: string;
  semanticCoreYaml: string | null;
  manualNotes: string | null;
  clusterNotes: Record<string, StoredClusterNote>;
  updatedAt: string;
};

type ProjectCoreRow = {
  project_id: string;
  owner_user_id: string;
  semantic_core_yaml: string | null;
  manual_notes: string | null;
  cluster_notes: Record<string, StoredClusterNote> | null;
  updated_at: string;
};

function mapRowToRecord(row: ProjectCoreRow): ProjectCoreRecord {
  return {
    projectId: row.project_id,
    ownerUserId: row.owner_user_id,
    semanticCoreYaml: row.semantic_core_yaml,
    manualNotes: row.manual_notes,
    clusterNotes: row.cluster_notes ?? {},
    updatedAt: row.updated_at
  };
}

export async function getProjectCore(
  supabase: SupabaseClient,
  ownerUserId: string,
  projectId: string
): Promise<ProjectCoreRecord | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("project_id, owner_user_id, semantic_core_yaml, manual_notes, cluster_notes, updated_at")
    .eq("owner_user_id", ownerUserId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message || "Unable to load semantic core");
  }

  if (!data) {
    return null;
  }

  return mapRowToRecord(data as ProjectCoreRow);
}

type UpsertCoreInput = {
  semanticCoreYaml?: string | null;
  manualNotes?: string | null;
  clusterNotes?: Record<string, StoredClusterNote>;
};

export async function upsertProjectCore(
  supabase: SupabaseClient,
  ownerUserId: string,
  projectId: string,
  payload: UpsertCoreInput
): Promise<ProjectCoreRecord> {
  const insertPayload = {
    owner_user_id: ownerUserId,
    project_id: projectId,
    semantic_core_yaml: payload.semanticCoreYaml ?? null,
    manual_notes: payload.manualNotes ?? null,
    cluster_notes: payload.clusterNotes ?? null
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(insertPayload, {
      onConflict: "project_id,owner_user_id"
    })
    .select("project_id, owner_user_id, semantic_core_yaml, manual_notes, cluster_notes, updated_at")
    .single();

  if (error) {
    throw new Error(error.message || "Unable to store semantic core");
  }

  return mapRowToRecord(data as ProjectCoreRow);
}
