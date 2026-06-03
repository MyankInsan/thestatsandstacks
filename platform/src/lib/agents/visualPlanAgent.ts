import type { ViralStyle } from './promptLibrary';
import { ROTATION_ALLOWLIST } from './promptLibrary';
import { lruPick } from '../services/lruPicker';
import { STYLE_BUCKETS, type Bucket } from './financialVizPicker';
import type { CarouselConstraints } from './carouselConstraintAgent';
import type { StrategyDecision } from './contentStrategyAgent';
import type { FormatDecision, FormatType } from './formatStyleAgent';
import type { SlideRole, VisualPosition } from './slideNarrativeAgent';
import type { NarrativeArc, DominantSubjectClass, ContentHistoryEntry } from '../services/contentHistory';
import type { PortraitSelection } from './portraitLibrary';
import { toPersistedVisualPlan, checkVisualPlanVariety } from './varietyContract';

export type StructureFamily =
  | 'NEWS_FLASH'
  | 'DATA_SNAPSHOT'
  | 'COMPARISON_XRAY'
  | 'CANDLESTICK_STORY'
  | 'RECEIPT_DROP'
  | 'EDITORIAL_MYTH_BUST'
  | 'HUMAN_EDITORIAL'
  | 'PREMIUM_LIFESTYLE';

export type CoverMechanism =
  | 'HERO_NUMBER'
  | 'HEADLINE_OBJECT'
  | 'ANNOTATED_CHART'
  | 'DOCUMENT_RECEIPT'
  | 'EDITORIAL_PORTRAIT'
  | 'SPLIT_CONTRAST'
  | 'TYPOGRAPHIC_POSTER'
  | 'CINEMATIC_SCENE';

/**
 * Cover LAYOUT family — the structural relationship between the headline and the
 * image. The old planner forced every cover to TOP_STACK (text in the top third,
 * photo below), which is why every cover looked the same. Covers now rotate
 * across these families (soft LRU) so the feed varies its composition, and the
 * "integrated" families bake the text INTO the scene instead of floating it over.
 */
export type CoverLayoutFamily =
  | 'TOP_STACK'            // headline stacked in the top third over the image (legacy)
  | 'INTEGRATED_SCENE'    // headline is a physical part of the scene (sign, screen, print)
  | 'FULL_BLEED_EDITORIAL'// magazine masthead + coverlines baked into a full-bleed image
  | 'SPLIT_EDITORIAL'     // image one half, type the other
  | 'HERO_NUMBER'         // a single number fills the frame
  | 'DASHBOARD_FILL'      // a data UI fills the canvas, title lives in the chrome
  | 'MOCK_SCREENSHOT'     // a brokerage/tweet/headline mock is the hero
  | 'DOCUMENT_RECEIPT';   // a filing/receipt/scorecard is the hero

/** Families whose headline must be rendered INSIDE the scene, not as an overlay. */
export const INTEGRATED_TEXT_FAMILIES: ReadonlySet<CoverLayoutFamily> = new Set<CoverLayoutFamily>([
  'INTEGRATED_SCENE', 'FULL_BLEED_EDITORIAL', 'MOCK_SCREENSHOT', 'DOCUMENT_RECEIPT',
]);

