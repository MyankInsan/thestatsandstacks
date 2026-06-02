import type { AngleId } from './topicAngleAgent';
import type { ViralStyle } from './promptLibrary';

export type Bucket = 'Data' | 'Metaphor' | 'Human' | 'Layout';

export const STYLE_BUCKETS: Record<string, Bucket> = {
  LINE_CHART: 'Data', DONUT_CHART: 'Data', BAR_CHART_HORIZONTAL: 'Data',
  SANKEY_DIAGRAM: 'Data', RADAR_CHART: 'Data', AREA_CHART: 'Data',
  CANDLESTICK_CHART: 'Data', COMPARISON_TABLE: 'Data', HEATMAP_GRID: 'Data',
  CIRCULAR_PORTFOLIO_WHEEL: 'Data',
  CANDLESTICK_HERO: 'Data', CANDLESTICK_PATTERN_ANNOTATED: 'Data',
  TRADING_DESK_OVERLAY: 'Data', INSTITUTIONAL_FLOW_SANKEY: 'Data',
  PORTFOLIO_DOUGHNUT_PORTRAIT: 'Data', CAP_TABLE_GRID: 'Data',
  TICKER_TAPE_HERO: 'Data', EARNINGS_HEAT_TABLE: 'Data',
  POSITION_CONCENTRATION_TREEMAP: 'Data', MACRO_FLOW_DIAGRAM: 'Data',
  PRICE_TIMELINE_ANNOTATED: 'Data', PORTFOLIO_BAR_RACE: 'Data',
  EARNINGS_CARD: 'Data', MAP_DATA_OVERLAY: 'Data',

  ANIMAL_METAPHOR: 'Metaphor', NATURE_METAPHOR: 'Metaphor',
  LUXURY_LIFESTYLE: 'Metaphor', TECH_HUD: 'Metaphor',
  CHESS_BOARD_STRATEGY: 'Metaphor', VAULT_SECURITY: 'Metaphor',
  SPORTS_RACING: 'Metaphor', SPACE_EXPLORATION: 'Metaphor',
  GAMING_LEVEL_UP: 'Metaphor', MILITARY_AEROSPACE_METAPHOR: 'Metaphor',
  CORPORATE_OFFICE_SPACE: 'Metaphor',

  POP_CULTURE_PORTRAIT: 'Human', CARICATURE_PORTRAIT: 'Human',
  EXPERT_CUTOUT: 'Human', TRADER_DESK_SILHOUETTE: 'Human',
  CROWD_PANIC: 'Human', EXECUTIVE_LINEUP: 'Human',
  LEADER_LOGO_CUTOUTS: 'Human', EDITORIAL_REACTION_CARICATURE: 'Human',

  ARCHITECTURAL_OVERLAY: 'Layout', MINIMALIST_CHECKLIST: 'Layout',
  GLOWING_QUOTE: 'Layout', NEON_TERMINAL: 'Layout',
  MAGAZINE_COVER: 'Layout', BILLBOARD_HIGHWAY: 'Layout',
  FLUID_LIQUID_TEXT: 'Layout', GLASSMORPHISM_UI: 'Layout',
  GRUNGE_STREET_POSTER: 'Layout', PREMIUM_CTA: 'Layout',
  TYPOGRAPHIC_MEGA_NUMBER: 'Layout', EDITORIAL_SPLIT_LAYOUT: 'Layout',
  REDDIT_POST_SCREENSHOT: 'Layout', TWEET_STOCK_CHART_SPLIT: 'Data', EDITORIAL_STAT_CARD: 'Layout',
};

export const UNTESTED_STYLES = new Set<ViralStyle>([
  'CANDLESTICK_PATTERN_ANNOTATED' as ViralStyle,
  'TRADING_DESK_OVERLAY' as ViralStyle,
  'TICKER_TAPE_HERO' as ViralStyle,
  'POSITION_CONCENTRATION_TREEMAP' as ViralStyle,
  'PORTFOLIO_BAR_RACE' as ViralStyle,
  'EDITORIAL_SPLIT_LAYOUT' as ViralStyle,
  'EARNINGS_CARD' as ViralStyle,
  'MAP_DATA_OVERLAY' as ViralStyle,
  'EDITORIAL_REACTION_CARICATURE' as ViralStyle,
]);

