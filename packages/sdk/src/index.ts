export interface RetraceOptions {
  apiKey: string;
  baseUrl: string;
  /** Flush when this many events are queued. Default 20. */
  flushAt?: number;
  /** Flush at most this long after the first queued event. Default 1000ms. */
  flushIntervalMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  fetch?: typeof fetch;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
}

type Event = Record<string, unknown> & { type: string };

const now = () => new Date().toISOString();
const uuid = () => globalThis.crypto.randomUUID();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Retrace {
  private queue: Event[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();
  private readonly opts: Required<Omit<RetraceOptions, "fetch">> & { fetch: typeof fetch };

  constructor(opts: RetraceOptions) {
    this.opts = {
      flushAt: 20,
      flushIntervalMs: 1000,
      maxRetries: 3,
      retryDelayMs: 200,
      ...opts,
      baseUrl: opts.baseUrl.replace(/\/+$/, ""),
      fetch: opts.fetch ?? globalThis.fetch.bind(globalThis),
    };
  }

  trace(p: { name: string; input?: unknown; metadata?: Record<string, unknown> }): TraceHandle {
    const id = uuid();
    this.enqueue({ type: "trace.create", id, timestamp: now(), name: p.name, input: p.input, metadata: p.metadata });
    return new TraceHandle(this, id);
  }

  /** @internal */
  enqueue(e: Event): void {
    this.queue.push(e);
    if (this.queue.length >= this.opts.flushAt) void this.flush();
    else this.timer ??= setTimeout(() => void this.flush(), this.opts.flushIntervalMs);
  }

  /** Sends everything queued so far. Never rejects. */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const batch = this.queue.splice(0, this.queue.length);
    if (batch.length === 0) return this.chain;
    this.chain = this.chain.then(async () => {
      for (let i = 0; i < batch.length; i += 100) await this.send(batch.slice(i, i + 100));
    });
    return this.chain;
  }

  async shutdown(): Promise<void> {
    await this.flush();
  }

  private async send(batch: Event[]): Promise<void> {
    for (let attempt = 0; attempt <= this.opts.maxRetries; attempt++) {
      try {
        const res = await this.opts.fetch(`${this.opts.baseUrl}/api/ingest`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${this.opts.apiKey}` },
          body: JSON.stringify({ batch }),
        });
        if (res.ok) return;
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          console.warn(`[retrace] ingest rejected batch (${res.status}); dropping ${batch.length} events`);
          return;
        }
      } catch {
        /* network error — retry */
      }
      if (attempt < this.opts.maxRetries) await sleep(this.opts.retryDelayMs * 2 ** attempt);
    }
    console.warn(`[retrace] giving up on ${batch.length} events after ${this.opts.maxRetries + 1} attempts`);
  }
}

export class TraceHandle {
  constructor(private client: Retrace, readonly id: string) {}

  private step(stepType: "llm" | "tool" | "span", p: { name: string; input?: unknown; parentId?: string; model?: string }): StepHandle {
    const id = uuid();
    this.client.enqueue({
      type: "step.create",
      id,
      traceId: this.id,
      parentStepId: p.parentId ?? null,
      timestamp: now(),
      stepType,
      name: p.name,
      model: p.model ?? null,
      input: p.input,
    });
    return new StepHandle(this.client, this.id, id);
  }

  generation(p: { name: string; model: string; input?: unknown; parentId?: string }): StepHandle {
    return this.step("llm", p);
  }
  tool(p: { name: string; input?: unknown; parentId?: string }): StepHandle {
    return this.step("tool", p);
  }
  span(p: { name: string; input?: unknown; parentId?: string }): StepHandle {
    return this.step("span", p);
  }

  async end(p: { output?: unknown; status?: "success" | "error" } = {}): Promise<void> {
    this.client.enqueue({ type: "trace.end", id: this.id, timestamp: now(), status: p.status ?? "success", output: p.output });
    await this.client.flush();
  }
}

export class StepHandle {
  constructor(private client: Retrace, private traceId: string, readonly id: string) {}

  end(p: { output?: unknown; usage?: Usage; error?: string | null } = {}): void {
    this.client.enqueue({ type: "step.end", id: this.id, traceId: this.traceId, timestamp: now(), output: p.output, usage: p.usage, error: p.error ?? null });
  }
}
