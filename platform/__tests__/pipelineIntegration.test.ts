import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VisualPlanAgent } from '../src/lib/agents/visualPlanAgent';
import { SlideNarrativeAgent } from '../src/lib/agents/slideNarrativeAgent';
import { ImagePromptAgent } from '../src/lib/agents/imagePromptAgent';
import { toPersistedVisualPlan, checkVisualPlanVariety } from '../src/lib/agents/varietyContract';
import { appendContentHistory, loadContentHistory, CURRENT_SCHEMA_VERSION, type ContentHistoryEntry } from '../src/lib/services/contentHistory';
import type { CarouselConstraints } from '../src/lib/agents/carouselConstraintAgent';
import type { StrategyDecision } from '../src/lib/agents/contentStrategyAgent';
import type { FormatDecision } from '../src/lib/agents/formatStyleAgent';
import { COLOR_SCHEMES } from '../src/lib/agents/formatStyleAgent';

const constraints: CarouselConstraints = {
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
} as CarouselConstraints;

const strategy: StrategyDecision = {
  topic: 'NVDA earnings beat', hook: 'Nvidia just crushed estimates', format: 'CAROUSEL',
  slideCount: 7, slideBreakdown: ['c', 's', 't', 'w', 'x', 'r', 'cta'], reasoning: 'x',
  targetAudience: 'investors', searchKeywords: ['NVDA'], topicCategory: 'EARNINGS', angleId: 'EARNINGS_REACTION',
};
const format: FormatDecision = {
  formatType: 'PHOTOREALISTIC_MARKET_UPDATE', slideCount: 7,
  colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_MARKET_UPDATE, visualTone: 'data', reasoning: 't',
};

test('end-to-end deterministic path: plan → locked copy → image packet → v3 history round-trip', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = ''; // force deterministic (no network)
  const historyPath = path.join(os.tmpdir(), `tsas-int-${Date.now()}.json`);
  try {
    // 1. Visual plan (deterministic, locks grammar).
    const planResult = new VisualPlanAgent().execute({
      strategy, format, constraints, tickerSymbols: ['NVDA'], dateKey: '2026-06-02', slotIndex: 1,
    });
    assert.equal(planResult.valid, true, `plan invalid: ${planResult.violations.join('; ')}`);

    // 2. Copy-only narrative fills the locked plan.
    const narrative = await new SlideNarrativeAgent().execute({
      strategy, format, tickerSymbols: ['NVDA'], constraints, visualPlan: planResult.plan,
    });
    assert.equal(narrative.slides.length, planResult.plan.slides.length);
    narrative.slides.forEach((s, i) => {
      assert.equal(s.visualStyle, planResult.plan.slides[i].visualStyle, 'grammar must stay locked');
      assert.ok(s.headline.length > 0);
    });

    // 3. Image prompts carry the ChatGPT Images 2.0 anchor + MUST KEEP packet.
    const promptSet = await new ImagePromptAgent().execute({
      slides: narrative.slides, format, strategy, constraints,
      tickerSymbols: ['NVDA'], dateKey: '2026-06-02', slotIndex: 1, storyboard: planResult.plan.storyboard,
    });
    assert.equal(promptSet.slides.length, narrative.slides.length);
    assert.match(promptSet.slides[0].geminiPrompt, /ANCHOR slide/);
    assert.match(promptSet.slides[0].geminiPrompt, /MUST KEEP/);
    for (const s of promptSet.slides) {
      assert.match(s.geminiPrompt, /1080x1350/);
      assert.ok(s.promptFingerprint.startsWith('pf_'));
    }

    // 4. Persist v3 plan and round-trip it through history.
    const fingerprints = Object.fromEntries(promptSet.slides.map((s) => [s.slideNumber, s.promptFingerprint])) as Record<number, string>;
    const entry: ContentHistoryEntry = {
      date: '2026-06-02', topic: strategy.topic, hook: strategy.hook, format: 'CAROUSEL',
      slideCount: narrative.slides.length, keywords: strategy.searchKeywords, slotIndex: 1,
      visualPlan: toPersistedVisualPlan(planResult.plan, { usedFallback: planResult.usedFallback, promptFingerprints: fingerprints }),
    };
    appendContentHistory(historyPath, entry);
    const reloaded = loadContentHistory(historyPath);
    assert.equal(reloaded.length, 1);
    assert.equal(reloaded[0].schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.equal(reloaded[0].visualPlan?.compositionSignature, planResult.plan.compositionSignature);
    assert.equal(reloaded[0].visualPlan?.slides[0].promptFingerprint, promptSet.slides[0].promptFingerprint);

    // 5. A second identical packet is variety-blocked against the persisted history.
    const variety = checkVisualPlanVariety(toPersistedVisualPlan(planResult.plan), reloaded, []);
    assert.equal(variety.blocked, true, 'an identical composition must be hard-blocked by the variety contract');
  } finally {
    process.env.GEMINI_API_KEY = saved ?? '';
    if (fs.existsSync(historyPath)) fs.unlinkSync(historyPath);
  }
});
