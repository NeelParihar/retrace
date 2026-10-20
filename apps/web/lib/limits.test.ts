import { describe, expect, it } from "vitest";
import { selectProvider } from "./agent/select";
import { createMemoryRepo } from "./db";
import { checkLiveAllowed, clientIpHash, recordLiveUsage } from "./limits";

const NOW = Date.parse("2026-10-20T12:34:00Z");

describe("live limits", () => {
  it("allows 5 live runs per IP per hour", async () => {
    const repo = createMemoryRepo();
    for (let i = 0; i < 5; i++) expect(await checkLiveAllowed(repo, "ip-a", NOW)).toEqual({ ok: true });
    expect(await checkLiveAllowed(repo, "ip-a", NOW)).toMatchObject({ ok: false, reason: expect.stringMatching(/5 runs per hour/) });
    expect(await checkLiveAllowed(repo, "ip-b", NOW)).toEqual({ ok: true });
    expect(await checkLiveAllowed(repo, "ip-a", NOW + 3_600_000)).toEqual({ ok: true });
  });
  it("stops at the daily cost cap", async () => {
    const repo = createMemoryRepo();
    await recordLiveUsage(repo, NOW, 1.01);
    expect(await checkLiveAllowed(repo, "ip-c", NOW)).toMatchObject({ ok: false, reason: expect.stringMatching(/daily budget/) });
  });
  it("hashes client IPs from Netlify/forwarded headers", () => {
    const a = clientIpHash(new Request("http://x", { headers: { "x-nf-client-connection-ip": "1.2.3.4" } }));
    const b = clientIpHash(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } }));
    expect(a).toBe(b);
    expect(a).not.toContain("1.2.3.4");
  });
});

describe("selectProvider", () => {
  it("uses simulated when asked", async () => {
    const r = await selectProvider({ mode: "simulated", repo: createMemoryRepo(), ipHash: "i", now: NOW, env: { ANTHROPIC_API_KEY: "k" } });
    expect(r).toMatchObject({ provider: { kind: "simulated" }, notice: null });
  });
  it("falls back with a notice when live is not configured", async () => {
    const r = await selectProvider({ mode: "live", repo: createMemoryRepo(), ipHash: "i", now: NOW, env: {} });
    expect(r.provider.kind).toBe("simulated");
    expect(r.notice).toMatch(/isn't configured/);
  });
  it("falls back with a notice when limited", async () => {
    const repo = createMemoryRepo();
    await recordLiveUsage(repo, NOW, 5);
    const r = await selectProvider({ mode: "live", repo, ipHash: "i", now: NOW, env: { ANTHROPIC_API_KEY: "k" } });
    expect(r.provider.kind).toBe("simulated");
    expect(r.notice).toMatch(/daily budget/);
  });
  it("returns the live provider when allowed", async () => {
    const r = await selectProvider({ mode: "live", repo: createMemoryRepo(), ipHash: "i", now: NOW, env: { ANTHROPIC_API_KEY: "k" } });
    expect(r).toMatchObject({ provider: { kind: "live", model: "claude-haiku-4-5-20251001" }, notice: null });
  });
});
