// Standalone daily pipeline runner for GitHub Actions
// This runs WITHOUT the Next.js server or database — just agents + email
import 'dotenv/config';

import { TrendResearchAgent } from './src/lib/agents/trendResearchAgent';
import { ContentStrategyAgent } from './src/lib/agents/contentStrategyAgent';
import { ImagePromptAgent } from './src/lib/agents/imagePromptAgent';
import { ImageGenerationAgent } from './src/lib/agents/imageGenerationAgent';
import { VisionQAAgent } from './src/lib/agents/visionQAAgent';
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

  // ── AGENT 3: IMAGE PROMPTS ──
  console.log('━━━ AGENT 3: IMAGE PROMPTS ━━━');
  const imagePromptAgent = new ImagePromptAgent();
  const promptSet = await imagePromptAgent.execute({ strategy });
  const manualPromptPath = path.join(outputDir, 'MANUAL_IMAGE_PROMPTS.md');
  fs.writeFileSync(
    manualPromptPath,
    buildManualImagePromptPacket(strategy, promptSet.prompts),
    'utf-8'
  );
  console.log(`   Manual image prompt packet saved: ${manualPromptPath}`);
  console.log('');

  // ── AGENT 4: IMAGE GENERATION ──
  console.log('━━━ AGENT 4: IMAGE GENERATION ━━━');
  const imageGenAgent = new ImageGenerationAgent();
  const generatedImages = await imageGenAgent.execute({
    prompts: promptSet.prompts,
    outputDir,
  });
  console.log('');

  // ── AGENT 5: VISION QA (check + regenerate) ──
  console.log('━━━ AGENT 5: VISION QA ━━━');
  const qaAgent = new VisionQAAgent();
  let qaReport = await qaAgent.execute({ images: generatedImages.images });

  let regen = 0;
  while (!qaReport.allPassed && regen < 2) {
    regen++;
    console.log(`   🔄 Regenerating ${qaReport.failedSlides.length} failed slides (attempt ${regen})...`);
    const failedPrompts = promptSet.prompts.filter(p => qaReport.failedSlides.includes(p.slideNumber));
    const regenResult = await imageGenAgent.execute({ prompts: failedPrompts, outputDir });
    for (const img of regenResult.images) {
      const idx = generatedImages.images.findIndex(i => i.slideNumber === img.slideNumber);
      if (idx >= 0) generatedImages.images[idx] = img;
    }
    qaReport = await qaAgent.execute({ images: generatedImages.images });
  }
  console.log(`   📊 Overall QA Score: ${(qaReport.overallScore * 100).toFixed(1)}%`);
  console.log('');

  // ── AGENT 6: COPYWRITING ──
  console.log('━━━ AGENT 6: COPYWRITING ━━━');
  const copyAgent = new CopywritingAgent();
  const copy = await copyAgent.execute({ strategy });
  console.log('');

  const postReadyPath = path.join(outputDir, 'POST_READY.txt');
  fs.writeFileSync(
    postReadyPath,
    buildPostReadyFile({ strategy, copy, qaReport, imagePaths: generatedImages.images.map((image) => image.localPath) }),
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
  console.log(`  ✅ DONE — ${elapsed}s — ${generatedImages.images.length} slides generated`);
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
${input.strategy.format} (${input.imagePaths.length} slides)

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
