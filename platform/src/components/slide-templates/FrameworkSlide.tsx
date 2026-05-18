'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';

interface Step {
  label: string;
  body: string;
}

interface FrameworkSlideProps {
  eyebrow?: string;
  headline?: string;
  steps?: Step[];
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  frameNo?: number;
  totalFrames?: number;
  footer?: Record<string, unknown>;
}

export function FrameworkSlide({
  eyebrow = 'DECISION FILTER',
  headline,
  steps = [],
  tone = 'emerald',
  frameNo,
  totalFrames,
  footer,
}: FrameworkSlideProps) {
  return (
    <SlideFrame frameNo={frameNo} totalFrames={totalFrames} tone={tone} footer={footer} scale={false}>
      <div className="grid-bg" />
      <div className="frame-body" style={{ gap: 36, paddingTop: 16 }}>
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="display" style={{ fontSize: 72, marginTop: 18, marginBottom: 0, maxWidth: 940, lineHeight: 1.02 }}>
            {headline}
          </h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, flex: 1, justifyContent: 'center' }}>
          {steps.slice(0, 3).map((s, i) => (
            <div key={i} style={{
              background: 'rgba(11, 22, 38, 0.92)',
              border: '1.5px solid #263B52',
              borderRadius: 24,
              padding: '36px 40px',
              display: 'flex',
              gap: 32,
              alignItems: 'center',
            }}>
              <div style={{
                width: 92, height: 92, borderRadius: 22, flexShrink: 0,
                display: 'grid', placeItems: 'center',
                background: 'var(--tone-acc-tint, rgba(52,211,153,0.16))',
                border: '2px solid var(--tone-acc, #34D399)',
                color: 'var(--tone-acc, #34D399)',
                fontWeight: 800, fontSize: 44, fontVariantNumeric: 'tabular-nums',
                fontFamily: 'var(--font-mono)',
              }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: 'var(--tone-acc, #34D399)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>{s.label}</div>
                <div style={{ fontSize: 32, fontWeight: 600, color: '#E5EEFB', lineHeight: 1.35 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
