"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type ProjectSchemaRecord = {
  id: string;
  project_id: string;
  schema_definition: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

const supabase = getSupabaseBrowserClient();

export default function HomePage() {
  const [rootUrl, setRootUrl] = useState("");
  const [urlsRaw, setUrlsRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [projectSchemas, setProjectSchemas] = useState<ProjectSchemaRecord[]>([]);
  const [schemasLoading, setSchemasLoading] = useState(false);
  const [schemasError, setSchemasError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      setSession(updatedSession ?? null);
      if (!updatedSession) {
        setProjectSchemas([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function fetchSchemas() {
      if (!session) {
        setSchemasError(null);
        setProjectSchemas([]);
        return;
      }

      setSchemasLoading(true);
      setSchemasError(null);
      const { data, error } = await supabase
        .from("project_schemas")
        .select("id, project_id, schema_definition, created_at, updated_at")
        .order("updated_at", { ascending: false, nullsFirst: false });

      if (error) {
        setSchemasError(error.message);
        setProjectSchemas([]);
      } else {
        setProjectSchemas(data ?? []);
      }

      setSchemasLoading(false);
    }

    fetchSchemas();
  }, [session]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      setAuthError(error.message);
    }
    setAuthLoading(false);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password
    });
    if (error) {
      setAuthError(error.message);
    }
    setAuthLoading(false);
  }

  async function handleSignOut() {
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message);
    }
    setAuthLoading(false);
  }

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const urls = urlsRaw
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    const res = await fetch("/api/ingest", {
      method: "POST",
      body: JSON.stringify({
        projectId: rootUrl,
        urls
      })
    });

    const json = await res.json();
    setLoading(false);
    setMessage(JSON.stringify(json, null, 2));
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center">
      <div className="w-full max-w-4xl px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            AEO-guru ingestion console
          </h1>
          <p className="text-neutral-400">
            Seed the semantic core for AEO-guru by submitting your primary domain
            and the URLs you would like embedded and stored in Qdrant. Sign in to
            sync your projects and schema with Supabase.
          </p>
        </div>

        <section className="space-y-4 border border-neutral-800 rounded-2xl p-6 bg-neutral-950/60">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Supabase authentication</h2>
            {session && (
              <button
                onClick={handleSignOut}
                disabled={authLoading}
                className="inline-flex items-center rounded-full border border-white/40 px-3 py-1 text-xs font-medium hover:bg-white hover:text-black transition disabled:opacity-50"
              >
                Sign out
              </button>
            )}
          </div>
          {session ? (
            <p className="text-sm text-neutral-400">
              Signed in as <span className="text-white">{session.user.email}</span>
            </p>
          ) : (
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSignIn}>
              <label className="text-sm col-span-2 md:col-span-1">
                <span className="mb-1 block">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
                  placeholder="you@example.com"
                />
              </label>
              <label className="text-sm col-span-2 md:col-span-1">
                <span className="mb-1 block">Password</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/40"
                  placeholder="••••••••"
                />
              </label>
              <div className="col-span-2 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={authLoading}
                  className="inline-flex items-center rounded-full border border-white/40 px-4 py-2 text-sm font-medium hover:bg-white hover:text-black transition disabled:opacity-50"
                >
                  {authLoading ? "Processing…" : "Sign in"}
                </button>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={handleSignUp}
                  className="inline-flex items-center rounded-full border border-neutral-700 px-4 py-2 text-sm font-medium hover:border-white/60 transition disabled:opacity-50"
                >
                  Create account
                </button>
              </div>
              {authError && (
                <p className="col-span-2 text-sm text-red-400">{authError}</p>
              )}
            </form>
          )}
        </section>

        {session ? (
          <>
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
                  placeholder={"https://example.com/page-1\nhttps://example.com/page-2"}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center rounded-full border border-white/40 px-4 py-2 text-sm font-medium hover:bg-white hover:text-black transition disabled:opacity-50"
              >
                {loading ? "Ingesting…" : "Ingest & Embed"}
              </button>
            </form>

            {message && (
              <pre className="text-xs bg-neutral-950 border border-neutral-800 rounded-xl p-4 overflow-x-auto">
                {message}
              </pre>
            )}

            <section className="space-y-4 border border-neutral-800 rounded-2xl p-6 bg-neutral-950/60">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Project schemas</h2>
                  <p className="text-sm text-neutral-400">
                    The latest schema definitions stored in Supabase for this account.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (session) {
                      setSchemasLoading(true);
                      supabase
                        .from("project_schemas")
                        .select("id, project_id, schema_definition, created_at, updated_at")
                        .order("updated_at", { ascending: false, nullsFirst: false })
                        .then(({ data, error }) => {
                          if (error) {
                            setSchemasError(error.message);
                            setProjectSchemas([]);
                          } else {
                            setProjectSchemas(data ?? []);
                            setSchemasError(null);
                          }
                          setSchemasLoading(false);
                        });
                    }
                  }}
                  disabled={schemasLoading}
                  className="inline-flex items-center rounded-full border border-white/40 px-3 py-1 text-xs font-medium hover:bg-white hover:text-black transition disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>

              {schemasLoading && (
                <p className="text-sm text-neutral-400">Loading schema definitions…</p>
              )}

              {schemasError && (
                <p className="text-sm text-red-400">{schemasError}</p>
              )}

              {!schemasLoading && !schemasError && projectSchemas.length === 0 && (
                <p className="text-sm text-neutral-400">
                  No schema definitions have been stored for this account yet.
                </p>
              )}

              <div className="space-y-4">
                {projectSchemas.map((schema) => (
                  <div
                    key={schema.id}
                    className="border border-neutral-800 rounded-xl p-4 bg-black/40"
                  >
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="font-semibold">{schema.project_id}</span>
                      <span className="text-neutral-500">
                        Updated {schema.updated_at ? new Date(schema.updated_at).toLocaleString() : "never"}
                      </span>
                    </div>
                    <pre className="text-xs text-neutral-200 overflow-x-auto">
                      {JSON.stringify(schema.schema_definition, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <p className="text-sm text-neutral-400">
            Sign in above to unlock ingestion controls and view your stored project schema.
          </p>
        )}
      </div>
    </main>
  );
}
