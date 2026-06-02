import { TICKER_LOGO_MAP } from './tickerLogoAgent';

/**
 * Side-effect-free ticker matcher. Extracted from run-daily.ts so tests and
 * agents can import it WITHOUT loading the live pipeline entrypoint (whose
 * top-level main() would otherwise execute on import). See the safety refactor
 * in docs/superpowers/specs/2026-06-02-carousel-storyboard-visual-plan-redesign.md.
 *
 * Returns true when `symbol` (or its mapped company name) appears as a whole
 * word in the strategy's topic/keywords/slide breakdown. Short tickers (<= 2
 * chars) are matched case-sensitively to avoid false positives like "MA"
 * matching "market".
 */
export function isTickerActive(
  symbol: string,
  strategy: { topic: string; searchKeywords?: string[]; slideBreakdown?: string[] },
): boolean {
  const topicTextLower = `${strategy.topic} ${(strategy.searchKeywords ?? []).join(' ')} ${(strategy.slideBreakdown ?? []).join(' ')}`.toLowerCase();
  const topicTextOriginal = `${strategy.topic} ${(strategy.searchKeywords ?? []).join(' ')} ${(strategy.slideBreakdown ?? []).join(' ')}`;

  const cleanSymbol = symbol.replace(/\.[A-Z]+$/, '');
  const entry = TICKER_LOGO_MAP[symbol];

  const searchTerms: { term: string; caseSensitive: boolean }[] = [
    { term: cleanSymbol, caseSensitive: cleanSymbol.length <= 2 },
  ];
  if (entry) {
    searchTerms.push({ term: entry.companyName, caseSensitive: entry.companyName.length <= 2 });
  }

  for (const { term, caseSensitive } of searchTerms) {
    const escaped = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, caseSensitive ? '' : 'i');
    const textToSearch = caseSensitive ? topicTextOriginal : topicTextLower;
    if (regex.test(textToSearch)) {
      return true;
    }
  }
  return false;
}
