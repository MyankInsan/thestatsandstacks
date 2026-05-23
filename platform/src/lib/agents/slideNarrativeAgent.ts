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
- visualElement: describe a SPECIFIC scene (e.g. "shocked young man in business casual staring at phone, mouth open, three green monitors behind him, dramatic side lighting") — not vague like "person"
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
      "visualElement": "shocked young man in business casual sitting at trading desk, mouth agape, three monitors showing green candles, dramatic rim lighting from the left",
      "visualPosition": "top",
      "mood": "urgent, high-energy, breaking news",
      "narrativeNote": "Opens with the hook — sets up the big reveal in slide 2"
    }
  ]
}`;
}

const FALLBACK_EYEBROWS: Record<string, string> = {
  BREAKING_NEWS:        'JUST IN:',
  DATA_SHOCK:           'THE NUMBERS:',
  CEO_AUTHORITY:        'KEY INSIGHT:',
  EDUCATIONAL_CAROUSEL: 'STEP:',
  HOT_TAKE:             'HOT TAKE:',
  MARKET_SCOREBOARD:    'MARKET UPDATE:',
  MYTH_VS_FACT:         'MYTH BUSTED:',
  HUMOR_MEME:           'REAL TALK:',
};

const FALLBACK_VISUAL_VARIANTS: Record<string, string[]> = {
  BREAKING_NEWS: [
    'shocked trader in business casual at standing desk, multiple green monitors in background, dramatic overhead lighting',
    'close-up of hands gripping edge of a trading desk, ultrawide monitor showing a steep candlestick chart, harsh side lighting',
    'wide shot of empty trading floor at night with rows of glowing screens, dramatic green light casting long shadows',
    'over-the-shoulder view of analyst staring at dual monitors with candlestick charts, tense atmosphere, dark office',
  ],
  HUMOR_MEME: [
    'cartoon-style illustrated investor character with wide eyes and sweat drops, wearing a suit and holding a phone showing green numbers, comic-book style rendering',
    'illustrated investor character doing a shocked double-take at a tiny chart blip, comedic proportions, bold comic-book rendering',
    'cartoon dog in suit calmly drinking coffee while everything around it burns, meme-style flat illustration',
    'illustrated character with steam coming from ears, sitting at a melting computer, comic exaggeration, bold flat colors',
  ],
  DATA_SHOCK: [
    'abstract glowing number display floating in dark space with radiant light beams emanating outward, futuristic data visualization style',
    'massive illuminated percentage figure suspended in a dark void, surrounded by cascading data streams, cinematic render',
    'holographic bar chart erupting upward from a dark surface, neon glow, dramatic data visualization, no text',
    'close-up of a digital display showing a dramatic number, reflective dark surface, neon rim lighting',
  ],
  CEO_AUTHORITY: [
    'confident executive in dark suit standing against blurred city skyline at night, single key light from above, authoritative posture',
    'silhouette of executive looking out floor-to-ceiling window over a glowing city at night, power stance, dark interior',
    'close-up of executive hands resting on a polished boardroom table, luxury details softly blurred in background',
    'executive at a podium with dramatic stage lighting, confident expression, implied audience, dark background',
  ],
  EDUCATIONAL_CAROUSEL: [
    'clean organized desk setup from above — laptop, notebook with numbered list, coffee cup, soft natural window light',
    'minimalist white desk with open notebook and hand-drawn diagram, single pen, clean negative space, top-down view',
    'flat-lay of a financial planning setup — calculator, printed chart, coffee, clean professional aesthetic',
    'over-the-shoulder view of someone writing in a structured notebook, financial book open beside it, warm desk lamp',
  ],
  HOT_TAKE: [
    'lone figure in dark silhouette standing at edge of skyscraper rooftop at dawn, city lights below, dramatic atmospheric shot',
    'bold close-up of someone pointing directly at camera, slight smirk, dark dramatic studio backdrop',
    'dramatic low-angle shot of a single person standing in an empty arena, spotlight from above, strong shadow',
    'side-lit portrait of confident person mid-speech, dark background, strong rim light from one side',
  ],
  MARKET_SCOREBOARD: [
    'wall of illuminated ticker displays in a dark trading floor, multiple screens showing green and red numbers, Bloomberg terminal aesthetic',
    'massive LED scoreboard-style display in a dark hall, multiple tickers glowing in green and red, dramatic wide shot',
    'close-up of a Reuters terminal screen with cascading price feeds, reflected in a polished dark desk surface',
    'overhead drone shot of a trading floor, dozens of analyst workstations lit by glowing screens, organized energy',
  ],
  MYTH_VS_FACT: [
    'split composition — left side shows a broken clock in warm red tones, right side shows a precise compass in cool green tones',
    'split-screen image — left shows crumpled money in harsh red light, right shows organized bills in cool blue light',
    'diptych — left half shows tangled strings in warm chaotic light, right half shows a clean straight line in cool calm light',
    'split view — left side blurry and warm-toned, right side sharp and cool-toned, strong visual contrast',
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
  const visualVariants = FALLBACK_VISUAL_VARIANTS[format.formatType] ?? FALLBACK_VISUAL_VARIANTS.BREAKING_NEWS;

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
