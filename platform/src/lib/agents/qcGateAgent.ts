/**
 * Deterministic QC gate — runs AFTER prompt compilation and BEFORE Telegram
 * delivery. It does not block (compliance + cost guards already hard-block
 * upstream); it produces a compact PASS/WARN/FAIL report + a heuristic
 * engagement score so the operator can eyeball a packet before generating it.
 */

export type QcStatus = 'PASS' | 'WARN' | 'FAIL';

export interface QcCheck {
  label: string;
  status: QcStatus;
  detail: string;
}

export interface QcReport {
  overall: QcStatus;
  checks: QcCheck[];
  engagementScore: number; // 0-100 heuristic
  engagementLabel: string;
  timelyTodayCount: number;
}

const VERIFIED_TIERS = new Set(['OFFICIAL', 'MARKET_DATA', 'REPUTABLE_PRESS']);

export interface QcGateInput {
  prompts: Array<{ slideNumber: number; role: string; geminiPrompt: string }>;
  slideHeadlines: string[];
  hook: string;
  reviewFlagCount: number;
  sourceTier?: string;
  topicMode?: string;
  topicFamily?: string;
  slideCount: number;
  varietyFallbackRatePct: number;
  varietyUnresolved: boolean;
  /** Count of VERIFIED-timely posts already shipped today (excludes this one). */
  timelyPriorTodayCount: number;
}

const TIMELY_FAMILIES = new Set(['INDEX_MOVE', 'SINGLE_STOCK', 'CRYPTO', 'IPO', 'MACRO']);

