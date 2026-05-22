// Standalone daily pipeline runner for GitHub Actions
// This runs WITHOUT the Next.js server or database — just agents + email
import 'dotenv/config';

import { CostGuardAgent } from './src/lib/agents/costGuardAgent';
import { TrendResearchAgent } from './src/lib/agents/trendResearchAgent';
import { CarouselPlanningAgent, MediaFormatDecisionAgent } from './src/lib/agents/mediaPlanningAgent';
import { ContentStrategyAgent } from './src/lib/agents/contentStrategyAgent';
import { ComplianceQAAgent } from './src/lib/agents/complianceQAAgent';
import { ImagePromptAgent } from './src/lib/agents/imagePromptAgent';
import type { SlidePrompt } from './src/lib/agents/imagePromptAgent';
import { CopywritingAgent } from './src/lib/agents/copywritingAgent';
import { TickersInNewsAgent } from './src/lib/agents/tickersInNewsAgent';
import { HistoryGuardAgent } from './src/lib/agents/historyGuardAgent';
import { sendPromptsToTelegram } from './src/lib/services/telegramDelivery';
import { decideDayType } from './src/lib/agents/dayTypeAgent';
import { appendContentHistory, loadContentHistory } from './src/lib/services/contentHistory';
import { getLocalDateKey, getLocalTimestamp, getRunSlug } from './src/lib/services/dateUtils';
import { getImageCount } from './src/lib/services/imageCount';
import path from 'path';
import fs from 'fs';

