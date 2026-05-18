'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';

interface BigNumberSlideProps {
  eyebrow?: string;
  /** The big number/value to display */
  value?: string;
  /** Alias for value */
  number?: string;
  unit?: string;
  /** Context line below the number */
  context?: string;
  /** Alias for context */
  label?: string;
  footnote?: string;
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  frameNo?: number;
  totalFrames?: number;
  footer?: Record<string, unknown>;
}

export function BigNumberSlide({
  eyebrow = 'THE NUMBER',
  value,
  number,
  unit = '',
  context,
  label,
  footnote,
  tone = 'emerald',
  frameNo,
  totalFrames,
  footer,
}: BigNumberSlideProps) {
  const displayValue = value ?? number ?? '';
  const displayContext = context ?? label ?? '';

  return (
    <SlideFrame frameNo={frameNo} totalFrames={totalFrames} tone={tone} footer={footer} scale={false}>
      <div className="grid-bg" />
      <div className="frame-body" style={{ gap: 28, paddingTop: 16 }}>
        <div className="eyebrow">{eyebrow}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginTop: 16 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 400, fontWeight: 800, color: 'var(--tone-acc)',
            letterSpacing: '-0.06em', lineHeight: 0.85,
            fontVariantNumeric: 'tabular-nums',
          }}>{displayValue}</span>
          {unit && (
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 130, fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.02em' }}>{unit}</span>
          )}
        </div>
        <div style={{ fontSize: 44, fontWeight: 600, color: '#F8FAFC', lineHeight: 1.25, maxWidth: 900 }}>
          {displayContext}
        </div>
        {footnote && (
          <div style={{ paddingLeft: 20, borderLeft: '3px solid var(--tone-acc)', fontSize: 18, color: '#94A3B8', lineHeight: 1.5, maxWidth: 820, fontFamily: 'var(--font-mono)', fontWeight: 400 }}>
            {footnote}
          </div>
        )}
      </div>
    </SlideFrame>
  );
}
