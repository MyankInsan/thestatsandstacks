import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, isWithinHours } from '../src/lib/services/rssParse';

const RSS_2 = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Markets</title>
  <item>
    <title><![CDATA[Nvidia jumps as AI demand & guidance beat]]></title>
    <link>https://example.com/nvda</link>
    <pubDate>Wed, 03 Jun 2026 12:00:00 GMT</pubDate>
  </item>
  <item>
    <title>S&amp;P 500 slips on Fed minutes</title>
    <link>https://example.com/spx</link>
    <pubDate>Tue, 02 Jun 2026 09:30:00 GMT</pubDate>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Coinbase files something</title>
    <link rel="alternate" href="https://example.com/coin" />
    <published>2026-06-03T08:15:00Z</published>
  </entry>
</feed>`;

const GOOGLE_NEWS = `<rss version="2.0"><channel>
  <item>
    <title>Tesla recalls cars - Reuters</title>
    <link>https://news.google.com/rss/articles/abc</link>
    <guid isPermaLink="false">https://news.google.com/rss/articles/abc</guid>
    <pubDate>Mon, 01 Jun 2026 22:00:00 GMT</pubDate>
  </item>
</channel></rss>`;

test('parseFeed reads RSS 2.0 items with CDATA + entities', () => {
  const items = parseFeed(RSS_2);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Nvidia jumps as AI demand & guidance beat');
  assert.equal(items[0].link, 'https://example.com/nvda');
  assert.equal(items[0].publishedAt, '2026-06-03T12:00:00.000Z');
  assert.equal(items[1].title, 'S&P 500 slips on Fed minutes');
});

test('parseFeed reads Atom entries via link href', () => {
  const items = parseFeed(ATOM);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Coinbase files something');
  assert.equal(items[0].link, 'https://example.com/coin');
  assert.equal(items[0].publishedAt, '2026-06-03T08:15:00.000Z');
});

test('parseFeed handles Google News RSS shape', () => {
  const items = parseFeed(GOOGLE_NEWS);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Tesla recalls cars - Reuters');
  assert.match(items[0].link, /news\.google\.com/);
});

test('parseFeed is resilient to junk and empty input', () => {
  assert.deepEqual(parseFeed(''), []);
  assert.deepEqual(parseFeed('<html>not a feed</html>'), []);
  assert.deepEqual(parseFeed(undefined as unknown as string), []);
});

test('parseFeed respects the max cap', () => {
  assert.equal(parseFeed(RSS_2, 1).length, 1);
});

test('isWithinHours compares against now', () => {
  const recent = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const old = new Date(Date.now() - 100 * 3_600_000).toISOString();
  assert.equal(isWithinHours(recent, 48), true);
  assert.equal(isWithinHours(old, 48), false);
  assert.equal(isWithinHours(undefined, 48), false);
  assert.equal(isWithinHours('not-a-date', 48), false);
});
