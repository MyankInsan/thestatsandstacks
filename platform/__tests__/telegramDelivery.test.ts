// platform/__tests__/telegramDelivery.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAlbumCaption,
  buildCaptionMessage,
  buildHashtagsMessage,
  buildPinnedCommentMessage,
  chunkIntoAlbums,
} from '../src/lib/services/telegramDelivery';

const mockStrategy = {
  topic: 'TFSA vs RRSP',
  hook: 'The wrong account costs you.',
  format: 'CAROUSEL' as const,
  slideCount: 6,
  slideBreakdown: [],
  reasoning: '',
  targetAudience: '',
  searchKeywords: [],
};

const mockQA = {
  allPassed: true,
  slideReports: [],
  overallScore: 0.91,
  failedSlides: [],
};

test('buildAlbumCaption includes topic, format, and QA score', () => {
  const result = buildAlbumCaption(mockStrategy, mockQA);
  assert.ok(result.includes('TFSA vs RRSP'));
  assert.ok(result.includes('CAROUSEL'));
  assert.ok(result.includes('91%'));
});

test('buildCaptionMessage has the correct prefix', () => {
  const result = buildCaptionMessage('My caption here.');
  assert.ok(result.startsWith('📝 CAPTION'));
  assert.ok(result.includes('My caption here.'));
});

test('buildHashtagsMessage has the correct prefix', () => {
  const result = buildHashtagsMessage('#CanadianFinance');
  assert.ok(result.startsWith('#️⃣ HASHTAGS'));
  assert.ok(result.includes('#CanadianFinance'));
});

test('buildPinnedCommentMessage has the correct prefix', () => {
  const result = buildPinnedCommentMessage('What would you check first?');
  assert.ok(result.startsWith('📌 PIN THIS COMMENT'));
  assert.ok(result.includes('What would you check first?'));
});

test('chunkIntoAlbums splits correctly at MAX boundary', () => {
  const items = Array.from({ length: 12 }, (_, i) => i);
  const chunks = chunkIntoAlbums(items, 10);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].length, 10);
  assert.equal(chunks[1].length, 2);
});

test('chunkIntoAlbums returns single chunk when items <= max', () => {
  const items = [1, 2, 3];
  const chunks = chunkIntoAlbums(items, 10);
  assert.equal(chunks.length, 1);
  assert.deepEqual(chunks[0], [1, 2, 3]);
});

test('chunkIntoAlbums returns empty array for empty input', () => {
  const chunks = chunkIntoAlbums([], 10);
  assert.deepEqual(chunks, []);
});
