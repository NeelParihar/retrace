export type JsonTok = { kind: "key" | "string" | "number" | "literal" | "punct" | "space"; text: string };

export function tokenizeJson(text: string): JsonTok[] {
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)|(true|false|null)|([{}[\],:])|(\s+)/g;
  const out: JsonTok[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: "punct", text: text.slice(last, m.index) });
    if (m[1] !== undefined) {
      if (m[2] !== undefined) {
        out.push({ kind: "key", text: m[1] });
        out.push({ kind: "punct", text: m[2] });
      } else out.push({ kind: "string", text: m[1] });
    } else if (m[3] !== undefined) out.push({ kind: "number", text: m[3] });
    else if (m[4] !== undefined) out.push({ kind: "literal", text: m[4] });
    else if (m[5] !== undefined) out.push({ kind: "punct", text: m[5] });
    else out.push({ kind: "space", text: m[6] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ kind: "punct", text: text.slice(last) });
  return out;
}
