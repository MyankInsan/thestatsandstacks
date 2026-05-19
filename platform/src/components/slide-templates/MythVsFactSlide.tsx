'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';

interface Pair {
  myth: string;
  fact: string;
}

interface MythVsFactSlideProps {
  eyebrow?: string;
  headline?: string;
  myth?: string;
  fact?: string;
  pairs?: Pair[];
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  frameNo?: number;
  totalFrames?: number;
  footer?: Record<string, unknown>;
}

export function MythVsFactSlide({
  eyebrow = 'MYTH VS FACT',
  headline = 'Three credit-score myths to retire',
  myth,
  fact,
  pairs,
  tone = 'rose',
  frameNo,
  totalFrames,
  footer,
}: MythVsFactSlideProps) {
  const rows: Pair[] = pairs ?? (myth != null && fact != null ? [{ myth: myth!, fact: fact! }] : []);

  return (
    <SlideFrame frameNo={frameNo} totalFrames={totalFrames} tone={tone} footer={footer} scale={false}>
      <div className="grid-bg" />
      <div className="frame-body" style={{ gap: 36, paddingTop: 16 }}>
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="display" style={{ fontSize: 72, marginTop: 18, marginBottom: 0, maxWidth: 920, lineHeight: 1.02 }}>
            {headline}
          </h2>
        </div>

        {/* column header labels */}
        <div style={{ display: 'flex', gap: 22 }}>
          <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.20em', color: '#FB7185', textTransform: 'uppercase', paddingLeft: 4 }}>
            ✕  MYTH
          </div>
          <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.20em', color: '#34D399', textTransform: 'uppercase', paddingLeft: 4 }}>
            ✓  FACT
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1, justifyContent: 'center', marginTop: -16 }}>
          {rows.slice(0, 3).map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 22 }}>
              <div style={{
                flex: 1, padding: '24px 28px', borderRadius: 16,
                background: 'rgba(251,113,133,0.07)',
                border: '1.5px solid rgba(251,113,133,0.25)',
              }}>
                <div style={{ fontSize: 25, fontWeight: 500, color: '#FECDD3', lineHeight: 1.38 }}>{p.myth}</div>
              </div>
              <div style={{
                flex: 1, padding: '24px 28px', borderRadius: 16,
                background: 'rgba(52,211,153,0.07)',
                border: '1.5px solid rgba(52,211,153,0.30)',
              }}>
                <div style={{ fontSize: 25, fontWeight: 500, color: '#BBF7D0', lineHeight: 1.38 }}>{p.fact}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
