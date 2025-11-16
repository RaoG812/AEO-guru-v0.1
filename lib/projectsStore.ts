import type { PostgrestError } from "@supabase/supabase-js";

import type { CreateProjectInput } from "./projectsSchema";
import { getSupabaseServiceRoleClient } from "./supabaseServerClient";

export type ProjectRecord = {
  id: string;
  name?: string;
  rootUrl: string;
  sitemapUrl?: string | null;
  createdAt: string;
};

const TABLE = "projects";

type ProjectRow = {
  project_id: string;
  name: string | null;
  root_url: string;
  sitemap_url: string | null;
  created_at: string;
};

function mapRowToRecord(row: ProjectRow): ProjectRecord {
  return {
    id: row.project_id,
    name: row.name ?? undefined,
    rootUrl: row.root_url,
    sitemapUrl: row.sitemap_url,
    createdAt: row.created_at
  };
}

function normalizeUrl(url: string) {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.toString();
}

function handlePostgrestError(error: PostgrestError): never {
  if (error.code === "23505") {
    throw new Error("PROJECT_ALREADY_EXISTS");
  }
  throw new Error(error.message || "Supabase query failed");
}

export async function listProjects(ownerUserId: string): Promise<ProjectRecord[]> {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("project_id, name, root_url, sitemap_url, created_at")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: true });

  if (error) {
    handlePostgrestError(error);
  }

  return (data ?? []).map(mapRowToRecord);
}

export async function addProject(
  ownerUserId: string,
  input: CreateProjectInput
): Promise<ProjectRecord> {
  const supabase = getSupabaseServiceRoleClient();
  const normalizedRootUrl = normalizeUrl(input.rootUrl);
  const normalizedSitemap = input.sitemapUrl ? normalizeUrl(input.sitemapUrl) : null;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      owner_user_id: ownerUserId,
      project_id: input.id,
      name: input.name ?? null,
      root_url: normalizedRootUrl,
      sitemap_url: normalizedSitemap
    })
    .select("project_id, name, root_url, sitemap_url, created_at")
    .single();

  if (error) {
    handlePostgrestError(error);
  }

  return mapRowToRecord(data as ProjectRow);
}
