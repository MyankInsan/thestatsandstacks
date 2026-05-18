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
import { VisualAssetSourcingAgent, type VisualAssetSourcingPlan } from './src/lib/agents/visualAssetSourcingAgent';
import { ImageGenerationAgent, type GeneratedImage } from './src/lib/agents/imageGenerationAgent';
import { VisionQAAgent, type QAReport } from './src/lib/agents/visionQAAgent';
import { CopywritingAgent } from './src/lib/agents/copywritingAgent';
import { TickersInNewsAgent } from './src/lib/agents/tickersInNewsAgent';
import { HistoryGuardAgent } from './src/lib/agents/historyGuardAgent';
import { FinalGateAgent } from './src/lib/agents/finalGateAgent';
import { RegenLoopAgent } from './src/lib/agents/regenLoopAgent';
import { emailPostToPhone } from './src/lib/services/emailDelivery';
import { sendPostToTelegram, sendVideoToTelegram } from './src/lib/services/telegramDelivery';
import { decideDayType } from './src/lib/agents/dayTypeAgent';
import { VideoCompilationAgent } from './src/lib/agents/videoCompilationAgent';
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
  const plannedPrompts: SlidePrompt[] = promptSet.prompts.slice(0, getImageCount(strategy));
  if (plannedPrompts.length === 0) {
    throw new Error('Strategy requested images, but no image prompts were generated.');
  }
  const manualPromptPath = path.join(outputDir, 'MANUAL_IMAGE_PROMPTS.md');
  fs.writeFileSync(
    manualPromptPath,
    buildManualImagePromptPacket(strategy, plannedPrompts),
    'utf-8'
  );
  console.log(`   Image prompt packet saved: ${manualPromptPath}`);
  console.log('');

  // ── AGENT 7: VISUAL ASSET SOURCING ──
  console.log('━━━ AGENT 7: VISUAL ASSET SOURCING ━━━');
  const visualAssetPlan = await new VisualAssetSourcingAgent().execute({
    strategy,
    prompts: plannedPrompts,
    formatDecision,
    carouselPlan,
  });
  const visualAssetPlanPath = path.join(outputDir, 'VISUAL_ASSET_PLAN.md');
  fs.writeFileSync(visualAssetPlanPath, buildVisualAssetPlanPacket(visualAssetPlan), 'utf-8');
  console.log(`   ${visualAssetPlan.summary}`);
  console.log(`   Visual asset plan saved: ${visualAssetPlanPath}`);
  console.log('');

  // ── AGENT 8: IMAGE GENERATION ──
  console.log('━━━ AGENT 8: IMAGE GENERATION ━━━');
  const imageGenAgent = new ImageGenerationAgent();
  const generatedImages = await imageGenAgent.execute({
    prompts: plannedPrompts,
    outputDir,
    visualPlan: visualAssetPlan,
  });
  console.log('');

  // ── AGENT 9: VISION QA + REGEN LOOP ──
  console.log('━━━ AGENT 9: VISION QA + REGEN LOOP ━━━');
  const qaAgent = new VisionQAAgent();
  const regenAgent = new RegenLoopAgent();
  const finalImages: GeneratedImage[] = [];

  for (const img of generatedImages.images) {
    const prompt = plannedPrompts.find((p) => p.slideNumber === img.slideNumber);
    if (!prompt) { finalImages.push(img); continue; }

    const result = await regenAgent.execute({
      slideNumber: img.slideNumber,
      prompt,
      generate: async (p, _correctionNotes) => {
        const res = await imageGenAgent.execute({ prompts: [p], outputDir, visualPlan: visualAssetPlan });
        return res.images[0] ?? img;
      },
      critique: async (image) => {
        const report = await qaAgent.execute({ images: [image] });
        const sr = report.slideReports[0];
        return {
          score: sr?.confidenceScore ?? 0,
          pass: (sr?.confidenceScore ?? 0) >= 0.80,
          issues: (sr?.failures ?? []).map((b) => ({ severity: 'high' as const, body: b })),
        };
      },
    });
    finalImages.push(result.image);
  }

  const qaReport: QAReport = await qaAgent.execute({ images: finalImages });
  console.log(`   📊 Overall QA Score: ${(qaReport.overallScore * 100).toFixed(1)}%`);
  if (!qaReport.allPassed) {
    throw new Error(`Image QA failed after regen loop: ${qaReport.slideReports.flatMap((r) => r.failures).join(' ')}`);
  }
  generatedImages.images.length = 0;
  generatedImages.images.push(...finalImages);
  console.log('');

  if (!generatedImages.images.length) {
    throw new Error('Pipeline produced no postable media. Delivery was stopped.');
  }

  // ── AGENT 10: COPYWRITING ──
  console.log('━━━ AGENT 10: COPYWRITING ━━━');
  const copyAgent = new CopywritingAgent();
  const copy = await copyAgent.execute({ strategy });
  console.log('');

  // ── AGENT 11: FINAL COMPLIANCE QA ──
  console.log('━━━ AGENT 11: FINAL COMPLIANCE QA ━━━');
  const copyCompliance = await complianceAgent.execute({ strategy, copy });
  if (!copyCompliance.isValid) {
    throw new Error(`Final compliance failed: ${copyCompliance.failures.join(' ')}`);
  }
  console.log(`   Compliance score: ${(copyCompliance.confidenceScore * 100).toFixed(0)}%`);
  console.log('');

  const postReadyPath = path.join(outputDir, 'POST_READY.txt');
  fs.writeFileSync(
    postReadyPath,
    buildPostReadyFile({
      strategy,
      copy,
      qaReport,
      images: generatedImages.images,
      visualAssetPlan,
    }),
    'utf-8'
  );
  console.log(`   Post package saved: ${postReadyPath}`);

  // ── AGENT 11B: FINAL GATE ──
  console.log('━━━ AGENT 11B: FINAL GATE ━━━');
  const finalGate = await new FinalGateAgent().execute({ copy });
  if (!finalGate.passed) {
    throw new Error(`Final Gate blocked delivery: ${finalGate.failedChecks.join('; ')}`);
  }
  console.log('');

  // ── DELIVERY (photo vs video fork) ──────────────────────────────────────
  if (dayType === 'video') {
    console.log('━━━ AGENT VIDEO: COMPILATION ━━━');
    const videoAgent = new VideoCompilationAgent();
    const videoResult = videoAgent.execute({
      imagePaths: generatedImages.images.map((img) => img.localPath),
      outputDir,
      runSlug,
    });
    console.log(`   Reel compiled: ${videoResult.videoPath} (${videoResult.durationSeconds.toFixed(1)}s)`);
    console.log('');

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      console.log('━━━ SENDING TELEGRAM VIDEO ━━━');
      await sendVideoToTelegram({
        videoPath: videoResult.videoPath,
        copy,
        strategy,
        qaReport,
        durationSeconds: videoResult.durationSeconds,
      });
    } else {
      console.log('━━━ TELEGRAM VIDEO SKIPPED ━━━');
      console.log('   Telegram delivery skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set).');
    }
  } else {
    // ── PHOTO DAY ────────────────────────────────────────────────────────
    if (process.env.GMAIL_ADDRESS && process.env.GMAIL_APP_PASSWORD && process.env.DELIVERY_EMAIL) {
      console.log('━━━ SENDING EMAIL ━━━');
      await emailPostToPhone({
        images: generatedImages.images,
        copy,
        strategy,
        qaReport,
      });
    } else {
      console.log('━━━ EMAIL SKIPPED ━━━');
      console.log('   Email delivery skipped because Gmail delivery secrets are not set.');
    }

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      console.log('━━━ SENDING TELEGRAM PHOTOS ━━━');
      await sendPostToTelegram({
        images: generatedImages.images,
        copy,
        strategy,
        qaReport,
        manualPromptPath,
        researchBriefPath,
        visualAssetPlanPath,
      });
    } else {
      console.log('━━━ TELEGRAM SKIPPED ━━━');
      console.log('   Telegram delivery skipped because TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not set.');
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  appendContentHistory(historyPath, {
    date: today,
    topic: strategy.topic,
    hook: strategy.hook,
    format: strategy.format,
    slideCount: generatedImages.images.length,
    keywords: strategy.searchKeywords || [],
    visualSignature: runSlug,
  });

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ✅ DONE — ${elapsed}s — ${generatedImages.images.length} picture slides generated`);
  console.log('═══════════════════════════════════════════════════════');
}

function buildPostReadyFile(input: {
  strategy: Awaited<ReturnType<ContentStrategyAgent['execute']>>,
  copy: Awaited<ReturnType<CopywritingAgent['execute']>>,
  qaReport: Awaited<ReturnType<VisionQAAgent['execute']>>,
  images: GeneratedImage[],
  visualAssetPlan: VisualAssetSourcingPlan,
}): string {
  return `THESTATSANDSTACKS DAILY POST
Generated: ${getLocalTimestamp()}

TOPIC
${input.strategy.topic}

FORMAT
${input.strategy.format} (${input.images.length} picture slide${input.images.length === 1 ? '' : 's'})

GROWTH NOTES
${buildGrowthPublishingChecklist(input)}

VISUAL SOURCES
${buildVisualSourceSummary(input)}

QA SCORE
${(input.qaReport.overallScore * 100).toFixed(0)}%

CAPTION
${input.copy.caption}

HASHTAGS
${input.copy.hashtags}

FIRST COMMENT
${input.copy.firstComment}

ALT TEXT
${input.copy.altText}

SLIDES
${input.images.map((image, index) => `Slide ${index + 1}: ${image.localPath}`).join('\n')}
`;
}

function buildGrowthPublishingChecklist(input: {
  strategy: Awaited<ReturnType<ContentStrategyAgent['execute']>>,
  images: GeneratedImage[],
}): string {
  const mediaAdvice = 'Publish as a picture carousel. The first slide is the cover, so judge it by whether it creates a save-worthy reason to swipe in under two seconds.';
  const stockSafety = /stock|watchlist|earnings|market|portfolio|etf/i.test(`${input.strategy.topic} ${input.strategy.searchKeywords.join(' ')}`)
    ? 'Keep comments educational: no ticker requests, no buy/sell language, no price targets.'
    : 'Keep comments practical: answer with frameworks and Canadian context, not personal financial advice.';

  return [
    `Cover hook: ${input.strategy.hook}`,
    'Primary growth job: saves, shares, profile visits, and follows.',
    mediaAdvice,
    'Reference pattern: simple million-follower finance creator clarity, but original TheStatsAndStacks design and Canadian positioning.',
    stockSafety,
  ].join('\n');
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

function buildVisualAssetPlanPacket(plan: VisualAssetSourcingPlan): string {
  return `# TheStatsAndStacks Visual Asset Plan

Generated: ${getLocalTimestamp()}

${plan.summary}

Provider order: ${plan.providerOrder.join(' -> ')}

${plan.warnings.length ? `Warnings:\n${plan.warnings.map((warning) => `- ${warning}`).join('\n')}\n` : ''}
## Slide Sources

${plan.slides.map((slide) => `### Slide ${slide.slideNumber}

- Provider: ${slide.provider}
- Query: ${slide.query}
- Reason: ${slide.reason}
- Source: ${slide.sourcePage || slide.assetUrl || 'generated/local'}
- License: ${slide.license || 'n/a'}
- Attribution: ${slide.attribution || 'n/a'}

Background prompt:
${slide.backgroundPrompt}
`).join('\n')}`;
}

function buildVisualSourceSummary(input: {
  images: GeneratedImage[],
  visualAssetPlan: VisualAssetSourcingPlan,
}): string {
  const lines = input.images.map((image) => {
    const plan = input.visualAssetPlan.slides.find((slide) => slide.slideNumber === image.slideNumber);
    const source = image.source === 'local'
      ? 'local generated design'
      : image.source === 'cloudflare'
        ? 'Cloudflare Workers AI original background'
        : `${image.source} licensed source`;
    const attribution = image.attribution || plan?.attribution;
    return `Slide ${image.slideNumber}: ${source}${attribution ? ` — ${attribution}` : ''}`;
  });
  return lines.join('\n');
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});

function buildManualImagePromptPacket(
  strategy: Awaited<ReturnType<ContentStrategyAgent['execute']>>,
  prompts: SlidePrompt[]
): string {
  return `# TheStatsAndStacks Manual Image Prompts

Topic: ${strategy.topic}
Format: ${strategy.format}
Hook: ${strategy.hook}

Use this file if you want to manually generate images in ChatGPT or Gemini using your existing subscriptions. Generate one slide at a time, download each image, and keep the slide numbers in order.

## Style Lock

Premium faceless Canadian personal finance carousel. Dark navy and charcoal base, emerald green and muted gold accents, editorial layout, high-trust finance tone, crisp readable typography, no fake statistics, no personalized financial advice, no hype.

${prompts.map((prompt) => `## Slide ${prompt.slideNumber}

${prompt.slideDescription}

\`\`\`text
${prompt.dallePrompt}
\`\`\`
`).join('\n')}`;
}
