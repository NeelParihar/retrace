import { DEMO_API_KEY_HASH, DEMO_PROJECT_ID } from "../demo";
import { DEFAULT_PRICING } from "../pricing";
import { MemoryRepo } from "./memory";
import type { Repo } from "./repo";

type G = { __retraceRepo?: Promise<Repo> };

export function projectId(): string {
  return process.env.RETRACE_DEMO_PROJECT_ID || DEMO_PROJECT_ID;
}

export function createMemoryRepo(): MemoryRepo {
  return new MemoryRepo({
    projects: [{ id: DEMO_PROJECT_ID, name: "Demo project", api_key_hash: DEMO_API_KEY_HASH }],
    pricing: DEFAULT_PRICING,
  });
}

async function createRepo(): Promise<Repo> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const [{ createClient }, { SupabaseRepo }] = await Promise.all([import("@supabase/supabase-js"), import("./supabase")]);
    return new SupabaseRepo(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  }
  const repo = createMemoryRepo();
  const { seedDemo } = await import("../seed");
  await seedDemo(repo, { now: Date.now() });
  return repo;
}

/** One repo per server process (survives dev HMR via globalThis). A failed init is retried on the next call. */
export function getRepo(): Promise<Repo> {
  const g = globalThis as G;
  g.__retraceRepo ??= createRepo().catch((e) => {
    g.__retraceRepo = undefined;
    throw e;
  });
  return g.__retraceRepo;
}

export function setRepoForTests(repo: Repo | null): void {
  (globalThis as G).__retraceRepo = repo ? Promise.resolve(repo) : undefined;
}
