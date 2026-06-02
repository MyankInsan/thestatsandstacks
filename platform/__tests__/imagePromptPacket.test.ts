import test from 'node:test';
import assert from 'node:assert/strict';
import { ImagePromptAgent } from '../src/lib/agents/imagePromptAgent';
import type { SlideSpec } from '../src/lib/agents/slideNarrativeAgent';
import type { FormatDecision } from '../src/lib/agents/formatStyleAgent';
import { COLOR_SCHEMES } from '../src/lib/agents/formatStyleAgent';
import type { StoryboardContinuity } from '../src/lib/agents/visualPlanAgent';

const luxuryFormat: FormatDecision = {
  formatType: 'PHOTOREALISTIC_LUXURY_LIFESTYLE',
  slideCount: 1,
  colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_LUXURY_LIFESTYLE,
  visualTone: 'premium',
  reasoning: 'test',
};

function luxurySlide(): SlideSpec {
  return {
    slideNumber: 1,
    role: 'cover',
    headline: 'WEALTH MOVES QUIETLY',
    headlineColorMap: [{ text: 'WEALTH MOVES QUIETLY', color: 'primary' }],
    visualStyle: 'LUXURY_LIFESTYLE',
    visualPosition: 'top',
    mood: 'lux',
    narrativeNote: 'cover',
  };
}

test('same-day slots no longer collapse onto the identical scene (slot-aware variety)', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  try {
    const agent = new ImagePromptAgent();
    const scenes: string[] = [];
    for (let slot = 1; slot <= 6; slot++) {
      const result = await agent.execute({ slides: [luxurySlide()], format: luxuryFormat, dateKey: '2026-05-30', slotIndex: slot });
      scenes.push(result.slides[0].geminiPrompt);
    }
    assert.ok(new Set(scenes).size >= 2, 'at least two distinct CTA/cover scenes across the 6 same-day slots');
  } finally {
    process.env.GEMINI_API_KEY = saved ?? '';
  }
});

test('storyboard adds ANCHOR / MUST KEEP / CHANGE ONLY blocks and ChatGPT Images 2.0 routing', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  try {
    const storyboard: StoryboardContinuity = {
      premise: 'NVDA earnings — the beat behind the move',
      anchorPrompt: 'anchor',
      sharedVisualInvariants: ['Palette anchored on #0A0A0A', 'Lower-third @thestatsandstacks watermark'],
      progressionRule: 'each slide advances one point',
      resolutionRule: 'CTA resolves the motif',
      varietyRule: 'no adjacent repeats',
    };
    const slide = { ...luxurySlide(), storyboardBeat: 'establish the premise' };
    const result = await new ImagePromptAgent().execute({ slides: [slide], format: luxuryFormat, dateKey: '2026-06-02', slotIndex: 5, storyboard });
    const p = result.slides[0].geminiPrompt;
    assert.match(p, /STORYBOARD CONTINUITY/);
    assert.match(p, /MUST KEEP/);
    assert.match(p, /CHANGE ONLY/);
    assert.match(p, /ANCHOR slide/);
    assert.match(p, /ChatGPT Images 2\.0/);
    assert.match(p, /Seedream/);
    assert.match(p, /establish the premise/);
  } finally {
    process.env.GEMINI_API_KEY = saved ?? '';
  }
});

test('unsupported "illustrative" figures are suppressed from the image prompt', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  try {
    const slide: SlideSpec = {
      slideNumber: 2,
      role: 'chart_data',
      headline: 'THE MOVE',
      headlineColorMap: [{ text: 'THE MOVE', color: 'primary' }],
      dataPoint: '$2.4B',
      visualStyle: 'CANDLESTICK_HERO',
      visualPosition: 'background',
      mood: 'bold',
      narrativeNote: 'illustrative — not evidence-backed',
    };
    const result = await new ImagePromptAgent().execute({
      slides: [slide],
      format: { formatType: 'PHOTOREALISTIC_MARKET_UPDATE', slideCount: 1, colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_MARKET_UPDATE, visualTone: 'data', reasoning: 't' },
      dateKey: '2026-06-02', slotIndex: 1,
    });
    const p = result.slides[0].geminiPrompt;
    assert.doesNotMatch(p, /hero data figure reading "\$2\.4B"/, 'must not render the exact unverified figure as a precise hero number');
    assert.match(p, /illustrative/i);
  } finally {
    process.env.GEMINI_API_KEY = saved ?? '';
  }
});
