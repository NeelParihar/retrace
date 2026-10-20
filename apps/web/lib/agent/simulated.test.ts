import { describe, expect, it } from "vitest";
import { realClock, virtualClock } from "./clock";
import { SimulatedProvider } from "./simulated";
import { TOOL_DEFS } from "./tools";

describe("SimulatedProvider", () => {
  const req = { system: "sys", messages: [{ role: "user" as const, content: "How tall is Mount Everest?" }], tools: TOOL_DEFS };
  it("is deterministic for the same messages", async () => {
    const p = new SimulatedProvider();
    expect(await p.complete(req)).toEqual(await p.complete(req));
  });
  it("reports usage, latency and stable tool call ids", async () => {
    const c = await new SimulatedProvider().complete(req);
    expect(c.toolCalls).toEqual([{ id: "call_1_0", name: "web_search", input: { query: "How tall is Mount Everest?" } }]);
    expect(c.usage.promptTokens).toBeGreaterThan(5);
    expect(c.usage.completionTokens).toBeGreaterThan(8);
    expect(c.simulatedLatencyMs).toBeGreaterThanOrEqual(350);
    expect(c.simulatedLatencyMs).toBeLessThan(1550);
  });
});

describe("clocks", () => {
  it("virtual clock advances only when sleeping", async () => {
    const c = virtualClock(1000);
    await c.sleep(250);
    expect(c.now()).toBe(1250);
  });
  it("real clock scales sleeps", async () => {
    const c = realClock(0.01);
    const t = Date.now();
    await c.sleep(1000);
    expect(Date.now() - t).toBeLessThan(200);
  });
});
