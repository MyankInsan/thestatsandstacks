import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CTA_LIBRARY, selectCta, isCtaId } from '../src/lib/agents/ctaLibrary';

test('CTA_LIBRARY: every entry has required fields', () => {
  for (const [id, spec] of Object.entries(CTA_LIBRARY)) {
    assert.equal(spec.id, id, `id mismatch for ${id}`);
    assert.ok(spec.pattern.length > 0, `${id} missing pattern`);
    assert.ok(spec.description.length > 0, `${id} missing description`);
    assert.ok(spec.bestForSlot === 'any' || Array.isArray(spec.bestForSlot), `${id} bestForSlot wrong shape`);
    assert.ok(spec.carouselImpactNote.length > 0, `${id} missing carouselImpactNote`);
  }
});

test('isCtaId validates correctly', () => {
  assert.equal(isCtaId('save_specific'), true);
  assert.equal(isCtaId('nonexistent'), false);
  assert.equal(isCtaId(null), false);
  assert.equal(isCtaId(undefined), false);
});

test('selectCta: dm_pull is gated off without DM_AUTOMATION_ENABLED', () => {
  const picked = selectCta({
    slotIndex: 2,
    preferredCtas: ['dm_pull', 'save_specific'],
    recentCtasUsed: [],
    dmAutomationEnabled: false,
  });
  assert.notEqual(picked, 'dm_pull', 'dm_pull should be gated off');
  assert.equal(picked, 'save_specific');
});

test('selectCta: dm_pull is allowed when DM_AUTOMATION_ENABLED=true', () => {
  const picked = selectCta({
    slotIndex: 2,
    preferredCtas: ['dm_pull'],
    recentCtasUsed: [],
    dmAutomationEnabled: true,
  });
  assert.equal(picked, 'dm_pull');
});

test('selectCta: story_vote is gated off without STORY_AUTOMATION_ENABLED', () => {
  const picked = selectCta({
    slotIndex: 4,
    preferredCtas: ['story_vote', 'question_open'],
    recentCtasUsed: [],
    storyAutomationEnabled: false,
  });
  assert.notEqual(picked, 'story_vote');
  assert.equal(picked, 'question_open');
});

test('selectCta: LRU rotation prefers least-recently-used', () => {
  const picked = selectCta({
    slotIndex: 3,
    preferredCtas: ['save_specific', 'reference_save', 'comment_genuine_question'],
    recentCtasUsed: ['save_specific', 'save_specific', 'reference_save'],
  });
  assert.equal(picked, 'comment_genuine_question', 'should pick the never-used candidate');
});

test('selectCta: feedback weighting prefers higher-rated CTAs', () => {
  const picked = selectCta({
    slotIndex: 3,
    preferredCtas: ['save_specific', 'reference_save'],
    recentCtasUsed: [],
    feedback: [
      { postSlug: 'p1', ctaId: 'save_specific', capturedAt: '2026-05-01', manualRating: 5 },
      { postSlug: 'p2', ctaId: 'save_specific', capturedAt: '2026-05-02', manualRating: 5 },
      { postSlug: 'p3', ctaId: 'reference_save', capturedAt: '2026-05-03', manualRating: 2 },
    ],
  });
  assert.equal(picked, 'save_specific', 'should pick the higher-rated CTA');
});

test('selectCta: falls back to save_specific when all preferred are gated', () => {
  const picked = selectCta({
    slotIndex: 2,
    preferredCtas: ['dm_pull'],
    recentCtasUsed: [],
    dmAutomationEnabled: false,
  });
  assert.equal(picked, 'save_specific');
});

test('selectCta: swipe_promise requires hasPayoffSlide flag', () => {
  const picked = selectCta({
    slotIndex: 1,
    preferredCtas: ['swipe_promise'],
    recentCtasUsed: [],
    hasPayoffSlide: false,
  });
  assert.notEqual(picked, 'swipe_promise');

  const picked2 = selectCta({
    slotIndex: 1,
    preferredCtas: ['swipe_promise'],
    recentCtasUsed: [],
    hasPayoffSlide: true,
  });
  assert.equal(picked2, 'swipe_promise');
});
