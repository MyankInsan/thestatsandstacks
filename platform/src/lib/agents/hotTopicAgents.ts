import { BaseAgent, TrendResearchResult } from './interfaces';
import {
  ContentHistoryEntry,
  normalizeTopic,
  noveltyPenalty,
} from '../services/contentHistory';

type TrendTopic = TrendResearchResult['topics'][number];
type ResearchSignalBrief = NonNullable<TrendResearchResult['signalBriefs']>[number];

interface HotTopicDeskInput {
  contentHistory?: ContentHistoryEntry[];
}

interface HotTopicAgentResult {
  candidates: TrendTopic[];
  signalBrief: ResearchSignalBrief;
}

interface MarketSnapshot {
  ticker: string;
  companyName: string;
  price: number;
  currency: string;
  dayChangePercent?: number;
  fiveDayChangePercent?: number;
  monthChangePercent?: number;
  ytdChangePercent?: number;
  oneYearChangePercent?: number;
  fromYearLowPercent?: number;
  volume?: number;
  quoteUrl: string;
}

interface MarketSeed {
  ticker: string;
  companyName: string;
  theme: string;
}

interface NewsItem {
  title: string;
  link: string;
  publisher?: string;
  publishedAt?: string;
}

const DEFAULT_MARKET_WATCHLIST: MarketSeed[] = [
  { ticker: 'PSTG', companyName: 'Pure Storage', theme: 'AI storage and all-flash data centers' },
  { ticker: 'WDC', companyName: 'Western Digital', theme: 'AI data storage' },
  { ticker: 'MU', companyName: 'Micron', theme: 'memory cycle and AI infrastructure' },
  { ticker: 'NVDA', companyName: 'Nvidia', theme: 'AI chips and market leadership' },
  { ticker: 'AVGO', companyName: 'Broadcom', theme: 'AI networking and semiconductors' },
  { ticker: 'AMD', companyName: 'AMD', theme: 'AI chips and competitive positioning' },
  { ticker: 'PLTR', companyName: 'Palantir', theme: 'AI software and valuation expectations' },
  { ticker: 'APP', companyName: 'AppLovin', theme: 'AI advertising and momentum' },
  { ticker: 'HOOD', companyName: 'Robinhood', theme: 'retail trading activity' },
  { ticker: 'COIN', companyName: 'Coinbase', theme: 'crypto market infrastructure' },
  { ticker: 'MSTR', companyName: 'MicroStrategy', theme: 'bitcoin balance-sheet exposure' },
  { ticker: 'SMCI', companyName: 'Super Micro Computer', theme: 'AI server demand and risk' },
  { ticker: 'TSLA', companyName: 'Tesla', theme: 'EV, autonomy, and retail investor attention' },
  { ticker: 'SOFI', companyName: 'SoFi', theme: 'consumer finance and growth expectations' },
  { ticker: 'RKLB', companyName: 'Rocket Lab', theme: 'space economy speculation' },
  { ticker: 'IONQ', companyName: 'IonQ', theme: 'quantum computing speculation' },
].slice(0, 18);

const FETCH_TIMEOUT_MS = 8_000;

interface IndexHighStatus {
  ticker: string;
  companyName: string;
  currentPrice: number;
  isNearAllTimeHigh: boolean;
  isAtAllTimeHigh: boolean;
  allTimeHigh: number;
  dayChangePercent: number;
}

const INDEX_SEEDS = [
  { ticker: '^GSPC', companyName: 'S&P 500' },
  { ticker: '^GSPTSE', companyName: 'S&P/TSX Composite' },
];

