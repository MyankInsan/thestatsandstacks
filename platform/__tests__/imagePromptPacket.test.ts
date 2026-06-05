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

test('storyboard evidence artifact becomes an explicit image prompt section', async () => {
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
      evidenceArtifactPlan: {
        premise: 'Every slide is built around a concrete evidence object.',
        sharedEvidenceRule: 'Use artifact continuity; do not invent unrelated symbols.',
        artifacts: [{
          slideNumber: 1,
          kind: 'PRICE_CHART',
          label: 'NVDA split-adjusted 5-year price chart',
          visualAnchor: 'A realistic annotated brokerage chart with NVDA ticker, split markers, and a verified-result placeholder area for manual math.',
          dataIntegrityNote: 'Do not print a precise final dollar value until manually verified.',
        }],
      },
    };
    const slide = { ...luxurySlide(), storyboardBeat: 'establish the premise' };
    const result = await new ImagePromptAgent().execute({
      slides: [slide],
      format: luxuryFormat,
      dateKey: '2026-06-02',
      slotIndex: 5,
      storyboard,
      tickerSymbols: ['NVDA'],
    });
    const p = result.slides[0].geminiPrompt;
    assert.match(p, /EVIDENCE ARTIFACT/);
    assert.match(p, /NVDA split-adjusted 5-year price chart/);
    assert.match(p, /Do not print a precise final dollar value/i);
    assert.match(p, /concrete evidence object/i);
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

test('unresolved return placeholders are stripped from exact rendered text', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  try {
    const slide: SlideSpec = {
      slideNumber: 4,
      role: 'chart_data',
      eyebrow: 'RESULT:',
      headline: 'THE RESULT TODAY',
      headlineColorMap: [{ text: 'THE RESULT TODAY', color: 'primary' }],
      subtext: 'That $10,000 is now worth $XX,XXX',
      dataPoint: 'X% return',
      visualStyle: 'CANDLESTICK_HERO',
      visualPosition: 'background',
      mood: 'premium',
      narrativeNote: 'result slide',
    };
    const result = await new ImagePromptAgent().execute({
      slides: [slide],
      format: { formatType: 'PHOTOREALISTIC_MARKET_UPDATE', slideCount: 1, colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_MARKET_UPDATE, visualTone: 'data', reasoning: 't' },
      dateKey: '2026-06-04', slotIndex: 5,
    });
    const p = result.slides[0].geminiPrompt;
    assert.doesNotMatch(p, /\$XX|XX,XXX|\bX%/i);
    assert.match(p, /verified|illustrative|magnitude/i);
  } finally {
    process.env.GEMINI_API_KEY = saved ?? '';
  }
});

test('ticker portrait styles use mapped real subjects instead of generic fake managers', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  try {
    const slide: SlideSpec = {
      slideNumber: 2,
      role: 'breakdown',
      headline: 'WHO BUILT THE AI TRADE',
      headlineColorMap: [{ text: 'WHO BUILT THE AI TRADE', color: 'primary' }],
      subtext: 'NVIDIA leadership is the visual anchor',
      visualStyle: 'PORTFOLIO_DOUGHNUT_PORTRAIT',
      visualPosition: 'background',
      mood: 'premium',
      narrativeNote: 'real subject slide',
    };
    const result = await new ImagePromptAgent().execute({
      slides: [slide],
      format: { formatType: 'PHOTOREALISTIC_MARKET_UPDATE', slideCount: 1, colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_MARKET_UPDATE, visualTone: 'data', reasoning: 't' },
      tickerSymbols: ['NVDA'],
      dateKey: '2026-06-04', slotIndex: 5,
    });
    const p = result.slides[0].geminiPrompt;
    assert.match(p, /Jensen Huang/i);
    assert.doesNotMatch(p, /senior portfolio manager|silver-haired portfolio manager/i);
  } finally {
    process.env.GEMINI_API_KEY = saved ?? '';
  }
});

