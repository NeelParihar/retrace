import { describe, expect, it } from "vitest";
import { cumulative, initReplay, replayReducer, type ReplayAction, type ReplayState } from "./replay";

const run = (s: ReplayState, ...actions: ReplayAction[]) => actions.reduce(replayReducer, s);

describe("replay", () => {
  it("starts idle showing everything", () => {
    expect(initReplay(3)).toEqual({ n: 3, cursor: 2, playing: false, speed: 1, mode: "idle" });
  });
  it("play from the end restarts from nothing", () => {
    expect(run(initReplay(3), { type: "play" })).toMatchObject({ cursor: -1, playing: true, mode: "replay" });
  });
  it("ticks forward and stops at the last step", () => {
    const s = run(initReplay(3), { type: "play" }, { type: "tick" }, { type: "tick" }, { type: "tick" });
    expect(s).toMatchObject({ cursor: 2, playing: false });
    expect(run(s, { type: "tick" }).cursor).toBe(2);
  });
  it("ignores ticks while paused", () => {
    expect(run(initReplay(3), { type: "seek", index: 0 }, { type: "tick" }).cursor).toBe(0);
  });
  it("clamps manual stepping", () => {
    expect(run(initReplay(3), { type: "seek", index: 0 }, { type: "prev" }, { type: "prev" }).cursor).toBe(-1);
    expect(run(initReplay(3), { type: "seek", index: 0 }, ...Array(5).fill({ type: "next" })).cursor).toBe(2);
  });
  it("toggle pauses and resumes mid-way", () => {
    const s = run(initReplay(3), { type: "seek", index: 0 }, { type: "toggle" });
    expect(s).toMatchObject({ playing: true, cursor: 0 });
    expect(run(s, { type: "toggle" }).playing).toBe(false);
  });
  it("exit and reset return to idle but keep speed", () => {
    const s = run(initReplay(3), { type: "speed", speed: 4 }, { type: "seek", index: 1 });
    expect(run(s, { type: "exit" })).toEqual({ n: 3, cursor: 2, playing: false, speed: 4, mode: "idle" });
    expect(run(s, { type: "reset", n: 5 })).toEqual({ n: 5, cursor: 4, playing: false, speed: 4, mode: "idle" });
  });
  it("does nothing when there are no steps", () => {
    expect(run(initReplay(0), { type: "play" })).toEqual(initReplay(0));
  });
  it("accumulates tokens and cost up to the cursor", () => {
    const steps = [
      { prompt_tokens: 10, completion_tokens: 5, cost: 0.0001 },
      { prompt_tokens: 0, completion_tokens: 0, cost: 0 },
      { prompt_tokens: 20, completion_tokens: 10, cost: 0.0002 },
    ];
    expect(cumulative(steps, -1)).toEqual({ tokens: 0, cost: 0 });
    expect(cumulative(steps, 1)).toEqual({ tokens: 15, cost: 0.0001 });
    expect(cumulative(steps, 2)).toEqual({ tokens: 45, cost: 0.0003 });
  });
});
