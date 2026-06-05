import test from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceArtifactAgent } from '../src/lib/agents/evidenceArtifactAgent';
import type { StrategyDecision } from '../src/lib/agents/contentStrategyAgent';

function strategy(overrides: Partial<StrategyDecision> = {}): StrategyDecision {
  return {
    topic: 'If You Invested $10,000 in NVIDIA 5 Years Ago',
    hook: 'What $10k in NVDA looks like today.',
    format: 'CAROUSEL',
    slideCount: 6,
    slideBreakdown: [
      'Slide 1: What $10k in NVDA looks like today | split-adjusted chart first',
      'Slide 2: The Initial Investment | $10,000 invested 5 years ago',
      'Slide 3: The Growth Journey | Through macro shocks and rate hikes',
      'Slide 4: The Result Today | Verify the exact total before rendering',
      'Slide 5: The Lesson | Time in the market beats timing the market',
      'Slide 6: Save this reminder | Educational only, not financial advice',
    ],
    reasoning: 'test',
    targetAudience: 'investors',
    searchKeywords: ['NVDA'],
    topicCategory: 'EARNINGS',
    angleId: 'HYPOTHETICAL_REVERSAL',
    ...overrides,
  };
}

test('EvidenceArtifactAgent builds ticker-specific NVDA artifacts instead of generic finance symbols', () => {
  const plan = new EvidenceArtifactAgent().execute({
    strategy: strategy(),
    tickerSymbols: ['NVDA'],
    slideCount: 6,
  });

  assert.equal(plan.artifacts.length, 6);
  assert.equal(plan.artifacts[0].kind, 'PRICE_CHART');
  assert.match(plan.artifacts[0].label, /NVDA/i);
  assert.match(plan.artifacts[0].visualAnchor, /split-adjusted|5-year/i);
  assert.ok(
    plan.artifacts.some((a) => /Jensen Huang|GPU|data center|Blackwell|GTC/i.test(`${a.label} ${a.visualAnchor}`)),
    'NVDA plan should contain company-specific real-world context',
  );
  assert.doesNotMatch(plan.artifacts.map((a) => a.visualAnchor).join('\n'), /bull|missile|rocket|chess/i);
});

test('EvidenceArtifactAgent builds LULU retail evidence artifacts without unrelated ticker labels', () => {
  const plan = new EvidenceArtifactAgent().execute({
    strategy: strategy({
      topic: 'The Lululemon Earnings Case Study: 3 Consumer Warning Signs to Watch',
      hook: 'Three retail warning signs to watch',
      searchKeywords: ['LULU', 'Lululemon', 'retail inventory'],
      topicCategory: 'EARNINGS',
      slideBreakdown: [
        'Slide 1: Three Retail Warning Signs | inventory, traffic, and margin pressure',
        'Slide 2: Inventory levels | rising faster than quarterly sales velocity',
        'Slide 3: Store traffic | mature North America stores slowing',
        'Slide 4: Margin pressure | markdowns and freight costs',
        'Slide 5: What to watch next | expansion pace and risks',
        'Slide 6: Save the checklist | monitor risks',
      ],
    }),
    tickerSymbols: ['LULU'],
    slideCount: 6,
  });

  const combined = plan.artifacts.map((a) => `${a.kind} ${a.label} ${a.visualAnchor}`).join('\n');
  assert.match(combined, /STORE_SCENE|PRODUCT_DETAIL|EARNINGS_TABLE|RISK_MATRIX/);
  assert.match(combined, /Lululemon|storefront|apparel|inventory|earnings/i);
  assert.doesNotMatch(combined, /\b(NVDA|AMZN|MSFT|AAPL|GOOGL)\b/);
});