async function fetchIndexStatus(ticker: string, companyName: string): Promise<IndexHighStatus | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5y&interval=1d`;
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;
    const json = await response.json() as YahooChartResponse;
    const result = json.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const closes = (quote?.close || []).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (!result || closes.length < 10) return null;

    const currentPrice = result.meta?.regularMarketPrice || closes[closes.length - 1];
    const previousClose = closes[closes.length - 2] ?? currentPrice;
    const dayChangePercent = percentChange(currentPrice, previousClose) || 0;

    const fiveYearHigh = Math.max(...closes, currentPrice);

    const isAtAllTimeHigh = currentPrice >= fiveYearHigh * 0.995;
    const isNearAllTimeHigh = currentPrice >= fiveYearHigh * 0.985;

    return {
      ticker,
      companyName,
      currentPrice,
      isNearAllTimeHigh,
      isAtAllTimeHigh,
      allTimeHigh: fiveYearHigh,
      dayChangePercent,
    };
  } catch {
    return null;
  }
}

export class HotTopicDeskAgent extends BaseAgent {
  constructor() {
    super('HotTopicDeskAgent');
  }

  async execute(input?: HotTopicDeskInput): Promise<TrendResearchResult> {
    console.log(`[${this.name}] 🔥 Running hot-topic idea desk...`);
    const contentHistory = input?.contentHistory || [];
    const marketHeat = await new MarketHeatAgent().execute();
    const catalystNews = await new CatalystNewsAgent().execute({
      marketCandidates: marketHeat.candidates,
    });
    const formatIdeas = await new ViralFinanceFormatAgent().execute({
      marketCandidates: marketHeat.candidates,
      newsCandidates: catalystNews.candidates,
    });

    const topics = rankHotTopicCandidates([
      ...marketHeat.candidates,
      ...catalystNews.candidates,
      ...formatIdeas.candidates,
    ], contentHistory);

    console.log(`[${this.name}] ✅ Ranked ${topics.length} hot-topic ideas`);
    return {
      topics,
      signalBriefs: [
        marketHeat.signalBrief,
        catalystNews.signalBrief,
        formatIdeas.signalBrief,
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

export class MarketHeatAgent extends BaseAgent {
  constructor() {
    super('MarketHeatAgent');
  }

  async execute(): Promise<HotTopicAgentResult> {
    console.log(`[${this.name}] Scanning market heat from free quote data...`);
    const seeds = getMarketWatchlist();
    const settled = await Promise.allSettled(seeds.map((seed) => fetchMarketSnapshot(seed)));
    const snapshots = settled
      .filter((result): result is PromiseFulfilledResult<MarketSnapshot | null> => result.status === 'fulfilled')
      .map((result) => result.value)
      .filter((snapshot): snapshot is MarketSnapshot => Boolean(snapshot));

    const liveCandidates = snapshots
      .map((snapshot) => buildMarketHeatCandidate(snapshot))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const indexStatuses: IndexHighStatus[] = [];
    try {
      const settledIndices = await Promise.allSettled(
        INDEX_SEEDS.map((seed) => fetchIndexStatus(seed.ticker, seed.companyName))
      );
      for (const res of settledIndices) {
        if (res.status === 'fulfilled' && res.value) {
          indexStatuses.push(res.value);
        }
      }
    } catch (err) {
      console.warn(`[MarketHeatAgent] Failed to fetch index statuses:`, err);
    }

    const indexCandidates: TrendTopic[] = [];
    const now = new Date();
    const vancouverHour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Vancouver',
        hour: '2-digit',
        hour12: false,
      }).format(now),
    );
    const vancouverWeekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Vancouver',
      weekday: 'long',
    }).format(now);
    const isWeekday = vancouverWeekday !== 'Saturday' && vancouverWeekday !== 'Sunday';

    for (const snap of indexStatuses) {
      const isUS = snap.ticker === '^GSPC';
      
      if (snap.isNearAllTimeHigh || snap.isAtAllTimeHigh) {
        const title = isUS
          ? `S&P 500 Hits All-Time High: 5 Portfolio Rules for Investors (${snap.ticker})`
          : `TSX Hits Record Highs: What Canadian Investors Should Do (${snap.ticker})`;
        indexCandidates.push({
          title,
          score: snap.isAtAllTimeHigh ? 0.98 : 0.95,
          reasoning: `The ${snap.companyName} is trading at/near record highs (${snap.currentPrice.toFixed(0)} vs 5y high of ${snap.allTimeHigh.toFixed(0)}). High save intent topic on index rebalancing and retail FOMO.`,
          suggestedFormat: 'CAROUSEL',
          suggestedSlideCount: 7,
          searchKeywords: isUS ? ['SP500 all time high', 'S&P 500 record'] : ['TSX record high', 'investing Canada'],
          sourceUrls: [`https://finance.yahoo.com/quote/${snap.ticker}`],
          contentPillar: 'Global macro-economic news and political impacts on markets',
          freshnessSignal: `${snap.companyName} record high watch: ${snap.currentPrice.toFixed(0)}`,
        });
      }

      // Specific swing-change checks for S&P 500 (GSPC)
      if (isUS && isWeekday) {
        const absChange = Math.abs(snap.dayChangePercent);
        if (snap.dayChangePercent <= -1.0) {
          indexCandidates.push({
            title: `S&P 500 (${snap.ticker}) Drops ${absChange.toFixed(1)}%: What is Triggering the Market Today`,
            score: 0.98,
            reasoning: `The S&P 500 dropped ${absChange.toFixed(1)}% today. High priority reactive sentiment news topic on the market selloff.`,
            suggestedFormat: 'WATCHLIST_EDUCATION',
            suggestedSlideCount: 7,
            searchKeywords: ['S&P 500 drop', 'market selloff', 'why is market down'],
            sourceUrls: [`https://finance.yahoo.com/quote/${snap.ticker}`],
            contentPillar: 'Market-news explainers',
            freshnessSignal: `S&P 500 dropped ${absChange.toFixed(1)}%`,
          });
        } else if (snap.dayChangePercent >= 1.0) {
          indexCandidates.push({
            title: `S&P 500 (${snap.ticker}) Surges ${absChange.toFixed(1)}%: What is Triggering the Market Today`,
            score: 0.96,
            reasoning: `The S&P 500 surged ${absChange.toFixed(1)}% today. High priority reactive sentiment news topic on the market rally.`,
            suggestedFormat: 'WATCHLIST_EDUCATION',
            suggestedSlideCount: 7,
            searchKeywords: ['S&P 500 surge', 'market rally', 'why is market up'],
            sourceUrls: [`https://finance.yahoo.com/quote/${snap.ticker}`],
            contentPillar: 'Market-news explainers',
            freshnessSignal: `S&P 500 surged ${absChange.toFixed(1)}%`,
          });
        }
      }

      if (isWeekday && (Math.abs(snap.dayChangePercent) >= 0.5 || vancouverHour >= 13)) {
        const changeText = `${snap.dayChangePercent >= 0 ? '+' : ''}${snap.dayChangePercent.toFixed(2)}%`;
        const title = isUS
          ? `U.S. Market Close: How the S&P 500 (${snap.ticker}) Performed Today`
          : `Canadian Market Close: How the TSX (${snap.ticker}) Performed Today`;
        indexCandidates.push({
          title,
          score: 0.93 + (Math.abs(snap.dayChangePercent) >= 1.5 ? 0.04 : 0),
          reasoning: `The ${snap.companyName} closed the day at ${snap.currentPrice.toFixed(0)} (${changeText}). Direct, timely post-market overview.`,
          suggestedFormat: 'CAROUSEL',
          suggestedSlideCount: 7,
          searchKeywords: isUS ? ['S&P 500 close', 'market recap'] : ['TSX market close', 'Canadian market close'],
          sourceUrls: [`https://finance.yahoo.com/quote/${snap.ticker}`],
          contentPillar: 'Market-news explainers',
          freshnessSignal: `${snap.companyName} change today: ${changeText}`,
        });
      }
    }

    const candidates = [
      ...indexCandidates,
      ...(liveCandidates.length ? liveCandidates : getMarketFallbackCandidates()),
    ];

    const hottest = snapshots
      .sort((a, b) => getHeatScore(b) - getHeatScore(a))
      .slice(0, 5)
      .map((snapshot) => `${snapshot.companyName} (${snapshot.ticker}): ${buildMomentumLine(snapshot)}`);

    return {
      candidates,
      signalBrief: {
        source: 'market-heat-agent',
        status: (liveCandidates.length || indexCandidates.length) ? 'live' : 'fallback',
        summary: (liveCandidates.length || indexCandidates.length)
          ? `Free quote scan found active market heat. Indices: ${indexStatuses.map(s => `${s.companyName} ${s.dayChangePercent >= 0 ? '+' : ''}${s.dayChangePercent.toFixed(1)}%`).join(', ') || 'none'}. Top signals: ${hottest.join('; ')}.`
          : 'Free quote scan was unavailable; using safe fallback hot-market education ideas.',
        topicSeeds: candidates.map((candidate) => candidate.title),
        sourceUrls: unique(candidates.flatMap((candidate) => candidate.sourceUrls || [])).slice(0, 10),
      },
    };
  }
}

