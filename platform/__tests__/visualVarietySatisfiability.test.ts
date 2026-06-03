import { test } from 'node:test';
import assert from 'node:assert/strict';

import { VisualPlanAgent } from '../src/lib/agents/visualPlanAgent';
import { toPersistedVisualPlan } from '../src/lib/agents/varietyContract';
import { SLOT_CONFIGS, type SlotIndex } from '../src/lib/agents/slotConfig';
import { COLOR_SCHEMES, type FormatDecision } from '../src/lib/agents/formatStyleAgent';
import type { CarouselConstraints } from '../src/lib/agents/carouselConstraintAgent';
import type { StrategyDecision } from '../src/lib/agents/contentStrategyAgent';
import type { ContentHistoryEntry } from '../src/lib/services/contentHistory';

// In production FinancialVizPicker chooses a hero per angle, which rotates day to
// day. The sim mirrors that so the non-cover slides diversify like reality does
// (holding them fixed per slot would be unrealistically adversarial).
const CHART_HERO_ROTATION: Record<number, Array<CarouselConstraints['chartHeroSuggestion']>> = {
  1: ['CANDLESTICK_HERO', 'LINE_CHART', 'TICKER_TAPE_HERO', 'PRICE_TIMELINE_ANNOTATED'],
  2: ['PORTFOLIO_DOUGHNUT_PORTRAIT', 'CAP_TABLE_GRID', 'EXPERT_CUTOUT', 'COMPARISON_TABLE'],
  3: ['LINE_CHART', 'AREA_CHART', 'DONUT_CHART', 'BAR_CHART_HORIZONTAL'],
  4: [undefined, 'COMPARISON_TABLE', 'TYPOGRAPHIC_MEGA_NUMBER'],
  5: [undefined, 'MAGAZINE_COVER', 'GLOWING_QUOTE'],
  6: [undefined, 'SATIRICAL_METAPHOR', 'FUNNY_COMPARISON'],
};

function constraintsFor(slot: SlotIndex, day: number): CarouselConstraints {
  const heroes = CHART_HERO_ROTATION[slot];
  const ctas = SLOT_CONFIGS[slot].preferredCtas;
  return {
    excludedStyles: [],
    requiredChartSlideRole: slot <= 3 ? 'breakdown' : null,
    maxHumanSlides: 2,
    maxHumanInFirst3: 1,
    forbiddenAdjacentBuckets: true,
    narrativeArc: 'HOOK_PROBLEM_REVEAL_FRAMEWORK_CTA',
    chartHeroSuggestion: heroes[day % heroes.length],
    chartSupportingSuggestions: ['PRICE_TIMELINE_ANNOTATED', 'COMPARISON_TABLE', 'EDITORIAL_STAT_CARD'],
    ctaId: ctas[day % ctas.length] ?? 'save_specific',
    ctaCarouselImpactNote: 'note',
    recentSubjects: [],
    recentArchetypes: [],
    preferTestedStyles: true,
  } as CarouselConstraints;
}

function formatFor(slot: SlotIndex): FormatDecision {
  const ft = SLOT_CONFIGS[slot].allowedFormats[0];
  return { formatType: ft, slideCount: 7, colorScheme: COLOR_SCHEMES[ft], visualTone: 't', reasoning: 't' };
}

function strategyFor(day: number, slot: SlotIndex): StrategyDecision {
  return {
    topic: `Topic day ${day} slot ${slot}`,
    hook: `Hook ${day}-${slot}`,
    format: 'CAROUSEL',
    slideCount: 7,
    slideBreakdown: [],
    reasoning: 't',
    targetAudience: 'investors',
    searchKeywords: ['x'],
  };
}

function dateKey(day: number): string {
  const d = new Date(Date.UTC(2026, 0, 1) + day * 86_400_000);
  return d.toISOString().slice(0, 10);
}

test('360-packet simulation: covers rotate and variety never jams into permanent fallback', () => {
  const agent = new VisualPlanAgent();
  const history: ContentHistoryEntry[] = [];

  let fallbackCount = 0;
  let unresolvedCount = 0;
  const coverFamilies = new Map<string, number>();
  const signatures = new Set<string>();
  const reasonTally = new Map<string, number>();
  let total = 0;

  for (let day = 0; day < 60; day++) {
    const todayKey = dateKey(day);
    const todayPrior: ContentHistoryEntry[] = [];
    for (const slot of [1, 2, 3, 4, 5, 6] as SlotIndex[]) {
      const result = agent.execute({
        strategy: strategyFor(day, slot),
        format: formatFor(slot),
        constraints: constraintsFor(slot, day),
        tickerSymbols: slot <= 3 ? ['NVDA'] : [],
        dateKey: todayKey,
        slotIndex: slot,
        recentHistory: history,
        todayPriorEntries: todayPrior,
      });

      total++;
      if (result.usedFallback) fallbackCount++;
      if (result.varietyReasons.length > 0) unresolvedCount++;
      for (const r of result.varietyReasons) {
        const key = r.replace(/\d+/g, 'N');
        reasonTally.set(key, (reasonTally.get(key) ?? 0) + 1);
      }
      assert.ok(result.plan.slides.length >= 3, 'every packet must yield a usable plan');

      const fam = result.plan.coverLayoutFamily ?? 'TOP_STACK';
      coverFamilies.set(fam, (coverFamilies.get(fam) ?? 0) + 1);
      signatures.add(result.plan.compositionSignature);

      const entry: ContentHistoryEntry = {
        date: todayKey, topic: strategyFor(day, slot).topic, hook: 'h', format: 'CAROUSEL',
        slideCount: 7, keywords: [], slotIndex: slot,
        visualPlan: toPersistedVisualPlan(result.plan, { usedFallback: result.usedFallback }),
      };
      history.push(entry);
      todayPrior.push(entry);
    }
  }

  if (process.env.SAT_DEBUG) {
    console.error('fallbackRate', (fallbackCount / total).toFixed(2), 'unresolvedRate', (unresolvedCount / total).toFixed(2));
    console.error('coverFamilies', [...coverFamilies.entries()].sort((a, b) => b[1] - a[1]));
    console.error('distinctSignatures', signatures.size, '/', total);
    console.error('reasons', [...reasonTally.entries()].sort((a, b) => b[1] - a[1]));
  }

  assert.equal(total, 360);

  // Covers must actually rotate their layout — the whole point of the fix.
  assert.ok(coverFamilies.size >= 5, `covers should use >=5 layout families, saw ${[...coverFamilies.keys()].join(', ')}`);
  const topStackShare = (coverFamilies.get('TOP_STACK') ?? 0) / total;
  assert.ok(topStackShare < 0.4, `TOP_STACK should not dominate covers, was ${(topStackShare * 100).toFixed(0)}%`);

  // Unresolved hard collisions must stay rare — the system stays satisfiable and
  // never jams into permanent fallback. (Most remaining cases are legitimate
  // same-day reuse, which is an intended hard block.)
  const unresolvedRate = unresolvedCount / total;
  assert.ok(unresolvedRate < 0.15, `unresolved-variety rate too high: ${(unresolvedRate * 100).toFixed(0)}%`);

  // Sanity: genuine per-lane composition diversity (a 10-day window intentionally
  // ALLOWS a lane to reuse a composition after 10+ days, so global uniqueness is
  // not expected; we just check lanes aren't collapsed to 1-2 looks each).
  assert.ok(signatures.size >= 50, `too few distinct compositions: ${signatures.size}/${total}`);
});
