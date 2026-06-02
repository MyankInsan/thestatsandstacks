import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { isTickerActive } from '../src/lib/agents/tickerMatch';
import { formatTelegramPacket, TOTAL_DAILY_SLOTS } from '../src/lib/services/telegramDelivery';
import { SLOT_CONFIGS } from '../src/lib/agents/slotConfig';
import type { ImagePromptSet } from '../src/lib/agents/imagePromptAgent';
import type { CopyBundle } from '../src/lib/agents/copywritingAgent';
import type { StrategyDecision } from '../src/lib/agents/contentStrategyAgent';
import type { FormatDecision } from '../src/lib/agents/formatStyleAgent';
import { COLOR_SCHEMES } from '../src/lib/agents/formatStyleAgent';

test('isTickerActive is side-effect-free and importable without the entrypoint', () => {
  assert.equal(typeof isTickerActive, 'function');
  assert.equal(isTickerActive('V', { topic: 'volume recovering market', searchKeywords: [], slideBreakdown: [] }), false);
  assert.equal(isTickerActive('V', { topic: 'Why we are buying V stock today' }), true);
});

test('importing run-daily.ts does NOT execute the live pipeline (require.main guard)', () => {
  const platformRoot = path.resolve(__dirname, '..');
  const out = execFileSync(
    'npx',
    ['tsx', '-e', "require('./run-daily.ts'); process.stdout.write('IMPORT_DONE');"],
    {
      cwd: platformRoot,
      timeout: 60_000,
      encoding: 'utf-8',
      env: { ...process.env, GEMINI_API_KEY: '', TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '', SLOT_OVERRIDE: '' },
    },
  );
  assert.match(out, /IMPORT_DONE/, 'module import must complete');
  assert.doesNotMatch(out, /DAILY PIPELINE/, 'main() banner must NOT print on import');
  assert.doesNotMatch(out, /TELEGRAM DELIVERY/, 'Telegram delivery must NOT run on import');
});

const baseFormat: FormatDecision = {
  formatType: 'PHOTOREALISTIC_NEWS_FLASH',
  slideCount: 6,
  colorScheme: COLOR_SCHEMES.PHOTOREALISTIC_NEWS_FLASH,
  visualTone: 'urgent',
  reasoning: 'test',
};

const baseStrategy = {
  topic: 'NVDA earnings',
  hook: 'Nvidia just crushed estimates',
  format: 'CAROUSEL',
  slideCount: 6,
  slideBreakdown: [],
  reasoning: 'test',
  targetAudience: 'investors',
  searchKeywords: ['NVDA'],
  hookFormulaId: 'RECEIPT_DROP',
  ctaId: 'save_specific',
} as unknown as StrategyDecision;

const baseCopy: CopyBundle = {
  caption: 'Caption body.',
  hashtags: '#one #two',
  cta: 'Save this.',
  firstComment: 'What do you check first?',
  altText: 'alt',
} as unknown as CopyBundle;

const basePromptSet: ImagePromptSet = {
  slides: [
    {
      slideNumber: 1,
      role: 'cover',
      slideTitle: 'COVER',
      geminiPrompt: 'Prompt 1',
      recommendedModel: 'chatgpt_image',
      recommendedModelLabel: 'Best: ChatGPT Images 2.0',
      canvaFallbackSuggested: false,
    },
  ],
} as unknown as ImagePromptSet;

test('formatTelegramPacket labels posts as x/6 and is pure', () => {
  assert.equal(TOTAL_DAILY_SLOTS, 6);
  const packet = formatTelegramPacket(
    { copy: baseCopy, strategy: baseStrategy, format: baseFormat, promptSet: basePromptSet, slot: SLOT_CONFIGS[3] },
    '2026-06-02',
  );
  assert.match(packet.intro, /Post 3\/6/);
  assert.match(packet.intro, /ChatGPT Images 2\.0/);
  assert.match(packet.document, /CHATGPT IMAGES 2\.0 WORKFLOW/);
  assert.match(packet.document, /PRIMARY: ChatGPT Images 2\.0/);
  assert.match(packet.document, /ALTERNATE: Seedream/);
  assert.equal(packet.filename, 'thestatsandstacks-2026-06-02-s3.txt');
  // Pure: same input -> identical output.
  const again = formatTelegramPacket(
    { copy: baseCopy, strategy: baseStrategy, format: baseFormat, promptSet: basePromptSet, slot: SLOT_CONFIGS[3] },
    '2026-06-02',
  );
  assert.equal(packet.document, again.document);
});

test('formatTelegramPacket surfaces a review block when present', () => {
  const packet = formatTelegramPacket(
    {
      copy: baseCopy,
      strategy: baseStrategy,
      format: baseFormat,
      promptSet: basePromptSet,
      slot: SLOT_CONFIGS[2],
      reviewBlock: 'RECORD_HIGH_CLAIM: verify S&P 500 level against an official source.',
    },
    '2026-06-02',
  );
  assert.match(packet.intro, /HUMAN REVIEW REQUIRED/);
  assert.match(packet.document, /RECORD_HIGH_CLAIM/);
});
