import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ImagePromptAgent } from '../src/lib/agents/imagePromptAgent';
import { VisualPlanAgent } from '../src/lib/agents/visualPlanAgent';
import type { StoryboardContinuity } from '../src/lib/agents/visualPlanAgent';
import { toPersistedVisualPlan } from '../src/lib/agents/varietyContract';
import { COLOR_SCHEMES, type FormatDecision } from '../src/lib/agents/formatStyleAgent';
import type { SlideSpec } from '../src/lib/agents/slideNarrativeAgent';
import type { CarouselConstraints } from '../src/lib/agents/carouselConstraintAgent';
import type { StrategyDecision } from '../src/lib/agents/contentStrategyAgent';

const luxuryFormat: FormatDecision = {
  formatType: 'PHOTOREALISTIC_LUXURY_LIFESTYLE',
  slideCount: 1,
  colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_LUXURY_LIFESTYLE,
  visualTone: 'premium',
  reasoning: 't',
};

function coverSlide(visualPosition: SlideSpec['visualPosition'] = 'background'): SlideSpec {
  return {
    slideNumber: 1,
    role: 'cover',
    headline: 'THE MONEY MOVE NOBODY EXPLAINS',
    headlineColorMap: [],
    visualStyle: 'MAGAZINE_COVER',
    visualPosition,
    mood: 'premium',
    narrativeNote: 'cover',
  } as SlideSpec;
}

function storyboard(coverLayoutFamily: StoryboardContinuity['coverLayoutFamily']): StoryboardContinuity {
  return {
    coverLayoutFamily,
    premise: 'test premise',
    anchorPrompt: 'anchor',
    sharedVisualInvariants: ['palette', 'watermark'],
    progressionRule: 'advance one idea',
    resolutionRule: 'resolve motif',
    varietyRule: 'vary',
  };
}

async function coverPrompt(
  coverLayoutFamily: StoryboardContinuity['coverLayoutFamily'],
  visualPosition: SlideSpec['visualPosition'] = 'background',
): Promise<string> {
  const res = await new ImagePromptAgent().execute({
    slides: [coverSlide(visualPosition)],
    format: luxuryFormat,
    storyboard: storyboard(coverLayoutFamily),
    dateKey: '2026-06-03',
  });
  return res.slides[0].geminiPrompt;
}

test('integrated cover family bakes the headline INTO the scene (not a top-third overlay)', async () => {
  const prompt = await coverPrompt('FULL_BLEED_EDITORIAL');
  assert.match(prompt, /BAKED INTO|baked into|integrated into the composition/i);
  assert.match(prompt, /full-bleed editorial cover/i);
  assert.doesNotMatch(prompt, /Positioned cleanly in the top-third of the frame/i);
});

test('MOCK_SCREENSHOT family renders text inside the UI', async () => {
  const prompt = await coverPrompt('MOCK_SCREENSHOT');
  assert.match(prompt, /INSIDE the mock interface|inside the UI/i);
});

test('TOP_STACK cover keeps the classic overlay text treatment', async () => {
  // A real TOP_STACK cover has visualPosition 'top' (set by the plan from the family).
  const prompt = await coverPrompt('TOP_STACK', 'top');
  assert.match(prompt, /top-third|top 30%/i);
  assert.doesNotMatch(prompt, /BAKED INTO/i);
});

// ── plan-level: family is chosen, varies, and persists ───────────────────────

const constraints: CarouselConstraints = {
  excludedStyles: [],
  requiredChartSlideRole: 'breakdown',
  maxHumanSlides: 2,
  maxHumanInFirst3: 1,
  forbiddenAdjacentBuckets: true,
  narrativeArc: 'HOOK_PROBLEM_REVEAL_FRAMEWORK_CTA',
  chartHeroSuggestion: 'CANDLESTICK_HERO',
  chartSupportingSuggestions: ['PRICE_TIMELINE_ANNOTATED', 'COMPARISON_TABLE'],
  ctaId: 'save_specific',
  ctaCarouselImpactNote: 'note',
  recentSubjects: [],
  recentArchetypes: [],
  preferTestedStyles: true,
} as CarouselConstraints;

