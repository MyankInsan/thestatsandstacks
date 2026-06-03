import { test } from 'node:test';
import assert from 'node:assert/strict';

import { neutralizeUnverifiedSuperlatives } from '../src/lib/agents/researchEvidenceGate';
import {
  pickColorScheme,
  isLightBackground,
  PALETTE_BANK,
  COLOR_SCHEMES,
  FORMAT_TYPES,
} from '../src/lib/agents/formatStyleAgent';
import { SLOT_CONFIGS } from '../src/lib/agents/slotConfig';
import { EXCLUDED_FROM_ROTATION, ROTATION_ALLOWLIST } from '../src/lib/agents/promptLibrary';
import type { ContentHistoryEntry } from '../src/lib/services/contentHistory';

const keyOf = (c: { bg: string; accent1: string; accent2: string }) =>
  `${c.bg}|${c.accent1}|${c.accent2}`.toLowerCase();

function historyWith(scheme: { bg: string; primaryText?: string; accent1: string; accent2: string }): ContentHistoryEntry {
  return {
    date: '2026-06-01', topic: 't', hook: 'h', format: 'CAROUSEL', slideCount: 7, keywords: [],
    colorSchemeUsed: scheme,
  };
}

// ── Record-high title guard ───────────────────────────────────────────────────

test('neutralizeUnverifiedSuperlatives rewrites unverifiable superlatives', () => {
  assert.equal(
    neutralizeUnverifiedSuperlatives('S&P 500 Hits Record High: What to Check'),
    'S&P 500 Hits multi-year high: What to Check',
  );
  assert.equal(
    neutralizeUnverifiedSuperlatives('Nasdaq at an All-Time High'),
    'Nasdaq at an multi-year high',
  );
  assert.equal(neutralizeUnverifiedSuperlatives('BTC prints a new ATH'), 'BTC prints a new multi-year high');
  assert.equal(neutralizeUnverifiedSuperlatives('Apple hits a new high today'), 'Apple nears a multi-year high today');
});

test('neutralizeUnverifiedSuperlatives preserves accurate windowed highs', () => {
  assert.equal(neutralizeUnverifiedSuperlatives('TSX Near a 5-Year High'), 'TSX Near a 5-Year High');
  assert.equal(neutralizeUnverifiedSuperlatives('Stock at a 52-week high'), 'Stock at a 52-week high');
  assert.equal(neutralizeUnverifiedSuperlatives('No superlative here'), 'No superlative here');
});

// ── Palette rotation + light detection ────────────────────────────────────────

test('isLightBackground uses luminance, not a hardcoded hex', () => {
  for (const lite of ['#F8F9FA', '#F4F1EA', '#FFFFFF']) assert.equal(isLightBackground(lite), true, lite);
  for (const dark of ['#050505', '#0B0F14', '#0E0B08', '#000000']) assert.equal(isLightBackground(dark), false, dark);
});

test('PALETTE_BANK covers every format and starts with the canonical default', () => {
  for (const ft of FORMAT_TYPES) {
    assert.ok(PALETTE_BANK[ft] && PALETTE_BANK[ft].length >= 2, `${ft} needs >=2 palettes`);
    assert.equal(keyOf(PALETTE_BANK[ft][0]), keyOf(COLOR_SCHEMES[ft]), `${ft} first palette must be the default`);
  }
});

test('pickColorScheme LRU-rotates away from the most recently used palette', () => {
  const ft = 'PHOTOREALISTIC_MARKET_UPDATE';
  const defaultKey = keyOf(COLOR_SCHEMES[ft]);
  // Default used most recently → picker should avoid it.
  const picked = pickColorScheme(ft, [historyWith(COLOR_SCHEMES[ft])]);
  assert.notEqual(keyOf(picked), defaultKey, 'should rotate to a different palette');
  assert.ok(PALETTE_BANK[ft].some((p) => keyOf(p) === keyOf(picked)), 'picked palette must be from the bank');
});

test('pickColorScheme returns the default with empty history', () => {
  const ft = 'PHOTOREALISTIC_NEWS_FLASH';
  assert.equal(keyOf(pickColorScheme(ft, [])), keyOf(COLOR_SCHEMES[ft]));
});

test('pickColorScheme also avoids same-day prior palettes', () => {
  const ft = 'PHOTOREALISTIC_EXPERT_SHOCK';
  const bank = PALETTE_BANK[ft];
  // Mark the first two palettes used (history + today) → picker should land on the third.
  const picked = pickColorScheme(ft, [historyWith(bank[0])], [historyWith(bank[1])]);
  assert.equal(keyOf(picked), keyOf(bank[2]));
});

// ── Slot topic-mode policy ────────────────────────────────────────────────────

test('every slot config declares a valid topicMode', () => {
  const valid = new Set(['TIMELY_FIRST', 'EVERGREEN_OR_TIMELY']);
  for (const idx of [1, 2, 3, 4, 5, 6] as const) {
    assert.ok(valid.has(SLOT_CONFIGS[idx].topicMode), `slot ${idx} topicMode invalid`);
  }
  // News-driven slots are timely-first; lifestyle/contrarian may be evergreen.
  assert.equal(SLOT_CONFIGS[1].topicMode, 'TIMELY_FIRST');
  assert.equal(SLOT_CONFIGS[5].topicMode, 'EVERGREEN_OR_TIMELY');
});

// ── Cliché demotion ───────────────────────────────────────────────────────────

test('overused cliché motifs are demoted out of the rotation allowlist', () => {
  for (const demoted of ['MILITARY_AEROSPACE_METAPHOR', 'NATURE_METAPHOR', 'PREMIUM_CTA', 'VAULT_SECURITY'] as const) {
    assert.ok(EXCLUDED_FROM_ROTATION.includes(demoted), `${demoted} should be excluded`);
    assert.ok(!ROTATION_ALLOWLIST.includes(demoted), `${demoted} should not be in the rotation allowlist`);
  }
});
