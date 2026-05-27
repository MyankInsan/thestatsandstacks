import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HookQualityGate, getDeterministicFallbackHookFormula } from '../src/lib/agents/hookQualityGate';

test('HookQualityGate: passes a valid hook', () => {
  const gate = new HookQualityGate();
  const result = gate.check({
    hook: 'Most Canadians pick the wrong account first',
    slideBreakdown: [
      'Slide 1: Most Canadians pick the wrong account first',
      'Slide 2: TFSA vs RRSP vs FHSA — the order matters',
      'Slide 3: Account selection rules',
    ],
    hookFormulaId: 'DECISION_FORK',
    slotPreferredFormulas: ['DECISION_FORK', 'IF_THEN_LADDER'],
  });
  assert.equal(result.valid, true, `Should be valid, failures: ${result.failures.join('; ')}`);
});

test('HookQualityGate: rejects hype verbs', () => {
  const gate = new HookQualityGate();
  const result = gate.check({
    hook: 'NVDA explodes! This stock is insane!',
    slideBreakdown: ['Slide 1: NVDA went up', 'Slide 2: explanation'],
    hookFormulaId: 'ANTI_FOMO',
    slotPreferredFormulas: ['ANTI_FOMO'],
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some((f) => f.includes('hype verb')));
});

test('HookQualityGate: rejects WSB tone', () => {
  const gate = new HookQualityGate();
  const result = gate.check({
    hook: 'NVDA going to the moon, diamond hands degen play',
    slideBreakdown: ['Slide 1: NVDA analysis', 'Slide 2: more analysis'],
    hookFormulaId: 'ANTI_FOMO',
    slotPreferredFormulas: ['ANTI_FOMO'],
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some((f) => f.includes('WSB')));
});

test('HookQualityGate: rejects vague nouns without entity', () => {
  const gate = new HookQualityGate();
  const result = gate.check({
    hook: 'The secret thing nobody talks about',
    slideBreakdown: ['Slide 1: vague claim', 'Slide 2: more vagueness'],
    hookFormulaId: 'QUIET_NUMBER',
    slotPreferredFormulas: ['QUIET_NUMBER'],
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some((f) => f.includes('Vague noun')));
});

test('HookQualityGate: accepts vague noun when paired with concrete entity', () => {
  const gate = new HookQualityGate();
  const result = gate.check({
    hook: 'The secret behind TFSA contribution limits',
    slideBreakdown: ['Slide 1: TFSA secret', 'Slide 2: contribution limits explained'],
    hookFormulaId: 'QUIET_NUMBER',
    slotPreferredFormulas: ['QUIET_NUMBER'],
  });
  // Note: passes vague noun check (has TFSA entity), but substantiation may still flag
  assert.equal(result.failures.some((f) => f.includes('Vague noun')), false);
});

test('HookQualityGate: rejects invalid hookFormulaId, suggests replacement', () => {
  const gate = new HookQualityGate();
  const result = gate.check({
    hook: 'Most Canadians pick the wrong account first',
    slideBreakdown: ['Slide 1: account selection', 'Slide 2: comparison'],
    hookFormulaId: 'INVALID_FORMULA',
    slotPreferredFormulas: ['DECISION_FORK', 'IF_THEN_LADDER'],
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some((f) => f.includes('hookFormulaId')));
  assert.equal(result.suggestedReplacementFormulaId, 'DECISION_FORK');
});

test('HookQualityGate: substantiation requires lemma match between hook and breakdown', () => {
  const gate = new HookQualityGate();
  const result = gate.check({
    hook: 'Vacation umbrellas elephant zebra mango pickle',
    slideBreakdown: [
      'Slide 1: cover slide',
      'Slide 2: about Canadian investing',
      'Slide 3: stocks ETFs portfolios returns',
    ],
    hookFormulaId: 'DECISION_FORK',
    slotPreferredFormulas: ['DECISION_FORK'],
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some((f) => f.toLowerCase().includes('substantiation')), `expected substantiation failure, got: ${result.failures.join('; ')}`);
});

test('HookQualityGate: rejects hook too short', () => {
  const gate = new HookQualityGate();
  const result = gate.check({
    hook: 'Buy NVDA',
    slideBreakdown: ['Slide 1: NVDA analysis'],
    hookFormulaId: 'RECEIPT_DROP',
    slotPreferredFormulas: ['RECEIPT_DROP'],
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some((f) => f.includes('too short')));
});

test('HookQualityGate: rejects hook too long', () => {
  const gate = new HookQualityGate();
  const result = gate.check({
    hook: 'This is a very long hook that goes on and on with too many words for an Instagram post',
    slideBreakdown: ['Slide 1: long content here', 'Slide 2: more'],
    hookFormulaId: 'IF_THEN_LADDER',
    slotPreferredFormulas: ['IF_THEN_LADDER'],
  });
  assert.equal(result.valid, false);
  assert.ok(result.failures.some((f) => f.includes('too long')));
});

test('getDeterministicFallbackHookFormula: returns valid formula from preferred list', () => {
  const id = getDeterministicFallbackHookFormula(['DECISION_FORK', 'RECEIPT_DROP', 'TIME_CAPSULE'], 0);
  assert.equal(id, 'DECISION_FORK');

  const id2 = getDeterministicFallbackHookFormula(['DECISION_FORK', 'RECEIPT_DROP', 'TIME_CAPSULE'], 1);
  assert.equal(id2, 'RECEIPT_DROP');

  const id3 = getDeterministicFallbackHookFormula(['DECISION_FORK', 'RECEIPT_DROP', 'TIME_CAPSULE'], 5);
  assert.equal(id3, 'TIME_CAPSULE');
});

test('getDeterministicFallbackHookFormula: falls back to all formulas when preferred is empty', () => {
  const id = getDeterministicFallbackHookFormula([], 0);
  assert.ok(id, 'should return some formula id');
});
