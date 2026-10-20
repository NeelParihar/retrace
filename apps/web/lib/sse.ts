import type { AgentEvent } from "./agent/types";

/**
 * Streams agent events as SSE. If the client goes away, emitting becomes a no-op and the run
 * keeps going to completion, so the trace is always finalized.
 */
export function sseStream(run: (emit: (e: AgentEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: AgentEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          closed = true;
        }
      };
      try {
        await run(emit);
      } catch (err) {
        console.error("[retrace] stream failed", err);
        emit({ type: "error", data: { message: "The run failed on the server." } });
      } finally {
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed by the client */
          }
        }
      }
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}
