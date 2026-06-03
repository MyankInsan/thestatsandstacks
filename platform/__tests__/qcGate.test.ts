import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runQcGate, formatQcSummary, type QcGateInput } from '../src/lib/agents/qcGateAgent';

function baseInput(overrides: Partial<QcGateInput> = {}): QcGateInput {
  return {
    prompts: [
      { slideNumber: 1, role: 'cover', geminiPrompt: 'DELIVERABLE...\nEXACT TEXT\n...\nWATERMARK\n...\nNEGATIVE CONSTRAINTS\n...' },
      { slideNumber: 2, role: 'breakdown', geminiPrompt: 'INTEGRATED text...\nWATERMARK\n...\nNEGATIVE CONSTRAINTS\n...' },
    ],
    slideHeadlines: ['A tight cover hook', 'A sharp second hook'],
    hook: 'A tight cover hook here',
    reviewFlagCount: 0,
    sourceTier: 'MARKET_DATA',
    topicMode: 'TIMELY_FIRST',
    topicFamily: 'INDEX_MOVE',
    slideCount: 8,
    varietyFallbackRatePct: 0,
    varietyUnresolved: false,
    timelyPriorTodayCount: 4,
    ...overrides,
  };
}

test('runQcGate: clean verified timely packet passes with strong engagement', () => {
  const r = runQcGate(baseInput());
  assert.equal(r.overall, 'PASS');
  assert.ok(r.engagementScore >= 75, `expected strong score, got ${r.engagementScore}`);
  assert.equal(r.timelyTodayCount, 5);
});

test('runQcGate: unresolved [bracket] placeholders FAIL', () => {
  const r = runQcGate(baseInput({
    prompts: [{ slideNumber: 1, role: 'cover', geminiPrompt: 'render [portraitSubject]\nWATERMARK\nEXACT TEXT\nNEGATIVE CONSTRAINTS' }],
  }));
  assert.equal(r.overall, 'FAIL');
  assert.ok(r.checks.some((c) => c.label === 'Prompt placeholders' && c.status === 'FAIL'));
});

test('runQcGate: long headline + bad slide count WARN', () => {
  const r = runQcGate(baseInput({
    slideHeadlines: ['this headline is far too long to read as a premium cover thumbnail honestly', 'ok'],
    slideCount: 4,
  }));
  assert.equal(r.overall, 'WARN');
  assert.ok(r.checks.some((c) => c.label === 'Headline legibility' && c.status === 'WARN'));
  assert.ok(r.checks.some((c) => c.label === 'Slide count' && c.status === 'WARN'));
});

test('runQcGate: timely topic on a weak (aggregated) source warns on verification', () => {
  const r = runQcGate(baseInput({ sourceTier: 'AGGREGATED' }));
  assert.ok(r.checks.some((c) => c.label === 'Verification' && c.status === 'WARN'));
});

test('runQcGate: below-target daily timely mix warns on a timely-first slot', () => {
  const r = runQcGate(baseInput({ timelyPriorTodayCount: 1, sourceTier: 'UNKNOWN', topicFamily: 'ACCT_COMPARISON' }));
  assert.ok(r.checks.some((c) => c.label === 'Daily timely mix' && c.status === 'WARN'));
});

test('formatQcSummary renders status + engagement and only flagged checks', () => {
  const summary = formatQcSummary(runQcGate(baseInput({ reviewFlagCount: 2 })));
  assert.match(summary, /QC: WARN/);
  assert.match(summary, /Engagement \d+\/100/);
  assert.match(summary, /Research review/);
  assert.doesNotMatch(summary, /Slide count/); // passing checks are omitted
});
