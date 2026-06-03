import type { SlotIndex } from './slotConfig';

export type CtaId =
  | 'save_specific'
  | 'share_use_case'
  | 'comment_genuine_question'
  | 'follow_authority'
  | 'swipe_promise'
  | 'question_open'
  | 'reference_save'
  | 'dm_pull'
  | 'story_vote';

export interface CtaStrategy {
  id: CtaId;
  pattern: string;
  description: string;
  bestForSlot: SlotIndex[] | 'any';
  engagementBaitRisk: 'low' | 'medium';
  requiresDmAutomation?: boolean;
  requiresStoryPosting?: boolean;
  requiresPayoffSlideIndex?: boolean;
  carouselImpactNote: string;
}

export const CTA_LIBRARY: Record<CtaId, CtaStrategy> = {
  save_specific: {
    id: 'save_specific',
    pattern: 'Save this before your next {trigger}.',
    description: 'Save-bait by specificity — names a concrete future moment when the saver will return',
    bestForSlot: [3, 5],
    engagementBaitRisk: 'low',
    carouselImpactNote: 'Final slide is checklist-style (MINIMALIST_CHECKLIST or EARNINGS_CARD)',
  },
  share_use_case: {
    id: 'share_use_case',
    pattern: 'Send this to a {audience} friend.',
    description: 'Share-bait by use case — names the specific friend the viewer should send it to',
    bestForSlot: [2, 3],
    engagementBaitRisk: 'low',
    carouselImpactNote: 'Final slide visually invites sharing (paper-airplane motif, "send this to →")',
  },
  comment_genuine_question: {
    id: 'comment_genuine_question',
    pattern: "Drop your favorite {X} in comments — I'll share my {list/screen}.",
    description: 'Comment-engage via genuine question; value lives in the comment thread, not behind a DM gate',
    bestForSlot: [2, 3],
    engagementBaitRisk: 'low',
    carouselImpactNote: 'Final slide shows the question prominently',
  },
  follow_authority: {
    id: 'follow_authority',
    pattern: 'Follow for daily US + Canadian market breakdowns — no hype, no advice.',
    description: 'Cold-traffic follow driver — works well when the post itself proves the bar',
    bestForSlot: [1],
    engagementBaitRisk: 'low',
    carouselImpactNote: 'Final slide shows "@thestatsandstacks · daily market breakdowns" in elegant typography that resolves the cover motif (no luxury-desk/globe cliché)',
  },
  swipe_promise: {
    id: 'swipe_promise',
    pattern: 'Swipe to slide {payoffSlideIndex} for the {payoff}.',
    description: 'Carousel completion booster — promises a specific slide pays off',
    bestForSlot: 'any',
    engagementBaitRisk: 'low',
    requiresPayoffSlideIndex: true,
    carouselImpactNote: 'Cover headline references payoff slide; that slide must deliver the hero data point',
  },
  question_open: {
    id: 'question_open',
    pattern: "What's your take? Drop a comment below.",
    description: 'Low-friction open question; premium-credible without engagement-bait energy',
    bestForSlot: [4],
    engagementBaitRisk: 'low',
    carouselImpactNote: 'Final slide stays minimal; question is in caption',
  },
  reference_save: {
    id: 'reference_save',
    pattern: 'Save this so you can come back to it during {time-bound event}.',
    description: 'Save-bait tied to an upcoming time anchor (tax season, contribution deadline, earnings week)',
    bestForSlot: [3],
    engagementBaitRisk: 'low',
    carouselImpactNote: 'Final slide includes a calendar/clock motif and the time anchor',
  },
  dm_pull: {
    id: 'dm_pull',
    pattern: "Comment '{KEYWORD}' for the {asset}.",
    description: 'Keyword-comment → DM-automated asset delivery. GATED: requires ManyChat or Meta Graph API DM automation.',
    bestForSlot: [2],
    engagementBaitRisk: 'medium',
    requiresDmAutomation: true,
    carouselImpactNote: 'Final slide shows the trigger keyword prominently',
  },
  story_vote: {
    id: 'story_vote',
    pattern: 'Vote on my story: {option A} or {option B}?',
    description: 'Story-poll driver. GATED: requires the pipeline (or user) to actually post a companion story.',
    bestForSlot: [4],
    engagementBaitRisk: 'medium',
    requiresStoryPosting: true,
    carouselImpactNote: 'Final slide shows "vote on my story →" with two options',
  },
};

export function getCta(id: CtaId): CtaStrategy {
  return CTA_LIBRARY[id];
}

export function isCtaId(value: unknown): value is CtaId {
  return typeof value === 'string' && value in CTA_LIBRARY;
}

export interface CtaFeedbackEntry {
  postSlug: string;
  ctaId: CtaId;
  capturedAt: string;
  manualRating: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export function selectCta(input: {
  slotIndex: SlotIndex;
  preferredCtas: CtaId[];
  recentCtasUsed: CtaId[];
  feedback?: CtaFeedbackEntry[];
  dmAutomationEnabled?: boolean;
  storyAutomationEnabled?: boolean;
  hasPayoffSlide?: boolean;
}): CtaId {
  const candidates = input.preferredCtas.filter((id) => {
    const cta = CTA_LIBRARY[id];
    if (cta.requiresDmAutomation && !input.dmAutomationEnabled) return false;
    if (cta.requiresStoryPosting && !input.storyAutomationEnabled) return false;
    if (cta.requiresPayoffSlideIndex && !input.hasPayoffSlide) return false;
    return true;
  });

  if (candidates.length === 0) {
    return 'save_specific';
  }

  const window = input.recentCtasUsed.slice(-30);
  const lastUsed = new Map<CtaId, number>();
  for (let i = 0; i < window.length; i++) lastUsed.set(window[i], i);

  const feedbackWeight = new Map<CtaId, number>();
  if (input.feedback && input.feedback.length > 0) {
    const recent = input.feedback.slice(-30);
    const sums = new Map<CtaId, { total: number; count: number }>();
    for (const entry of recent) {
      const cur = sums.get(entry.ctaId) ?? { total: 0, count: 0 };
      cur.total += entry.manualRating;
      cur.count += 1;
      sums.set(entry.ctaId, cur);
    }
    for (const [id, { total, count }] of sums) {
      feedbackWeight.set(id, total / count);
    }
  }

  return [...candidates].sort((a, b) => {
    const aFb = feedbackWeight.get(a) ?? 3;
    const bFb = feedbackWeight.get(b) ?? 3;
    const fbDelta = bFb - aFb;
    if (Math.abs(fbDelta) >= 0.5) return fbDelta;

    const aIdx = lastUsed.has(a) ? lastUsed.get(a)! : -Infinity;
    const bIdx = lastUsed.has(b) ? lastUsed.get(b)! : -Infinity;
    return aIdx - bIdx;
  })[0];
}
