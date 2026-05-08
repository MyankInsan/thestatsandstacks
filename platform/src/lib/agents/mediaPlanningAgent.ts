import { BaseAgent, TrendResearchResult } from './interfaces';
import { ContentHistoryEntry } from '../services/contentHistory';

type TrendTopic = TrendResearchResult['topics'][number];

export type MediaFormat = 'SINGLE_IMAGE' | 'CAROUSEL';

export interface MediaFormatDecision {
  mediaFormat: MediaFormat;
  confidenceScore: number;
  selectedTopicTitle: string;
  referencePattern: string;
  reasoning: string;
}

export interface CarouselPlan {
  slideCount: number;
  slideRoles: string[];
  density: 'premium-poster' | 'educational-carousel';
  reasoning: string;
}

export class MediaFormatDecisionAgent extends BaseAgent {
  constructor() {
    super('MediaFormatDecisionAgent');
  }

  async execute(input: {
    trends: TrendResearchResult,
    contentHistory?: ContentHistoryEntry[],
  }): Promise<MediaFormatDecision> {
    console.log(`[${this.name}] 🖼️ Deciding single image vs carousel...`);
    const topic = pickHighestSignalTopic(input.trends);
    const suggestedFormat = String(topic?.suggestedFormat || '').toUpperCase();
    const topicText = `${topic?.title || ''} ${topic?.reasoning || ''} ${topic?.contentPillar || ''}`;
    const shouldCarousel = suggestedFormat === 'CAROUSEL'
      || suggestedFormat === 'WATCHLIST_EDUCATION'
      || isMarketEducation(topicText)
      || isFrameworkTopic(topicText)
      || (topic?.score || 0) >= 0.82;

    const mediaFormat: MediaFormat = shouldCarousel ? 'CAROUSEL' : 'SINGLE_IMAGE';
    const referencePattern = mediaFormat === 'CAROUSEL'
      ? 'DayTrading-style editorial carousel energy: strong cover, visual proof/context, risk map, what-to-watch frame, saveable takeaway. Original design only.'
      : 'Single premium poster: one stat or one rule, strong subject, no extra explanation.';

    return {
      mediaFormat,
      confidenceScore: topic?.score || 0.72,
      selectedTopicTitle: topic?.title || 'Daily finance framework',
      referencePattern,
      reasoning: mediaFormat === 'CAROUSEL'
        ? 'The topic has enough education, context, and risk nuance to earn saves and swipes as a carousel.'
        : 'The topic is simple enough to land as one picture without forcing empty filler slides.',
    };
  }
}

export class CarouselPlanningAgent extends BaseAgent {
  constructor() {
    super('CarouselPlanningAgent');
  }

  async execute(input: {
    trends: TrendResearchResult,
    formatDecision: MediaFormatDecision,
  }): Promise<CarouselPlan> {
    console.log(`[${this.name}] 🧩 Planning carousel depth and slide roles...`);
    if (input.formatDecision.mediaFormat === 'SINGLE_IMAGE') {
      return {
        slideCount: 1,
        slideRoles: ['premium cover poster'],
        density: 'premium-poster',
        reasoning: 'Single-image format selected, so the post needs one dense, readable poster.',
      };
    }

    const topic = pickHighestSignalTopic(input.trends);
    const suggested = Number(topic?.suggestedSlideCount || 0);
    const text = `${topic?.title || ''} ${topic?.reasoning || ''} ${topic?.contentPillar || ''}`;
    const isHotMarket = isMarketEducation(text);
    const slideCount = isHotMarket
      ? 8
      : clampInteger(suggested || 7, 5, 8);
    const slideRoles = isHotMarket
      ? [
        'cover hook with the hot topic',
        'what happened',
        'why the market cared',
        'core data or catalyst context',
        'risk that hype ignores',
        'what to watch next',
        'how to research it safely',
        'saveable risk-first takeaway',
      ]
      : [
        'cover hook',
        'problem or mistake',
        'decision framework',
        'comparison or checklist',
        'risk or caveat',
        'next step',
        'save/share/follow reason',
      ].slice(0, slideCount);

    return {
      slideCount,
      slideRoles,
      density: isHotMarket ? 'premium-poster' : 'educational-carousel',
      reasoning: isHotMarket
        ? 'Hot market topics need enough frames to explain catalyst, context, risks, and watchlist logic without sounding like a trade call.'
        : 'A compact carousel gives the follower a reusable framework without filler.',
    };
  }
}

function pickHighestSignalTopic(trends: TrendResearchResult): TrendTopic | undefined {
  return [...(trends.topics || [])].sort((a, b) => b.score - a.score)[0];
}

function isMarketEducation(value: string): boolean {
  return /\b(stock|ticker|watchlist|market|earnings|valuation|catalyst|portfolio|sandisk|sndk|semiconductor|storage|ai)\b/i.test(value);
}

function isFrameworkTopic(value: string): boolean {
  return /\b(checklist|framework|mistake|myth|versus|vs|decision|risk|guide|steps|rules)\b/i.test(value);
}

function clampInteger(value: number, min: number, max: number): number {
  const rounded = Math.round(Number.isFinite(value) ? value : min);
  return Math.max(min, Math.min(max, rounded));
}
