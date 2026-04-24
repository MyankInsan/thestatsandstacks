import { BaseAgent } from './interfaces';
import { getGeminiClient } from '../services/gemini';
import fs from 'fs';
import path from 'path';

export interface GeneratedImage {
  slideNumber: number;
  localPath: string;
}

export class ImageGenerationAgent extends BaseAgent {
  constructor() {
    super('ImageGenerationAgent');
  }

  async execute(input: {
    prompts: Array<{ slideNumber: number; slideDescription: string; dallePrompt: string }>,
    outputDir: string
  }): Promise<{ images: GeneratedImage[] }> {
    console.log(`[${this.name}] 🖼️  Generating ${input.prompts.length} images with Google Imagen 3 (FREE)...`);

    fs.mkdirSync(input.outputDir, { recursive: true });

    const ai = getGeminiClient();
    const images: GeneratedImage[] = [];

    for (const prompt of input.prompts) {
      console.log(`   → Generating slide ${prompt.slideNumber}: ${prompt.slideDescription.substring(0, 50)}...`);

      let retries = 0;
      const maxRetries = 2;

      while (retries <= maxRetries) {
        try {
          const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: prompt.dallePrompt,
            config: {
              numberOfImages: 1,
              aspectRatio: '9:16', // Portrait for Instagram
            },
          });

          if (!response.generatedImages || response.generatedImages.length === 0) {
            throw new Error('No images returned from Imagen 3');
          }

          const imageData = response.generatedImages[0];
          const imageBytes = imageData.image?.imageBytes;
          if (!imageBytes) throw new Error('No image bytes returned');

          // Save to local file
          const filename = `slide_${String(prompt.slideNumber).padStart(2, '0')}.png`;
          const localPath = path.join(input.outputDir, filename);

          const buffer = Buffer.from(imageBytes, 'base64');
          fs.writeFileSync(localPath, buffer);

          images.push({
            slideNumber: prompt.slideNumber,
            localPath,
          });

          console.log(`   ✅ Slide ${prompt.slideNumber} saved: ${filename}`);
          break;

        } catch (error: any) {
          retries++;
          console.error(`   ❌ Slide ${prompt.slideNumber} failed (attempt ${retries}): ${error.message}`);
          if (retries > maxRetries) {
            throw new Error(`Failed to generate slide ${prompt.slideNumber} after ${maxRetries + 1} attempts: ${error.message}`);
          }
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    console.log(`[${this.name}] ✅ All ${images.length} images generated and saved to ${input.outputDir}`);
    return { images };
  }
}
