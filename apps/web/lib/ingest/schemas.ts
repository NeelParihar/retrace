import { z } from "zod";

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const name = z.string().min(1).max(200);

export const ingestEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("trace.create"),
    id: uuid,
    timestamp,
    name,
    input: z.unknown().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  z.object({
    type: z.literal("trace.end"),
    id: uuid,
    timestamp,
    status: z.enum(["success", "error"]).default("success"),
    output: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("step.create"),
    id: uuid,
    traceId: uuid,
    parentStepId: uuid.nullable().optional(),
    timestamp,
    stepType: z.enum(["llm", "tool", "span"]),
    name,
    model: z.string().max(100).nullable().optional(),
    input: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("step.end"),
    id: uuid,
    traceId: uuid,
    timestamp,
    output: z.unknown().optional(),
    usage: z
      .object({ promptTokens: z.number().int().min(0), completionTokens: z.number().int().min(0) })
      .optional(),
    error: z.string().max(4000).nullable().optional(),
  }),
]);

export type IngestEvent = z.infer<typeof ingestEvent>;

export const ingestBody = z.object({ batch: z.array(z.unknown()).min(1).max(100) });
