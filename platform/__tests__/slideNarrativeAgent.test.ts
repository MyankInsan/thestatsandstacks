import test from 'node:test';
import assert from 'node:assert/strict';
import { SlideNarrativeAgent } from '../src/lib/agents/slideNarrativeAgent';
import type { StrategyDecision } from '../src/lib/agents/contentStrategyAgent';
import type { FormatDecision } from '../src/lib/agents/formatStyleAgent';
import { COLOR_SCHEMES } from '../src/lib/agents/formatStyleAgent';

const mockStrategy: StrategyDecision = {
  topic: 'NVDA earnings beat',
  hook: 'Nvidia just crushed estimates',
  format: 'CAROUSEL',
    
  slideCount: 7,
  slideBreakdown: ['Cover', 'The stat', 'Context', 'Why it matters', 'What to watch', 'Risk', 'CTA'],
  reasoning: 'Hot topic',
  targetAudience: 'Canadian retail investors',
  searchKeywords: ['NVDA'],
};

const mockFormat: FormatDecision = {
  formatType: 'PHOTOREALISTIC_NEWS_FLASH',
  slideCount: 6,
  colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_NEWS_FLASH,
  visualTone: 'urgent and dramatic',
  reasoning: 'breaking event',
};

test('SlideNarrativeAgent fallback produces correct slide count', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  const agent = new SlideNarrativeAgent();
  const result = await agent.execute({ strategy: mockStrategy, format: mockFormat, tickerSymbols: ['NVDA'] });

  process.env.GEMINI_API_KEY = saved ?? '';

  assert.equal(result.slides.length, mockFormat.slideCount);
});

test('SlideNarrativeAgent fallback — each slide has required fields', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  const agent = new SlideNarrativeAgent();
  const result = await agent.execute({ strategy: mockStrategy, format: mockFormat, tickerSymbols: [] });

  process.env.GEMINI_API_KEY = saved ?? '';

  for (const slide of result.slides) {
    assert.ok(slide.slideNumber >= 1, 'slideNumber must be >= 1');
    assert.ok(slide.headline.length > 0, 'headline must not be empty');
    assert.ok(Array.isArray(slide.headlineColorMap), 'headlineColorMap must be an array');
    assert.ok(slide.visualStyle.length > 0, 'visualStyle must not be empty');
    assert.ok(['cover','shock_stat','context','breakdown','data','humor','cta'].includes(slide.role), `Unknown role: ${slide.role}`);
  }
});

test('SlideNarrativeAgent fallback — last slide is CTA', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  const agent = new SlideNarrativeAgent();
  const result = await agent.execute({ strategy: mockStrategy, format: mockFormat, tickerSymbols: [] });

  process.env.GEMINI_API_KEY = saved ?? '';

  const last = result.slides[result.slides.length - 1];
  assert.equal(last.role, 'cta');
});

test('SlideNarrativeAgent fallback — enforces strict visualStyle uniqueness', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  const agent = new SlideNarrativeAgent();
  const result = await agent.execute({
    strategy: mockStrategy,
    format: mockFormat,
    tickerSymbols: [],
    constraints: {
      excludedStyles: [],
      requiredChartSlideRole: null,
      maxHumanSlides: 2,
      maxHumanInFirst3: 1,
      forbiddenAdjacentBuckets: true,
      narrativeArc: 'HOOK_PROBLEM_REVEAL_FRAMEWORK_CTA',
      chartSupportingSuggestions: [],
      ctaId: 'save_specific',
      ctaCarouselImpactNote: 'test',
      recentSubjects: [],
      recentArchetypes: [],
      preferTestedStyles: true
    }
  });

  process.env.GEMINI_API_KEY = saved ?? '';

  const seen = new Set<string>();
  for (const s of result.slides) {
    assert.ok(!seen.has(s.visualStyle), `Duplicate style found: ${s.visualStyle}`);
    seen.add(s.visualStyle);
  }
});

test('SlideNarrativeAgent fallback — enforces maxHumanSlides and maxHumanInFirst3 constraints', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  const agent = new SlideNarrativeAgent();
  const result = await agent.execute({
    strategy: {
      ...mockStrategy,
      slideCount: 6,
    },
    format: {
      ...mockFormat,
      formatType: 'MEME_HUMOR', // this format naturally uses human caricatures/portraits in baseVariants
    },
    tickerSymbols: [],
    constraints: {
      excludedStyles: [],
      requiredChartSlideRole: null,
      maxHumanSlides: 2,
      maxHumanInFirst3: 1,
      forbiddenAdjacentBuckets: true,
      narrativeArc: 'HOOK_PROBLEM_REVEAL_FRAMEWORK_CTA',
      chartSupportingSuggestions: [],
      ctaId: 'save_specific',
      ctaCarouselImpactNote: 'test',
      recentSubjects: [],
      recentArchetypes: [],
      preferTestedStyles: true
    }
  });

  process.env.GEMINI_API_KEY = saved ?? '';

  const HUMAN_STYLES = new Set([
    'POP_CULTURE_PORTRAIT',
    'CARICATURE_PORTRAIT',
    'EXPERT_CUTOUT',
    'TRADER_DESK_SILHOUETTE',
    'EXECUTIVE_LINEUP',
    'LEADER_LOGO_CUTOUTS',
    'EDITORIAL_REACTION_CARICATURE',
    'CIRCULAR_PORTFOLIO_WHEEL',
    'PORTFOLIO_DOUGHNUT_PORTRAIT',
  ]);

  let humanCount = 0;
  let humanFirst3 = 0;
  for (let i = 0; i < result.slides.length; i++) {
    const s = result.slides[i];
    if (HUMAN_STYLES.has(s.visualStyle)) {
      humanCount++;
      if (i < 3) humanFirst3++;
    }
  }

  assert.ok(humanCount <= 2, `Too many human slides: ${humanCount}`);
  assert.ok(humanFirst3 <= 1, `Too many human slides in first 3: ${humanFirst3}`);
});

