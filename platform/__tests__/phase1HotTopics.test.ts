import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  inferTopicFamily,
  familyCooldownPenalty,
  topicEngagementAdjustment,
} from '../src/lib/agents/topicScoring';
import {
  classifySourceTier,
  bestSourceTier,
  verifyTopicSources,
  computeReviewFlags,
} from '../src/lib/agents/researchEvidenceGate';
import { CryptoHeatAgent, NewsRssAgent, IpoFilingsAgent } from '../src/lib/agents/freshTopicAgents';
import { ComplianceQAAgent } from '../src/lib/agents/complianceQAAgent';
import type { StrategyDecision } from '../src/lib/agents/contentStrategyAgent';
import type { ContentHistoryEntry } from '../src/lib/services/contentHistory';

function entry(date: string, topicFamily: string): ContentHistoryEntry {
  return { date, topic: 't', hook: 'h', format: 'CAROUSEL', slideCount: 7, keywords: [], topicFamily };
}

// ── inferTopicFamily ──────────────────────────────────────────────────────────

test('inferTopicFamily classifies the key lanes', () => {
  assert.equal(inferTopicFamily('TFSA vs RRSP vs FHSA: Which Account Should You Use First?'), 'ACCT_COMPARISON');
  assert.equal(inferTopicFamily('401(k) vs Roth IRA: Which First?'), 'ACCT_COMPARISON');
  assert.equal(inferTopicFamily("Bitcoin Heat Check: What's Behind the Move"), 'CRYPTO');
  assert.equal(inferTopicFamily('New IPO Filing: Acme Filed to Go Public'), 'IPO');
  assert.equal(inferTopicFamily('S&P 500 (^GSPC) Drops 1.9%: What is Triggering the Market'), 'INDEX_MOVE');
  assert.equal(inferTopicFamily('Nvidia (NVDA) Earnings Heat Map'), 'SINGLE_STOCK');
  assert.equal(inferTopicFamily('Credit Score Myths People Still Believe'), 'CREDIT');
  assert.equal(inferTopicFamily('How a Fed Rate Decision Moves Your Portfolio'), 'MACRO');
  assert.equal(inferTopicFamily('What $10,000 in the S&P 500 Became Over 20 Years'), 'HYPOTHETICAL_RETURN');
});

// ── familyCooldownPenalty ─────────────────────────────────────────────────────

test('evergreen families get a ~21-day cooldown; timely families a short one', () => {
  const today = '2026-06-03';
  // Evergreen ACCT used 5 days ago → penalized; 25 days ago → clear.
  assert.ok(familyCooldownPenalty('ACCT_COMPARISON', [entry('2026-05-29', 'ACCT_COMPARISON')], today) > 0);
  assert.equal(familyCooldownPenalty('ACCT_COMPARISON', [entry('2026-05-09', 'ACCT_COMPARISON')], today), 0);

  // Timely INDEX_MOVE used 5 days ago → clear (short cooldown); 1 day ago → penalized.
  assert.equal(familyCooldownPenalty('INDEX_MOVE', [entry('2026-05-29', 'INDEX_MOVE')], today), 0);
  assert.ok(familyCooldownPenalty('INDEX_MOVE', [entry('2026-06-02', 'INDEX_MOVE')], today) > 0);

  // GENERAL never penalized.
  assert.equal(familyCooldownPenalty('GENERAL', [entry('2026-06-03', 'GENERAL')], today), 0);
});

test('cooldown derives family from topic text when the field is absent', () => {
  const today = '2026-06-03';
  const legacy: ContentHistoryEntry = {
    date: '2026-05-30', topic: 'TFSA vs RRSP vs FHSA explained', hook: '', format: 'CAROUSEL', slideCount: 7, keywords: [],
  };
  assert.ok(familyCooldownPenalty('ACCT_COMPARISON', [legacy], today) > 0);
});

// ── topicEngagementAdjustment ─────────────────────────────────────────────────

