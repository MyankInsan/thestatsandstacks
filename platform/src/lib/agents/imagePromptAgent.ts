import { BaseAgent } from './interfaces';
import { StrategyDecision } from './contentStrategyAgent';
import { getGeminiClient } from '../services/gemini';

export interface ImagePromptSet {
  prompts: Array<{
    slideNumber: number;
    slideDescription: string;
    dallePrompt: string;
  }>;
}

export class ImagePromptAgent extends BaseAgent {
  constructor() {
    super('ImagePromptAgent');
  }

  async execute(input: { strategy: StrategyDecision }): Promise<ImagePromptSet> {
    console.log(`[${this.name}] 🎨 Generating image prompts for ${input.strategy.slideCount} slides...`);

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: `You are a premium Instagram visual designer for "TheStatsAndStacks", a Canadian personal finance brand.

Your job is to convert a slide-by-slide content plan into image generation prompts.

BRAND VISUAL IDENTITY:
- Dark navy / charcoal / near-black backgrounds (#0F172A, #1E293B)
- Subtle emerald green accents (#10B981)
- Muted gold accents (#D4A843)
- Clean, modern sans-serif typography feel
- High contrast for mobile readability
- Minimalist, premium, editorial aesthetic
- NO clutter. NO stock photo vibes. NO cheesy clip art.
- Think: Bloomberg meets Apple design

CRITICAL PROMPT RULES:
1. Every prompt MUST include the exact text that should appear on the slide in quotes
2. Specify "dark navy background" in every prompt for consistency
3. Specify "Instagram portrait format 1080x1350"
4. Include "clean modern infographic style, minimal, premium finance aesthetic"
5. Keep text SHORT on each slide (max 15-20 words of visible text)
6. Slide 1 (hook) should be visually striking and bold
7. The final slide should include "@TheStatsAndStacks" as the handle
8. DO NOT ask for photographs of people
9. Use geometric shapes, icons, charts, and data visualization elements
10. Each slide must feel like part of the same visual series

Topic: ${input.strategy.topic}
Hook: ${input.strategy.hook}
Format: ${input.strategy.format}
Slide Count: ${input.strategy.slideCount}
Slide Breakdown:
${input.strategy.slideBreakdown.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Generate an image prompt for EACH slide. Output ONLY valid JSON (no markdown, no code fences):
{
  "prompts": [
    {
      "slideNumber": 1,
      "slideDescription": "what this slide is about",
      "dallePrompt": "the full image generation prompt"
    }
  ]
}`,
    });

    const text = response.text?.trim();
    if (!text) throw new Error('No content from Gemini');

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned) as ImagePromptSet;

    console.log(`[${this.name}] ✅ Generated ${result.prompts.length} image prompts`);
    return result;
  }
}
