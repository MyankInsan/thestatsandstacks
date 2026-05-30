import test from 'node:test';
import assert from 'node:assert/strict';
import { ImagePromptAgent } from '../src/lib/agents/imagePromptAgent';
import { pickPortrait } from '../src/lib/agents/portraitLibrary';
import { isTickerActive } from '../run-daily';
import type { SlideSpec } from '../src/lib/agents/slideNarrativeAgent';
import type { FormatDecision } from '../src/lib/agents/formatStyleAgent';
import type { ViralStyle } from '../src/lib/agents/promptLibrary';
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
    visualStyle: 'LINE_CHART' as ViralStyle,
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
    visualStyle: 'LINE_CHART' as ViralStyle,
    visualPosition: 'background',
    mood: 'shock and awe',
    narrativeNote: 'the big number',
  },
];

const mockFormat: FormatDecision = {
  formatType: 'PHOTOREALISTIC_NEWS_FLASH',
  slideCount: 7,
  colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_NEWS_FLASH,
  visualTone: 'urgent and dramatic',
  reasoning: 'test',
};

test('ImagePromptAgent returns one prompt per slide', async () => {
  const agent = new ImagePromptAgent();
  const result = await agent.execute({ slides: mockSlides, format: mockFormat });
  assert.equal(result.slides.length, 2);
});

test('Each prompt contains canvas size', async () => {
  const agent = new ImagePromptAgent();
  const result = await agent.execute({ slides: mockSlides, format: mockFormat });

  for (const slide of result.slides) {
    assert.ok(slide.geminiPrompt.includes('1080x1350'), 'must specify canvas size');
    assert.ok(!slide.geminiPrompt.includes(`${slide.slideNumber}/${mockSlides.length}`), 'must not include slide counter');
  }
});

test('Prompt includes correct background hex color', async () => {
  const agent = new ImagePromptAgent();
  const result = await agent.execute({ slides: mockSlides, format: mockFormat });
  assert.ok(result.slides[0].geminiPrompt.includes('#050505'), 'must include bg color');
});

test('Prompt includes exact headline text', async () => {
  const agent = new ImagePromptAgent();
  const result = await agent.execute({ slides: mockSlides, format: mockFormat });
  assert.ok(result.slides[0].geminiPrompt.includes('NVIDIA'), 'must include headline word');
  assert.ok(result.slides[0].geminiPrompt.includes('JUST IN:'), 'must include eyebrow');
});

test('Prompt includes dataPoint when present', async () => {
  const agent = new ImagePromptAgent();
  const result = await agent.execute({ slides: mockSlides, format: mockFormat });
  assert.ok(result.slides[1].geminiPrompt.includes('$0.08 A SHARE'), 'must include dataPoint');
});

test('ImagePromptAgent resolves scene variations for LUXURY_LIFESTYLE and varies them', async () => {
  const agent = new ImagePromptAgent();
  const luxurySlides: SlideSpec[] = [
    {
      slideNumber: 1,
      role: 'cover',
      headline: 'LUXURY ONE',
      headlineColorMap: [{ text: 'LUXURY ONE', color: 'primary' }],
      visualStyle: 'LUXURY_LIFESTYLE',
      visualPosition: 'top',
      mood: 'luxurious',
      narrativeNote: 'test',
    },
    {
      slideNumber: 2,
      role: 'breakdown',
      headline: 'LUXURY TWO',
      headlineColorMap: [{ text: 'LUXURY TWO', color: 'primary' }],
      visualStyle: 'LUXURY_LIFESTYLE',
      visualPosition: 'top',
      mood: 'luxurious',
      narrativeNote: 'test',
    },
  ];
  
  const result = await agent.execute({
    slides: luxurySlides,
    format: {
      formatType: 'PHOTOREALISTIC_LUXURY_LIFESTYLE',
      slideCount: 2,
      colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_LUXURY_LIFESTYLE,
      visualTone: 'premium',
      reasoning: 'test',
    },
    dateKey: '2026-05-29',
  });

  assert.equal(result.slides.length, 2);
  const prompt1 = result.slides[0].geminiPrompt;
  const prompt2 = result.slides[1].geminiPrompt;
  
  // They should be different because slideNumber is different
  assert.notEqual(prompt1, prompt2);
  
  // Both should contain the Luxury lifestyle keywords from variants, e.g. private jet, yacht, library, etc.
  // Let's assert that they don't both contain the same specific scene details (e.g. they rotated)
  const hasJet1 = prompt1.includes('Gulfstream') || prompt1.includes('jet');
  const hasJet2 = prompt2.includes('Gulfstream') || prompt2.includes('jet');
  assert.ok(!(hasJet1 && hasJet2), 'should rotate luxury scenes so both slides are not identical jet scenes');
});

