'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';

interface ColData {
  label: string;
  name?: string;
  /** alias for bullets */
  points?: string[];
  bullets?: string[];
}

interface ComparisonSlideProps {
  eyebrow?: string;
  headline?: string;
  left: ColData;
  right: ColData;
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  frameNo?: number;
  totalFrames?: number;
  footer?: Record<string, unknown>;
}

function Col({ label, name, bullets, primary }: { label: string; name?: string; bullets: string[]; primary: boolean }) {
  const color = primary ? 'var(--tone-acc)' : 'var(--tone-acc-soft)';
  return (
    <div style={{
      flex: 1,
      background: 'rgba(7, 17, 31, 0.86)',
      border: `1.5px solid ${color}`,
      borderRadius: 24,
      padding: '36px 36px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 500, color, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{label}</div>
      {name && (
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 96, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.03em', margin: '14px 0 36px', lineHeight: 0.95 }}>
          {name}
        </h3>
      )}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 22, flex: 1 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <span style={{ color, fontSize: 26, fontWeight: 700, marginTop: 0, fontFamily: 'var(--font-mono)' }}>—</span>
            <span style={{ fontSize: 26, fontWeight: 500, color: '#E5EEFB', lineHeight: 1.4 }}>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComparisonSlide({
  eyebrow = 'COMPARISON',
  headline = 'TFSA vs RRSP',
  left,
  right,
  tone = 'amber',
  frameNo,
  totalFrames,
  footer,
}: ComparisonSlideProps) {
  return (
    <SlideFrame frameNo={frameNo} totalFrames={totalFrames} tone={tone} footer={footer} scale={false}>
      <div className="grid-bg" />
      <div className="frame-body" style={{ gap: 32, paddingTop: 16 }}>
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h2 className="display" style={{ fontSize: 64, marginTop: 18, marginBottom: 0, maxWidth: 920, lineHeight: 1.02 }}>{headline}</h2>
        </div>
        <div style={{ display: 'flex', gap: 22, flex: 1 }}>
          <Col label={left.label} name={left.name} bullets={left.bullets ?? left.points ?? []} primary={true} />
          <Col label={right.label} name={right.name} bullets={right.bullets ?? right.points ?? []} primary={false} />
        </div>
      </div>
    </SlideFrame>
  );
}
