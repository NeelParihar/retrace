import { describe, expect, it } from "vitest";
import { virtualClock } from "./agent/clock";
import { startRun } from "./agent/loop";
import { SimulatedProvider } from "./agent/simulated";
import { createMemoryRepo } from "./db";
import { DEMO_PROJECT_ID } from "./demo";
import { sseStream } from "./sse";

describe("sseStream", () => {
  it("finishes and finalizes the run when the client disconnects mid-stream", async () => {
    const repo = createMemoryRepo();
    let finished: Promise<unknown> = Promise.resolve();
    const res = sseStream(async (emit) => {
      finished = startRun(
        { repo, provider: new SimulatedProvider(), clock: virtualClock(Date.parse("2026-10-01T10:00:00Z")), emit },
        { projectId: DEMO_PROJECT_ID, task: "How tall is Mount Everest?" },
      );
      await finished;
    });
    const reader = res.body!.getReader();
    await reader.read();
    await reader.cancel();
    const trace = (await finished) as { id: string; status: string };
    expect(trace.status).toBe("success");
    const steps = await repo.getSteps(trace.id);
    expect(steps.every((s) => s.ended_at)).toBe(true);
  });
});