test('ImagePromptAgent resolves corporate logo details for CORPORATE_OFFICE_SPACE', async () => {
  const agent = new ImagePromptAgent();
  const officeSlides: SlideSpec[] = [
    {
      slideNumber: 1,
      role: 'cover',
      headline: 'OFFICE TIME',
      headlineColorMap: [{ text: 'OFFICE TIME', color: 'primary' }],
      visualStyle: 'CORPORATE_OFFICE_SPACE',
      visualPosition: 'top',
      mood: 'professional',
      narrativeNote: 'test',
    },
  ];

  const result = await agent.execute({
    slides: officeSlides,
    format: mockFormat,
    tickerSymbols: ['NVDA'],
  });

  assert.equal(result.slides.length, 1);
  const prompt = result.slides[0].geminiPrompt;
  
  // Should contain NVIDIA's logo details
  assert.ok(prompt.includes('NVIDIA'), 'must contain NVIDIA company name');
  assert.ok(prompt.includes("lime-green eye-mark logo"), 'must contain NVDA logo mark style');
});

test('pickPortrait prioritizes active ticker portrait even if in avoid list', () => {
  const result = pickPortrait({
    topicCategory: 'EARNINGS',
    isCoverSlide: true,
    recentPortraitSlugs: ['lisa_su', 'jensen_huang'],
    recentArchetypeSlugs: [],
    deterministicSeed: 'test-seed-1',
    tickers: ['AMD'],
    topicTitle: 'AMD is rallying',
  });

  // Even though 'lisa_su' is in recentPortraitSlugs (avoid list), since 'AMD' is active,
  // it must prioritize 'lisa_su' and bypass the avoid-list check.
  assert.equal(result.slug, 'lisa_su');
  assert.equal(result.displayName, 'Lisa Su');
});

test('pickPortrait filters by Canadian affinity', () => {
  // 1. Canadian topic -> should pick a Canadian portrait
  const resultCan = pickPortrait({
    topicCategory: 'POLICY',
    isCoverSlide: true,
    recentPortraitSlugs: [],
    recentArchetypeSlugs: [],
    deterministicSeed: 'test-seed-2',
    topicTitle: 'New TFSA contribution rules in Canada',
  });
  // Justin Trudeau or Chrystia Freeland are Canadian candidates for POLICY
  assert.ok(resultCan.slug === 'trudeau' || resultCan.slug === 'chrystia_freeland' || resultCan.slug === 'seasoned_canadian_banker', 'Must pick Canadian portrait/archetype');

  // 2. Non-Canadian topic -> should NOT pick a Canadian portrait
  const resultUS = pickPortrait({
    topicCategory: 'POLICY',
    isCoverSlide: true,
    recentPortraitSlugs: [],
    recentArchetypeSlugs: [],
    deterministicSeed: 'test-seed-3',
    topicTitle: 'US Federal Reserve Interest Rate Decision',
  });
  assert.notEqual(resultUS.slug, 'trudeau');
  assert.notEqual(resultUS.slug, 'chrystia_freeland');
  assert.notEqual(resultUS.slug, 'tiff_macklem');
  assert.notEqual(resultUS.slug, 'mark_carney');
});

