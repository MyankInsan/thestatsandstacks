import React from 'react';

export interface BriefData {
  heatTicker?: string;
  hotTopic: string;
  research: string;
  format: string;
  layout: string;
  compliance: string;
}

interface StepProps {
  icon: string;
  label: string;
  value: string;
  status?: string;
}

function Step({ icon, label, value, status = 'done' }: StepProps) {
  return (
    <div className={`brief__step brief__step--${status}`}>
      <div className="brief__step-head">
        <span className="brief__icon">{icon}</span>
        <span className="brief__label mono">{label}</span>
      </div>
      <div className="brief__value">{value}</div>
    </div>
  );
}

export interface BriefModuleProps {
  brief: BriefData;
}

export function BriefModule({ brief }: BriefModuleProps) {
  return (
    <section className="brief">
      <header className="brief__header">
        <h2 className="brief__title">{"Today's brief"}</h2>
        {brief.heatTicker && (
          <span className="pill pill--cyan mono">MARKET HEAT · {brief.heatTicker}</span>
        )}
      </header>
      <div className="brief__chain">
        <Step icon="🔥" label="HOT TOPIC"  value={brief.hotTopic} />
        <Step icon="🔍" label="RESEARCH"   value={brief.research} />
        <Step icon="🧭" label="FORMAT"     value={brief.format} />
        <Step icon="📐" label="LAYOUT"     value={brief.layout} />
        <Step icon="✓"  label="COMPLIANCE" value={brief.compliance} />
      </div>
    </section>
  );
}
