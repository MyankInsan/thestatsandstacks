import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import type { ContentHistoryEntry } from '../services/contentHistory';
import type { StrategyDecision } from './contentStrategyAgent';
import type { SlotConfig } from './slotConfig';
import { lruPick } from '../services/lruPicker';

export type FormatType =
  | 'PHOTOREALISTIC_NEWS_FLASH'
  | 'PHOTOREALISTIC_LUXURY_LIFESTYLE'
  | 'PHOTOREALISTIC_MARKET_UPDATE'
  | 'PHOTOREALISTIC_EXPERT_SHOCK'
  | 'PHOTOREALISTIC_MINIMAL_TECH'
  | 'MEME_HUMOR';

export const FORMAT_TYPES: FormatType[] = [
  'PHOTOREALISTIC_NEWS_FLASH',
  'PHOTOREALISTIC_LUXURY_LIFESTYLE',
  'PHOTOREALISTIC_MARKET_UPDATE',
  'PHOTOREALISTIC_EXPERT_SHOCK',
  'PHOTOREALISTIC_MINIMAL_TECH',
  'MEME_HUMOR',
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
  MEME_HUMOR:                       { bg: '#09090D', primaryText: '#FFFFFF', accent1: '#FFD700', accent2: '#FF2E93' },
};

export interface FormatStyleInput {
  strategy: StrategyDecision;
  contentHistory: ContentHistoryEntry[];
  tickerSymbols: string[];
  slot?: SlotConfig;
  todayPriorEntries?: ContentHistoryEntry[];
}

export class FormatStyleAgent {
  async execute(input: FormatStyleInput): Promise<FormatDecision> {
    const assignedFormat = pickFormat(input);
    const prompt = buildPrompt(input.strategy, assignedFormat, input.tickerSymbols);

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(text) as { visualTone: string; reasoning: string };

      return {
        formatType: assignedFormat,
        slideCount: input.strategy.slideCount,
        colorScheme: COLOR_SCHEMES[assignedFormat],
        visualTone: parsed.visualTone || 'dramatic, bold, high-energy',
        reasoning: parsed.reasoning || '',
      };
    } catch {
      return buildFallback(assignedFormat, input.strategy);
    }
  }
}

function pickFormat(input: FormatStyleInput): FormatType {
  const todayUsedFormats = (input.todayPriorEntries ?? [])
    .map((e) => e.formatType as FormatType)
    .filter((f): f is FormatType => FORMAT_TYPES.includes(f));

  let candidates: FormatType[];
  if (input.slot) {
    candidates = input.slot.allowedFormats.filter((f) => !todayUsedFormats.includes(f));
    if (candidates.length === 0) candidates = input.slot.allowedFormats;
  } else {
    candidates = FORMAT_TYPES.filter((f) => !todayUsedFormats.includes(f));
    if (candidates.length === 0) candidates = [...FORMAT_TYPES];
  }

  const recentCovers = input.contentHistory
    .slice(-10)
    .map((e) => e.formatType as FormatType)
    .filter((f): f is FormatType => FORMAT_TYPES.includes(f));

  const picked = lruPick(candidates, recentCovers, 20);
  return picked ?? candidates[0] ?? FORMAT_TYPES[0];
}

function buildPrompt(strategy: StrategyDecision, assignedFormat: string, tickers: string[]): string {
  return `You are a viral finance Instagram content strategist. We are using a slot-aware visual format selection.

TODAY'S TOPIC: ${strategy.topic}
HOOK: ${strategy.hook}
TICKERS IN NEWS: ${tickers.join(', ') || 'none'}

ASSIGNED FORMAT FOR THIS SLOT: ${assignedFormat}
(Do not change this. Just return the visual tone and reasoning.)

Return ONLY valid JSON, no markdown fences:
{"visualTone":"urgent, hyper-realistic, breaking news","reasoning":"NVDA earnings news warrants dramatic photorealistic news flash."}`;
}

function buildFallback(assignedFormat: FormatType, strategy: StrategyDecision): FormatDecision {
  return {
    formatType: assignedFormat,
    slideCount: strategy.slideCount,
    colorScheme: COLOR_SCHEMES[assignedFormat],
    visualTone: assignedFormat === 'MEME_HUMOR' ? 'satirical, humorous, high-contrast, eye-catching financial meme' : 'dramatic, hyper-realistic, cinematic finance content',
    reasoning: 'Fallback — Gemini unavailable',
  };
}
