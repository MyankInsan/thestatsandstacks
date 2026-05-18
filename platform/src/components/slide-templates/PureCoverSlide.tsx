'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';

interface PureCoverSlideProps {
  eyebrow?: string;
  headline: string;
  accent?: string;
  frameNo?: number;
  totalFrames?: number;
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  footer?: Record<string, unknown>;
}

export function PureCoverSlide({
  eyebrow = 'CASE STUDY',
  headline,
  accent,
  frameNo = 1,
  totalFrames = 6,
  tone = 'emerald',
  footer,
}: PureCoverSlideProps) {
  const parts = accent ? headline.split(accent) : [headline];
  return (
    <SlideFrame
      frameNo={frameNo}
      totalFrames={totalFrames}
      tone={tone}
      footer={footer}
      scale={false}
      theme={{ bg: 'linear-gradient(180deg,#06101D 0%,#0a1424 100%)' }}
    >
      <div className="frame-body" style={{ justifyContent: 'center', paddingBottom: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 56 }}>{eyebrow}</div>
        <h1 className="display" style={{ fontSize: 140, marginBottom: 0, lineHeight: 0.96, fontWeight: 700, maxWidth: 940 }}>
          {parts.map((p, i) => (
            <span key={i}>
              {p}
              {accent && i < parts.length - 1 && <em>{accent}</em>}
            </span>
          ))}
        </h1>
      </div>
    </SlideFrame>
  );
}
