import 'dotenv/config';
import path from 'path';
import fs from 'fs';

import { CostGuardAgent } from './src/lib/agents/costGuardAgent';
import { SlotContextAgent } from './src/lib/agents/slotContextAgent';
import { TickersInNewsAgent } from './src/lib/agents/tickersInNewsAgent';
import { TrendResearchAgent } from './src/lib/agents/trendResearchAgent';
import { TopicAngleAgent } from './src/lib/agents/topicAngleAgent';
import { HistoryGuardAgent } from './src/lib/agents/historyGuardAgent';
import { ContentStrategyAgent } from './src/lib/agents/contentStrategyAgent';
import { FormatStyleAgent } from './src/lib/agents/formatStyleAgent';
import { CarouselConstraintAgent } from './src/lib/agents/carouselConstraintAgent';
import { FinancialVizPicker } from './src/lib/agents/financialVizPicker';
import { SlideNarrativeAgent } from './src/lib/agents/slideNarrativeAgent';
import { ComplianceQAAgent } from './src/lib/agents/complianceQAAgent';
import { ImagePromptAgent } from './src/lib/agents/imagePromptAgent';
import { CopywritingAgent } from './src/lib/agents/copywritingAgent';

import { sendPromptsToTelegram } from './src/lib/services/telegramDelivery';
import { TICKER_LOGO_MAP } from './src/lib/agents/tickerLogoAgent';
import {
  appendContentHistory,
  loadContentHistory,
  type ContentHistoryEntry,
  CURRENT_SCHEMA_VERSION,
} from './src/lib/services/contentHistory';
import { getLocalDateKey, getLocalTimestamp, getRunSlug } from './src/lib/services/dateUtils';
import type { CtaId, CtaFeedbackEntry } from './src/lib/agents/ctaLibrary';

