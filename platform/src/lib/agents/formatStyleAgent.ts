import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import type { ContentHistoryEntry } from '../services/contentHistory';
import type { StrategyDecision } from './contentStrategyAgent';

export type FormatType =
  | 'PHOTOREALISTIC_NEWS_FLASH'
  | 'PHOTOREALISTIC_LUXURY_LIFESTYLE'
  | 'PHOTOREALISTIC_MARKET_UPDATE'
  | 'PHOTOREALISTIC_EXPERT_SHOCK'
  | 'PHOTOREALISTIC_MINIMAL_TECH';

export const FORMAT_TYPES: FormatType[] = [
  'PHOTOREALISTIC_NEWS_FLASH', 
  'PHOTOREALISTIC_LUXURY_LIFESTYLE', 
  'PHOTOREALISTIC_MARKET_UPDATE', 
  'PHOTOREALISTIC_EXPERT_SHOCK',
  'PHOTOREALISTIC_MINIMAL_TECH'
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
  PHOTOREALISTIC_MINIMAL_TECH:      { bg: '#F8F9FA', primaryText: '#111827', accent1: '#2563EB', accent2: '#4B5563' },
};

export class FormatStyleAgent {
  async execute(input: {
    strategy: StrategyDecision;
    contentHistory: ContentHistoryEntry[];
    tickerSymbols: string[];
  }): Promise<FormatDecision> {
    const dayOfYear = Math.floor(Date.now() / 86400000);
    const assignedFormat = FORMAT_TYPES[dayOfYear % 5];

    const prompt = buildPrompt(input.strategy, assignedFormat, input.tickerSymbols);

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(text) as {
        visualTone: string;
        reasoning: string;
      };

      return {
        formatType: assignedFormat,
        slideCount: input.strategy.slideCount,
        colorScheme: COLOR_SCHEMES[assignedFormat],
        visualTone: parsed.visualTone || 'dramatic, bold, high-energy',
        reasoning: parsed.reasoning || '',
      };
    } catch (err) {
      return buildFallback(assignedFormat, input.strategy);
    }
  }
}

function buildPrompt(strategy: StrategyDecision, assignedFormat: string, tickers: string[]): string {
  return `You are a viral finance Instagram content strategist. We are using a strictly rotating daily visual format.

TODAY'S TOPIC: ${strategy.topic}
HOOK: ${strategy.hook}
TICKERS IN NEWS: ${tickers.join(', ') || 'none'}

MANDATORY FORMAT FOR TODAY: ${assignedFormat}
(Do not change this format. Just return it in your thought process).

SLIDE COUNT: 6 (simple), 7-8 (multi-angle story), 9 (deep educational only)

Return ONLY valid JSON, no markdown fences:
{"visualTone":"urgent, hyper-realistic, breaking news","reasoning":"Trump news requires a dramatic photorealistic news flash format."}`;
}

function buildFallback(assignedFormat: FormatType, strategy: StrategyDecision): FormatDecision {
  return {
    formatType: assignedFormat,
    slideCount: strategy.slideCount,
    colorScheme: COLOR_SCHEMES[assignedFormat],
    visualTone: 'dramatic, hyper-realistic, cinematic finance content',
    reasoning: 'Fallback — Gemini unavailable',
  };
}
