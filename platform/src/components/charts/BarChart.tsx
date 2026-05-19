'use client';
import React from 'react';

interface Bar {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  bars: Bar[];
  maxValue?: number;
  height?: number;
  width?: number;
  showValues?: boolean;
  showLabels?: boolean;
  barRadius?: number;
  color?: string;
}

export function BarChart({
  bars,
  maxValue,
  height = 120,
  width = 400,
  showValues = true,
  showLabels = true,
  barRadius = 4,
  color = '#34D399',
}: BarChartProps) {
  const max = maxValue ?? Math.max(...bars.map(b => b.value), 1);
  const barW = Math.floor((width - (bars.length - 1) * 8) / bars.length);
  const labelH = showLabels ? 22 : 0;
  const valueH = showValues ? 24 : 0;
  const chartH = height - labelH - valueH;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      {bars.map((bar, i) => {
        const x = i * (barW + 8);
        const barH = Math.max(4, (bar.value / max) * chartH);
        const y = valueH + (chartH - barH);
        const fill = bar.color ?? color;
        return (
          <g key={i}>
            {showValues && (
              <text
                x={x + barW / 2} y={y - 6}
                textAnchor="middle"
                fontSize={13} fontWeight={600}
                fill="rgba(248,250,252,0.7)"
                fontFamily="var(--font-mono,'JetBrains Mono',monospace)"
              >
                {bar.value}
              </text>
            )}
            <rect
              x={x} y={y}
              width={barW} height={barH}
              rx={barRadius} ry={barRadius}
              fill={fill}
              opacity={0.9}
            />
            {showLabels && (
              <text
                x={x + barW / 2} y={height - 4}
                textAnchor="middle"
                fontSize={11} fontWeight={500}
                fill="rgba(148,163,184,0.85)"
                fontFamily="var(--font-mono,'JetBrains Mono',monospace)"
              >
                {bar.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