interface AngleVizMapping {
  hero: ViralStyle;
  supporting: ViralStyle[];
}

const ANGLE_VIZ_MAP: Partial<Record<AngleId, AngleVizMapping>> = {
  EARNINGS_REACTION: { hero: 'CANDLESTICK_HERO' as ViralStyle, supporting: ['PRICE_TIMELINE_ANNOTATED' as ViralStyle, 'EARNINGS_CARD' as ViralStyle, 'COMPARISON_TABLE'] },
  F13_DELTA: { hero: 'PORTFOLIO_DOUGHNUT_PORTRAIT' as ViralStyle, supporting: ['CAP_TABLE_GRID' as ViralStyle, 'INSTITUTIONAL_FLOW_SANKEY' as ViralStyle, 'COMPARISON_TABLE'] },
  CAP_TABLE_INSTITUTIONAL: { hero: 'CAP_TABLE_GRID' as ViralStyle, supporting: ['POSITION_CONCENTRATION_TREEMAP' as ViralStyle, 'COMPARISON_TABLE', 'INSTITUTIONAL_FLOW_SANKEY' as ViralStyle] },
  US_GOV_HOLDINGS: { hero: 'PORTFOLIO_DOUGHNUT_PORTRAIT' as ViralStyle, supporting: ['POSITION_CONCENTRATION_TREEMAP' as ViralStyle, 'PORTFOLIO_BAR_RACE' as ViralStyle, 'COMPARISON_TABLE'] },
  POLITICIAN_DISCLOSURES: { hero: 'PORTFOLIO_DOUGHNUT_PORTRAIT' as ViralStyle, supporting: ['CAP_TABLE_GRID' as ViralStyle, 'COMPARISON_TABLE', 'EXPERT_CUTOUT'] },
  INSIDER_CLUSTERS: { hero: 'EARNINGS_HEAT_TABLE' as ViralStyle, supporting: ['TICKER_TAPE_HERO' as ViralStyle, 'COMPARISON_TABLE'] },
  FOUNDER_CONCENTRATION: { hero: 'DONUT_CHART', supporting: ['EXPERT_CUTOUT', 'COMPARISON_TABLE'] },
  CANADIAN_PENSION: { hero: 'PORTFOLIO_BAR_RACE' as ViralStyle, supporting: ['POSITION_CONCENTRATION_TREEMAP' as ViralStyle, 'COMPARISON_TABLE'] },
  SOVEREIGN_WEALTH: { hero: 'INSTITUTIONAL_FLOW_SANKEY' as ViralStyle, supporting: ['CAP_TABLE_GRID' as ViralStyle, 'POSITION_CONCENTRATION_TREEMAP' as ViralStyle, 'MAP_DATA_OVERLAY' as ViralStyle] },
  INDEX_REBALANCE: { hero: 'TICKER_TAPE_HERO' as ViralStyle, supporting: ['HEATMAP_GRID', 'BAR_CHART_HORIZONTAL'] },
  BUYBACK_SCOREBOARD: { hero: 'PORTFOLIO_BAR_RACE' as ViralStyle, supporting: ['EARNINGS_HEAT_TABLE' as ViralStyle, 'COMPARISON_TABLE'] },
  DIVIDEND_KINGS: { hero: 'BAR_CHART_HORIZONTAL', supporting: ['CAP_TABLE_GRID' as ViralStyle, 'COMPARISON_TABLE'] },
  SECTOR_CAP_TABLE: { hero: 'INSTITUTIONAL_FLOW_SANKEY' as ViralStyle, supporting: ['CAP_TABLE_GRID' as ViralStyle, 'COMPARISON_TABLE'] },
  ETF_XRAY: { hero: 'DONUT_CHART', supporting: ['BAR_CHART_HORIZONTAL', 'CAP_TABLE_GRID' as ViralStyle, 'MAP_DATA_OVERLAY' as ViralStyle] },
  HYPOTHETICAL_REVERSAL: { hero: 'TYPOGRAPHIC_MEGA_NUMBER' as ViralStyle, supporting: ['PRICE_TIMELINE_ANNOTATED' as ViralStyle, 'COMPARISON_TABLE', 'LUXURY_LIFESTYLE'] },
  COMPARISON_LADDER: { hero: 'COMPARISON_TABLE', supporting: ['BAR_CHART_HORIZONTAL', 'EDITORIAL_SPLIT_LAYOUT' as ViralStyle, 'MINIMALIST_CHECKLIST'] },
  FEE_TEARDOWN: { hero: 'TYPOGRAPHIC_MEGA_NUMBER' as ViralStyle, supporting: ['LINE_CHART', 'AREA_CHART', 'COMPARISON_TABLE'] },
  TAX_DRAG_MAP: { hero: 'COMPARISON_TABLE', supporting: ['MAP_DATA_OVERLAY' as ViralStyle, 'BAR_CHART_HORIZONTAL', 'MINIMALIST_CHECKLIST'] },
  BEHAVIORAL_RECEIPT: { hero: 'AREA_CHART', supporting: ['LINE_CHART', 'COMPARISON_TABLE', 'GLOWING_QUOTE'] },
  REACTIVE_SENTIMENT: { hero: 'EDITORIAL_REACTION_CARICATURE' as ViralStyle, supporting: ['MACRO_FLOW_DIAGRAM' as ViralStyle, 'GLOWING_QUOTE', 'MINIMALIST_CHECKLIST', 'REDDIT_POST_SCREENSHOT' as ViralStyle, 'TWEET_STOCK_CHART_SPLIT' as ViralStyle] },
  CATALYST_NEWS: { hero: 'ARCHITECTURAL_OVERLAY', supporting: ['LINE_CHART', 'COMPARISON_TABLE', 'TICKER_TAPE_HERO' as ViralStyle, 'REDDIT_POST_SCREENSHOT' as ViralStyle, 'TWEET_STOCK_CHART_SPLIT' as ViralStyle] },
};

