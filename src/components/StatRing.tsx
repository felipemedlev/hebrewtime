"use client";

type StatRingProps = {
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
};

export default function StatRing({
  percent,
  size = 120,
  strokeWidth = 8,
  label,
  className = "",
}: StatRingProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <div
      className={`stat-ring ${className}`.trim()}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${clamped}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="stat-ring-bg"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
        />
        <circle
          className="stat-ring-fill"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="stat-ring-center">
        <span className="stat-ring-value">{clamped}%</span>
      </div>
    </div>
  );
}
