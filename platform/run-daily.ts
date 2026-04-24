// Standalone daily pipeline runner for GitHub Actions
// This runs WITHOUT the Next.js server or database — just agents + email

import { TrendResearchAgent } from './src/lib/agents/trendResearchAgent';
import { ContentStrategyAgent } from './src/lib/agents/contentStrategyAgent';
import { ImagePromptAgent } from './src/lib/agents/imagePromptAgent';
import { ImageGenerationAgent } from './src/lib/agents/imageGenerationAgent';
import { VisionQAAgent } from './src/lib/agents/visionQAAgent';
import { CopywritingAgent } from './src/lib/agents/copywritingAgent';
import { emailPostToPhone } from './src/lib/services/emailDelivery';
import path from 'path';
import fs from 'fs';

async function main() {
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const outputDir = path.join('/tmp', 'thestatsandstacks', today);

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🚀 THESTATSANDSTACKS — DAILY PIPELINE');
  console.log(`  📅 ${today}`);
  console.log('  🌐 Running on GitHub Actions');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ── AGENT 1: TREND RESEARCH ──
  console.log('━━━ AGENT 1: TREND RESEARCH ━━━');
  const researchAgent = new TrendResearchAgent();
  const trends = await researchAgent.execute({});
  console.log('');

  // ── AGENT 2: CONTENT STRATEGY ──
  console.log('━━━ AGENT 2: CONTENT STRATEGY ━━━');
  const strategyAgent = new ContentStrategyAgent();
  const strategy = await strategyAgent.execute({ trends });
  console.log('');

  // ── AGENT 3: IMAGE PROMPTS ──
  console.log('━━━ AGENT 3: IMAGE PROMPTS ━━━');
  const imagePromptAgent = new ImagePromptAgent();
  const promptSet = await imagePromptAgent.execute({ strategy });
  console.log('');

  // ── AGENT 4: IMAGE GENERATION (Imagen 3) ──
  console.log('━━━ AGENT 4: IMAGE GENERATION (Imagen 3) ━━━');
  const imageGenAgent = new ImageGenerationAgent();
  let generatedImages = await imageGenAgent.execute({
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

  // ── EMAIL TO PHONE ──
  console.log('━━━ SENDING EMAIL ━━━');
  await emailPostToPhone({
    images: generatedImages.images,
    copy,
    strategy,
    qaReport,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ✅ DONE — ${elapsed}s — ${generatedImages.images.length} slides emailed to your phone`);
  console.log('═══════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
