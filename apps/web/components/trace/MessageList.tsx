import type { Msg } from "@/lib/types";

export function MessageList({ messages }: { messages: Msg[] }) {
  return (
    <ol className="space-y-3">
      {messages.map((m, i) => (
        <li key={i} className="grid grid-cols-[84px_minmax(0,1fr)] gap-3">
          <span className={`label truncate pt-px ${m.role === "tool" && m.isError ? "text-error" : ""}`}>
            {m.role === "tool" ? m.name : m.role}
          </span>
          <div className="min-w-0">
            {m.role === "user" && <p className="whitespace-pre-wrap">{m.content}</p>}
            {m.role === "assistant" && (
              <>
                {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                {m.toolCalls.map((c) => (
                  <p key={c.id} className="num break-all text-[12px] text-muted">
                    → {c.name}({JSON.stringify(c.input)})
                  </p>
                ))}
              </>
            )}
            {m.role === "tool" && (
              <p className="num whitespace-pre-wrap break-all text-[12px] text-muted">
                {m.content.length > 600 ? `${m.content.slice(0, 600)}…` : m.content}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
