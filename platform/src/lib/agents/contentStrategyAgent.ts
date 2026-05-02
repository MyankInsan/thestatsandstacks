import { BaseAgent, TrendResearchResult } from './interfaces';
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import {
  ContentHistoryEntry,
  isTooSimilarToRecent,
  noveltyPenalty,
} from '../services/contentHistory';

export interface StrategyDecision {
  topic: string;
  hook: string;
  format: 'CAROUSEL' | 'SINGLE_IMAGE' | 'WATCHLIST_EDUCATION' | 'REEL_DRAFT';
  slideCount: number;
  slideBreakdown: string[];
  reasoning: string;
  targetAudience: string;
  searchKeywords: string[];
  contentPillar?: string;
}

export class ContentStrategyAgent extends BaseAgent {
  constructor() {
    super('ContentStrategyAgent');
  }

  async execute(input: {
    trends: TrendResearchResult,
    contentHistory?: ContentHistoryEntry[],
    videoGenerationAvailable?: boolean,
  }): Promise<StrategyDecision> {
    console.log(`[${this.name}] 🧠 Deciding content strategy...`);
    const contentHistory = input.contentHistory || [];
    const videoGenerationAvailable = input.videoGenerationAvailable === true;

    const prompt = `You are a senior Instagram content strategist for "TheStatsAndStacks", a premium Canadian finance brand.

Given these trending topics, pick the SINGLE BEST one and decide the exact execution plan.

FORMAT DECISION RULES:
- Use CAROUSEL (multiple slides) for educational breakdowns or comparisons.
- CAROUSEL slides should be 5-8 slides.
- Use WATCHLIST_EDUCATION for stock-market content. Never recommend buy/sell/hold or price targets.
- SINGLE_IMAGE is allowed only for one-number stats or simple reminders.
- Use REEL_DRAFT only when video rendering is available AND the topic benefits from motion, pacing, charts, or a sequential teaching flow. The video renderer creates animated educational vertical MP4s with generated chart/finance graphics and synthetic background music; do not require voiceover, paid video APIs, or stock footage.
- Video rendering availability for this run: ${videoGenerationAvailable ? 'available' : 'not available'}.
- Do not choose a topic that is similar to the last 10 posts unless the angle is meaningfully different.
- Optimize for a daily mix: Canadian money systems, tax/account explainers, investor risk protection, and occasional Canada/US stock research education.
- Stock content should feel useful to stock-curious followers, but it must be framed as "how to research" or "what to check", not as "buy these stocks".

Here are the top topics: ${JSON.stringify(input.trends.topics)}

Recent posts to avoid repeating: ${JSON.stringify(contentHistory.slice(-14))}

Research signal briefs: ${JSON.stringify(input.trends.signalBriefs || [])}

Pick the best one. Output ONLY valid JSON (no markdown, no code fences):
{
  "topic": "exact topic title",
  "hook": "the hook text for slide 1",
  "format": "CAROUSEL" or "SINGLE_IMAGE" or "WATCHLIST_EDUCATION" or "REEL_DRAFT",
  "slideCount": number,
  "slideBreakdown": ["Slide 1: exact on-image headline | short supporting point | short supporting point", "Slide 2: exact on-image headline | short supporting point | short supporting point", ...],
  "reasoning": "why this format and topic",
  "targetAudience": "who this is for",
  "searchKeywords": ["keyword1", "keyword2"],
  "contentPillar": "content pillar name"
}`;

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return normalizeStrategy(JSON.parse(cleaned) as StrategyDecision, input.trends, contentHistory, videoGenerationAvailable);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${this.name}] Gemini strategy failed; using cost-safe fallback strategy. ${message}`);
      return getRotatingFallbackStrategy(input.trends, contentHistory, videoGenerationAvailable);
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
    contentPillar: 'Stock education without recommendations',
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
    contentPillar: 'Risk management',
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
    contentPillar: 'Canadian account selection',
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
    contentPillar: 'Money behavior and budgeting',
  },
  {
    topic: '5 Money Leaks Canadians Can Fix This Week',
    hook: 'One leak fixed is momentum.',
    format: 'REEL_DRAFT',
    slideCount: 6,
    slideBreakdown: [
      'Slide 1: One leak fixed is momentum | Start with the leak you can see | Then automate the fix',
      'Slide 2: Leak 1: Subscription drift | Cancel one unused charge | Redirect it before it disappears',
      'Slide 3: Leak 2: Minimum-payment autopilot | Interest can quietly win | Know the true payoff cost',
      'Slide 4: Leak 3: No payday order | Money needs a route | Bills, buffer, debt, goals, then spending',
      'Slide 5: Leak 4: Idle cash with no job | Emergency cash is good | Random cash needs a purpose',
      'Slide 6: Save this weekly leak check | Pick one fix today | Educational only, not financial advice',
    ],
    reasoning: 'A short animated Reel works well for fast sequential fixes while keeping the output free and motion-led.',
    targetAudience: 'Canadians who want practical money fixes without a full budgeting overhaul',
    searchKeywords: ['money leaks', 'budgeting Canada', 'payday routine'],
    contentPillar: 'Money behavior and budgeting',
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
    contentPillar: 'Canadian money systems explained',
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
    contentPillar: 'Credit education',
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
    contentPillar: 'Saving and investing timeline',
  },
  {
    topic: 'Canada/US Stock Watchlist: The 6-Point Research Screen',
    hook: 'A watchlist is not a buy list.',
    format: 'WATCHLIST_EDUCATION',
    slideCount: 8,
    slideBreakdown: [
      'Slide 1: A watchlist is not a buy list | Use it to organize research | Not to chase a ticker',
      'Slide 2: Screen 1: Business quality | What does the company actually sell? | Is demand durable or cyclical?',
      'Slide 3: Screen 2: Numbers trend | Revenue, margins, cash flow | Look for direction, not one perfect metric',
      'Slide 4: Screen 3: Balance sheet risk | Debt, cash, refinancing needs | Rates can change the story',
      'Slide 5: Screen 4: Valuation context | Compare price to expectations | Great businesses can still be expensive',
      'Slide 6: Screen 5: Catalyst map | Earnings, regulation, product cycles | Know what could change the thesis',
      'Slide 7: Screen 6: Portfolio fit | Sector exposure and position size | One ticker should not become the whole plan',
      'Slide 8: Save this research screen | Research first | Decide later | Educational only, not financial advice',
    ],
    reasoning: 'Provides stock-pick energy without giving buy/sell recommendations.',
    targetAudience: 'Canadian and US stock-curious beginners who need a safer research process',
    searchKeywords: ['Canada US stock watchlist', 'stock research checklist', 'how to research stocks'],
    contentPillar: 'Canadian/US market watchlist education',
  },
  {
    topic: 'Earnings Season Cheat Sheet: What Beginners Should Check First',
    hook: 'Do not read earnings like a headline.',
    format: 'CAROUSEL',
    slideCount: 7,
    slideBreakdown: [
      'Slide 1: Do not read earnings like a headline | One beat or miss is not the full story | Start with the business trend',
      'Slide 2: Check revenue quality | Is growth broad or one-time? | Compare the reason, not just the number',
      'Slide 3: Check margins | Costs can hide under growth | Profit quality matters',
      'Slide 4: Check cash flow | Accounting profit is not always cash | Watch what funds the business',
      'Slide 5: Check guidance | Management expectations reset the story | The market reacts to the future',
      'Slide 6: Check valuation reaction | Good news can be priced in | Bad news can already be expected',
      'Slide 7: Save before earnings season | Learn the pattern | Avoid headline trades | Educational only',
    ],
    reasoning: 'Timely market literacy that helps followers handle popular stock news responsibly.',
    targetAudience: 'Beginner investors learning how public companies report results',
    searchKeywords: ['earnings report explained', 'stock earnings checklist', 'beginner investing'],
    contentPillar: 'Market literacy',
  },
  {
    topic: 'Finfluencer Red Flags: 7 Phrases Investors Should Pause On',
    hook: 'Good finance content does not need pressure.',
    format: 'CAROUSEL',
    slideCount: 7,
    slideBreakdown: [
      'Slide 1: Good finance content does not need pressure | Pause when advice sounds too certain | Risk deserves daylight',
      'Slide 2: Red flag 1: Guaranteed returns | Markets do not owe anyone certainty | Ask what can go wrong',
      'Slide 3: Red flag 2: Buy before it is too late | Urgency can block thinking | A real thesis can survive questions',
      'Slide 4: Red flag 3: No disclosure | Incentives matter | Paid promotion should be obvious',
      'Slide 5: Red flag 4: Only upside charts | Missing risk is still a message | Look for both sides',
      'Slide 6: Red flag 5: Copy my trades | Your situation is not their situation | Education beats imitation',
      'Slide 7: Save this before trusting a pick | Source it | Stress-test it | Educational only',
    ],
    reasoning: 'Protective content builds trust and is highly shareable.',
    targetAudience: 'Young investors consuming finance content on social media',
    searchKeywords: ['finfluencer red flags', 'investment scams social media', 'investing risk'],
    contentPillar: 'Investor protection',
  },
];

function getRotatingFallbackStrategy(
  trends: TrendResearchResult,
  contentHistory: ContentHistoryEntry[] = [],
  videoGenerationAvailable = false
): StrategyDecision {
  const dayIndex = Math.floor(Date.now() / 86_400_000) % fallbackStrategies.length;
  const allowedFallbacks = fallbackStrategies.filter((strategy) => (
    videoGenerationAvailable || strategy.format !== 'REEL_DRAFT'
  ));
  const topTopic = [...trends.topics]
    .sort((a, b) => (b.score - noveltyPenalty(b.title, contentHistory)) - (a.score - noveltyPenalty(a.title, contentHistory)))
    .find((topic) => !isTooSimilarToRecent(topic.title, contentHistory));
  const matchedStrategy = topTopic
    ? allowedFallbacks.find((strategy) => strategy.topic === topTopic.title)
    : undefined;
  const eligibleFallbacks = allowedFallbacks.filter((strategy) => !isTooSimilarToRecent(strategy.topic, contentHistory));
  const strategy = matchedStrategy
    || eligibleFallbacks[dayIndex % Math.max(eligibleFallbacks.length, 1)]
    || allowedFallbacks[dayIndex % Math.max(allowedFallbacks.length, 1)]
    || fallbackStrategies[dayIndex];

  if (!topTopic) return strategy;
  return {
    ...strategy,
    searchKeywords: topTopic.searchKeywords?.length ? topTopic.searchKeywords : strategy.searchKeywords,
    contentPillar: topTopic.contentPillar || strategy.contentPillar,
  };
}

function normalizeStrategy(
  strategy: StrategyDecision,
  trends: TrendResearchResult,
  contentHistory: ContentHistoryEntry[],
  videoGenerationAvailable = false
): StrategyDecision {
  const validFormats: StrategyDecision['format'][] = ['CAROUSEL', 'SINGLE_IMAGE', 'WATCHLIST_EDUCATION', 'REEL_DRAFT'];
  if (!validFormats.includes(strategy.format)) {
    return getRotatingFallbackStrategy(trends, contentHistory, videoGenerationAvailable);
  }

  if (strategy.format === 'REEL_DRAFT' && !videoGenerationAvailable) {
    const imageFallback = getRotatingFallbackStrategy(trends, contentHistory, videoGenerationAvailable);
    return {
      ...imageFallback,
      reasoning: `${imageFallback.reasoning} Chosen because local video rendering is not available on this run.`,
    };
  }

  if (strategy.slideCount < 1 || strategy.slideCount > 9 || strategy.slideBreakdown.length !== strategy.slideCount) {
    return getRotatingFallbackStrategy(trends, contentHistory, videoGenerationAvailable);
  }

  if (isTooSimilarToRecent(strategy.topic, contentHistory)) {
    const freshFallback = getRotatingFallbackStrategy(trends, contentHistory, videoGenerationAvailable);
    return {
      ...freshFallback,
      reasoning: `${freshFallback.reasoning} Chosen because the model-selected topic was too similar to recent content.`,
    };
  }

  return {
    ...strategy,
    slideBreakdown: strategy.slideBreakdown.map((slide, index) => (
      slide.toLowerCase().startsWith(`slide ${index + 1}:`) ? slide : `Slide ${index + 1}: ${slide}`
    )),
  };
}