export class CatalystNewsAgent extends BaseAgent {
  constructor() {
    super('CatalystNewsAgent');
  }

  async execute(input: { marketCandidates: TrendTopic[] }): Promise<HotTopicAgentResult> {
    console.log(`[${this.name}] Mapping hot tickers to catalysts...`);
    const tickerSeeds = extractTickerSeeds(input.marketCandidates).slice(0, 6);
    const newsGroups = await Promise.all(tickerSeeds.map(async (seed) => ({
      seed,
      news: await fetchTickerNews(seed.ticker),
    })));

    const candidates = newsGroups
      .filter((group) => group.news.length > 0)
      .map((group) => buildCatalystCandidate(group.seed, group.news))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    return {
      candidates,
      signalBrief: {
        source: 'catalyst-news-agent',
        status: candidates.length ? 'live' : 'fallback',
        summary: candidates.length
          ? 'Recent finance headlines were converted into risk-first catalyst map ideas. Exact article claims should be summarized conservatively in the post copy.'
          : 'No live catalyst headlines were available; strategy can still use market heat and fallback ideas.',
        topicSeeds: candidates.map((candidate) => candidate.title),
        sourceUrls: unique(candidates.flatMap((candidate) => candidate.sourceUrls || [])).slice(0, 10),
      },
    };
  }
}

