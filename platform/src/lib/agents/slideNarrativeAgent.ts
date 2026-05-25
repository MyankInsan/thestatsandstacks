import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import type { StrategyDecision } from './contentStrategyAgent';
import type { FormatDecision } from './formatStyleAgent';
import type { ViralStyle } from './promptLibrary';

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
  visualStyle: ViralStyle;
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
- Slide 2: Agitator / Secondary Hook — deepen the problem or expand the hook.
- Middle slides: Implement the PAS (Problem-Agitate-Solve) framework. EVERY middle slide MUST end with an "Open Loop" transition (e.g. "But here is the catch ->", "Which leads to the next step ->").
- Penultimate Slide: The Summary/Cheat-sheet. A highly savable bulleted list.
- Last slide: Always role "cta" — strong follow/save prompt for @thestatsandstacks
- Each headline: max 8 words, bold and punchy
- headlineColorMap: break headline into parts, assign each part a color (primary=white, accent1=neon, accent2=cyan/secondary)
- visualStyle: YOU MUST ASSIGN A DIFFERENT VISUAL STYLE TO EACH SLIDE based on its role. Choose EXACTLY ONE from this list of keys:
  Data: LINE_CHART, DONUT_CHART, BAR_CHART_HORIZONTAL, SANKEY_DIAGRAM, RADAR_CHART, AREA_CHART, CANDLESTICK_CHART, COMPARISON_TABLE, HEATMAP_GRID, CIRCULAR_PORTFOLIO_WHEEL
  Metaphor: ANIMAL_METAPHOR, NATURE_METAPHOR, LUXURY_LIFESTYLE, TECH_HUD, CHESS_BOARD_STRATEGY, VAULT_SECURITY, SPORTS_RACING, SPACE_EXPLORATION, GAMING_LEVEL_UP, MILITARY_AEROSPACE_METAPHOR, CORPORATE_OFFICE_SPACE
  Human: POP_CULTURE_PORTRAIT, CARICATURE_PORTRAIT, EXPERT_CUTOUT, TRADER_DESK_SILHOUETTE, CROWD_PANIC, EXECUTIVE_LINEUP, LEADER_LOGO_CUTOUTS
  Layout: ARCHITECTURAL_OVERLAY, MINIMALIST_CHECKLIST, GLOWING_QUOTE, NEON_TERMINAL, MAGAZINE_COVER, BILLBOARD_HIGHWAY, FLUID_LIQUID_TEXT, GLASSMORPHISM_UI, GRUNGE_STREET_POSTER
  Mix it up! Do not use the same visualStyle twice in a row.
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
      "visualStyle": "ANIMAL_METAPHOR",
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

const FALLBACK_VISUAL_VARIANTS: Record<string, ViralStyle[]> = {
  PHOTOREALISTIC_NEWS_FLASH:        ['ARCHITECTURAL_OVERLAY', 'CROWD_PANIC', 'MILITARY_AEROSPACE_METAPHOR'],
  PHOTOREALISTIC_LUXURY_LIFESTYLE:  ['LUXURY_LIFESTYLE', 'MAGAZINE_COVER'],
  PHOTOREALISTIC_MARKET_UPDATE:     ['TRADER_DESK_SILHOUETTE', 'LINE_CHART', 'CORPORATE_OFFICE_SPACE'],
  PHOTOREALISTIC_EXPERT_SHOCK:      ['EXPERT_CUTOUT', 'CARICATURE_PORTRAIT', 'EXECUTIVE_LINEUP', 'LEADER_LOGO_CUTOUTS'],
};

function stripBreakdownPrefixes(text: string): string {
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
    visualStyle: visualVariants[0],
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
      visualStyle: visualVariants[i % visualVariants.length],
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
    visualStyle: 'MINIMALIST_CHECKLIST',
    visualPosition: 'center',
    mood: 'confident and inviting',
    narrativeNote: 'CTA — drive follows and saves',
  });

  return { slides };
}
