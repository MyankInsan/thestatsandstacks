import React from 'react';

interface StatProps {
  value: string | number;
  label: string;
  accent?: boolean;
}

function Stat({ value, label, accent }: StatProps) {
  return (
    <div className="stat">
      <div className={`stat__value${accent ? ' stat__value--em' : ''}`}>{value}</div>
      <div className="stat__label mono">{label}</div>
    </div>
  );
}

export interface StatBarProps {
  posts: number;
  ideas: number;
  qa: string;
}

export function StatBar({ posts, ideas, qa }: StatBarProps) {
  return (
    <div className="stat-bar">
      <Stat value={posts} label="Posts published" />
      <Stat value={ideas} label="Ideas researched" />
      <Stat value={qa} label="QA score" accent />
    </div>
  );
}
