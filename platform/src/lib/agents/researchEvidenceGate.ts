/**
 * Research evidence gate — phase one.
 *
 * Separates semantic correctness from visual polish. A rich, polished prompt is
 * only allowed when its factual inputs are supportable. This module carries
 * claim-level review flags through the pipeline so that:
 *   - unsupported exact figures are suppressed from image prompts;
 *   - claims that need a human check (politician disclosures, record-high
 *     claims, corporate-action-sensitive returns, anomaly moves, secondary-only
 *     news) surface a visible review block in Telegram.
 *
 * This is intentionally NOT a full source-ingestion rewrite. Official-source
 * ingestion (SEC EDGAR, Bank of Canada Valet, StatCan WDS, Fed calendars,
 * House/Senate disclosures) is a follow-up spec.
 */

export type ResearchReviewFlag =
  | 'MANUAL_REVIEW_REQUIRED'
  | 'SECONDARY_ONLY_NEWS'
  | 'POLITICIAN_DISCLOSURE'
  | 'RECORD_HIGH_CLAIM'
  | 'CORPORATE_ACTION_SENSITIVE_RETURN'
  | 'ANOMALY_MOVE'
  | 'MISSING_EVIDENCE_ID'
  // Hot-topic-engine additions:
  | 'RUMOR_SINGLE_SOURCE'
  | 'UNCORROBORATED'
  | 'STALE_SIGNAL';

export const RESEARCH_REVIEW_FLAGS: readonly ResearchReviewFlag[] = [
  'MANUAL_REVIEW_REQUIRED',
  'SECONDARY_ONLY_NEWS',
  'POLITICIAN_DISCLOSURE',
  'RECORD_HIGH_CLAIM',
  'CORPORATE_ACTION_SENSITIVE_RETURN',
  'ANOMALY_MOVE',
  'MISSING_EVIDENCE_ID',
  'RUMOR_SINGLE_SOURCE',
  'UNCORROBORATED',
  'STALE_SIGNAL',
];

/** Flags that require a human to verify the claim before publishing. */
export const MANUAL_REVIEW_FLAGS: ReadonlySet<ResearchReviewFlag> = new Set<ResearchReviewFlag>([
  'MANUAL_REVIEW_REQUIRED',
  'POLITICIAN_DISCLOSURE',
  'RECORD_HIGH_CLAIM',
  'CORPORATE_ACTION_SENSITIVE_RETURN',
  'ANOMALY_MOVE',
  'SECONDARY_ONLY_NEWS',
  'RUMOR_SINGLE_SOURCE',
  'UNCORROBORATED',
]);

/**
 * Source trust tiers, highest → lowest. A topic is VERIFIED when it carries an
 * OFFICIAL/MARKET_DATA source or ≥2 independent REPUTABLE_PRESS items; an
 * AGGREGATED-only (Reddit / social / Google-News-redirect) topic is a RUMOR.
 */
export type SourceTier = 'OFFICIAL' | 'MARKET_DATA' | 'REPUTABLE_PRESS' | 'AGGREGATED' | 'UNKNOWN';

const TIER_RANK: Record<SourceTier, number> = {
  OFFICIAL: 4, MARKET_DATA: 3, REPUTABLE_PRESS: 2, AGGREGATED: 1, UNKNOWN: 0,
};

const OFFICIAL_HOST_RE = /(?:^|\.)(sec\.gov|efts\.sec\.gov|federalreserve\.gov|bankofcanada\.ca|investor\.gov|irs\.gov|canada\.ca|osc\.ca|ciro\.ca|finra\.org|statcan\.gc\.ca|treasury\.gov|bls\.gov)$/i;
const MARKET_DATA_HOST_RE = /(?:^|\.)(finance\.yahoo\.com|query1\.finance\.yahoo\.com|query2\.finance\.yahoo\.com|coingecko\.com|api\.coingecko\.com)$/i;
const PRESS_HOST_RE = /(?:^|\.)(cnbc\.com|marketwatch\.com|reuters\.com|bloomberg\.com|wsj\.com|ft\.com|barrons\.com|coindesk\.com|nasdaq\.com|businessinsider\.com|forbes\.com|cnn\.com|apnews\.com|theglobeandmail\.com|financialpost\.com)$/i;
const AGGREGATED_HOST_RE = /(?:^|\.)(reddit\.com|news\.google\.com|twitter\.com|x\.com|t\.co)$/i;

export function classifySourceTier(url: string): SourceTier {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'UNKNOWN';
  }
  if (OFFICIAL_HOST_RE.test(host) || host.endsWith('.gov')) return 'OFFICIAL';
  if (MARKET_DATA_HOST_RE.test(host)) return 'MARKET_DATA';
  if (PRESS_HOST_RE.test(host)) return 'REPUTABLE_PRESS';
  if (AGGREGATED_HOST_RE.test(host)) return 'AGGREGATED';
  return 'UNKNOWN';
}

