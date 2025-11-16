import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceRoleClient: SupabaseClient | null = null;

export function getSupabaseServiceRoleClient() {
  if (!serviceRoleClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      throw new Error("Missing Supabase service role configuration");
    }

    serviceRoleClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false
      }
    });
  }

  return serviceRoleClient;
}
