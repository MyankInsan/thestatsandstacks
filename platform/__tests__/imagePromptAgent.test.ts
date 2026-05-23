import test from 'node:test';
import assert from 'node:assert/strict';
import { ImagePromptAgent } from '../src/lib/agents/imagePromptAgent';
import type { SlideSpec } from '../src/lib/agents/slideNarrativeAgent';
import type { FormatDecision } from '../src/lib/agents/formatStyleAgent';
import type { StrategyDecision } from '../src/lib/agents/contentStrategyAgent';
import { COLOR_SCHEMES } from '../src/lib/agents/formatStyleAgent';

const mockSlides: SlideSpec[] = [
  {
    slideNumber: 1,
    role: 'cover',
    headline: 'NVIDIA JUST BROKE',
    headlineColorMap: [
      { text: 'NVIDIA', color: 'accent2' },
      { text: 'JUST BROKE', color: 'primary' },
    ],
    eyebrow: 'JUST IN:',
    subtext: 'Wall Street did not see this coming',
    visualElement: 'shocked young trader at desk, three green monitors, dramatic rim lighting',
    visualPosition: 'top',
    mood: 'urgent, dramatic',
    narrativeNote: 'cover hook',
  },
  {
    slideNumber: 2,
    role: 'shock_stat',
    headline: 'EPS BEAT BY',
    headlineColorMap: [{ text: 'EPS BEAT BY', color: 'primary' }],
    dataPoint: '$0.08 A SHARE',
    subtext: 'Wall Street expected $0.88',
    visualElement: 'glowing digital number display in dark space',
    visualPosition: 'background',
    mood: 'shock and awe',
    narrativeNote: 'the big number',
  },
];

const mockFormat: FormatDecision = {
  formatType: 'BREAKING_NEWS',
  slideCount: 2,
  colorScheme: COLOR_SCHEMES.BREAKING_NEWS,
  visualTone: 'urgent and dramatic',
  reasoning: 'test',
};

const mockStrategy: StrategyDecision = {
  topic: 'NVDA earnings', hook: 'h', format: 'CAROUSEL', slideCount: 2,
  slideBreakdown: [], reasoning: '', targetAudience: 'test', searchKeywords: [],
};

test('ImagePromptAgent returns one prompt per slide', () => {
  const agent = new ImagePromptAgent();
  const result = agent.execute({ slides: mockSlides, format: mockFormat, strategy: mockStrategy });
  assert.equal(result.slides.length, 2);
});

test('Each prompt contains canvas size and brand handle', () => {
  const agent = new ImagePromptAgent();
  const result = agent.execute({ slides: mockSlides, format: mockFormat, strategy: mockStrategy });

  for (const slide of result.slides) {
    assert.ok(slide.geminiPrompt.includes('1080x1350'), 'must specify canvas size');
    assert.ok(slide.geminiPrompt.includes('@thestatsandstacks'), 'must include brand handle');
    assert.ok(!slide.geminiPrompt.includes(`${slide.slideNumber}/${mockSlides.length}`), 'must not include slide counter');
  }
});

test('Prompt includes correct background hex color', () => {
  const agent = new ImagePromptAgent();
  const result = agent.execute({ slides: mockSlides, format: mockFormat, strategy: mockStrategy });
  assert.ok(result.slides[0].geminiPrompt.includes('#000000'), 'must include bg color');
});

test('Prompt includes exact headline text', () => {
  const agent = new ImagePromptAgent();
  const result = agent.execute({ slides: mockSlides, format: mockFormat, strategy: mockStrategy });
  assert.ok(result.slides[0].geminiPrompt.includes('NVIDIA'), 'must include headline word');
  assert.ok(result.slides[0].geminiPrompt.includes('JUST IN:'), 'must include eyebrow');
});

test('Prompt includes dataPoint when present', () => {
  const agent = new ImagePromptAgent();
  const result = agent.execute({ slides: mockSlides, format: mockFormat, strategy: mockStrategy });
  assert.ok(result.slides[1].geminiPrompt.includes('$0.08 A SHARE'), 'must include dataPoint');
});
