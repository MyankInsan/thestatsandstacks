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
      const isStockEducation = input.strategy.format === 'WATCHLIST_EDUCATION' || /stock|watchlist|invest/i.test(input.strategy.topic);
      return {
        caption: `${input.strategy.topic}\n\nThis is educational general information for Canadians, not personalized financial advice. Save this as a starting point, then verify current rules, risks, and your own situation before making financial decisions.`,
        hashtags: isStockEducation
          ? '#CanadianFinance #InvestingCanada #StockMarketEducation #LongTermInvesting #MoneyTips #PersonalFinanceCanada #RiskManagement'
          : '#CanadianFinance #PersonalFinanceCanada #TFSA #RRSP #FHSA #MoneyTips #InvestingCanada',
        cta: 'Save this before your next contribution.',
        firstComment: isStockEducation
          ? 'What is the first thing you check before adding a stock to your watchlist?'
          : 'Which account are you comparing right now: TFSA, RRSP, or FHSA?',
        altText: `TheStatsAndStacks carousel about ${input.strategy.topic}.`,
      };
    }
  }
}