test('engagement adjustment rewards trusted+timely and penalizes aggregated', () => {
  const base = { history: [] as ContentHistoryEntry[], today: '2026-06-03' };
  const official = topicEngagementAdjustment({
    ...base, title: 'New IPO Filing: Acme Filed to Go Public', sourceUrls: ['https://www.sec.gov/x'], freshnessSignal: 'Acme S-1 filed 2026-06-02',
  });
  assert.ok(official > 0.05, `official+timely should be strongly positive, got ${official}`);

  const aggregated = topicEngagementAdjustment({
    ...base, title: 'Some rumor', sourceUrls: ['https://www.reddit.com/r/x/y'],
  });
  assert.ok(aggregated < 0, `aggregated-only should be negative, got ${aggregated}`);
});

// ── source tiers + verification ───────────────────────────────────────────────

test('classifySourceTier maps hosts to tiers', () => {
  assert.equal(classifySourceTier('https://www.sec.gov/x'), 'OFFICIAL');
  assert.equal(classifySourceTier('https://www.federalreserve.gov/x'), 'OFFICIAL');
  assert.equal(classifySourceTier('https://finance.yahoo.com/quote/AAPL'), 'MARKET_DATA');
  assert.equal(classifySourceTier('https://api.coingecko.com/x'), 'MARKET_DATA');
  assert.equal(classifySourceTier('https://www.cnbc.com/x'), 'REPUTABLE_PRESS');
  assert.equal(classifySourceTier('https://www.reddit.com/r/x'), 'AGGREGATED');
  assert.equal(classifySourceTier('https://news.google.com/rss/x'), 'AGGREGATED');
  assert.equal(classifySourceTier('https://example.com/x'), 'UNKNOWN');
  assert.equal(classifySourceTier('not a url'), 'UNKNOWN');
});

test('verifyTopicSources labels VERIFIED / DEVELOPING / RUMOR + flags', () => {
  assert.equal(verifyTopicSources({ sourceUrls: ['https://www.sec.gov/x'] }).status, 'VERIFIED');
  assert.equal(verifyTopicSources({ sourceUrls: ['https://www.cnbc.com/x'], pressCorroboration: 1 }).status, 'DEVELOPING');
  assert.equal(verifyTopicSources({ sourceUrls: ['https://www.cnbc.com/a', 'https://www.marketwatch.com/b'], pressCorroboration: 2 }).status, 'VERIFIED');

  const rumor = verifyTopicSources({ sourceUrls: ['https://www.reddit.com/x'] });
  assert.equal(rumor.status, 'RUMOR');
  assert.ok(rumor.flags.includes('RUMOR_SINGLE_SOURCE'));
  assert.ok(rumor.flags.includes('MANUAL_REVIEW_REQUIRED'));

  const none = verifyTopicSources({ sourceUrls: [] });
  assert.ok(none.flags.includes('UNCORROBORATED'));

  const stale = verifyTopicSources({
    sourceUrls: ['https://finance.yahoo.com/x'],
    publishedAt: '2026-05-01T00:00:00Z',
    expectsFresh: true,
  });
  assert.ok(stale.flags.includes('STALE_SIGNAL'));
});

test('computeReviewFlags flags aggregated-only topics as rumors', () => {
  const flags = computeReviewFlags({ topic: 'Some claim', sourceUrls: ['https://www.reddit.com/x'] });
  assert.ok(flags.includes('RUMOR_SINGLE_SOURCE'));
  assert.equal(bestSourceTier(['https://www.sec.gov/x', 'https://www.reddit.com/y']), 'OFFICIAL');
});

// ── collectors (mocked fetch) ─────────────────────────────────────────────────

function withMockFetch(handler: (url: string) => { ok: boolean; json?: () => Promise<unknown>; text?: () => Promise<string> }, fn: () => Promise<void>) {
  return async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => handler(url.toString())) as unknown as typeof fetch;
    try { await fn(); } finally { globalThis.fetch = original; }
  };
}

test('CryptoHeatAgent builds mover candidates without exact % or hype in titles', withMockFetch(
  () => ({
    ok: true,
    json: async () => ([
      { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 60000, price_change_percentage_24h: 7.5, market_cap_rank: 1 },
      { id: 'ethereum', symbol: 'eth', name: 'Ethereum', current_price: 3000, price_change_percentage_24h: -6.2, market_cap_rank: 2 },
      { id: 'tether', symbol: 'usdt', name: 'Tether', current_price: 1, price_change_percentage_24h: 0.1, market_cap_rank: 3 },
    ]),
  }),
  async () => {
    const res = await new CryptoHeatAgent().execute();
    assert.ok(res.candidates.length >= 2);
    const btc = res.candidates.find((c) => c.title.includes('Bitcoin'));
    assert.ok(btc, 'should surface Bitcoin');
    assert.doesNotMatch(btc!.title, /\d+(\.\d+)?%/, 'no exact % in title');
    assert.doesNotMatch(btc!.title, /\b(moon|explodes|skyrockets)\b/i, 'no hype in title');
    assert.match(btc!.sourceUrls![0], /coingecko\.com/);
  },
));

