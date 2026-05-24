import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import type { ContentHistoryEntry } from '../services/contentHistory';
import type { StrategyDecision } from './contentStrategyAgent';

export type FormatType =
  | 'PHOTOREALISTIC_NEWS_FLASH'
  | 'PHOTOREALISTIC_LUXURY_LIFESTYLE'
  | 'PHOTOREALISTIC_MARKET_UPDATE'
  | 'PHOTOREALISTIC_EXPERT_SHOCK';

export const FORMAT_TYPES: FormatType[] = [
  'PHOTOREALISTIC_NEWS_FLASH', 'PHOTOREALISTIC_LUXURY_LIFESTYLE', 'PHOTOREALISTIC_MARKET_UPDATE', 'PHOTOREALISTIC_EXPERT_SHOCK',
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
  PHOTOREALISTIC_NEWS_FLASH:        { bg: '#050505', primaryText: '#FFFFFF', accent1: '#39FF14', accent2: '#00CFFF' },
  PHOTOREALISTIC_LUXURY_LIFESTYLE:  { bg: '#0A0A0A', primaryText: '#FFFFFF', accent1: '#FFD700', accent2: '#FFFFFF' },
  PHOTOREALISTIC_MARKET_UPDATE:     { bg: '#050505', primaryText: '#FFFFFF', accent1: '#FF3B30', accent2: '#39FF14' },
  PHOTOREALISTIC_EXPERT_SHOCK:      { bg: '#000000', primaryText: '#FFFFFF', accent1: '#FF3B30', accent2: '#FFD700' },
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
    } catch (err) {
      console.warn('[FormatStyleAgent] Gemini failed, using fallback.', err instanceof Error ? err.message : String(err));
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
- PHOTOREALISTIC_NEWS_FLASH: Hyper-realistic breaking news aesthetic, featuring public figures, politicians, or major CEOs, dramatic cinematic lighting.
- PHOTOREALISTIC_LUXURY_LIFESTYLE: Hyper-realistic luxury aesthetic, featuring high-end items (watches, supercars, mansions, private jets) communicating wealth.
- PHOTOREALISTIC_MARKET_UPDATE: Hyper-realistic trading desk, glowing green/red screens, high-stress or highly focused trading environment.
- PHOTOREALISTIC_EXPERT_SHOCK: Hyper-realistic portrait of an expert reacting with shock, or a dramatic high-contrast conceptual shot.

SLIDE COUNT: 6 (simple), 7-8 (multi-angle story), 9 (deep educational only)

Return ONLY valid JSON, no markdown fences:
{"formatType":"PHOTOREALISTIC_NEWS_FLASH","slideCount":7,"visualTone":"urgent, hyper-realistic, breaking news","reasoning":"Trump news requires a dramatic photorealistic news flash format."}`;
}

function fallbackType(recentTypes: string[]): FormatType {
  const recent = new Set(recentTypes);
  return FORMAT_TYPES.find(t => !recent.has(t)) ?? 'PHOTOREALISTIC_NEWS_FLASH';
}

function buildFallback(recentTypes: string[]): FormatDecision {
  const formatType = fallbackType(recentTypes);
  return {
    formatType,
    slideCount: 7,
    colorScheme: COLOR_SCHEMES[formatType],
    visualTone: 'dramatic, hyper-realistic, cinematic finance content',
    reasoning: 'Fallback — Gemini unavailable',
  };
}
