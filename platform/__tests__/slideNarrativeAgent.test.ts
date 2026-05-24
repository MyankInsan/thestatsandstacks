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
    viralFormat: 'HYPOTHETICAL_CHART',
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
    assert.ok(slide.visualElement.length > 0, 'visualElement must not be empty');
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
