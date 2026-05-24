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
  format: 'CAROUSEL' | 'SINGLE_IMAGE' | 'WATCHLIST_EDUCATION';
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
  }): Promise<StrategyDecision> {
    console.log(`[${this.name}] 🧠 Deciding content strategy...`);
    const contentHistory = input.contentHistory || [];

    const prompt = `You are a senior Instagram content strategist for "TheStatsAndStacks", a premium Canadian finance brand.

Given these trending topics, pick the SINGLE BEST one and decide the exact execution plan.

CREATOR REFERENCE RULES:
- Use million-follower finance accounts only as pattern references: simple language, strong first frame, one concrete framework, clear follow reason, and original designed assets. Do not copy a hook, layout, screenshot, color system, or creator persona.
- Personal-finance mega accounts win by turning a common money pain into a beginner-safe decision rule. Market and investing pages win by putting one chart/stat/news object on screen, then explaining what matters and what to watch next.
- TheStatsAndStacks should feel more premium and more trustworthy than hype pages: Canadian context, clean data visuals, risk notes, and practical next-step checklists.
- Prioritize topics that can earn saves, shares, profile visits, and follows because the post gives a reusable framework.
- If the hot-topic desk has live market candidates scoring 0.90 or higher, choose a WATCHLIST_EDUCATION hot-market idea unless it is too similar to recent history. The user wants the account to react to current investing-page topics, then make them smarter and safer.

FORMAT DECISION RULES:
- Use CAROUSEL (multiple slides) for educational breakdowns or comparisons.
- CAROUSEL slides should be 5-8 slides.
- Use WATCHLIST_EDUCATION for stock-market content. Never recommend buy/sell/hold or price targets.
- SINGLE_IMAGE is allowed only for one-number stats or simple reminders.
- For market-style content, use a high-density education structure: hook, what happened, chart/stat object, why it matters, what to watch, risk note. Keep it factual and useful, not hype.
- Slide 1 must be a cover hook with 4-9 words, emotional specificity, and no cheap clickbait.
- Slide 2 should create the "oh, I need this" moment: a mistake, overlooked risk, decision fork, or surprising-but-supported context.
- The final slide must give a save/share/follow reason in plain language without sounding needy.
- The output is picture-only. Do not choose, mention, or plan video/Reels/MP4/audio.
- Every slide must feel educational on its own: one strong headline, one concrete decision/stat/risk idea, and 2-3 short supporting points.
- Keep slide text compact enough for premium typography: headline under 11 words, supporting points under 12 words each, no paragraphs.
- Avoid empty-space slides: each slide should justify the visual module with a chart, checklist, comparison, risk meter, account map, or decision framework.
- Do not choose a topic that is similar to the last 10 posts unless the angle is meaningfully different.
- Optimize for a daily mix: Macro-economic/political news, Trading psychology, Hypothetical 'What-If' scenarios, Investor protection, and occasional Canadian account explainers.
- Stock content should feel useful to stock-curious followers. Hypothetical scenarios (e.g., "If you invested $10,000 in [Stock] 5 years ago") are highly encouraged for engagement, as long as they explicitly frame it as past education.
- Never use "stocks to buy", "best stock to buy", "buy this stock", "sell this stock", price targets, or recommendation phrasing. For hypotheticals, you may estimate historical numbers if exact ones are unavailable, but keep them realistic.
- Hot tickers such as SanDisk/SNDK are allowed when the angle is "what happened", "what to watch", or "hypothetical history". You may estimate historical returns for hypothetical posts if exact numbers aren't in the signals, but do not invent future earnings or performance metrics.
- Do not use hype verbs in hooks or titles: explodes, moons, blasts off, skyrockets, must-buy, can't miss. Premium market education should sound calm even when the topic is hot.
- Do not put exact percentage moves in the cover hook. If a source window says 1Y/YTD/from 52-week low, never rewrite it as 1 day/today.

Here are the top topics: ${JSON.stringify(input.trends.topics)}

Recent posts to avoid repeating: ${JSON.stringify(contentHistory.slice(-14))}

Research signal briefs: ${JSON.stringify(input.trends.signalBriefs || [])}

Pick the best one. Output ONLY valid JSON (no markdown, no code fences):
{
  "topic": "exact topic title",
  "hook": "the hook text for slide 1",
  "format": "CAROUSEL" or "SINGLE_IMAGE" or "WATCHLIST_EDUCATION",
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
      return normalizeStrategy(
        JSON.parse(cleaned) as StrategyDecision,
        input.trends,
        contentHistory,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${this.name}] Gemini strategy failed; using cost-safe fallback strategy. ${message}`);
      return getRotatingFallbackStrategy(input.trends, contentHistory);
    }
  }
}

