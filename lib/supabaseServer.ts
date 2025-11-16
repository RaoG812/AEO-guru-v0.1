import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null = null;

function getServerEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for server-side Supabase access."
    );
  }

  return { url, serviceRole };
}

export function getSupabaseServiceRoleClient() {
  if (!serviceClient) {
    const { url, serviceRole } = getServerEnv();
    serviceClient = createClient(url, serviceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return serviceClient;
}

export async function getUserForRequest(req: Request): Promise<User | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace("Bearer", "").trim();
  if (!token) {
    return null;
  }

  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export async function verifyUserProjectAccess(userId: string, projectId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("project_schemas")
    .select("id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return !!data;
}
