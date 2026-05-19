'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';

interface PureStatSlideProps {
  eyebrow?: string;
  value?: string;
  /** Alias for value */
  stat?: string;
  unit?: string;
  context?: string;
  /** Alias for context */
  label?: string;
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  frameNo?: number;
  totalFrames?: number;
  footer?: Record<string, unknown>;
}

export function PureStatSlide({
  eyebrow = 'EVIDENCE',
  value,
  stat,
  unit = '',
  context,
  label,
  tone = 'emerald',
  frameNo,
  totalFrames,
  footer,
}: PureStatSlideProps) {
  const displayValue = value ?? stat ?? '';
  const displayContext = context ?? label ?? '';

  return (
    <SlideFrame
      frameNo={frameNo}
      totalFrames={totalFrames}
      tone={tone}
      footer={footer}
      scale={false}
      theme={{ bg: 'linear-gradient(180deg,#06101D 0%,#0a1424 100%)' }}
    >
      <div className="dot-bg" />
      <div className="halo" />

      <div className="frame-body" style={{ justifyContent: 'center', paddingBottom: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 80 }}>{eyebrow}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-start', marginBottom: 56 }}>
          <span style={{
            fontFamily: 'var(--font-display, "Inter", sans-serif)',
            fontSize: 440, fontWeight: 800,
            color: 'var(--tone-acc)',
            letterSpacing: '-0.06em', lineHeight: 0.82,
            fontVariantNumeric: 'tabular-nums',
            textShadow: '0 0 120px var(--tone-acc-tint, rgba(52,211,153,0.25))',
          }}>
            {displayValue}
          </span>
          {unit && (
            <span style={{ fontSize: 140, fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.02em', marginLeft: 12 }}>
              {unit}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 42, fontWeight: 500, color: '#F8FAFC', lineHeight: 1.25, maxWidth: 900,
          borderLeft: '4px solid var(--tone-acc)', paddingLeft: 24,
        }}>
          {displayContext}
        </div>
      </div>
    </SlideFrame>
  );
}
