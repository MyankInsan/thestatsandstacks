import fs from 'fs';
import path from 'path';
import type { TopicCategory } from '../agents/portraitLibrary';
import type { HookFormulaId } from '../agents/hookFormulas';
import type { CtaId } from '../agents/ctaLibrary';
import type { AngleId } from '../agents/topicAngleAgent';
import type { SlotIndex } from '../agents/slotConfig';

export const CURRENT_SCHEMA_VERSION = 2;

export type NarrativeArc =
  | 'HOOK_PROBLEM_REVEAL_FRAMEWORK_CTA'
  | 'MYTH_FACT_PROOF_CTA'
  | 'SCOREBOARD_WHY_SOWHAT_CTA'
  | 'TIMECAPSULE_SETUP_RESULT_LESSON_CTA'
  | 'RECEIPT_DROP_BREAKDOWN_TAKEAWAY_CTA'
  | 'DECISION_FORK_CRITERIA_CHECKLIST_CTA';

export type DominantSubjectClass =
  | 'PORTRAIT'
  | 'CHART'
  | 'METAPHOR_OBJECT'
  | 'BUILDING'
  | 'TYPOGRAPHY'
  | 'CROWD';

export interface ContentHistoryEntry {
  date: string;
  topic: string;
  hook: string;
  format: string;
  formatType?: string;
  slideCount: number;
  keywords: string[];
  visualSignature?: string;

  schemaVersion?: number;
  slotIndex?: SlotIndex;
  postedAtUtc?: string;
  tickersFeatured?: string[];
  topicCategory?: TopicCategory;
  hookFormulaId?: HookFormulaId;
  ctaId?: CtaId;
  angleId?: AngleId;
  narrativeArc?: NarrativeArc;
  visualStylesUsed?: string[];
  coverVisualStyle?: string;
  portraitSubjects?: string[];
  archetypesUsed?: string[];
  colorSchemeUsed?: { bg: string; primaryText?: string; accent1: string; accent2: string };
  dominantSubjectClass?: DominantSubjectClass;
  seed?: boolean;
}

export interface ContentHistoryFile {
  schemaVersion?: number;
  entries?: ContentHistoryEntry[];
}

const ROLLING_WINDOW = 250;
let MIGRATION_LOGGED = false;

export function loadContentHistory(historyPath: string): ContentHistoryEntry[] {
  try {
    if (!fs.existsSync(historyPath)) return [];
    const raw = fs.readFileSync(historyPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    const entries = normalizeShape(parsed);
    const validated = entries.filter(isHistoryEntry);

    const needsMigration = !isShapeV2(parsed) || validated.some((e) => (e.schemaVersion ?? 1) < CURRENT_SCHEMA_VERSION);
    if (needsMigration) {
      const migrated = migrateToV2(validated);
      try {
        writeWithSchema(historyPath, migrated);
        if (!MIGRATION_LOGGED) {
          console.log(`[ContentHistory] Migrated ${migrated.length} entries to schemaVersion ${CURRENT_SCHEMA_VERSION}.`);
          MIGRATION_LOGGED = true;
        }
      } catch (writeErr) {
        const msg = writeErr instanceof Error ? writeErr.message : String(writeErr);
        console.warn(`[ContentHistory] In-process migration write failed (continuing with in-memory copy): ${msg}`);
      }
      return migrated;
    }

    return validated;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[ContentHistory] Could not read history at ${historyPath}: ${message}`);
    return [];
  }
}

function normalizeShape(parsed: unknown): ContentHistoryEntry[] {
  if (Array.isArray(parsed)) return parsed as ContentHistoryEntry[];
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as ContentHistoryFile).entries)) {
    return (parsed as ContentHistoryFile).entries!;
  }
  return [];
}

function isShapeV2(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  return (parsed as ContentHistoryFile).schemaVersion === CURRENT_SCHEMA_VERSION;
}

function migrateToV2(entries: ContentHistoryEntry[]): ContentHistoryEntry[] {
  return entries.map((e) => ({ ...e, schemaVersion: CURRENT_SCHEMA_VERSION }));
}

function writeWithSchema(historyPath: string, entries: ContentHistoryEntry[]): void {
  fs.mkdirSync(path.dirname(historyPath), { recursive: true });
  const payload: ContentHistoryFile = { schemaVersion: CURRENT_SCHEMA_VERSION, entries };
  fs.writeFileSync(historyPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

function dedupKey(entry: Pick<ContentHistoryEntry, 'date' | 'slotIndex'>): string {
  return `${entry.date}_s${entry.slotIndex ?? 0}`;
}

export function appendContentHistory(historyPath: string, entry: ContentHistoryEntry): void {
  const history = loadContentHistory(historyPath);
  const incomingKey = dedupKey(entry);
  const entryWithVersion: ContentHistoryEntry = {
    ...entry,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
  const next = [...history.filter((item) => dedupKey(item) !== incomingKey), entryWithVersion].slice(-ROLLING_WINDOW);
  writeWithSchema(historyPath, next);
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
  'the', 'and', 'for', 'with', 'before', 'after', 'your', 'you',
  'canada', 'canadian', 'should', 'this', 'that', 'into', 'from',
  'what', 'which', 'when', 'where', 'these', 'those', 'still',
]);

/**
 * Enum coercion helper — maps free-text Gemini output to the nearest valid
 * enum value, or returns undefined if no reasonable match exists. Prevents
 * categorical schema fields from being poisoned by bad LLM responses.
 */
export function parseEnumOrInfer<T extends string>(
  value: unknown,
  validValues: readonly T[],
): T | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  if (validValues.includes(value as T)) return value as T;
  const upper = value.toUpperCase().replace(/[\s-]/g, '_');
  if (validValues.includes(upper as T)) return upper as T;
  const lower = value.toLowerCase();
  for (const valid of validValues) {
    if (valid.toLowerCase() === lower) return valid;
    if (valid.toLowerCase().includes(lower) || lower.includes(valid.toLowerCase())) return valid;
  }
  return undefined;
}
