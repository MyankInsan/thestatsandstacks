/**
 * One-time migration script: seeds 20 synthetic content-history entries
 * distributed across 4 days × 5 slots so the cold-start variety enforcement
 * has something to chew on from day 1. Idempotent w.r.t. seed entries
 * (replaces any prior seeds for the same dates).
 *
 * Run via:  npm run migrate-history
 *
 * In-process schema migration runs automatically on every pipeline boot via
 * loadContentHistory(); this script's only job is to pre-populate the 20
 * seed entries. Not required for V2 schema bump.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import {
  appendContentHistory,
  loadContentHistory,
  CURRENT_SCHEMA_VERSION,
  type ContentHistoryEntry,
  type NarrativeArc,
  type DominantSubjectClass,
} from '../src/lib/services/contentHistory';
import type { SlotIndex } from '../src/lib/agents/slotConfig';
import type { HookFormulaId } from '../src/lib/agents/hookFormulas';
import type { CtaId } from '../src/lib/agents/ctaLibrary';
import type { TopicCategory } from '../src/lib/agents/portraitLibrary';

const COLOR_SCHEMES = [
  { bg: '#050505', accent1: '#39FF14', accent2: '#00CFFF' },
  { bg: '#0A0A0A', accent1: '#FFD700', accent2: '#FFFFFF' },
  { bg: '#050505', accent1: '#FF3B30', accent2: '#39FF14' },
  { bg: '#000000', accent1: '#FF3B30', accent2: '#FFD700' },
  { bg: '#F8F9FA', accent1: '#2563EB', accent2: '#4B5563' },
];

interface SeedSpec {
  slotIndex: SlotIndex;
  daysAgo: number;
  topic: string;
  hook: string;
  formatType: string;
  hookFormulaId: HookFormulaId;
  ctaId: CtaId;
  topicCategory: TopicCategory;
  narrativeArc: NarrativeArc;
  coverVisualStyle: string;
  visualStylesUsed: string[];
  portraitSubjects: string[];
  dominantSubjectClass: DominantSubjectClass;
  tickersFeatured: string[];
  keywords: string[];
}

const SEEDS: SeedSpec[] = [
  // Day -4 (oldest)
  { slotIndex: 1, daysAgo: 4, topic: 'NVDA earnings reaction', hook: 'NVDA beat. Here is what changed.', formatType: 'PHOTOREALISTIC_NEWS_FLASH', hookFormulaId: 'CALENDAR_TRIGGER', ctaId: 'follow_authority', topicCategory: 'EARNINGS', narrativeArc: 'SCOREBOARD_WHY_SOWHAT_CTA', coverVisualStyle: 'ARCHITECTURAL_OVERLAY', visualStylesUsed: ['ARCHITECTURAL_OVERLAY', 'LINE_CHART', 'COMPARISON_TABLE', 'MINIMALIST_CHECKLIST'], portraitSubjects: ['jensen_huang'], dominantSubjectClass: 'CHART', tickersFeatured: ['NVDA'], keywords: ['NVDA earnings', 'AI chips'] },
  { slotIndex: 2, daysAgo: 4, topic: 'Berkshire 13F deltas', hook: "I pulled Buffett's latest 13F.", formatType: 'PHOTOREALISTIC_EXPERT_SHOCK', hookFormulaId: 'RECEIPT_DROP', ctaId: 'share_use_case', topicCategory: 'CAP_TABLE', narrativeArc: 'RECEIPT_DROP_BREAKDOWN_TAKEAWAY_CTA', coverVisualStyle: 'PORTFOLIO_DOUGHNUT_PORTRAIT', visualStylesUsed: ['PORTFOLIO_DOUGHNUT_PORTRAIT', 'CAP_TABLE_GRID', 'COMPARISON_TABLE'], portraitSubjects: ['buffett'], dominantSubjectClass: 'PORTRAIT', tickersFeatured: ['BRK.B', 'AAPL'], keywords: ['Berkshire', '13F', 'Buffett'] },
  { slotIndex: 3, daysAgo: 4, topic: 'XEQT vs VFV breakdown', hook: 'XEQT vs VFV in 2026: the real winner', formatType: 'PHOTOREALISTIC_MARKET_UPDATE', hookFormulaId: 'COMPARISON_LADDER', ctaId: 'save_specific', topicCategory: 'HOW_TO', narrativeArc: 'DECISION_FORK_CRITERIA_CHECKLIST_CTA', coverVisualStyle: 'BAR_CHART_HORIZONTAL', visualStylesUsed: ['BAR_CHART_HORIZONTAL', 'DONUT_CHART', 'MINIMALIST_CHECKLIST'], portraitSubjects: [], dominantSubjectClass: 'CHART', tickersFeatured: [], keywords: ['XEQT', 'VFV', 'ETF comparison'] },
  { slotIndex: 4, daysAgo: 4, topic: 'Renting vs buying myth', hook: 'Buying always beats renting is wrong.', formatType: 'PHOTOREALISTIC_MINIMAL_TECH', hookFormulaId: 'MYTH_STRIKE', ctaId: 'question_open', topicCategory: 'HOUSING', narrativeArc: 'MYTH_FACT_PROOF_CTA', coverVisualStyle: 'GLOWING_QUOTE', visualStylesUsed: ['GLOWING_QUOTE', 'COMPARISON_TABLE', 'LINE_CHART'], portraitSubjects: [], dominantSubjectClass: 'TYPOGRAPHY', tickersFeatured: [], keywords: ['housing', 'renting', 'opportunity cost'] },
  { slotIndex: 5, daysAgo: 4, topic: '$10k in NVDA 5 years ago', hook: 'What $10k in NVIDIA 5 years ago looks like', formatType: 'PHOTOREALISTIC_LUXURY_LIFESTYLE', hookFormulaId: 'TIME_CAPSULE', ctaId: 'share_use_case', topicCategory: 'BEHAVIORAL', narrativeArc: 'TIMECAPSULE_SETUP_RESULT_LESSON_CTA', coverVisualStyle: 'LUXURY_LIFESTYLE', visualStylesUsed: ['LUXURY_LIFESTYLE', 'PRICE_TIMELINE_ANNOTATED', 'TYPOGRAPHIC_MEGA_NUMBER'], portraitSubjects: [], dominantSubjectClass: 'METAPHOR_OBJECT', tickersFeatured: ['NVDA'], keywords: ['hypothetical', 'NVIDIA', 'time capsule'] },

  // Day -3
  { slotIndex: 1, daysAgo: 3, topic: 'Fed rate decision preview', hook: 'Before the Fed decision, check this.', formatType: 'PHOTOREALISTIC_MARKET_UPDATE', hookFormulaId: 'CALENDAR_TRIGGER', ctaId: 'save_specific', topicCategory: 'MACRO', narrativeArc: 'HOOK_PROBLEM_REVEAL_FRAMEWORK_CTA', coverVisualStyle: 'TRADER_DESK_SILHOUETTE', visualStylesUsed: ['TRADER_DESK_SILHOUETTE', 'MACRO_FLOW_DIAGRAM', 'MINIMALIST_CHECKLIST'], portraitSubjects: ['powell'], dominantSubjectClass: 'PORTRAIT', tickersFeatured: [], keywords: ['Fed', 'rate decision', 'macro'] },
  { slotIndex: 2, daysAgo: 3, topic: 'Pelosi recent disclosures', hook: "What Nancy Pelosi disclosed this month", formatType: 'PHOTOREALISTIC_EXPERT_SHOCK', hookFormulaId: 'BEHIND_THE_SCENES', ctaId: 'comment_genuine_question', topicCategory: 'CAP_TABLE', narrativeArc: 'RECEIPT_DROP_BREAKDOWN_TAKEAWAY_CTA', coverVisualStyle: 'EXPERT_CUTOUT', visualStylesUsed: ['EXPERT_CUTOUT', 'CAP_TABLE_GRID', 'COMPARISON_TABLE'], portraitSubjects: ['pelosi'], dominantSubjectClass: 'PORTRAIT', tickersFeatured: ['NVDA', 'PLTR'], keywords: ['Pelosi', 'STOCK Act', 'political disclosure'] },
  { slotIndex: 3, daysAgo: 3, topic: 'How a 1% MER compounds', hook: '1% MER sounds small. Here is the math.', formatType: 'PHOTOREALISTIC_MINIMAL_TECH', hookFormulaId: 'QUIET_COMPOUNDER', ctaId: 'save_specific', topicCategory: 'TAX_ACCT', narrativeArc: 'DECISION_FORK_CRITERIA_CHECKLIST_CTA', coverVisualStyle: 'TYPOGRAPHIC_MEGA_NUMBER', visualStylesUsed: ['TYPOGRAPHIC_MEGA_NUMBER', 'LINE_CHART', 'COMPARISON_TABLE'], portraitSubjects: [], dominantSubjectClass: 'TYPOGRAPHY', tickersFeatured: [], keywords: ['MER', 'compounding', 'fees'] },
  { slotIndex: 4, daysAgo: 3, topic: 'Survivorship bias in stock-picking', hook: "If you'd skipped GameStop and bought the index", formatType: 'PHOTOREALISTIC_EXPERT_SHOCK', hookFormulaId: 'REVERSE_SURVIVORSHIP', ctaId: 'share_use_case', topicCategory: 'BEHAVIORAL', narrativeArc: 'TIMECAPSULE_SETUP_RESULT_LESSON_CTA', coverVisualStyle: 'TYPOGRAPHIC_MEGA_NUMBER', visualStylesUsed: ['TYPOGRAPHIC_MEGA_NUMBER', 'PRICE_TIMELINE_ANNOTATED', 'COMPARISON_TABLE'], portraitSubjects: [], dominantSubjectClass: 'TYPOGRAPHY', tickersFeatured: ['GME'], keywords: ['survivorship bias', 'hypothetical', 'GameStop'] },
  { slotIndex: 5, daysAgo: 3, topic: 'DALBAR behavior gap', hook: 'Average investor vs the index they held', formatType: 'PHOTOREALISTIC_LUXURY_LIFESTYLE', hookFormulaId: 'COHORT_TRUTH', ctaId: 'reference_save', topicCategory: 'BEHAVIORAL', narrativeArc: 'SCOREBOARD_WHY_SOWHAT_CTA', coverVisualStyle: 'LUXURY_LIFESTYLE', visualStylesUsed: ['LUXURY_LIFESTYLE', 'LINE_CHART', 'COMPARISON_TABLE'], portraitSubjects: [], dominantSubjectClass: 'METAPHOR_OBJECT', tickersFeatured: [], keywords: ['DALBAR', 'behavior gap', 'investor returns'] },

  // Day -2
  { slotIndex: 1, daysAgo: 2, topic: 'AMD earnings preview', hook: 'AMD reports tonight. The setup.', formatType: 'PHOTOREALISTIC_NEWS_FLASH', hookFormulaId: 'CALENDAR_TRIGGER', ctaId: 'follow_authority', topicCategory: 'EARNINGS', narrativeArc: 'SCOREBOARD_WHY_SOWHAT_CTA', coverVisualStyle: 'EARNINGS_CARD', visualStylesUsed: ['EARNINGS_CARD', 'BAR_CHART_HORIZONTAL', 'COMPARISON_TABLE'], portraitSubjects: ['lisa_su'], dominantSubjectClass: 'CHART', tickersFeatured: ['AMD'], keywords: ['AMD', 'earnings', 'chips'] },
  { slotIndex: 2, daysAgo: 2, topic: 'Who owns Canadian banks', hook: 'Who actually owns Canadian banks?', formatType: 'PHOTOREALISTIC_EXPERT_SHOCK', hookFormulaId: 'CAP_TABLE', ctaId: 'save_specific', topicCategory: 'CAP_TABLE', narrativeArc: 'HOOK_PROBLEM_REVEAL_FRAMEWORK_CTA', coverVisualStyle: 'INSTITUTIONAL_FLOW_SANKEY', visualStylesUsed: ['INSTITUTIONAL_FLOW_SANKEY', 'CAP_TABLE_GRID', 'COMPARISON_TABLE'], portraitSubjects: ['seasoned_canadian_banker'], dominantSubjectClass: 'CHART', tickersFeatured: ['RY.TO', 'TD.TO', 'BNS.TO'], keywords: ['Canadian banks', 'institutional ownership', 'Big Five'] },
  { slotIndex: 3, daysAgo: 2, topic: 'TFSA vs RRSP first', hook: 'Most Canadians pick the wrong account first.', formatType: 'PHOTOREALISTIC_MARKET_UPDATE', hookFormulaId: 'DECISION_FORK', ctaId: 'reference_save', topicCategory: 'TAX_ACCT', narrativeArc: 'DECISION_FORK_CRITERIA_CHECKLIST_CTA', coverVisualStyle: 'MINIMALIST_CHECKLIST', visualStylesUsed: ['MINIMALIST_CHECKLIST', 'COMPARISON_TABLE', 'MAP_DATA_OVERLAY'], portraitSubjects: [], dominantSubjectClass: 'TYPOGRAPHY', tickersFeatured: [], keywords: ['TFSA', 'RRSP', 'FHSA'] },
  { slotIndex: 4, daysAgo: 2, topic: 'Hot stock chase risk checklist', hook: 'Before chasing momentum, check these 4.', formatType: 'PHOTOREALISTIC_MINIMAL_TECH', hookFormulaId: 'PREMIUM_CONTRARIAN', ctaId: 'question_open', topicCategory: 'BEHAVIORAL', narrativeArc: 'MYTH_FACT_PROOF_CTA', coverVisualStyle: 'GRUNGE_STREET_POSTER', visualStylesUsed: ['MAGAZINE_COVER', 'MINIMALIST_CHECKLIST', 'COMPARISON_TABLE'], portraitSubjects: [], dominantSubjectClass: 'TYPOGRAPHY', tickersFeatured: [], keywords: ['risk', 'hot stocks', 'checklist'] },
  { slotIndex: 5, daysAgo: 2, topic: 'Three accounts same ETF', hook: 'Same ETF, three accounts. Look what you keep.', formatType: 'PHOTOREALISTIC_LUXURY_LIFESTYLE', hookFormulaId: 'TAX_DRAG', ctaId: 'save_specific', topicCategory: 'TAX_ACCT', narrativeArc: 'TIMECAPSULE_SETUP_RESULT_LESSON_CTA', coverVisualStyle: 'LUXURY_LIFESTYLE', visualStylesUsed: ['LUXURY_LIFESTYLE', 'COMPARISON_TABLE', 'MAP_DATA_OVERLAY'], portraitSubjects: [], dominantSubjectClass: 'METAPHOR_OBJECT', tickersFeatured: [], keywords: ['ETF', 'tax drag', 'account selection'] },

  // Day -1 (most recent)
  { slotIndex: 1, daysAgo: 1, topic: 'TSX rebalance', hook: 'TSX is changing. Here is what.', formatType: 'PHOTOREALISTIC_MARKET_UPDATE', hookFormulaId: 'ANTI_FOMO', ctaId: 'follow_authority', topicCategory: 'MACRO', narrativeArc: 'SCOREBOARD_WHY_SOWHAT_CTA', coverVisualStyle: 'TICKER_TAPE_HERO', visualStylesUsed: ['TICKER_TAPE_HERO', 'HEATMAP_GRID', 'COMPARISON_TABLE'], portraitSubjects: [], dominantSubjectClass: 'CHART', tickersFeatured: ['SHOP.TO'], keywords: ['TSX', 'index rebalance'] },
  { slotIndex: 2, daysAgo: 1, topic: 'Norges Bank Canadian holdings', hook: "What Norway's $1.7T fund owns in Canada", formatType: 'PHOTOREALISTIC_EXPERT_SHOCK', hookFormulaId: 'CAP_TABLE', ctaId: 'share_use_case', topicCategory: 'CAP_TABLE', narrativeArc: 'RECEIPT_DROP_BREAKDOWN_TAKEAWAY_CTA', coverVisualStyle: 'CIRCULAR_PORTFOLIO_WHEEL', visualStylesUsed: ['CIRCULAR_PORTFOLIO_WHEEL', 'CAP_TABLE_GRID', 'POSITION_CONCENTRATION_TREEMAP'], portraitSubjects: ['silver_haired_pm'], dominantSubjectClass: 'CHART', tickersFeatured: ['SHOP.TO', 'RY.TO'], keywords: ['Norway sovereign wealth', 'Canadian holdings'] },
  { slotIndex: 3, daysAgo: 1, topic: "What's inside XEQT", hook: "What is actually inside XEQT", formatType: 'PHOTOREALISTIC_MINIMAL_TECH', hookFormulaId: 'IF_THEN_LADDER', ctaId: 'save_specific', topicCategory: 'HOW_TO', narrativeArc: 'HOOK_PROBLEM_REVEAL_FRAMEWORK_CTA', coverVisualStyle: 'DONUT_CHART', visualStylesUsed: ['DONUT_CHART', 'BAR_CHART_HORIZONTAL', 'CAP_TABLE_GRID'], portraitSubjects: [], dominantSubjectClass: 'CHART', tickersFeatured: [], keywords: ['XEQT', 'ETF holdings'] },
  { slotIndex: 4, daysAgo: 1, topic: 'Buyback signal vs reality', hook: "Buybacks aren't a buy signal. Here's why.", formatType: 'PHOTOREALISTIC_EXPERT_SHOCK', hookFormulaId: 'MYTH_STRIKE', ctaId: 'comment_genuine_question', topicCategory: 'EARNINGS', narrativeArc: 'MYTH_FACT_PROOF_CTA', coverVisualStyle: 'EXPERT_CUTOUT', visualStylesUsed: ['EXPERT_CUTOUT', 'COMPARISON_TABLE', 'LINE_CHART'], portraitSubjects: ['michael_burry'], dominantSubjectClass: 'PORTRAIT', tickersFeatured: ['AAPL'], keywords: ['buybacks', 'myth', 'capital allocation'] },
  { slotIndex: 5, daysAgo: 1, topic: 'First $100k psychology', hook: 'The first $100k feels slow. Here is why.', formatType: 'PHOTOREALISTIC_LUXURY_LIFESTYLE', hookFormulaId: 'QUIET_COMPOUNDER', ctaId: 'reference_save', topicCategory: 'BEHAVIORAL', narrativeArc: 'TIMECAPSULE_SETUP_RESULT_LESSON_CTA', coverVisualStyle: 'NATURE_METAPHOR', visualStylesUsed: ['NATURE_METAPHOR', 'AREA_CHART', 'MINIMALIST_CHECKLIST'], portraitSubjects: [], dominantSubjectClass: 'METAPHOR_OBJECT', tickersFeatured: [], keywords: ['first 100k', 'compounding psychology'] },
];

function ymd(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function main() {
  const historyPath = process.env.CONTENT_HISTORY_PATH
    || path.join(__dirname, '..', 'content-history.json');

  console.log(`[migrate-history] Target: ${historyPath}`);
  console.log(`[migrate-history] Loading existing history (will auto-migrate schema if v1)...`);
  const before = loadContentHistory(historyPath);
  console.log(`[migrate-history] Loaded ${before.length} entries. Adding ${SEEDS.length} seed entries.`);

  for (const seed of SEEDS) {
    const entry: ContentHistoryEntry = {
      date: ymd(seed.daysAgo),
      topic: seed.topic,
      hook: seed.hook,
      format: 'CAROUSEL',
      formatType: seed.formatType,
      slideCount: 7,
      keywords: seed.keywords,
      visualSignature: `seed_${ymd(seed.daysAgo)}_s${seed.slotIndex}`,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      slotIndex: seed.slotIndex,
      postedAtUtc: new Date().toISOString(),
      tickersFeatured: seed.tickersFeatured,
      topicCategory: seed.topicCategory,
      hookFormulaId: seed.hookFormulaId,
      ctaId: seed.ctaId,
      narrativeArc: seed.narrativeArc,
      visualStylesUsed: seed.visualStylesUsed,
      coverVisualStyle: seed.coverVisualStyle,
      portraitSubjects: seed.portraitSubjects.filter((s) => !s.startsWith('silver_') && !s.startsWith('female_') && !s.startsWith('young_') && !s.startsWith('seasoned_') && !s.startsWith('crypto_') && !s.startsWith('boomer_') && !s.startsWith('retiree_') && !s.startsWith('millennial_') && !s.startsWith('immigrant_') && !s.startsWith('quiet_') && !s.startsWith('canadian_uni')),
      archetypesUsed: seed.portraitSubjects.filter((s) => s.startsWith('silver_') || s.startsWith('female_') || s.startsWith('young_') || s.startsWith('seasoned_') || s.startsWith('crypto_') || s.startsWith('boomer_') || s.startsWith('retiree_') || s.startsWith('millennial_') || s.startsWith('immigrant_') || s.startsWith('quiet_') || s.startsWith('canadian_uni')),
      dominantSubjectClass: seed.dominantSubjectClass,
      seed: true,
    };
    appendContentHistory(historyPath, entry);
  }

  const after = loadContentHistory(historyPath);
  console.log(`[migrate-history] Done. History now has ${after.length} entries (${after.filter((e) => e.seed).length} marked seed).`);
}

main();
