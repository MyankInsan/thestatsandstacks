export interface TrendResearchResult {
  topics: Array<{
    title: string;
    score: number;
    reasoning: string;
    suggestedFormat?: string;
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

export interface ValidationResult {
  isValid: boolean;
  confidenceScore: number;
  failures: string[];
}

export abstract class BaseAgent {
  protected name: string;
  constructor(name: string) {
    this.name = name;
  }
  abstract execute(input: unknown): Promise<unknown>;
}
