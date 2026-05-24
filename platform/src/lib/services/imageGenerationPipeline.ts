import { ImagePromptAgent, SlideImagePrompt } from '../agents/imagePromptAgent';
import { VisionQaCriticAgent, VisionQARequest, VisionQAResponse } from '../agents/visionQaCriticAgent';

// Mock Image Generation API Client (e.g., Midjourney API / Ideogram API wrapper)
async function callImageGenerationApi(prompt: string): Promise<string> {
  // Returns a URL to the generated image
  return "https://storage.googleapis.com/thestatsandstacks-assets/generated/mock-image.png";
}

const MAX_ITERATIONS = 3;

export class ImageGenerationPipeline {
  private promptAgent = new ImagePromptAgent();
  private visionCritic = new VisionQaCriticAgent();

  async generateWithCritiqueLoop(
    slidePrompt: SlideImagePrompt,
    brandVibe: string,
    expectedText: string[]
  ): Promise<{ finalImageUrl: string; iterations: number; passed: boolean; finalCritique: string }> {
    
    let currentPrompt = slidePrompt.geminiPrompt;
    let iteration = 0;
    let finalImageUrl = "";
    let passed = false;
    let finalCritique = "";

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      console.log(`[Image Generation Loop] Iteration ${iteration}: Generating image...`);
      
      // 1. ACT: Generate the Image
      const imageUrl = await callImageGenerationApi(currentPrompt);
      finalImageUrl = imageUrl;

      // 2. OBSERVE & CRITIQUE: Vision QA evaluates the image
      const qaRequest: VisionQARequest = {
        imageUrl,
        expectedText,
        brandVibe
      };
      
      console.log(`[Image Generation Loop] Iteration ${iteration}: Critiquing image...`);
      const qaResponse: VisionQAResponse = await this.visionCritic.evaluateImage(qaRequest);
      finalCritique = qaResponse.critique;

      if (qaResponse.passed) {
        console.log(`[Image Generation Loop] Success on iteration ${iteration}. Image passed QA.`);
        passed = true;
        break;
      } else {
        console.warn(`[Image Generation Loop] Failed on iteration ${iteration}. Critique: ${qaResponse.critique}`);
        
        // 3. REFINE (The loop continues): We would typically pass the critique to an LLM to rewrite the prompt.
        // For this implementation, we append the critique as a negative/positive constraint to the prompt.
        currentPrompt = `${slidePrompt.geminiPrompt} --no ${qaResponse.hallucinationsDetected ? 'text hallucination, typos, ' : ''}clutter. FIX THIS SPECIFIC ISSUE: ${qaResponse.critique}`;
      }
    }

    if (!passed) {
      console.error(`[Image Generation Loop] Failed to pass QA after ${MAX_ITERATIONS} iterations. Final critique: ${finalCritique}. Sending to manual review pipeline.`);
    }

    return {
      finalImageUrl,
      iterations: iteration,
      passed,
      finalCritique
    };
  }
}
