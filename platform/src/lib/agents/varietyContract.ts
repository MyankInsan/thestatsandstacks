import type { VisualPlan } from './visualPlanAgent';
import type { ContentHistoryEntry, PersistedVisualPlan } from '../services/contentHistory';

/**
 * Ten-day variety contract. At six packets/day the trailing ten-day window is
 * 60 packets (~420 slide prompts), so a flat list of style IDs is insufficient.
 * We persist full slide-level visual grammar and hard-block compositions that
 * repeat, plus same-day scene/CTA reuse.
 */
export const TRAILING_PACKET_WINDOW = 60;

/**
 * The coarse cover tuple (coverMechanism + cover layoutArchetype + cover
 * dominant subject class) has a far smaller cardinality than the full
 * compositionSignature, so a 60-packet block on it would be unsatisfiable and
 * would flag fallback permanently. We block exact cover-composition repeats over
 * a shorter, satisfiable window (~2 days at 6 packets/day) — enough to stop the
 * "same cover three days running" problem while the granular signature block
 * still covers the full ten-day window.
 */
export const COVER_TUPLE_WINDOW = 10;

export function toPersistedVisualPlan(
  plan: VisualPlan,
  opts: { usedFallback?: boolean; promptFingerprints?: Record<number, string> } = {},
): PersistedVisualPlan {
  return {
    compositionSignature: plan.compositionSignature,
    structureFamily: plan.structureFamily,
    coverMechanism: plan.coverMechanism,
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
  return `${plan.coverMechanism ?? '-'}|${cover?.layoutArchetype ?? '-'}|${cover?.dominantSubjectClass ?? '-'}`;
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

  const coverWindow = recentHistory
    .slice(-COVER_TUPLE_WINDOW)
    .map((e) => e.visualPlan)
    .filter((p): p is PersistedVisualPlan => Boolean(p));
  const candidateCoverTuple = coverTupleOf(candidate);
  if (coverWindow.some((p) => coverTupleOf(p) === candidateCoverTuple)) {
    reasons.push('identical cover mechanism + layout archetype + dominant subject class within cover window');
  }

  const todayPlans = todayPriorEntries
    .map((e) => e.visualPlan)
    .filter((p): p is PersistedVisualPlan => Boolean(p));

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
