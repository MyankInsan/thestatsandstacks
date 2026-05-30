import { BaseAgent, TrendResearchResult } from './interfaces';
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import {
  ContentHistoryEntry,
  isTooSimilarToRecent,
  noveltyPenalty,
  parseEnumOrInfer,
  type NarrativeArc,
} from '../services/contentHistory';
import type { SlotConfig } from './slotConfig';
import type { MustAvoidSet } from './historyGuardAgent';
import { HOOK_FORMULAS, type HookFormulaId, isHookFormulaId } from './hookFormulas';
import { CTA_LIBRARY, selectCta, type CtaId, type CtaFeedbackEntry } from './ctaLibrary';
import { HookQualityGate, getDeterministicFallbackHookFormula } from './hookQualityGate';
import type { TopicCategory } from './portraitLibrary';
import type { AngleId } from './topicAngleAgent';

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

  hookFormulaId?: HookFormulaId;
  ctaId?: CtaId;
  topicCategory?: TopicCategory;
  angleId?: AngleId;
  payoffSlideIndex?: number;
}

export interface ContentStrategyInput {
  trends: TrendResearchResult;
  contentHistory?: ContentHistoryEntry[];
  slot?: SlotConfig;
  mustAvoid?: MustAvoidSet;
  ctaFeedback?: CtaFeedbackEntry[];
  preferredAngleId?: AngleId;
  recentCtasUsed?: CtaId[];
}

export class ContentStrategyAgent extends BaseAgent {
  constructor() {
    super('ContentStrategyAgent');
  }

  async execute(input: ContentStrategyInput): Promise<StrategyDecision> {
    console.log(`[${this.name}] 🧠 Deciding content strategy${input.slot ? ` for slot ${input.slot.index} (${input.slot.persona})` : ''}...`);
    const contentHistory = input.contentHistory || [];

    const hookFormulasBlock = input.slot
      ? `\n\nPREFERRED HOOK FORMULAS (pick one and return its id verbatim as hookFormulaId):\n${input.slot.preferredHookFormulas.map((id) => `- ${id}: "${HOOK_FORMULAS[id].pattern}" (use when: ${HOOK_FORMULAS[id].whenToUse})`).join('\n')}`
      : '';

    const mustAvoidBlock = input.mustAvoid
      ? `\n\nMUST AVOID (recent posts already used these — pick a different one):\n- hookFormulas: ${input.mustAvoid.hookFormulas.join(', ') || 'none'}\n- tickers as hero: ${input.mustAvoid.tickers.join(', ') || 'none'}\n- topicCategory: avoid 3 in a row from same category`
      : '';

    const slotPillarBlock = input.slot
      ? `\n\nSLOT PERSONA: ${input.slot.persona} (${input.slot.description}). Pick a topic that fits this persona.`
      : '';

    const prompt = `You are a senior Instagram content strategist for "TheStatsAndStacks", a premium Canadian finance brand.

Given these trending topics, pick the SINGLE BEST one and decide the exact execution plan.

CREATOR REFERENCE RULES:
- Use million-follower finance accounts only as pattern references: simple language, strong first frame, one concrete framework, clear follow reason, and original designed assets. Do not copy a hook, layout, screenshot, color system, or creator persona.
- Personal-finance mega accounts win by turning a common money pain into a beginner-safe decision rule. Market and investing pages win by putting one chart/stat/news object on screen, then explaining what matters and what to watch next.
- TheStatsAndStacks should feel more premium and more trustworthy than hype pages: Canadian context, clean data visuals, risk notes, and practical next-step checklists.
- Prioritize topics that can earn saves, shares, profile visits, and follows because the post gives a reusable framework.

FORMAT DECISION RULES:
- Use CAROUSEL (multiple slides) for educational breakdowns or comparisons.
- CAROUSEL slides should be 5-8 slides.
- Use WATCHLIST_EDUCATION for stock-market content. Never recommend buy/sell/hold or price targets.
- SINGLE_IMAGE is allowed only for one-number stats or simple reminders.
- For market-style content, use a high-density education structure: hook, what happened, chart/stat object, why it matters, what to watch, risk note.
- Slide 1 must be a cover hook with 4-9 words, emotional specificity, and no cheap clickbait.
- Slide 2 should create the "oh, I need this" moment: a mistake, overlooked risk, decision fork, or surprising-but-supported context.
- The final slide must give a save/share/follow reason in plain language without sounding needy.
- The output is picture-only. Do not choose, mention, or plan video/Reels/MP4/audio.
- Every slide must feel educational on its own: one strong headline, one concrete decision/stat/risk idea, and 2-3 short supporting points.
- Keep slide text compact enough for premium typography: headline under 11 words, supporting points under 12 words each, no paragraphs.
- Do not choose a topic that is similar to the last 10 posts unless the angle is meaningfully different.
- Stock content should feel useful to stock-curious followers. Hypothetical scenarios are encouraged when explicitly framed as past education.
- Never use "stocks to buy", "best stock to buy", "buy this stock", "sell this stock", price targets, or recommendation phrasing.
- Hot tickers are allowed when the angle is "what happened", "what to watch", or "hypothetical history".
- Do not use hype verbs in hooks or titles: explodes, moons, blasts off, skyrockets, must-buy, can't miss.
- Do not put exact percentage moves in the cover hook. If a source window says 1Y/YTD/from 52-week low, never rewrite it as 1 day/today.
${slotPillarBlock}${hookFormulasBlock}${mustAvoidBlock}

Here are the top topics: ${JSON.stringify(input.trends.topics.slice(0, 5))}

Recent posts to avoid repeating: ${JSON.stringify(contentHistory.slice(-14).map((e) => ({ date: e.date, topic: e.topic, slotIndex: e.slotIndex })))}

Pick the best one. Output ONLY valid JSON (no markdown, no code fences):
{
  "topic": "exact topic title",
  "hook": "the hook text for slide 1 (4-11 words)",
  "hookFormulaId": "${input.slot ? input.slot.preferredHookFormulas[0] : 'RECEIPT_DROP'}",
  "topicCategory": "EARNINGS|MACRO|POLICY|TAX_ACCT|CRYPTO|COMMODITY|HOUSING|BEHAVIORAL|HOW_TO|CAP_TABLE",
  "format": "CAROUSEL or SINGLE_IMAGE or WATCHLIST_EDUCATION",
  "slideCount": number,
  "slideBreakdown": ["Slide 1: exact on-image headline | short supporting point | short supporting point", "Slide 2: ...", ...],
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
      return normalizeStrategy(JSON.parse(cleaned) as StrategyDecision, input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${this.name}] Gemini strategy failed; using cost-safe fallback strategy. ${message}`);
      return getRotatingFallbackStrategy(input);
    }
  }
}

