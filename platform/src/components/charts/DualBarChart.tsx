'use client';
import React from 'react';

interface DualSide {
  label: string;
  total: number;
  color: string;
  items: { label: string; amount: number }[];
}

interface DualBarChartProps {
  left: DualSide;
  right: DualSide;
  height?: number;
  currencySymbol?: string;
}

function fmt(n: number, sym: string) {
  return `${sym}${n.toLocaleString('en-CA')}`;
}

function SideChart({
  side,
  maxTotal,
  sym,
  align,
}: {
  side: DualSide;
  maxTotal: number;
  sym: string;
  align: 'left' | 'right';
}) {
  const isRight = align === 'right';
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* header */}
      <div style={{
        display: 'flex', flexDirection: isRight ? 'row-reverse' : 'row',
        alignItems: 'baseline', gap: 10,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
          fontSize: 16, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: side.color,
        }}>
          {side.label}
        </span>
        <span style={{ fontSize: 36, fontWeight: 800, color: '#F8FAFC', fontVariantNumeric: 'tabular-nums' }}>
          {fmt(side.total, sym)}
        </span>
      </div>

      {/* bars */}
      {side.items.map((item, i) => {
        const pct = Math.round((item.amount / maxTotal) * 100);
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{
              display: 'flex', justifyContent: isRight ? 'flex-end' : 'flex-start',
              gap: 8, alignItems: 'center',
            }}>
              <span style={{ fontSize: 19, color: '#94A3B8', fontWeight: 500 }}>{item.label}</span>
              <span style={{ fontSize: 19, color: '#CBD5E1', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(item.amount, sym)}
              </span>
            </div>
            <div style={{
              height: 10, borderRadius: 4,
              background: 'rgba(255,255,255,0.06)',
              display: 'flex',
              justifyContent: isRight ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%', borderRadius: 4,
                background: side.color,
                opacity: 0.75 + (i === 0 ? 0.25 : 0),
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DualBarChart({ left, right, height: _height, currencySymbol = '$' }: DualBarChartProps) {
  const maxTotal = Math.max(left.total, right.total, 1);
  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      <SideChart side={left} maxTotal={maxTotal} sym={currencySymbol} align="left" />
      {/* divider */}
      <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
      <SideChart side={right} maxTotal={maxTotal} sym={currencySymbol} align="right" />
    </div>
  );
}
