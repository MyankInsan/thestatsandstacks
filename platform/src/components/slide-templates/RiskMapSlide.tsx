'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';

interface Risk {
  /** Tag/category label */
  tag?: string;
  /** Alias for tag */
  label?: string;
  /** Description body */
  body?: string;
  /** Severity: 0-4 number or string 'low'|'medium'|'high' */
  severity?: number | string;
}

interface RiskMapSlideProps {
  eyebrow?: string;
  headline?: string;
  risks?: Risk[];
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  frameNo?: number;
  totalFrames?: number;
  footer?: Record<string, unknown>;
}

function severityToNumber(s: number | string | undefined): number {
  if (typeof s === 'number') return s;
  if (s === 'high') return 4;
  if (s === 'medium') return 3;
  if (s === 'low') return 1;
  return 2;
}

export function RiskMapSlide({
  eyebrow = 'RISK FILTER',
  headline = 'Three things that could break the thesis',
  risks = [],
  tone = 'rose',
  frameNo,
  totalFrames,
  footer,
}: RiskMapSlideProps) {
  return (
    <SlideFrame frameNo={frameNo} totalFrames={totalFrames} tone={tone} footer={footer} scale={false}>
      <div className="grid-bg" />
      <div className="frame-body" style={{ gap: 36, paddingTop: 16 }}>
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="display" style={{ fontSize: 72, marginTop: 18, marginBottom: 0, maxWidth: 880, lineHeight: 1.02 }}>{headline}</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, flex: 1, justifyContent: 'center' }}>
          {risks.slice(0, 3).map((r, i) => {
            const sevNum = severityToNumber(r.severity);
            const tagLabel = r.tag ?? r.label ?? '';
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '180px 1fr 220px', alignItems: 'center', gap: 32,
                padding: '36px 36px',
                background: 'rgba(251,113,133,0.06)',
                border: '1.5px solid rgba(251,113,133,0.30)',
                borderRadius: 22,
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 500, color: '#FB7185', letterSpacing: '0.16em', textTransform: 'uppercase' }}>{tagLabel}</div>
                <div style={{ fontSize: 30, fontWeight: 600, color: '#F8FAFC', lineHeight: 1.32 }}>{r.body ?? ''}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: '#94A3B8', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>severity</div>
                  <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                    {[0, 1, 2, 3, 4].map(k => (
                      <span key={k} style={{ width: 16, height: 36, borderRadius: 3, background: k < sevNum ? '#FB7185' : 'rgba(251,113,133,0.18)' }} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SlideFrame>
  );
}