export class ViralFinanceFormatAgent extends BaseAgent {
  constructor() {
    super('ViralFinanceFormatAgent');
  }

  async execute(input: {
    marketCandidates: TrendTopic[],
    newsCandidates: TrendTopic[],
  }): Promise<HotTopicAgentResult> {
    console.log(`[${this.name}] Converting heat into saveable carousel formats...`);
    const sourceTopics = [...input.marketCandidates, ...input.newsCandidates];
    const candidates = sourceTopics.slice(0, 5).map((topic, index) => buildViralFormatCandidate(topic, index));

    return {
      candidates,
      signalBrief: {
        source: 'viral-finance-format-agent',
        status: candidates.length ? 'live' : 'fallback',
        summary: 'Turn hot-market attention into original carousel ideas: what happened, why it matters, what to watch, and what risk to respect. This mirrors high-performing trading-page clarity without copying their templates or giving trade calls.',
        topicSeeds: candidates.map((candidate) => candidate.title),
        sourceUrls: unique(candidates.flatMap((candidate) => candidate.sourceUrls || [])).slice(0, 10),
      },
    };
  }
}

async function fetchMarketSnapshot(seed: MarketSeed): Promise<MarketSnapshot | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(seed.ticker)}?range=1y&interval=1d`;
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;
    const json = await response.json() as YahooChartResponse;
    const result = json.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const closes = (quote?.close || []).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (!result || closes.length < 8) return null;

    const timestamps = result.timestamp || [];
    const lastClose = closes[closes.length - 1];
    const current = result.meta?.regularMarketPrice || lastClose;
    const previousClose = closes[Math.max(0, closes.length - 2)];
    const ytdClose = getFirstCloseForYear(closes, timestamps, new Date().getUTCFullYear());
    const yearLow = Math.min(...closes, current);

    return {
      ticker: seed.ticker,
      companyName: result.meta?.longName || result.meta?.shortName || seed.companyName,
      price: current,
      currency: result.meta?.currency || 'USD',
      dayChangePercent: percentChange(current, previousClose),
      fiveDayChangePercent: percentChange(current, closes[Math.max(0, closes.length - 6)]),
      monthChangePercent: percentChange(current, closes[Math.max(0, closes.length - 22)]),
      ytdChangePercent: ytdClose ? percentChange(current, ytdClose) : undefined,
      oneYearChangePercent: percentChange(current, closes[0]),
      fromYearLowPercent: percentChange(current, yearLow),
      volume: quote?.volume?.findLast((value) => typeof value === 'number') || undefined,
      quoteUrl: `https://finance.yahoo.com/quote/${seed.ticker}`,
    };
  } catch {
    return null;
  }
}