// Which layout families suit each cover style. The planner LRU-picks among the
// allowed set so a given style still varies its composition over time.
const COVER_FAMILIES_FOR_STYLE: Partial<Record<ViralStyle, CoverLayoutFamily[]>> = {
  TYPOGRAPHIC_MEGA_NUMBER: ['HERO_NUMBER', 'FULL_BLEED_EDITORIAL'],
  EARNINGS_CARD: ['HERO_NUMBER', 'DOCUMENT_RECEIPT'],
  CANDLESTICK_HERO: ['DASHBOARD_FILL', 'INTEGRATED_SCENE', 'TOP_STACK'],
  CANDLESTICK_PATTERN_ANNOTATED: ['DASHBOARD_FILL', 'INTEGRATED_SCENE'],
  PRICE_TIMELINE_ANNOTATED: ['DASHBOARD_FILL', 'INTEGRATED_SCENE', 'TOP_STACK'],
  LINE_CHART: ['DASHBOARD_FILL', 'INTEGRATED_SCENE', 'TOP_STACK'],
  AREA_CHART: ['DASHBOARD_FILL', 'INTEGRATED_SCENE'],
  TICKER_TAPE_HERO: ['INTEGRATED_SCENE', 'FULL_BLEED_EDITORIAL'],
  NEON_TERMINAL: ['INTEGRATED_SCENE', 'DASHBOARD_FILL'],
  REDDIT_POST_SCREENSHOT: ['MOCK_SCREENSHOT'],
  TWEET_STOCK_CHART_SPLIT: ['MOCK_SCREENSHOT', 'SPLIT_EDITORIAL'],
  CAP_TABLE_GRID: ['DOCUMENT_RECEIPT', 'DASHBOARD_FILL'],
  EARNINGS_HEAT_TABLE: ['DOCUMENT_RECEIPT', 'DASHBOARD_FILL'],
  POSITION_CONCENTRATION_TREEMAP: ['DASHBOARD_FILL', 'DOCUMENT_RECEIPT'],
  COMPARISON_TABLE: ['DOCUMENT_RECEIPT', 'SPLIT_EDITORIAL'],
  EDITORIAL_STAT_CARD: ['DOCUMENT_RECEIPT', 'SPLIT_EDITORIAL'],
  MINIMALIST_CHECKLIST: ['DOCUMENT_RECEIPT', 'SPLIT_EDITORIAL'],
  MAGAZINE_COVER: ['FULL_BLEED_EDITORIAL', 'SPLIT_EDITORIAL'],
  EDITORIAL_SPLIT_LAYOUT: ['SPLIT_EDITORIAL', 'FULL_BLEED_EDITORIAL'],
  GLOWING_QUOTE: ['FULL_BLEED_EDITORIAL', 'INTEGRATED_SCENE'],
  EXPERT_CUTOUT: ['SPLIT_EDITORIAL', 'FULL_BLEED_EDITORIAL'],
  CARICATURE_PORTRAIT: ['FULL_BLEED_EDITORIAL', 'SPLIT_EDITORIAL'],
  EDITORIAL_REACTION_CARICATURE: ['FULL_BLEED_EDITORIAL', 'SPLIT_EDITORIAL'],
  LEADER_LOGO_CUTOUTS: ['SPLIT_EDITORIAL', 'FULL_BLEED_EDITORIAL'],
  EXECUTIVE_LINEUP: ['FULL_BLEED_EDITORIAL', 'SPLIT_EDITORIAL'],
  PORTFOLIO_DOUGHNUT_PORTRAIT: ['FULL_BLEED_EDITORIAL', 'DASHBOARD_FILL'],
  LUXURY_LIFESTYLE: ['INTEGRATED_SCENE', 'FULL_BLEED_EDITORIAL', 'TOP_STACK'],
  ARCHITECTURAL_OVERLAY: ['INTEGRATED_SCENE', 'FULL_BLEED_EDITORIAL', 'TOP_STACK'],
  CORPORATE_OFFICE_SPACE: ['INTEGRATED_SCENE', 'FULL_BLEED_EDITORIAL'],
  ANIMAL_METAPHOR: ['FULL_BLEED_EDITORIAL', 'TOP_STACK'],
  CHESS_BOARD_STRATEGY: ['FULL_BLEED_EDITORIAL', 'TOP_STACK'],
  SATIRICAL_METAPHOR: ['FULL_BLEED_EDITORIAL', 'TOP_STACK'],
  FUNNY_COMPARISON: ['SPLIT_EDITORIAL', 'TOP_STACK'],
  MEME_COMIC_PLATE: ['FULL_BLEED_EDITORIAL', 'SPLIT_EDITORIAL'],
  MAP_DATA_OVERLAY: ['DASHBOARD_FILL', 'INTEGRATED_SCENE'],
};

const DEFAULT_COVER_FAMILIES: CoverLayoutFamily[] = ['TOP_STACK', 'FULL_BLEED_EDITORIAL', 'INTEGRATED_SCENE'];

function coverFamiliesForStyle(style: ViralStyle): CoverLayoutFamily[] {
  return COVER_FAMILIES_FOR_STYLE[style] ?? DEFAULT_COVER_FAMILIES;
}

function positionForCoverFamily(family: CoverLayoutFamily): VisualPosition {
  switch (family) {
    case 'HERO_NUMBER': return 'center';
    case 'MOCK_SCREENSHOT': return 'center';
    case 'DOCUMENT_RECEIPT': return 'center';
    case 'SPLIT_EDITORIAL': return 'left';
    case 'FULL_BLEED_EDITORIAL': return 'background';
    case 'DASHBOARD_FILL': return 'background';
    case 'INTEGRATED_SCENE': return 'background';
    case 'TOP_STACK':
    default: return 'top';
  }
}

export interface StoryboardContinuity {
  premise: string;
  anchorPrompt: string;
  sharedVisualInvariants: string[];
  progressionRule: string;
  resolutionRule: string;
  varietyRule: string;
  /** Cover layout family — lets the image prompt switch to integrated-text mode. */
  coverLayoutFamily?: CoverLayoutFamily;
}

export interface SlideVisualGrammar {
  slideNumber: number;
  intendedRole: SlideRole;
  structureFamily: StructureFamily;
  coverMechanism?: CoverMechanism;
  coverLayoutFamily?: CoverLayoutFamily;
  layoutArchetype: string;
  primaryEncoding: string;
  visualStyle: ViralStyle;
  bucket: Bucket;
  visualPosition: VisualPosition;
  dominantSubjectClass: DominantSubjectClass;
  sceneConceptId: string;
  ctaConceptId?: string;
  /** The storyboard beat this slide should advance (target for the narrative). */
  storyboardBeat: string;
}

