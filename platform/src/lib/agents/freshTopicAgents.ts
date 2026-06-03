import { BaseAgent, TrendResearchResult } from './interfaces';
import { parseFeed, isWithinHours } from '../services/rssParse';

/**
 * Fresh-topic collectors that feed the hot-topic desk with VERIFIED, recent,
 * US-weighted signals the pipeline was missing: crypto moves (CoinGecko), a 24h
 * finance-news digest (RSS), and new IPO filings (SEC EDGAR). All are free +
 * keyless, fail soft (never break a run), and frame everything as education with
 * no buy/sell/hold calls. Each returns the same shape the market-heat desk uses.
 */

type TrendTopic = TrendResearchResult['topics'][number];
type ResearchSignalBrief = NonNullable<TrendResearchResult['signalBriefs']>[number];

export interface FreshTopicAgentResult {
  candidates: TrendTopic[];
  signalBrief: ResearchSignalBrief;
}

const FETCH_TIMEOUT_MS = 8_000;
const FRESH_WINDOW_HOURS = 48;

// ── Crypto heat (CoinGecko, keyless) ─────────────────────────────────────────

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  price_change_percentage_24h: number | null;
  market_cap_rank: number | null;
}

export class CryptoHeatAgent extends BaseAgent {
  constructor() {
    super('CryptoHeatAgent');
  }

  async execute(): Promise<FreshTopicAgentResult> {
    console.log(`[${this.name}] Scanning crypto heat (CoinGecko, keyless)...`);
    const markets = await fetchCoinGeckoMarkets();

    if (markets.length === 0) {
      return {
        candidates: [cryptoLiteracyFallback()],
        signalBrief: brief('crypto-heat-agent', 'fallback',
          'CoinGecko was unavailable (often rate-limited from shared IPs); using evergreen crypto-literacy fallback.',
          ['Bitcoin basics', 'crypto risk'],
          ['https://www.coingecko.com']),
      };
    }

    const movers = markets
      .filter((m) => typeof m.price_change_percentage_24h === 'number' && Math.abs(m.price_change_percentage_24h!) >= 5)
      .sort((a, b) => Math.abs(b.price_change_percentage_24h!) - Math.abs(a.price_change_percentage_24h!))
      .slice(0, 4);

    const candidates: TrendTopic[] = movers.map((m) => buildCryptoMoverCandidate(m));
    if (candidates.length === 0) {
      // No big movers — still surface a steady BTC/ETH "what to watch" + literacy.
      candidates.push(cryptoLiteracyFallback());
    }

    return {
      candidates,
      signalBrief: brief('crypto-heat-agent', candidates.length ? 'live' : 'fallback',
        movers.length
          ? `Crypto movers (24h): ${movers.map((m) => `${m.name} ${fmtPct(m.price_change_percentage_24h)}`).join(', ')}.`
          : 'No large crypto moves; using steady crypto education.',
        candidates.map((c) => c.title),
        unique(candidates.flatMap((c) => c.sourceUrls ?? [])).slice(0, 10)),
    };
  }
}

function buildCryptoMoverCandidate(m: CoinGeckoMarket): TrendTopic {
  const pct = m.price_change_percentage_24h ?? 0;
  const up = pct >= 0;
  // No exact % and no hype verbs in titles (brand + compliance rules).
  const title = up
    ? `${m.name} Heat Check: What's Behind the Crypto Move and the Risks`
    : `${m.name} Pulls Back: What's Driving the Move and How to Weigh the Risk`;
  return {
    title,
    score: clampScore(0.9 + Math.min(0.06, Math.abs(pct) / 200)),
    reasoning: `${m.name} (${m.symbol.toUpperCase()}) is a current crypto mover (24h ${fmtPct(pct)}). Use the attention as education: what is moving it, what to watch next, and the risks — never a buy/sell call.`,
    suggestedFormat: 'WATCHLIST_EDUCATION',
    suggestedSlideCount: 7,
    searchKeywords: [`${m.name} price`, `${m.symbol.toUpperCase()} crypto`, 'crypto risk', 'crypto news'],
    sourceUrls: [`https://www.coingecko.com/en/coins/${m.id}`],
    contentPillar: 'Crypto moves and risk',
    freshnessSignal: `${m.name} 24h move: ${fmtPct(pct)}`,
  };
}

