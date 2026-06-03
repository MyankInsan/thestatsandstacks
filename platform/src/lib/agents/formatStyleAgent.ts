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

/**
 * Palette bank — multiple on-brand schemes per format so the FEED rotates colour
 * instead of reading as black + one accent every post. The first entry of each
 * bank is the canonical COLOR_SCHEMES default; alternates preserve the format's
 * light/dark intent and 7:1 contrast. Light-mode detection is luminance-based
 * (`isLightBackground`) so a light alternate with a non-#F8F9FA bg still adapts.
 */
export const PALETTE_BANK: Record<FormatType, ColorScheme[]> = {
  PHOTOREALISTIC_NEWS_FLASH: [
    COLOR_SCHEMES.PHOTOREALISTIC_NEWS_FLASH,
    { bg: '#0B0F14', primaryText: '#FFFFFF', accent1: '#00CFFF', accent2: '#FFB000' },
    { bg: '#0A0A0A', primaryText: '#FFFFFF', accent1: '#FF3B30', accent2: '#FFFFFF' },
  ],
  PHOTOREALISTIC_LUXURY_LIFESTYLE: [
    COLOR_SCHEMES.PHOTOREALISTIC_LUXURY_LIFESTYLE,
    { bg: '#0E0B08', primaryText: '#F5EFE6', accent1: '#E8C9A0', accent2: '#C9A227' },
    { bg: '#0B0E0C', primaryText: '#F2F2F0', accent1: '#7FB08A', accent2: '#D8C7A0' },
  ],
  PHOTOREALISTIC_MARKET_UPDATE: [
    COLOR_SCHEMES.PHOTOREALISTIC_MARKET_UPDATE,
    { bg: '#0B0F14', primaryText: '#FFFFFF', accent1: '#00E0A4', accent2: '#FF6B6B' },
    { bg: '#0A0A0A', primaryText: '#FFFFFF', accent1: '#FFB000', accent2: '#00CFFF' },
  ],
  PHOTOREALISTIC_EXPERT_SHOCK: [
    COLOR_SCHEMES.PHOTOREALISTIC_EXPERT_SHOCK,
    { bg: '#0A0A0A', primaryText: '#FFFFFF', accent1: '#FFD700', accent2: '#FF3B30' },
    { bg: '#0B0F14', primaryText: '#FFFFFF', accent1: '#00CFFF', accent2: '#FFD700' },
  ],
  PHOTOREALISTIC_MINIMAL_TECH: [
    COLOR_SCHEMES.PHOTOREALISTIC_MINIMAL_TECH,
    { bg: '#F4F1EA', primaryText: '#1A1A1A', accent1: '#B0341E', accent2: '#6B6B6B' },
    { bg: '#FFFFFF', primaryText: '#0F172A', accent1: '#0E7C66', accent2: '#475569' },
  ],
  MEME_HUMOR: [
    COLOR_SCHEMES.MEME_HUMOR,
    { bg: '#0A0A0A', primaryText: '#FFFFFF', accent1: '#FF2E93', accent2: '#00CFFF' },
    { bg: '#0E0B08', primaryText: '#FFF7E6', accent1: '#FFB000', accent2: '#FF3B30' },
  ],
};

/** Relative-luminance light/dark test (replaces the brittle `=== '#f8f9fa'`). */
export function isLightBackground(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  // Perceived luminance (sRGB-ish), 0..1. >0.6 ⇒ treat as a light background.
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
}

function paletteKey(scheme: ColorScheme): string {
  return `${scheme.bg}|${scheme.accent1}|${scheme.accent2}`.toLowerCase();
}

/**
 * LRU-rotate the colour scheme for a format using the persisted `colorSchemeUsed`
 * history (and any same-day prior posts) so the same palette doesn't repeat
 * back-to-back or dominate the feed. Falls back to the format default.
 */
export function pickColorScheme(
  formatType: FormatType,
  contentHistory: ContentHistoryEntry[] = [],
  todayPriorEntries: ContentHistoryEntry[] = [],
): ColorScheme {
  const bank = PALETTE_BANK[formatType] ?? [COLOR_SCHEMES[formatType]];
  if (bank.length <= 1) return bank[0] ?? COLOR_SCHEMES[formatType];

  const recentKeys = [...contentHistory.slice(-12), ...todayPriorEntries]
    .map((e) => e.colorSchemeUsed)
    .filter((c): c is NonNullable<ContentHistoryEntry['colorSchemeUsed']> => Boolean(c))
    .map((c) => `${c.bg}|${c.accent1}|${c.accent2}`.toLowerCase());

  const byKey = new Map(bank.map((p) => [paletteKey(p), p]));
  const pickedKey = lruPick(bank.map(paletteKey), recentKeys, 24);
  const picked = pickedKey ? byKey.get(pickedKey) : undefined;
  return picked ?? bank[0];
}

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
    const colorScheme = pickColorScheme(assignedFormat, input.contentHistory, input.todayPriorEntries ?? []);
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
        colorScheme,
        visualTone: parsed.visualTone || 'dramatic, bold, high-energy',
        reasoning: parsed.reasoning || '',
      };
    } catch {
      return buildFallback(assignedFormat, input.strategy, colorScheme);
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

function buildFallback(assignedFormat: FormatType, strategy: StrategyDecision, colorScheme: ColorScheme = COLOR_SCHEMES[assignedFormat]): FormatDecision {
  return {
    formatType: assignedFormat,
    slideCount: strategy.slideCount,
    colorScheme,
    visualTone: assignedFormat === 'MEME_HUMOR' ? 'satirical, humorous, high-contrast, eye-catching financial meme' : 'dramatic, hyper-realistic, cinematic finance content',
    reasoning: 'Fallback — Gemini unavailable',
  };
}
