import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import type { ContentHistoryEntry } from '../services/contentHistory';
import type { StrategyDecision } from './contentStrategyAgent';

export type FormatType =
  | 'BAR_CHART_INFOGRAPHIC'
  | 'VS_COMPARISON_INFOGRAPHIC'
  | 'PYRAMID_WEALTH_INFOGRAPHIC'
  | 'CHECKLIST_INFOGRAPHIC'
  | 'FLOWCHART_INFOGRAPHIC';

export const FORMAT_TYPES: FormatType[] = [
  'BAR_CHART_INFOGRAPHIC', 'VS_COMPARISON_INFOGRAPHIC', 'PYRAMID_WEALTH_INFOGRAPHIC',
  'CHECKLIST_INFOGRAPHIC', 'FLOWCHART_INFOGRAPHIC',
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
  BAR_CHART_INFOGRAPHIC:       { bg: '#000000', primaryText: '#FFFFFF', accent1: '#39FF14', accent2: '#00CFFF' },
  VS_COMPARISON_INFOGRAPHIC:   { bg: '#000000', primaryText: '#FFFFFF', accent1: '#FF3B30', accent2: '#39FF14' },
  PYRAMID_WEALTH_INFOGRAPHIC:  { bg: '#000000', primaryText: '#FFFFFF', accent1: '#FFD700', accent2: '#FFFFFF' },
  CHECKLIST_INFOGRAPHIC:       { bg: '#000000', primaryText: '#FFFFFF', accent1: '#00FF87', accent2: '#FFFFFF' },
  FLOWCHART_INFOGRAPHIC:       { bg: '#000000', primaryText: '#FFFFFF', accent1: '#6366F1', accent2: '#22D3EE' },
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
- BAR_CHART_INFOGRAPHIC: Flat black background, horizontal neon bars ranking data, with an illustrated mascot in the corner.
- VS_COMPARISON_INFOGRAPHIC: Split layout comparing two concepts (e.g. Red vs Green, Myth vs Fact).
- PYRAMID_WEALTH_INFOGRAPHIC: A large tiered pyramid showing hierarchy or asset allocation.
- CHECKLIST_INFOGRAPHIC: Massive bold checkmarks with concise text steps.
- FLOWCHART_INFOGRAPHIC: Winding neon path showing a process or compounding over time.

SLIDE COUNT: 6 (simple), 7-8 (multi-angle story), 9 (deep educational only)

Return ONLY valid JSON, no markdown fences:
{"formatType":"BAR_CHART_INFOGRAPHIC","slideCount":7,"visualTone":"bold data-driven graphic","reasoning":"Comparing tech stock returns is perfect for a bar chart"}`;
}

function fallbackType(recentTypes: string[]): FormatType {
  const recent = new Set(recentTypes);
  return FORMAT_TYPES.find(t => !recent.has(t)) ?? 'BAR_CHART_INFOGRAPHIC';
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
