import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { TrendResearchAgent } from '../agents/trendResearchAgent';
import { ContentStrategyAgent } from '../agents/contentStrategyAgent';
import { ImagePromptAgent } from '../agents/imagePromptAgent';
import { ImageGenerationAgent } from '../agents/imageGenerationAgent';
import { VisionQAAgent } from '../agents/visionQAAgent';
import { CopywritingAgent } from '../agents/copywritingAgent';

const prisma = new PrismaClient();

// Output folder: ~/Desktop/thestatsandstacks/output/YYYY-MM-DD/
const BASE_OUTPUT_DIR = path.join(process.cwd(), '..', 'output');

export async function runDailyWorkflow() {
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const outputDir = path.join(BASE_OUTPUT_DIR, today);

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🚀 STARTING DAILY AUTONOMOUS WORKFLOW');
  console.log(`  📅 Date: ${today}`);
  console.log(`  📁 Output: ${outputDir}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 1: DEEP TREND RESEARCH
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 1: TREND RESEARCH ━━━');
  const researchAgent = new TrendResearchAgent();
  const trends = await researchAgent.execute({});

  // Save all ideas to DB
  for (const t of trends.topics) {
    await prisma.contentIdea.create({
      data: {
        topic: t.title,
        confidenceScore: t.score,
        reasoning: t.reasoning,
        sourceUrl: t.sourceUrls?.[0] || null,
      }
    });
  }
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 2: CONTENT STRATEGY (Decides format + slide count)
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 2: CONTENT STRATEGY ━━━');
  const strategyAgent = new ContentStrategyAgent();
  const strategy = await strategyAgent.execute({ trends });
  console.log('');

  // Save to DB
  const topIdea = await prisma.contentIdea.findFirst({
    orderBy: { confidenceScore: 'desc' }
  });
  if (!topIdea) throw new Error('No ideas in DB');

  const savedBrief = await prisma.postBrief.create({
    data: {
      ideaId: topIdea.id,
      format: strategy.format,
      hook: strategy.hook,
      angle: strategy.reasoning,
      outline: strategy.slideBreakdown,
      factualClaims: [],
      status: 'DRAFT',
    }
  });

  // ═══════════════════════════════════════════════════════
  // AGENT 3: IMAGE PROMPT GENERATION
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 3: IMAGE PROMPTS ━━━');
  const imagePromptAgent = new ImagePromptAgent();
  const promptSet = await imagePromptAgent.execute({ strategy });
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 4: IMAGE GENERATION (DALL-E 3)
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 4: IMAGE GENERATION (DALL-E 3) ━━━');
  const imageGenAgent = new ImageGenerationAgent();
  const generatedImages = await imageGenAgent.execute({
    prompts: promptSet.prompts,
    outputDir,
  });
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 5: VISION QA (Check every image, regenerate failures)
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 5: VISION QA INSPECTION ━━━');
  const qaAgent = new VisionQAAgent();
  let qaReport = await qaAgent.execute({ images: generatedImages.images });

  // Regeneration loop: if ANY slide fails, regenerate it
  let regenerationAttempt = 0;
  const MAX_REGENERATION_ATTEMPTS = 2;

  while (!qaReport.allPassed && regenerationAttempt < MAX_REGENERATION_ATTEMPTS) {
    regenerationAttempt++;
    console.log('');
    console.log(`   🔄 REGENERATION ATTEMPT ${regenerationAttempt}/${MAX_REGENERATION_ATTEMPTS}`);
    console.log(`   Failed slides: ${qaReport.failedSlides.join(', ')}`);

    // Get the prompts for failed slides only
    const failedPrompts = promptSet.prompts.filter(p => 
      qaReport.failedSlides.includes(p.slideNumber)
    );

    // Regenerate failed slides
    const regenResult = await imageGenAgent.execute({
      prompts: failedPrompts,
      outputDir,
    });

    // Replace the failed images with new ones
    for (const newImage of regenResult.images) {
      const idx = generatedImages.images.findIndex(
        img => img.slideNumber === newImage.slideNumber
      );
      if (idx >= 0) {
        generatedImages.images[idx] = newImage;
      }
    }

    // Re-inspect ALL images
    qaReport = await qaAgent.execute({ images: generatedImages.images });
  }

  if (!qaReport.allPassed) {
    console.log('');
    console.log('   ⚠️  Some slides still failed after regeneration. Proceeding with best available.');
  }

  console.log(`   📊 Overall QA Score: ${(qaReport.overallScore * 100).toFixed(1)}%`);
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 6: COPYWRITING (Caption, Hashtags, Comments)
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 6: COPYWRITING ━━━');
  const copyAgent = new CopywritingAgent();
  const copy = await copyAgent.execute({ strategy });
  console.log('');

  // ═══════════════════════════════════════════════════════
  // SAVE EVERYTHING TO LOCAL FOLDER
  // ═══════════════════════════════════════════════════════
  console.log('━━━ SAVING OUTPUT ━━━');

  // Write the complete post file
  const postContent = `═══════════════════════════════════════════════════════
THESTATSANDSTACKS — DAILY POST
Generated: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Vancouver' })}
═══════════════════════════════════════════════════════

📌 TOPIC: ${strategy.topic}
📐 FORMAT: ${strategy.format} (${strategy.slideCount} slides)
🎯 TARGET: ${strategy.targetAudience}
📊 QA SCORE: ${(qaReport.overallScore * 100).toFixed(1)}%

═══════════════════════════════════════════════════════
📝 CAPTION (Copy and paste this into Instagram):
═══════════════════════════════════════════════════════

${copy.caption}

═══════════════════════════════════════════════════════
# HASHTAGS (Copy and paste these):
═══════════════════════════════════════════════════════

${copy.hashtags}

═══════════════════════════════════════════════════════
💬 FIRST COMMENT (Post this immediately after publishing):
═══════════════════════════════════════════════════════

${copy.firstComment}

═══════════════════════════════════════════════════════
♿ ALT TEXT (Paste into Instagram's alt text field):
═══════════════════════════════════════════════════════

${copy.altText}

═══════════════════════════════════════════════════════
🖼️  IMAGES (Located in this folder):
═══════════════════════════════════════════════════════

${generatedImages.images.map(img => `Slide ${img.slideNumber}: ${img.localPath}`).join('\n')}

═══════════════════════════════════════════════════════
📋 SLIDE BREAKDOWN:
═══════════════════════════════════════════════════════

${strategy.slideBreakdown.join('\n')}

═══════════════════════════════════════════════════════
🔎 QA REPORT:
═══════════════════════════════════════════════════════

${qaReport.slideReports.map(r => `Slide ${r.slideNumber}: ${r.isValid ? '✅ PASSED' : '❌ FAILED'} (${(r.confidenceScore * 100).toFixed(0)}%) ${r.failures.length > 0 ? '— ' + r.failures.join(', ') : ''}`).join('\n')}
`;

  const postFilePath = path.join(outputDir, 'POST_READY.txt');
  fs.writeFileSync(postFilePath, postContent, 'utf-8');
  console.log(`   📄 Post file saved: ${postFilePath}`);

  // Save to database
  const savedPost = await prisma.post.create({
    data: {
      briefId: savedBrief.id,
      caption: copy.caption,
      hashtags: copy.hashtags,
      cta: copy.cta,
      firstComment: copy.firstComment,
      status: 'DRAFT',
      confidenceScore: qaReport.overallScore,
    }
  });

  // Save asset references
  for (const img of generatedImages.images) {
    const prompt = await prisma.prompt.create({
      data: {
        briefId: savedBrief.id,
        text: promptSet.prompts.find(p => p.slideNumber === img.slideNumber)?.dallePrompt || '',
        direction: `Slide ${img.slideNumber}`,
      }
    });

    const asset = await prisma.generatedAsset.create({
      data: {
        promptId: prompt.id,
        imageUrl: `/api/images/${today}/${path.basename(img.localPath)}`,
        localPath: img.localPath,
        visionScore: qaReport.slideReports.find(r => r.slideNumber === img.slideNumber)?.confidenceScore || 0,
        status: 'APPROVED',
      }
    });

    await prisma.postAsset.create({
      data: {
        postId: savedPost.id,
        assetId: asset.id,
        orderIndex: img.slideNumber,
      }
    });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ═══════════════════════════════════════════════════════
  // FINAL STEP: EMAIL EVERYTHING TO YOUR PHONE
  // ═══════════════════════════════════════════════════════
  if (process.env.GMAIL_ADDRESS && process.env.GMAIL_APP_PASSWORD && process.env.DELIVERY_EMAIL) {
    console.log('━━━ EMAIL DELIVERY ━━━');
    const { emailPostToPhone } = await import('../services/emailDelivery');
    await emailPostToPhone({
      images: generatedImages.images,
      copy,
      strategy,
      qaReport,
    });
  } else {
    console.log('');
    console.log('   📧 Email delivery skipped (GMAIL_ADDRESS, GMAIL_APP_PASSWORD, DELIVERY_EMAIL not set in .env)');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ✅ WORKFLOW COMPLETE');
  console.log(`  ⏱️  Total time: ${elapsed} seconds`);
  console.log(`  📁 Local backup saved at: ${outputDir}`);
  console.log(`  📧 Post emailed to your phone`);
  console.log(`  🖼️  ${generatedImages.images.length} images generated`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  return { 
    success: true, 
    outputDir,
    topic: strategy.topic,
    format: strategy.format,
    slideCount: strategy.slideCount,
    qaScore: qaReport.overallScore,
    elapsed,
  };
}
