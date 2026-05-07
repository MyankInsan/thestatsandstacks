import { BaseAgent } from './interfaces';
import { StrategyDecision } from './contentStrategyAgent';
import { CopyBundle } from './copywritingAgent';

export interface ComplianceQAReport {
  isValid: boolean;
  confidenceScore: number;
  failures: string[];
}

export class ComplianceQAAgent extends BaseAgent {
  constructor() {
    super('ComplianceQAAgent');
  }

  async execute(input: { strategy: StrategyDecision; copy?: CopyBundle }): Promise<ComplianceQAReport> {
    console.log(`[${this.name}] Checking finance and Instagram compliance...`);

    const failures: string[] = [];
    const strategyText = [
      input.strategy.topic,
      input.strategy.hook,
      input.strategy.reasoning,
      ...input.strategy.slideBreakdown,
    ].join('\n');
    const copyText = input.copy
      ? [input.copy.caption, input.copy.cta, input.copy.firstComment, input.copy.hashtags].join('\n')
      : '';
    const fullText = `${strategyText}\n${copyText}`;

    if (/guaranteed\s+(return|profit|income|gain)|risk[-\s]?free|double your money/i.test(fullText)) {
      failures.push('Guaranteed-return or risk-free language is not allowed.');
    }
    if (/price target|target price|\$\d+(?:\.\d+)?\s*(?:target|by\s+\d{4})/i.test(fullText)) {
      failures.push('Price targets are not allowed.');
    }
    if (/(best|top)\s+\d*\s*(stocks?|etfs?)\s+to\s+buy|buy\s+(this|these)\s+(stock|stocks|etf|etfs)|sell\s+(this|these)\s+(stock|stocks|etf|etfs)/i.test(fullText)) {
      failures.push('Buy/sell recommendation language is not allowed.');
    }
    if (/\b(you should|must|need to)\s+(buy|sell|hold|invest)\b/i.test(fullText)) {
      failures.push('Personalized investing instruction language is not allowed.');
    }
    if (/\b(explodes|moons|blasts off|skyrockets|can't miss|must[-\s]?buy)\b/i.test(fullText)) {
      failures.push('Hype-style market language is not allowed for premium finance education.');
    }
    if (hasExtremeOneDayPerformanceClaim(fullText)) {
      failures.push('Extreme one-day performance claims require manual source verification and are blocked by default.');
    }
    if (/\binactive ticker\b|\bphantom surge\b|\bacquired by\s+(wdc|western digital)\b/i.test(fullText)) {
      failures.push('Unverified ticker-status language is blocked by default.');
    }

    if (input.copy) {
      if (input.copy.caption.length > 1100) failures.push('Caption is longer than the automation cap.');
      const hashtagCount = (input.copy.hashtags.match(/#[A-Za-z0-9_]+/g) || []).length;
      if (hashtagCount > 5) failures.push('More than five hashtags were produced.');
      if ((input.copy.caption.match(/#[A-Za-z0-9_]+/g) || []).length > 0) {
        failures.push('Hashtags should stay out of the caption body.');
      }
    }

    return {
      isValid: failures.length === 0,
      confidenceScore: failures.length === 0 ? 0.97 : 0.35,
      failures,
    };
  }
}

function hasExtremeOneDayPerformanceClaim(text: string): boolean {
  const claims = [
    ...text.matchAll(/(?:1\s*day|1d|today)[^\n.%]{0,42}([+-]?\d+(?:,\d{3})*(?:\.\d+)?)%/gi),
    ...text.matchAll(/([+-]?\d+(?:,\d{3})*(?:\.\d+)?)%[^\n.]{0,42}(?:1\s*day|1d|today)/gi),
  ];

  return claims.some((claim) => Number(claim[1].replace(/,/g, '')) >= 250);
}