/** Highest tier among the given source URLs (UNKNOWN if none classify). */
export function bestSourceTier(urls: readonly string[] | undefined): SourceTier {
  let best: SourceTier = 'UNKNOWN';
  for (const u of urls ?? []) {
    const t = classifySourceTier(u);
    if (TIER_RANK[t] > TIER_RANK[best]) best = t;
  }
  return best;
}

export interface VerificationResult {
  tier: SourceTier;
  /** VERIFIED, DEVELOPING (press but thin), or RUMOR (aggregated/none). */
  status: 'VERIFIED' | 'DEVELOPING' | 'RUMOR';
  flags: ResearchReviewFlag[];
}

/**
 * Deterministic verification screen over a topic's sources + freshness. Used by
 * the hot-topic collectors and the QC gate to label rumors and stale signals.
 */
export function verifyTopicSources(input: {
  sourceUrls?: string[];
  publishedAt?: string;
  /** Count of independent press items on the same claim (collector-supplied). */
  pressCorroboration?: number;
  /** True when this slot expects a fresh (<48h) topic. */
  expectsFresh?: boolean;
}): VerificationResult {
  const urls = input.sourceUrls ?? [];
  const tier = bestSourceTier(urls);
  const flags = new Set<ResearchReviewFlag>();

  let status: VerificationResult['status'];
  if (tier === 'OFFICIAL' || tier === 'MARKET_DATA') {
    status = 'VERIFIED';
  } else if (tier === 'REPUTABLE_PRESS') {
    status = (input.pressCorroboration ?? 1) >= 2 ? 'VERIFIED' : 'DEVELOPING';
  } else {
    // AGGREGATED or UNKNOWN/none.
    status = 'RUMOR';
    flags.add(urls.length > 0 ? 'RUMOR_SINGLE_SOURCE' : 'UNCORROBORATED');
  }

  if (input.expectsFresh && input.publishedAt) {
    const t = Date.parse(input.publishedAt);
    if (!Number.isNaN(t) && Date.now() - t > 48 * 3_600_000) flags.add('STALE_SIGNAL');
  }

  if (flags.size > 0) flags.add('MANUAL_REVIEW_REQUIRED');
  return { tier, status, flags: Array.from(flags) };
}

export interface ResearchEvidenceRef {
  evidenceId: string;
  sourceUrl: string;
  sourceTier: 'official' | 'primary' | 'secondary';
  fetchedAt: string;
  publishedAt?: string;
  asOf?: string;
  claimType: string;
  value?: number;
  unit?: string;
  period?: string;
  reviewFlags: ResearchReviewFlag[];
}

/** True when any of the flags requires human verification before publishing. */
export function requiresManualReview(flags: readonly ResearchReviewFlag[] | undefined): boolean {
  if (!flags) return false;
  return flags.some((f) => MANUAL_REVIEW_FLAGS.has(f));
}

const SECONDARY_SOURCE_HOSTS = ['finance.yahoo.com', 'query1.finance.yahoo.com', 'query2.finance.yahoo.com', 'reddit.com', 'www.reddit.com'];
const NEWS_LANE_ANGLES = new Set(['CATALYST_NEWS', 'EARNINGS_REACTION', 'REACTIVE_SENTIMENT']);

export interface ReviewFlagInput {
  topic: string;
  sourceUrls?: string[];
  angleId?: string;
  hookFormulaId?: string;
}

/**
 * Deterministic, side-effect-free claim screen. It does NOT fetch sources; it
 * flags claim SHAPES that need a human check or figure suppression before they
 * become a polished finance graphic.
 */