export interface VisualPlan {
  slides: SlideVisualGrammar[];
  storyboard: StoryboardContinuity;
  narrativeArc: NarrativeArc;
  portraitSelection?: PortraitSelection;
  payoffSlideIndex?: number;
  compositionSignature: string;
  structureFamily: StructureFamily;
  coverMechanism?: CoverMechanism;
  coverLayoutFamily?: CoverLayoutFamily;
}

export interface VisualPlanInput {
  strategy: StrategyDecision;
  format: FormatDecision;
  constraints: CarouselConstraints;
  tickerSymbols: string[];
  dateKey: string;
  slotIndex?: number;
  recentHistory?: ContentHistoryEntry[];
  todayPriorEntries?: ContentHistoryEntry[];
}

export interface VisualPlanResult {
  plan: VisualPlan;
  valid: boolean;
  violations: string[];
  /** True when the plan was relaxed (e.g. adjacency override or signature
   * pressure) — used to raise the Telegram variety warning. */
  usedFallback: boolean;
  overrides: string[];
  /** Variety hard-block reasons that could not be resolved (best-effort plan). */
  varietyReasons: string[];
}

const MAX_VARIETY_RETRIES = 5;

// ── Style metadata ──────────────────────────────────────────────────────────

const HUMAN_STYLES = new Set<ViralStyle>([
  'POP_CULTURE_PORTRAIT', 'CARICATURE_PORTRAIT', 'EXPERT_CUTOUT', 'TRADER_DESK_SILHOUETTE',
  'EXECUTIVE_LINEUP', 'LEADER_LOGO_CUTOUTS', 'EDITORIAL_REACTION_CARICATURE',
  'CIRCULAR_PORTFOLIO_WHEEL', 'PORTFOLIO_DOUGHNUT_PORTRAIT',
]);

const BUILDING_STYLES = new Set<ViralStyle>(['ARCHITECTURAL_OVERLAY', 'CORPORATE_OFFICE_SPACE', 'PREMIUM_CTA']);
const CROWD_STYLES = new Set<ViralStyle>(['CROWD_PANIC']);

const PRIMARY_ENCODING: Partial<Record<ViralStyle, string>> = {
  CANDLESTICK_HERO: 'candlestick', CANDLESTICK_CHART: 'candlestick', CANDLESTICK_PATTERN_ANNOTATED: 'candlestick',
  LINE_CHART: 'line', AREA_CHART: 'area', BAR_CHART_HORIZONTAL: 'bar', PORTFOLIO_BAR_RACE: 'bar-race',
  DONUT_CHART: 'donut', PORTFOLIO_DOUGHNUT_PORTRAIT: 'donut-portrait', CIRCULAR_PORTFOLIO_WHEEL: 'portfolio-wheel',
  SANKEY_DIAGRAM: 'sankey', INSTITUTIONAL_FLOW_SANKEY: 'sankey', MACRO_FLOW_DIAGRAM: 'flow',
  COMPARISON_TABLE: 'table', CAP_TABLE_GRID: 'logo-grid', EARNINGS_HEAT_TABLE: 'heat-table',
  HEATMAP_GRID: 'heatmap', POSITION_CONCENTRATION_TREEMAP: 'treemap', RADAR_CHART: 'radar',
  TICKER_TAPE_HERO: 'ticker-tape', PRICE_TIMELINE_ANNOTATED: 'annotated-timeline', EARNINGS_CARD: 'metric-card',
  MAP_DATA_OVERLAY: 'choropleth', TYPOGRAPHIC_MEGA_NUMBER: 'mega-number', EDITORIAL_STAT_CARD: 'stat-card',
  REDDIT_POST_SCREENSHOT: 'social-mock', TWEET_STOCK_CHART_SPLIT: 'social-chart-split',
  MINIMALIST_CHECKLIST: 'checklist', GLOWING_QUOTE: 'pull-quote', NEON_TERMINAL: 'terminal',
  EDITORIAL_SPLIT_LAYOUT: 'editorial-split', MAGAZINE_COVER: 'magazine',
};

