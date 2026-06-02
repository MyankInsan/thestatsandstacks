import test from 'node:test';
import assert from 'node:assert/strict';
import { toPersistedVisualPlan, checkVisualPlanVariety, computeVarietyFallbackRatePct } from '../src/lib/agents/varietyContract';
import { VisualPlanAgent } from '../src/lib/agents/visualPlanAgent';
import type { CarouselConstraints } from '../src/lib/agents/carouselConstraintAgent';
import type { StrategyDecision } from '../src/lib/agents/contentStrategyAgent';
import type { FormatDecision } from '../src/lib/agents/formatStyleAgent';
import type { ContentHistoryEntry } from '../src/lib/services/contentHistory';
import { COLOR_SCHEMES } from '../src/lib/agents/formatStyleAgent';

function makeConstraints(overrides: Partial<CarouselConstraints> = {}): CarouselConstraints {
  return {
    excludedStyles: [],
    requiredChartSlideRole: 'breakdown',
    maxHumanSlides: 2,
    maxHumanInFirst3: 1,
    forbiddenAdjacentBuckets: true,
    narrativeArc: 'HOOK_PROBLEM_REVEAL_FRAMEWORK_CTA',
    chartHeroSuggestion: 'CANDLESTICK_HERO',
    chartSupportingSuggestions: ['PRICE_TIMELINE_ANNOTATED', 'EARNINGS_CARD', 'COMPARISON_TABLE'],
    ctaId: 'save_specific',
    ctaCarouselImpactNote: 'save the breakdown',
    recentSubjects: [],
    recentArchetypes: [],
    preferTestedStyles: true,
    ...overrides,
  } as CarouselConstraints;
}

const strategy: StrategyDecision = {
  topic: 'NVDA earnings beat', hook: 'Nvidia just crushed estimates', format: 'CAROUSEL',
  slideCount: 7, slideBreakdown: ['c', 's', 't', 'w', 'x', 'r', 'cta'], reasoning: 'x',
  targetAudience: 'investors', searchKeywords: ['NVDA'], topicCategory: 'EARNINGS', angleId: 'EARNINGS_REACTION',
};
const format: FormatDecision = {
  formatType: 'PHOTOREALISTIC_MARKET_UPDATE', slideCount: 7,
  colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_MARKET_UPDATE, visualTone: 'data', reasoning: 't',
};

function plan(history: ContentHistoryEntry[] = [], todayPrior: ContentHistoryEntry[] = []) {
  return new VisualPlanAgent().execute({
    strategy, format, constraints: makeConstraints(), tickerSymbols: ['NVDA'],
    dateKey: '2026-06-02', slotIndex: 1, recentHistory: history, todayPriorEntries: todayPrior,
  });
}

function historyEntryWithPlan(p: ReturnType<typeof plan>): ContentHistoryEntry {
  return {
    date: '2026-06-01', topic: 't', hook: 'h', format: 'CAROUSEL', slideCount: 7, keywords: [],
    slotIndex: 1, visualPlan: toPersistedVisualPlan(p.plan),
  };
}

test('checkVisualPlanVariety blocks an identical compositionSignature within trailing 60', () => {
  const first = plan();
  const history = [historyEntryWithPlan(first)];
  const persisted = toPersistedVisualPlan(first.plan);
  const result = checkVisualPlanVariety(persisted, history, []);
  assert.equal(result.blocked, true);
  assert.match(result.reasons.join(' '), /compositionSignature/);
});

test('checkVisualPlanVariety blocks same-day sceneConceptId reuse', () => {
  const first = plan();
  const todayPrior: ContentHistoryEntry[] = [{
    date: '2026-06-02', topic: 't', hook: 'h', format: 'CAROUSEL', slideCount: 7, keywords: [],
    slotIndex: 1, visualPlan: toPersistedVisualPlan(first.plan),
  }];
  const result = checkVisualPlanVariety(toPersistedVisualPlan(first.plan), [], todayPrior);
  assert.equal(result.blocked, true);
  assert.match(result.reasons.join(' '), /sceneConceptId|compositionSignature/);
});

test('VisualPlanAgent never returns a silent collision: it escapes variety or flags fallback', () => {
  const first = plan();
  const history = [historyEntryWithPlan(first)];
  const second = plan(history);

  // The first attempt always collides (identical inputs), so the plan must differ.
  assert.notEqual(second.plan.compositionSignature, first.plan.compositionSignature, 'must not return the identical composition');

  // Re-derive whether the RETURNED plan still collides with history.
  const recheck = checkVisualPlanVariety(toPersistedVisualPlan(second.plan), history, []);
  if (recheck.blocked) {
    // A still-colliding plan (e.g. a coarse cover-tuple repeat) MUST be flagged.
    assert.ok(second.usedFallback, 'a still-colliding plan must be flagged as fallback');
    assert.ok(second.varietyReasons.length > 0);
  } else {
    assert.equal(second.valid, true, `violations: ${second.violations.join('; ')}`);
  }
});

test('computeVarietyFallbackRatePct reflects stored fallback flags', () => {
  const p = plan();
  const fallbackPlan = toPersistedVisualPlan(p.plan, { usedFallback: true });
  const cleanPlan = toPersistedVisualPlan(p.plan, { usedFallback: false });
  const history: ContentHistoryEntry[] = [
    { date: '2026-06-01', topic: 't', hook: 'h', format: 'CAROUSEL', slideCount: 7, keywords: [], visualPlan: fallbackPlan },
    { date: '2026-06-01', topic: 't', hook: 'h', format: 'CAROUSEL', slideCount: 7, keywords: [], visualPlan: cleanPlan },
  ];
  assert.equal(computeVarietyFallbackRatePct(history), 50);
  assert.equal(computeVarietyFallbackRatePct([]), 0);
});
