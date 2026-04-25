export interface TrendResearchResult {
  topics: Array<{
    title: string;
    score: number;
    reasoning: string;
    suggestedFormat?: 'CAROUSEL' | 'SINGLE_IMAGE' | 'WATCHLIST_EDUCATION' | string;
    suggestedSlideCount?: number;
    searchKeywords?: string[];
    sourceUrls?: string[];
    contentPillar?: string;
    freshnessSignal?: string;
  }>;
  signalBriefs?: Array<{
    source: string;
    status: 'live' | 'fallback' | 'disabled';
    summary: string;
    topicSeeds: string[];
    sourceUrls: string[];
  }>;
  generatedAt?: string;
}

export interface ContentStrategyResult {
  format: 'CAROUSEL' | 'SINGLE_IMAGE' | 'REEL_DRAFT';
  topic: string;
  hook: string;
  reasoning: string;
}

export interface EditorialBriefResult {
  hookVariants: string[];
  angle: string;
  outline: string[];
  factualClaimsToVerify: string[];
}

export interface ValidationResult {
  isValid: boolean;
  confidenceScore: number;
  failures: string[];
}

export interface ImagePromptResult {
  prompts: Array<{
    direction: string;
    text: string;
  }>;
}

export interface PackagingResult {
  finalCaption: string;
  hashtags: string[];
  cta: string;
  altText: string;
  confidenceScore: number;
  readyToPublish: boolean;
}

export abstract class BaseAgent {
  protected name: string;
  
  constructor(name: string) {
    this.name = name;
  }
  
  abstract execute(input: unknown): Promise<unknown>;
}
