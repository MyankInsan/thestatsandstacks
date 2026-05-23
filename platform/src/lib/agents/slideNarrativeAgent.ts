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
- visualElement: describe a SPECIFIC, photorealistic scene. MUST be minimalist, modern corporate/architectural photography. NO glowing neon, NO sci-fi, NO robots, NO cartoon expressions. (e.g. "clean, minimalist dark desk surface with a subtly out-of-focus financial newspaper in the background, natural daylight")
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
  BAR_CHART_INFOGRAPHIC:       'RANKING:',
  VS_COMPARISON_INFOGRAPHIC:   'COMPARISON:',
  PYRAMID_WEALTH_INFOGRAPHIC:  'HIERARCHY:',
  CHECKLIST_INFOGRAPHIC:       'CHECKLIST:',
  FLOWCHART_INFOGRAPHIC:       'PROCESS:',
};

const FALLBACK_VISUAL_VARIANTS: Record<string, string[]> = {
  BAR_CHART_INFOGRAPHIC: [
    'solid black background, bold flat infographic, neon green horizontal bars, flat vector illustration of a confident investor in the bottom right corner',
    'solid black background, bold flat infographic, cyan horizontal bars, flat vector illustration of a golden bull in the corner',
    'solid black background, horizontal bar chart layout, negative space for text, flat illustration of Warren Buffett in the corner',
  ],
  VS_COMPARISON_INFOGRAPHIC: [
    'solid black background, flat split-screen infographic layout, left side red theme, right side green theme, vector icons for each side',
    'solid black background, flat split-screen layout, two opposing flat illustrated characters representing good and bad habits',
  ],
  PYRAMID_WEALTH_INFOGRAPHIC: [
    'solid black background, massive flat vector pyramid chart in gold, flat illustrated character standing at the base',
    'solid black background, large tiered hierarchy chart, flat minimalist icons inside each tier, clean layout',
  ],
  CHECKLIST_INFOGRAPHIC: [
    'solid black background, massive neon green checkmarks, negative space for text, flat vector illustration of a character holding a clipboard',
    'solid black background, massive cyan checkmarks on the left, flat vector illustration of a character pointing to the center from the right',
  ],
  FLOWCHART_INFOGRAPHIC: [
    'solid black background, winding glowing neon path, flat minimalist icons at each milestone, negative space for descriptions',
    'solid black background, decision tree flowchart layout, glowing green nodes, clean flat styling',
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
  const visualVariants = FALLBACK_VISUAL_VARIANTS[format.formatType] ?? FALLBACK_VISUAL_VARIANTS.BAR_CHART_INFOGRAPHIC;

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
    visualElement: 'clean dark background with a subtle upward bar chart icon glowing in the center, minimalist and authoritative',
    visualPosition: 'center',
    mood: 'confident and inviting',
    narrativeNote: 'CTA — drive follows and saves',
  });

  return { slides };
}
