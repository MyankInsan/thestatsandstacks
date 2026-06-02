import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCandidateTopics,
  selectTopicWithHistoryGuard,
  toSelectedTopicDecision,
} from '../src/lib/agents/topicSelection';
import type { TopicAngleAgentOutput } from '../src/lib/agents/topicAngleAgent';
import type { HistoryGuardResult, MustAvoidSet } from '../src/lib/agents/historyGuardAgent';

const EMPTY_MUST_AVOID: MustAvoidSet = {
  visualStyles: [], portraitSubjects: [], archetypes: [], hookFormulas: [],
  tickers: [], narrativeArcs: [], angles: [], colorTriples: [],
};

const angleCandidates: TopicAngleAgentOutput['angleCandidates'] = [
  { angleId: 'ETF_XRAY', title: 'ETF X-Ray topic', rationale: 'top', sourceUrls: ['u-etf'], angleSlideSkeleton: ['cover', 'holdings', 'cta'], triggerSource: 'angle' },
  { angleId: 'FEE_TEARDOWN', title: 'Fee Teardown topic', rationale: 'backup', sourceUrls: ['u-fee'], angleSlideSkeleton: ['cover', 'fees', 'cta'], triggerSource: 'angle' },
];

const trendTopics = [
  { title: 'A generic trend topic', score: 0.8, reasoning: '', searchKeywords: [] as string[] },
];

test('buildCandidateTopics preserves angle ranking (no unshift reversal) and carries metadata', () => {
  const candidates = buildCandidateTopics(angleCandidates, trendTopics);
  assert.equal(candidates[0].topic.title, 'ETF X-Ray topic', 'first angle stays first');
  assert.equal(candidates[0].angleId, 'ETF_XRAY');
  assert.deepEqual(candidates[0].angleSlideSkeleton, ['cover', 'holdings', 'cta']);
  assert.equal(candidates[1].angleId, 'FEE_TEARDOWN');
  assert.equal(candidates[2].topic.title, 'A generic trend topic');
  assert.equal(candidates[2].angleId, undefined);
});

test('selectTopicWithHistoryGuard keeps the surviving topic\'s angle after a pivot', async () => {
  const candidates = buildCandidateTopics(angleCandidates, trendTopics);

  const evaluate = async (title: string): Promise<HistoryGuardResult> =>
    title === 'ETF X-Ray topic'
      ? { block: true, mustAvoid: EMPTY_MUST_AVOID, warnings: [], suggestedPivot: 'pivot' }
      : { block: false, mustAvoid: EMPTY_MUST_AVOID, warnings: [] };

  const result = await selectTopicWithHistoryGuard(candidates, evaluate);
  assert.equal(result.allBlocked, false);
  assert.equal(result.selected?.topic.title, 'Fee Teardown topic');
  // The bug being fixed: angle must follow the SURVIVING topic, not stay ETF_XRAY.
  assert.equal(result.selected?.angleId, 'FEE_TEARDOWN');

  const decision = toSelectedTopicDecision(result.selected!);
  assert.equal(decision.angleId, 'FEE_TEARDOWN');
  assert.deepEqual(decision.angleSlideSkeleton, ['cover', 'fees', 'cta']);
  assert.deepEqual(decision.sourceUrls, ['u-fee']);
});

test('selectTopicWithHistoryGuard flags allBlocked when every candidate is blocked', async () => {
  const candidates = buildCandidateTopics(angleCandidates, trendTopics);
  const evaluate = async (): Promise<HistoryGuardResult> => ({ block: true, mustAvoid: EMPTY_MUST_AVOID, warnings: [], suggestedPivot: 'p' });
  const result = await selectTopicWithHistoryGuard(candidates, evaluate);
  assert.equal(result.allBlocked, true);
  assert.ok(result.selected, 'still returns a fallback selection');
});
