import type { TrendResearchResult } from './interfaces';
import type { AngleId, TopicAngleAgentOutput } from './topicAngleAgent';
import type { HistoryGuardResult } from './historyGuardAgent';
import type { ResearchReviewFlag } from './researchEvidenceGate';
import { normalizeTopic } from '../services/contentHistory';

export type TrendTopic = TrendResearchResult['topics'][number];

/**
 * A trend topic that may carry the angle metadata it was injected from. Keeping
 * the angle association ON the topic (rather than reading
 * `angleCandidates[0]` separately) is what fixes the topic/angle divergence bug:
 * when HistoryGuard pivots away from the first candidate, the surviving topic
 * still carries the correct angleId + slide skeleton.
 */
export interface CandidateTopic {
  topic: TrendTopic;
  angleId?: AngleId;
  angleSlideSkeleton?: string[];
}

/**
 * One selected angle/topic object used end-to-end. ContentStrategy, the viz
 * picker, and the carousel constraints all read THIS object's angleId so they
 * never diverge from the surviving topic.
 */
export interface SelectedTopicDecision {
  topic: TrendTopic;
  angleId?: AngleId;
  angleSlideSkeleton?: string[];
  sourceUrls: string[];
  reviewFlags: ResearchReviewFlag[];
}

/**
 * Build the ordered candidate list. Angle-injected topics keep their RANKED
 * order at the front (the old code used unshift() in a loop, which reversed the
 * ranking), followed by the original trend topics. De-duplicated by normalized
 * title so an angle-injected topic wins over a duplicate trend topic.
 */
export function buildCandidateTopics(
  angleCandidates: TopicAngleAgentOutput['angleCandidates'],
  trendTopics: TrendTopic[],
): CandidateTopic[] {
  const angleTopics: CandidateTopic[] = angleCandidates.map((c) => ({
    topic: {
      title: c.title,
      score: 0.95,
      reasoning: c.rationale,
      searchKeywords: [],
      sourceUrls: c.sourceUrls,
      contentPillar: c.angleId,
    },
    angleId: c.angleId,
    angleSlideSkeleton: c.angleSlideSkeleton,
  }));

  const trendCandidates: CandidateTopic[] = trendTopics.map((t) => ({ topic: t }));

  const seen = new Set<string>();
  const ordered: CandidateTopic[] = [];
  for (const candidate of [...angleTopics, ...trendCandidates]) {
    const key = normalizeTopic(candidate.topic.title);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    ordered.push(candidate);
  }
  return ordered;
}

/**
 * Run the HistoryGuard rotation loop over the candidate list. `evaluate` is the
 * (async) HistoryGuard call. Blocked candidates are rotated to the back with a
 * decayed score, exactly as the legacy run-daily loop did — but the surviving
 * candidate keeps its angle metadata.
 */
export async function selectTopicWithHistoryGuard(
  candidates: CandidateTopic[],
  evaluate: (title: string) => Promise<HistoryGuardResult>,
): Promise<{ selected?: CandidateTopic; ordered: CandidateTopic[]; historyGuard?: HistoryGuardResult; allBlocked: boolean }> {
  const list = [...candidates];
  let historyGuard: HistoryGuardResult | undefined;
  const originalCount = list.length;
  let attempts = 0;

  while (list.length > 0 && attempts < originalCount) {
    const candidate = list[0];
    historyGuard = await evaluate(candidate.topic.title);
    if (!historyGuard.block) {
      return { selected: list[0], ordered: list, historyGuard, allBlocked: false };
    }
    const blocked = list.shift()!;
    list.push({ ...blocked, topic: { ...blocked.topic, score: (blocked.topic.score ?? 0) * 0.3 } });
    attempts++;
  }

  // Every candidate was blocked — fall back to the (rotated) first entry.
  return { selected: list[0], ordered: list, historyGuard, allBlocked: list.length > 0 };
}

export function toSelectedTopicDecision(
  candidate: CandidateTopic,
  reviewFlags: ResearchReviewFlag[] = [],
): SelectedTopicDecision {
  return {
    topic: candidate.topic,
    angleId: candidate.angleId,
    angleSlideSkeleton: candidate.angleSlideSkeleton,
    sourceUrls: candidate.topic.sourceUrls ?? [],
    reviewFlags,
  };
}
