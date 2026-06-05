import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualPlanAgent, dominantSubjectClassFor } from '../src/lib/agents/visualPlanAgent';
import { SlideNarrativeAgent } from '../src/lib/agents/slideNarrativeAgent';
import { EvidenceArtifactAgent } from '../src/lib/agents/evidenceArtifactAgent';
import type { CarouselConstraints } from '../src/lib/agents/carouselConstraintAgent';
import type { StrategyDecision } from '../src/lib/agents/contentStrategyAgent';
import type { FormatDecision } from '../src/lib/agents/formatStyleAgent';
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
  topic: 'NVDA earnings beat',
  hook: 'Nvidia just crushed estimates',
  format: 'CAROUSEL',
  slideCount: 7,
  slideBreakdown: ['Cover', 'The stat', 'Context', 'Why it matters', 'What to watch', 'Risk', 'CTA'],
  reasoning: 'Hot topic',
  targetAudience: 'investors',
  searchKeywords: ['NVDA'],
  topicCategory: 'EARNINGS',
  angleId: 'EARNINGS_REACTION',
  angleSlideSkeleton: ['cover: what happened', 'the EPS beat', 'the reaction', 'guidance', 'what to watch', 'risk', 'cta'],
};

const format: FormatDecision = {
  formatType: 'PHOTOREALISTIC_MARKET_UPDATE',
  slideCount: 7,
  colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_MARKET_UPDATE,
  visualTone: 'data-driven, premium',
  reasoning: 'test',
};

function runPlan(c: CarouselConstraints) {
  return new VisualPlanAgent().execute({ strategy, format, constraints: c, tickerSymbols: ['NVDA'], dateKey: '2026-06-02', slotIndex: 1 });
}

test('VisualPlanAgent produces a complete, valid plan', () => {
  const result = runPlan(makeConstraints());
  assert.equal(result.plan.slides.length, 7);
  assert.equal(result.plan.slides[0].intendedRole, 'cover');
  assert.equal(result.plan.slides[6].intendedRole, 'cta');
  assert.equal(result.valid, true, `violations: ${result.violations.join('; ')}`);
});

test('VisualPlanAgent: no adjacent dominant subject class or bucket, no duplicate styles', () => {
  const result = runPlan(makeConstraints());
  const slides = result.plan.slides;
  const seen = new Set<string>();
  for (let i = 0; i < slides.length; i++) {
    assert.ok(!seen.has(slides[i].visualStyle), `duplicate style ${slides[i].visualStyle}`);
    seen.add(slides[i].visualStyle);
    if (i > 0) {
      assert.notEqual(slides[i].dominantSubjectClass, slides[i - 1].dominantSubjectClass, `adjacent subject class repeats at slide ${i + 1}`);
      assert.notEqual(slides[i].bucket, slides[i - 1].bucket, `adjacent bucket repeats at slide ${i + 1}`);
    }
  }
});

test('VisualPlanAgent: includes a Data-bucket chart slide when required', () => {
  const result = runPlan(makeConstraints());
  assert.ok(result.plan.slides.some((s) => s.bucket === 'Data'), 'plan must contain a chart slide');
});

test('VisualPlanAgent: respects excludedStyles', () => {
  const excluded = ['CANDLESTICK_HERO', 'LINE_CHART'] as CarouselConstraints['excludedStyles'];
  const result = runPlan(makeConstraints({ excludedStyles: excluded }));
  for (const s of result.plan.slides) {
    assert.ok(!excluded.includes(s.visualStyle), `used excluded style ${s.visualStyle}`);
  }
});

test('VisualPlanAgent: respects human-slide caps', () => {
  const result = runPlan(makeConstraints({ chartHeroSuggestion: 'EXPERT_CUTOUT' }));
  const human = result.plan.slides.filter((s) => s.dominantSubjectClass === 'PORTRAIT' || s.dominantSubjectClass === 'CROWD');
  assert.ok(human.length <= 2, `too many human slides: ${human.length}`);
  const first3 = result.plan.slides.slice(0, 3).filter((s) => s.dominantSubjectClass === 'PORTRAIT' || s.dominantSubjectClass === 'CROWD');
  assert.ok(first3.length <= 1, `too many human slides in first 3: ${first3.length}`);
});