const fallbackStrategies: StrategyDecision[] = [
  {
    topic: 'If You Invested $10,000 in SanDisk 5 Years Ago',
    hook: 'What $10k in SNDK looks like today.',
    format: 'CAROUSEL',
    slideCount: 6,
    slideBreakdown: [
      'Slide 1: What $10k in SNDK looks like today | The power of holding a tech winner | Let\'s look at the math',
      'Slide 2: The Initial Investment | $10,000 invested 5 years ago | Buying when the market was uncertain',
      'Slide 3: The Growth Journey | Through macro shocks and rate hikes | The stock continued its trajectory',
      'Slide 4: The Result Today | That $10,000 is now worth $XX,XXX | A massive X% return',
      'Slide 5: The Lesson | Time in the market beats timing the market | Conviction pays off',
      'Slide 6: Save this reminder | Wealth is built slowly, then all at once | Educational only, not financial advice',
    ],
    reasoning: 'Hypothetical "What If" scenarios are incredibly viral and drive massive engagement through FOMO and educational realization.',
    targetAudience: 'Investors and traders who want to see the power of long-term holding in popular stocks.',
    searchKeywords: ['SanDisk stock', 'if you invested', 'compound growth', 'tech stocks'],
    contentPillar: 'Hypothetical "What If" investment scenarios',
  },
  {
    topic: 'How President Trump\'s Policies Impact the Tech Sector',
    hook: 'What the new policies mean for Tech.',
    format: 'WATCHLIST_EDUCATION',
    slideCount: 7,
    slideBreakdown: [
      'Slide 1: What the new policies mean for Tech | Breaking down the macro shift | How tariffs and taxes affect margins',
      'Slide 2: The Tariff Impact | Higher costs for hardware imports | Supply chains are shifting fast',
      'Slide 3: The Tax Cuts | Lower corporate tax rates boost earnings | Software margins expand',
      'Slide 4: Who Wins? | Domestic manufacturers | Companies with strong US revenue bases',
      'Slide 5: Who is at Risk? | Heavy reliance on overseas assembly | Companies with narrow hardware margins',
      'Slide 6: What to Watch Next | Fed rate decisions | Trade negotiations | Quarterly guidance updates',
      'Slide 7: Save this macro checklist | Watch the policies, not just the prices | Educational only, not financial advice',
    ],
    reasoning: 'Macro-political news tied to market impacts creates high-save content that feels timely and authoritative.',
    targetAudience: 'Active investors and traders trying to navigate political news and its market effects.',
    searchKeywords: ['Trump tech stocks', 'market news', 'macro economics', 'stock market update'],
    contentPillar: 'Global macro-economic news',
  },
  {
    topic: 'SanDisk (SNDK) AI Storage Heat Check: What the Move Actually Means',
    hook: 'SanDisk is a case study.',
    format: 'WATCHLIST_EDUCATION',
    slideCount: 8,
    slideBreakdown: [
      'Slide 1: SanDisk is a case study | A hot stock is not automatically a plan | Use the move to learn the process',
      'Slide 2: What changed | AI data centers need storage | Memory pricing can change fast | Spin-off stories can reset expectations',
      'Slide 3: Why traders cared | Revenue momentum gets attention | Margins tell the real story | Guidance can move the narrative',
      'Slide 4: Risk 1: Expectations | A big move can price in good news | Great news can still disappoint later',
      'Slide 5: Risk 2: Memory cycles | Storage demand can be powerful | Supply and pricing cycles still matter',
      'Slide 6: Risk 3: Position size | Hot tickers can swing hard | One idea should not become the whole portfolio',
      'Slide 7: What to watch next | Data-center demand | Contract quality | Margins | Balance sheet risk',
      'Slide 8: Save this hot-stock filter | Catalyst first | Risk second | Decision last | Educational only',
    ],
    reasoning: 'SanDisk-style market heat can attract stock-curious followers while teaching a safer research process instead of giving a trade call.',
    targetAudience: 'Stock-curious Canadian investors who see viral market moves and need a better filter',
    searchKeywords: ['SNDK stock', 'SanDisk stock', 'AI storage stocks', 'hot stock risk checklist'],
    contentPillar: 'Hot market education without recommendations',
  },
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
    format: 'CAROUSEL',
    slideCount: 6,
    slideBreakdown: [
      'Slide 1: One leak fixed is momentum | Start with the leak you can see | Then automate the fix',
      'Slide 2: Leak 1: Subscription drift | Cancel one unused charge | Redirect it before it disappears',
      'Slide 3: Leak 2: Minimum-payment autopilot | Interest can quietly win | Know the true payoff cost',
      'Slide 4: Leak 3: No payday order | Money needs a route | Bills, buffer, debt, goals, then spending',
      'Slide 5: Leak 4: Idle cash with no job | Emergency cash is good | Random cash needs a purpose',
      'Slide 6: Save this weekly leak check | Pick one fix today | Educational only, not financial advice',
    ],
    reasoning: 'A tight carousel works well for fast sequential fixes while keeping the output picture-only and saveable.',
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
  {
    topic: 'Why the First $100K Feels So Slow for Canadian Investors',
    hook: 'The first $100K feels slow.',
    format: 'CAROUSEL',
    
    slideCount: 7,
    slideBreakdown: [
      'Slide 1: The first $100K feels slow | Early wealth is mostly built by habits | The acceleration comes later',
      'Slide 2: The hard part | Your contributions do most of the work early | That can feel boring, not broken',
      'Slide 3: Track the controllables | Savings rate | Investing consistency | Account choice | Fees',
      'Slide 4: Watch the drag | High-interest debt | Expensive products | Panic changes | Lifestyle creep',
      'Slide 5: Use Canadian account order | TFSA, RRSP, and FHSA each have a job | Match the account to the goal',
      'Slide 6: Better scoreboard | Net worth trend | Contribution streak | Risk level you can hold',
      'Slide 7: Save this milestone map | Build the inputs first | Let compounding get louder later | Educational only',
    ],
    reasoning: 'Milestone investing content has broad appeal, and this version turns it into a Canadian framework rather than hype.',
    targetAudience: 'Canadian beginner investors building their first meaningful portfolio milestone',
    searchKeywords: ['first 100k investing', 'compound growth Canada', 'beginner investing Canada'],
    contentPillar: 'Canadian investing behavior',
  },
  {
    topic: 'The 10-Minute Portfolio Check Before Adding More Money',
    hook: 'Check this before adding money.',
    format: 'WATCHLIST_EDUCATION',
    
    slideCount: 8,
    slideBreakdown: [
      'Slide 1: Check this before adding money | A portfolio needs a quick inspection | More money is not always the fix',
      'Slide 2: Check 1: Cash buffer | Investing feels easier when bills are protected | Do not invest emergency money',
      'Slide 3: Check 2: Concentration | One position can quietly dominate risk | Know your biggest exposure',
      'Slide 4: Check 3: Fees | Small costs compound too | Compare products before adding more',
      'Slide 5: Check 4: Account fit | TFSA, RRSP, FHSA, taxable | Use the account that matches the goal',
      'Slide 6: Check 5: Rebalancing | Winners can change your risk | Your mix may drift over time',
      'Slide 7: Check 6: Thesis | Why are you adding money now? | A headline is not a plan',
      'Slide 8: Save this portfolio check | Review risk first | Add money second | Educational only, not financial advice',
    ],
    reasoning: 'A quick diagnostic format is saveable and gives stock-curious followers a compliant action framework.',
    targetAudience: 'Canadian investors who want structure before adding money to a portfolio',
    searchKeywords: ['portfolio check', 'investing checklist', 'risk management'],
    contentPillar: 'Risk management',
  },
];

