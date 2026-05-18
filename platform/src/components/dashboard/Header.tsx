'use client';
import React, { useState } from 'react';

function PulseDot() {
  return <span className="pulse-dot" />;
}

function Wordmark() {
  return (
    <h1 className="wordmark">
      The<span className="stats">Stats</span>And<span className="stacks">Stacks</span>
    </h1>
  );
}

interface RunPipelineButtonProps {
  onRun?: () => Promise<void>;
}

function RunPipelineButton({ onRun }: RunPipelineButtonProps) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');

  const handle = async () => {
    setRunning(true);
    setStatus('Starting agents…');
    if (onRun) {
      try {
        await onRun();
        setStatus('Done.');
      } catch {
        setStatus('Pipeline failed.');
      } finally {
        setTimeout(() => { setRunning(false); setStatus(''); }, 2000);
      }
    } else {
      setTimeout(() => setStatus('Trend research…'), 800);
      setTimeout(() => setStatus('Image generation…'), 2000);
      setTimeout(() => {
        setStatus('Done.');
        setTimeout(() => { setRunning(false); setStatus(''); }, 1800);
      }, 3400);
    }
  };

  return (
    <div className="run-wrap">
      {status && <span className="run-status mono">{status}</span>}
      <button className="btn btn--primary" onClick={handle} disabled={running}>
        {running ? '⏳ Agents working…' : '▶ Run full pipeline'}
      </button>
    </div>
  );
}

export interface HeaderProps {
  onRun?: () => Promise<void>;
}

export function Header({ onRun }: HeaderProps) {
  return (
    <header className="dash-header">
      <div className="dash-header__inner">
        <div className="dash-header__left">
          <PulseDot />
          <Wordmark />
          <span className="pill pill--emerald mono">SYSTEM ONLINE</span>
        </div>
        <RunPipelineButton onRun={onRun} />
      </div>
      <div className="dash-header__rule" />
    </header>
  );
}
