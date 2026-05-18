import React from 'react';

export interface AgentConfig {
  name: string;
  icon: string;
  status: 'done' | 'running' | 'idle';
}

const DEFAULT_AGENTS: AgentConfig[] = [
  { name: 'Cost Guard',      icon: '◎',  status: 'done' },
  { name: 'Hot Topic Desk',  icon: '🔥', status: 'done' },
  { name: 'Tickers in News', icon: '📰', status: 'done' },
  { name: 'Trend Research',  icon: '🔍', status: 'done' },
  { name: 'History Guard',   icon: '🧬', status: 'done' },
  { name: 'Strategy',        icon: '🧠', status: 'done' },
  { name: 'Format Decider',  icon: '🧭', status: 'done' },
  { name: 'Reel Planner',    icon: '🎬', status: 'done' },
  { name: 'Editorial',       icon: '🗞️', status: 'done' },
  { name: 'Compliance',      icon: '✓',  status: 'done' },
  { name: 'Image Prompts',   icon: '🎨', status: 'done' },
  { name: 'Image / Video',   icon: '🖼️', status: 'done' },
  { name: 'Sound Design',    icon: '🎚️', status: 'done' },
  { name: 'Vision Critic',   icon: '🔎', status: 'done' },
  { name: 'Regen Loop',      icon: '↻',  status: 'done' },
  { name: 'Copywriter',      icon: '✍️', status: 'done' },
  { name: 'Final Gate',      icon: '🛡️', status: 'done' },
  { name: 'Publisher',       icon: '🚀', status: 'done' },
];

interface AgentChipProps {
  agent: AgentConfig;
}

function AgentChip({ agent }: AgentChipProps) {
  const pct = agent.status === 'done' ? 100 : agent.status === 'running' ? 55 : 0;
  return (
    <div className={`agent-chip agent-chip--${agent.status}`} title={agent.name}>
      <span className="agent-chip__icon">{agent.icon}</span>
      <span className="agent-chip__name">{agent.name}</span>
      <div className="agent-chip__bar"><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export interface PipelineStripProps {
  agents?: AgentConfig[];
  summaryLabel?: string;
}

export function PipelineStrip({
  agents = DEFAULT_AGENTS,
  summaryLabel,
}: PipelineStripProps) {
  const doneCount = agents.filter(a => a.status === 'done').length;
  const label = summaryLabel ?? `${doneCount} / ${agents.length} · COMPLETE · QUEUED FOR 08:00 PT`;

  return (
    <section className="pipeline">
      <header className="pipeline__head">
        <h2 className="pipeline__title">Agent pipeline</h2>
        <span className="pill pill--emerald mono">{label}</span>
      </header>
      <div className="pipeline__grid">
        {agents.map(a => <AgentChip key={a.name} agent={a} />)}
      </div>
    </section>
  );
}