const COVER_MECHANISM_FOR_STYLE: Partial<Record<ViralStyle, CoverMechanism>> = {
  TYPOGRAPHIC_MEGA_NUMBER: 'HERO_NUMBER', EARNINGS_CARD: 'HERO_NUMBER',
  CANDLESTICK_HERO: 'ANNOTATED_CHART', CANDLESTICK_PATTERN_ANNOTATED: 'ANNOTATED_CHART',
  PRICE_TIMELINE_ANNOTATED: 'ANNOTATED_CHART', LINE_CHART: 'ANNOTATED_CHART', AREA_CHART: 'ANNOTATED_CHART',
  REDDIT_POST_SCREENSHOT: 'DOCUMENT_RECEIPT', TWEET_STOCK_CHART_SPLIT: 'DOCUMENT_RECEIPT', CAP_TABLE_GRID: 'DOCUMENT_RECEIPT',
  EXPERT_CUTOUT: 'EDITORIAL_PORTRAIT', CARICATURE_PORTRAIT: 'EDITORIAL_PORTRAIT', EDITORIAL_REACTION_CARICATURE: 'EDITORIAL_PORTRAIT',
  PORTFOLIO_DOUGHNUT_PORTRAIT: 'EDITORIAL_PORTRAIT', LEADER_LOGO_CUTOUTS: 'EDITORIAL_PORTRAIT', EXECUTIVE_LINEUP: 'EDITORIAL_PORTRAIT',
  FUNNY_COMPARISON: 'SPLIT_CONTRAST', EDITORIAL_SPLIT_LAYOUT: 'SPLIT_CONTRAST', COMPARISON_TABLE: 'SPLIT_CONTRAST',
  GLOWING_QUOTE: 'TYPOGRAPHIC_POSTER', MAGAZINE_COVER: 'TYPOGRAPHIC_POSTER', NEON_TERMINAL: 'TYPOGRAPHIC_POSTER',
  LUXURY_LIFESTYLE: 'CINEMATIC_SCENE', ARCHITECTURAL_OVERLAY: 'CINEMATIC_SCENE', CORPORATE_OFFICE_SPACE: 'CINEMATIC_SCENE',
  ANIMAL_METAPHOR: 'CINEMATIC_SCENE', VAULT_SECURITY: 'HEADLINE_OBJECT', SATIRICAL_METAPHOR: 'HEADLINE_OBJECT',
};

const STRUCTURE_FAMILY_BY_FORMAT: Record<FormatType, StructureFamily> = {
  PHOTOREALISTIC_NEWS_FLASH: 'NEWS_FLASH',
  PHOTOREALISTIC_MARKET_UPDATE: 'DATA_SNAPSHOT',
  PHOTOREALISTIC_MINIMAL_TECH: 'COMPARISON_XRAY',
  PHOTOREALISTIC_EXPERT_SHOCK: 'HUMAN_EDITORIAL',
  PHOTOREALISTIC_LUXURY_LIFESTYLE: 'PREMIUM_LIFESTYLE',
  MEME_HUMOR: 'EDITORIAL_MYTH_BUST',
};

const THEMATIC_STYLES_BY_FORMAT: Record<string, ViralStyle[]> = {
  PHOTOREALISTIC_NEWS_FLASH: ['ARCHITECTURAL_OVERLAY', 'CANDLESTICK_HERO', 'TICKER_TAPE_HERO', 'PRICE_TIMELINE_ANNOTATED', 'GLOWING_QUOTE', 'LINE_CHART', 'EDITORIAL_SPLIT_LAYOUT'],
  PHOTOREALISTIC_LUXURY_LIFESTYLE: ['LUXURY_LIFESTYLE', 'MAGAZINE_COVER', 'CHESS_BOARD_STRATEGY', 'GLOWING_QUOTE', 'TYPOGRAPHIC_MEGA_NUMBER', 'EDITORIAL_SPLIT_LAYOUT', 'EDITORIAL_STAT_CARD'],
  PHOTOREALISTIC_MARKET_UPDATE: ['CANDLESTICK_HERO', 'LINE_CHART', 'AREA_CHART', 'SANKEY_DIAGRAM', 'DONUT_CHART', 'BAR_CHART_HORIZONTAL', 'TICKER_TAPE_HERO', 'EARNINGS_HEAT_TABLE', 'PRICE_TIMELINE_ANNOTATED', 'EDITORIAL_STAT_CARD', 'CORPORATE_OFFICE_SPACE'],
  PHOTOREALISTIC_EXPERT_SHOCK: ['EXPERT_CUTOUT', 'CARICATURE_PORTRAIT', 'EXECUTIVE_LINEUP', 'LEADER_LOGO_CUTOUTS', 'EDITORIAL_REACTION_CARICATURE', 'PORTFOLIO_DOUGHNUT_PORTRAIT', 'COMPARISON_TABLE', 'TYPOGRAPHIC_MEGA_NUMBER'],
  PHOTOREALISTIC_MINIMAL_TECH: ['MINIMALIST_CHECKLIST', 'TYPOGRAPHIC_MEGA_NUMBER', 'COMPARISON_TABLE', 'CAP_TABLE_GRID', 'POSITION_CONCENTRATION_TREEMAP', 'MACRO_FLOW_DIAGRAM', 'PRICE_TIMELINE_ANNOTATED', 'EDITORIAL_SPLIT_LAYOUT', 'EARNINGS_CARD', 'MAP_DATA_OVERLAY', 'EDITORIAL_STAT_CARD'],
  MEME_HUMOR: ['EDITORIAL_REACTION_CARICATURE', 'CARICATURE_PORTRAIT', 'SATIRICAL_METAPHOR', 'FUNNY_COMPARISON', 'GLOWING_QUOTE', 'ANIMAL_METAPHOR', 'COMPARISON_TABLE', 'TYPOGRAPHIC_MEGA_NUMBER'],
};

