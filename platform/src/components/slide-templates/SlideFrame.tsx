// platform/src/components/slide-templates/SlideFrame.tsx
'use client';
import React, { useEffect, useRef } from 'react';

interface SlideFrameProps {
  children?: React.ReactNode;
  label?: string;
  frameNo?: number;
  totalFrames?: number;
  theme?: { acc?: string; acc2?: string; acc3?: string; bg?: string };
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  hideBrand?: boolean;
  hideFooter?: boolean;
  footer?: Record<string, unknown>;
  scale?: boolean;
}

function BrandMark() {
  return (
    <svg className="brand-bar__mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0B1120" />
      <g transform="translate(8 6)">
        <path d="M0 50 L0 0 L50 0" fill="#34D399" opacity="0.95" />
        <path d="M13 36 L23 24 L33 30 L45 14" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 46 H46" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M16 46 V38 M28 46 V30 M40 46 V23" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function SlideFrame({
  children,
  frameNo,
  totalFrames,
  theme = {},
  tone = 'emerald',
  hideBrand = false,
  hideFooter = false,
  scale = true,
}: SlideFrameProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scale) return;
    const fit = () => {
      if (!stageRef.current || !frameRef.current) return;
      const s = stageRef.current.getBoundingClientRect();
      const k = Math.min(s.width / 1080, s.height / 1350);
      frameRef.current.style.transform = `scale(${k})`;
      frameRef.current.style.transformOrigin = 'center center';
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [scale]);

  const style: React.CSSProperties = {
    ['--acc' as string]: theme.acc ?? 'var(--tone-acc)',
    ['--acc-2' as string]: theme.acc2 ?? 'var(--tone-acc-soft)',
    ['--acc-3' as string]: theme.acc3 ?? 'var(--tone-acc-soft)',
    background: theme.bg ?? 'linear-gradient(135deg,#06101D 0%,#0d1b2a 52%,#111111 100%)',
  };

  return (
    <div className={scale ? 'slide-stage' : 'slide-stage slide-stage--inline'} ref={stageRef}>
      <div className={`slide-frame tone-${tone}`} ref={frameRef} style={style}>
        <div className="halo" />
        {!hideBrand && (
          <div className="brand-bar">
            <div className="brand-bar__left">
              <BrandMark />
              <div className="brand-bar__wm">TheStatsAndStacks</div>
            </div>
            {frameNo && (
              <div className="brand-bar__frame">
                {String(frameNo).padStart(2, '0')}
                {totalFrames ? ` / ${String(totalFrames).padStart(2, '0')}` : ''}
              </div>
            )}
          </div>
        )}
        {!hideBrand && <div className="brand-bar__rule" />}
        {children}
        {!hideFooter && (
          <div className="foot-bar">
            <div className="foot-bar__l"><span>EDUCATIONAL ONLY</span></div>
            <div className="foot-bar__r"><span>@THESTATSANDSTACKS</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