export function computeReviewFlags(input: ReviewFlagInput): ResearchReviewFlag[] {
  const flags = new Set<ResearchReviewFlag>();
  const text = input.topic.toLowerCase();
  const sources = input.sourceUrls ?? [];

  if (/\b(all[-\s]?time high|record high|ath|52[-\s]?week high|5[-\s]?year high|hits high|new high)\b/.test(text)) {
    flags.add('RECORD_HIGH_CLAIM');
  }

  if (input.angleId === 'POLITICIAN_DISCLOSURES' || /\b(pelosi|congress|senator|politician|disclosure|capitol)\b/.test(text)) {
    flags.add('POLITICIAN_DISCLOSURE');
  }

  // "If you invested $X N years/months ago" depends on raw closes that are
  // split/dividend sensitive — verify total-return basis before exact figures.
  if (/\b(if you invested|years ago|months ago|\d+\s*-?\s*year (return|gain))\b/.test(text)) {
    flags.add('CORPORATE_ACTION_SENSITIVE_RETURN');
  }

  // Extreme single-period percentage moves.
  const moveMatch = text.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  if ((moveMatch && Math.abs(Number(moveMatch[1])) >= 20) || /\b(explodes|soars|surges|skyrockets|plunges|crashes)\b/.test(text)) {
    flags.add('ANOMALY_MOVE');
  }

  if (NEWS_LANE_ANGLES.has(input.angleId ?? '') && sources.length > 0
    && sources.every((u) => SECONDARY_SOURCE_HOSTS.some((h) => u.includes(h)))) {
    flags.add('SECONDARY_ONLY_NEWS');
  }

  // Aggregated/social-only sourcing (Reddit, Google-News redirect, X) is a rumor
  // until corroborated — regardless of angle.
  if (sources.length > 0 && bestSourceTier(sources) === 'AGGREGATED') {
    flags.add('RUMOR_SINGLE_SOURCE');
  }

  if (flags.size > 0) flags.add('MANUAL_REVIEW_REQUIRED');
  return Array.from(flags);
}

/**
 * Title/hook guard: neutralize UNVERIFIABLE superlatives ("record high",
 * "all-time high", "ATH") that an LLM may author, since our free data sources
 * (a Yahoo 5-year window) cannot prove them. Accurate windowed highs ("5-year
 * high", "52-week high") are preserved untouched. This closes the leak where the
 * figure-level guard held but the headline still said "Record High".
 *
 * Phase 0: always neutralizes. A later phase can relax this when a topic carries
 * an OFFICIAL-tier corroborating source.
 */
export function neutralizeUnverifiedSuperlatives(text: string): string {
  if (!text) return text;
  return text
    .replace(/\ball[-\s]?time[-\s]?highs?\b/gi, (m) => (m.endsWith('s') ? 'multi-year highs' : 'multi-year high'))
    .replace(/\brecord[-\s]?highs?\b/gi, (m) => (m.endsWith('s') ? 'multi-year highs' : 'multi-year high'))
    .replace(/\bATHs?\b/g, 'multi-year high')
    .replace(/\bhits?\s+(?:a\s+)?new\s+highs?\b/gi, 'nears a multi-year high')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function mergeReviewFlags(...lists: Array<readonly ResearchReviewFlag[] | undefined>): ResearchReviewFlag[] {
  const set = new Set<ResearchReviewFlag>();
  for (const list of lists) for (const f of list ?? []) set.add(f);
  return Array.from(set);
}

const FLAG_GUIDANCE: Record<ResearchReviewFlag, string> = {
  MANUAL_REVIEW_REQUIRED: 'A human should verify the flagged claims below before publishing.',
  SECONDARY_ONLY_NEWS: 'Only secondary sources (e.g. Yahoo/Reddit) — confirm against the primary release before stating specifics.',
  POLITICIAN_DISCLOSURE: 'Politician/insider disclosure — verify the filing date and exact holdings on the official disclosure portal.',
  RECORD_HIGH_CLAIM: 'Confirm any "record/all-time high" wording against an official index source (a 5-year window cannot prove an all-time high).',
  CORPORATE_ACTION_SENSITIVE_RETURN: 'Multi-year return — use a split/dividend-adjusted total-return basis; do not quote raw-close math as exact.',
  ANOMALY_MOVE: 'Large single-period move — verify the exact percentage and window (1D vs YTD vs 52-week) before rendering it.',
  MISSING_EVIDENCE_ID: 'No evidence reference attached to a numeric claim — keep figures illustrative.',
  RUMOR_SINGLE_SOURCE: 'Only aggregated/social sources (e.g. Reddit, Google News redirect) — confirm against a primary release or two independent outlets, or label the post "unconfirmed".',
  UNCORROBORATED: 'No usable source attached — do not present this as a verified fact; treat as developing or drop it.',
  STALE_SIGNAL: 'Signal is older than 48h for a timely-first slot — confirm it is still current or reframe as evergreen.',
};

/** Build the human-readable Telegram review block, or undefined if nothing flagged. */
export function buildReviewBlock(flags: readonly ResearchReviewFlag[], topic: string): string | undefined {
  if (!flags.length) return undefined;
  const lines = [
    `Topic: ${topic}`,
    `Flags: ${flags.join(', ')}`,
    '',
    ...flags.filter((f) => f !== 'MANUAL_REVIEW_REQUIRED').map((f) => `- ${f}: ${FLAG_GUIDANCE[f]}`),
    '',
    'Exact figures that are not evidence-backed are kept out of the image prompts (rendered as "illustrative").',
  ];
  return lines.join('\n');
}
