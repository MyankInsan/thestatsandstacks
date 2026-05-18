'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';

interface OutroSlideProps {
  headline?: string;
  subhead?: string;
  cta?: string;
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  frameNo?: number;
  totalFrames?: number;
  footer?: Record<string, unknown>;
}

export function OutroSlide({
  headline = 'Save this framework.',
  subhead = 'Follow @thestatsandstacks for daily Canadian money frameworks — no hype.',
  cta = 'SAVE · SHARE · FOLLOW',
  tone = 'emerald',
  frameNo,
  totalFrames,
  footer,
}: OutroSlideProps) {
  const words = headline.split(' ');
  const ctaParts = cta.split(' · ');

  return (
    <SlideFrame frameNo={frameNo} totalFrames={totalFrames} tone={tone} footer={footer} scale={false}>
      <div className="halo" />
      <div className="frame-body" style={{ gap: 32, paddingTop: 16 }}>
        <div className="eyebrow">OUTRO</div>
        <h2 className="display" style={{ fontSize: 132, lineHeight: 0.94, maxWidth: 940, fontWeight: 800, margin: 0 }}>
          {words.map((w, i, arr) =>
            i === arr.length - 1
              ? <em key={i}>{w}</em>
              : <span key={i}>{w} </span>
          )}
        </h2>
        <div style={{ fontSize: 30, fontWeight: 500, color: '#94A3B8', lineHeight: 1.4, maxWidth: 860 }}>
          {subhead}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 24 }}>
          {ctaParts.map((c, i) => (
            <span key={i} style={{
              padding: '22px 32px',
              borderRadius: 999,
              border: '2px solid var(--tone-acc)',
              color: 'var(--tone-acc)',
              fontFamily: 'var(--font-mono)',
              fontWeight: 500,
              fontSize: 22,
              letterSpacing: '0.20em',
            }}>{c}</span>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
