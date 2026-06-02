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
  | 'MISSING_EVIDENCE_ID';

export const RESEARCH_REVIEW_FLAGS: readonly ResearchReviewFlag[] = [
  'MANUAL_REVIEW_REQUIRED',
  'SECONDARY_ONLY_NEWS',
  'POLITICIAN_DISCLOSURE',
  'RECORD_HIGH_CLAIM',
  'CORPORATE_ACTION_SENSITIVE_RETURN',
  'ANOMALY_MOVE',
  'MISSING_EVIDENCE_ID',
];

/** Flags that require a human to verify the claim before publishing. */
export const MANUAL_REVIEW_FLAGS: ReadonlySet<ResearchReviewFlag> = new Set<ResearchReviewFlag>([
  'MANUAL_REVIEW_REQUIRED',
  'POLITICIAN_DISCLOSURE',
  'RECORD_HIGH_CLAIM',
  'CORPORATE_ACTION_SENSITIVE_RETURN',
  'ANOMALY_MOVE',
  'SECONDARY_ONLY_NEWS',
]);

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

  if (flags.size > 0) flags.add('MANUAL_REVIEW_REQUIRED');
  return Array.from(flags);
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