// CTA visual pool — editorial/typographic endings that resolve the post's own
// motif, NOT the old luxury clichés (globe boardroom / jet+Rolex / vault). The
// fuller "CTA visual concept" system (motif-callback, save-card, send-to-friend)
// lands in the visual-variety phase; this Phase-0 swap removes the worst tropes.
const CTA_STYLE_POOL: ViralStyle[] = ['EDITORIAL_STAT_CARD', 'MINIMALIST_CHECKLIST', 'TYPOGRAPHIC_MEGA_NUMBER', 'GLOWING_QUOTE', 'EDITORIAL_SPLIT_LAYOUT', 'MAGAZINE_COVER'];

function bucketOf(style: ViralStyle): Bucket {
  return (STYLE_BUCKETS[style] as Bucket) ?? 'Layout';
}

export function dominantSubjectClassFor(style: ViralStyle): DominantSubjectClass {
  if (CROWD_STYLES.has(style)) return 'CROWD';
  if (HUMAN_STYLES.has(style)) return 'PORTRAIT';
  if (BUILDING_STYLES.has(style)) return 'BUILDING';
  const bucket = bucketOf(style);
  if (bucket === 'Data') return 'CHART';
  if (bucket === 'Metaphor') return 'METAPHOR_OBJECT';
  return 'TYPOGRAPHY';
}

function primaryEncodingFor(style: ViralStyle): string {
  if (PRIMARY_ENCODING[style]) return PRIMARY_ENCODING[style]!;
  const bucket = bucketOf(style);
  if (bucket === 'Human') return 'portrait';
  if (bucket === 'Metaphor') return BUILDING_STYLES.has(style) ? 'architecture' : 'cinematic-object';
  return 'typography';
}

function layoutArchetypeFor(position: VisualPosition, role: SlideRole): string {
  if (role === 'cover') return `hero-${position}`;
  switch (position) {
    case 'left': return 'split-left';
    case 'right': return 'split-right';
    case 'background': return 'full-bleed';
    case 'center': return 'centered-overlay';
    case 'top':
    default: return 'top-stack';
  }
}

function naturalPositionForStyle(style: ViralStyle, role: SlideRole): VisualPosition {
  if (role === 'cover') return 'top';
  if (['PREMIUM_CTA', 'GLOWING_QUOTE', 'TYPOGRAPHIC_MEGA_NUMBER', 'EARNINGS_CARD', 'REDDIT_POST_SCREENSHOT'].includes(style)) return 'center';
  if (['MINIMALIST_CHECKLIST', 'COMPARISON_TABLE', 'CAP_TABLE_GRID', 'EDITORIAL_SPLIT_LAYOUT', 'EXPERT_CUTOUT', 'EDITORIAL_STAT_CARD'].includes(style)) return 'left';
  if (bucketOf(style) === 'Data') return 'background';
  return 'top';
}

function coverMechanismFor(style: ViralStyle): CoverMechanism {
  return COVER_MECHANISM_FOR_STYLE[style] ?? (bucketOf(style) === 'Data' ? 'ANNOTATED_CHART' : 'CINEMATIC_SCENE');
}

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ── Role sequence ───────────────────────────────────────────────────────────

function buildRoleSequence(slideCount: number, requireChart: boolean, payoffSlideIndex?: number): SlideRole[] {
  const roles: SlideRole[] = [];
  for (let i = 1; i <= slideCount; i++) {
    if (i === 1) roles.push('cover');
    else if (i === slideCount) roles.push('cta');
    else if (i === 2 && slideCount >= 5) roles.push('context');
    else roles.push('breakdown');
  }
  if (requireChart && slideCount >= 3) {
    // Place a chart slide at the payoff index if defined, else a stable middle slide.
    const chartIdx = payoffSlideIndex && payoffSlideIndex >= 2 && payoffSlideIndex < slideCount
      ? payoffSlideIndex - 1
      : Math.min(slideCount - 2, 2);
    if (roles[chartIdx] !== 'cover' && roles[chartIdx] !== 'cta') roles[chartIdx] = 'chart_data';
  }
  return roles;
}

// ── The planner ─────────────────────────────────────────────────────────────

