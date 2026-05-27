import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { TickerLogoAgent, TICKER_LOGO_MAP } from '../src/lib/agents/tickerLogoAgent';

test('TickerLogoAgent: every HOT_TOPIC_WATCHLIST ticker has a logo entry', () => {
  const watchlistPath = path.join(__dirname, '..', 'data', 'hotTopicWatchlist.json');
  const watchlist = JSON.parse(fs.readFileSync(watchlistPath, 'utf-8')) as { tickers: string[] };
  const agent = new TickerLogoAgent();

  const missing = agent.missing(watchlist.tickers);
  assert.equal(
    missing.length,
    0,
    `Watchlist tickers missing from TICKER_LOGO_MAP: ${missing.join(', ')}. Add entries to tickerLogoAgent.ts in the same PR that updates the watchlist.`,
  );
});

test('TickerLogoAgent: resolve returns full entry for a known ticker', () => {
  const agent = new TickerLogoAgent();
  const nvda = agent.resolve('NVDA');
  assert.ok(nvda, 'NVDA should resolve');
  assert.equal(nvda.companyName, 'NVIDIA');
  assert.equal(nvda.portraitSubject, 'jensen_huang');
  assert.match(nvda.brandColorHex, /^#[0-9A-F]{6}$/i);
});

test('TickerLogoAgent: resolve returns undefined for unknown ticker', () => {
  const agent = new TickerLogoAgent();
  assert.equal(agent.resolve('FAKE_TICKER_XYZ'), undefined);
});

test('TICKER_LOGO_MAP: every entry has required fields', () => {
  for (const [ticker, entry] of Object.entries(TICKER_LOGO_MAP)) {
    assert.match(entry.brandColorHex, /^#[0-9A-F]{6}$/i, `${ticker} brandColorHex invalid`);
    assert.ok(entry.markStyle.length > 0, `${ticker} missing markStyle`);
    assert.ok(entry.companyName.length > 0, `${ticker} missing companyName`);
  }
});
