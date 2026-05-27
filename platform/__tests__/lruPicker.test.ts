import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lruPick, lruRank } from '../src/lib/services/lruPicker';

test('lruPick: returns the only candidate when list has one', () => {
  const picked = lruPick(['a'], [], 10);
  assert.equal(picked, 'a');
});

test('lruPick: returns first never-used candidate', () => {
  const picked = lruPick(['a', 'b', 'c'], ['a', 'b'], 10);
  assert.equal(picked, 'c', 'c was never used');
});

test('lruPick: returns oldest-used candidate when all have been used', () => {
  const picked = lruPick(['a', 'b', 'c'], ['c', 'b', 'a', 'b', 'c'], 10);
  assert.equal(picked, 'a', 'a was used least recently in the window');
});

test('lruRank: orders candidates by recency (least-recent first)', () => {
  const ranked = lruRank(['a', 'b', 'c', 'd'], ['c', 'd', 'a', 'b'], 10);
  assert.equal(ranked[0], 'c', 'c was used 4 positions ago');
  assert.equal(ranked[1], 'd');
  assert.equal(ranked[2], 'a');
  assert.equal(ranked[3], 'b');
});

test('lruPick: respects lookback window', () => {
  const picked = lruPick(['a', 'b'], ['a', 'a', 'a', 'b'], 2);
  assert.equal(picked, 'a', "lookback=2 only sees ['a','b'], so 'a' is less recent");
});

test('lruPick: returns undefined for empty candidates', () => {
  const picked = lruPick([], ['a', 'b'], 10);
  assert.equal(picked, undefined);
});
