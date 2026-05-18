import React from 'react';

interface MiniSlideData {
  score: number;
  bg: string;
}

interface CriticNoteData {
  severity: string;
  text: string;
}

export interface RegenEntry {
  slide: number;
  status: 'resolved' | 'retrying' | 'fallback';
  attempts: number;
  cap: number;
  before: MiniSlideData;
  after: MiniSlideData;
  notes: CriticNoteData[];
  fallback?: string;
}

interface MiniSlideProps {
  score: number;
  bg: string;
  label: string;
  attempt: number;
}

function MiniSlide({ score, bg, label, attempt }: MiniSlideProps) {
  const cls = score >= 0.80 ? 'qa-good' : score >= 0.65 ? 'qa-warn' : 'qa-bad';
  return (
    <div className="regen-mini">
      <div className="regen-mini__art" style={{ background: bg }}>
        <span className={`regen-mini__qa mono ${cls}`}>QA {Math.round(score * 100)}%</span>
        {attempt > 1 && <span className="regen-mini__attempt mono">↻ {attempt}</span>}
      </div>
      <span className="regen-mini__label mono">{label}</span>
    </div>
  );
}

interface CriticNoteProps {
  severity: string;
  text: string;
}

function CriticNote({ severity, text }: CriticNoteProps) {
  return (
    <li className={`critic-note critic-note--${severity}`}>
      <span className="critic-note__dot" />
      <span className="critic-note__text">{text}</span>
    </li>
  );
}

export interface RegenLoopCardProps {
  entries?: RegenEntry[];
}

export function RegenLoopCard({ entries = [] }: RegenLoopCardProps) {
  const totalAttempts = entries.reduce((a, e) => a + (e.attempts || 0), 0);

  return (
    <section className="regen-card">
      <header className="regen-card__head">
        <div>
          <h2 className="regen-card__title">Vision Critic · Regen Loop</h2>
          <span className="regen-card__sub mono">
            5-ATTEMPT CEILING · BEFORE → AFTER · STRUCTURED FEEDBACK
          </span>
        </div>
        <span className="pill pill--amber mono">
          {entries.length} ACTIVE · {totalAttempts} TOTAL ATTEMPTS
        </span>
      </header>

      <div className="regen-card__entries">
        {entries.map((e, i) => (
          <div key={i} className={`regen-entry regen-entry--${e.status}`}>
            <div className="regen-entry__diff">
              <MiniSlide score={e.before.score} bg={e.before.bg} label="Attempt 1" attempt={1} />
              <span className="regen-entry__arrow">→</span>
              <MiniSlide
                score={e.after.score}
                bg={e.after.bg}
                label={`Attempt ${e.attempts}`}
                attempt={e.attempts}
              />
            </div>

            <div className="regen-entry__body">
              <header className="regen-entry__header">
                <span className="regen-entry__slot mono">SLIDE {String(e.slide).padStart(2, '0')}</span>
                <span
                  className={`pill pill--${
                    e.status === 'resolved' ? 'emerald' :
                    e.status === 'retrying' ? 'amber' : 'rose'
                  } mono`}
                >
                  {e.status === 'resolved' && `RESOLVED · ${e.attempts}/${e.cap}`}
                  {e.status === 'retrying' && `RETRYING · ${e.attempts}/${e.cap}`}
                  {e.status === 'fallback' && `FALLBACK · ${e.attempts}/${e.cap}`}
                </span>
              </header>

              <ul className="critic-notes">
                {e.notes.map((n, idx) => (
                  <CriticNote key={idx} severity={n.severity} text={n.text} />
                ))}
              </ul>

              {e.fallback && (
                <div className="regen-entry__fallback mono">
                  ↳ Falling back: <strong>{e.fallback}</strong>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
