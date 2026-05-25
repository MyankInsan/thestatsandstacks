import fs from 'fs';
import path from 'path';

export interface ContentHistoryEntry {
  date: string;
  topic: string;
  hook: string;
  format: string;
  formatType?: string;   // e.g. 'BREAKING_NEWS' | 'HUMOR_MEME' etc.
  slideCount: number;
  keywords: string[];
  visualSignature?: string;
}

export function loadContentHistory(historyPath: string): ContentHistoryEntry[] {
  try {
    if (!fs.existsSync(historyPath)) return [];
    const parsed = JSON.parse(fs.readFileSync(historyPath, 'utf-8')) as ContentHistoryEntry[];
    return Array.isArray(parsed) ? parsed.filter(isHistoryEntry) : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[ContentHistory] Could not read history at ${historyPath}: ${message}`);
    return [];
  }
}

export function appendContentHistory(historyPath: string, entry: ContentHistoryEntry): void {
  const history = loadContentHistory(historyPath);
  const next = [...history.filter((item) => item.date !== entry.date), entry].slice(-100);
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  fs.writeFileSync(historyPath, `${JSON.stringify(next, null, 2)}\n`, 'utf-8');
}

export function getRecentTopics(history: ContentHistoryEntry[], limit = 14): string[] {
  return history
    .slice(-limit)
    .map((entry) => entry.topic)
    .filter(Boolean);
}

export function noveltyPenalty(topic: string, history: ContentHistoryEntry[]): number {
  const normalized = normalizeTopic(topic);
  if (!normalized) return 0;

  const recent = history.slice(-14).reverse();
  for (let index = 0; index < recent.length; index++) {
    const candidate = normalizeTopic(recent[index].topic);
    if (!candidate) continue;
    const similarity = jaccardSimilarity(normalized, candidate);
    if (similarity >= 0.72) return 0.22;
    if (similarity >= 0.52) return Math.max(0.08, 0.16 - index * 0.01);
  }

  return 0;
}

export function isTooSimilarToRecent(topic: string, history: ContentHistoryEntry[], limit = 10): boolean {
  const normalized = normalizeTopic(topic);
  if (!normalized) return false;
  return history.slice(-limit).some((entry) => jaccardSimilarity(normalized, normalizeTopic(entry.topic)) >= 0.62);
}

export function normalizeTopic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .join(' ');
}

function jaccardSimilarity(a: string, b: string): number {
  const aSet = new Set(a.split(/\s+/).filter(Boolean));
  const bSet = new Set(b.split(/\s+/).filter(Boolean));
  if (aSet.size === 0 || bSet.size === 0) return 0;

  let intersection = 0;
  for (const item of aSet) {
    if (bSet.has(item)) intersection++;
  }

  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function isHistoryEntry(value: unknown): value is ContentHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<ContentHistoryEntry>;
  return typeof entry.date === 'string'
    && typeof entry.topic === 'string'
    && typeof entry.format === 'string'
    && typeof entry.slideCount === 'number';
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'before',
  'after',
  'your',
  'you',
  'canada',
  'canadian',
  'should',
  'this',
  'that',
  'into',
  'from',
  'what',
  'which',
  'when',
  'where',
  'these',
  'those',
  'still',
]);
