import { BaseAgent } from './interfaces';
import { StrategyDecision } from './contentStrategyAgent';

export type MediaPlanKind = 'VIDEO' | 'CAROUSEL' | 'SINGLE_IMAGE';

export interface MediaPlan {
  kind: MediaPlanKind;
  shouldGenerateImages: boolean;
  shouldGenerateVideo: boolean;
  imageCount: number;
  rationale: string;
}

export class MediaPlanAgent extends BaseAgent {
  constructor() {
    super('MediaPlanAgent');
  }

  async execute(input: {
    strategy: StrategyDecision,
    videoAvailable: boolean,
    videoRequestedToday: boolean,
  }): Promise<MediaPlan> {
    const { strategy, videoAvailable, videoRequestedToday } = input;
    const canMakeVideo = videoAvailable && videoRequestedToday;
    const isVideoNative = strategy.format === 'REEL_DRAFT';

    if (canMakeVideo && (isVideoNative || shouldPreferVideo(strategy))) {
      return {
        kind: 'VIDEO',
        shouldGenerateImages: false,
        shouldGenerateVideo: true,
        imageCount: 0,
        rationale: isVideoNative
          ? 'Strategy selected a reel and the free video renderer is available today.'
          : 'Today is a scheduled video day and the topic works as an animated lesson.',
      };
    }

    if (strategy.format === 'SINGLE_IMAGE' || strategy.slideCount <= 1) {
      return {
        kind: 'SINGLE_IMAGE',
        shouldGenerateImages: true,
        shouldGenerateVideo: false,
        imageCount: 1,
        rationale: 'One strong image is enough for this simple stat or reminder.',
      };
    }

    const imageCount = Math.max(4, Math.min(8, strategy.slideCount || 6));
    return {
      kind: 'CAROUSEL',
      shouldGenerateImages: true,
      shouldGenerateVideo: false,
      imageCount,
      rationale: `Carousel chosen with ${imageCount} slides because the topic needs a saveable step-by-step framework.`,
    };
  }
}

function shouldPreferVideo(strategy: StrategyDecision): boolean {
  const text = [
    strategy.topic,
    strategy.hook,
    strategy.reasoning,
    strategy.contentPillar || '',
    ...(strategy.searchKeywords || []),
  ].join(' ');

  return /(chart|candle|earnings|market|stock|watchlist|risk|mistake|timeline|sequence|flow|how to read|lesson)/i.test(text);
}
