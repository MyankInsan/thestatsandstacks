// platform/src/lib/agents/historyGuardAgent.ts
import { BaseAgent } from './interfaces';
import type { ContentHistoryEntry } from '../services/contentHistory';

export interface HistoryGuardResult {
  block: boolean;
  conflictsWith?: string;
  conflictDate?: string;
  suggestedPivot?: string;
}

const BLOCK_THRESHOLD = 0.52;
const WINDOW_DAYS = 50;

export class HistoryGuardAgent extends BaseAgent {
  constructor() {
    super('HistoryGuardAgent');
  }

  async execute(input: {
    topic: string;
    contentHistory: ContentHistoryEntry[];
  }): Promise<HistoryGuardResult> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
    const windowedHistory = input.contentHistory.filter(
      (e) => new Date(e.date) >= cutoff,
    );

    const normalized = normalizeWords(input.topic);
    for (const entry of windowedHistory) {
      const entryNorm = normalizeWords(entry.topic);
      const topicSimilarity = jaccardSimilarity(normalized, entryNorm);
      // Also compare against curated keywords for the entry — they capture core concepts more precisely
      const keywordSet = new Set((entry.keywords ?? []).map((k) => k.toLowerCase().trim()));
      const keywordSimilarity = jaccardSimilarity(normalized, keywordSet);
      const similarity = Math.max(topicSimilarity, keywordSimilarity);
      if (similarity >= BLOCK_THRESHOLD) {
        const pivot = buildPivotSuggestion(input.topic, entry.topic);
        console.log(`[${this.name}] Blocked — "${input.topic}" too similar to "${entry.topic}" (score ${similarity.toFixed(2)}). Pivot: ${pivot}`);
        return { block: true, conflictsWith: entry.topic, conflictDate: entry.date, suggestedPivot: pivot };
      }
    }
    return { block: false };
  }
}

function normalizeWords(text: string): Set<string> {
  const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'is', 'are', 'to', 'of', 'in', 'for', 'on', 'with', 'how', 'vs', 'versus', 'which', 'better', 'best', 'what', 'why', 'when', 'where', 'who']);
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
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
