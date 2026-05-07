import { BaseAgent, TrendResearchResult } from './interfaces';
import { HotTopicDeskAgent } from './hotTopicAgents';
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import {
  ContentHistoryEntry,
  normalizeTopic,
  noveltyPenalty,
} from '../services/contentHistory';
import { getLocalDateKey } from '../services/dateUtils';

interface TrendResearchInput {
  contentHistory?: ContentHistoryEntry[];
}

type ResearchSignalBrief = NonNullable<TrendResearchResult['signalBriefs']>[number];

export class TrendResearchAgent extends BaseAgent {
  constructor() {
    super('TrendResearchAgent');
  }

  async execute(input?: TrendResearchInput): Promise<TrendResearchResult> {
    console.log(`[${this.name}] 🔍 Starting deep trend research...`);

    const today = new Date();
    const todayLabel = getLocalDateKey(today);
    const contentHistory = input?.contentHistory || [];
    const hotTopicDesk = await new HotTopicDeskAgent().execute({ contentHistory });
    const signalBriefs = [
      ...(hotTopicDesk.signalBriefs || []),
      ...await collectResearchSignals(today),
    ];
    const researchCandidates = rankAndDedupeCandidates(
      [
        ...hotTopicDesk.topics,
        ...buildResearchBacklog(today, signalBriefs),
      ],
      contentHistory
    );

    const prompt = `You are an elite Instagram growth strategist and financial content researcher for "TheStatsAndStacks", a premium Canadian personal finance brand on Instagram.

Today's date is ${todayLabel}.

Your job is to find the BEST possible topic for today's post that will maximize:
- Saves (the #1 signal for Instagram reach)
- Shares (the #2 signal)
- New followers
- Search discoverability inside Instagram

RESEARCH APPROACH:
1. Think about what Canadian personal finance topics people are actively searching for RIGHT NOW.
2. Give serious priority to the hot-topic desk signals when they show market heat. Trading pages win attention by reacting to names like SanDisk, but TheStatsAndStacks must turn that heat into education: catalyst, risk map, checklist, and "what to watch" context.
3. Consider seasonal timing, official finance calendars, tax deadlines, contribution deadlines, and market education needs.
4. Consider formats that create saves and shares: comparisons, checklists, myth-busters, step-by-step systems, "what to check before..." frameworks, and simple visual scorecards.
5. Avoid posting the same theme repeatedly. A fresh angle beats another generic TFSA/RRSP carousel.
6. For Canadian/US stocks, never recommend buy/sell/hold, price targets, guaranteed returns, or "best stocks to buy." Use watchlist education, catalyst/risk maps, valuation checklists, sector explainers, earnings-read frameworks, and "stocks to research" language only.
7. Do not use unsupported Instagram scraping. Use only the provided compliant research signals and public/permitted inputs.
8. For growth, favor finance-news and market-education patterns that work on large trading education pages without copying them: factual headline first, one chart/stat object, why-it-matters context, what to watch next, and a saveable risk/decision takeaway.
9. Do not mimic another creator's exact templates, colors, hooks, logo placement, screenshots, or paid-community funnel language.
10. Do not put exact percentage moves in topic titles. Use "heat check", "risk filter", or "case study" language instead. If a signal says a move is 1Y/YTD/from 52-week low, never rewrite it as 1 day/today.

CONTENT PILLARS TO DRAW FROM:
- TFSA vs RRSP vs FHSA comparisons
- Canadian tax strategies and deductions
- GIC vs HISA vs ETF comparisons
- First-time home buyer programs
- Dividend investing for Canadians
- Credit score optimization
- stock education without recommendations
- market literacy and risk management
- Canadian/US market watchlist education
- market-news explainers and chart lessons
- investor psychology and fraud/risk prevention

RECENT CONTENT TO AVOID REPEATING TOO SOON:
${JSON.stringify(contentHistory.slice(-14), null, 2)}

COMPLIANT RESEARCH SIGNALS:
${JSON.stringify(signalBriefs, null, 2)}

RESEARCH BACKLOG AND SOURCE SIGNALS:
${JSON.stringify(researchCandidates, null, 2)}

Return your TOP 7 topic ideas ranked by predicted performance.

Output ONLY valid JSON matching this schema (no markdown, no code fences):
{
  "topics": [
    {
      "title": "The exact post title/hook",
      "score": 0.0-1.0,
      "reasoning": "Why this will perform well today",
	      "suggestedFormat": "CAROUSEL" or "SINGLE_IMAGE" or "WATCHLIST_EDUCATION",
	      "suggestedSlideCount": number,
	      "searchKeywords": ["keyword1", "keyword2"],
	      "sourceUrls": [],
	      "contentPillar": "one of the content pillars",
	      "freshnessSignal": "why this is timely or why it has evergreen demand today"
	    }
	  ]
	    }`;

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      if (!text) throw new Error('No content returned from Gemini');

      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned) as TrendResearchResult;
      const topics = rankAndDedupeCandidates(parsed.topics.map(sanitizeTrendCandidate), contentHistory);

