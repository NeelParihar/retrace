import type { StepRow } from "./types";

export interface ReplayState {
  n: number;
  /** Index of the last revealed step; -1 means nothing revealed yet. */
  cursor: number;
  playing: boolean;
  speed: 1 | 2 | 4;
  mode: "idle" | "replay";
}

export type ReplayAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle" }
  | { type: "tick" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "seek"; index: number }
  | { type: "speed"; speed: 1 | 2 | 4 }
  | { type: "exit" }
  | { type: "reset"; n: number };

export function initReplay(n: number): ReplayState {
  return { n, cursor: n - 1, playing: false, speed: 1, mode: "idle" };
}

export function replayReducer(s: ReplayState, a: ReplayAction): ReplayState {
  if (s.n === 0 && a.type !== "reset" && a.type !== "speed") return s;
  const clamp = (i: number) => Math.max(-1, Math.min(s.n - 1, i));
  switch (a.type) {
    case "play":
      return { ...s, mode: "replay", playing: true, cursor: s.cursor >= s.n - 1 ? -1 : s.cursor };
    case "pause":
      return { ...s, playing: false };
    case "toggle":
      return replayReducer(s, { type: s.playing ? "pause" : "play" });
    case "tick": {
      if (!s.playing) return s;
      const cursor = clamp(s.cursor + 1);
      return { ...s, cursor, playing: cursor < s.n - 1 };
    }
    case "next":
      return { ...s, mode: "replay", playing: false, cursor: clamp(s.cursor + 1) };
    case "prev":
      return { ...s, mode: "replay", playing: false, cursor: clamp(s.cursor - 1) };
    case "seek":
      return { ...s, mode: "replay", playing: false, cursor: clamp(a.index) };
    case "speed":
      return { ...s, speed: a.speed };
    case "exit":
      return { ...initReplay(s.n), speed: s.speed };
    case "reset":
      return { ...initReplay(a.n), speed: s.speed };
  }
}

export function cumulative(steps: Pick<StepRow, "prompt_tokens" | "completion_tokens" | "cost">[], cursor: number) {
  let tokens = 0;
  let cost = 0;
  for (let i = 0; i <= cursor && i < steps.length; i++) {
    tokens += steps[i].prompt_tokens + steps[i].completion_tokens;
    cost += steps[i].cost;
  }
  return { tokens, cost: Math.round(cost * 1e6) / 1e6 };
}
