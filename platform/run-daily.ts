import 'dotenv/config';
import { CostGuardAgent } from './src/lib/agents/costGuardAgent';
import { TrendResearchAgent } from './src/lib/agents/trendResearchAgent';
import { ContentStrategyAgent } from './src/lib/agents/contentStrategyAgent';
import { ComplianceQAAgent } from './src/lib/agents/complianceQAAgent';
import { ImagePromptAgent } from './src/lib/agents/imagePromptAgent';
import { CopywritingAgent } from './src/lib/agents/copywritingAgent';
import { TickersInNewsAgent } from './src/lib/agents/tickersInNewsAgent';
import { HistoryGuardAgent } from './src/lib/agents/historyGuardAgent';
import { FormatStyleAgent } from './src/lib/agents/formatStyleAgent';
import { SlideNarrativeAgent } from './src/lib/agents/slideNarrativeAgent';
import { sendPromptsToTelegram } from './src/lib/services/telegramDelivery';
import { appendContentHistory, loadContentHistory } from './src/lib/services/contentHistory';
import { getLocalDateKey, getLocalTimestamp, getRunSlug } from './src/lib/services/dateUtils';
import path from 'path';
import fs from 'fs';

async function main() {
  const startTime = Date.now();
  const now = new Date();
  const today = getLocalDateKey(now);
  const runSlug = getRunSlug(now);
  process.env.CONTENT_RUN_SLUG = today;

  const outputDir = path.join('/tmp', 'thestatsandstacks', today);
  const historyPath = process.env.CONTENT_HISTORY_PATH
    || path.join(__dirname, 'content-history.json');

  const contentHistory = loadContentHistory(historyPath);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🚀 THESTATSANDSTACKS — DAILY PIPELINE');
  console.log(`  📅 ${today}`);
  console.log(`  🧠 History entries: ${contentHistory.length}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ── AGENT 0: ZERO-COST GUARD ──────────────────────────────────────────────
  console.log('━━━ AGENT 0: ZERO-COST GUARD ━━━');
  const costGuard = await new CostGuardAgent().execute();
  for (const note of costGuard.notes) console.log(`   ${note}`);
  if (!costGuard.isSafe) throw new Error(`Cost guard blocked: ${costGuard.failures.join(' ')}`);
  console.log('');

  // ── AGENT 1A: TICKERS IN NEWS (parallel with trend research) ──────────────
  console.log('━━━ AGENT 1A: TICKERS IN NEWS ━━━');
  const tickersPromise = new TickersInNewsAgent().execute({}).catch(err => {
    console.warn(`   [TickersInNews] Non-fatal: ${err instanceof Error ? err.message : err}`);
    return { tickers: [] as Array<{ symbol: string }> };
  });

  // ── AGENT 1: TREND RESEARCH ───────────────────────────────────────────────
  console.log('━━━ AGENT 1: TREND RESEARCH ━━━');
  const trends = await new TrendResearchAgent().execute({ contentHistory });
  const researchBriefPath = path.join(outputDir, 'RESEARCH_BRIEF.md');
  fs.writeFileSync(researchBriefPath, buildResearchBrief(trends, contentHistory), 'utf-8');
  console.log(`   Research brief: ${researchBriefPath}`);

  const tickersInNews = await tickersPromise;
  const tickerSymbols = tickersInNews.tickers.map(t => t.symbol);
  console.log(`   Tickers: ${tickerSymbols.join(', ') || 'none'}`);
  console.log('');

  // ── AGENT 1B: HISTORY GUARD ───────────────────────────────────────────────
  console.log('━━━ AGENT 1B: HISTORY GUARD ━━━');
  const topTopic = trends.topics[0]?.title ?? '';
  const historyGuard = await new HistoryGuardAgent().execute({ topic: topTopic, contentHistory });
  if (historyGuard.block) {
    console.warn(`   ⛔ Blocked "${topTopic}". Pivot: ${historyGuard.suggestedPivot}`);
    if (trends.topics.length > 1) {
      const [blocked, ...rest] = trends.topics;
      trends.topics = [...rest, { ...blocked, score: (blocked.score ?? 0) * 0.3 }];
      console.log(`   Using: "${trends.topics[0]?.title}"`);
    }
  }
  console.log('');

  // ── AGENT 2: CONTENT STRATEGY ─────────────────────────────────────────────
  console.log('━━━ AGENT 2: CONTENT STRATEGY ━━━');
  const strategy = await new ContentStrategyAgent().execute({ trends, contentHistory });
  console.log(`   Topic: ${strategy.topic}`);
  console.log(`   Hook:  ${strategy.hook}`);
  console.log('');

  // ── AGENT 3: FORMAT STYLE ─────────────────────────────────────────────────
  console.log('━━━ AGENT 3: FORMAT STYLE ━━━');
  const format = await new FormatStyleAgent().execute({ strategy, contentHistory, tickerSymbols });
  console.log(`   Format: ${format.formatType} (${format.slideCount} slides)`);
  console.log(`   Tone:   ${format.visualTone}`);
  console.log('');

  // ── AGENT 4: SLIDE NARRATIVE ──────────────────────────────────────────────
  console.log('━━━ AGENT 4: SLIDE NARRATIVE ━━━');
  const narrative = await new SlideNarrativeAgent().execute({ strategy, format, tickerSymbols });
  console.log(`   Wrote ${narrative.slides.length} slide specs`);
  narrative.slides.forEach(s => console.log(`   Slide ${s.slideNumber} [${s.role}]: ${s.headline}`));
  console.log('');

  // ── AGENT 5: COMPLIANCE QA ────────────────────────────────────────────────
  console.log('━━━ AGENT 5: COMPLIANCE QA ━━━');
  const compliance = await new ComplianceQAAgent().execute({ strategy });
  if (!compliance.isValid) throw new Error(`Compliance failed: ${compliance.failures.join(' ')}`);
  console.log(`   Score: ${(compliance.confidenceScore * 100).toFixed(0)}%`);
  console.log('');

  // ── AGENT 6: IMAGE PROMPTS ────────────────────────────────────────────────
  console.log('━━━ AGENT 6: IMAGE PROMPTS ━━━');
  const promptSet = new ImagePromptAgent().execute({ slides: narrative.slides, format });
  console.log(`   Generated ${promptSet.slides.length} complete Gemini prompts`);
  const promptsText = promptSet.slides.map(s => `SLIDE ${s.slideNumber} (${s.role}):\n${s.geminiPrompt}\n\n`).join('');
  fs.writeFileSync(path.join(outputDir, 'PROMPTS.txt'), promptsText, 'utf-8');
  console.log(`   Saved prompts to ${path.join(outputDir, 'PROMPTS.txt')}`);
  console.log('');

  // ── AGENT 7: COPYWRITING ──────────────────────────────────────────────────
  console.log('━━━ AGENT 7: COPYWRITING ━━━');
  const copy = await new CopywritingAgent().execute({ strategy });
  console.log('');

  // ── AGENT 8: FINAL COMPLIANCE ─────────────────────────────────────────────
  console.log('━━━ AGENT 8: FINAL COMPLIANCE ━━━');
  const finalCompliance = await new ComplianceQAAgent().execute({ strategy, copy });
  if (!finalCompliance.isValid) throw new Error(`Final compliance failed: ${finalCompliance.failures.join(' ')}`);
  console.log(`   Score: ${(finalCompliance.confidenceScore * 100).toFixed(0)}%`);
  console.log('');

  // ── TELEGRAM DELIVERY ─────────────────────────────────────────────────────
  console.log('━━━ TELEGRAM DELIVERY ━━━');
  await sendPromptsToTelegram({ copy, strategy, format, promptSet });
  console.log('');

  // ── PERSIST HISTORY ───────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  appendContentHistory(historyPath, {
    date: today,
    topic: strategy.topic,
    hook: strategy.hook,
    format: strategy.format,
    formatType: format.formatType,
    slideCount: narrative.slides.length,
    keywords: strategy.searchKeywords || [],
    visualSignature: runSlug,
  });

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ✅ DONE — ${elapsed}s`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
}

function buildResearchBrief(
  trends: Awaited<ReturnType<TrendResearchAgent['execute']>>,
  contentHistory: ReturnType<typeof loadContentHistory>,
): string {
  return `# TheStatsAndStacks Research Brief\n\nGenerated: ${getLocalTimestamp()}\n\n## Recent Topics\n\n${
    contentHistory.length
      ? contentHistory.slice(-10).map(e => `- ${e.date}: ${e.topic} (${e.formatType ?? e.format})`).join('\n')
      : '- No history'
  }\n\n## Research Signals\n\n${
    (trends.signalBriefs ?? []).map(s =>
      `### ${s.source} (${s.status})\n${s.summary}\nSeeds: ${s.topicSeeds.join(' | ')}\nSources: ${s.sourceUrls.join(' | ')}`
    ).join('\n\n')
  }\n\n## Ranked Topics\n\n${
    trends.topics.map((t, i) =>
      `${i + 1}. ${t.title}\n   Score: ${t.score} | ${t.suggestedFormat ?? ''} | ${t.contentPillar ?? ''}\n   Why now: ${t.freshnessSignal ?? t.reasoning}`
    ).join('\n\n')
  }`;
}

main().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