      console.log(`[${this.name}] ✅ Found ${topics.length} topic candidates`);
      return {
        ...parsed,
        topics,
        signalBriefs,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[${this.name}] Gemini research failed; using cost-safe fallback topics. ${message}`);
      return {
        topics: researchCandidates.slice(0, 7),
        signalBriefs,
        generatedAt: new Date().toISOString(),
      };
    }
  }
}

type ResearchCandidate = NonNullable<TrendResearchResult['topics'][number]>;

async function collectResearchSignals(today: Date): Promise<ResearchSignalBrief[]> {
  const collectors: Array<() => Promise<ResearchSignalBrief>> = [
    () => buildInstagramGrowthSignal(),
    () => buildCreatorReferenceSignal(),
    () => buildSeasonalFinanceSignal(today),
    () => buildMarketEducationSignal(today),
    () => collectRedditApiSignal(),
  ];

  const settled = await Promise.allSettled(collectors.map((collector) => collector()));
  return settled.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    return {
      source: `collector-${index + 1}`,
      status: 'fallback',
      summary: 'Signal collector failed; continuing with durable evergreen finance topics.',
      topicSeeds: [],
      sourceUrls: [],
    };
  });
}

async function buildInstagramGrowthSignal(): Promise<ResearchSignalBrief> {
  return {
    source: 'instagram-growth-rules',
    status: 'fallback',
    summary: 'Prioritize original, saveable, shareable, search-friendly posts. In 2026, originality and views matter across formats, while low-effort reposted content can lose recommendation eligibility.',
    topicSeeds: [
      'original point of view',
      'strong first-frame hook',
      'one idea per post',
      'comparison carousel',
      'decision checklist',
      'myth versus fact',
      'risk map',
      'one clear framework per post',
    ],
    sourceUrls: [
      'https://www.facebook.com/help/instagram/653964212890722',
      'https://about.instagram.com/blog/announcements/instagram-ranking-explained',
      'https://techcrunch.com/2026/04/30/instagram-restricts-reach-of-content-aggregators-in-new-crackdown/',
    ],
  };
}

async function buildCreatorReferenceSignal(): Promise<ResearchSignalBrief> {
  return {
    source: 'million-follower-finance-reference-patterns',
    status: 'fallback',
    summary: [
      'Use million-follower finance accounts as pattern references, not templates to copy.',
      'Personal-finance mega accounts lean on simple beginner language, emotionally specific money pain, and a clear reason to follow.',
      'Market-news and investing accounts use one chart/stat/news object, then explain what matters and what to watch next.',
      'The safest TheStatsAndStacks version is original Canadian money and market literacy: no screenshots, no reposts, no copied hooks, no buy/sell calls.',
    ].join(' '),
    topicSeeds: [
      'beginner money lesson with one memorable rule',
      'saveable checklist with a sharp cover hook',
      'myth versus fact for a common finance belief',
      'one chart or scorecard before a money decision',
      'risk-first market education',
      'follow-worthy daily Canadian money framework',
    ],
    sourceUrls: [
      'https://hafi.pro/top/most-followed-instagram/finance',
      'https://www.ratexyz.com/top/instagram/all/personal_finance',
      'https://www.humphreytalks.com/about',
    ],
  };
}

async function buildSeasonalFinanceSignal(today: Date): Promise<ResearchSignalBrief> {
  const month = today.getMonth();
  const day = today.getDate();
  const seeds = [
    'payday order of operations',
    'account selection framework',
    'cash versus investing timeline',
  ];

  if (month === 3 && day >= 15) {
    seeds.unshift('Canadian tax filing final checklist', 'last-minute tax document mistakes');
  }
  if (month === 11 || month <= 1) {
    seeds.unshift('new year TFSA RRSP FHSA contribution plan');
  }
  if (day <= 5 || day >= 25) {
    seeds.unshift('payday automation checklist');
  }

  return {
    source: 'seasonal-finance-calendar',
    status: 'fallback',
    summary: 'Use seasonal money moments without inventing exact limits or deadlines unless the post cites official sources.',
    topicSeeds: seeds,
    sourceUrls: [
      'https://www.canada.ca/en/revenue-agency/services/tax.html',
      'https://www.canada.ca/en/financial-consumer-agency.html',
    ],
  };
}

async function buildMarketEducationSignal(today: Date): Promise<ResearchSignalBrief> {
  const dayIndex = Math.floor(today.getTime() / 86_400_000);
  const focus = dayIndex % 3 === 0
    ? 'earnings and valuation checklist'
    : dayIndex % 3 === 1
      ? 'Canadian versus US stock research framework'
      : 'risk-first watchlist education';

  return {
    source: 'market-education-rotation',
    status: 'fallback',
    summary: 'Market content should be framed as research literacy, not picks. Rotate between catalysts, risks, valuation, portfolio fit, and earnings interpretation.',
    topicSeeds: [
      focus,
      'how to read a stock before adding it to a watchlist',
      'sector heat without buy/sell calls',
      'what a balance sheet tells beginners',
    ],
    sourceUrls: [
      'https://www.osc.ca/en/investors/investor-research-and-reports/social-media-and-retail-investing-rise-finfluencers',
      'https://www.ciro.ca/newsroom/publications/joint-canadian-securities-administrators-and-canadian-investment-regulatory-organization-staff',
    ],
  };
}

async function collectRedditApiSignal(): Promise<ResearchSignalBrief> {
  if (process.env.ENABLE_REDDIT_RESEARCH !== 'true') {
    return {
      source: 'reddit-api',
      status: 'disabled',
      summary: 'Reddit research is disabled. Set ENABLE_REDDIT_RESEARCH=true plus REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to use Reddit API data instead of unsupported scraping.',
      topicSeeds: [],
      sourceUrls: ['https://redditinc.com/policies/developer-terms'],
    };
  }

  const accessToken = await fetchRedditAccessToken();
  if (!accessToken) {
    return {
      source: 'reddit-api',
      status: 'disabled',
      summary: 'Reddit credentials are missing; continuing without Reddit signal.',
      topicSeeds: [],
      sourceUrls: ['https://redditinc.com/policies/developer-terms'],
    };
  }

  const subreddits = ['PersonalFinanceCanada', 'CanadianInvestor', 'investing', 'stocks'];
  const topicSeeds: string[] = [];
  const sourceUrls: string[] = [];

  for (const subreddit of subreddits) {
    try {
      const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/top?t=day&limit=8`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': getRedditUserAgent(),
        },
      });
      if (!response.ok) continue;
      const listing = await response.json() as RedditListing;
      for (const child of listing.data?.children || []) {
        const title = child.data?.title?.trim();
        if (!title || title.length < 12) continue;
        topicSeeds.push(title.slice(0, 140));
        if (child.data?.permalink) sourceUrls.push(`https://www.reddit.com${child.data.permalink}`);
      }
    } catch {
      continue;
    }
  }

  return {
    source: 'reddit-api',
    status: topicSeeds.length ? 'live' : 'fallback',
    summary: topicSeeds.length
      ? 'Reddit API signal collected from finance and investing communities; use only as directional demand, not as a copied post source.'
      : 'Reddit API returned no usable posts; continuing with fallback topic research.',
    topicSeeds: topicSeeds.slice(0, 16),
    sourceUrls: sourceUrls.slice(0, 8),
  };
}

