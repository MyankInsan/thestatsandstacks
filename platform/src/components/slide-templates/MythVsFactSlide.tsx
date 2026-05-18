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
  /** Single myth string — treated as first pair when myth+fact are provided */
  myth?: string;
  /** Single fact string — treated as first pair when myth+fact are provided */
  fact?: string;
  /** Multiple myth/fact pairs */
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
  // support both single myth/fact and pairs array
  const rows: Pair[] = pairs ?? (myth != null && fact != null ? [{ myth: myth!, fact: fact! }] : []);

  return (
    <SlideFrame frameNo={frameNo} totalFrames={totalFrames} tone={tone} footer={footer} scale={false}>
      <div className="grid-bg" />
      <div className="frame-body" style={{ gap: 36, paddingTop: 16 }}>
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="display" style={{ fontSize: 72, marginTop: 18, marginBottom: 0, maxWidth: 920, lineHeight: 1.02 }}>{headline}</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, flex: 1, justifyContent: 'center' }}>
          {rows.slice(0, 3).map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 22 }}>
              <div style={{
                flex: 1, padding: '28px 32px', borderRadius: 18,
                background: 'rgba(251,113,133,0.08)',
                border: '1.5px solid rgba(251,113,133,0.30)',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: '#FB7185', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>Myth</div>
                <div style={{ fontSize: 26, fontWeight: 500, color: '#FECDD3', lineHeight: 1.35 }}>{p.myth}</div>
              </div>
              <div style={{
                flex: 1, padding: '28px 32px', borderRadius: 18,
                background: 'rgba(52,211,153,0.08)',
                border: '1.5px solid rgba(52,211,153,0.40)',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color: '#34D399', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>Fact</div>
                <div style={{ fontSize: 26, fontWeight: 500, color: '#BBF7D0', lineHeight: 1.35 }}>{p.fact}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
