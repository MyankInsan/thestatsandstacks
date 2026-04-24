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

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `You are a senior Instagram content strategist for "TheStatsAndStacks", a premium Canadian finance brand.

Given these trending topics, pick the SINGLE BEST one and decide the exact execution plan.

FORMAT DECISION RULES:
- Use CAROUSEL (multiple slides) when the topic involves:
  - Comparisons (TFSA vs RRSP)
  - Step-by-step breakdowns
  - Myth-busting (3+ myths)
  - Lists or frameworks
  - Before/after scenarios
  - Data-driven education
  Carousel slides should be 5-8 slides for optimal engagement.

- Use SINGLE_IMAGE only when:
  - It's one powerful statistic or chart
  - A single memorable visual concept
  - A quote-style post

SLIDE BREAKDOWN:
For carousels, plan each slide:
- Slide 1: HOOK slide — must stop the scroll. Bold statement, question, or shocking number.
- Slides 2-6: VALUE slides — one clear point per slide, easy to read on mobile.
- Final slide: CTA slide — "Follow @TheStatsAndStacks for more" or "Save this for later".

Be very specific about what goes on each slide.

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
}`,
    });

    const text = response.text?.trim();
    if (!text) throw new Error('No content from Gemini');

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned) as StrategyDecision;

    console.log(`[${this.name}] ✅ Decided: ${result.format} with ${result.slideCount} slides`);
    console.log(`   → Topic: ${result.topic}`);
    console.log(`   → Hook: ${result.hook}`);
    return result;
  }
}
