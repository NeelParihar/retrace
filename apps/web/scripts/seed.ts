import { createClient } from "@supabase/supabase-js";
import { SupabaseRepo } from "../lib/db/supabase";
import { DEMO_PROJECT_ID } from "../lib/demo";
import { seedDemo } from "../lib/seed";

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* env may come from the shell */
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (apps/web/.env.local)");
  const projectId = process.env.RETRACE_DEMO_PROJECT_ID || DEMO_PROJECT_ID;
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { error } = await db.from("traces").delete().eq("project_id", projectId);
  if (error) throw new Error(`wipe failed: ${error.message}`);
  const { traceIds } = await seedDemo(new SupabaseRepo(db), { now: Date.now(), projectId });
  console.log(`seeded ${traceIds.length} traces into project ${projectId}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
