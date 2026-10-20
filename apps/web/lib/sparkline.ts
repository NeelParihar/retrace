export function sparkPoints(values: number[], width: number, height: number, pad = 1): [number, number][] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values.map((v, i) => [pad + i * step, height - pad - ((v - min) / span) * (height - pad * 2)]);
}

export function sparkPath(values: number[], width: number, height: number, pad = 1): string {
  return sparkPoints(values, width, height, pad)
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
}
