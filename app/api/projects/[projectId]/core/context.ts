import { NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabaseServerClient";

export type ProjectUserContext = {
  userId: string;
  supabase: ReturnType<typeof createSupabaseServerClient>;
};

export async function resolveProjectUserContext(req: NextRequest): Promise<ProjectUserContext | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = authHeader.slice(7);
  const supabase = createSupabaseServerClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }
  return { userId: data.user.id, supabase };
}
