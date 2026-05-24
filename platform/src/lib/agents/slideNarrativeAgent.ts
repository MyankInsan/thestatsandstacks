import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import type { StrategyDecision } from './contentStrategyAgent';
import type { FormatDecision } from './formatStyleAgent';

export interface HeadlineColor {
  text: string;
  color: 'primary' | 'accent1' | 'accent2';
}

export type SlideRole = 'cover' | 'shock_stat' | 'context' | 'breakdown' | 'data' | 'humor' | 'cta';

export interface SlideSpec {
  slideNumber: number;
  role: SlideRole;
  headline: string;
  headlineColorMap: HeadlineColor[];
  subtext?: string;
  eyebrow?: string;
  dataPoint?: string;
  visualElement: string;
  visualPosition: 'top' | 'background' | 'left' | 'right' | 'center';
  mood: string;
  narrativeNote: string;
}

export interface SlideNarrative {
  slides: SlideSpec[];
}

export class SlideNarrativeAgent {
  async execute(input: {
    strategy: StrategyDecision;
    format: FormatDecision;
    tickerSymbols: string[];
  }): Promise<SlideNarrative> {
    console.log(`[SlideNarrativeAgent] Writing ${input.format.slideCount} slide specs...`);

    const prompt = buildPrompt(input.strategy, input.format, input.tickerSymbols);

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(text) as { slides: SlideSpec[] };

      if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
        return buildFallback(input.strategy, input.format);
      }

      const slides = parsed.slides.slice(0, input.format.slideCount).map((s, i) => ({
        ...s,
        slideNumber: i + 1,
        headlineColorMap: Array.isArray(s.headlineColorMap) ? s.headlineColorMap : [{ text: s.headline, color: 'primary' as const }],
        visualPosition: s.visualPosition || 'top',
      }));

      if (slides.length > 0) slides[slides.length - 1].role = 'cta';
      return { slides };
    } catch (err) {
      console.warn('[SlideNarrativeAgent] Gemini failed, using fallback.', err instanceof Error ? err.message : String(err));
      return buildFallback(input.strategy, input.format);
    }
  }
}

function buildPrompt(strategy: StrategyDecision, format: FormatDecision, tickers: string[]): string {
  return `You are a viral finance Instagram content writer. Write the complete slide narrative for a ${format.slideCount}-slide carousel.

TOPIC: ${strategy.topic}
HOOK: ${strategy.hook}
FORMAT TYPE: ${format.formatType}
VISUAL TONE: ${format.visualTone}
TICKERS: ${tickers.join(', ') || 'none'}
TARGET AUDIENCE: ${strategy.targetAudience}
COLOR SCHEME: bg=${format.colorScheme.bg}, accent1=${format.colorScheme.accent1}, accent2=${format.colorScheme.accent2}

SLIDE NARRATIVE RULES:
- Slide 1: Cover — highest energy hook, 4-7 word headline, eyebrow label
- Middle slides: Build tension, reveal data, explain context
- Last slide: Always role "cta" — strong follow/save prompt for @thestatsandstacks
- Each headline: max 8 words, bold and punchy
- headlineColorMap: break headline into parts, assign each part a color (primary=white, accent1=neon, accent2=cyan/secondary)
- visualElement: YOU MUST DESCRIBE A COHESIVE, HIGHLY EMOTIONAL PHOTOSHOOT.
  1. Pick a specific continuous subject for the whole carousel (e.g. "A stressed Wall Street trader in a wrinkled navy suit" or "A focused female investor in a sleek glass office"). Use this exact same subject description in every single slide to maintain consistency.
  2. Use action verbs and intense human emotion (e.g., "gripping his hair", "staring intensely at a glowing red screen", "looking exhausted but triumphant"). Emotion stops the scroll!
  3. No 2D illustrations, no generic static desks. The scenes must feature a human subject doing something dramatic.
- dataPoint: include only if there's a real number/stat to hero (e.g. "+18.2% EPS BEAT")
- subtext: one short line of supporting context, max 12 words

Return ONLY valid JSON matching this exact schema (no markdown):
{
  "slides": [
    {
      "slideNumber": 1,
      "role": "cover",
      "headline": "NVIDIA JUST BROKE",
      "headlineColorMap": [
        {"text": "NVIDIA", "color": "accent2"},
        {"text": "JUST BROKE", "color": "primary"}
      ],
      "eyebrow": "JUST IN:",
      "subtext": "Wall Street didn't see this coming",
      "dataPoint": null,
      "visualElement": "over-the-shoulder view of a modern minimalist trading desk, a single sleek monitor slightly out of focus, natural window lighting, clean aesthetic",
      "visualPosition": "top",
      "mood": "urgent, high-energy, breaking news",
      "narrativeNote": "Opens with the hook — sets up the big reveal in slide 2"
    }
  ]
}`;
}

