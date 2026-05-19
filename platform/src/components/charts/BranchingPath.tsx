'use client';
import React from 'react';

interface PathDef {
  color: string;
  dashed?: boolean;
}

interface EndIcon {
  symbol: string;
  color: string;
}

interface BranchingPathProps {
  paths?: PathDef[];
  endIcons?: EndIcon[];
  width?: number;
  height?: number;
}

const DEFAULT_PATHS: PathDef[] = [
  { color: '#34D399' },
  { color: '#FBBF24' },
  { color: '#34D399', dashed: true },
  { color: '#94A3B8', dashed: true },
];

export function BranchingPath({
  paths = DEFAULT_PATHS,
  endIcons = [],
  width = 520,
  height = 420,
}: BranchingPathProps) {
  const count = paths.length;
  const ox = width * 0.2;
  const oy = height * 0.5;
  const ex = width * 0.88;
  const margin = height * 0.1;
  const step = count > 1 ? (height - margin * 2) / (count - 1) : 0;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <defs>
        {paths.map((p, i) => (
          <filter key={i} id={`glow-${i}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>

      {paths.map((path, i) => {
        const ey = count === 1 ? oy : margin + i * step;
        // cubic bezier: control points at 1/3 and 2/3 of x span
        const cp1x = ox + (ex - ox) * 0.38;
        const cp1y = oy;
        const cp2x = ox + (ex - ox) * 0.62;
        const cp2y = ey;
        const d = `M ${ox},${oy} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}`;

        const icon = endIcons[i];
        return (
          <g key={i}>
            <path
              d={d}
              fill="none"
              stroke={path.color}
              strokeWidth={2.5}
              strokeDasharray={path.dashed ? '8 6' : undefined}
              opacity={0.85}
              filter={`url(#glow-${i})`}
            />
            {/* endpoint circle */}
            <circle cx={ex} cy={ey} r={18} fill={`${path.color}22`} stroke={path.color} strokeWidth={1.5} />
            {icon ? (
              <text
                x={ex} y={ey + 5}
                textAnchor="middle"
                fontSize={16}
                fill={icon.color}
              >
                {icon.symbol}
              </text>
            ) : (
              <circle cx={ex} cy={ey} r={5} fill={path.color} />
            )}
          </g>
        );
      })}

      {/* origin dot */}
      <circle cx={ox} cy={oy} r={10} fill="rgba(52,211,153,0.15)" stroke="#34D399" strokeWidth={2} />
      <circle cx={ox} cy={oy} r={4} fill="#34D399" />
    </svg>
  );
}
