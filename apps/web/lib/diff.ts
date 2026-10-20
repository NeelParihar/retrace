export type DiffLine = { op: "same" | "add" | "del"; text: string };

const MAX_CELLS = 250_000;

export function diffLines(a: string, b: string): DiffLine[] {
  const A = a.split("\n");
  const B = b.split("\n");
  const n = A.length;
  const m = B.length;
  if (n * m > MAX_CELLS) {
    return [...A.map((text) => ({ op: "del" as const, text })), ...B.map((text) => ({ op: "add" as const, text }))];
  }
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ op: "same", text: A[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: "del", text: A[i++] });
    else out.push({ op: "add", text: B[j++] });
  }
  while (i < n) out.push({ op: "del", text: A[i++] });
  while (j < m) out.push({ op: "add", text: B[j++] });
  return out;
}
