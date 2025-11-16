import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client instance that can run on the server within API routes.
 *
 * The instance is scoped to the provided access token so that all database calls
 * execute under the authenticated user's RLS policies without requiring the
 * SUPABASE_SERVICE_ROLE_KEY to be configured in the hosting environment.
 */
export function createSupabaseServerClient(accessToken?: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase client configuration");
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false
    },
    global:
      accessToken
        ? {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        : undefined
  });
}