async function fetchRedditAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': getRedditUserAgent(),
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  });

  if (!response.ok) return null;
  const json = await response.json() as { access_token?: string };
  return json.access_token || null;
}

function getRedditUserAgent(): string {
  return process.env.REDDIT_USER_AGENT || 'thestatsandstacks-content-research/1.0';
}

interface RedditListing {
  data?: {
    children?: Array<{
      data?: {
        title?: string;
        permalink?: string;
      };
    }>;
  };
}

function buildResearchBacklog(today: Date, signalBriefs: ResearchSignalBrief[]): ResearchCandidate[] {
  const month = today.getMonth();
  const day = today.getDate();
  const dayIndex = Math.floor(today.getTime() / 86_400_000);
  const seasonalBoost = getSeasonalBoost(month, day);
  const signalText = signalBriefs.flatMap((signal) => signal.topicSeeds).join(' ').toLowerCase();
  const candidates: ResearchCandidate[] = [
    {
      title: 'TFSA vs RRSP vs FHSA: Which Account Should Canadians Use First?',
      score: 0.84 + seasonalBoost.accountPlanning,
      reasoning: 'Evergreen Canadian account comparison with strong save/share intent and search demand.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 7,
      searchKeywords: ['TFSA vs RRSP', 'FHSA Canada', 'Canadian investing accounts'],
      contentPillar: 'Canadian account selection',
      freshnessSignal: 'Evergreen search demand with seasonal contribution-room relevance.',
      sourceUrls: [
        'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/tax-free-savings-account.html',
        'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/first-home-savings-account.html',
      ],
    },
    {
      title: 'The Canadian Payday Order of Operations',
      score: 0.82 + (day <= 5 || day >= 25 ? 0.06 : 0),
      reasoning: 'Payday routines are repeatable, saveable, and useful at the start/end of each month.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 8,
      searchKeywords: ['payday routine', 'budget checklist', 'Canadian personal finance'],
      contentPillar: 'Canadian money systems explained',
      freshnessSignal: 'Performs best near month start/end and pay cycles.',
      sourceUrls: ['https://www.canada.ca/en/financial-consumer-agency/services/budgeting.html'],
    },
    {
      title: '5 Money Leaks Quietly Keeping Canadians Broke',
      score: 0.8,
      reasoning: 'Mistake teardown posts create recognition and comments without becoming cheap engagement bait.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 7,
      searchKeywords: ['budgeting Canada', 'money leaks', 'personal finance Canada'],
      contentPillar: 'Money behavior and budgeting',
      freshnessSignal: 'High recognition value; useful when social signals mention bills, spending, or subscriptions.',
      sourceUrls: ['https://www.canada.ca/en/financial-consumer-agency/services/budgeting.html'],
    },
    {
      title: 'Credit Score Myths Canadians Still Believe',
      score: 0.78,
      reasoning: 'Myth/fact content is shareable and useful for younger Canadian finance audiences.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 7,
      searchKeywords: ['credit score Canada', 'credit myths', 'Canadian credit cards'],
      contentPillar: 'Credit education',
      freshnessSignal: 'Myth/fact content is shareable and repeatable without feeling like a daily duplicate.',
      sourceUrls: ['https://www.canada.ca/en/financial-consumer-agency/services/credit-reports-score.html'],
    },
    {
      title: 'HISA vs GIC vs ETF: Where Should Short-Term Money Go?',
      score: 0.79 + seasonalBoost.rateSensitivity,
      reasoning: 'Timeline frameworks help people choose tools without giving individualized recommendations.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 8,
      searchKeywords: ['HISA vs GIC', 'ETF Canada', 'short term savings Canada'],
      contentPillar: 'Saving and investing timeline',
      freshnessSignal: 'Rate-sensitive evergreen topic; useful when people compare cash yield and market risk.',
      sourceUrls: [
        'https://www.canada.ca/en/financial-consumer-agency/services/banking/bank-accounts/savings-account.html',
        'https://www.getsmarteraboutmoney.ca/invest/investment-products/gics/',
      ],
    },
    {
      title: 'Stock Watchlist Rule: 5 Checks Before You Buy Any Stock',
      score: 0.77 + (dayIndex % 6 === 0 ? 0.08 : 0),
      reasoning: 'Stock content can attract reach, but this keeps the post educational and avoids buy/sell recommendations.',
      suggestedFormat: 'WATCHLIST_EDUCATION',
      suggestedSlideCount: 8,
      searchKeywords: ['how to evaluate stocks', 'stock watchlist', 'investing checklist'],
      contentPillar: 'Stock education without recommendations',
      freshnessSignal: signalText.includes('stock') ? 'Social research signal mentioned stocks or investing.' : 'Evergreen stock literacy topic.',
      sourceUrls: [
        'https://www.osc.ca/en/investors/investor-research-and-reports/social-media-and-retail-investing-rise-finfluencers',
        'https://www.ciro.ca/newsroom/publications/joint-canadian-securities-administrators-and-canadian-investment-regulatory-organization-staff',
      ],
    },
    {
      title: 'Before Chasing a Hot Stock, Check These 4 Risks',
      score: 0.75 + (dayIndex % 9 === 0 ? 0.08 : 0),
      reasoning: 'Timely-feeling stock education is engaging while still warning against hype and concentration risk.',
      suggestedFormat: 'WATCHLIST_EDUCATION',
      suggestedSlideCount: 7,
      searchKeywords: ['stock risk checklist', 'hot stocks', 'investing risk'],
      contentPillar: 'Risk management',
      freshnessSignal: 'Timely-feeling without naming speculative picks or creating urgency.',
      sourceUrls: [
        'https://www.osc.ca/en/investors/investor-research-and-reports/social-media-and-retail-investing-rise-finfluencers',
        'https://www.ciro.ca/newsroom/publications/joint-canadian-securities-administrators-and-canadian-investment-regulatory-organization-staff',
      ],
    },
    {
      title: 'Canada/US Stock Watchlist: The 6-Point Research Screen',
      score: 0.8 + (signalText.includes('watchlist') || signalText.includes('stock') ? 0.05 : 0),
      reasoning: 'Gives the audience the stock content they want while keeping the post educational, risk-aware, and non-recommendational.',
      suggestedFormat: 'WATCHLIST_EDUCATION',
      suggestedSlideCount: 8,
      searchKeywords: ['Canada US stock watchlist', 'stock research checklist', 'how to research stocks'],
      contentPillar: 'Canadian/US market watchlist education',
      freshnessSignal: 'Balances follower demand for stock ideas with compliance-safe research process.',
      sourceUrls: [
        'https://www.ciro.ca/newsroom/publications/joint-canadian-securities-administrators-and-canadian-investment-regulatory-organization-staff',
        'https://www.finra.org/media-center/newsreleases/2026/finra-foundation-research-examines-characteristics-behaviors-outcomes',
      ],
    },
    {
      title: 'Earnings Season Cheat Sheet: What Beginners Should Check First',
      score: 0.78 + (signalText.includes('earnings') ? 0.08 : 0),
      reasoning: 'Earnings explainers feel timely, attract stock-curious followers, and avoid personalized advice.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 7,
      searchKeywords: ['earnings report explained', 'stock earnings checklist', 'beginner investing'],
      contentPillar: 'Market literacy',
      freshnessSignal: 'Useful during earnings-heavy periods and whenever market chatter increases.',
      sourceUrls: [
        'https://www.investor.gov/introduction-investing/investing-basics/how-stock-markets-work/public-companies',
      ],
    },
    {
      title: 'ETF or Individual Stock? A Simple Decision Filter',
      score: 0.79,
      reasoning: 'Decision filters are highly saveable and help beginners avoid concentration risk without dismissing stock interest.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 7,
      searchKeywords: ['ETF vs stocks', 'individual stocks vs ETFs', 'investing Canada'],
      contentPillar: 'Investing frameworks and account selection',
      freshnessSignal: 'Evergreen beginner-to-intermediate investing question.',
      sourceUrls: [
        'https://www.getsmarteraboutmoney.ca/invest/investment-products/etfs/',
        'https://www.getsmarteraboutmoney.ca/invest/investment-products/stocks/',
      ],
    },
    {
      title: 'Finfluencer Red Flags: 7 Phrases Investors Should Pause On',
      score: 0.82,
      reasoning: 'Highly shareable protective content that differentiates the brand as high-trust instead of hype-driven.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 7,
      searchKeywords: ['finfluencer red flags', 'investment scams social media', 'investing risk'],
      contentPillar: 'Investor protection',
      freshnessSignal: 'Regulators continue to warn about social-media-driven investing risk.',
      sourceUrls: [
        'https://www.osc.ca/en/investors/investor-research-and-reports/social-media-and-retail-investing-rise-finfluencers',
        'https://www.finra.org/media-center/newsreleases/2026/finra-foundation-research-examines-characteristics-behaviors-outcomes',
      ],
    },
    {
      title: 'Why the First $100K Feels So Slow for Canadian Investors',
      score: 0.83 + seasonalBoost.accountPlanning,
      reasoning: 'Milestone-based investing education has broad creator-market appeal, but this version turns it into a Canadian tracking framework instead of motivation-only content.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 7,
      searchKeywords: ['first 100k investing', 'compound growth Canada', 'beginner investing Canada'],
      contentPillar: 'Canadian investing behavior',
      freshnessSignal: 'Evergreen aspiration topic with high save/follow potential when framed as a checklist.',
      sourceUrls: [
        'https://www.getsmarteraboutmoney.ca/invest/investing-basics/compound-interest/',
        'https://www.canada.ca/en/financial-consumer-agency/services/savings-investments.html',
      ],
    },
    {
      title: 'The 10-Minute Portfolio Check Before Adding More Money',
      score: 0.81 + (signalText.includes('stock') || signalText.includes('market') ? 0.04 : 0),
      reasoning: 'A quick diagnostic format gives stock-curious followers a saveable process without telling them what to buy.',
      suggestedFormat: 'WATCHLIST_EDUCATION',
      suggestedSlideCount: 8,
      searchKeywords: ['portfolio check', 'investing checklist', 'risk management'],
      contentPillar: 'Risk management',
      freshnessSignal: 'Useful whenever market chatter increases because it slows decisions down.',
      sourceUrls: [
        'https://www.getsmarteraboutmoney.ca/invest/investing-basics/understanding-risk/',
        'https://www.osc.ca/en/investors/investor-research-and-reports/social-media-and-retail-investing-rise-finfluencers',
      ],
    },
  ];

  return candidates
    .sort((a, b) => b.score - a.score)
    .map((candidate, index) => ({
      ...candidate,
      score: Math.min(0.95, Number((candidate.score - index * 0.005).toFixed(3))),
    }));
}

