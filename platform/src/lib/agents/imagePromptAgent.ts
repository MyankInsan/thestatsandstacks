import { BaseAgent } from './interfaces';
import { StrategyDecision } from './contentStrategyAgent';

export interface ImagePromptSet {
  prompts: Array<{
    slideNumber: number;
    slideDescription: string;
    dallePrompt: string;
  }>;
}

export class ImagePromptAgent extends BaseAgent {
  constructor() {
    super('ImagePromptAgent');
  }

  async execute(input: { strategy: StrategyDecision }): Promise<ImagePromptSet> {
    console.log(`[${this.name}] 🎨 Generating image prompts...`);

    return {
      prompts: input.strategy.slideBreakdown.map((slide, index) => ({
        slideNumber: index + 1,
        slideDescription: slide,
        dallePrompt: buildPremiumImagePrompt(input.strategy, slide, index + 1),
      })),
    };
  }
}

function buildPremiumImagePrompt(strategy: StrategyDecision, slide: string, slideNumber: number): string {
  const isCover = slideNumber === 1;
  const visualMode = getVisualMode(strategy.format, strategy.topic, slideNumber);

  return [
    'Create a premium editorial finance background for an Instagram portrait carousel slide.',
    'IMPORTANT: no words, no letters, no numbers, no logos, no charts with readable labels. Leave all typography to a later overlay.',
    `Brand: TheStatsAndStacks, high-trust Canadian finance, data-first, calm and sophisticated.`,
    `Topic: ${strategy.topic}. Slide intent: ${slide}.`,
    `Composition: ${isCover ? 'strong cover-worthy focal point with structured visual density and no dead zones' : 'supporting visual with clear open zones for headline and bullet overlays, balanced density, and no empty-looking corners'}.`,
    `Visual direction: ${visualMode}.`,
    'Reference mood: high-performing finance creator content that is simple, original, and saveable, but do not copy any creator layout, brand, screenshot, or post.',
    'Palette: deep charcoal, graphite, emerald accents, muted gold highlights, confident off-white contrast, occasional cool cyan or violet only as secondary contrast.',
    'Style: premium magazine infographic background, realistic paper/glass texture, subtle market-grid geometry, crisp lighting, high contrast, no clutter, no meme style, no generic corporate stock-photo feel.',
    'Mobile readability: keep the center-left and lower third visually calm so exact text can be overlaid cleanly.',
    'Compliance: no fake price candles, no fake performance claims, no specific ticker recommendation visuals, no guaranteed-return symbolism.',
  ].join(' ');
}

function getVisualMode(format: StrategyDecision['format'], topic: string, slideNumber: number): string {
  const lower = topic.toLowerCase();
  if (/sandisk|sndk|ai storage|nand|memory|semiconductor|data center|datacenter/.test(lower)) {
    return slideNumber % 2 === 0
      ? 'AI infrastructure research desk with abstract storage-stack modules, NAND wafer geometry, catalyst cards, and risk-meter depth'
      : 'premium semiconductor market terminal with abstract memory blocks, watchlist tiles, glowing data-center grid, and disciplined risk-map energy';
  }
  if (format === 'WATCHLIST_EDUCATION') {
    return slideNumber % 2 === 0
      ? 'analyst desk with abstract watchlist cards, risk gauge shapes, and layered market-screen depth'
      : 'premium research terminal mood with abstract company tiles, checklist geometry, and calm risk-map energy';
  }
  if (lower.includes('credit')) {
    return 'credit-report lab aesthetic with clean verification marks, document texture, and myth/fact contrast';
  }
  if (lower.includes('payday') || lower.includes('money leak')) {
    return 'cash-flow operating system aesthetic with envelope layers, routing paths, and subtle automation cues';
  }
  if (lower.includes('tfsa') || lower.includes('rrsp') || lower.includes('fhsa')) {
    return 'Canadian account map aesthetic with three abstract account vaults and decision-tree structure';
  }
  if (lower.includes('tax')) {
    return 'tax checklist desk aesthetic with organized document layers and understated calendar cues';
  }
  return 'clean financial decision framework with layered data panels, soft depth, and modern editorial polish';
}
