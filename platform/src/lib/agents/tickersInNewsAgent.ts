// platform/src/lib/agents/tickersInNewsAgent.ts
import { BaseAgent } from './interfaces';
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';

export interface TickerNewsEntry {
  symbol: string;
  name: string;
  headline: string;
  source: string;
  publishedAt: string;
  sentiment: -1 | 0 | 1;
}

export interface TickersInNewsResult {
  tickers: TickerNewsEntry[];
}

const RSS_FEEDS = [
  'https://feeds.reuters.com/reuters/businessNews',
  'https://www.cnbc.com/id/10001147/device/rss/rss.html',
];

const MAX_ARTICLES = 30;

export class TickersInNewsAgent extends BaseAgent {
  constructor() {
    super('TickersInNewsAgent');
  }

  async execute(_input: Record<string, never>): Promise<TickersInNewsResult> {
    console.log(`[${this.name}] 📰 Scanning news headlines for market tickers...`);
    const rawItems = await fetchRssHeadlines();
    if (!rawItems.length) {
      console.log(`   No headlines fetched; returning empty tickers list.`);
      return { tickers: [] };
    }
    return this.extractTickersWithGemini(rawItems.slice(0, MAX_ARTICLES));
  }

  private async extractTickersWithGemini(
    headlines: Array<{ title: string; source: string; pubDate: string }>,
  ): Promise<TickersInNewsResult> {
    let model: ReturnType<ReturnType<typeof getGeminiClient>['getGenerativeModel']>;
    try {
      model = getGeminiClient().getGenerativeModel({ model: getGeminiTextModelName() });
    } catch {
      console.warn(`[${this.name}] Gemini client unavailable (missing API key); returning empty tickers list.`);
      return { tickers: [] };
    }
    const headlineText = headlines.map((h, i) => `${i + 1}. [${h.source}] ${h.title}`).join('\n');
    const prompt = `You are a financial news analyst. Read these headlines and extract only tickers that have clear newsworthy events (earnings, M&A, product launch, regulatory action, unusual price movement).

Headlines:
${headlineText}

Rules:
- Include a ticker only if the headline is specifically about that company.
- sentiment must be exactly -1 (negative news), 0 (neutral/mixed), or 1 (positive news).
- Do NOT include buy/sell/hold recommendations.
- If no tickers have clear events, return an empty array.

Return a JSON object: { "tickers": [ { "symbol": "SNDK", "name": "SanDisk Corp.", "headline": "...", "source": "Reuters", "publishedAt": "...", "sentiment": 1 } ] }`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(text) as TickersInNewsResult;
      return { tickers: (parsed.tickers ?? []).filter(isValidEntry) };
    } catch {
      console.warn(`[${this.name}] Gemini extraction failed; returning empty tickers list.`);
      return { tickers: [] };
    }
  }
}

function isValidEntry(t: Partial<TickerNewsEntry>): t is TickerNewsEntry {
  return (
    typeof t.symbol === 'string' && t.symbol.length > 0 &&
    typeof t.headline === 'string' &&
    typeof t.source === 'string' &&
    [-1, 0, 1].includes(t.sentiment as number)
  );
}

async function fetchRssHeadlines(): Promise<Array<{ title: string; source: string; pubDate: string }>> {
  const results: Array<{ title: string; source: string; pubDate: string }> = [];
  for (const url of RSS_FEEDS) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) continue;
      const xml = await resp.text();
      const source = new URL(url).hostname.replace('www.', '');
      const titleMatches = xml.matchAll(/<title><!\[CDATA\[([^\]]+)]]><\/title>|<title>([^<]+)<\/title>/g);
      const pubDateMatches = xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g);
      const titles = [...titleMatches].map((m) => (m[1] ?? m[2]).trim()).filter(Boolean).slice(1);
      const dates = [...pubDateMatches].map((m) => m[1].trim());
      titles.forEach((t, i) => results.push({ title: t, source, pubDate: dates[i] ?? new Date().toISOString() }));
    } catch {
      // network errors are non-fatal
    }
  }
  return results;
}