function rankAndDedupeCandidates(
  candidates: ResearchCandidate[],
  history: ContentHistoryEntry[]
): ResearchCandidate[] {
  const seen = new Set<string>();
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: clampScore(candidate.score + growthScoreAdjustment(candidate) - noveltyPenalty(candidate.title, history)),
    }))
    .sort((a, b) => b.score - a.score)
    .filter((candidate) => {
      const key = normalizeTopic(candidate.title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

function sanitizeTrendCandidate(candidate: ResearchCandidate): ResearchCandidate {
  const title = candidate.title
    .replace(/\b(?:explodes|soars|surges|jumps|spikes|blasts off|moons)\s+[+-]?\d+(?:,\d{3})*(?:\.\d+)?%\s*(?:in|over)?\s*(?:1\s*day|today|ytd|1y|a year|a month)?\s*:?\s*/gi, '')
    .replace(/\b[+-]?\d+(?:,\d{3})*(?:\.\d+)?%\s*(?:up|gain|move|surge|jump|spike)\s*:?\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    ...candidate,
    title: title.length >= 18 ? title : candidate.title.replace(/\b(explodes|soars|surges|jumps|spikes|blasts off|moons)\b/gi, 'Heat Check'),
    reasoning: candidate.reasoning.replace(/\b(explodes|moons|blasts off)\b/gi, 'shows market heat'),
  };
}

function growthScoreAdjustment(candidate: ResearchCandidate): number {
  const text = [
    candidate.title,
    candidate.reasoning,
    candidate.contentPillar || '',
    candidate.freshnessSignal || '',
    ...(candidate.searchKeywords || []),
  ].join(' ').toLowerCase();

  let adjustment = 0;
  if (/\b(checklist|check|screen|filter|rule|framework|scorecard|cheat sheet|order of operations)\b/.test(text)) {
    adjustment += 0.035;
  }
  if (/\b(myth|mistake|red flag|risk|before|avoid|wrong)\b/.test(text)) {
    adjustment += 0.03;
  }
  if (/\b(tfsa|rrsp|fhsa|canadian|canada)\b/.test(text)) {
    adjustment += 0.02;
  }
  if (/\b(stock|market|earnings|portfolio|watchlist)\b/.test(text) && /\b(risk|research|check|screen|framework)\b/.test(text)) {
    adjustment += 0.025;
  }
  if (/\b(save|share|follow|beginner|simple)\b/.test(text)) {
    adjustment += 0.01;
  }
  if (/\b(best stocks to buy|hot picks|guaranteed|secret)\b/.test(text)) {
    adjustment -= 0.12;
  }

  return Number(adjustment.toFixed(3));
}

function clampScore(score: number): number {
  return Math.max(0.2, Math.min(0.96, Number(score.toFixed(3))));
}

function getSeasonalBoost(month: number, day: number): { accountPlanning: number; rateSensitivity: number } {
  return {
    accountPlanning: month <= 2 || (month === 11 && day >= 15) ? 0.08 : 0,
    rateSensitivity: month === 0 || month === 3 || month === 6 || month === 9 ? 0.04 : 0,
  };
}
