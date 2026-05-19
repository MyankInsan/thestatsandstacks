'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';
import { DualBarChart } from '../charts/DualBarChart';
import { LineChart } from '../charts/LineChart';

interface FlowSide {
  total: number;
  items: { label: string; amount: number }[];
}

interface CashflowSlideProps {
  eyebrow?: string;
  headline?: string;
  inflow?: FlowSide;
  outflow?: FlowSide;
  trend?: number[];
  trendLabel?: string;
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  frameNo?: number;
  totalFrames?: number;
  footer?: Record<string, unknown>;
  /** Legacy compat — ignored */
  rows?: unknown;
  items?: unknown;
}

const DEFAULT_INFLOW: FlowSide = {
  total: 5800,
  items: [
    { label: 'Salary', amount: 4200 },
    { label: 'Side Income', amount: 900 },
    { label: 'Investments', amount: 700 },
  ],
};

const DEFAULT_OUTFLOW: FlowSide = {
  total: 4550,
  items: [
    { label: 'Housing', amount: 2000 },
    { label: 'Food', amount: 700 },
    { label: 'Transport', amount: 650 },
    { label: 'Lifestyle', amount: 800 },
    { label: 'Other', amount: 400 },
  ],
};

const DEFAULT_TREND = [4200, 4400, 4550, 4300, 4800, 5100, 5800];

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA')}`;
}

export function CashflowSlide({
  eyebrow = 'MONEY FLOW',
  headline = 'Where Your Money Goes',
  inflow = DEFAULT_INFLOW,
  outflow = DEFAULT_OUTFLOW,
  trend = DEFAULT_TREND,
  trendLabel = '7-MONTH TREND',
  tone = 'amber',
  frameNo,
  totalFrames,
}: CashflowSlideProps) {
  const net = inflow.total - outflow.total;
  const netColor = net >= 0 ? '#34D399' : '#FB7185';

  return (
    <SlideFrame frameNo={frameNo} totalFrames={totalFrames} tone={tone} scale={false}>
      <div className="grid-bg" />
      <div className="frame-body" style={{ gap: 28, paddingTop: 16 }}>
        {/* header row: eyebrow + trend sparkline */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h2 className="display" style={{ fontSize: 68, marginTop: 14, marginBottom: 0, maxWidth: 760, lineHeight: 1.02 }}>
              {headline}
            </h2>
          </div>
          {trend.length >= 2 && (
            <div style={{
              background: 'rgba(7,17,31,0.75)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: '14px 18px',
              display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                fontSize: 10, fontWeight: 600, color: '#64748B', letterSpacing: '0.18em', textTransform: 'uppercase',
              }}>
                {trendLabel}
              </div>
              <LineChart points={trend} color="#FBBF24" width={160} height={48} filled strokeWidth={2} />
            </div>
          )}
        </div>

        {/* dual bar chart */}
        <div style={{
          flex: 1,
          background: 'rgba(7,17,31,0.72)',
          border: '1.5px solid rgba(255,255,255,0.07)',
          borderRadius: 20, padding: '32px 40px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <DualBarChart
            left={{ label: '↑ INFLOW', total: inflow.total, color: '#34D399', items: inflow.items.slice(0, 3) }}
            right={{ label: '↓ OUTFLOW', total: outflow.total, color: '#FBBF24', items: outflow.items.slice(0, 3) }}
            currencySymbol="$"
          />
        </div>

        {/* summary strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 14,
        }}>
          {[
            { label: '↑ INFLOW', value: fmt(inflow.total), color: '#34D399' },
            { label: '↓ OUTFLOW', value: fmt(outflow.total), color: '#FBBF24' },
            { label: '↗ NET', value: fmt(Math.abs(net)), color: netColor },
          ].map((item, i) => (
            <div key={i} style={{
              background: 'rgba(7,17,31,0.8)',
              border: `1.5px solid ${item.color}28`,
              borderRadius: 14, padding: '18px 20px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{
                fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                fontSize: 11, fontWeight: 600, color: item.color,
                letterSpacing: '0.18em', textTransform: 'uppercase',
              }}>
                {item.label}
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#F8FAFC', fontVariantNumeric: 'tabular-nums' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