function cryptoLiteracyFallback(): TrendTopic {
  return {
    title: 'Bitcoin Basics: 5 Things Beginners Get Wrong',
    score: 0.84,
    reasoning: 'Crypto literacy captures attention while staying risk-first and educational (no price targets, no buy/sell).',
    suggestedFormat: 'CAROUSEL',
    suggestedSlideCount: 7,
    searchKeywords: ['bitcoin basics', 'crypto for beginners', 'crypto risk'],
    sourceUrls: ['https://www.investor.gov/introduction-investing/investing-basics/glossary/crypto-assets'],
    contentPillar: 'Crypto literacy and risk',
    freshnessSignal: 'Evergreen crypto literacy; spikes on any major BTC/ETH move.',
  };
}

async function fetchCoinGeckoMarkets(): Promise<CoinGeckoMarket[]> {
  const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&price_change_percentage=24h';
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const json = await res.json() as unknown;
    if (!Array.isArray(json)) return [];
    return (json as CoinGeckoMarket[]).filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string');
  } catch {
    return [];
  }
}

// ── 24h finance-news digest (RSS, keyless) ───────────────────────────────────

const NEWS_FEEDS = [
  'https://www.cnbc.com/id/100003114/device/rss/rss.html',          // CNBC markets
  'https://feeds.marketwatch.com/marketwatch/topstories/',          // MarketWatch top stories
  'https://www.nasdaq.com/feed/rssoutbound?category=Markets',       // Nasdaq markets
  'https://www.coindesk.com/arc/outboundfeeds/rss/',                // CoinDesk (crypto)
  'https://news.google.com/rss/search?q=stock%20market%20when:1d&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=(Nvidia%20OR%20Tesla%20OR%20Apple%20OR%20Microsoft%20OR%20Amazon)%20stock%20when:1d&hl=en-US&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=(IPO%20OR%20crypto%20OR%20earnings)%20when:1d&hl=en-US&gl=US&ceid=US:en',
];

const MARQUEE: Array<{ name: string; re: RegExp }> = [
  { name: 'Nvidia', re: /\bnvidia\b|\bnvda\b/i },
  { name: 'Tesla', re: /\btesla\b|\btsla\b/i },
  { name: 'Apple', re: /\bapple\b|\baapl\b/i },
  { name: 'Microsoft', re: /\bmicrosoft\b|\bmsft\b/i },
  { name: 'Amazon', re: /\bamazon\b|\bamzn\b/i },
  { name: 'Meta', re: /\bmeta\b|\bfacebook\b/i },
  { name: 'Alphabet', re: /\balphabet\b|\bgoogle\b|\bgoogl\b/i },
  { name: 'OpenAI', re: /\bopenai\b/i },
  { name: 'Bitcoin', re: /\bbitcoin\b|\bbtc\b/i },
  { name: 'the S&P 500', re: /\bs&p 500\b|\bs&p500\b/i },
  { name: 'the Nasdaq', re: /\bnasdaq\b/i },
  { name: 'the Fed', re: /\bfederal reserve\b|\bthe fed\b|\bfomc\b/i },
];

interface Headline { title: string; link: string; publishedAt?: string; }

export class NewsRssAgent extends BaseAgent {
  constructor() {
    super('NewsRssAgent');
  }

