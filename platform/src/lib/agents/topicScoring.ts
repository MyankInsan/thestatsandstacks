import type { ContentHistoryEntry } from '../services/contentHistory';
import { bestSourceTier } from './researchEvidenceGate';

/**
 * Concept-family classification + engagement scoring.
 *
 * The old dedup was title-Jaccard only, which misses "same concept, reworded"
 * (the reason TFSA/HISA/Credit-Myths re-ran twice a week). `inferTopicFamily`
 * maps a free-text title to a stable family enum so a real ~21-day cooldown can
 * bite. `topicEngagementAdjustment` adds the NEW ranking signals (source tier,
 * freshness shape, family cooldown) on top of the existing region/shape bonuses,
 * so verified, recent, US-weighted topics rise and stale evergreen sinks.
 */

export type TopicFamily =
  | 'ACCT_COMPARISON'
  | 'CREDIT'
  | 'BUDGET_BEHAVIOR'
  | 'INDEX_MOVE'
  | 'SINGLE_STOCK'
  | 'CRYPTO'
  | 'IPO'
  | 'MACRO'
  | 'CAP_TABLE'
  | 'HYPOTHETICAL_RETURN'
  | 'DIVIDEND'
  | 'ETF_FEES'
  | 'INVESTOR_PROTECTION'
  | 'GENERAL';

export const TOPIC_FAMILIES: readonly TopicFamily[] = [
  'ACCT_COMPARISON', 'CREDIT', 'BUDGET_BEHAVIOR', 'INDEX_MOVE', 'SINGLE_STOCK',
  'CRYPTO', 'IPO', 'MACRO', 'CAP_TABLE', 'HYPOTHETICAL_RETURN', 'DIVIDEND',
  'ETF_FEES', 'INVESTOR_PROTECTION', 'GENERAL',
];

/**
 * Deterministic family classifier. Order matters: the most specific / most
 * "timely" shapes are tested first so a news title about Nvidia doesn't get
 * mislabeled as a generic explainer.
 */
export function inferTopicFamily(title: string, keywords: string[] = [], angleId?: string): TopicFamily {
  const text = `${title} ${keywords.join(' ')} ${angleId ?? ''}`.toLowerCase();

  if (/\b(ipo|s-1\b|s1 filing|go public|going public|prospectus|424b)\b/.test(text)) return 'IPO';
  if (/\b(bitcoin|btc|ethereum|\beth\b|crypto|solana|altcoin|stablecoin|coinbase)\b/.test(text)) return 'CRYPTO';
  if (/\b(if you invested|years ago|what \$?[\d,]+ in|would be worth|became over)\b/.test(text)) return 'HYPOTHETICAL_RETURN';
  if (/\b(13f|holdings|who owns|cap[- ]?table|insider|politician|pelosi|congress|buyback|sovereign wealth|pension)\b/.test(text)) return 'CAP_TABLE';
  if (/\b(s&p 500|sp500|nasdaq|dow|tsx|vix|index|market close|selloff|sell-off|rally|market today|5-year high|volatility)\b/.test(text)) return 'INDEX_MOVE';
  if (/\b(fed|federal reserve|fomc|rate (cut|hike|decision)|inflation|tariff|recession|gdp|jobs report|macro)\b/.test(text)) return 'MACRO';
  if (/\b(tfsa|rrsp|fhsa|401k|401\(k\)|roth ira|traditional ira|account should)\b/.test(text)) return 'ACCT_COMPARISON';
  if (/\b(credit score|credit card|credit myth|debt|utilization)\b/.test(text)) return 'CREDIT';
  if (/\b(dividend)\b/.test(text)) return 'DIVIDEND';
  if (/\b(etf|expense ratio|fee|fees|index fund|vfv|vsp|cash\.to)\b/.test(text)) return 'ETF_FEES';
  if (/\b(finfluencer|red flag|scam|guaranteed|risk filter|risk checklist|protect)\b/.test(text)) return 'INVESTOR_PROTECTION';
  if (/\b(money leak|budget|payday|spending|overspend|save more|emergency fund|lifestyle creep)\b/.test(text)) return 'BUDGET_BEHAVIOR';
  // A title naming a ticker in parens or a marquee company → single-stock catalyst.
  if (/\([\^A-Z]{1,6}\)|\b(nvidia|tesla|apple|microsoft|amazon|meta|alphabet|broadcom|amd|palantir|earnings|heat check|catalyst)\b/.test(text)) return 'SINGLE_STOCK';
  return 'GENERAL';
}

/**
 * Penalty for re-running a concept family too soon. Evergreen families get a long
 * cooldown (so TFSA/credit/etc. can't repeat within ~3 weeks); timely news
 * families (index moves, single stocks, crypto, IPO, macro) get a much shorter
 * cooldown because fresh catalysts legitimately recur.
 */
const TIMELY_FAMILIES: ReadonlySet<TopicFamily> = new Set<TopicFamily>([
  'INDEX_MOVE', 'SINGLE_STOCK', 'CRYPTO', 'IPO', 'MACRO',
]);

export function familyCooldownPenalty(
  family: TopicFamily,
  history: ContentHistoryEntry[],
  today: string,
  evergreenDays = 21,
  timelyDays = 2,
): number {
  if (family === 'GENERAL') return 0;
  const windowDays = TIMELY_FAMILIES.has(family) ? timelyDays : evergreenDays;
  const cutoff = shiftDate(today, -windowDays);

  let penalty = 0;
  for (const e of history) {
    if (!e.date || e.date < cutoff) continue;
    const entryFamily = (e.topicFamily as TopicFamily | undefined) ?? inferTopicFamily(e.topic ?? '', e.keywords ?? []);
    if (entryFamily !== family) continue;
    // Closer (more recent) repeats are penalized harder.
    const ageDays = Math.max(0, daysBetween(e.date, today));
    const recencyWeight = 1 - Math.min(1, ageDays / windowDays);
    penalty = Math.max(penalty, 0.08 + 0.18 * recencyWeight);
  }
  return Number(penalty.toFixed(3));
}

export interface EngagementInput {
  title: string;
  keywords?: string[];
  sourceUrls?: string[];
  freshnessSignal?: string;
  angleId?: string;
  history: ContentHistoryEntry[];
  today: string;
}

/**
 * Additive ranking delta from the NEW signals (kept separate from the existing
 * region/shape `growthScoreAdjustment` to avoid double-counting): source trust,
 * a timeliness shape bonus, and the concept-family cooldown.
 */
export function topicEngagementAdjustment(input: EngagementInput): number {
  let adj = 0;

  const tier = bestSourceTier(input.sourceUrls);
  adj += tier === 'OFFICIAL' ? 0.045
    : tier === 'MARKET_DATA' ? 0.04
      : tier === 'REPUTABLE_PRESS' ? 0.025
        : tier === 'AGGREGATED' ? -0.03
          : 0;

  const t = `${input.title} ${input.freshnessSignal ?? ''}`.toLowerCase();
  const looksTimely = /\b(today|in the news|24 hours|last 24|heat check|drops|surges|selloff|rally|filing|filed|move|spiking|this week|catalyst)\b/.test(t);
  if (looksTimely && (tier === 'OFFICIAL' || tier === 'MARKET_DATA' || tier === 'REPUTABLE_PRESS')) adj += 0.03;

  adj -= familyCooldownPenalty(inferTopicFamily(input.title, input.keywords, input.angleId), input.history, input.today);

  return Number(adj.toFixed(3));
}

// ── date helpers (YYYY-MM-DD string math, UTC-safe) ──────────────────────────

function shiftDate(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.round((db - da) / 86_400_000);
}
