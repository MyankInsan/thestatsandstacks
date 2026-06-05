import test from 'node:test';
import assert from 'node:assert/strict';

import { ContentStrategyAgent } from '../src/lib/agents/contentStrategyAgent';

test('ContentStrategyAgent fallback never returns unresolved return placeholders', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';
  try {
    const strategy = await new ContentStrategyAgent().execute({
      trends: {
        topics: [{
          title: 'If You Invested $10,000 in NVIDIA 5 Years Ago',
          score: 1,
          reasoning: 'force fallback match',
          searchKeywords: ['NVDA'],
        }],
      },
      contentHistory: [],
    });

    const text = [strategy.topic, strategy.hook, ...strategy.slideBreakdown].join('\n');
    assert.doesNotMatch(text, /\$XX|XX,XXX|\bX%/i);
    assert.match(text, /verified|split-adjusted|chart/i);
  } finally {
    process.env.GEMINI_API_KEY = saved ?? '';
  }
});
