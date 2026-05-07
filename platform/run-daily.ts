// Standalone daily pipeline runner for GitHub Actions
// This runs WITHOUT the Next.js server or database — just agents + email
import 'dotenv/config';

import { CostGuardAgent } from './src/lib/agents/costGuardAgent';
import { TrendResearchAgent } from './src/lib/agents/trendResearchAgent';
import { ContentStrategyAgent } from './src/lib/agents/contentStrategyAgent';
import { ComplianceQAAgent } from './src/lib/agents/complianceQAAgent';
import { ImagePromptAgent } from './src/lib/agents/imagePromptAgent';
import { ImageGenerationAgent } from './src/lib/agents/imageGenerationAgent';
import { VisionQAAgent, type QAReport } from './src/lib/agents/visionQAAgent';
import { CopywritingAgent } from './src/lib/agents/copywritingAgent';
import { emailPostToPhone } from './src/lib/services/emailDelivery';
import { sendPostToTelegram } from './src/lib/services/telegramDelivery';
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
  const historyPath = process.env.CONTENT_HISTORY_PATH || path.join('/tmp', 'thestatsandstacks-history', 'content-history.json');
  const contentHistory = loadContentHistory(historyPath);
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🚀 THESTATSANDSTACKS — DAILY PIPELINE');
  console.log(`  📅 ${today}`);
  console.log(`  🧠 History entries loaded: ${contentHistory.length}`);
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

  // ── AGENT 1: TREND RESEARCH ──
  console.log('━━━ AGENT 1: TREND RESEARCH ━━━');
  const researchAgent = new TrendResearchAgent();
  const trends = await researchAgent.execute({ contentHistory });
  const researchBriefPath = path.join(outputDir, 'RESEARCH_BRIEF.md');
  fs.writeFileSync(researchBriefPath, buildResearchBrief(trends, contentHistory), 'utf-8');
  console.log(`   Research brief saved: ${researchBriefPath}`);
  console.log('');

  // ── AGENT 2: CONTENT STRATEGY ──
  console.log('━━━ AGENT 2: CONTENT STRATEGY ━━━');
  const strategyAgent = new ContentStrategyAgent();
  const strategy = await strategyAgent.execute({ trends, contentHistory });
  console.log('');

  // ── AGENT 3: COMPLIANCE QA ──
  console.log('━━━ AGENT 3: COMPLIANCE QA ━━━');
  const complianceAgent = new ComplianceQAAgent();
  const strategyCompliance = await complianceAgent.execute({ strategy });
  if (!strategyCompliance.isValid) {
    throw new Error(`Strategy compliance failed: ${strategyCompliance.failures.join(' ')}`);
  }
  console.log(`   Compliance score: ${(strategyCompliance.confidenceScore * 100).toFixed(0)}%`);
  console.log('');

  // ── AGENT 4: IMAGE PROMPTS ──
  console.log('━━━ AGENT 4: IMAGE PROMPTS ━━━');
  const imagePromptAgent = new ImagePromptAgent();
  const promptSet = await imagePromptAgent.execute({ strategy });
  const plannedPrompts = promptSet.prompts.slice(0, getImageCount(strategy));
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

  // ── AGENT 5: IMAGE GENERATION ──
  console.log('━━━ AGENT 5: IMAGE GENERATION ━━━');
  const imageGenAgent = new ImageGenerationAgent();
  const generatedImages = await imageGenAgent.execute({
    prompts: plannedPrompts,
    outputDir,
  });
  console.log('');

  // ── AGENT 6: VISION QA (check + regenerate) ──
  console.log('━━━ AGENT 6: VISION QA ━━━');
  const qaAgent = new VisionQAAgent();
  let qaReport: QAReport = await qaAgent.execute({ images: generatedImages.images });

  let regen = 0;
  while (!qaReport.allPassed && regen < 2) {
    regen++;
    console.log(`   🔄 Regenerating ${qaReport.failedSlides.length} failed slides (attempt ${regen})...`);
    const failedPrompts = plannedPrompts.filter(p => qaReport.failedSlides.includes(p.slideNumber));
    const regenResult = await imageGenAgent.execute({ prompts: failedPrompts, outputDir });
    for (const img of regenResult.images) {
      const idx = generatedImages.images.findIndex(i => i.slideNumber === img.slideNumber);
      if (idx >= 0) generatedImages.images[idx] = img;
    }
    qaReport = await qaAgent.execute({ images: generatedImages.images });
  }
  console.log(`   📊 Overall QA Score: ${(qaReport.overallScore * 100).toFixed(1)}%`);
  if (!qaReport.allPassed) {
    throw new Error(`Image QA failed after regeneration: ${qaReport.slideReports.flatMap((report) => report.failures).join(' ')}`);
  }
  console.log('');

  if (!generatedImages.images.length) {
    throw new Error('Pipeline produced no postable media. Delivery was stopped.');
  }

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

  const postReadyPath = path.join(outputDir, 'POST_READY.txt');
  fs.writeFileSync(
    postReadyPath,
    buildPostReadyFile({
      strategy,
      copy,
      qaReport,
      imagePaths: generatedImages.images.map((image) => image.localPath),
    }),
    'utf-8'
  );
  console.log(`   Post package saved: ${postReadyPath}`);

  // ── EMAIL TO PHONE ──
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
    console.log('━━━ SENDING TELEGRAM ━━━');
    await sendPostToTelegram({
      images: generatedImages.images,
      copy,
      strategy,
      qaReport,
      manualPromptPath,
      researchBriefPath,
    });
  } else {
    console.log('━━━ TELEGRAM SKIPPED ━━━');
    console.log('   Telegram delivery skipped because TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not set.');
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
  imagePaths: string[],
}): string {
  return `THESTATSANDSTACKS DAILY POST
Generated: ${getLocalTimestamp()}

TOPIC
${input.strategy.topic}

FORMAT
${input.strategy.format} (${input.imagePaths.length} picture slide${input.imagePaths.length === 1 ? '' : 's'})

GROWTH NOTES
${buildGrowthPublishingChecklist(input)}

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
${input.imagePaths.map((imagePath, index) => `Slide ${index + 1}: ${imagePath}`).join('\n')}
`;
}

function buildGrowthPublishingChecklist(input: {
  strategy: Awaited<ReturnType<ContentStrategyAgent['execute']>>,
  imagePaths: string[],
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

function getImageCount(strategy: Awaited<ReturnType<ContentStrategyAgent['execute']>>): number {
  if (strategy.format === 'SINGLE_IMAGE') return 1;
  return Math.max(5, Math.min(8, strategy.slideCount || 7));
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

function buildManualImagePromptPacket(
  strategy: Awaited<ReturnType<ContentStrategyAgent['execute']>>,
  prompts: Array<{ slideNumber: number; slideDescription: string; dallePrompt: string }>
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
