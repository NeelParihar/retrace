# @retrace/sdk

Tiny, dependency-free client for sending agent traces to Retrace.

```ts
import { Retrace } from "@retrace/sdk";

const rt = new Retrace({ apiKey: process.env.RETRACE_API_KEY!, baseUrl: "https://<your-retrace>" });
const trace = rt.trace({ name: "support-bot", input });
const gen = trace.generation({ name: "answer", model: "claude-haiku-4-5", input });
gen.end({ output, usage: { promptTokens, completionTokens } });
await trace.end({ output });
```

Events are buffered and flushed every second, every 20 events, and on `trace.end()`. Failed sends retry with backoff; the SDK never throws into your code. Cost is computed server-side from token counts.