  async execute(): Promise<FreshTopicAgentResult> {
    console.log(`[${this.name}] Pulling 24h finance-news digest (RSS)...`);
    const settled = await Promise.allSettled(NEWS_FEEDS.map((u) => fetchFeed(u)));
    const all: Headline[] = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

    // Prefer fresh (<48h) items; if none carry dates, keep the lot.
    const dated = all.filter((h) => isWithinHours(h.publishedAt, FRESH_WINDOW_HOURS));
    const pool = dedupeByTitle(dated.length ? dated : all)
      .sort((a, b) => (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0))
      .slice(0, 20);

    if (pool.length === 0) {
      return {
        candidates: [],
        signalBrief: brief('news-rss-desk', 'fallback',
          'No live finance headlines were available; the desk will rely on market-heat and evergreen signals.',
          [], []),
      };
    }

    const pressLinks = pool.filter((h) => !/news\.google\.com/i.test(h.link));
    const digest: TrendTopic = {
      title: 'What Happened in the Markets in the Last 24 Hours',
      score: 0.91,
      reasoning: 'A risk-first recap of the day in markets: the few headlines that mattered, why, and what to watch next. High save/share intent and reliably timely.',
      suggestedFormat: 'CAROUSEL',
      suggestedSlideCount: 7,
      searchKeywords: ['stock market today', 'market recap', 'finance news today', 'what happened in markets'],
      sourceUrls: (pressLinks.length ? pressLinks : pool).slice(0, 4).map((h) => h.link),
      contentPillar: 'Breaking US market news',
      freshnessSignal: `24h recap built from ${pool.length} fresh headlines`,
    };

    const marqueeCandidates = buildMarqueeCandidates(pool).slice(0, 3);

    return {
      candidates: [digest, ...marqueeCandidates],
      signalBrief: brief('news-rss-desk', 'live',
        `Top finance headlines (24h): ${pool.slice(0, 6).map((h) => h.title).join(' | ')}`,
        pool.slice(0, 12).map((h) => h.title),
        pool.slice(0, 10).map((h) => h.link)),
    };
  }
}

function buildMarqueeCandidates(pool: Headline[]): TrendTopic[] {
  const out: TrendTopic[] = [];
  const used = new Set<string>();
  for (const m of MARQUEE) {
    if (used.has(m.name)) continue;
    const hit = pool.find((h) => m.re.test(h.title));
    if (!hit) continue;
    used.add(m.name);
    out.push({
      title: `${m.name} in the News: What Happened and What to Watch`,
      score: 0.88,
      reasoning: `A fresh headline put ${m.name} in focus. Turn the attention into education: what happened, why it matters, what to watch next, and the risks — no buy/sell call.`,
      suggestedFormat: 'WATCHLIST_EDUCATION',
      suggestedSlideCount: 7,
      searchKeywords: [`${m.name} news`, `${m.name} stock`, 'market news today'],
      sourceUrls: [hit.link],
      contentPillar: 'Market-news explainer',
      freshnessSignal: hit.title,
    });
  }
  return out;
}

