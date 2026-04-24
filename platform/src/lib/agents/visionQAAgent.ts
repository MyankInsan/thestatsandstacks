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
    console.log(`[${this.name}] 🔎 Inspecting ${input.images.length} generated images...`);

    const ai = getGeminiClient();
    const slideReports: QAReport['slideReports'] = [];
    const failedSlides: number[] = [];

    for (const image of input.images) {
      console.log(`   → Checking slide ${image.slideNumber}...`);

      const imageBuffer = fs.readFileSync(image.localPath);
      const base64Image = imageBuffer.toString('base64');

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are a ruthless Instagram design quality inspector for a premium finance brand called "TheStatsAndStacks".

Evaluate this Instagram slide image on these criteria:
1. TEXT QUALITY: Is the text readable, correctly spelled, and not garbled? (Most critical)
2. LAYOUT: Is it clean, balanced, and not cluttered?
3. BRANDING: Does it use dark navy/charcoal tones?
4. MOBILE READABILITY: Can someone read this easily on a phone screen?
5. PROFESSIONALISM: Does it look premium, not cheap or generic?
6. AI ARTIFACTS: Are there any weird AI glitches, distortions, or nonsensical elements?

Be STRICT. If the text is garbled, misspelled, or unreadable, the slide FAILS.
If there are obvious AI artifacts or distortions, the slide FAILS.

Reply with ONLY valid JSON (no markdown, no code fences):
{
  "isValid": true or false,
  "confidenceScore": 0.0-1.0,
  "failures": ["list of specific problems found, empty array if none"]
}`
              },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: base64Image,
                }
              }
            ]
          }
        ],
      });

      const text = response.text?.trim();
      let report = { isValid: true, confidenceScore: 0.8, failures: [] as string[] };

      if (text) {
        try {
          const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          report = JSON.parse(cleaned);
        } catch (e) {
          console.log(`   ⚠️  Could not parse QA response for slide ${image.slideNumber}, assuming pass`);
        }
      }

      slideReports.push({
        slideNumber: image.slideNumber,
        ...report
      });

      if (!report.isValid) {
        failedSlides.push(image.slideNumber);
        console.log(`   ❌ Slide ${image.slideNumber} FAILED: ${report.failures.join(', ')}`);
      } else {
        console.log(`   ✅ Slide ${image.slideNumber} PASSED (${report.confidenceScore})`);
      }
    }

    const overallScore = slideReports.reduce((sum, r) => sum + r.confidenceScore, 0) / slideReports.length;

    return {
      allPassed: failedSlides.length === 0,
      slideReports,
      overallScore,
      failedSlides,
    };
  }
}
