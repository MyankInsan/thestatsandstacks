import { BaseAgent } from './interfaces';
import type { ContentHistoryEntry } from '../services/contentHistory';
import type { SlotIndex } from './slotConfig';
import type { ViralStyle } from './promptLibrary';
import type { HookFormulaId } from './hookFormulas';
import type { AngleId } from './topicAngleAgent';

export interface MustAvoidSet {
  visualStyles: ViralStyle[];
  portraitSubjects: string[];
  archetypes: string[];
  hookFormulas: HookFormulaId[];
  tickers: string[];
  narrativeArcs: string[];
  angles: AngleId[];
  colorTriples: string[];
}

export interface HistoryGuardResult {
  block: boolean;
  conflictsWith?: string;
  conflictDate?: string;
  suggestedPivot?: string;
  mustAvoid: MustAvoidSet;
  warnings: string[];
}

const BLOCK_THRESHOLD = 0.52;
const HARD_BLOCK_JACCARD = 0.72;
const WINDOW_DAYS = 50;

export class HistoryGuardAgent extends BaseAgent {
  constructor() {
    super('HistoryGuardAgent');
  }

  async execute(input: {
    topic: string;
    contentHistory: ContentHistoryEntry[];
    slotIndex?: SlotIndex;
    todayDateKey?: string;
  }): Promise<HistoryGuardResult> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
    const windowedHistory = input.contentHistory.filter(
      (e) => new Date(e.date) >= cutoff,
    );

    const warnings: string[] = [];
    const mustAvoid = computeMustAvoid(input.contentHistory, input.todayDateKey, warnings);

    const normalized = normalizeWords(input.topic);
    for (const entry of windowedHistory) {
      const entryNorm = normalizeWords(entry.topic);
      const intersectionTopic = new Set([...normalized].filter((x) => entryNorm.has(x)));
      const topicSimilarity = jaccardSimilarity(normalized, entryNorm);
      
      const keywordWords = new Set<string>();
      for (const k of entry.keywords ?? []) {
        for (const w of normalizeWords(k)) {
          keywordWords.add(w);
        }
      }
      const intersectionKeyword = new Set([...normalized].filter((x) => keywordWords.has(x)));
      const keywordSimilarity = jaccardSimilarity(normalized, keywordWords);

      const topicOverlap = normalized.size > 0 ? intersectionTopic.size / normalized.size : 0;
      const keywordOverlap = normalized.size > 0 ? intersectionKeyword.size / normalized.size : 0;
      
      const similarity = Math.max(topicSimilarity, keywordSimilarity, topicOverlap, keywordOverlap);

      if (similarity >= HARD_BLOCK_JACCARD) {
        const pivot = buildPivotSuggestion(input.topic, entry.topic);
        console.log(`[${this.name}] Hard block — "${input.topic}" too similar to "${entry.topic}" (score ${similarity.toFixed(2)}, overlap ${Math.max(topicOverlap, keywordOverlap).toFixed(2)}). Pivot: ${pivot}`);
        return {
          block: true,
          conflictsWith: entry.topic,
          conflictDate: entry.date,
          suggestedPivot: pivot,
          mustAvoid,
          warnings,
        };
      }
      if (similarity >= BLOCK_THRESHOLD) {
        const pivot = buildPivotSuggestion(input.topic, entry.topic);
        console.log(`[${this.name}] Soft block — "${input.topic}" similar to "${entry.topic}" (score ${similarity.toFixed(2)}, overlap ${Math.max(topicOverlap, keywordOverlap).toFixed(2)}). Pivot: ${pivot}`);
        return {
          block: true,
          conflictsWith: entry.topic,
          conflictDate: entry.date,
          suggestedPivot: pivot,
          mustAvoid,
          warnings,
        };
      }
    }

    return { block: false, mustAvoid, warnings };
  }
}

const MAX_EXCLUSION_RATIO = 0.6;

function computeMustAvoid(
  history: ContentHistoryEntry[],
  _todayDateKey: string | undefined,
  warnings: string[],
): MustAvoidSet {
  const last3 = history.slice(-3);
  const last4 = history.slice(-4);
  const last6 = history.slice(-6);
  const last10 = history.slice(-10);
  const last35 = history.slice(-35);

  const visualStyles = unique(last6.flatMap((e) => (e.coverVisualStyle ? [e.coverVisualStyle] : []))) as ViralStyle[];
  const portraitSubjects = unique(last10.flatMap((e) => e.portraitSubjects ?? []));
  const archetypes = unique(last10.flatMap((e) => e.archetypesUsed ?? []));
  const hookFormulas = unique(last3.flatMap((e) => (e.hookFormulaId ? [e.hookFormulaId] : []))) as HookFormulaId[];
  const tickers = unique(last4.flatMap((e) => e.tickersFeatured ?? []));
  const narrativeArcs = unique(last3.flatMap((e) => (e.narrativeArc ? [e.narrativeArc] : [])));
  const colorTriples = unique(last4.flatMap((e) => (e.colorSchemeUsed ? [colorTripleKey(e.colorSchemeUsed)] : [])));

  const reactiveCount = last35.filter((e) => e.angleId === 'REACTIVE_SENTIMENT').length;
  const editorialCaricatureCount = history.slice(-5).filter((e) => e.coverVisualStyle === 'EDITORIAL_REACTION_CARICATURE').length;

  const angles: AngleId[] = [];
  if (reactiveCount >= 1) {
    angles.push('REACTIVE_SENTIMENT');
    warnings.push(`REACTIVE_SENTIMENT used ${reactiveCount}x in last 35 posts — capped at 1/7d.`);
  }
  if (editorialCaricatureCount >= 1) {
    visualStyles.push('EDITORIAL_REACTION_CARICATURE');
  }

  return {
    visualStyles,
    portraitSubjects,
    archetypes,
    hookFormulas,
    tickers,
    narrativeArcs,
    angles,
    colorTriples,
  };
}

function colorTripleKey(scheme: { bg: string; accent1: string; accent2: string }): string {
  return `${scheme.bg}|${scheme.accent1}|${scheme.accent2}`;
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

function stem(word: string): string {
  if (word.length > 3 && word.endsWith('s')) {
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('es') && !word.endsWith('aes') && !word.endsWith('ees') && !word.endsWith('oes')) {
      return word.slice(0, -2);
    }
    return word.slice(0, -1);
  }
  return word;
}

function normalizeWords(text: string): Set<string> {
  const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'is', 'are', 'to', 'of', 'in', 'for', 'on', 'with', 'how', 'vs', 'versus', 'which', 'better', 'best', 'what', 'why', 'when', 'where', 'who']);
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
      .map(stem),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

function buildPivotSuggestion(topic: string, conflict: string): string {
  return `Try a different angle on this topic — for example, instead of comparing account types, focus on a single lesser-known rule or a case study. (Blocked by: "${conflict}")`;
}

void MAX_EXCLUSION_RATIO;