const marketFormat: FormatDecision = {
  formatType: 'PHOTOREALISTIC_MARKET_UPDATE',
  slideCount: 7,
  colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_MARKET_UPDATE,
  visualTone: 't',
  reasoning: 't',
};

const baseStrategy: StrategyDecision = {
  topic: 'NVDA market move',
  hook: 'A quiet number nobody noticed',
  format: 'CAROUSEL',
  slideCount: 7,
  slideBreakdown: [],
  reasoning: 't',
  targetAudience: 'investors',
  searchKeywords: ['NVDA'],
};

test('VisualPlan sets and persists a coverLayoutFamily', () => {
  const plan = new VisualPlanAgent().execute({
    strategy: baseStrategy, format: marketFormat, constraints,
    tickerSymbols: ['NVDA'], dateKey: '2026-06-03', slotIndex: 3,
  }).plan;
  assert.ok(plan.coverLayoutFamily, 'plan must carry a coverLayoutFamily');
  assert.equal(plan.slides[0].coverLayoutFamily, plan.coverLayoutFamily);
  const persisted = toPersistedVisualPlan(plan);
  assert.equal(persisted.coverLayoutFamily, plan.coverLayoutFamily);
});

test('slide 2 carries a secondary-hook beat when no angle skeleton is supplied', () => {
  const plan = new VisualPlanAgent().execute({
    strategy: baseStrategy, format: marketFormat, constraints,
    tickerSymbols: ['NVDA'], dateKey: '2026-06-03', slotIndex: 3,
  }).plan;
  assert.match(plan.slides[1].storyboardBeat, /[Ss]econdary hook/);
});

// ── CTA visual concept system ────────────────────────────────────────────────

test('VisualPlan derives a CTA visual concept from the CTA strategy and surfaces it', () => {
  const plan = new VisualPlanAgent().execute({
    strategy: baseStrategy, format: marketFormat,
    constraints: { ...constraints, ctaId: 'save_specific' },
    tickerSymbols: ['NVDA'], dateKey: '2026-06-03', slotIndex: 3,
  }).plan;
  const cta = plan.slides[plan.slides.length - 1];
  assert.equal(cta.intendedRole, 'cta');
  assert.equal(cta.ctaVisualConcept, 'SAVE_CARD');
  assert.equal(plan.storyboard.ctaVisualConcept, 'SAVE_CARD');
  assert.match(cta.ctaConceptId ?? '', /^SAVE_CARD:/);
});

async function ctaPrompt(ctaConcept: StoryboardContinuity['ctaVisualConcept']): Promise<string> {
  const sb = storyboard('TOP_STACK');
  sb.ctaVisualConcept = ctaConcept;
  const res = await new ImagePromptAgent().execute({
    slides: [{
      slideNumber: 1, role: 'cta', headline: 'Save this before your next trade',
      headlineColorMap: [], visualStyle: 'EDITORIAL_STAT_CARD', visualPosition: 'center',
      mood: 'premium', narrativeNote: 'cta',
    } as SlideSpec],
    format: marketFormat,
    storyboard: sb,
    dateKey: '2026-06-03',
  });
  return res.slides[0].geminiPrompt;
}

test('CTA concept renders a fresh save/send scene, not the luxury-desk/globe cliché', async () => {
  const save = await ctaPrompt('SAVE_CARD');
  assert.match(save, /saved|bookmark|save the post/i);
  assert.doesNotMatch(save, /Gulfstream|Rolex|holographic globe|yacht/i);

  const send = await ctaPrompt('SEND_TO_FRIEND');
  assert.match(send, /send this to a friend|paper-airplane|share/i);
});