export class VisualPlanAgent {
  /**
   * Build a complete, validated visual plan. When recent history is supplied,
   * the deterministic plan is variety-checked against the ten-day contract and
   * retried with growing style exclusions (LRU-style) until it stops colliding
   * or the retry budget is exhausted (then it returns the lowest-risk plan with
   * a logged warning — it NEVER silently reuses a composition).
   */
  execute(input: VisualPlanInput): VisualPlanResult {
    const recentHistory = input.recentHistory ?? [];
    const todayPriorEntries = input.todayPriorEntries ?? [];
    const extraExcluded = new Set<ViralStyle>();

    let best: { plan: VisualPlan; overrides: string[] } | undefined;
    let bestVarietyReasons: string[] = [];

    for (let attempt = 0; attempt <= MAX_VARIETY_RETRIES; attempt++) {
      const candidate = this.buildOnce(input, extraExcluded);
      const violations = validatePlan(candidate.plan, input.constraints);
      const persisted = toPersistedVisualPlan(candidate.plan);
      const variety = checkVisualPlanVariety(persisted, recentHistory, todayPriorEntries);

      if (!best) { best = candidate; bestVarietyReasons = variety.reasons; }

      if (violations.length === 0 && !variety.blocked) {
        return {
          plan: candidate.plan,
          valid: true,
          violations,
          // Genuine variety pressure = a retry was needed. Benign within-carousel
          // adjacency overrides are surfaced in `overrides` but do NOT trip the
          // daily variety warning (they are routine for small-pool lanes and at
          // ~50% would make the warning meaningless).
          usedFallback: attempt > 0,
          overrides: candidate.overrides,
          varietyReasons: [],
        };
      }

      // Grow exclusions so the next deterministic build differs: drop the cover
      // style and the first non-CTA slide style that contributed to the collision.
      const coverStyle = candidate.plan.slides[0]?.visualStyle;
      const secondStyle = candidate.plan.slides[1]?.visualStyle;
      if (coverStyle) extraExcluded.add(coverStyle);
      if (secondStyle) extraExcluded.add(secondStyle);
      best = candidate;
      bestVarietyReasons = variety.reasons;
    }

    // Retry budget exhausted — return the last (lowest-risk) plan with a warning.
    const finalViolations = validatePlan(best!.plan, input.constraints);
    return {
      plan: best!.plan,
      valid: finalViolations.length === 0 && bestVarietyReasons.length === 0,
      violations: finalViolations,
      usedFallback: true,
      overrides: best!.overrides,
      varietyReasons: bestVarietyReasons,
    };
  }

