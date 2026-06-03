/**
 * Tiny, dependency-free RSS 2.0 + Atom parser.
 *
 * The daily pipeline only needs headline + link + publish time from a handful of
 * well-formed public feeds (CNBC, MarketWatch, Nasdaq, Yahoo Finance, CoinDesk,
 * Google News RSS). Pulling in a full XML dependency would churn the lockfile and
 * widen the supply-chain surface for a narrow need, so this extracts exactly those
 * three fields with targeted matching (CDATA- and entity-aware). It is pure and
 * deterministic — feed it a string, no network — so it is unit-testable offline.
 */

export interface RssItem {
  title: string;
  link: string;
  /** ISO-8601 publish time when the feed provided a parseable date. */
  publishedAt?: string;
}

export function parseFeed(xml: string, max = 25): RssItem[] {
  if (!xml || typeof xml !== 'string') return [];
  const items: RssItem[] = [];
  // RSS uses <item>…</item>; Atom uses <entry>…</entry>.
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  for (const block of blocks) {
    const title = decodeText(extractTag(block, 'title'));
    const link = extractLink(block);
    if (!title || !link) continue;
    const rawDate =
      extractTag(block, 'pubDate') ||
      extractTag(block, 'published') ||
      extractTag(block, 'updated') ||
      extractTag(block, 'dc:date');
    items.push({ title, link, publishedAt: toIso(rawDate) });
    if (items.length >= max) break;
  }
  return items;
}

/** True when `publishedAt` is within `hours` of now. Unknown dates → false. */
export function isWithinHours(publishedAt: string | undefined, hours: number): boolean {
  if (!publishedAt) return false;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= hours * 3_600_000;
}

function extractTag(block: string, tag: string): string {
  const safe = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`<${safe}\\b[^>]*>([\\s\\S]*?)<\\/${safe}>`, 'i').exec(block);
  return m ? m[1].trim() : '';
}

function extractLink(block: string): string {
  // RSS: <link>https://…</link>. Atom: <link href="https://…" …/>.
  const inner = extractTag(block, 'link').trim();
  if (/^https?:\/\//i.test(inner)) return inner;
  const href = /<link\b[^>]*\bhref=["']([^"']+)["']/i.exec(block);
  if (href && /^https?:\/\//i.test(href[1])) return href[1];
  // Google News sometimes wraps the URL in a <guid> when <link> is awkward.
  const guid = extractTag(block, 'guid').trim();
  return /^https?:\/\//i.test(guid) ? guid : '';
}

function decodeText(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => safeChar(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

function safeChar(code: number): string {
  return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
}

function toIso(raw: string): string | undefined {
  if (!raw) return undefined;
  const t = Date.parse(raw.trim());
  return Number.isNaN(t) ? undefined : new Date(t).toISOString();
}
