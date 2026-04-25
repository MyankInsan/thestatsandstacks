import { BaseAgent, TrendResearchResult } from './interfaces';
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';

export interface StrategyDecision {
  topic: string;
  hook: string;
  format: 'CAROUSEL' | 'SINGLE_IMAGE' | 'WATCHLIST_EDUCATION';
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

    const prompt = `You are a senior Instagram content strategist for "TheStatsAndStacks", a premium Canadian finance brand.

Given these trending topics, pick the SINGLE BEST one and decide the exact execution plan.

FORMAT DECISION RULES:
- Use CAROUSEL (multiple slides) for educational breakdowns or comparisons.
- CAROUSEL slides should be 5-8 slides.
- Use WATCHLIST_EDUCATION for stock-market content. Never recommend buy/sell/hold or price targets.
- SINGLE_IMAGE is allowed only for one-number stats or simple reminders.

Here are the top topics: ${JSON.stringify(input.trends.topics)}

Pick the best one. Output ONLY valid JSON (no markdown, no code fences):
{
  "topic": "exact topic title",
  "hook": "the hook text for slide 1",
  "format": "CAROUSEL" or "SINGLE_IMAGE" or "WATCHLIST_EDUCATION",
  "slideCount": number,
  "slideBreakdown": ["Slide 1: exact on-image headline | short supporting point | short supporting point", "Slide 2: exact on-image headline | short supporting point | short supporting point", ...],
  "reasoning": "why this format and topic",
  "targetAudience": "who this is for",
  "searchKeywords": ["keyword1", "keyword2"]
}`;

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned) as StrategyDecision;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${this.name}] Gemini strategy failed; using cost-safe fallback strategy. ${message}`);
      return getRotatingFallbackStrategy(input.trends);
    }
  }
}

const fallbackStrategies: StrategyDecision[] = [
  {
    topic: 'Stock Watchlist Rule: 5 Checks Before You Buy Any Stock',
    hook: 'A stock is not a plan.',
    format: 'WATCHLIST_EDUCATION',
    slideCount: 8,
    slideBreakdown: [
      'Slide 1: A stock is not a plan | Before you buy, know why it belongs | Hype is not a thesis',
      'Slide 2: Check 1: Revenue quality | Is growth durable? | One good quarter is not a full story',
      'Slide 3: Check 2: Profit and cash flow | Sales are not enough | Watch whether the business can fund itself',
      'Slide 4: Check 3: Balance sheet risk | Debt can amplify problems | Rates and refinancing matter',
      'Slide 5: Check 4: Valuation | A great company can be a bad price | Compare expectations to reality',
      'Slide 6: Check 5: Portfolio fit | Single stocks add concentration | Size the risk before the excitement',
      'Slide 7: Red flags | Guaranteed-return language | Viral hype with no sources | Missing risk discussion',
      'Slide 8: Save this watchlist rule | Research first | Position size second | This is education, not a recommendation',
    ],
    reasoning: 'Stock education can reach a broader audience while staying compliant and non-promotional.',
    targetAudience: 'Canadians curious about stocks but vulnerable to hype',
    searchKeywords: ['stock watchlist', 'how to evaluate stocks', 'investing risk'],
  },
  {
    topic: 'Before Chasing a Hot Stock, Check These 4 Risks',
    hook: 'Hot stocks can cool off fast.',
    format: 'WATCHLIST_EDUCATION',
    slideCount: 7,
    slideBreakdown: [
      'Slide 1: Hot stocks can cool off fast | Before chasing momentum, check the risk | Popular is not the same as safe',
      'Slide 2: Risk 1: Story risk | Is the thesis based on facts? | Or just social-media excitement?',
      'Slide 3: Risk 2: Valuation risk | Good news may already be priced in | Expectations can become too high',
      'Slide 4: Risk 3: Concentration risk | One stock can dominate your portfolio | Big upside can come with big drawdowns',
      'Slide 5: Risk 4: Liquidity risk | Thinly traded names can move violently | Exits may be harder than entries',
      'Slide 6: Better question | What would prove your thesis wrong? | Decide before emotions take over',
      'Slide 7: Save before buying hype | No stock is guaranteed | This is education, not investment advice',
    ],
    reasoning: 'Risk-first stock content is engaging but avoids personalized recommendations.',
    targetAudience: 'New investors attracted to trending stocks',
    searchKeywords: ['hot stocks', 'stock risk checklist', 'investing mistakes'],
  },
  {
    topic: 'TFSA vs RRSP vs FHSA: Which Account Should Canadians Use First?',
    hook: 'Most Canadians pick the wrong account first.',
    format: 'CAROUSEL',
    slideCount: 7,
    slideBreakdown: [
      'Slide 1: Most Canadians pick the wrong account first | The order matters more than people think | Start with the account that matches your next real goal',
      'Slide 2: The quick decision tree | Buying a first home? Check FHSA first | Need flexibility? TFSA usually wins | High income today? Compare RRSP benefits',
      'Slide 3: When TFSA usually wins | You may need the money before retirement | Your income could rise later | You want tax-free growth and flexible withdrawals',
      'Slide 4: When RRSP usually wins | You are in a higher tax bracket today | You can reinvest the refund | You expect lower taxable income later',
      'Slide 5: Where FHSA fits | Built for eligible first-time home buyers | Contributions can reduce taxable income | Qualifying withdrawals can be tax-free',
      'Slide 6: Common mistakes to avoid | Choosing only for the tax refund | Ignoring timelines | Forgetting contribution room limits change',
      'Slide 7: Save this before your next contribution | Match the account to the goal | Verify current limits before contributing | Educational only, not financial advice',
    ],
    reasoning: 'Account comparisons are useful, searchable, and save-friendly.',
    targetAudience: 'Canadian earners deciding where to invest next',
    searchKeywords: ['TFSA vs RRSP', 'FHSA Canada', 'Canadian investing'],
  },
  {
    topic: '5 Money Leaks Quietly Keeping Canadians Broke',
    hook: 'These small leaks do the most damage.',
    format: 'CAROUSEL',
    slideCount: 7,
    slideBreakdown: [
      'Slide 1: These small leaks do the most damage | The problem is not always income | It is often money leaving without a job',
      'Slide 2: Leak 1: Subscription drift | One forgotten charge is small | Five forgotten charges become a habit tax',
      'Slide 3: Leak 2: Cash sitting with no plan | Emergency cash is good | Random idle cash can quietly lose buying power',
      'Slide 4: Leak 3: Minimum-payment thinking | It keeps the account open | It also keeps interest working against you',
      'Slide 5: Leak 4: Lifestyle creep | Raises feel bigger before they are spent | Automate the gap before it disappears',
      'Slide 6: Leak 5: No payday rule | Money needs a sequence | Save, bills, invest, then spend',
      'Slide 7: Save this leak audit | Review one category today | Fixing leaks is faster than chasing hacks | Educational only',
    ],
    reasoning: 'Mistake teardown formats are emotionally resonant and saveable.',
    targetAudience: 'Canadians who earn okay money but feel stuck',
    searchKeywords: ['budgeting Canada', 'money leaks', 'personal finance Canada'],
  },
  {
    topic: 'The Canadian Payday Order of Operations',
    hook: 'Do this before your money disappears.',
    format: 'CAROUSEL',
    slideCount: 8,
    slideBreakdown: [
      'Slide 1: Do this before your money disappears | Payday needs a system | Not another motivation quote',
      'Slide 2: Step 1: Protect fixed bills | Rent, insurance, utilities, minimum payments | Remove the stress first',
      'Slide 3: Step 2: Set emergency cash aside | Small buffer first | Bigger reserve after high-interest debt is controlled',
      'Slide 4: Step 3: Attack expensive debt | High interest changes the math | Paying it down can be a guaranteed improvement',
      'Slide 5: Step 4: Fund goal accounts | Match the account to the timeline | TFSA, RRSP, FHSA each have a job',
      'Slide 6: Step 5: Spend what is left | Guilt-free spending works best after priorities | Not before',
      'Slide 7: The simple rule | Automate the important parts | Make discipline less necessary',
      'Slide 8: Save this payday checklist | Use it every payday | Adjust numbers to your situation | Educational only',
    ],
    reasoning: 'Checklist content gets saves because it becomes a repeatable tool.',
    targetAudience: 'Canadian workers building a monthly money routine',
    searchKeywords: ['payday routine', 'budget checklist', 'Canadian personal finance'],
  },
  {
    topic: 'Credit Score Myths Canadians Still Believe',
    hook: 'Some credit advice is just noise.',
    format: 'CAROUSEL',
    slideCount: 7,
    slideBreakdown: [
      'Slide 1: Some credit advice is just noise | Credit scores matter | But not every myth deserves your attention',
      'Slide 2: Myth 1: Carrying a balance helps | Paying interest is not a strategy | On-time payment history matters more',
      'Slide 3: Myth 2: Closing old cards always helps | Older accounts can support history | Consider the tradeoff first',
      'Slide 4: Myth 3: Checking your own score hurts | Soft checks are different | Monitoring can help catch issues early',
      'Slide 5: Myth 4: Income directly sets your score | Income matters to lenders | It is not the score itself',
      'Slide 6: What actually helps | Pay on time | Keep utilization controlled | Avoid messy applications',
      'Slide 7: Save before applying for credit | Clean inputs first | Then compare products carefully | Educational only',
    ],
    reasoning: 'Myth/fact posts are shareable because viewers tag friends and correct misconceptions.',
    targetAudience: 'Canadians trying to improve or protect credit',
    searchKeywords: ['credit score Canada', 'credit myths', 'Canadian credit cards'],
  },
  {
    topic: 'HISA vs GIC vs ETF: Where Should Short-Term Money Go?',
    hook: 'Do not invest money you need soon.',
    format: 'CAROUSEL',
    slideCount: 8,
    slideBreakdown: [
      'Slide 1: Do not invest money you need soon | Timeline decides the tool | Not excitement, not headlines',
      'Slide 2: HISA: flexible cash | Better for emergency funds | Easy access matters when life interrupts',
      'Slide 3: GIC: locked-in certainty | Useful when timing is known | Check terms before chasing the rate',
      'Slide 4: ETF: growth potential with risk | Better for longer timelines | Short-term drops can happen at the wrong time',
      'Slide 5: Under 12 months | Flexibility usually matters most | Cash-like tools can make sense',
      'Slide 6: One to five years | Certainty starts to matter | Match maturity to the goal',
      'Slide 7: Five years plus | Growth assets may fit better | Risk tolerance still matters',
      'Slide 8: Save this timeline rule | Goal first | Product second | Educational only, not advice',
    ],
    reasoning: 'Timeline frameworks are practical and easy to save for future decisions.',
    targetAudience: 'Canadians deciding where to park savings',
    searchKeywords: ['HISA vs GIC', 'ETF Canada', 'short term savings Canada'],
  },
];

function getRotatingFallbackStrategy(trends: TrendResearchResult): StrategyDecision {
  const dayIndex = Math.floor(Date.now() / 86_400_000) % fallbackStrategies.length;
  const topTopic = trends.topics[0];
  const matchedStrategy = topTopic
    ? fallbackStrategies.find((strategy) => strategy.topic === topTopic.title)
    : undefined;
  const strategy = matchedStrategy || fallbackStrategies[dayIndex];

  if (!topTopic) return strategy;
  return {
    ...strategy,
    searchKeywords: topTopic.searchKeywords?.length ? topTopic.searchKeywords : strategy.searchKeywords,
  };
}
