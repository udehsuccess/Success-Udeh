interface SparklineProps {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
  label?: string;
}

export function Sparkline({
  data,
  positive,
  width = 76,
  height = 24,
  label = 'Price trend',
}: SparklineProps) {
  if (!data || data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="bg-slate-100 dark:bg-slate-800 rounded-sm"
      />
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = 2;

  const coords = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - pad - ((val - min) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const strokeClass = positive
    ? 'stroke-emerald-600 dark:stroke-emerald-400'
    : 'stroke-red-600 dark:stroke-red-400';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="overflow-visible shrink-0"
    >
      <polyline
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClass}
        points={coords.join(' ')}
      />
    </svg>
  );
}