test('CryptoHeatAgent falls back to literacy when CoinGecko is unavailable', withMockFetch(
  () => ({ ok: false }),
  async () => {
    const res = await new CryptoHeatAgent().execute();
    assert.equal(res.signalBrief.status, 'fallback');
    assert.ok(res.candidates.some((c) => /Bitcoin Basics/i.test(c.title)));
  },
));

test('NewsRssAgent builds a 24h digest + marquee candidate from fresh RSS', withMockFetch(
  () => {
    const pub = new Date(Date.now() - 3_600_000).toUTCString();
    return {
      ok: true,
      text: async () => `<rss version="2.0"><channel>
        <item><title>Nvidia stock rises on AI demand</title><link>https://www.cnbc.com/nvda</link><pubDate>${pub}</pubDate></item>
        <item><title>Fed holds rates steady</title><link>https://www.marketwatch.com/fed</link><pubDate>${pub}</pubDate></item>
      </channel></rss>`,
    };
  },
  async () => {
    const res = await new NewsRssAgent().execute();
    assert.ok(res.candidates.some((c) => /Last 24 Hours/i.test(c.title)), 'should include a 24h digest');
    assert.ok(res.candidates.some((c) => /Nvidia in the News/i.test(c.title)), 'should include a marquee candidate');
    assert.equal(res.signalBrief.status, 'live');
  },
));

test('IpoFilingsAgent builds an IPO candidate from an EDGAR hit', withMockFetch(
  () => ({
    ok: true,
    json: async () => ({
      hits: { hits: [{ _id: 'x', _source: { display_names: ['Acme Inc. (0001234567)'], ciks: ['0001234567'], file_date: '2026-06-02', root_forms: ['S-1'] } }] },
    }),
  }),
  async () => {
    const res = await new IpoFilingsAgent().execute(new Date('2026-06-03T12:00:00Z'));
    const ipo = res.candidates[0];
    assert.match(ipo.title, /New IPO Filing: Acme Inc\. Filed to Go Public/);
    assert.match(ipo.sourceUrls![0], /sec\.gov/);
    assert.equal(res.signalBrief.status, 'live');
  },
));

test('IpoFilingsAgent falls back to literacy when EDGAR is empty', withMockFetch(
  () => ({ ok: true, json: async () => ({ hits: { hits: [] } }) }),
  async () => {
    const res = await new IpoFilingsAgent().execute();
    assert.ok(res.candidates.some((c) => /How to Read an IPO Filing/i.test(c.title)));
  },
));

// ── compliance for the new lanes ──────────────────────────────────────────────

function strategy(slide: string): StrategyDecision {
  return {
    topic: 'Crypto education', hook: 'A risk-first look', format: 'CAROUSEL', slideCount: 3,
    slideBreakdown: ['Slide 1: cover', `Slide 2: ${slide}`, 'Slide 3: save this'],
    reasoning: 'test', targetAudience: 'US investors', searchKeywords: ['crypto'],
  };
}

test('ComplianceQAAgent blocks crypto-pump and IPO-participation language', async () => {
  const agent = new ComplianceQAAgent();
  assert.equal((await agent.execute({ strategy: strategy('This is the next 100x crypto play') })).isValid, false);
  assert.equal((await agent.execute({ strategy: strategy('You should get in on the Acme IPO now') })).isValid, false);
  assert.equal((await agent.execute({ strategy: strategy('to the moon, ape into this coin') })).isValid, false);
});

test('ComplianceQAAgent passes risk-first educational crypto/IPO copy', async () => {
  const agent = new ComplianceQAAgent();
  assert.equal((await agent.execute({ strategy: strategy('What is driving the move and the risks to respect') })).isValid, true);
  assert.equal((await agent.execute({ strategy: strategy('What an S-1 filing reveals before a company lists') })).isValid, true);
});