test('isTickerActive matches short tickers strictly with word boundaries and case sensitivity', () => {
  const mockStrategy = {
    topic: 'Markets are recovering today with heavy trading volume',
    searchKeywords: ['stock market', 'investors'],
    slideBreakdown: ['Slide 1: market news', 'Slide 2: volume details'],
  };

  // Tickers like V (Visa) or MA (Mastercard) should NOT match general words like 'recovering', 'volume', or 'market'
  assert.equal(isTickerActive('V', mockStrategy), false, 'Ticker V should not match "volume" or "recovering"');
  assert.equal(isTickerActive('MA', mockStrategy), false, 'Ticker MA should not match "market"');

  // Ticker V (Visa) should match if " V " is present case-sensitively or if "Visa" is present
  const strategyWithV = {
    ...mockStrategy,
    topic: 'Why we are buying V stock today',
  };
  assert.equal(isTickerActive('V', strategyWithV), true, 'Ticker V should match V as a single letter word');

  const strategyWithVisa = {
    ...mockStrategy,
    topic: 'Visa beats earnings expectations',
  };
  assert.equal(isTickerActive('V', strategyWithVisa), true, 'Ticker V should match when company name Visa is present');
});

test('ImagePromptAgent adapts prompts correctly for light mode backgrounds', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const agent = new ImagePromptAgent();
    const lightSlides: SlideSpec[] = [
      {
        slideNumber: 1,
        role: 'cover',
        headline: 'LIGHT THEME',
        headlineColorMap: [{ text: 'LIGHT THEME', color: 'primary' }],
        visualStyle: 'MINIMALIST_CHECKLIST', // Fallback will adapt this template
        visualPosition: 'top',
        mood: 'clean',
        narrativeNote: 'test',
      },
    ];

    const result = await agent.execute({
      slides: lightSlides,
      format: {
        formatType: 'PHOTOREALISTIC_MINIMAL_TECH',
        slideCount: 1,
        colorScheme: {
          bg: '#F8F9FA', // Light bg
          primaryText: '#111827',
          accent1: '#2563EB',
          accent2: '#4B5563',
        },
        visualTone: 'clean tech',
        reasoning: 'test',
      },
    });

    const prompt = result.slides[0].geminiPrompt;

    // The MINIMALIST_CHECKLIST template in promptLibrary has "dark matte navy background. White text"
    // In light mode, this should be replaced with "clean white background. Dark grey text"
    assert.ok(prompt.includes('clean white background. Dark grey text'), 'Must adapt background description for light mode');
    // It should also use the light-mode lighting descriptor
    assert.ok(prompt.includes('clean light-mode studio gradients and bright professional lighting'), 'Must adapt lighting description for light mode');
  } finally {
    process.env.GEMINI_API_KEY = originalKey;
  }
});

test('ImagePromptAgent incorporates layout structure positioning directives based on slide.visualPosition', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const agent = new ImagePromptAgent();
    const slides: SlideSpec[] = [
      {
        slideNumber: 1,
        role: 'cover',
        headline: 'TEST SPLIT LEFT',
        headlineColorMap: [{ text: 'TEST SPLIT LEFT', color: 'primary' }],
        visualStyle: 'ARCHITECTURAL_OVERLAY',
        visualPosition: 'left',
        mood: 'test',
        narrativeNote: 'test',
      },
    ];

    const result = await agent.execute({
      slides,
      format: {
        formatType: 'PHOTOREALISTIC_NEWS_FLASH',
        slideCount: 1,
        colorScheme: { bg: '#050505', primaryText: '#FFFFFF', accent1: '#39FF14', accent2: '#00CFFF' },
        visualTone: 'test',
        reasoning: 'test',
      },
    });

    const prompt = result.slides[0].geminiPrompt;
    assert.ok(prompt.includes('split-column layout') && prompt.includes('left side'), 'Must include left-aligned split layout directive in compiled prompt');
  } finally {
    process.env.GEMINI_API_KEY = originalKey;
  }
});

