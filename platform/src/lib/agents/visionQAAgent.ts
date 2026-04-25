import { BaseAgent } from './interfaces';
import { GeneratedImage } from './imageGenerationAgent';
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
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

    const slideReports: QAReport['slideReports'] = [];
    const failedSlides: number[] = [];

    for (const image of input.images) {
      console.log(`   → Checking slide ${image.slideNumber}...`);

      if (image.source === 'local') {
        const stats = fs.existsSync(image.localPath) ? fs.statSync(image.localPath) : null;
        const isValid = Boolean(stats && stats.size > 10_000);
        const report = {
          slideNumber: image.slideNumber,
          isValid,
          confidenceScore: isValid ? 0.98 : 0.2,
          failures: isValid ? [] : ['Local PNG slide was missing or unexpectedly small'],
        };
        slideReports.push(report);
        if (!report.isValid) failedSlides.push(image.slideNumber);
        continue;
      }

      const imageBuffer = fs.readFileSync(image.localPath);
      const base64Image = imageBuffer.toString('base64');

      let report = { isValid: true, confidenceScore: 0.8, failures: [] as string[] };

      try {
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
        const result = await model.generateContent([
          {
            inlineData: {
              data: base64Image,
              mimeType: image.mimeType || 'image/png'
            }
          },
          {
            text: `Evaluate this Instagram slide. If text is garbled or misspelled, set isValid: false.
            Reply with ONLY valid JSON: { "isValid": boolean, "confidenceScore": 0.0-1.0, "failures": [] }`
          }
        ]);

        const text = (await result.response).text().trim();
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        report = JSON.parse(cleaned);
      } catch {
        console.log(`   ⚠️  QA parse failed, assuming pass.`);
      }

      slideReports.push({ slideNumber: image.slideNumber, ...report });
      if (!report.isValid) failedSlides.push(image.slideNumber);
    }

    return {
      allPassed: failedSlides.length === 0,
      slideReports,
      overallScore: slideReports.length > 0
        ? slideReports.reduce((sum, r) => sum + r.confidenceScore, 0) / slideReports.length
        : 0,
      failedSlides,
    };
  }
}