async function fetchFeed(url: string): Promise<Headline[]> {
  try {
    const res = await fetchWithTimeout(url, 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*');
    if (!res.ok) return [];
    const xml = await res.text();
    return parseFeed(xml, 25).map((i) => ({ title: i.title, link: i.link, publishedAt: i.publishedAt }));
  } catch {
    return [];
  }
}

// ── New IPO filings (SEC EDGAR full-text search, keyless) ─────────────────────

interface EdgarHit {
  _id?: string;
  _source?: {
    ciks?: string[];
    display_names?: string[];
    file_date?: string;
    root_forms?: string[];
    file_type?: string;
  };
}

export class IpoFilingsAgent extends BaseAgent {
  constructor() {
    super('IpoFilingsAgent');
  }

  async execute(now: Date = new Date()): Promise<FreshTopicAgentResult> {
    console.log(`[${this.name}] Checking recent IPO (S-1) filings (SEC EDGAR)...`);
    const hits = await fetchRecentS1Filings(now);

    if (hits.length === 0) {
      return {
        candidates: [ipoLiteracyFallback()],
        signalBrief: brief('ipo-filings-agent', 'fallback',
          'SEC EDGAR returned no recent S-1 filings (or was unavailable); using evergreen IPO-literacy fallback.',
          ['how to read an S-1', 'IPO basics'],
          ['https://www.sec.gov/cgi-bin/srqsb?text=form-type%3DS-1']),
      };
    }

    const candidates = hits.slice(0, 3).map((h) => buildIpoCandidate(h));
    return {
      candidates,
      signalBrief: brief('ipo-filings-agent', 'live',
        `Recent S-1 / IPO filings: ${candidates.map((c) => c.freshnessSignal).join(' | ')}`,
        candidates.map((c) => c.title),
        unique(candidates.flatMap((c) => c.sourceUrls ?? [])).slice(0, 10)),
    };
  }
}

function buildIpoCandidate(hit: EdgarHit): TrendTopic {
  const display = hit._source?.display_names?.[0] ?? 'A company';
  const company = display.replace(/\s*\(.*?\)\s*$/, '').trim() || 'A company';
  const cik = hit._source?.ciks?.[0];
  const date = hit._source?.file_date ?? '';
  const sourceUrl = cik
    ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=S-1&dateb=&owner=include&count=40`
    : 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=S-1';
  return {
    title: `New IPO Filing: ${company} Filed to Go Public — What It Means`,
    score: 0.89,
    reasoning: `${company} filed an S-1 (registration to go public). Explain what an S-1 is, what the filing reveals, what to watch on the road to listing, and the risks of buying IPOs — never a recommendation.`,
    suggestedFormat: 'CAROUSEL',
    suggestedSlideCount: 7,
    searchKeywords: [`${company} IPO`, `${company} S-1`, 'IPO explained', 'new IPO filing'],
    sourceUrls: [sourceUrl],
    contentPillar: 'IPO and filing news',
    freshnessSignal: `${company} S-1${date ? ` filed ${date}` : ''}`,
  };
}

function ipoLiteracyFallback(): TrendTopic {
  return {
    title: 'How to Read an IPO Filing (S-1) Before You Get Excited',
    score: 0.82,
    reasoning: 'IPO literacy is timely whenever a notable company files, and stays educational and risk-first.',
    suggestedFormat: 'CAROUSEL',
    suggestedSlideCount: 7,
    searchKeywords: ['how to read an S-1', 'IPO basics', 'IPO risk'],
    sourceUrls: ['https://www.investor.gov/introduction-investing/investing-basics/glossary/initial-public-offering-ipo'],
    contentPillar: 'IPO and filing news',
    freshnessSignal: 'Evergreen IPO literacy; pairs with any fresh S-1 filing.',
  };
}

async function fetchRecentS1Filings(now: Date): Promise<EdgarHit[]> {
  const end = isoDate(now);
  const start = isoDate(new Date(now.getTime() - 7 * 86_400_000));
  const url = `https://efts.sec.gov/LATEST/search-index?q=%22initial+public+offering%22&forms=S-1&startdt=${start}&enddt=${end}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const json = await res.json() as { hits?: { hits?: EdgarHit[] } };
    const hits = json?.hits?.hits;
    if (!Array.isArray(hits)) return [];
    return hits.filter((h) => Boolean(h?._source?.display_names?.length));
  } catch {
    return [];
  }
}

// ── shared helpers ───────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, accept = 'application/json,text/plain,*/*'): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        // SEC fair-access + general politeness: descriptive UA.
        'User-Agent': 'thestatsandstacks-fresh-topic-desk/1.0 (contact: research@thestatsandstacks)',
        Accept: accept,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function dedupeByTitle(items: Headline[]): Headline[] {
  const seen = new Set<string>();
  const out: Headline[] = [];
  for (const it of items) {
    const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function brief(
  source: string,
  status: ResearchSignalBrief['status'],
  summary: string,
  topicSeeds: string[],
  sourceUrls: string[],
): ResearchSignalBrief {
  return { source, status, summary, topicSeeds, sourceUrls };
}

function fmtPct(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'n/a';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function clampScore(score: number): number {
  return Math.max(0.2, Math.min(0.98, Number(score.toFixed(3))));
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
