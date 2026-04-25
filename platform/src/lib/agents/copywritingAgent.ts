import { BaseAgent } from './interfaces';
import { StrategyDecision } from './contentStrategyAgent';
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';

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

    const prompt = `Write Instagram copy for "TheStatsAndStacks".
    
Topic: ${input.strategy.topic}
Slide breakdown:
${input.strategy.slideBreakdown.join('\n')}

Rules:
- If the topic mentions stocks, do not recommend buy/sell/hold.
- Do not use price targets, guaranteed returns, or personalized investment advice.
- Use "educational only, not financial advice" language.
- Write for saves and shares: clear first line, useful framework, no cheap engagement bait.
- Use 6-10 focused hashtags, not a spam wall.
- Naturally include search terms from: ${input.strategy.searchKeywords.join(', ')}
- Vary the CTA. Prefer save/share/profile-follow prompts only when they fit the post.

Output ONLY valid JSON:
{
  "caption": "string",
  "hashtags": "string",
  "cta": "string",
  "firstComment": "string",
  "altText": "string"
}`;

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
      const result = await model.generateContent(prompt);
      const text = (await result.response).text().trim();

      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned) as CopyBundle;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${this.name}] Gemini copywriting failed; using fallback copy. ${message}`);
      const isStockEducation = input.strategy.format === 'WATCHLIST_EDUCATION'
        || /stock|watchlist|invest|earnings|market|etf/i.test(input.strategy.topic);
      return {
        caption: `${input.strategy.topic}\n\nUse this as a research framework, not a shortcut.\n\nThe goal is not to chase a headline. The goal is to ask better questions before money is at risk.\n\nEducational general information only, not personalized financial advice.`,
        hashtags: isStockEducation
          ? '#CanadianFinance #InvestingCanada #StockMarketEducation #LongTermInvesting #PersonalFinanceCanada #RiskManagement #MoneyTips'
          : '#CanadianFinance #PersonalFinanceCanada #MoneyTips #InvestingCanada #FinancialLiteracy #CanadianInvesting',
        cta: isStockEducation ? 'Save this before researching your next ticker.' : 'Save this before your next money decision.',
        firstComment: isStockEducation
          ? 'What do you check first: business quality, valuation, or risk?'
          : 'Which account are you comparing right now: TFSA, RRSP, or FHSA?',
        altText: `TheStatsAndStacks carousel about ${input.strategy.topic}.`,
      };
    }
  }
}