async function main() {
  const startTime = Date.now();
  const now = new Date();
  const today = getLocalDateKey(now);
  const runSlug = getRunSlug(now);
  process.env.CONTENT_RUN_SLUG = today;
  const outputDir = path.join('/tmp', 'thestatsandstacks', today);
  const historyPath = process.env.CONTENT_HISTORY_PATH || path.join('/tmp', 'thestatsandstacks-history', 'content-history.json');
  const contentHistory = loadContentHistory(historyPath);
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('');
  const dayType = decideDayType(now);

  console.log('═══════════════════════════════════════════════════════');
  console.log('  🚀 THESTATSANDSTACKS — DAILY PIPELINE');
  console.log(`  📅 ${today}`);
  console.log(`  🧠 History entries loaded: ${contentHistory.length}`);
  console.log(`  🎬 Day type: ${dayType.toUpperCase()}`);
  console.log('  🌐 Running on GitHub Actions');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ── AGENT 0: ZERO-COST GUARD ──
  console.log('━━━ AGENT 0: ZERO-COST GUARD ━━━');
  const costGuard = await new CostGuardAgent().execute();
  console.log(`   ${costGuard.policy}`);
  for (const note of costGuard.notes) console.log(`   ${note}`);
  if (!costGuard.isSafe) {
    throw new Error(`Zero-cost guard blocked the run: ${costGuard.failures.join(' ')}`);
  }
  console.log('');

  // ── AGENT 1A: TICKERS IN NEWS (parallel with Trend Research) ──
  console.log('━━━ AGENT 1A: TICKERS IN NEWS ━━━');
  const tickersInNewsPromise = new TickersInNewsAgent().execute({}).catch((err) => {
    console.warn(`   [TickersInNews] Non-fatal failure: ${err instanceof Error ? err.message : err}`);
    return { tickers: [] };
  });

  // ── AGENT 1: TREND RESEARCH ──
  console.log('━━━ AGENT 1: TREND RESEARCH ━━━');
  const researchAgent = new TrendResearchAgent();
  const trends = await researchAgent.execute({ contentHistory });
  const researchBriefPath = path.join(outputDir, 'RESEARCH_BRIEF.md');
  fs.writeFileSync(researchBriefPath, buildResearchBrief(trends, contentHistory), 'utf-8');
  console.log(`   Research brief saved: ${researchBriefPath}`);
  console.log('');

  const tickersInNews = await tickersInNewsPromise;
  console.log(`   Tickers in news: ${tickersInNews.tickers.map((t) => t.symbol).join(', ') || 'none'}`);

  // ── AGENT 1B: HISTORY GUARD ──
  console.log('━━━ AGENT 1B: HISTORY GUARD ━━━');
  const topTopic = trends.topics[0]?.title ?? '';
  const historyGuard = await new HistoryGuardAgent().execute({ topic: topTopic, contentHistory });
  if (historyGuard.block) {
    console.warn(`   ⛔ History Guard blocked "${topTopic}". Pivot: ${historyGuard.suggestedPivot}`);
    if (trends.topics.length > 1) {
      const [blocked, ...rest] = trends.topics;
      trends.topics = [...rest, { ...blocked, score: (blocked.score ?? 0) * 0.3 }];
      console.log(`   Using next topic: "${trends.topics[0]?.title}"`);
    }
  }
  console.log('');

  // ── AGENT 2: MEDIA FORMAT ──
  console.log('━━━ AGENT 2: MEDIA FORMAT ━━━');
  const formatDecision = await new MediaFormatDecisionAgent().execute({ trends, contentHistory });
  console.log(`   ${formatDecision.mediaFormat}: ${formatDecision.reasoning}`);
  console.log('');

  // ── AGENT 3: CAROUSEL PLANNING ──
  console.log('━━━ AGENT 3: CAROUSEL PLANNING ━━━');
  const carouselPlan = await new CarouselPlanningAgent().execute({ trends, formatDecision });
  console.log(`   ${carouselPlan.slideCount} picture slide${carouselPlan.slideCount === 1 ? '' : 's'} planned.`);
  console.log('');

  // ── AGENT 4: CONTENT STRATEGY ──
  console.log('━━━ AGENT 4: CONTENT STRATEGY ━━━');
  const strategyAgent = new ContentStrategyAgent();
  const strategy = await strategyAgent.execute({ trends, contentHistory, formatDecision, carouselPlan });
  console.log('');

  // ── AGENT 5: COMPLIANCE QA ──
  console.log('━━━ AGENT 5: COMPLIANCE QA ━━━');
  const complianceAgent = new ComplianceQAAgent();
  const strategyCompliance = await complianceAgent.execute({ strategy });
  if (!strategyCompliance.isValid) {
    throw new Error(`Strategy compliance failed: ${strategyCompliance.failures.join(' ')}`);
  }
  console.log(`   Compliance score: ${(strategyCompliance.confidenceScore * 100).toFixed(0)}%`);
  console.log('');

  // ── AGENT 6: IMAGE PROMPTS ──
  console.log('━━━ AGENT 6: IMAGE PROMPTS ━━━');
  const imagePromptAgent = new ImagePromptAgent();
  const promptSet = await imagePromptAgent.execute({ strategy });
  console.log('');

  // ── AGENT 7: COPYWRITING ──
  console.log('━━━ AGENT 7: COPYWRITING ━━━');
  const copyAgent = new CopywritingAgent();
  const copy = await copyAgent.execute({ strategy });
  console.log('');

  // ── AGENT 8: FINAL COMPLIANCE QA ──
  console.log('━━━ AGENT 8: FINAL COMPLIANCE QA ━━━');
  const copyCompliance = await complianceAgent.execute({ strategy, copy });
  if (!copyCompliance.isValid) {
    throw new Error(`Final compliance failed: ${copyCompliance.failures.join(' ')}`);
  }
  console.log(`   Compliance score: ${(copyCompliance.confidenceScore * 100).toFixed(0)}%`);
  console.log('');

  // ── DELIVERY (Telegram Prompts) ──────────────────────────────────────
  console.log('━━━ SENDING TELEGRAM PROMPTS ━━━');
  await sendPromptsToTelegram({
    copy,
    strategy,
    promptSet,
    dayType,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  appendContentHistory(historyPath, {
    date: today,
    topic: strategy.topic,
    hook: strategy.hook,
    format: strategy.format,
    slideCount: dayType === 'video' ? 1 : promptSet.photoVariants[0]?.prompts.length || 0,
    keywords: strategy.searchKeywords || [],
    visualSignature: runSlug,
  });

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ✅ DONE — ${elapsed}s — Manual generation packet sent`);
  console.log('═══════════════════════════════════════════════════════');
}



function buildResearchBrief(
  trends: Awaited<ReturnType<TrendResearchAgent['execute']>>,
  contentHistory: ReturnType<typeof loadContentHistory>
): string {
  return `# TheStatsAndStacks Research Brief

Generated: ${getLocalTimestamp()}

## Recent Content Memory

${contentHistory.length
  ? contentHistory.slice(-10).map((entry) => `- ${entry.date}: ${entry.topic} (${entry.format})`).join('\n')
  : '- No cached history found for this runner.'}

## Research Signals

${(trends.signalBriefs || []).map((signal) => `### ${signal.source} (${signal.status})

${signal.summary}

Seeds: ${signal.topicSeeds.length ? signal.topicSeeds.join(' | ') : 'none'}

Sources: ${signal.sourceUrls.length ? signal.sourceUrls.join(' | ') : 'none'}
`).join('\n')}

## Ranked Topic Candidates

${trends.topics.map((topic, index) => `${index + 1}. ${topic.title}
   - Score: ${topic.score}
   - Format: ${topic.suggestedFormat || 'unspecified'} (${topic.suggestedSlideCount || '?'} slides)
   - Pillar: ${topic.contentPillar || 'unspecified'}
   - Why now: ${topic.freshnessSignal || topic.reasoning}
   - Keywords: ${(topic.searchKeywords || []).join(', ') || 'none'}
   - Sources: ${(topic.sourceUrls || []).join(' | ') || 'none'}`).join('\n\n')}
`;
}



main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});


