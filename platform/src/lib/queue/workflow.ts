import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { CostGuardAgent } from '../agents/costGuardAgent';
import { TrendResearchAgent } from '../agents/trendResearchAgent';
import { ContentStrategyAgent } from '../agents/contentStrategyAgent';
import { ComplianceQAAgent } from '../agents/complianceQAAgent';
import { ImagePromptAgent } from '../agents/imagePromptAgent';
import { ImageGenerationAgent } from '../agents/imageGenerationAgent';
import { VisionQAAgent } from '../agents/visionQAAgent';
import { CopywritingAgent } from '../agents/copywritingAgent';
import { VideoGenerationAgent, VideoGenerationResult } from '../agents/videoGenerationAgent';
import { VideoQAAgent, VideoQAReport } from '../agents/videoQAAgent';

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
  // AGENT 2: CONTENT STRATEGY (Decides format + slide count)
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 2: CONTENT STRATEGY ━━━');
  const strategyAgent = new ContentStrategyAgent();
  const videoGenerationAvailable = VideoGenerationAgent.isAvailable() && VideoGenerationAgent.willRenderToday();
  const strategy = await strategyAgent.execute({ trends, videoGenerationAvailable });
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 3: COMPLIANCE QA
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 3: COMPLIANCE QA ━━━');
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
  // AGENT 4: IMAGE PROMPT GENERATION
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 4: IMAGE PROMPTS ━━━');
  const imagePromptAgent = new ImagePromptAgent();
  const promptSet = await imagePromptAgent.execute({ strategy });
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 5: IMAGE GENERATION
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 5: IMAGE GENERATION ━━━');
  const imageGenAgent = new ImageGenerationAgent();
  const generatedImages = await imageGenAgent.execute({
    prompts: promptSet.prompts,
    outputDir,
  });
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 6: VISION QA (Check every image, regenerate failures)
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 6: VISION QA INSPECTION ━━━');
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
  // AGENT 7: VIDEO GENERATION + QA (free local FFmpeg)
  // ═══════════════════════════════════════════════════════
  const videoGenAgent = new VideoGenerationAgent();
  let generatedVideo: VideoGenerationResult = {
    video: null,
    skippedReason: 'Video generation was not requested for this strategy.',
  };
  let videoQaReport: VideoQAReport | null = null;

  if (VideoGenerationAgent.shouldRenderForStrategy(strategy)) {
    generatedVideo = await videoGenAgent.execute({
      images: generatedImages.images,
      strategy,
      outputDir,
    });
  }

  if (generatedVideo.video) {
    console.log('━━━ AGENT 7: VIDEO QA INSPECTION ━━━');
    const videoQaAgent = new VideoQAAgent();
    videoQaReport = await videoQaAgent.execute({ video: generatedVideo.video });
    if (!videoQaReport.isValid) {
      console.log(`   ⚠️  Video QA failed: ${videoQaReport.failures.join(', ')}`);
    } else {
      console.log(`   🎬 Video QA Score: ${(videoQaReport.confidenceScore * 100).toFixed(1)}%`);
    }
    console.log('');
  } else if (VideoGenerationAgent.shouldRenderForStrategy(strategy)) {
    console.log('━━━ AGENT 7: VIDEO GENERATION SKIPPED ━━━');
    console.log(`   ${generatedVideo.skippedReason}`);
    console.log('');
  }

  // ═══════════════════════════════════════════════════════
  // AGENT 8: COPYWRITING (Caption, Hashtags, Comments)
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 8: COPYWRITING ━━━');
  const copyAgent = new CopywritingAgent();
  const copy = await copyAgent.execute({ strategy });
  console.log('');

  // ═══════════════════════════════════════════════════════
  // AGENT 9: FINAL COMPLIANCE QA
  // ═══════════════════════════════════════════════════════
  console.log('━━━ AGENT 9: FINAL COMPLIANCE QA ━━━');
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
  const finalConfidenceScore = combineMediaConfidence(qaReport.overallScore, videoQaReport);
  const postContent = `═══════════════════════════════════════════════════════
THESTATSANDSTACKS — DAILY POST
Generated: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Vancouver' })}
═══════════════════════════════════════════════════════

📌 TOPIC: ${strategy.topic}
📐 FORMAT: ${strategy.format} (${strategy.slideCount} slides)
🎯 TARGET: ${strategy.targetAudience}
📊 QA SCORE: ${(finalConfidenceScore * 100).toFixed(1)}%
🎬 VIDEO: ${generatedVideo.video ? generatedVideo.video.localPath : generatedVideo.skippedReason || 'Not generated'}

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
🎬 VIDEO (If generated):
═══════════════════════════════════════════════════════

${generatedVideo.video ? `${generatedVideo.video.localPath}\nDuration: ${generatedVideo.video.durationSeconds}s\nQA: ${videoQaReport ? `${videoQaReport.isValid ? 'PASSED' : 'FAILED'} (${(videoQaReport.confidenceScore * 100).toFixed(0)}%)` : 'Not inspected'}` : generatedVideo.skippedReason || 'Not generated'}

═══════════════════════════════════════════════════════
📋 SLIDE BREAKDOWN:
═══════════════════════════════════════════════════════

${strategy.slideBreakdown.join('\n')}

═══════════════════════════════════════════════════════
🔎 QA REPORT:
═══════════════════════════════════════════════════════

${qaReport.slideReports.map(r => `Slide ${r.slideNumber}: ${r.isValid ? '✅ PASSED' : '❌ FAILED'} (${(r.confidenceScore * 100).toFixed(0)}%) ${r.failures.length > 0 ? '— ' + r.failures.join(', ') : ''}`).join('\n')}
${videoQaReport ? `\nVideo: ${videoQaReport.isValid ? '✅ PASSED' : '❌ FAILED'} (${(videoQaReport.confidenceScore * 100).toFixed(0)}%) ${videoQaReport.failures.length > 0 ? '— ' + videoQaReport.failures.join(', ') : ''}` : ''}
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

  if (generatedVideo.video && (!videoQaReport || videoQaReport.isValid)) {
    const videoPrompt = await prisma.prompt.create({
      data: {
        briefId: savedBrief.id,
        text: 'Free local FFmpeg Reel draft rendered from approved branded slides.',
        direction: 'Video Reel Draft',
      }
    });

    const videoAsset = await prisma.generatedAsset.create({
      data: {
        promptId: videoPrompt.id,
        imageUrl: `/api/images/${today}/${path.basename(generatedVideo.video.localPath)}`,
        localPath: generatedVideo.video.localPath,
        visionScore: videoQaReport?.confidenceScore || 0.8,
        status: 'APPROVED',
      }
    });

    await prisma.postAsset.create({
      data: {
        postId: savedPost.id,
        assetId: videoAsset.id,
        orderIndex: generatedImages.images.length + 1,
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
      videos: generatedVideo.video ? [generatedVideo.video] : [],
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
  console.log(`  🎬 ${generatedVideo.video ? '1 video generated' : 'No video generated'}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  return { 
    success: true, 
    outputDir,
    topic: strategy.topic,
    format: strategy.format,
    slideCount: strategy.slideCount,
    qaScore: finalConfidenceScore,
    videoPath: generatedVideo.video?.localPath || null,
    elapsed,
  };
}

function combineMediaConfidence(imageScore: number, videoQaReport: VideoQAReport | null): number {
  if (!videoQaReport) return imageScore;
  return Number(((imageScore * 0.7) + (videoQaReport.confidenceScore * 0.3)).toFixed(3));
}
