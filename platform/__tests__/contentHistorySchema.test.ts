import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  appendContentHistory,
  loadContentHistory,
  CURRENT_SCHEMA_VERSION,
  parseEnumOrInfer,
  type ContentHistoryEntry,
} from '../src/lib/services/contentHistory';

function tmpPath(): string {
  return path.join(os.tmpdir(), `tsas-history-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

test('loadContentHistory: returns empty array when file does not exist', () => {
  const p = tmpPath();
  const result = loadContentHistory(p);
  assert.deepEqual(result, []);
});

test('loadContentHistory: migrates v1-shape array to v2', () => {
  const p = tmpPath();
  const v1Data = [
    { date: '2026-05-20', topic: 'test', hook: 'h', format: 'CAROUSEL', slideCount: 6, keywords: [] },
  ];
  fs.writeFileSync(p, JSON.stringify(v1Data), 'utf-8');

  const loaded = loadContentHistory(p);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].schemaVersion, CURRENT_SCHEMA_VERSION);

  const onDisk = JSON.parse(fs.readFileSync(p, 'utf-8'));
  assert.equal(onDisk.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.ok(Array.isArray(onDisk.entries));

  fs.unlinkSync(p);
});

test('appendContentHistory: composite dedup key allows 5 entries per date', () => {
  const p = tmpPath();
  const baseEntry: Omit<ContentHistoryEntry, 'slotIndex'> = {
    date: '2026-05-25',
    topic: 'test',
    hook: 'h',
    format: 'CAROUSEL',
    slideCount: 6,
    keywords: [],
  };

  for (let slot = 1; slot <= 5; slot++) {
    appendContentHistory(p, { ...baseEntry, slotIndex: slot as 1 | 2 | 3 | 4 | 5, topic: `slot ${slot} topic` });
  }

  const loaded = loadContentHistory(p);
  assert.equal(loaded.length, 5, 'all 5 slots should coexist');
  for (let slot = 1; slot <= 5; slot++) {
    assert.ok(loaded.some((e) => e.slotIndex === slot), `slot ${slot} should be present`);
  }

  fs.unlinkSync(p);
});

test('appendContentHistory: re-appending same date+slot replaces existing entry', () => {
  const p = tmpPath();
  appendContentHistory(p, { date: '2026-05-25', topic: 'first', hook: 'h1', format: 'CAROUSEL', slideCount: 6, keywords: [], slotIndex: 1 });
  appendContentHistory(p, { date: '2026-05-25', topic: 'second', hook: 'h2', format: 'CAROUSEL', slideCount: 6, keywords: [], slotIndex: 1 });

  const loaded = loadContentHistory(p);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].topic, 'second');

  fs.unlinkSync(p);
});

test('appendContentHistory: rolling window is 250 entries', () => {
  const p = tmpPath();
  for (let i = 0; i < 260; i++) {
    appendContentHistory(p, {
      date: `2026-01-${String(i % 30 + 1).padStart(2, '0')}`,
      topic: `topic ${i}`,
      hook: 'h',
      format: 'CAROUSEL',
      slideCount: 6,
      keywords: [],
      slotIndex: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
    });
  }
  const loaded = loadContentHistory(p);
  assert.ok(loaded.length <= 250, `expected <= 250, got ${loaded.length}`);

  fs.unlinkSync(p);
});

test('parseEnumOrInfer: returns exact match', () => {
  const VALID = ['EARNINGS', 'MACRO', 'POLICY'] as const;
  assert.equal(parseEnumOrInfer('EARNINGS', VALID), 'EARNINGS');
});

test('parseEnumOrInfer: coerces case + spacing', () => {
  const VALID = ['EARNINGS', 'TAX_ACCT'] as const;
  assert.equal(parseEnumOrInfer('earnings', VALID), 'EARNINGS');
  assert.equal(parseEnumOrInfer('tax acct', VALID), 'TAX_ACCT');
  assert.equal(parseEnumOrInfer('tax-acct', VALID), 'TAX_ACCT');
});

test('parseEnumOrInfer: returns undefined for unmatched', () => {
  const VALID = ['EARNINGS', 'MACRO'] as const;
  assert.equal(parseEnumOrInfer('GIBBERISH', VALID), undefined);
  assert.equal(parseEnumOrInfer(null, VALID), undefined);
  assert.equal(parseEnumOrInfer('', VALID), undefined);
});
