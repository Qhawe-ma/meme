export function Spark({ points, up }: { points: number[]; up: boolean }) {
  const values = points.length > 1 ? points : [1, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 84;
  const h = 28;
  const d = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * w;
      const y = h - ((value - min) / span) * (h - 2) - 1;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-[84px]" aria-hidden>
      <path d={d} fill="none" stroke={up ? "#c6f135" : "#ff4b2b"} strokeWidth="1.6" />
    </svg>
  );
}