  private buildOnce(input: VisualPlanInput, extraExcluded: Set<ViralStyle>): { plan: VisualPlan; overrides: string[] } {
    const { strategy, format, constraints } = input;
    const slideCount = Math.max(3, format.slideCount);
    const overrides: string[] = [];

    const structureFamily = STRUCTURE_FAMILY_BY_FORMAT[format.formatType];
    const excluded = new Set<ViralStyle>([...(constraints.excludedStyles ?? []), ...extraExcluded]);
    const requireChart = Boolean(constraints.requiredChartSlideRole) || (constraints.chartHeroSuggestion !== undefined);
    const roles = buildRoleSequence(slideCount, requireChart, constraints.payoffSlideIndex);

    const thematic = THEMATIC_STYLES_BY_FORMAT[format.formatType] ?? ROTATION_ALLOWLIST;
    const chartHero = constraints.chartHeroSuggestion;
    const chartSupporting = constraints.chartSupportingSuggestions ?? [];
    const maxHuman = constraints.maxHumanSlides ?? 2;
    const maxHumanFirst3 = constraints.maxHumanInFirst3 ?? 1;

    const forbidAdjacentBuckets = constraints.forbiddenAdjacentBuckets !== false;
    const chosen: ViralStyle[] = [];
    let humanCount = 0;
    let humanInFirst3 = 0;
    let prevDominant: DominantSubjectClass | undefined;
    let prevBucket: Bucket | undefined;
    let prevStyle: ViralStyle | undefined;
    let chartPlaced = false;

    const isValid = (style: ViralStyle, slideIndex: number, allowAdjacency: boolean): boolean => {
      if (!STYLE_BUCKETS[style]) return false;
      if (excluded.has(style)) return false;
      if (chosen.includes(style)) return false;
      if (prevStyle === style) return false;
      if (HUMAN_STYLES.has(style)) {
        if (humanCount >= maxHuman) return false;
        if (slideIndex < 3 && humanInFirst3 >= maxHumanFirst3) return false;
      }
      if (!allowAdjacency) {
        if (prevDominant && dominantSubjectClassFor(style) === prevDominant) return false;
        if (forbidAdjacentBuckets && prevBucket && bucketOf(style) === prevBucket) return false;
      }
      return true;
    };

    const pickFrom = (pools: ViralStyle[][], slideIndex: number): ViralStyle => {
      for (const allowAdjacency of [false, true]) {
        for (const pool of pools) {
          const found = pool.find((s) => isValid(s, slideIndex, allowAdjacency));
          if (found) {
            if (allowAdjacency && ((prevDominant && dominantSubjectClassFor(found) === prevDominant) || (prevBucket && bucketOf(found) === prevBucket))) {
              overrides.push(`Slide ${slideIndex + 1}: adjacency override (${found})`);
            }
            return found;
          }
        }
      }
      // Last resort: any non-chosen rotation style (record override).
      const last = ROTATION_ALLOWLIST.find((s) => !chosen.includes(s) && !excluded.has(s)) ?? 'ARCHITECTURAL_OVERLAY';
      overrides.push(`Slide ${slideIndex + 1}: hard fallback to ${last}`);
      return last;
    };

    const slides: SlideVisualGrammar[] = [];
    const beats = deriveBeats(strategy, roles);

    // Recent cover layout families (cross-day + same-day) so the cover composition
    // rotates instead of always being TOP_STACK. Legacy entries → TOP_STACK.
    const recentCoverFamilies: CoverLayoutFamily[] = [
      ...(input.recentHistory ?? []).slice(-10),
      ...(input.todayPriorEntries ?? []),
    ].map((e) => ((e.visualPlan?.coverLayoutFamily as CoverLayoutFamily | undefined) ?? 'TOP_STACK'));

    for (let i = 0; i < slideCount; i++) {
      const role = roles[i];
      let style: ViralStyle;

      if (role === 'cover') {
        const coverPools = [
          chartHero && structureFamily !== 'PREMIUM_LIFESTYLE' ? [chartHero] : [],
          thematic,
          ROTATION_ALLOWLIST,
        ].filter((p) => p.length > 0);
        style = pickFrom(coverPools, i);
      } else if (role === 'cta') {
        style = pickFrom([CTA_STYLE_POOL, thematic, ROTATION_ALLOWLIST], i);
      } else if (role === 'chart_data' || (!chartPlaced && requireChart && i === slideCount - 2)) {
        const dataPools = [
          chartHero ? [chartHero] : [],
          chartSupporting,
          thematic.filter((s) => bucketOf(s) === 'Data'),
          ROTATION_ALLOWLIST.filter((s) => bucketOf(s) === 'Data'),
        ].filter((p) => p.length > 0);
        style = pickFrom(dataPools, i);
        chartPlaced = chartPlaced || bucketOf(style) === 'Data';
      } else {
        style = pickFrom([thematic, ROTATION_ALLOWLIST], i);
      }

      chosen.push(style);
      if (HUMAN_STYLES.has(style)) { humanCount++; if (i < 3) humanInFirst3++; }
      if (bucketOf(style) === 'Data') chartPlaced = true;

      // Covers choose a layout FAMILY (soft LRU) which sets the position; other
      // slides keep their natural position. This is what breaks the "every cover
      // is text-on-top" monotony.
      let coverLayoutFamily: CoverLayoutFamily | undefined;
      let position: VisualPosition;
      if (role === 'cover') {
        const families = coverFamiliesForStyle(style);
        coverLayoutFamily = lruPick(families, recentCoverFamilies, 10) ?? families[0];
        position = positionForCoverFamily(coverLayoutFamily);
      } else {
        position = naturalPositionForStyle(style, role);
      }
      const dominantSubjectClass = dominantSubjectClassFor(style);
      const bucket = bucketOf(style);
      const grammar: SlideVisualGrammar = {
        slideNumber: i + 1,
        intendedRole: role,
        structureFamily,
        coverMechanism: role === 'cover' ? coverMechanismFor(style) : undefined,
        coverLayoutFamily,
        layoutArchetype: role === 'cover' ? `cover-${coverLayoutFamily}` : layoutArchetypeFor(position, role),
        primaryEncoding: primaryEncodingFor(style),
        visualStyle: style,
        bucket,
        visualPosition: position,
        dominantSubjectClass,
        sceneConceptId: `${structureFamily}:${style}:${position}`,
        ctaConceptId: role === 'cta' ? `${constraints.ctaId}:${style}` : undefined,
        storyboardBeat: beats[i],
      };
      slides.push(grammar);
      prevDominant = dominantSubjectClass;
      prevBucket = bucket;
      prevStyle = style;
    }

    const coverMechanism = slides[0]?.coverMechanism;
    const coverLayoutFamily = slides[0]?.coverLayoutFamily;
    const storyboard = buildStoryboard(strategy, format, slides, structureFamily, coverLayoutFamily);
    const compositionSignature = computeCompositionSignature(structureFamily, coverMechanism, slides);

    const plan: VisualPlan = {
      slides,
      storyboard,
      narrativeArc: constraints.narrativeArc,
      portraitSelection: constraints.portraitSelection,
      payoffSlideIndex: constraints.payoffSlideIndex,
      compositionSignature,
      structureFamily,
      coverMechanism,
      coverLayoutFamily,
    };

    return { plan, overrides };
  }
}

function deriveBeats(strategy: StrategyDecision, roles: SlideRole[]): string[] {
  const skeleton = strategy.angleSlideSkeleton ?? [];
  return roles.map((role, i) => {
    if (skeleton[i]) return skeleton[i];
    // Slide 2 is a SECONDARY HOOK: IG re-serves slide 2 to viewers who don't
    // swipe, so it must stand alone as a hook, not a low-energy context slide.
    if (i === 1 && role !== 'cta') {
      return 'Secondary hook — a surprising number, sharp contrast, or "wait, what?" moment that re-hooks anyone who did not swipe past the cover';
    }
    switch (role) {
      case 'cover': return 'Establish the premise and create the anchor image';
      case 'context': return 'Deepen the problem / surprising context';
      case 'chart_data': return 'Deliver the hero data point as a chart';
      case 'cta': return 'Resolve the original motif and give the save/follow reason';
      default: return `Advance one distinct evidence point or decision branch (${i + 1})`;
    }
  });
}

