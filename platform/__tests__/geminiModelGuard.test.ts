import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkTextModelSafety,
  isStableFreeTierTextModel,
  STABLE_GEMINI_TEXT_MODELS,
  DEFAULT_GEMINI_TEXT_MODEL,
} from '../src/lib/services/gemini';
import { CostGuardAgent } from '../src/lib/agents/costGuardAgent';

test('default model is a stable free-tier model', () => {
  assert.ok(isStableFreeTierTextModel(DEFAULT_GEMINI_TEXT_MODEL));
  assert.ok(STABLE_GEMINI_TEXT_MODELS.includes('gemini-3.5-flash'));
});

test('checkTextModelSafety accepts pinned stable models', () => {
  for (const model of STABLE_GEMINI_TEXT_MODELS) {
    assert.equal(checkTextModelSafety(model).safe, true, `${model} should be safe`);
  }
});

test('checkTextModelSafety rejects floating, preview, and non-text models', () => {
  const reject = ['gemini-flash-latest', 'gemini-2.5-flash-preview-05-20', 'gemini-2.0-flash-exp', 'gemini-2.5-flash-image', 'imagen-3.0', 'gemini-2.5-flash-native-audio', ''];
  for (const model of reject) {
    const result = checkTextModelSafety(model);
    assert.equal(result.safe, false, `${model} should be rejected`);
    assert.ok(result.failures.length > 0);
  }
});

test('CostGuardAgent fails closed when GEMINI_TEXT_MODEL is a latest alias', async () => {
  const originalZero = process.env.ZERO_COST_MODE;
  const originalModel = process.env.GEMINI_TEXT_MODEL;
  process.env.ZERO_COST_MODE = 'true';
  process.env.GEMINI_TEXT_MODEL = 'gemini-flash-latest';
  try {
    const report = await new CostGuardAgent().execute();
    assert.equal(report.isSafe, false);
    assert.match(report.failures.join(' '), /GEMINI_TEXT_MODEL/);
  } finally {
    restore('ZERO_COST_MODE', originalZero);
    restore('GEMINI_TEXT_MODEL', originalModel);
  }
});

test('CostGuardAgent passes with a pinned stable model and no risky flags', async () => {
  const keys = ['ZERO_COST_MODE', 'GEMINI_TEXT_MODEL', 'ALLOW_PAID_IMAGE_GENERATION', 'FREE_IMAGE_GENERATION_ONLY', 'GEMINI_IMAGE_GENERATION_ENABLED', 'ALLOW_GEMINI_IMAGE_API_SPEND', 'CLOUDFLARE_WORKERS_AI_ENABLED', 'GEMINI_GROUNDING_ENABLED', 'GEMINI_BATCH_ENABLED', 'GEMINI_CONTEXT_CACHING_ENABLED', 'GEMINI_LIVE_API_ENABLED', 'OPENAI_VIDEO_API_KEY', 'SORA_API_KEY', 'RUNWAY_API_KEY', 'GOOGLE_IMAGE_SCRAPING_ENABLED', 'GOOGLE_PHOTOS_SOURCING_ENABLED'];
  const originals = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  process.env.ZERO_COST_MODE = 'true';
  process.env.GEMINI_TEXT_MODEL = 'gemini-3.5-flash';
  try {
    const report = await new CostGuardAgent().execute();
    assert.equal(report.isSafe, true, `expected safe, failures: ${report.failures.join(' ')}`);
  } finally {
    for (const [k, v] of Object.entries(originals)) restore(k, v);
  }
});

test('CostGuardAgent blocks billable Gemini paths (grounding/batch/caching/live)', async () => {
  const originalZero = process.env.ZERO_COST_MODE;
  const originalGround = process.env.GEMINI_GROUNDING_ENABLED;
  process.env.ZERO_COST_MODE = 'true';
  process.env.GEMINI_GROUNDING_ENABLED = 'true';
  try {
    const report = await new CostGuardAgent().execute();
    assert.equal(report.isSafe, false);
    assert.match(report.failures.join(' '), /GEMINI_GROUNDING_ENABLED/);
  } finally {
    restore('ZERO_COST_MODE', originalZero);
    restore('GEMINI_GROUNDING_ENABLED', originalGround);
  }
});

function restore(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