export function runQcGate(input: QcGateInput): QcReport {
  const checks: QcCheck[] = [];
  const verified = input.sourceTier ? VERIFIED_TIERS.has(input.sourceTier) : false;
  const isTimely = TIMELY_FAMILIES.has(input.topicFamily ?? '');
  const timelyTodayCount = input.timelyPriorTodayCount + (verified ? 1 : 0);

  // 1. No unresolved [bracket] placeholders leaked into any compiled prompt.
  const leaked = input.prompts.filter((p) => /\[[a-zA-Z][a-zA-Z0-9_]*\]/.test(p.geminiPrompt));
  checks.push(leaked.length === 0
    ? { label: 'Prompt placeholders', status: 'PASS', detail: 'no unresolved [brackets]' }
    : { label: 'Prompt placeholders', status: 'FAIL', detail: `unresolved placeholders on slide(s) ${leaked.map((p) => p.slideNumber).join(', ')}` });

  // 2. Each prompt is structurally complete (watermark + negative constraints + some text).
  const incomplete = input.prompts.filter((p) =>
    !/WATERMARK/.test(p.geminiPrompt) || !/NEGATIVE CONSTRAINTS/.test(p.geminiPrompt) || !/EXACT TEXT|INTEGRATED/i.test(p.geminiPrompt));
  checks.push(incomplete.length === 0
    ? { label: 'Prompt completeness', status: 'PASS', detail: 'all packets have watermark + exact-text + negatives' }
    : { label: 'Prompt completeness', status: 'WARN', detail: `slide(s) ${incomplete.map((p) => p.slideNumber).join(', ')} missing a required section` });

  // 3. Headline legibility — keep cover/headlines tight.
  const longHeads = input.slideHeadlines.filter((h) => wordCount(h) > 12);
  checks.push(longHeads.length === 0
    ? { label: 'Headline legibility', status: 'PASS', detail: 'all headlines <= 12 words' }
    : { label: 'Headline legibility', status: 'WARN', detail: `${longHeads.length} headline(s) over 12 words` });

  // 4. Slide count in the 2026 carousel sweet spot.
  checks.push(input.slideCount >= 7 && input.slideCount <= 10
    ? { label: 'Slide count', status: 'PASS', detail: `${input.slideCount} slides` }
    : { label: 'Slide count', status: 'WARN', detail: `${input.slideCount} slides (8-10 preferred)` });

  // 5. Two-chance hook — slides 1 and 2 must both be present/strong.
  const hook1 = (input.slideHeadlines[0] ?? '').trim().length > 0;
  const hook2 = (input.slideHeadlines[1] ?? '').trim().length > 0;
  checks.push(hook1 && hook2
    ? { label: 'Two-chance hook', status: 'PASS', detail: 'slide 1 + slide 2 both carry a hook' }
    : { label: 'Two-chance hook', status: 'WARN', detail: 'slide 1 or 2 missing a strong hook' });

  // 6. Verification — timely topics should be source-backed.
  checks.push(verified
    ? { label: 'Verification', status: 'PASS', detail: `source tier ${input.sourceTier}` }
    : { label: 'Verification', status: isTimely ? 'WARN' : 'PASS', detail: isTimely ? `timely topic on a weak source tier (${input.sourceTier ?? 'none'}) — confirm before posting` : `evergreen topic (tier ${input.sourceTier ?? 'n/a'})` });

  // 7. Human-review flags.
  checks.push(input.reviewFlagCount === 0
    ? { label: 'Research review', status: 'PASS', detail: 'no manual-review flags' }
    : { label: 'Research review', status: 'WARN', detail: `${input.reviewFlagCount} flag(s) — see review block` });

  // 8. Visual variety pressure.
  checks.push(!input.varietyUnresolved && input.varietyFallbackRatePct <= 25
    ? { label: 'Visual variety', status: 'PASS', detail: `${input.varietyFallbackRatePct.toFixed(0)}% 7d fallback` }
    : { label: 'Visual variety', status: 'WARN', detail: input.varietyUnresolved ? 'could not fully escape a collision this run' : `${input.varietyFallbackRatePct.toFixed(0)}% 7d fallback (>25%)` });

  // 9. Daily timely mix (target >=4 of 6).
  checks.push(timelyTodayCount >= 4 || input.topicMode !== 'TIMELY_FIRST'
    ? { label: 'Daily timely mix', status: 'PASS', detail: `${timelyTodayCount} verified-timely so far today` }
    : { label: 'Daily timely mix', status: 'WARN', detail: `only ${timelyTodayCount} verified-timely today (target >=4/6)` });

  const overall: QcStatus = checks.some((c) => c.status === 'FAIL') ? 'FAIL'
    : checks.some((c) => c.status === 'WARN') ? 'WARN' : 'PASS';

  const { engagementScore, engagementLabel } = scoreEngagement({ verified, isTimely, hook: input.hook, slideCount: input.slideCount });

  return { overall, checks, engagementScore, engagementLabel, timelyTodayCount };
}

function scoreEngagement(input: { verified: boolean; isTimely: boolean; hook: string; slideCount: number }): { engagementScore: number; engagementLabel: string } {
  let score = 50;
  if (input.isTimely) score += 18;
  if (input.verified) score += 12;
  const hw = wordCount(input.hook);
  if (hw >= 4 && hw <= 11) score += 12; else score -= 6;
  if (input.slideCount >= 8 && input.slideCount <= 10) score += 8;
  score = Math.max(5, Math.min(98, score));
  const engagementLabel = score >= 75 ? 'strong save/share potential'
    : score >= 55 ? 'solid' : 'modest — consider a sharper hook or fresher topic';
  return { engagementScore: score, engagementLabel };
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Compact human-readable QC block for the Telegram intro. */
export function formatQcSummary(report: QcReport): string {
  const icon = (s: QcStatus) => (s === 'PASS' ? '✅' : s === 'WARN' ? '⚠️' : '❌');
  const flagged = report.checks.filter((c) => c.status !== 'PASS');
  const lines = [
    `${icon(report.overall)} QC: ${report.overall}  |  📈 Engagement ${report.engagementScore}/100 (${report.engagementLabel})`,
  ];
  for (const c of flagged) lines.push(`   ${icon(c.status)} ${c.label}: ${c.detail}`);
  if (flagged.length === 0) lines.push('   all checks passed');
  return lines.join('\n');
}
