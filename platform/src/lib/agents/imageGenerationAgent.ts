import { BaseAgent } from './interfaces';
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
    console.log(`[${this.name}] 🖼️  Generating ${input.prompts.length} images with Imagen 4 (REST)...`);

    fs.mkdirSync(input.outputDir, { recursive: true });
    const images: GeneratedImage[] = [];
    const apiKey = process.env.GEMINI_API_KEY;

    for (const prompt of input.prompts) {
      console.log(`   → Generating slide ${prompt.slideNumber}...`);

      let retries = 0;
      while (retries < 2) {
        try {
          // Using REST API for Imagen 4
          const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;
          
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instances: [
                { prompt: prompt.dallePrompt }
              ],
              parameters: {
                sampleCount: 1,
                aspectRatio: "1:1" // Or whatever is supported
              }
            })
          });

          const data = await response.json() as any;
          
          if (data.predictions && data.predictions[0] && data.predictions[0].bytesBase64Encoded) {
            const buffer = Buffer.from(data.predictions[0].bytesBase64Encoded, 'base64');
            const filename = `slide_${String(prompt.slideNumber).padStart(2, '0')}.png`;
            const localPath = path.join(input.outputDir, filename);
            fs.writeFileSync(localPath, buffer);
            
            images.push({ slideNumber: prompt.slideNumber, localPath });
            console.log(`   ✅ Slide ${prompt.slideNumber} saved.`);
            break;
          } else {
            throw new Error(JSON.stringify(data));
          }
        } catch (error: any) {
          retries++;
          console.error(`   ❌ Attempt ${retries} failed: ${error.message}`);
          if (retries === 2) throw error;
        }
      }
    }

    return { images };
  }
}