function getRotatingFallbackStrategy(
  trends: TrendResearchResult,
  contentHistory: ContentHistoryEntry[] = []
): StrategyDecision {
  const dayIndex = Math.floor(Date.now() / 86_400_000) % fallbackStrategies.length;
  const topTopic = [...trends.topics]
    .sort((a, b) => (b.score - noveltyPenalty(b.title, contentHistory)) - (a.score - noveltyPenalty(a.title, contentHistory)))
    .find((topic) => !isTooSimilarToRecent(topic.title, contentHistory));
  const matchedStrategy = topTopic
    ? fallbackStrategies.find((strategy) => strategy.topic === topTopic.title)
    : undefined;
  const eligibleFallbacks = fallbackStrategies.filter((strategy) => !isTooSimilarToRecent(strategy.topic, contentHistory));
  const strategy = matchedStrategy
    || eligibleFallbacks[dayIndex % Math.max(eligibleFallbacks.length, 1)]
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
): StrategyDecision {
  const validFormats: StrategyDecision['format'][] = ['CAROUSEL', 'SINGLE_IMAGE', 'WATCHLIST_EDUCATION'];
  if (!validFormats.includes(strategy.format)) {
    return getRotatingFallbackStrategy(trends, contentHistory);
  }



  if (strategy.slideCount < 1 || strategy.slideCount > 9 || strategy.slideBreakdown.length !== strategy.slideCount) {
    return getRotatingFallbackStrategy(trends, contentHistory);
  }

  if (containsBlockedRecommendationLanguage(strategy)) {
    const safeFallback = getRotatingFallbackStrategy(trends, contentHistory);
    return {
      ...safeFallback,
      reasoning: `${safeFallback.reasoning} Chosen because the model-selected topic used buy/sell recommendation language.`,
    };
  }

  if (containsBlockedMarketHypeLanguage(strategy)) {
    const safeFallback = getRotatingFallbackStrategy(trends, contentHistory);
    return {
      ...safeFallback,
      reasoning: `${safeFallback.reasoning} Chosen because the model-selected topic used hype language or an unsafe exact-performance claim.`,
    };
  }

  if (isTooSimilarToRecent(strategy.topic, contentHistory)) {
    const freshFallback = getRotatingFallbackStrategy(trends, contentHistory);
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

function containsBlockedMarketHypeLanguage(strategy: StrategyDecision): boolean {
  const text = [
    strategy.topic,
    strategy.hook,
    strategy.reasoning,
    ...strategy.slideBreakdown,
  ].join('\n');

  return (
    /\b(explodes|moons|blasts off|skyrockets|can't miss|must[-\s]?buy)\b/i.test(text)
    || hasExtremeOneDayPerformanceClaim(text)
    || /\binactive ticker\b|\bphantom surge\b|\bacquired by\s+(wdc|western digital)\b/i.test(text)
  );
}

function hasExtremeOneDayPerformanceClaim(text: string): boolean {
  if (/if you invested|years ago|months ago/i.test(text)) {
    return false;
  }

  const claims = [
    ...text.matchAll(/(?:1\s*day|1d|today)[^\n.%]{0,42}([+-]?\d+(?:,\d{3})*(?:\.\d+)?)%/gi),
    ...text.matchAll(/([+-]?\d+(?:,\d{3})*(?:\.\d+)?)%[^\n.]{0,42}(?:1\s*day|1d|today)/gi),
  ];

  return claims.some((claim) => Number(claim[1].replace(/,/g, '')) >= 250);
}

function containsBlockedRecommendationLanguage(strategy: StrategyDecision): boolean {
  const text = [
    strategy.topic,
    strategy.hook,
    strategy.reasoning,
    ...strategy.slideBreakdown,
  ].join('\n');

  return (
    /(best|top)\s+\d*\s*(stocks?|etfs?)\s+to\s+buy/i.test(text)
    || /\b(buy|sell)\s+(this|these)\s+(stock|stocks|etf|etfs)\b/i.test(text)
    || /\b(you should|must|need to)\s+(buy|sell|hold|invest)\b/i.test(text)
    || /price target|target price|\$\d+(?:\.\d+)?\s*(?:target|by\s+\d{4})/i.test(text)
  );
}