test('VisualPlanAgent: composition signature is deterministic and storyboard is populated', () => {
  const a = runPlan(makeConstraints());
  const b = runPlan(makeConstraints());
  assert.equal(a.plan.compositionSignature, b.plan.compositionSignature);
  assert.match(a.plan.compositionSignature, /^vp1:DATA_SNAPSHOT:/);
  assert.ok(a.plan.storyboard.premise.length > 0);
  assert.ok(a.plan.storyboard.anchorPrompt.length > 0);
  assert.ok(a.plan.storyboard.progressionRule.length > 0);
  assert.ok(a.plan.storyboard.resolutionRule.length > 0);
});

test('VisualPlanAgent attaches deterministic evidence artifacts to each slide and storyboard', () => {
  const evidenceArtifactPlan = new EvidenceArtifactAgent().execute({
    strategy,
    tickerSymbols: ['NVDA'],
    slideCount: format.slideCount,
  });
  const result = new VisualPlanAgent().execute({
    strategy,
    format,
    constraints: makeConstraints(),
    tickerSymbols: ['NVDA'],
    dateKey: '2026-06-02',
    slotIndex: 1,
    evidenceArtifactPlan,
  });

  assert.equal(result.plan.evidenceArtifactPlan, evidenceArtifactPlan);
  assert.equal(result.plan.storyboard.evidenceArtifactPlan, evidenceArtifactPlan);
  assert.equal(result.plan.slides[0].evidenceArtifact?.kind, 'EARNINGS_TABLE');
  assert.match(result.plan.slides[0].storyboardBeat, /evidence artifact/i);
  assert.ok(result.plan.storyboard.sharedVisualInvariants.some((rule) => /evidence artifact/i.test(rule)));
});

test('dominantSubjectClassFor maps known styles', () => {
  assert.equal(dominantSubjectClassFor('CANDLESTICK_HERO'), 'CHART');
  assert.equal(dominantSubjectClassFor('EXPERT_CUTOUT'), 'PORTRAIT');
  assert.equal(dominantSubjectClassFor('ARCHITECTURAL_OVERLAY'), 'BUILDING');
  assert.equal(dominantSubjectClassFor('LUXURY_LIFESTYLE'), 'METAPHOR_OBJECT');
  assert.equal(dominantSubjectClassFor('GLOWING_QUOTE'), 'TYPOGRAPHY');
});

test('SlideNarrativeAgent (deterministic copy fallback) locks the visual plan grammar', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  try {
    const result = runPlan(makeConstraints());
    const narrative = await new SlideNarrativeAgent().execute({
      strategy,
      format,
      tickerSymbols: ['NVDA'],
      constraints: makeConstraints(),
      visualPlan: result.plan,
    });
    assert.equal(narrative.slides.length, result.plan.slides.length);
    for (let i = 0; i < narrative.slides.length; i++) {
      const slide = narrative.slides[i];
      const grammar = result.plan.slides[i];
      assert.equal(slide.visualStyle, grammar.visualStyle, `slide ${i + 1} style must match locked plan`);
      assert.equal(slide.visualPosition, grammar.visualPosition, `slide ${i + 1} position must match locked plan`);
      assert.equal(slide.role, grammar.intendedRole, `slide ${i + 1} role must match locked plan`);
      assert.ok(slide.headline.length > 0, `slide ${i + 1} headline must not be empty`);
      assert.ok(slide.storyboardBeat && slide.storyboardBeat.length > 0, `slide ${i + 1} must have a storyboard beat`);
    }
    assert.equal(narrative.slides[narrative.slides.length - 1].role, 'cta');
  } finally {
    process.env.GEMINI_API_KEY = saved ?? '';
  }
});
