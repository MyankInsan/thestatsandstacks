'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';
import { BranchingPath } from '../charts/BranchingPath';

interface PathDef {
  color: string;
  dashed?: boolean;
}

interface EndIcon {
  symbol: string;
  color: string;
}

interface Item {
  icon: string;
  label: string;
  body: string;
}

interface OptionelitySlideProps {
  eyebrow?: string;
  headline?: string;
  accentWord?: string;
  kicker?: string;
  paths?: PathDef[];
  endIcons?: EndIcon[];
  items?: Item[];
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  frameNo?: number;
  totalFrames?: number;
  footer?: Record<string, unknown>;
}

const DEFAULT_PATHS: PathDef[] = [
  { color: '#34D399' },
  { color: '#FBBF24' },
  { color: '#34D399', dashed: true },
  { color: '#94A3B8', dashed: true },
];

const DEFAULT_ICONS: EndIcon[] = [
  { symbol: '↑', color: '#34D399' },
  { symbol: '$', color: '#FBBF24' },
  { symbol: '⚡', color: '#51D6E8' },
  { symbol: '◎', color: '#94A3B8' },
];

const DEFAULT_ITEMS: Item[] = [
  { icon: '01', label: 'Keep Options Open', body: 'Avoid locking capital into single irreversible bets early' },
  { icon: '02', label: 'Staged Commitment', body: 'Deploy in tranches — preserve flexibility as information improves' },
  { icon: '03', label: 'Real Option Value', body: 'Future choices have positive expected value — protect them' },
  { icon: '04', label: 'Asymmetric Upside', body: 'Structure positions with bounded downside and open upside' },
];

export function OptionelitySlide({
  eyebrow = 'FRAMEWORK',
  headline = 'Optionality Creates Future Choices',
  accentWord,
  kicker,
  paths = DEFAULT_PATHS,
  endIcons = DEFAULT_ICONS,
  items = DEFAULT_ITEMS,
  tone = 'emerald',
  frameNo,
  totalFrames,
}: OptionelitySlideProps) {
  const accentParts = accentWord ? headline.split(accentWord) : [headline];

  return (
    <SlideFrame frameNo={frameNo} totalFrames={totalFrames} tone={tone} scale={false}>
      <div className="dot-bg" />
      <div className="frame-body" style={{ gap: 0, paddingTop: 24, justifyContent: 'space-between' }}>
        {/* top row: headline left, branching path right */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div className="eyebrow">{eyebrow}</div>
            <h2 className="display" style={{ fontSize: 72, marginTop: 18, marginBottom: 0, lineHeight: 1.02, maxWidth: 540 }}>
              {accentParts.map((p, i) => (
                <span key={i}>
                  {p}
                  {accentWord && i < accentParts.length - 1 && <em>{accentWord}</em>}
                </span>
              ))}
            </h2>
            {kicker && (
              <div style={{ fontSize: 24, fontWeight: 500, color: '#64748B', lineHeight: 1.4, maxWidth: 480, marginTop: 18 }}>
                {kicker}
              </div>
            )}
          </div>
          <div style={{ flexShrink: 0, opacity: 0.92 }}>
            <BranchingPath paths={paths} endIcons={endIcons} width={420} height={320} />
          </div>
        </div>

        {/* bottom: 2×2 item grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {items.slice(0, 4).map((item, i) => (
            <div key={i} style={{
              background: 'rgba(7,17,31,0.78)',
              border: '1.5px solid rgba(52,211,153,0.12)',
              borderRadius: 18, padding: '24px 26px',
              display: 'flex', gap: 18, alignItems: 'flex-start',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                fontSize: 20, fontWeight: 700, color: 'var(--tone-acc)',
                opacity: 0.6, flexShrink: 0, lineHeight: 1, paddingTop: 4,
              }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#F8FAFC', marginBottom: 6, lineHeight: 1.2 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 18, fontWeight: 400, color: '#94A3B8', lineHeight: 1.45 }}>
                  {item.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
