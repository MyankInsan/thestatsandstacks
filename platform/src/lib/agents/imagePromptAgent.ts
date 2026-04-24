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
    console.log(`[${this.name}] 🎨 Generating image prompts...`);

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a premium Instagram visual designer for "TheStatsAndStacks".
    
Convert this plan into image generation prompts.
Brand colors: Dark navy, charcoal, emerald green, gold.

Topic: ${input.strategy.topic}
Slide Count: ${input.strategy.slideCount}
Slide Breakdown:
${input.strategy.slideBreakdown.join('\n')}

Output ONLY valid JSON (no markdown):
{
  "prompts": [
    {
      "slideNumber": number,
      "slideDescription": "string",
      "dallePrompt": "string"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as ImagePromptSet;
  }
}
