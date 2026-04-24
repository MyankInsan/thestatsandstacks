import { BaseAgent, TrendResearchResult } from './interfaces';
import { getGeminiClient } from '../services/gemini';

export interface StrategyDecision {
  topic: string;
  hook: string;
  format: 'CAROUSEL' | 'SINGLE_IMAGE';
  slideCount: number;
  slideBreakdown: string[];
  reasoning: string;
  targetAudience: string;
  searchKeywords: string[];
}

export class ContentStrategyAgent extends BaseAgent {
  constructor() {
    super('ContentStrategyAgent');
  }

  async execute(input: { trends: TrendResearchResult }): Promise<StrategyDecision> {
    console.log(`[${this.name}] 🧠 Deciding content strategy...`);

    const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const prompt = `You are a senior Instagram content strategist for "TheStatsAndStacks", a premium Canadian finance brand.

Given these trending topics, pick the SINGLE BEST one and decide the exact execution plan.

FORMAT DECISION RULES:
- Use CAROUSEL (multiple slides) for educational breakdowns or comparisons.
- CAROUSEL slides should be 5-8 slides.

Here are the top topics: ${JSON.stringify(input.trends.topics)}

Pick the best one. Output ONLY valid JSON (no markdown, no code fences):
{
  "topic": "exact topic title",
  "hook": "the hook text for slide 1",
  "format": "CAROUSEL" or "SINGLE_IMAGE",
  "slideCount": number,
  "slideBreakdown": ["Slide 1: ...", "Slide 2: ...", ...],
  "reasoning": "why this format and topic",
  "targetAudience": "who this is for",
  "searchKeywords": ["keyword1", "keyword2"]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as StrategyDecision;
  }
}