export class FinancialVizPicker {
  pickForAngle(input: {
    angleId?: AngleId;
    hasTickers: boolean;
    isReactiveSentiment: boolean;
    excludedStyles: ViralStyle[];
    preferTested?: boolean;
  }): { hero: ViralStyle; supporting: ViralStyle[]; usedFallback: boolean } {
    if (input.isReactiveSentiment) {
      const reactiveSupporting: ViralStyle[] = [
        'MACRO_FLOW_DIAGRAM' as ViralStyle,
        'GLOWING_QUOTE',
        'MINIMALIST_CHECKLIST',
        'REDDIT_POST_SCREENSHOT' as ViralStyle,
        'TWEET_STOCK_CHART_SPLIT' as ViralStyle,
      ];
      return {
        hero: 'EDITORIAL_REACTION_CARICATURE' as ViralStyle,
        supporting: reactiveSupporting.filter((s) => !input.excludedStyles.includes(s)),
        usedFallback: false,
      };
    }

    const mapping = input.angleId ? ANGLE_VIZ_MAP[input.angleId] : undefined;

    if (mapping && !input.excludedStyles.includes(mapping.hero)) {
      const supporting = mapping.supporting.filter((s) => !input.excludedStyles.includes(s));
      const reorderTested = (styles: ViralStyle[]) =>
        input.preferTested ? [...styles].sort((a, b) => Number(UNTESTED_STYLES.has(a)) - Number(UNTESTED_STYLES.has(b))) : styles;
      return { hero: mapping.hero, supporting: reorderTested(supporting), usedFallback: false };
    }

    const fallbackHero: ViralStyle = input.hasTickers ? 'LINE_CHART' : 'BAR_CHART_HORIZONTAL';
    const fallbackSupporting: ViralStyle[] = ['COMPARISON_TABLE', 'DONUT_CHART', 'MINIMALIST_CHECKLIST'];
    return {
      hero: fallbackHero,
      supporting: fallbackSupporting.filter((s) => !input.excludedStyles.includes(s)),
      usedFallback: true,
    };
  }
}
