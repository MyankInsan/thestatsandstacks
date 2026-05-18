// platform/src/components/slide-templates/CoverSlide.tsx
'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';

interface CoverSlideProps {
  eyebrow?: string;
  headline: string;
  accent?: string;
  kicker?: string;
  frameNo?: number;
  totalFrames?: number;
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  footer?: Record<string, unknown>;
}

export function CoverSlide({
  eyebrow = 'MARKET EDUCATION',
  headline,
  accent,
  kicker = 'Swipe for the research filter, not a buy signal.',
  frameNo = 1,
  totalFrames = 6,
  tone = 'emerald',
  footer,
}: CoverSlideProps) {
  const parts = accent ? headline.split(accent) : [headline];
  return (
    <SlideFrame frameNo={frameNo} totalFrames={totalFrames} tone={tone} footer={footer} scale={false}>
      <div className="grid-bg" />
      <div className="frame-body" style={{ gap: 32, paddingTop: 16 }}>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="display" style={{ fontSize: 116, margin: 0, lineHeight: 0.98, fontWeight: 800 }}>
          {parts.map((p, i) => (
            <span key={i}>
              {p}
              {accent && i < parts.length - 1 && <em>{accent}</em>}
            </span>
          ))}
        </h1>
        <div style={{ fontSize: 28, fontWeight: 500, color: '#94A3B8', lineHeight: 1.4, maxWidth: 820 }}>
          {kicker}
        </div>
      </div>
    </SlideFrame>
  );
}
