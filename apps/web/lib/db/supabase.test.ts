import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { DEMO_API_KEY_HASH, DEMO_PROJECT_ID } from "../demo";
import { runRepoContract } from "./repo-contract.testkit";
import { sanitizeSearch, SupabaseRepo } from "./supabase";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* optional locally */
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("sanitizeSearch", () => {
  it("strips PostgREST syntax characters", () => {
    expect(sanitizeSearch(`50% off, (really) "now"*`)).toBe("50 off really now");
    expect(sanitizeSearch("   ")).toBe("");
    expect(sanitizeSearch("x".repeat(300))).toHaveLength(100);
  });
});

if (url && key) {
  const db = createClient(url, key, { auth: { persistSession: false } });
  runRepoContract("supabase", async () => ({ repo: new SupabaseRepo(db), projectId: DEMO_PROJECT_ID, knownKeyHash: DEMO_API_KEY_HASH }));
  afterAll(async () => {
    await db.from("traces").delete().like("name", "contract-%");
  });
} else {
  describe.skip("Repo contract: supabase (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)", () => {
    it("is skipped", () => {});
  });
}