const fallbackStrategies: StrategyDecision[] = [
  {
    topic: 'If You Invested $10,000 in NVIDIA 5 Years Ago',
    hook: 'What $10k in NVDA looks like today.',
    format: 'CAROUSEL',
    slideCount: 6,
    slideBreakdown: [
      "Slide 1: What $10k in NVDA looks like today | The power of holding a tech winner | Let's look at the math",
      'Slide 2: The Initial Investment | $10,000 invested 5 years ago | Buying when the market was uncertain',
      'Slide 3: The Growth Journey | Through macro shocks and rate hikes | The stock continued its trajectory',
      'Slide 4: The Result Today | That $10,000 is now worth $XX,XXX | A massive X% return',
      'Slide 5: The Lesson | Time in the market beats timing the market | Conviction pays off',
      'Slide 6: Save this reminder | Wealth is built slowly, then all at once | Educational only, not financial advice',
    ],
    reasoning: 'Hypothetical "What If" scenarios are incredibly viral and drive massive engagement through FOMO and educational realization.',
    targetAudience: 'Investors and traders who want to see the power of long-term holding in popular stocks.',
    searchKeywords: ['NVIDIA stock', 'if you invested', 'compound growth', 'tech stocks'],
    contentPillar: 'Hypothetical "What If" investment scenarios',
  },
  {
    topic: "How President Trump's Policies Impact the Tech Sector",
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
];

function getRotatingFallbackStrategy(input: ContentStrategyInput): StrategyDecision {
  const contentHistory = input.contentHistory ?? [];
  const dayIndex = Math.floor(Date.now() / 86_400_000) % fallbackStrategies.length;
  const topTopic = [...input.trends.topics]
    .sort((a, b) => (b.score - noveltyPenalty(b.title, contentHistory)) - (a.score - noveltyPenalty(a.title, contentHistory)))
    .find((topic) => !isTooSimilarToRecent(topic.title, contentHistory));
  const matchedStrategy = topTopic
    ? fallbackStrategies.find((strategy) => strategy.topic === topTopic.title)
    : undefined;
  const eligibleFallbacks = fallbackStrategies.filter((strategy) => !isTooSimilarToRecent(strategy.topic, contentHistory));
  const strategy = matchedStrategy
    || eligibleFallbacks[dayIndex % Math.max(eligibleFallbacks.length, 1)]
    || fallbackStrategies[dayIndex];

  const base: StrategyDecision = topTopic ? {
    ...strategy,
    searchKeywords: topTopic.searchKeywords?.length ? topTopic.searchKeywords : strategy.searchKeywords,
    contentPillar: topTopic.contentPillar || strategy.contentPillar,
  } : strategy;

  return enrichWithSlotDecisions(base, input);
}

function normalizeStrategy(strategy: StrategyDecision, input: ContentStrategyInput): StrategyDecision {
  const validFormats: StrategyDecision['format'][] = ['CAROUSEL', 'SINGLE_IMAGE', 'WATCHLIST_EDUCATION'];
  if (!validFormats.includes(strategy.format)) {
    return getRotatingFallbackStrategy(input);
  }

  if (strategy.slideCount < 1 || strategy.slideCount > 9 || strategy.slideBreakdown.length !== strategy.slideCount) {
    return getRotatingFallbackStrategy(input);
  }

  if (containsBlockedRecommendationLanguage(strategy)) {
    const safeFallback = getRotatingFallbackStrategy(input);
    return {
      ...safeFallback,
      reasoning: `${safeFallback.reasoning} Chosen because the model-selected topic used buy/sell recommendation language.`,
    };
  }

  if (containsBlockedMarketHypeLanguage(strategy)) {
    const safeFallback = getRotatingFallbackStrategy(input);
    return {
      ...safeFallback,
      reasoning: `${safeFallback.reasoning} Chosen because the model-selected topic used hype language or an unsafe exact-performance claim.`,
    };
  }

  if (isTooSimilarToRecent(strategy.topic, input.contentHistory ?? [])) {
    const freshFallback = getRotatingFallbackStrategy(input);
    return {
      ...freshFallback,
      reasoning: `${freshFallback.reasoning} Chosen because the model-selected topic was too similar to recent content.`,
    };
  }

  const enriched = enrichWithSlotDecisions(
    {
      ...strategy,
      slideBreakdown: strategy.slideBreakdown.map((slide, index) => (
        slide.toLowerCase().startsWith(`slide ${index + 1}:`) ? slide : `Slide ${index + 1}: ${slide}`
      )),
    },
    input,
  );

  const gate = new HookQualityGate();
  const slotPreferred = input.slot?.preferredHookFormulas ?? [];
  const gateResult = gate.check({
    hook: enriched.hook,
    slideBreakdown: enriched.slideBreakdown,
    hookFormulaId: enriched.hookFormulaId,
    slotPreferredFormulas: slotPreferred,
  });

  if (!gateResult.valid) {
    console.warn(`[ContentStrategyAgent] HookQualityGate failed: ${gateResult.failures.join('; ')}. Using deterministic fallback formula.`);
    const replacement = gateResult.suggestedReplacementFormulaId
      ?? getDeterministicFallbackHookFormula(slotPreferred, Math.floor(Date.now() / 86_400_000));
    return { ...enriched, hookFormulaId: replacement };
  }

  return enriched;
}

function enrichWithSlotDecisions(strategy: StrategyDecision, input: ContentStrategyInput): StrategyDecision {
  const dayOfYear = Math.floor(Date.now() / 86_400_000);

  const VALID_TOPIC_CATEGORIES: TopicCategory[] = ['EARNINGS', 'MACRO', 'POLICY', 'TAX_ACCT', 'CRYPTO', 'COMMODITY', 'HOUSING', 'BEHAVIORAL', 'HOW_TO', 'CAP_TABLE'];
  const topicCategory = parseEnumOrInfer(strategy.topicCategory, VALID_TOPIC_CATEGORIES) ?? inferTopicCategoryFrom(strategy);

  let hookFormulaId: HookFormulaId | undefined = isHookFormulaId(strategy.hookFormulaId) ? strategy.hookFormulaId : undefined;
  if (!hookFormulaId) {
    hookFormulaId = input.slot
      ? getDeterministicFallbackHookFormula(input.slot.preferredHookFormulas, dayOfYear)
      : 'RECEIPT_DROP';
  }

  let ctaId: CtaId;
  if (input.slot) {
    ctaId = selectCta({
      slotIndex: input.slot.index,
      preferredCtas: input.slot.preferredCtas,
      recentCtasUsed: input.recentCtasUsed ?? [],
      feedback: input.ctaFeedback,
      dmAutomationEnabled: process.env.DM_AUTOMATION_ENABLED === 'true',
      storyAutomationEnabled: process.env.STORY_AUTOMATION_ENABLED === 'true',
      hasPayoffSlide: true,
    });
  } else {
    ctaId = 'save_specific';
  }

  let payoffSlideIndex: number | undefined;
  if (ctaId === 'swipe_promise') {
    payoffSlideIndex = Math.max(3, Math.floor(strategy.slideCount / 2) + 1);
  }

  const angleId: AngleId | undefined = input.preferredAngleId;

  void CTA_LIBRARY;

  return {
    ...strategy,
    hookFormulaId,
    ctaId,
    topicCategory,
    angleId,
    payoffSlideIndex,
  };
}

function inferTopicCategoryFrom(strategy: StrategyDecision): TopicCategory {
  const text = `${strategy.topic} ${strategy.hook} ${strategy.searchKeywords.join(' ')}`.toLowerCase();
  if (/earnings|eps|revenue|guidance|quarter/.test(text)) return 'EARNINGS';
  if (/fed|rate|inflation|macro|recession|gdp/.test(text)) return 'MACRO';
  if (/policy|tariff|trump|trudeau|government|election/.test(text)) return 'POLICY';
  if (/tfsa|rrsp|fhsa|tax|account|cra/.test(text)) return 'TAX_ACCT';
  if (/crypto|bitcoin|btc|eth|ethereum|coin/.test(text)) return 'CRYPTO';
  if (/oil|gold|copper|commodity|natural gas/.test(text)) return 'COMMODITY';
  if (/housing|mortgage|home|rent|real estate/.test(text)) return 'HOUSING';
  if (/13f|holdings|portfolio|insider|cap table|owns/.test(text)) return 'CAP_TABLE';
  if (/checklist|framework|guide|how to|steps/.test(text)) return 'HOW_TO';
  return 'BEHAVIORAL';
}

function containsBlockedMarketHypeLanguage(strategy: StrategyDecision): boolean {
  const text = [
    strategy.topic, strategy.hook, strategy.reasoning, ...strategy.slideBreakdown,
  ].join('\n');

  return (
    /\b(explodes|moons|blasts off|skyrockets|can't miss|must[-\s]?buy)\b/i.test(text)
    || hasExtremeOneDayPerformanceClaim(text)
    || /\binactive ticker\b|\bphantom surge\b|\bacquired by\s+(wdc|western digital)\b/i.test(text)
  );
}

function hasExtremeOneDayPerformanceClaim(text: string): boolean {
  if (/if you invested|years ago|months ago/i.test(text)) return false;
  const claims = [
    ...text.matchAll(/(?:1\s*day|1d|today)[^\n.%]{0,42}([+-]?\d+(?:,\d{3})*(?:\.\d+)?)%/gi),
    ...text.matchAll(/([+-]?\d+(?:,\d{3})*(?:\.\d+)?)%[^\n.]{0,42}(?:1\s*day|1d|today)/gi),
  ];
  return claims.some((claim) => Number(claim[1].replace(/,/g, '')) >= 250);
}

function containsBlockedRecommendationLanguage(strategy: StrategyDecision): boolean {
  const text = [
    strategy.topic, strategy.hook, strategy.reasoning, ...strategy.slideBreakdown,
  ].join('\n');

  return (
    /(best|top)\s+\d*\s*(stocks?|etfs?)\s+to\s+buy/i.test(text)
    || /\b(buy|sell)\s+(this|these)\s+(stock|stocks|etf|etfs)\b/i.test(text)
    || /\b(you should|must|need to)\s+(buy|sell|hold|invest)\b/i.test(text)
    || /price target|target price|\$\d+(?:\.\d+)?\s*(?:target|by\s+\d{4})/i.test(text)
  );
}
