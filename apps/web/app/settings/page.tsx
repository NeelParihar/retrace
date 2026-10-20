import { headers } from "next/headers";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { getRepo } from "@/lib/db";
import { DEMO_API_KEY } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;
  const pricing = await (await getRepo()).getPricing();

  const sdk = `import { Retrace } from "@retrace/sdk"; // packages/sdk in the repo

const rt = new Retrace({ apiKey: "${DEMO_API_KEY}", baseUrl: "${base}" });

const trace = rt.trace({ name: "support-bot", input: { question } });
const gen = trace.generation({ name: "answer", model: "claude-haiku-4-5", input: { question } });
gen.end({ output: answer, usage: { promptTokens: 812, completionTokens: 164 } });
await trace.end({ output: answer });`;

  const curl = `ID=$(uuidgen | tr A-Z a-z); NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -s ${base}/api/ingest \\
  -H "authorization: Bearer ${DEMO_API_KEY}" \\
  -H "content-type: application/json" \\
  -d '{"batch":[
    {"type":"trace.create","id":"'$ID'","timestamp":"'$NOW'","name":"curl-test"},
    {"type":"trace.end","id":"'$ID'","timestamp":"'$NOW'"}]}'`;

  return (
    <div className="max-w-[860px] space-y-6">
      <h1 className="text-[18px] font-medium">Settings</h1>

      <section className="space-y-2">
        <h2 className="label">api key</h2>
        <div className="panel flex items-center gap-3 px-3 py-2">
          <code className="num">{DEMO_API_KEY}</code>
          <span className="text-[12px] text-muted">Public demo key — anyone can send traces into this project.</span>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="label">send a trace</h2>
        <CodeBlock label="typescript" code={sdk} />
        <CodeBlock label="curl" code={curl} />
        <p className="text-[12px] text-muted">
          Send token counts, not dollars — cost is computed on the server from the pricing table below.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="label">model pricing · usd per million tokens</h2>
        <div className="panel">
          <table className="w-full">
            <thead>
              <tr className="border-b border-hairline">
                <th className="label px-3 py-2 text-left font-normal">model</th>
                <th className="label px-3 py-2 text-right font-normal">input</th>
                <th className="label px-3 py-2 text-right font-normal">output</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((p) => (
                <tr key={p.model} className="border-b border-hairline last:border-0">
                  <td className="num px-3 py-1.5">{p.model}</td>
                  <td className="num px-3 py-1.5 text-right">${p.input_per_mtok.toFixed(2)}</td>
                  <td className="num px-3 py-1.5 text-right">${p.output_per_mtok.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
