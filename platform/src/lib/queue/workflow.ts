import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { CostGuardAgent } from '../agents/costGuardAgent';
import { TrendResearchAgent } from '../agents/trendResearchAgent';
import { CarouselPlanningAgent, MediaFormatDecisionAgent } from '../agents/mediaPlanningAgent';
import { ContentStrategyAgent } from '../agents/contentStrategyAgent';
import { ComplianceQAAgent } from '../agents/complianceQAAgent';
import { ImagePromptAgent } from '../agents/imagePromptAgent';
import { VisualAssetSourcingAgent } from '../agents/visualAssetSourcingAgent';
import { ImageGenerationAgent } from '../agents/imageGenerationAgent';
import { VisionQAAgent } from '../agents/visionQAAgent';
import { CopywritingAgent } from '../agents/copywritingAgent';
import { getImageCount } from '../services/imageCount';

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
  // AGENT 0: ZERO-COST GUARD
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 0: ZERO-COST GUARD ━━━');
  const costGuard = await new CostGuardAgent().execute();
  console.log(`   ${costGuard.policy}`);
  for (const note of costGuard.notes) console.log(`   ${note}`);
  if (!costGuard.isSafe) {
    throw new Error(`Zero-cost guard blocked the run: ${costGuard.failures.join(' ')}`);
  }
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
  // AGENT 2: MEDIA FORMAT
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 2: MEDIA FORMAT ━━━');
  const formatDecision = await new MediaFormatDecisionAgent().execute({ trends });
  console.log(`   ${formatDecision.mediaFormat}: ${formatDecision.reasoning}`);
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 3: CAROUSEL PLANNING
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 3: CAROUSEL PLANNING ━━━');
  const carouselPlan = await new CarouselPlanningAgent().execute({ trends, formatDecision });
  console.log(`   ${carouselPlan.slideCount} picture slide${carouselPlan.slideCount === 1 ? '' : 's'} planned.`);
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 4: CONTENT STRATEGY
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 4: CONTENT STRATEGY ━━━');
  const strategyAgent = new ContentStrategyAgent();
  const strategy = await strategyAgent.execute({ trends, formatDecision, carouselPlan });
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 5: COMPLIANCE QA
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 5: COMPLIANCE QA ━━━');
  const complianceAgent = new ComplianceQAAgent();
  const strategyCompliance = await complianceAgent.execute({ strategy });
  if (!strategyCompliance.isValid) {
    throw new Error(`Strategy compliance failed: ${strategyCompliance.failures.join(' ')}`);
  }
  console.log(`   Compliance score: ${(strategyCompliance.confidenceScore * 100).toFixed(0)}%`);
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
  // AGENT 6: IMAGE PROMPT GENERATION
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 6: IMAGE PROMPTS ━━━');
  const imagePromptAgent = new ImagePromptAgent();
  const promptSet = await imagePromptAgent.execute({ strategy });
  const plannedPrompts = (promptSet.photoVariants[0]?.prompts || []).slice(0, getImageCount(strategy));
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 7: VISUAL ASSET SOURCING
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 7: VISUAL ASSET SOURCING ━━━');
  const visualAssetPlan = await new VisualAssetSourcingAgent().execute({
    strategy,
    prompts: plannedPrompts,
    formatDecision,
    carouselPlan,
  });
  console.log(`   ${visualAssetPlan.summary}`);
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 8: IMAGE GENERATION
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 8: IMAGE GENERATION ━━━');
  const imageGenAgent = new ImageGenerationAgent();
  const generatedImages = await imageGenAgent.execute({
    prompts: plannedPrompts,
    outputDir,
    visualPlan: visualAssetPlan,
  });
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 9: VISION QA (Check every image, regenerate failures)
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 9: VISION QA INSPECTION ━━━');
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
    const failedPrompts = plannedPrompts.filter(p =>
      qaReport.failedSlides.includes(p.slideNumber)
    );

    // Regenerate failed slides
    const regenResult = await imageGenAgent.execute({
      prompts: failedPrompts,
      outputDir,
      visualPlan: visualAssetPlan,
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
  // AGENT 10: COPYWRITING (Caption, Hashtags, Comments)
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 10: COPYWRITING ━━━');
  const copyAgent = new CopywritingAgent();
  const copy = await copyAgent.execute({ strategy });
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 11: FINAL COMPLIANCE QA
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 11: FINAL COMPLIANCE QA ━━━');
  const copyCompliance = await complianceAgent.execute({ strategy, copy });
  if (!copyCompliance.isValid) {
    throw new Error(`Final compliance failed: ${copyCompliance.failures.join(' ')}`);
  }
  console.log(`   Compliance score: ${(copyCompliance.confidenceScore * 100).toFixed(0)}%`);
  console.log('');

  // ═══════════════════════════════════════════════════════
  // SAVE EVERYTHING TO LOCAL FOLDER
  // ═══════════════════════════════════════════════════════
  console.log('━━━ SAVING OUTPUT ━━━');

  // Write the complete post file
  const finalConfidenceScore = qaReport.overallScore;
  const postContent = `═══════════════════════════════════════════════════════
THESTATSANDSTACKS — DAILY POST
Generated: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Vancouver' })}
═══════════════════════════════════════════════════════

📌 TOPIC: ${strategy.topic}
📐 FORMAT: ${strategy.format} (${strategy.slideCount} slides)
🎯 TARGET: ${strategy.targetAudience}
📊 QA SCORE: ${(finalConfidenceScore * 100).toFixed(1)}%

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

${generatedImages.images.map(img => `Slide ${img.slideNumber}: ${img.localPath} (${img.source}${img.attribution ? ` — ${img.attribution}` : ''})`).join('\n')}

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
      confidenceScore: finalConfidenceScore,
    }
  });

  // Save asset references
  for (const img of generatedImages.images) {
    const prompt = await prisma.prompt.create({
      data: {
        briefId: savedBrief.id,
        text: plannedPrompts.find(p => p.slideNumber === img.slideNumber)?.dallePrompt || '',
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
    qaScore: finalConfidenceScore,
    elapsed,
  };
}