async function fetchTickerNews(ticker: string): Promise<NewsItem[]> {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(ticker)}&quotesCount=1&newsCount=5`;
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return [];
    const json = await response.json() as YahooSearchResponse;
    return (json.news || [])
      .filter((item): item is YahooNewsItem & { title: string; link: string } => Boolean(item.title && item.link))
      .slice(0, 5)
      .map((item) => ({
        title: cleanText(item.title),
        link: item.link,
        publisher: item.publisher,
        publishedAt: item.providerPublishTime
          ? new Date(item.providerPublishTime * 1000).toISOString()
          : undefined,
      }));
  } catch {
    return [];
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'thestatsandstacks-hot-topic-desk/1.0',
        Accept: 'application/json,text/plain,*/*',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildMarketHeatCandidate(snapshot: MarketSnapshot): TrendTopic {
  const isPureStorage = snapshot.ticker.toUpperCase() === 'PSTG' || /pure storage/i.test(snapshot.companyName);
  const title = isPureStorage
    ? 'Pure Storage (PSTG) AI Storage Heat Check: What the Move Actually Means'
    : `${snapshot.companyName} (${snapshot.ticker}) Heat Check: What the Move Actually Means`;

  return {
    title,
    score: clampScore(getHeatScore(snapshot)),
    reasoning: `${snapshot.companyName} is showing current market heat (${buildMomentumLine(snapshot)}). The post should use the attention as a case study: what happened, why the market cares, what to watch, and what risks can cool the story.`,
    suggestedFormat: 'WATCHLIST_EDUCATION',
    suggestedSlideCount: isPureStorage ? 8 : 7,
    searchKeywords: [
      `${snapshot.ticker} stock`,
      `${snapshot.companyName} stock`,
      'hot stock risk checklist',
      'market catalyst explained',
    ],
    sourceUrls: [snapshot.quoteUrl],
    contentPillar: 'Hot market education without recommendations',
    freshnessSignal: buildMomentumLine(snapshot),
  };
}

function buildCatalystCandidate(seed: MarketSeed, news: NewsItem[]): TrendTopic {
  const titleText = news.map((item) => item.title).join(' ');
  const earningsSignal = /earnings|revenue|guidance|margin|profit|sales/i.test(titleText);
  const aiSignal = /AI|data center|datacenter|chip|semiconductor|memory|storage/i.test(titleText);
  const title = earningsSignal
    ? `${seed.companyName} (${seed.ticker}) Earnings Heat Map: What Beginners Should Check`
    : aiSignal
      ? `${seed.companyName} (${seed.ticker}) AI Trade Case Study: Signal, Risk, Watchlist`
      : `${seed.companyName} (${seed.ticker}) Catalyst Map: What to Watch After the Headlines`;

  return {
    title,
    score: 0.88 + Math.min(0.06, news.length * 0.01),
    reasoning: `Recent headlines make ${seed.companyName} a useful education case study. Use the catalyst, then slow the viewer down with a risk map instead of a trade call.`,
    suggestedFormat: 'WATCHLIST_EDUCATION',
    suggestedSlideCount: 8,
    searchKeywords: [
      `${seed.ticker} news`,
      `${seed.companyName} earnings`,
      `${seed.companyName} stock`,
      'stock catalyst map',
    ],
    sourceUrls: unique(news.map((item) => item.link)).slice(0, 4),
    contentPillar: 'Market-news explainer',
    freshnessSignal: news.slice(0, 3).map((item) => item.title).join(' | '),
  };
}

function buildViralFormatCandidate(topic: TrendTopic, index: number): TrendTopic {
  const sourceTitle = topic.title.replace(/\s+/g, ' ').trim();
  const formatTitle = index % 2 === 0
    ? `${sourceTitle}: The 5-Question Risk Filter`
    : `${sourceTitle}: What Smart Investors Check Before Reacting`;

  return {
    ...topic,
    title: formatTitle,
    score: clampScore(topic.score - 0.015 + index * 0.002),
    reasoning: `${topic.reasoning} Reframed into a high-retention carousel pattern: hook, context, risk filter, catalyst map, watchlist checklist, and saveable final slide.`,
    suggestedFormat: 'WATCHLIST_EDUCATION',
    suggestedSlideCount: Math.max(7, Math.min(8, topic.suggestedSlideCount || 8)),
    searchKeywords: unique([...(topic.searchKeywords || []), 'stock risk filter', 'investing checklist']),
    contentPillar: topic.contentPillar || 'Hot market education without recommendations',
  };
}

function getMarketFallbackCandidates(): TrendTopic[] {
  return [
    {
      title: 'Pure Storage (PSTG) AI Storage Heat Check: What the Move Actually Means',
      score: 0.91,
      reasoning: 'Pure Storage has been a high-attention market story around AI data-center storage and memory pricing. Use it as a research case study, not a recommendation.',
      suggestedFormat: 'WATCHLIST_EDUCATION',
      suggestedSlideCount: 8,
      searchKeywords: ['PSTG stock', 'Pure Storage stock', 'AI storage stocks', 'hot stock risk checklist'],
      sourceUrls: ['https://finance.yahoo.com/quote/PSTG'],
      contentPillar: 'Hot market education without recommendations',
      freshnessSignal: 'Fallback seed: verify live price and catalyst details before using exact performance numbers.',
    },
    {
      title: 'Before Chasing a Hot Stock, Check These 4 Risks',
      score: 0.88,
      reasoning: 'Hot-stock education matches trading-page attention while keeping TheStatsAndStacks safer and more trustworthy.',
      suggestedFormat: 'WATCHLIST_EDUCATION',
      suggestedSlideCount: 7,
      searchKeywords: ['hot stocks', 'stock risk checklist', 'investing mistakes'],
      sourceUrls: ['https://www.osc.ca/en/investors/investor-research-and-reports/social-media-and-retail-investing-rise-finfluencers'],
      contentPillar: 'Risk management',
      freshnessSignal: 'Always relevant when market chatter is high.',
    },
  ];
}

function getMarketWatchlist(): MarketSeed[] {
  const custom = (process.env.HOT_TOPIC_WATCHLIST || '')
    .split(',')
    .map((ticker) => ticker.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 24);

  if (!custom.length) return DEFAULT_MARKET_WATCHLIST;
  const defaults = new Map(DEFAULT_MARKET_WATCHLIST.map((seed) => [seed.ticker, seed]));
  return custom.map((ticker) => defaults.get(ticker) || {
    ticker,
    companyName: ticker,
    theme: 'market heat',
  });
}

export function extractTickerSeeds(candidates: TrendTopic[]): MarketSeed[] {
  const seeds: MarketSeed[] = [];
  for (const candidate of candidates) {
    const match = candidate.title.match(/\((\^?[A-Z0-9\-\.\=]{1,8})\)/);
    if (!match) continue;
    const ticker = match[1];
    seeds.push({
      ticker,
      companyName: candidate.title.split(`(${ticker})`)[0].trim(),
      theme: candidate.contentPillar || 'market heat',
    });
  }
  return uniqueBy(seeds, (seed) => seed.ticker);
}

function rankHotTopicCandidates(candidates: TrendTopic[], history: ContentHistoryEntry[]): TrendTopic[] {
  const seen = new Set<string>();
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: clampScore(candidate.score - noveltyPenalty(candidate.title, history)),
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

function getHeatScore(snapshot: MarketSnapshot): number {
  let score = 0.7;
  score += bounded((snapshot.dayChangePercent || 0) / 100, -0.04, 0.08);
  score += bounded((snapshot.fiveDayChangePercent || 0) / 100, -0.05, 0.08);
  score += bounded((snapshot.monthChangePercent || 0) / 140, -0.04, 0.1);
  score += bounded((snapshot.ytdChangePercent || 0) / 900, -0.03, 0.18);
  score += bounded((snapshot.oneYearChangePercent || 0) / 1600, -0.02, 0.18);
  score += bounded((snapshot.fromYearLowPercent || 0) / 5000, 0, 0.16);
  return score;
}

function buildMomentumLine(snapshot: MarketSnapshot): string {
  const parts = [
    formatPercent(snapshot.dayChangePercent, '1D'),
    formatPercent(snapshot.fiveDayChangePercent, '5D'),
    formatPercent(snapshot.monthChangePercent, '1M'),
    formatPercent(snapshot.ytdChangePercent, 'YTD'),
    formatPercent(snapshot.oneYearChangePercent, '1Y'),
    formatPercent(snapshot.fromYearLowPercent, 'from 52-week low'),
  ].filter(Boolean);

  return parts.length ? parts.join(', ') : `latest quote ${snapshot.currency} ${snapshot.price.toFixed(2)}`;
}

function formatPercent(value: number | undefined, label: string): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `${label} ${value >= 0 ? '+' : ''}${value.toFixed(Math.abs(value) >= 100 ? 0 : 1)}%`;
}

function getFirstCloseForYear(closes: number[], timestamps: number[], year: number): number | null {
  for (let index = 0; index < timestamps.length && index < closes.length; index++) {
    if (new Date(timestamps[index] * 1000).getUTCFullYear() === year) {
      return closes[index] || null;
    }
  }
  return null;
}

function percentChange(current: number, previous: number | undefined): number | undefined {
  if (!previous || !Number.isFinite(previous) || previous <= 0) return undefined;
  return ((current - previous) / previous) * 100;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function bounded(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampScore(score: number): number {
  return Math.max(0.2, Math.min(0.98, Number(score.toFixed(3))));
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        currency?: string;
        shortName?: string;
        longName?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
}

interface YahooSearchResponse {
  news?: YahooNewsItem[];
}

interface YahooNewsItem {
  title?: string;
  link?: string;
  publisher?: string;
  providerPublishTime?: number;
}