test('legacy cliché styles fall back without bull or rocket imagery', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  try {
    const slides: SlideSpec[] = [
      {
        slideNumber: 1,
        role: 'cover',
        headline: 'THE GROWTH TEST',
        headlineColorMap: [{ text: 'THE GROWTH TEST', color: 'primary' }],
        subtext: 'Growth without mascot metaphors',
        visualStyle: 'ANIMAL_METAPHOR',
        visualPosition: 'background',
        mood: 'premium',
        narrativeNote: 'legacy style should be neutralized',
      },
      {
        slideNumber: 2,
        role: 'breakdown',
        headline: 'TFSA VS SPECULATION',
        headlineColorMap: [{ text: 'TFSA VS SPECULATION', color: 'primary' }],
        subtext: 'TFSA vs RRSP vs FHSA',
        visualStyle: 'FUNNY_COMPARISON',
        visualPosition: 'left',
        mood: 'premium',
        narrativeNote: 'allowed comparison should not use rocket props',
      },
    ];
    const result = await new ImagePromptAgent().execute({
      slides,
      format: luxuryFormat,
      dateKey: '2026-06-04',
      slotIndex: 6,
    });
    const packet = result.slides.map((s) => s.geminiPrompt).join('\n\n');
    assert.doesNotMatch(packet, /majestic, muscular charging bull|roaring grizzly|cheetah crafted|tiny plastic toy rocket|marble chessboard|F1 racing car|rocket launching|hypersonic military cruise missile/i);
  } finally {
    process.env.GEMINI_API_KEY = saved ?? '';
  }
});

test('single-ticker prompts carry editorial realism anchors and forbid unrelated logos', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  try {
    const slide: SlideSpec = {
      slideNumber: 2,
      role: 'breakdown',
      headline: 'RETAIL WARNING SIGNS',
      headlineColorMap: [{ text: 'RETAIL WARNING SIGNS', color: 'primary' }],
      subtext: 'Inventory, traffic, and margin pressure',
      visualStyle: 'EARNINGS_HEAT_TABLE',
      visualPosition: 'background',
      mood: 'premium',
      narrativeNote: 'Lululemon evidence slide',
    };
    const result = await new ImagePromptAgent().execute({
      slides: [slide],
      format: { formatType: 'PHOTOREALISTIC_MARKET_UPDATE', slideCount: 1, colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_MARKET_UPDATE, visualTone: 'data', reasoning: 't' },
      tickerSymbols: ['LULU'],
      dateKey: '2026-06-04',
      slotIndex: 6,
    });
    const p = result.slides[0].geminiPrompt;
    assert.match(p, /EDITORIAL REALISM CONTRACT/i);
    assert.match(p, /Lululemon/i);
    assert.match(p, /storefront|apparel rack|fabric tag|inventory|earnings filing|sales floor/i);
    assert.match(p, /Only use the listed ticker logos|Do NOT add unrelated company logos/i);
    assert.doesNotMatch(p, /\b(AMZN|MSFT|AAPL|GOOGL|NVDA)\b/);
  } finally {
    process.env.GEMINI_API_KEY = saved ?? '';
  }
});

test('NVDA prompts prefer real company evidence over generic AI business imagery', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  try {
    const slide: SlideSpec = {
      slideNumber: 1,
      role: 'cover',
      headline: 'WHAT $10K IN NVDA SHOWS',
      headlineColorMap: [{ text: 'WHAT $10K IN NVDA SHOWS', color: 'primary' }],
      subtext: 'Split-adjusted chart first',
      visualStyle: 'PRICE_TIMELINE_ANNOTATED',
      visualPosition: 'background',
      mood: 'premium',
      narrativeNote: 'NVDA cover',
    };
    const result = await new ImagePromptAgent().execute({
      slides: [slide],
      format: { formatType: 'PHOTOREALISTIC_MARKET_UPDATE', slideCount: 1, colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_MARKET_UPDATE, visualTone: 'data', reasoning: 't' },
      tickerSymbols: ['NVDA'],
      dateKey: '2026-06-04',
      slotIndex: 5,
    });
    const p = result.slides[0].geminiPrompt;
    assert.match(p, /Jensen Huang|GPU|data-center|GTC|NVIDIA earnings/i);
    assert.match(p, /real-world evidence|researched by a human editor/i);
    assert.match(p, /no fake finance influencer|no generic portfolio manager|no random logo orbit/i);
  } finally {
    process.env.GEMINI_API_KEY = saved ?? '';
  }
});
