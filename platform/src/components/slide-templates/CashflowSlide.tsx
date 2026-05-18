'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';

interface CashflowRow {
  label: string;
  pct: number;
  color?: string;
  note?: string;
}

interface CashflowSlideProps {
  eyebrow?: string;
  headline?: string;
  /** Primary rows array */
  rows?: CashflowRow[];
  /** Alias for rows */
  items?: CashflowRow[];
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  frameNo?: number;
  totalFrames?: number;
  footer?: Record<string, unknown>;
}

const DEFAULT_COLORS = ['#34D399', '#F59E0B', '#60A5FA', '#F87171', '#A78BFA'];

export function CashflowSlide({
  eyebrow = 'MONEY FLOW',
  headline,
  rows,
  items,
  tone = 'amber',
  frameNo,
  totalFrames,
  footer,
}: CashflowSlideProps) {
  const rawRows = rows ?? items ?? [];
  // assign fallback colors if missing
  const normalizedRows = rawRows.map((r, i) => ({
    ...r,
    color: r.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }));
  const total = normalizedRows.reduce((a, r) => a + r.pct, 0) || 100;

  return (
    <SlideFrame frameNo={frameNo} totalFrames={totalFrames} tone={tone} footer={footer} scale={false}>
      <div className="grid-bg" />
      <div className="frame-body" style={{ gap: 32, paddingTop: 16 }}>
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="display" style={{ fontSize: 72, marginTop: 18, marginBottom: 0, maxWidth: 920, lineHeight: 1.02 }}>
            {headline}
          </h2>
        </div>

        {/* big stacked bar */}
        <div style={{ height: 100, borderRadius: 18, overflow: 'hidden', display: 'flex', border: '1.5px solid #263B52' }}>
          {normalizedRows.map((r, i) => (
            <div key={i} style={{ width: `${(r.pct / total) * 100}%`, background: r.color, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 22, top: 32, fontWeight: 800, fontSize: 32, color: '#04140C', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display)' }}>{r.pct}%</span>
            </div>
          ))}
        </div>

        {/* legend rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, justifyContent: 'center' }}>
          {normalizedRows.map((r, i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '26px 280px 1fr 96px',
              alignItems: 'center', gap: 24,
              padding: '24px 28px', background: 'rgba(7,17,31,0.7)',
              border: '1px solid #263B52', borderRadius: 16,
            }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, background: r.color }} />
              <span style={{ fontSize: 30, fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.01em' }}>{r.label}</span>
              <span style={{ fontSize: 22, color: '#94A3B8', fontWeight: 500 }}>{r.note ?? ''}</span>
              <span style={{ fontSize: 32, fontWeight: 800, color: r.color, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display)' }}>{r.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
