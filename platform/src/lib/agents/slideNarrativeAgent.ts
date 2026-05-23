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
    } catch {
      console.warn('[SlideNarrativeAgent] Gemini failed, using fallback.');
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

const FALLBACK_VISUAL_ELEMENTS: Record<string, string> = {
  BREAKING_NEWS: 'shocked trader in business casual at standing desk, multiple green monitors in background, dramatic overhead lighting',
  HUMOR_MEME: 'cartoon-style illustrated investor character with wide eyes and sweat drops, wearing a suit and holding a phone showing green numbers, comic-book style rendering',
  DATA_SHOCK: 'abstract glowing number display floating in dark space with radiant light beams emanating outward, futuristic data visualization style',
  CEO_AUTHORITY: 'confident executive in dark suit standing against blurred city skyline at night, single key light from above, authoritative posture',
  EDUCATIONAL_CAROUSEL: 'clean organized desk setup from above — laptop, notebook with numbered list, coffee cup, soft natural window light',
  HOT_TAKE: 'lone figure in dark silhouette standing at edge of skyscraper rooftop at dawn, city lights below, dramatic atmospheric shot',
  MARKET_SCOREBOARD: 'wall of illuminated ticker displays in a dark trading floor, multiple screens showing various green and red numbers, Bloomberg terminal aesthetic',
  MYTH_VS_FACT: 'split composition — left side shows a broken clock in warm red tones, right side shows a precise compass in cool green tones',
};

function buildFallback(strategy: StrategyDecision, format: FormatDecision): SlideNarrative {
  const count = format.slideCount;
  const topicWords = strategy.topic.toUpperCase().split(' ').slice(0, 3).join(' ');
  const visual = FALLBACK_VISUAL_ELEMENTS[format.formatType] ?? FALLBACK_VISUAL_ELEMENTS.BREAKING_NEWS;

  const slides: SlideSpec[] = [];

  slides.push({
    slideNumber: 1,
    role: 'cover',
    headline: strategy.hook.toUpperCase().split(' ').slice(0, 6).join(' '),
    headlineColorMap: [
      { text: strategy.hook.toUpperCase().split(' ').slice(0, 3).join(' '), color: 'accent1' },
      { text: strategy.hook.toUpperCase().split(' ').slice(3, 6).join(' '), color: 'primary' },
    ],
    eyebrow: 'JUST IN:',
    subtext: `What you need to know about ${strategy.topic}`,
    visualElement: visual,
    visualPosition: 'top',
    mood: format.visualTone,
    narrativeNote: 'Cover hook',
  });

  for (let i = 2; i < count; i++) {
    const breakdown = strategy.slideBreakdown[i - 1] ?? `Point ${i}`;
    slides.push({
      slideNumber: i,
      role: 'breakdown',
      headline: breakdown.toUpperCase().replace(/^slide\s*\d+[:.]\s*/i, '').split(' ').slice(0, 6).join(' '),
      headlineColorMap: [{ text: breakdown.toUpperCase().split(' ').slice(0, 4).join(' '), color: 'primary' }],
      subtext: `Key insight #${i - 1} on ${topicWords}`,
      visualElement: visual,
      visualPosition: 'top',
      mood: format.visualTone,
      narrativeNote: `Slide ${i} of the breakdown`,
    });
  }

  slides.push({
    slideNumber: count,
    role: 'cta',
    headline: 'FOLLOW FOR DAILY',
    headlineColorMap: [
      { text: 'FOLLOW FOR', color: 'primary' },
      { text: 'DAILY', color: 'accent1' },
    ],
    subtext: 'Canadian finance, no hype — @thestatsandstacks',
    visualElement: 'clean dark background with a subtle upward bar chart icon glowing in the center, minimalist and authoritative',
    visualPosition: 'center',
    mood: 'confident and inviting',
    narrativeNote: 'CTA — drive follows and saves',
  });

  return { slides };
}