function buildStoryboard(
  strategy: StrategyDecision,
  format: FormatDecision,
  slides: SlideVisualGrammar[],
  structureFamily: StructureFamily,
  coverLayoutFamily?: CoverLayoutFamily,
): StoryboardContinuity {
  const cover = slides[0];
  const accent = format.colorScheme.accent1;
  return {
    coverLayoutFamily,
    premise: `${strategy.topic} — ${strategy.hook}`.slice(0, 200),
    anchorPrompt: `Slide 1 establishes the premise via a ${cover?.coverMechanism ?? 'CINEMATIC_SCENE'} (${cover?.visualStyle}) in a ${coverLayoutFamily ?? 'TOP_STACK'} layout. This cover image is the visual anchor every later slide stays coherent with.`,
    sharedVisualInvariants: [
      `Palette anchored on ${format.colorScheme.bg} with accent ${accent}`,
      'Lower-third "@thestatsandstacks" typographic watermark on every slide',
      `Consistent ${structureFamily} brand treatment and type hierarchy`,
      'Same lighting logic and material vocabulary across the set',
    ],
    progressionRule: 'Each middle slide advances exactly one new state, evidence point, consequence, or decision branch — camera/crop/chart-type/layout may change while motif, palette logic and brand treatment stay coherent.',
    resolutionRule: 'The CTA slide resolves the original motif from slide 1 instead of switching to a generic luxury scene.',
    varietyRule: 'No two adjacent slides share a dominant subject class or visual style; the cover mechanism + layout archetype sequence must not repeat a recent packet.',
  };
}

export function computeCompositionSignature(
  structureFamily: StructureFamily,
  coverMechanism: CoverMechanism | undefined,
  slides: SlideVisualGrammar[],
): string {
  const detail = slides
    .map((s) => `${s.dominantSubjectClass}|${s.layoutArchetype}|${s.primaryEncoding}`)
    .join('>');
  const hash = simpleHash(`${structureFamily}|${coverMechanism ?? '-'}|${detail}`);
  return `vp1:${structureFamily}:${coverMechanism ?? 'NONE'}:${hash}`;
}

export function validatePlan(plan: VisualPlan, constraints: CarouselConstraints): string[] {
  const violations: string[] = [];
  const slides = plan.slides;

  if (slides.length === 0) { violations.push('empty plan'); return violations; }
  if (slides[0].intendedRole !== 'cover') violations.push('slide 1 is not a cover');
  if (slides[slides.length - 1].intendedRole !== 'cta') violations.push('last slide is not a cta');

  const seenStyles = new Set<ViralStyle>();
  for (const s of slides) {
    if (seenStyles.has(s.visualStyle)) violations.push(`duplicate visualStyle ${s.visualStyle} on slide ${s.slideNumber}`);
    seenStyles.add(s.visualStyle);
    if (constraints.excludedStyles?.includes(s.visualStyle)) violations.push(`slide ${s.slideNumber} uses excluded style ${s.visualStyle}`);
  }

  for (let i = 1; i < slides.length; i++) {
    if (slides[i].dominantSubjectClass === slides[i - 1].dominantSubjectClass) {
      violations.push(`adjacent dominant subject class repeats on slides ${i} and ${i + 1} (${slides[i].dominantSubjectClass})`);
    }
    if (slides[i].bucket === slides[i - 1].bucket && constraints.forbiddenAdjacentBuckets) {
      violations.push(`adjacent bucket repeats on slides ${i} and ${i + 1} (${slides[i].bucket})`);
    }
  }

  const humanSlides = slides.filter((s) => s.dominantSubjectClass === 'PORTRAIT' || s.dominantSubjectClass === 'CROWD').length;
  if (humanSlides > (constraints.maxHumanSlides ?? 2)) violations.push(`too many human slides (${humanSlides})`);
  const humanFirst3 = slides.slice(0, 3).filter((s) => s.dominantSubjectClass === 'PORTRAIT' || s.dominantSubjectClass === 'CROWD').length;
  if (humanFirst3 > (constraints.maxHumanInFirst3 ?? 1)) violations.push(`too many human slides in first 3 (${humanFirst3})`);

  const hasChart = slides.some((s) => s.bucket === 'Data');
  if (constraints.requiredChartSlideRole && !hasChart) violations.push('required chart slide missing');

  if (constraints.payoffSlideIndex !== undefined) {
    const payoff = slides[constraints.payoffSlideIndex - 1];
    if (!payoff) violations.push(`payoff slide index ${constraints.payoffSlideIndex} out of range`);
  }

  return violations;
}
