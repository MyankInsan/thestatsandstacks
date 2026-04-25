import { BaseAgent, ContentStrategyResult, EditorialBriefResult } from './interfaces';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy_key',
});

export class EditorialPlanningAgent extends BaseAgent {
  constructor() {
    super('EditorialPlanningAgent');
  }

  async execute(input: { strategy: ContentStrategyResult }): Promise<EditorialBriefResult> {
    console.log(`[${this.name}] Generating editorial brief...`);
    
    if (openai.apiKey === 'dummy_key' || !openai.apiKey) {
      return {
        hookVariants: ["Hook 1", "Hook 2", "Hook 3"],
        angle: "Educational Breakdown",
        outline: ["Slide 1: Intro", "Slide 2: Facts", "Slide 3: Conclusion"],
        factualClaimsToVerify: ["TFSA limit for 2024 is $7000"]
      };
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are the Editorial Director for "TheStatsAndStacks".
Create a detailed outline for a financial Instagram post based on the strategy.
Generate 3 hook variants. Determine the narrative angle.
If format is CAROUSEL, provide a slide-by-slide outline.
Extract specific factual claims that MUST be verified by compliance (e.g. "TFSA limit for 2024 is $7000").`
        },
        {
          role: 'user',
          content: `Strategy: ${JSON.stringify(input.strategy)}\n\nOutput JSON schema: { "hookVariants": string[], "angle": string, "outline": string[], "factualClaimsToVerify": string[] }`
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content from OpenAI');

    return JSON.parse(content) as EditorialBriefResult;
  }
}
