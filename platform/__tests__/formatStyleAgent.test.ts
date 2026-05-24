import test from 'node:test';
import assert from 'node:assert/strict';
import { FormatStyleAgent, FORMAT_TYPES, COLOR_SCHEMES } from '../src/lib/agents/formatStyleAgent';
import type { StrategyDecision } from '../src/lib/agents/contentStrategyAgent';

const mockStrategy: StrategyDecision = {
  topic: 'NVDA earnings beat',
  hook: 'Nvidia just crushed estimates',
  format: 'CAROUSEL',
  slideCount: 7,
  slideBreakdown: ['Cover', 'The number', 'Why it matters', 'What to watch', 'Risk note', 'Checklist', 'CTA'],
  reasoning: 'Hot topic',
  targetAudience: 'Canadian retail investors',
  searchKeywords: ['NVDA', 'earnings'],
};

test('FormatStyleAgent fallback returns valid FormatDecision shape', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  const agent = new FormatStyleAgent();
  const result = await agent.execute({ strategy: mockStrategy, contentHistory: [], tickerSymbols: ['NVDA'] });

  process.env.GEMINI_API_KEY = saved ?? '';

  assert.ok(FORMAT_TYPES.includes(result.formatType), `Unknown formatType: ${result.formatType}`);
  assert.ok(result.slideCount >= 6 && result.slideCount <= 9, `slideCount out of range: ${result.slideCount}`);
  assert.ok(result.colorScheme.bg.startsWith('#'), 'bg must be hex');
  assert.ok(result.colorScheme.accent1.startsWith('#'), 'accent1 must be hex');
  assert.ok(result.visualTone.length > 0, 'visualTone must not be empty');
});

test('FormatStyleAgent fallback avoids the last two format types', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  const agent = new FormatStyleAgent();
  const result = await agent.execute({
    strategy: mockStrategy,
    contentHistory: [
      { date: '2026-05-21', topic: 't', hook: 'h', format: 'CAROUSEL', formatType: 'PHOTOREALISTIC_NEWS_FLASH', slideCount: 7, keywords: [] },
      { date: '2026-05-20', topic: 't', hook: 'h', format: 'CAROUSEL', formatType: 'VS_COMPARISON_INFOGRAPHIC', slideCount: 7, keywords: [] },
    ],
    tickerSymbols: [],
  });

  process.env.GEMINI_API_KEY = saved ?? '';

  assert.notEqual(result.formatType, 'PHOTOREALISTIC_NEWS_FLASH', 'Should not repeat PHOTOREALISTIC_NEWS_FLASH');
  assert.notEqual(result.formatType, 'VS_COMPARISON_INFOGRAPHIC', 'Should not repeat VS_COMPARISON_INFOGRAPHIC');
});

test('COLOR_SCHEMES covers all FORMAT_TYPES', () => {
  for (const ft of FORMAT_TYPES) {
    const scheme = COLOR_SCHEMES[ft];
    assert.ok(scheme, `Missing color scheme for ${ft}`);
    assert.ok(scheme.bg.startsWith('#'));
    assert.ok(scheme.primaryText.startsWith('#'));
    assert.ok(scheme.accent1.startsWith('#'));
    assert.ok(scheme.accent2.startsWith('#'));
  }
});