async function main() {
  const startTime = Date.now();
  const now = new Date();
  const today = getLocalDateKey(now);
  const runSlug = getRunSlug(now);

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🚀 THESTATSANDSTACKS — DAILY PIPELINE V2');
  console.log(`  📅 ${today}`);

  const historyPath = process.env.CONTENT_HISTORY_PATH
    || path.join(__dirname, 'content-history.json');
  const contentHistory = loadContentHistory(historyPath);

  // ── AGENT 0: ZERO-COST GUARD ────────────────────────────────────────────────
  console.log('━━━ AGENT 0: ZERO-COST GUARD ━━━');
  const costGuard = await new CostGuardAgent().execute();
  for (const note of costGuard.notes) console.log(`   ${note}`);
  if (!costGuard.isSafe) throw new Error(`Cost guard blocked: ${costGuard.failures.join(' ')}`);
  console.log('');

  // ── AGENT 1: SLOT CONTEXT ───────────────────────────────────────────────────
  console.log('━━━ AGENT 1: SLOT CONTEXT ━━━');
  const slotContext = new SlotContextAgent().execute({
    contentHistory,
    todayDateKey: today,
    now,
  });
  console.log(`   Slot ${slotContext.slotIndex} (${slotContext.config.persona})  trigger=${slotContext.triggerSource}`);
  console.log(`   Today already posted: ${slotContext.todayPriorEntries.length} entries`);
  if (slotContext.forceAngleId) console.log(`   FORCE_ANGLE=${slotContext.forceAngleId}`);

  const outputDir = path.join('/tmp', 'thestatsandstacks', `${today}-s${slotContext.slotIndex}`);
  process.env.CONTENT_RUN_SLUG = `${today}-s${slotContext.slotIndex}`;
  fs.mkdirSync(outputDir, { recursive: true });
  console.log('');

  // ── AGENT 2A: TICKERS IN NEWS (parallel with trend research) ────────────────
  console.log('━━━ AGENT 2A: TICKERS IN NEWS ━━━');
  const tickersPromise = new TickersInNewsAgent().execute({}).catch((err) => {
    console.warn(`   [TickersInNews] Non-fatal: ${err instanceof Error ? err.message : err}`);
    return { tickers: [] as Array<{ symbol: string }> };
  });

  // ── AGENT 2B: TREND RESEARCH ────────────────────────────────────────────────
  console.log('━━━ AGENT 2B: TREND RESEARCH ━━━');
  const trends = await new TrendResearchAgent().execute({ contentHistory });

  const researchBriefPath = path.join(outputDir, 'RESEARCH_BRIEF.md');
  fs.writeFileSync(researchBriefPath, buildResearchBrief(trends, contentHistory), 'utf-8');
  console.log(`   Research brief: ${researchBriefPath}`);

  const tickersInNews = await tickersPromise;
  const tickerSymbols = tickersInNews.tickers.map((t) => t.symbol);
  console.log(`   Tickers: ${tickerSymbols.join(', ') || 'none'}`);
  console.log('');

  // ── AGENT 3: TOPIC ANGLE EXPANSION ──────────────────────────────────────────
  console.log('━━━ AGENT 3: TOPIC ANGLE EXPANSION ━━━');
  const angleResult = await new TopicAngleAgent().execute({
    preferredAngleIds: slotContext.config.preferredAngles,
    recentAngleIds: contentHistory
      .slice(-20)
      .map((e) => e.angleId)
      .filter((a): a is NonNullable<typeof a> => Boolean(a)),
    forceAngleId: slotContext.forceAngleId as never,
    trendCandidates: trends.topics,
  });
  if (angleResult.angleCandidates.length > 0) {
    console.log(`   Angle candidates: ${angleResult.angleCandidates.map((a) => a.angleId).join(', ')}`);
    for (const c of angleResult.angleCandidates.slice(0, 3)) {
      trends.topics.unshift({
        title: c.title,
        score: 0.95,
        reasoning: c.rationale,
        searchKeywords: [],
        sourceUrls: c.sourceUrls,
        contentPillar: c.angleId,
      });
    }
  } else {
    console.log(`   No angle candidates injected; using standard trend topics.`);
  }
  console.log('');

  // ── AGENT 4: HISTORY GUARD ──────────────────────────────────────────────────
  console.log('━━━ AGENT 4: HISTORY GUARD ━━━');
  let historyGuard = {
    block: true,
    mustAvoid: { visualStyles: [], portraitSubjects: [], archetypes: [], hookFormulas: [], tickers: [], narrativeArcs: [], angles: [], colorTriples: [] },
    warnings: [] as string[]
  } as any;

  const originalCount = trends.topics.length;
  let attempts = 0;

  while (trends.topics.length > 0 && attempts < originalCount) {
    const candidate = trends.topics[0]?.title ?? '';
    historyGuard = await new HistoryGuardAgent().execute({
      topic: candidate,
      contentHistory,
      slotIndex: slotContext.slotIndex,
      todayDateKey: today,
    });

    if (!historyGuard.block) {
      console.log(`   ✅ Selected Topic: "${candidate}"`);
      break;
    }

    console.warn(`   ⛔ Blocked "${candidate}". Pivot: ${historyGuard.suggestedPivot}`);
    const blocked = trends.topics.shift()!;
    trends.topics.push({ ...blocked, score: (blocked.score ?? 0) * 0.3 });
    attempts++;
  }

  if (historyGuard.block && trends.topics.length > 0) {
    console.warn(`   ⚠️ Warning: All available topics were blocked by HistoryGuard. Proceeding with fallback: "${trends.topics[0]?.title}"`);
  }

  if (historyGuard.warnings.length > 0) {
    for (const w of historyGuard.warnings) console.log(`   ⚠️ ${w}`);
  }
  console.log(`   mustAvoid styles: ${historyGuard.mustAvoid.visualStyles.length}, portraits: ${historyGuard.mustAvoid.portraitSubjects.length}`);
  console.log('');

  // ── AGENT 5: CONTENT STRATEGY ───────────────────────────────────────────────
  console.log('━━━ AGENT 5: CONTENT STRATEGY ━━━');
  const ctaFeedback = loadCtaFeedback();
  const recentCtasUsed = contentHistory
    .slice(-30)
    .map((e) => e.ctaId)
    .filter((c): c is CtaId => Boolean(c));
  const strategy = await new ContentStrategyAgent().execute({
    trends,
    contentHistory,
    slot: slotContext.config,
    mustAvoid: historyGuard.mustAvoid,
    ctaFeedback,
    recentCtasUsed,
    preferredAngleId: angleResult.angleCandidates[0]?.angleId,
  });
  console.log(`   Topic: ${strategy.topic}`);
  console.log(`   Hook:  ${strategy.hook}  (formula: ${strategy.hookFormulaId})`);
  console.log(`   CTA:   ${strategy.ctaId}`);
  console.log(`   Category: ${strategy.topicCategory}`);
  console.log('');

  // ── AGENT 6: FORMAT STYLE ───────────────────────────────────────────────────
  console.log('━━━ AGENT 6: FORMAT STYLE ━━━');
  const activeTickers = tickerSymbols.filter((symbol) => isTickerActive(symbol, strategy));
  console.log(`   Active Tickers (filtered for topic): ${activeTickers.join(', ') || 'none'}`);

  const format = await new FormatStyleAgent().execute({
    strategy,
    contentHistory,
    tickerSymbols: activeTickers,
    slot: slotContext.config,
    todayPriorEntries: slotContext.todayPriorEntries,
  });
  console.log(`   Format: ${format.formatType} (${format.slideCount} slides)`);
  console.log(`   Tone:   ${format.visualTone}`);
  console.log('');

  // ── AGENT 7: CAROUSEL CONSTRAINTS ───────────────────────────────────────────
  console.log('━━━ AGENT 7: CAROUSEL CONSTRAINTS ━━━');
  const vizPicker = new FinancialVizPicker();
  const isReactive = angleResult.angleCandidates[0]?.angleId === 'REACTIVE_SENTIMENT';
  const vizDecision = vizPicker.pickForAngle({
    angleId: angleResult.angleCandidates[0]?.angleId,
    hasTickers: activeTickers.length > 0,
    isReactiveSentiment: isReactive,
    excludedStyles: historyGuard.mustAvoid.visualStyles,
    preferTested: true,
  });
  const constraints = new CarouselConstraintAgent().execute({
    slot: slotContext.config,
    ctaId: strategy.ctaId ?? 'save_specific',
    topicCategory: strategy.topicCategory ?? 'BEHAVIORAL',
    isReactiveSentiment: isReactive,
    hasTickers: activeTickers.length > 0,
    tickers: activeTickers,
    topic: strategy.topic,
    recentHistory: contentHistory,
    todayDateKey: today,
    todayPriorEntries: slotContext.todayPriorEntries,
    chartHeroSuggestion: vizDecision.hero,
    chartSupportingSuggestions: vizDecision.supporting,
    slideCount: format.slideCount,
  });
  console.log(`   Excluded styles: ${constraints.excludedStyles.length}`);
  console.log(`   Chart hero suggestion: ${constraints.chartHeroSuggestion ?? 'none'}`);
  console.log(`   Portrait: ${constraints.portraitSelection?.displayName ?? 'none'}`);
  console.log(`   Narrative arc: ${constraints.narrativeArc}`);
  console.log('');

  // ── AGENT 8: SLIDE NARRATIVE ────────────────────────────────────────────────
  console.log('━━━ AGENT 8: SLIDE NARRATIVE ━━━');
  const narrative = await new SlideNarrativeAgent().execute({
    strategy,
    format,
    tickerSymbols: activeTickers,
    constraints,
  });
  console.log(`   Wrote ${narrative.slides.length} slide specs${narrative.hadConstraintViolation ? ' (after constraint retries)' : ''}`);
  narrative.slides.forEach((s) => console.log(`   Slide ${s.slideNumber} [${s.role}/${s.visualStyle}]: ${s.headline}`));
  console.log('');

  // ── AGENT 9: COMPLIANCE QA (STRATEGY) ───────────────────────────────────────
  console.log('━━━ AGENT 9: COMPLIANCE QA ━━━');
  const compliance = await new ComplianceQAAgent().execute({ strategy });
  if (!compliance.isValid) throw new Error(`Compliance failed: ${compliance.failures.join(' ')}`);
  console.log(`   Score: ${(compliance.confidenceScore * 100).toFixed(0)}%`);
  console.log('');

  // ── AGENT 10: IMAGE PROMPTS ─────────────────────────────────────────────────
  console.log('━━━ AGENT 10: IMAGE PROMPTS ━━━');
  const promptSet = await new ImagePromptAgent().execute({
    slides: narrative.slides,
    format,
    strategy,
    constraints,
    recentHistory: contentHistory,
    tickerSymbols: activeTickers,
    dateKey: today,
  });
  console.log(`   Generated ${promptSet.slides.length} complete prompts`);
  const promptsText = promptSet.slides
    .map((s) => `SLIDE ${s.slideNumber} (${s.role}) — ${s.recommendedModelLabel}\n${s.geminiPrompt}\n${s.canvaFallbackData ? `\nCANVA FALLBACK DATA:\n${s.canvaFallbackData}\n` : ''}\n`)
    .join('');
  fs.writeFileSync(path.join(outputDir, 'PROMPTS.txt'), promptsText, 'utf-8');
  console.log(`   Saved to ${path.join(outputDir, 'PROMPTS.txt')}`);
  console.log('');

  // ── AGENT 11: COPYWRITING ───────────────────────────────────────────────────
  console.log('━━━ AGENT 11: COPYWRITING ━━━');
  const copy = await new CopywritingAgent().execute({ strategy });
  console.log('');

  // ── AGENT 12: FINAL COMPLIANCE QA (COPY) ────────────────────────────────────
  console.log('━━━ AGENT 12: FINAL COMPLIANCE QA ━━━');
  const finalCompliance = await new ComplianceQAAgent().execute({ strategy, copy });
  if (!finalCompliance.isValid) throw new Error(`Final compliance failed: ${finalCompliance.failures.join(' ')}`);
  console.log(`   Score: ${(finalCompliance.confidenceScore * 100).toFixed(0)}%`);
  console.log('');

  // ── TELEGRAM DELIVERY ───────────────────────────────────────────────────────
  console.log('━━━ TELEGRAM DELIVERY ━━━');
  await sendPromptsToTelegram({
    copy,
    strategy,
    format,
    promptSet,
    slot: slotContext.config,
  });
  console.log('');

  // ── PERSIST HISTORY ─────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const entry: ContentHistoryEntry = {
    date: today,
    topic: strategy.topic,
    hook: strategy.hook,
    format: strategy.format,
    formatType: format.formatType,
    slideCount: narrative.slides.length,
    keywords: strategy.searchKeywords || [],
    visualSignature: runSlug,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    slotIndex: slotContext.slotIndex,
    postedAtUtc: new Date().toISOString(),
    tickersFeatured: activeTickers,
    topicCategory: strategy.topicCategory,
    hookFormulaId: strategy.hookFormulaId,
    ctaId: strategy.ctaId,
    angleId: strategy.angleId,
    narrativeArc: constraints.narrativeArc,
    visualStylesUsed: narrative.slides.map((s) => s.visualStyle),
    coverVisualStyle: narrative.slides[0]?.visualStyle,
    portraitSubjects: constraints.portraitSelection?.tier === 1 ? [constraints.portraitSelection.slug] : [],
    archetypesUsed: constraints.portraitSelection?.tier === 2 ? [constraints.portraitSelection.slug] : [],
    colorSchemeUsed: {
      bg: format.colorScheme.bg,
      primaryText: format.colorScheme.primaryText,
      accent1: format.colorScheme.accent1,
      accent2: format.colorScheme.accent2,
    },
  };
  appendContentHistory(historyPath, entry);

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ✅ DONE — ${elapsed}s  |  Slot ${slotContext.slotIndex}/6`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
}

function loadCtaFeedback(): CtaFeedbackEntry[] {
  const candidates = [
    path.join(__dirname, 'data', 'cta-feedback.json'),
    path.join(process.cwd(), 'data', 'cta-feedback.json'),
    path.join(process.cwd(), 'platform', 'data', 'cta-feedback.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) as CtaFeedbackEntry[];
      } catch {
        return [];
      }
    }
  }
  return [];
}

function buildResearchBrief(
  trends: Awaited<ReturnType<TrendResearchAgent['execute']>>,
  contentHistory: ReturnType<typeof loadContentHistory>,
): string {
  return `# TheStatsAndStacks Research Brief\n\nGenerated: ${getLocalTimestamp()}\n\n## Recent Topics\n\n${
    contentHistory.length
      ? contentHistory.slice(-10).map((e) => `- ${e.date} s${e.slotIndex ?? 0}: ${e.topic} (${e.formatType ?? e.format})`).join('\n')
      : '- No history'
  }\n\n## Research Signals\n\n${
    (trends.signalBriefs ?? []).map((s) =>
      `### ${s.source} (${s.status})\n${s.summary}\nSeeds: ${s.topicSeeds.join(' | ')}\nSources: ${s.sourceUrls.join(' | ')}`,
    ).join('\n\n')
  }\n\n## Ranked Topics\n\n${
    trends.topics.map((t, i) =>
      `${i + 1}. ${t.title}\n   Score: ${t.score} | ${t.suggestedFormat ?? ''} | ${t.contentPillar ?? ''}\n   Why now: ${t.freshnessSignal ?? t.reasoning}`,
    ).join('\n\n')
  }`;
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});

export function isTickerActive(symbol: string, strategy: { topic: string; searchKeywords?: string[]; slideBreakdown?: string[] }): boolean {
  const topicTextLower = `${strategy.topic} ${(strategy.searchKeywords ?? []).join(' ')} ${(strategy.slideBreakdown ?? []).join(' ')}`.toLowerCase();
  const topicTextOriginal = `${strategy.topic} ${(strategy.searchKeywords ?? []).join(' ')} ${(strategy.slideBreakdown ?? []).join(' ')}`;

  const cleanSymbol = symbol.replace(/\.[A-Z]+$/, '');
  const entry = TICKER_LOGO_MAP[symbol];

  const searchTerms: { term: string; caseSensitive: boolean }[] = [
    { term: cleanSymbol, caseSensitive: cleanSymbol.length <= 2 }
  ];
  if (entry) {
    searchTerms.push({ term: entry.companyName, caseSensitive: entry.companyName.length <= 2 });
  }

  for (const { term, caseSensitive } of searchTerms) {
    const escaped = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, caseSensitive ? '' : 'i');
    const textToSearch = caseSensitive ? topicTextOriginal : topicTextLower;
    if (regex.test(textToSearch)) {
      return true;
    }
  }
  return false;
}
