'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';

interface QuoteSlideProps {
  eyebrow?: string;
  quote: string;
  attribution: string;
  source?: string;
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  frameNo?: number;
  totalFrames?: number;
  footer?: Record<string, unknown>;
}

export function QuoteSlide({
  eyebrow = 'WORTH REMEMBERING',
  quote,
  attribution,
  source,
  tone = 'emerald',
  frameNo,
  totalFrames,
  footer,
}: QuoteSlideProps) {
  return (
    <SlideFrame frameNo={frameNo} totalFrames={totalFrames} tone={tone} footer={footer} scale={false}>
      <div className="halo" />
      <div className="frame-body" style={{ gap: 24, paddingTop: 8 }}>
        <div className="eyebrow">{eyebrow}</div>
        {/* big opening glyph */}
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 280, fontWeight: 800,
          color: 'var(--tone-acc)', opacity: 0.32,
          lineHeight: 0.55, marginBottom: -50, marginLeft: -8,
        }}>&ldquo;</div>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 78, fontWeight: 700, color: '#F8FAFC',
          lineHeight: 1.12, letterSpacing: '-0.02em',
          maxWidth: 960, margin: 0,
        }}>
          {quote}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <span style={{ width: 64, height: 3, background: 'var(--tone-acc)' }} />
          <div>
            <div style={{ fontSize: 28, fontWeight: 600, color: '#F8FAFC' }}>{attribution}</div>
            {source && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: '#94A3B8', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 6 }}>{source}</div>
            )}
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}