const FALLBACK_EYEBROWS: Record<string, string> = {
  PHOTOREALISTIC_NEWS_FLASH:        'BREAKING:',
  PHOTOREALISTIC_LUXURY_LIFESTYLE:  'LIFESTYLE:',
  PHOTOREALISTIC_MARKET_UPDATE:     'MARKET:',
  PHOTOREALISTIC_EXPERT_SHOCK:      'INSIGHT:',
};

const FALLBACK_VISUAL_VARIANTS: Record<string, string[]> = {
  PHOTOREALISTIC_NEWS_FLASH: [
    'hyper-realistic breaking news photo, public figure giving a speech at a podium, dramatic lighting, out of focus crowd in background',
    'hyper-realistic cinematic shot of a glowing red market ticker on a Wall Street building, rainy night, neon reflections',
  ],
  PHOTOREALISTIC_LUXURY_LIFESTYLE: [
    'hyper-realistic photo of the interior of a private jet, leather seats, a glass of champagne on the table, overlooking the clouds',
    'hyper-realistic photo of a luxury sports car parked in front of a modern mansion at sunset, cinematic lighting',
  ],
  PHOTOREALISTIC_MARKET_UPDATE: [
    'hyper-realistic shot of a high-end trading desk, multiple monitors glowing green and red with stock charts, dark room, highly focused',
    'hyper-realistic macro photography of a smartphone displaying a booming stock chart, held by a person in a tailored suit',
  ],
  PHOTOREALISTIC_EXPERT_SHOCK: [
    'hyper-realistic portrait of a financial expert looking shocked, dramatic lighting, dark background, cinematic depth of field',
    'hyper-realistic photo of a trader with hands on their head in disbelief, trading floor background, intense emotion',
  ],
};

function stripBreakdownPrefixes(text: string): string {
  // Strip "Slide N:" then any remaining "Word N:" prefix (e.g. "Risk 1:", "Check 2:", "Catalyst 3:")
  return text
    .replace(/^slide\s*\d+[:.]\s*/i, '')
    .replace(/^\w[\w]*\s+\d+[:.]\s*/i, '')
    .trim();
}

function parseBreakdown(breakdown: string): { headline: string; subtext: string } {
  const stripped = stripBreakdownPrefixes(breakdown);
  const parts = stripped.split(' | ').map(p => p.trim()).filter(Boolean);
  const headlineRaw = (parts[0] ?? stripped).toUpperCase();
  const subtextRaw = parts[1] ?? '';
  return {
    headline: headlineRaw.split(' ').slice(0, 7).join(' '),
    subtext: subtextRaw,
  };
}

function buildFallback(strategy: StrategyDecision, format: FormatDecision): SlideNarrative {
  const count = format.slideCount;
  const eyebrow = FALLBACK_EYEBROWS[format.formatType] ?? 'KEY INSIGHT:';
  const visualVariants = FALLBACK_VISUAL_VARIANTS[format.formatType] ?? FALLBACK_VISUAL_VARIANTS.PHOTOREALISTIC_NEWS_FLASH;

  const slides: SlideSpec[] = [];

  const coverWords = strategy.hook.toUpperCase().split(' ').slice(0, 8);
  const half = Math.ceil(coverWords.length / 2);
  slides.push({
    slideNumber: 1,
    role: 'cover',
    headline: coverWords.join(' '),
    headlineColorMap: [
      { text: coverWords.slice(0, half).join(' '), color: 'accent1' },
      { text: coverWords.slice(half).join(' '), color: 'primary' },
    ],
    eyebrow,
    subtext: strategy.topic,
    visualElement: visualVariants[0],
    visualPosition: 'top',
    mood: format.visualTone,
    narrativeNote: 'Cover hook',
  });

  for (let i = 2; i < count; i++) {
    const rawBreakdown = strategy.slideBreakdown[i - 1] ?? `Point ${i - 1}`;
    const { headline, subtext } = parseBreakdown(rawBreakdown);
    const headlineWords = headline.split(' ');
    const headlineHalf = Math.ceil(headlineWords.length / 2);
    slides.push({
      slideNumber: i,
      role: 'breakdown',
      headline,
      headlineColorMap: [
        { text: headlineWords.slice(0, headlineHalf).join(' '), color: 'accent1' },
        { text: headlineWords.slice(headlineHalf).join(' '), color: 'primary' },
      ],
      subtext,
      visualElement: visualVariants[i % visualVariants.length],
      visualPosition: 'top',
      mood: format.visualTone,
      narrativeNote: `Slide ${i} of the breakdown`,
    });
  }

  slides.push({
    slideNumber: count,
    role: 'cta',
    headline: 'FOLLOW FOR DAILY INSIGHTS',
    headlineColorMap: [
      { text: 'FOLLOW FOR', color: 'primary' },
      { text: 'DAILY INSIGHTS', color: 'accent1' },
    ],
    subtext: 'Canadian finance, no hype — @thestatsandstacks',
    visualElement: 'hyper-realistic photography of a sleek, dark marble surface reflecting a subtle upward green arrow projection, highly professional and authoritative',
    visualPosition: 'center',
    mood: 'confident and inviting',
    narrativeNote: 'CTA — drive follows and saves',
  });

  return { slides };
}
