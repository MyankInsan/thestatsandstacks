import type { ViralStyle } from './promptLibrary';

export type RecommendedModel = 'seedance' | 'chatgpt_image' | 'either';

const SEEDANCE_PREFERRED: ViralStyle[] = [
  'LUXURY_LIFESTYLE',
  'ANIMAL_METAPHOR',
  'MILITARY_AEROSPACE_METAPHOR',
  'CORPORATE_OFFICE_SPACE',
  'EXPERT_CUTOUT',
  'NATURE_METAPHOR',
  'VAULT_SECURITY',
  'SPACE_EXPLORATION',
  'CHESS_BOARD_STRATEGY',
  'SPORTS_RACING',
  'TRADER_DESK_SILHOUETTE',
  'EXECUTIVE_LINEUP',
  'CARICATURE_PORTRAIT',
  'CROWD_PANIC',
  'POP_CULTURE_PORTRAIT',
];

const CHATGPT_PREFERRED: ViralStyle[] = [
  'CANDLESTICK_HERO',
  'CAP_TABLE_GRID',
  'EARNINGS_HEAT_TABLE',
  'TYPOGRAPHIC_MEGA_NUMBER',
  'MACRO_FLOW_DIAGRAM',
  'PORTFOLIO_BAR_RACE',
  'INSTITUTIONAL_FLOW_SANKEY',
  'PRICE_TIMELINE_ANNOTATED',
  'CANDLESTICK_PATTERN_ANNOTATED',
  'TICKER_TAPE_HERO',
  'POSITION_CONCENTRATION_TREEMAP',
  'EDITORIAL_SPLIT_LAYOUT',
  'EARNINGS_CARD',
  'MAP_DATA_OVERLAY',
  'EDITORIAL_REACTION_CARICATURE',
  'LINE_CHART',
  'DONUT_CHART',
  'BAR_CHART_HORIZONTAL',
  'SANKEY_DIAGRAM',
  'RADAR_CHART',
  'AREA_CHART',
  'CANDLESTICK_CHART',
  'COMPARISON_TABLE',
  'HEATMAP_GRID',
  'CIRCULAR_PORTFOLIO_WHEEL',
  'MINIMALIST_CHECKLIST',
  'GLOWING_QUOTE',
  'NEON_TERMINAL',
  'MAGAZINE_COVER',
];

export function recommendModelForStyle(style: ViralStyle): RecommendedModel {
  if (SEEDANCE_PREFERRED.includes(style)) return 'seedance';
  if (CHATGPT_PREFERRED.includes(style)) return 'chatgpt_image';
  return 'either';
}

export function modelRecommendationLabel(model: RecommendedModel): string {
  switch (model) {
    case 'seedance': return 'Best: Seedance';
    case 'chatgpt_image': return 'Best: ChatGPT image gen';
    case 'either': return 'Either model works';
  }
}
