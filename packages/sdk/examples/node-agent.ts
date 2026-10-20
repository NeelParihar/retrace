// Run: RETRACE_BASE_URL=http://localhost:3000 pnpm exec tsx examples/node-agent.ts
import { Retrace } from "../src/index";

const rt = new Retrace({
  apiKey: process.env.RETRACE_API_KEY ?? "rt_demo_public_9f4c2a7e",
  baseUrl: process.env.RETRACE_BASE_URL ?? "http://localhost:3000",
});

const question = "Which plan includes SSO?";
const trace = rt.trace({ name: "pricing-bot", input: { question }, metadata: { example: true } });

const retrieve = trace.span({ name: "retrieve-context" });
const search = trace.tool({ name: "docs.search", input: { query: "SSO plan" }, parentId: retrieve.id });
search.end({ output: { hits: ["pricing#enterprise"] } });
retrieve.end();

const gen = trace.generation({ name: "answer", model: "claude-haiku-4-5", input: { question } });
gen.end({ output: { text: "SSO is included in the Enterprise plan." }, usage: { promptTokens: 640, completionTokens: 18 } });

await trace.end({ output: { answer: "SSO is included in the Enterprise plan." } });
console.log(`sent trace ${trace.id}`);
