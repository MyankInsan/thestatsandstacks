import type { StrategyDecision } from '../agents/contentStrategyAgent';

export function getImageCount(strategy: StrategyDecision): number {
  if (strategy.format === 'SINGLE_IMAGE') return 1;
  return Math.max(5, Math.min(8, strategy.slideCount || 7));
}
