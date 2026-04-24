import { BaseAgent } from './interfaces';
import { StrategyDecision } from './contentStrategyAgent';
import { getGeminiClient } from '../services/gemini';

export interface CopyBundle {
  caption: string;
  hashtags: string;
  cta: string;
  firstComment: string;
  altText: string;
}

export class CopywritingAgent extends BaseAgent {
  constructor() {
    super('CopywritingAgent');
  }

  async execute(input: { strategy: StrategyDecision }): Promise<CopyBundle> {
    console.log(`[${this.name}] ✍️  Writing copy...`);

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Write Instagram copy for "TheStatsAndStacks".
    
Topic: ${input.strategy.topic}
Slide breakdown:
${input.strategy.slideBreakdown.join('\n')}

Output ONLY valid JSON:
{
  "caption": "string",
  "hashtags": "string",
  "cta": "string",
  "firstComment": "string",
  "altText": "string"
}`;

    const result = await model.generateContent(prompt);
    const text = (await result.response).text().trim();

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as CopyBundle;
  }
}
