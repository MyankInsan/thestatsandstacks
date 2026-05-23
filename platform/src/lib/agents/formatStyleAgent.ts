import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import type { ContentHistoryEntry } from '../services/contentHistory';
import type { StrategyDecision } from './contentStrategyAgent';

export type FormatType =
  | 'BREAKING_NEWS'
  | 'HUMOR_MEME'
  | 'DATA_SHOCK'
  | 'CEO_AUTHORITY'
  | 'EDUCATIONAL_CAROUSEL'
  | 'HOT_TAKE'
  | 'MARKET_SCOREBOARD'
  | 'MYTH_VS_FACT';

export const FORMAT_TYPES: FormatType[] = [
  'BREAKING_NEWS', 'HUMOR_MEME', 'DATA_SHOCK', 'CEO_AUTHORITY',
  'EDUCATIONAL_CAROUSEL', 'HOT_TAKE', 'MARKET_SCOREBOARD', 'MYTH_VS_FACT',
];

export interface ColorScheme {
  bg: string;
  primaryText: string;
  accent1: string;
  accent2: string;
}

export interface FormatDecision {
  formatType: FormatType;
  slideCount: number;
  colorScheme: ColorScheme;
  visualTone: string;
  reasoning: string;
}

export const COLOR_SCHEMES: Record<FormatType, ColorScheme> = {
  BREAKING_NEWS:        { bg: '#000000', primaryText: '#FFFFFF', accent1: '#39FF14', accent2: '#00CFFF' },
  HUMOR_MEME:           { bg: '#0D0D0D', primaryText: '#FFFFFF', accent1: '#FF4500', accent2: '#FFD700' },
  DATA_SHOCK:           { bg: '#020617', primaryText: '#FFFFFF', accent1: '#00FF87', accent2: '#FFFFFF' },
  CEO_AUTHORITY:        { bg: '#0A0A0A', primaryText: '#FFFFFF', accent1: '#FFD700', accent2: '#FFFFFF' },
  EDUCATIONAL_CAROUSEL: { bg: '#050510', primaryText: '#FFFFFF', accent1: '#6366F1', accent2: '#22D3EE' },
  HOT_TAKE:             { bg: '#1A0000', primaryText: '#FFFFFF', accent1: '#FF3B30', accent2: '#FFFFFF' },
  MARKET_SCOREBOARD:    { bg: '#000000', primaryText: '#FFFFFF', accent1: '#00FF87', accent2: '#FF3B30' },
  MYTH_VS_FACT:         { bg: '#080808', primaryText: '#FFFFFF', accent1: '#FF3B30', accent2: '#39FF14' },
};

export class FormatStyleAgent {
  async execute(input: {
    strategy: StrategyDecision;
    contentHistory: ContentHistoryEntry[];
    tickerSymbols: string[];
  }): Promise<FormatDecision> {
    const recentTypes = input.contentHistory
      .slice(-3)
      .map(e => e.formatType)
      .filter((t): t is string => Boolean(t));

    const prompt = buildPrompt(input.strategy, recentTypes, input.tickerSymbols);

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(text) as {
        formatType: FormatType;
        slideCount: number;
        visualTone: string;
        reasoning: string;
      };

      const formatType = FORMAT_TYPES.includes(parsed.formatType) ? parsed.formatType : fallbackType(recentTypes);
      return {
        formatType,
        slideCount: Math.min(9, Math.max(6, Number(parsed.slideCount) || 7)),
        colorScheme: COLOR_SCHEMES[formatType],
        visualTone: parsed.visualTone || 'dramatic, bold, high-energy',
        reasoning: parsed.reasoning || '',
      };
    } catch {
      return buildFallback(recentTypes);
    }
  }
}

function buildPrompt(strategy: StrategyDecision, recentTypes: string[], tickers: string[]): string {
  return `You are a viral finance Instagram content strategist. Pick the best visual format for today's post.

TODAY'S TOPIC: ${strategy.topic}
HOOK: ${strategy.hook}
TICKERS IN NEWS: ${tickers.join(', ') || 'none'}
RECENT FORMATS USED (do NOT repeat): ${recentTypes.join(', ') || 'none'}

AVAILABLE FORMATS — pick exactly one you haven't used recently:
- BREAKING_NEWS: Real market event today. "JUST IN:" urgency. Bold dark poster style.
- HUMOR_MEME: Markets did something absurd or ironic. Illustrated cartoon character. Relatable humor.
- DATA_SHOCK: Massive number to reveal — ATH, ATL, record earnings. Pure stat as hero.
- CEO_AUTHORITY: Company milestone or CEO quote. Portrait + logo + achievement.
- EDUCATIONAL_CAROUSEL: Complex concept needing step-by-step explanation. Clean numbered breakdown.
- HOT_TAKE: Contrarian market view that surprises. Bold opinion statement on gradient.
- MARKET_SCOREBOARD: Multiple tickers moving significantly today. Grid of ticker cards.
- MYTH_VS_FACT: Common financial misconception to bust. Split-screen contrast.

SLIDE COUNT: 6 (simple), 7-8 (multi-angle story), 9 (deep educational only)

Return ONLY valid JSON, no markdown fences:
{"formatType":"BREAKING_NEWS","slideCount":7,"visualTone":"urgent and dramatic — shocked trader at terminal","reasoning":"NVDA earnings is a real breaking event"}`;
}

function fallbackType(recentTypes: string[]): FormatType {
  const recent = new Set(recentTypes);
  return FORMAT_TYPES.find(t => !recent.has(t)) ?? 'EDUCATIONAL_CAROUSEL';
}

function buildFallback(recentTypes: string[]): FormatDecision {
  const formatType = fallbackType(recentTypes);
  return {
    formatType,
    slideCount: 7,
    colorScheme: COLOR_SCHEMES[formatType],
    visualTone: 'dramatic, bold, high-energy finance content',
    reasoning: 'Fallback — Gemini unavailable',
  };
}
