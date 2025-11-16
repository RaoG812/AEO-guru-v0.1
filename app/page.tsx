"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type ProjectSchema = {
  id: string;
  project_id: string;
  project_root_url: string;
  schema: Record<string, unknown>;
};

const supabase = getSupabaseBrowserClient();

export default function HomePage() {
  const [rootUrl, setRootUrl] = useState("");
  const [urlsRaw, setUrlsRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [projectSchema, setProjectSchema] = useState<ProjectSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const isAuthenticated = useMemo(() => Boolean(session?.user), [session]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      setSession(authSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function loadSchema(userId: string) {
      setSchemaLoading(true);
      setSchemaError(null);
      const { data, error } = await supabase
        .from("project_schemas")
        .select("id, project_id, project_root_url, schema")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        setSchemaError(error.message);
        setProjectSchema(null);
      } else {
        setProjectSchema(data ?? null);
        if (!rootUrl && data?.project_root_url) {
          setRootUrl(data.project_root_url);
        }
      }

      setSchemaLoading(false);
    }

    if (session?.user?.id) {
      loadSchema(session.user.id);
    } else {
      setProjectSchema(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    const { email, password } = authForm;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
    }
    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setProjectSchema(null);
    setRootUrl("");
    setUrlsRaw("");
  }

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.access_token) {
      setMessage("Please sign in to ingest data.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const urls = urlsRaw
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        projectId: projectSchema?.project_id ?? rootUrl,
        urls
      })
    });

    const json = await res.json();
    setLoading(false);
    setMessage(JSON.stringify(json, null, 2));
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center">
      <div className="w-full max-w-3xl px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
          AEO-guru ingestion console
        </h1>
        <p className="text-neutral-400 mb-8">
          Sign in with your Supabase credentials to fetch your project schema
          before seeding URLs into Qdrant.
        </p>

        <section className="space-y-4 border border-neutral-800 rounded-2xl p-6 bg-neutral-950/60 mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-neutral-300 font-medium">
                {isAuthenticated ? session?.user.email : "Not signed in"}
              </p>
              <p className="text-xs text-neutral-500">
                Multi-user access is powered by Supabase Auth.
              </p>
            </div>
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="text-sm rounded-full border border-neutral-600 px-3 py-1 hover:bg-white hover:text-black"
              >
                Sign out
              </button>
            )}
          </div>

          {!isAuthenticated && (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-xs mb-1 uppercase tracking-wide text-neutral-500">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-xs mb-1 uppercase tracking-wide text-neutral-500">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
                  placeholder="••••••••"
                />
              </div>
              {authError && <p className="text-xs text-red-400">{authError}</p>}
              <button
                type="submit"
                disabled={authLoading}
                className="inline-flex items-center rounded-full border border-white/40 px-4 py-2 text-sm font-medium hover:bg-white hover:text-black transition disabled:opacity-50"
              >
                {authLoading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          )}

          {isAuthenticated && (
            <div className="space-y-2 text-sm">
              <p className="text-neutral-400">
                {schemaLoading
                  ? "Loading your project schema…"
                  : projectSchema
                    ? "Project schema fetched from Supabase."
                    : "No schema found for your account."}
              </p>
              {schemaError && <p className="text-xs text-red-400">{schemaError}</p>}
              {projectSchema && (
                <pre className="text-xs bg-black/40 rounded-xl border border-neutral-800 p-3 overflow-x-auto">
                  {JSON.stringify(projectSchema, null, 2)}
                </pre>
              )}
            </div>
          )}
        </section>

        <form
          onSubmit={handleIngest}
          className="space-y-6 border border-neutral-800 rounded-2xl p-6 bg-neutral-950/60"
        >
          <div>
            <label className="block text-sm mb-1">Project root URL</label>
            <input
              type="url"
              required
              value={rootUrl}
              onChange={(e) => setRootUrl(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">
              URLs to ingest (one per line)
            </label>
            <textarea
              rows={6}
              value={urlsRaw}
              onChange={(e) => setUrlsRaw(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
              placeholder="https://example.com/page-1&#10;https://example.com/page-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !isAuthenticated}
            className="inline-flex items-center rounded-full border border-white/40 px-4 py-2 text-sm font-medium hover:bg-white hover:text-black transition disabled:opacity-50"
          >
            {isAuthenticated ? (loading ? "Ingesting…" : "Ingest & Embed") : "Sign in to ingest"}
          </button>
        </form>

        {message && (
          <pre className="mt-8 text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-4 overflow-x-auto">
            {message}
          </pre>
        )}
      </div>
    </main>
  );
}
