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
      <div className="frame-body" style={{ gap: 28, paddingTop: 16 }}>
        {/* Header */}
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="display" style={{
            fontSize: 64,
            marginTop: 14,
            marginBottom: 0,
            maxWidth: 920,
            lineHeight: 1.04,
          }}>
            {headline}
          </h2>
        </div>

        {/* Step cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, justifyContent: 'center' }}>
          {steps.slice(0, 3).map((s, i) => (
            <div key={i} style={{
              background: 'rgba(8, 18, 34, 0.94)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderLeft: '4px solid var(--tone-acc)',
              borderRadius: 20,
              padding: '28px 36px',
              display: 'flex',
              gap: 28,
              alignItems: 'center',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}>
              {/* Step number badge */}
              <div style={{
                width: 80, height: 80, borderRadius: 18, flexShrink: 0,
                display: 'grid', placeItems: 'center',
                background: 'var(--tone-acc-tint, rgba(52,211,153,0.10))',
                border: '2px solid var(--tone-acc)',
                color: 'var(--tone-acc)',
                fontWeight: 800, fontSize: 38,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '-0.02em',
                boxShadow: '0 0 20px var(--tone-acc-tint, rgba(52,211,153,0.12))',
              }}>
                {String(i + 1).padStart(2, '0')}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--tone-acc)',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  opacity: 0.9,
                }}>
                  {s.label}
                </div>
                <div style={{
                  fontSize: 30,
                  fontWeight: 600,
                  color: '#E8F2FF',
                  lineHeight: 1.38,
                  letterSpacing: '-0.01em',
                }}>
                  {s.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
