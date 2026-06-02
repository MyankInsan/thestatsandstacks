import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeReviewFlags,
  mergeReviewFlags,
  buildReviewBlock,
  requiresManualReview,
} from '../src/lib/agents/researchEvidenceGate';

test('record-high claims are flagged for manual review', () => {
  const flags = computeReviewFlags({ topic: 'S&P 500 Near a 5-Year High: 5 Portfolio Rules' });
  assert.ok(flags.includes('RECORD_HIGH_CLAIM'));
  assert.ok(flags.includes('MANUAL_REVIEW_REQUIRED'));
  assert.ok(requiresManualReview(flags));
});

test('politician disclosures are flagged', () => {
  const flags = computeReviewFlags({ topic: 'What Nancy Pelosi bought last quarter', angleId: 'POLITICIAN_DISCLOSURES' });
  assert.ok(flags.includes('POLITICIAN_DISCLOSURE'));
});

test('multi-year return claims are corporate-action-sensitive', () => {
  const flags = computeReviewFlags({ topic: 'If You Invested $10,000 in NVIDIA 5 Years Ago' });
  assert.ok(flags.includes('CORPORATE_ACTION_SENSITIVE_RETURN'));
});

test('extreme single-period moves are flagged as anomalies', () => {
  assert.ok(computeReviewFlags({ topic: 'SanDisk surges 40% after earnings' }).includes('ANOMALY_MOVE'));
  assert.ok(computeReviewFlags({ topic: 'Stock explodes after the print' }).includes('ANOMALY_MOVE'));
});

test('secondary-only news in a news lane is flagged', () => {
  const flags = computeReviewFlags({
    topic: 'NVDA catalyst map after the headlines',
    angleId: 'CATALYST_NEWS',
    sourceUrls: ['https://finance.yahoo.com/quote/NVDA', 'https://www.reddit.com/r/stocks/x'],
  });
  assert.ok(flags.includes('SECONDARY_ONLY_NEWS'));
});

test('clean evergreen topics get no flags', () => {
  const flags = computeReviewFlags({ topic: 'TFSA vs RRSP vs FHSA: which account first?', angleId: 'COMPARISON_LADDER' });
  assert.deepEqual(flags, []);
  assert.equal(requiresManualReview(flags), false);
});

test('mergeReviewFlags dedupes and buildReviewBlock renders guidance', () => {
  const merged = mergeReviewFlags(['RECORD_HIGH_CLAIM'], ['RECORD_HIGH_CLAIM', 'ANOMALY_MOVE']);
  assert.deepEqual(merged.sort(), ['ANOMALY_MOVE', 'RECORD_HIGH_CLAIM']);
  const block = buildReviewBlock(merged, 'Some topic');
  assert.match(block!, /RECORD_HIGH_CLAIM/);
  assert.match(block!, /ANOMALY_MOVE/);
  assert.equal(buildReviewBlock([], 'x'), undefined);
});
