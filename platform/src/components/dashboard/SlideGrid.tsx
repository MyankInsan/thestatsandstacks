import React from 'react';

export interface SlideData {
  bg: string;
  eyebrow: string;
  headline: string;
  viz: string;
  qa: number;
}

interface SlideTileProps {
  slide: SlideData;
  index: number;
}

function SlideTile({ slide, index }: SlideTileProps) {
  const qaClass = slide.qa >= 0.80 ? 'qa-good' : slide.qa >= 0.65 ? 'qa-warn' : 'qa-bad';
  return (
    <figure className="slide-tile">
      <div
        className="slide-tile__art"
        style={{ background: slide.bg }}
      >
        <div className="slide-tile__eyebrow mono">{slide.eyebrow}</div>
        <div className="slide-tile__hl">{slide.headline}</div>
        <div className="slide-tile__viz" data-kind={slide.viz} />
        <div className="slide-tile__foot mono">EDUCATIONAL ONLY</div>
      </div>
      <figcaption className="slide-tile__badges">
        <span className="slide-tile__num mono">SLIDE {String(index + 1).padStart(2, '0')}</span>
        <span className={`slide-tile__qa mono ${qaClass}`}>QA {Math.round(slide.qa * 100)}%</span>
      </figcaption>
    </figure>
  );
}

export interface SlideGridProps {
  slides: SlideData[];
}

export function SlideGrid({ slides }: SlideGridProps) {
  return (
    <section className="slide-grid-card">
      <header className="slide-grid-card__head">
        <h2 className="slide-grid-card__title">Generated slides</h2>
        <span className="pill pill--ghost mono">{slides.length} SLIDES · 4:5</span>
      </header>
      <div className="slide-grid">
        {slides.map((s, i) => <SlideTile key={i} slide={s} index={i} />)}
      </div>
    </section>
  );
}
