'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';

interface MarketPosterSlideProps {
  ticker?: string;
  name?: string;
  delta?: string;
  window?: string;
  headline?: string;
  frameNo?: number;
  totalFrames?: number;
  footer?: Record<string, unknown>;
}

export function MarketPosterSlide({
  ticker = 'SNDK',
  name = 'SanDisk Corp.',
  delta = '+18.4%',
  window: win = 'YEAR TO DATE',
  headline,
  frameNo = 1,
  totalFrames,
  footer,
}: MarketPosterSlideProps) {
  return (
    <SlideFrame
      frameNo={frameNo}
      totalFrames={totalFrames}
      scale={false}
      theme={{ acc: '#51D6E8', acc2: '#34D399', bg: 'linear-gradient(180deg,#020617 0%,#07111F 50%,#020617 100%)' }}
      footer={footer}
    >
      {/* subtle radial halo from upper right */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 78% 18%, rgba(81,214,232,0.18) 0%, transparent 52%)', pointerEvents: 'none' }} />

      {/* compact candle chart, upper-third only */}
      <svg viewBox="0 0 1080 320" style={{ position: 'absolute', left: 0, right: 0, top: 220, width: '100%', height: 320, opacity: 0.85 }}>
        <defs>
          <linearGradient id="mp-line-glow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#51D6E8" stopOpacity={0.0} />
            <stop offset="20%" stopColor="#51D6E8" stopOpacity={0.7} />
            <stop offset="100%" stopColor="#34D399" stopOpacity={1} />
          </linearGradient>
        </defs>
        {/* hairline grid */}
        {[0, 1, 2, 3].map(i => (
          <line key={i} x1="60" y1={40 + i * 60} x2="1020" y2={40 + i * 60} stroke="#1E293B" strokeWidth="1" opacity="0.5" />
        ))}
        {/* candles */}
        {[
          [120, 220, 280], [200, 200, 250], [280, 180, 240], [360, 150, 220],
          [440, 170, 230], [520, 120, 190], [600, 100, 180], [680, 80, 160],
          [760, 70, 140], [840, 50, 130], [920, 40, 120],
        ].map(([cx, hi, lo], i) => (
          <g key={i}>
            <line x1={cx} y1={hi - 8} x2={cx} y2={lo + 8} stroke="#16C784" strokeWidth="2" opacity="0.7" />
            <rect x={cx - 10} y={hi} width="20" height={lo - hi} fill={i === 4 ? '#FB7185' : '#16C784'} rx="2" opacity="0.85" />
          </g>
        ))}
        {/* smooth trendline on top */}
        <path d="M120 250 C220 230 320 210 420 200 C520 180 620 140 720 110 C820 80 920 60 1000 50" fill="none" stroke="url(#mp-line-glow)" strokeWidth="3" strokeLinecap="round" />
      </svg>

      {/* protection gradient */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 35%, rgba(2,6,23,0.85) 55%, #020617 78%, #020617 100%)', pointerEvents: 'none' }} />

      <div className="frame-body" style={{ justifyContent: 'flex-end', paddingBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-mono, "Geist Mono", monospace)', fontSize: 20, fontWeight: 500, color: '#51D6E8', letterSpacing: '0.18em', marginBottom: 24 }}>
          MARKET HEAT · CASE STUDY
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 22, marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--font-mono, "Geist Mono", monospace)', fontSize: 48, fontWeight: 700, color: '#F8FAFC', letterSpacing: '0.06em' }}>{ticker}</span>
          <span style={{ fontSize: 22, color: '#64748B', fontWeight: 500, letterSpacing: '0.04em' }}>{name}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, marginBottom: 36 }}>
          <span style={{ fontSize: 220, fontWeight: 800, color: '#34D399', letterSpacing: '-0.06em', lineHeight: 0.9, fontVariantNumeric: 'tabular-nums' }}>{delta}</span>
          <span style={{ fontFamily: 'var(--font-mono, "Geist Mono", monospace)', fontSize: 18, fontWeight: 500, color: '#94A3B8', letterSpacing: '0.18em', paddingBottom: 28 }}>{win}</span>
        </div>

        {headline && (
          <h1 className="display" style={{ fontSize: 56, maxWidth: 880, fontWeight: 700, lineHeight: 1.1 }}>
            {headline}
          </h1>
        )}
      </div>
    </SlideFrame>
  );
}
