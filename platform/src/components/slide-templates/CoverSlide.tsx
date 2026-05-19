// platform/src/components/slide-templates/CoverSlide.tsx
'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';
import { LineChart } from '../charts/LineChart';
import { DonutChart } from '../charts/DonutChart';
import { BarChart } from '../charts/BarChart';

interface DashboardPanels {
  marketReturn: number;
  allocation: { equities: number; bonds: number; cash: number; alternatives: number };
  metrics: { returnYtd: number; volatility: number; sharpe: number; maxDrawdown: number };
}

interface CoverSlideProps {
  eyebrow?: string;
  headline: string;
  accent?: string;
  kicker?: string;
  frameNo?: number;
  totalFrames?: number;
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  footer?: Record<string, unknown>;
  dashboardPanels?: DashboardPanels;
}

const BASE_METRICS = { returnYtd: 7.68, volatility: 11.42, sharpe: 0.67, maxDrawdown: -8.21 };
const BASE_ALLOC = { equities: 65, bonds: 20, cash: 10, alternatives: 5 };
const BASE_TREND = [6.1, 5.8, 6.4, 7.0, 6.7, 7.2, 7.68];

function defaultPanels(topic: string): DashboardPanels {
  const offset = topic.length % 5;
  return {
    marketReturn: BASE_METRICS.returnYtd + offset * 0.3,
    allocation: BASE_ALLOC,
    metrics: {
      returnYtd: BASE_METRICS.returnYtd + offset * 0.3,
      volatility: BASE_METRICS.volatility - offset * 0.2,
      sharpe: BASE_METRICS.sharpe + offset * 0.02,
      maxDrawdown: BASE_METRICS.maxDrawdown - offset * 0.1,
    },
  };
}

const ALLOC_COLORS = ['#34D399', '#FBBF24', '#51D6E8', '#A78BFA'];

export function CoverSlide({
  eyebrow = 'MARKET EDUCATION',
  headline,
  accent,
  kicker = 'Swipe for the breakdown.',
  frameNo = 1,
  totalFrames = 6,
  tone = 'emerald',
  footer,
  dashboardPanels,
}: CoverSlideProps) {
  const parts = accent ? headline.split(accent) : [headline];
  const panels = dashboardPanels ?? defaultPanels(headline);
  const { metrics, allocation } = panels;
  const allocSegments = [
    { label: 'EQ', value: allocation.equities, color: ALLOC_COLORS[0] },
    { label: 'FI', value: allocation.bonds, color: ALLOC_COLORS[1] },
    { label: 'CA', value: allocation.cash, color: ALLOC_COLORS[2] },
    { label: 'ALT', value: allocation.alternatives, color: ALLOC_COLORS[3] },
  ];
  const trendPoints = BASE_TREND.map((v, i) => v + (headline.length % 3) * 0.1 * i);

  return (
    <SlideFrame frameNo={frameNo} totalFrames={totalFrames} tone={tone} footer={footer} scale={false}
      theme={{ bg: 'linear-gradient(180deg,#06101D 0%,#07121f 60%,#050e1a 100%)' }}
    >
      <div className="grid-bg" />
      <div className="frame-body" style={{ gap: 0, paddingTop: 24, justifyContent: 'space-between' }}>
        {/* top: eyebrow + headline + kicker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="display" style={{ fontSize: 108, margin: 0, lineHeight: 0.97, fontWeight: 800, maxWidth: 940 }}>
            {parts.map((p, i) => (
              <span key={i}>
                {p}
                {accent && i < parts.length - 1 && <em>{accent}</em>}
              </span>
            ))}
          </h1>
          <div style={{ fontSize: 26, fontWeight: 500, color: '#64748B', lineHeight: 1.4, maxWidth: 780 }}>
            {kicker}
          </div>
        </div>

        {/* bottom: 3 mini dashboard panels */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, paddingBottom: 8 }}>
          {/* panel 1: return trend sparkline */}
          <div style={{
            background: 'rgba(7,17,31,0.82)', border: '1px solid rgba(52,211,153,0.18)',
            borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: 10, fontWeight: 600, color: '#34D399', letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>YTD RETURN</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#F8FAFC', fontVariantNumeric: 'tabular-nums' }}>
              +{metrics.returnYtd.toFixed(2)}%
            </div>
            <LineChart points={trendPoints} color="#34D399" width={240} height={44} filled strokeWidth={2} />
          </div>

          {/* panel 2: allocation donut */}
          <div style={{
            background: 'rgba(7,17,31,0.82)', border: '1px solid rgba(251,191,36,0.18)',
            borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: 10, fontWeight: 600, color: '#FBBF24', letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>ALLOCATION</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <DonutChart segments={allocSegments} size={72} thickness={12} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {allocSegments.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>{s.label} {s.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* panel 3: metrics table */}
          <div style={{
            background: 'rgba(7,17,31,0.82)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: 10, fontWeight: 600, color: '#94A3B8', letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>RISK METRICS</div>
            {[
              { label: 'VOLATILITY', value: `${metrics.volatility.toFixed(1)}%` },
              { label: 'SHARPE', value: metrics.sharpe.toFixed(2) },
              { label: 'MAX DD', value: `${metrics.maxDrawdown.toFixed(1)}%` },
            ].map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                  fontSize: 10, color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase',
                }}>{m.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#CBD5E1', fontVariantNumeric: 'tabular-nums' }}>
                  {m.value}
                </span>
              </div>
            ))}
            {/* decorative bar chart */}
            <div style={{ marginTop: 4 }}>
              <BarChart
                bars={[
                  { label: 'Q1', value: 3.2 },
                  { label: 'Q2', value: 2.1 },
                  { label: 'Q3', value: 4.8 },
                  { label: 'Q4', value: metrics.returnYtd },
                ]}
                maxValue={10}
                height={52} width={232}
                showValues={false} showLabels
                color="#34D399" barRadius={3}
              />
            </div>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}
