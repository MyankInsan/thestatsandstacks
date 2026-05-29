import type { ViralStyle } from './promptLibrary';
import type { ContentHistoryEntry, NarrativeArc, DominantSubjectClass } from '../services/contentHistory';
import type { SlotConfig } from './slotConfig';
import type { CtaId } from './ctaLibrary';
import { CTA_LIBRARY } from './ctaLibrary';
import { STYLE_BUCKETS, type Bucket, UNTESTED_STYLES } from './financialVizPicker';
import { pickPortrait, type TopicCategory, type PortraitSelection } from './portraitLibrary';

export interface CarouselConstraints {
  excludedStyles: ViralStyle[];
  requiredCoverBucket?: Bucket;
  requiredChartSlideRole: 'breakdown' | 'data' | 'context' | null;
  maxHumanSlides: number;
  maxHumanInFirst3: number;
  forbiddenAdjacentBuckets: boolean;
  narrativeArc: NarrativeArc;
  portraitSelection?: PortraitSelection;
  chartHeroSuggestion?: ViralStyle;
  chartSupportingSuggestions: ViralStyle[];
  ctaId: CtaId;
  ctaCarouselImpactNote: string;
  payoffSlideIndex?: number;
  recentSubjects: string[];
  recentArchetypes: string[];
  preferTestedStyles: boolean;
}

export interface CarouselConstraintsInput {
  slot: SlotConfig;
  ctaId: CtaId;
  topicCategory: TopicCategory;
  isReactiveSentiment: boolean;
  hasTickers: boolean;
  tickers?: string[];
  topic?: string;
  recentHistory: ContentHistoryEntry[];
  todayDateKey: string;
  todayPriorEntries: ContentHistoryEntry[];
  chartHeroSuggestion?: ViralStyle;
  chartSupportingSuggestions?: ViralStyle[];
  slideCount: number;
}

const ARC_BY_FORMULA_DEFAULT: NarrativeArc = 'HOOK_PROBLEM_REVEAL_FRAMEWORK_CTA';

export class CarouselConstraintAgent {
  execute(input: CarouselConstraintsInput): CarouselConstraints {
    const recent = input.recentHistory;

    const excludedStyles = computeExcludedStyles(recent, input.todayPriorEntries);

    const arc = pickNarrativeArc(recent);

    const recentSubjects = collectRecent(recent, (e) => e.portraitSubjects ?? [], 10);
    const recentArchetypes = collectRecent(recent, (e) => e.archetypesUsed ?? [], 10);

    let portrait: PortraitSelection | undefined;
    const requiresPortrait = ['EXPERT_CUTOUT', 'CARICATURE_PORTRAIT', 'EXECUTIVE_LINEUP', 'TRADER_DESK_SILHOUETTE', 'POP_CULTURE_PORTRAIT', 'LEADER_LOGO_CUTOUTS', 'PORTFOLIO_DOUGHNUT_PORTRAIT', 'EDITORIAL_REACTION_CARICATURE', 'CIRCULAR_PORTFOLIO_WHEEL', 'COMPARISON_TABLE']
      .some((s) => input.chartHeroSuggestion === (s as ViralStyle) || input.chartSupportingSuggestions?.includes(s as ViralStyle));

    if (requiresPortrait || input.isReactiveSentiment) {
      portrait = pickPortrait({
        topicCategory: input.topicCategory,
        isCoverSlide: true,
        recentPortraitSlugs: recentSubjects,
        recentArchetypeSlugs: recentArchetypes,
        deterministicSeed: `${input.todayDateKey}-s${input.slot.index}`,
        tickers: input.tickers,
        topicTitle: input.topic,
      });
    }

    const ctaSpec = CTA_LIBRARY[input.ctaId];
    let payoffSlideIndex: number | undefined;
    if (input.ctaId === 'swipe_promise') {
      payoffSlideIndex = Math.max(3, Math.floor(input.slideCount / 2) + 1);
    }

    const requiredChartSlideRole = (input.hasTickers || ['EARNINGS', 'MACRO', 'COMMODITY', 'CAP_TABLE'].includes(input.topicCategory))
      ? 'breakdown'
      : null;

    return {
      excludedStyles,
      requiredCoverBucket: input.chartHeroSuggestion ? STYLE_BUCKETS[input.chartHeroSuggestion] as Bucket : undefined,
      requiredChartSlideRole,
      maxHumanSlides: 2,
      maxHumanInFirst3: 1,
      forbiddenAdjacentBuckets: true,
      narrativeArc: arc,
      portraitSelection: portrait,
      chartHeroSuggestion: input.chartHeroSuggestion,
      chartSupportingSuggestions: input.chartSupportingSuggestions ?? [],
      ctaId: input.ctaId,
      ctaCarouselImpactNote: ctaSpec.carouselImpactNote,
      payoffSlideIndex,
      recentSubjects,
      recentArchetypes,
      preferTestedStyles: true,
    };
  }
}

function computeExcludedStyles(recent: ContentHistoryEntry[], todayPriorEntries: ContentHistoryEntry[]): ViralStyle[] {
  const excluded = new Set<string>();

  const last6Covers = collectRecent(recent, (e) => (e.coverVisualStyle ? [e.coverVisualStyle] : []), 6);
  for (const s of last6Covers) excluded.add(s);

  const last4Color = recent.slice(-4).map((e) => JSON.stringify(e.colorSchemeUsed ?? {}));

  for (const todayEntry of todayPriorEntries) {
    if (todayEntry.coverVisualStyle) excluded.add(todayEntry.coverVisualStyle);
    for (const s of todayEntry.visualStylesUsed ?? []) excluded.add(s);
  }

  const allowedStyleCount = Object.keys(STYLE_BUCKETS).length;
  if (excluded.size / allowedStyleCount > 0.6) {
    const preserved = Array.from(excluded).slice(0, Math.floor(allowedStyleCount * 0.5));
    excluded.clear();
    for (const s of preserved) excluded.add(s);
  }

  void last4Color;

  return Array.from(excluded) as ViralStyle[];
}

function pickNarrativeArc(recent: ContentHistoryEntry[]): NarrativeArc {
  const last3Arcs = recent.slice(-3).map((e) => e.narrativeArc).filter(Boolean) as NarrativeArc[];
  const all: NarrativeArc[] = [
    'HOOK_PROBLEM_REVEAL_FRAMEWORK_CTA',
    'MYTH_FACT_PROOF_CTA',
    'SCOREBOARD_WHY_SOWHAT_CTA',
    'TIMECAPSULE_SETUP_RESULT_LESSON_CTA',
    'RECEIPT_DROP_BREAKDOWN_TAKEAWAY_CTA',
    'DECISION_FORK_CRITERIA_CHECKLIST_CTA',
  ];
  const eligible = all.filter((a) => !last3Arcs.includes(a));
  return eligible[0] ?? ARC_BY_FORMULA_DEFAULT;
}

function collectRecent<T>(history: ContentHistoryEntry[], extractor: (e: ContentHistoryEntry) => T[], windowSize: number): T[] {
  return history.slice(-windowSize).flatMap(extractor).filter(Boolean);
}

export function isUntestedStyle(style: ViralStyle): boolean {
  return UNTESTED_STYLES.has(style);
}
