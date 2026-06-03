import type { VisualPlan } from './visualPlanAgent';
import type { ContentHistoryEntry, PersistedVisualPlan } from '../services/contentHistory';

/**
 * Ten-day variety contract. At six packets/day the trailing ten-day window is
 * 60 packets (~420 slide prompts), so a flat list of style IDs is insufficient.
 * We persist full slide-level visual grammar and hard-block compositions that
 * repeat, plus same-day scene/CTA reuse.
 */
export const TRAILING_PACKET_WINDOW = 60;

export function toPersistedVisualPlan(
  plan: VisualPlan,
  opts: { usedFallback?: boolean; promptFingerprints?: Record<number, string> } = {},
): PersistedVisualPlan {
  return {
    compositionSignature: plan.compositionSignature,
    structureFamily: plan.structureFamily,
    coverMechanism: plan.coverMechanism,
    coverLayoutFamily: plan.coverLayoutFamily,
    sceneConceptIds: plan.slides.map((s) => s.sceneConceptId),
    ctaConceptId: plan.slides.find((s) => s.intendedRole === 'cta')?.ctaConceptId,
    usedFallback: opts.usedFallback,
    slides: plan.slides.map((s) => ({
      slideNumber: s.slideNumber,
      layoutArchetype: s.layoutArchetype,
      primaryEncoding: s.primaryEncoding,
      visualStyle: s.visualStyle,
      bucket: s.bucket,
      visualPosition: s.visualPosition,
      dominantSubjectClass: s.dominantSubjectClass,
      sceneConceptId: s.sceneConceptId,
      promptFingerprint: opts.promptFingerprints?.[s.slideNumber],
    })),
  };
}

function coverTupleOf(plan: PersistedVisualPlan): string {
  const cover = plan.slides[0];
  // Prefer the explicit cover layout family (v4); legacy plans fall back to the
  // cover's layoutArchetype (which was always 'hero-top' pre-v4).
  const coverLayout = plan.coverLayoutFamily ?? cover?.layoutArchetype ?? '-';
  return `${plan.coverMechanism ?? '-'}|${coverLayout}|${cover?.dominantSubjectClass ?? '-'}`;
}

export interface VarietyCheckResult {
  blocked: boolean;
  reasons: string[];
}

/**
 * Hard-block a candidate plan that:
 *  - repeats an identical compositionSignature within the trailing 60 packets;
 *  - reuses a sceneConceptId / ctaConceptId / prompt fingerprint same-day;
 *  - repeats the identical cover mechanism + layout archetype + dominant subject
 *    class within the trailing 60 packets.
 */
export function checkVisualPlanVariety(
  candidate: PersistedVisualPlan,
  recentHistory: ContentHistoryEntry[],
  todayPriorEntries: ContentHistoryEntry[],
): VarietyCheckResult {
  const reasons: string[] = [];

  const signatureWindow = recentHistory
    .slice(-TRAILING_PACKET_WINDOW)
    .map((e) => e.visualPlan)
    .filter((p): p is PersistedVisualPlan => Boolean(p));

  if (signatureWindow.some((p) => p.compositionSignature === candidate.compositionSignature)) {
    reasons.push('identical compositionSignature within trailing 60 packets');
  }

  const todayPlans = todayPriorEntries
    .map((e) => e.visualPlan)
    .filter((p): p is PersistedVisualPlan => Boolean(p));

  // Same-day cover-composition reuse is a hard block (two of today's 6 slots must
  // not share the identical cover look). Cross-day cover rotation is handled
  // SOFTLY by VisualPlanAgent's coverLayoutFamily LRU — a global cross-day block
  // over the small-cardinality cover tuple is unsatisfiable and would flag
  // fallback permanently (QA: hard blocks = composition signature + same-day reuse).
  const candidateCoverTuple = coverTupleOf(candidate);
  if (todayPlans.some((p) => coverTupleOf(p) === candidateCoverTuple)) {
    reasons.push('identical cover composition reused same-day');
  }

  const todayScenes = new Set(todayPlans.flatMap((p) => p.sceneConceptIds));
  if (candidate.sceneConceptIds.some((id) => todayScenes.has(id))) {
    reasons.push('sceneConceptId reused same-day');
  }

  const todayCtas = new Set(todayPlans.map((p) => p.ctaConceptId).filter(Boolean));
  if (candidate.ctaConceptId && todayCtas.has(candidate.ctaConceptId)) {
    reasons.push('ctaConceptId reused same-day');
  }

  const todayFingerprints = new Set(
    todayPlans.flatMap((p) => p.slides.map((s) => s.promptFingerprint).filter((f): f is string => Boolean(f))),
  );
  const candidateFingerprints = candidate.slides.map((s) => s.promptFingerprint).filter((f): f is string => Boolean(f));
  if (candidateFingerprints.some((f) => todayFingerprints.has(f))) {
    reasons.push('prompt fingerprint reused same-day');
  }

  return { blocked: reasons.length > 0, reasons };
}

/**
 * Variety fallback pressure over the trailing 7 days (~42 packets at 6/day):
 * the share of recent packets whose plan was produced under fallback pressure.
 * Surfaced to Telegram so the operator knows the plan library is stressed.
 */
export function computeVarietyFallbackRatePct(recentHistory: ContentHistoryEntry[], windowSize = 42): number {
  const window = recentHistory
    .slice(-windowSize)
    .map((e) => e.visualPlan)
    .filter((p): p is PersistedVisualPlan => Boolean(p));
  if (window.length === 0) return 0;
  const fallbacks = window.filter((p) => p.usedFallback).length;
  return (fallbacks / window.length) * 100;
}
