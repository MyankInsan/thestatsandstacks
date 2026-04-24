import { BaseAgent, TrendResearchResult } from './interfaces';
import { getGeminiClient } from '../services/gemini';

export class TrendResearchAgent extends BaseAgent {
  constructor() {
    super('TrendResearchAgent');
  }

  async execute(_input: any): Promise<TrendResearchResult> {
    console.log(`[${this.name}] 🔍 Starting deep trend research...`);

    const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
    const today = new Date().toLocaleDateString('en-CA');

    const prompt = `You are an elite Instagram growth strategist and financial content researcher for "TheStatsAndStacks", a premium Canadian personal finance brand on Instagram.

Today's date is ${today}.

Your job is to find the BEST possible topic for today's post that will maximize:
- Saves (the #1 signal for Instagram reach)
- Shares (the #2 signal)
- New followers
- Search discoverability inside Instagram

RESEARCH APPROACH:
1. Think about what Canadian personal finance topics people are actively searching for RIGHT NOW
2. Consider seasonal timing (tax season, RRSP deadline, new year goals, back to school, etc.)
3. Consider what formats perform best on finance Instagram (comparisons, myth-busters, step-by-step, "I wish I knew", number breakdowns)
4. Consider what would make someone STOP scrolling and tap "Save"
5. Avoid oversaturated topics unless you have a genuinely fresh angle

CONTENT PILLARS TO DRAW FROM:
- TFSA vs RRSP vs FHSA comparisons
- Canadian tax strategies and deductions
- GIC vs HISA vs ETF comparisons
- First-time home buyer programs
- Dividend investing for Canadians
- Credit score optimization

Return your TOP 5 topic ideas ranked by predicted performance.

Output ONLY valid JSON matching this schema (no markdown, no code fences):
{
  "topics": [
    {
      "title": "The exact post title/hook",
      "score": 0.0-1.0,
      "reasoning": "Why this will perform well today",
      "suggestedFormat": "CAROUSEL" or "SINGLE_IMAGE",
      "suggestedSlideCount": number,
      "searchKeywords": ["keyword1", "keyword2"],
      "sourceUrls": []
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    if (!text) throw new Error('No content returned from Gemini');

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as TrendResearchResult;

    console.log(`[${this.name}] ✅ Found ${parsed.topics.length} topic candidates`);
    return parsed;
  }
}
