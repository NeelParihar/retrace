export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

/** Wall clock. `scale` < 1 compresses simulated waits so demo runs feel live but quick. */
export function realClock(scale = 1): Clock {
  return {
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, Math.round(ms * scale))),
  };
}

/** Deterministic clock for tests and seeding: sleeping advances time instantly. */
export function virtualClock(startMs: number): Clock {
  let t = startMs;
  return {
    now: () => t,
    sleep: async (ms) => {
      t += Math.round(ms);
    },
  };
}
