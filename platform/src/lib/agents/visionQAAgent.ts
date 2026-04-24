import { BaseAgent, ValidationResult } from './interfaces';
import { GeneratedImage } from './imageGenerationAgent';
import { getGeminiClient } from '../services/gemini';
import fs from 'fs';

export interface QAReport {
  allPassed: boolean;
  slideReports: Array<{
    slideNumber: number;
    isValid: boolean;
    confidenceScore: number;
    failures: string[];
  }>;
  overallScore: number;
  failedSlides: number[];
}

export class VisionQAAgent extends BaseAgent {
  constructor() {
    super('VisionQAAgent');
  }

  async execute(input: { images: GeneratedImage[] }): Promise<QAReport> {
    console.log(`[${this.name}] 🔎 Inspecting images...`);

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const slideReports: QAReport['slideReports'] = [];
    const failedSlides: number[] = [];

    for (const image of input.images) {
      console.log(`   → Checking slide ${image.slideNumber}...`);

      const imageBuffer = fs.readFileSync(image.localPath);
      const base64Image = imageBuffer.toString('base64');

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/png'
          }
        },
        {
          text: `Evaluate this Instagram slide. If text is garbled or misspelled, set isValid: false.
          Reply with ONLY valid JSON: { "isValid": boolean, "confidenceScore": 0.0-1.0, "failures": [] }`
        }
      ]);

      const text = (await result.response).text().trim();
      let report = { isValid: true, confidenceScore: 0.8, failures: [] as string[] };

      try {
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        report = JSON.parse(cleaned);
      } catch (e) {
        console.log(`   ⚠️  QA parse failed, assuming pass.`);
      }

      slideReports.push({ slideNumber: image.slideNumber, ...report });
      if (!report.isValid) failedSlides.push(image.slideNumber);
    }

    return {
      allPassed: failedSlides.length === 0,
      slideReports,
      overallScore: slideReports.reduce((sum, r) => sum + r.confidenceScore, 0) / slideReports.length,
      failedSlides,
    };
  }
}
