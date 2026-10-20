import { sparkPath, sparkPoints } from "@/lib/sparkline";

export function Sparkline({ values, width = 200, height = 30 }: { values: number[]; width?: number; height?: number }) {
  const pts = sparkPoints(values, width, height, 2);
  const last = pts[pts.length - 1];
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Cost per day, last 14 days">
      <line x1="0" x2={width} y1={height - 0.5} y2={height - 0.5} stroke="var(--hairline)" strokeWidth="1" />
      <path d={sparkPath(values, width, height, 2)} fill="none" stroke="var(--ink)" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
      {last && <rect x={last[0] - 2} y={last[1] - 2} width="4" height="4" fill="var(--accent)" />}
    </svg>
  );
}
