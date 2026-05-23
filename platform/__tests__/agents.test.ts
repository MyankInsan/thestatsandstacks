import test from 'node:test';
import assert from 'node:assert/strict';
import { CostGuardAgent } from '../src/lib/agents/costGuardAgent';
import { ComplianceQAAgent } from '../src/lib/agents/complianceQAAgent';
import { normalizeCopyBundle } from '../src/lib/agents/copywritingAgent';

test('CopywritingAgent normalization caps captions and hashtags for Instagram', () => {
  const longCaption = Array.from({ length: 40 }, () => 'This is a detailed sentence about a money framework.').join(' ');
  const copy = normalizeCopyBundle({
    caption: `${longCaption}\n\n#one #two #three #four #five #six #seven`,
    hashtags: '#one #two #three #four #five #six #seven',
    cta: 'Save this before your next money decision.',
    firstComment: 'Which one would you fix first? #extra',
    altText: 'Alt text',
  }, {
    topic: '5 Money Leaks Canadians Can Fix This Week',
    hook: 'One leak fixed is momentum.',
    format: 'CAROUSEL',
    slideCount: 6,
    slideBreakdown: [],
    reasoning: 'test',
    targetAudience: 'Canadians',
    searchKeywords: ['money leaks'],
  });

  assert.ok(copy.caption.length <= 1100);
  assert.equal((copy.hashtags.match(/#/g) || []).length, 5);
  assert.equal((copy.firstComment.match(/#/g) || []).length, 0);
  assert.match(copy.cta, /Follow TheStatsAndStacks/);
});

test('CopywritingAgent normalization adds a follow reason to short captions', () => {
  const copy = normalizeCopyBundle({
    caption: 'A portfolio needs a quick inspection before more money goes in.',
    hashtags: '#InvestingCanada #RiskManagement',
    cta: 'Save this portfolio check.',
    firstComment: 'What do you check first?',
    altText: 'Portfolio checklist carousel.',
  }, {
    topic: 'The 10-Minute Portfolio Check Before Adding More Money',
    hook: 'Check this before adding money.',
    format: 'WATCHLIST_EDUCATION',
    slideCount: 8,
    slideBreakdown: [],
    reasoning: 'test',
    targetAudience: 'Canadian investors',
    searchKeywords: ['portfolio check'],
  });

  assert.match(copy.caption, /Follow TheStatsAndStacks/);
  assert.match(copy.cta, /calm investing frameworks/);
});

test('CopywritingAgent normalization cleans hot-stock prompt artifacts', () => {
  const copy = normalizeCopyBundle({
    caption: 'SanDisk is a useful case study for the `market catalyst explained` framework. Save this filter and follow @TheStatsAndStacks for calm investing education. This works beyond any single company like `AMD stock` or `Advanced Micro Devices stock`.',
    hashtags: '#SanDisk #AIstorage #ChipStocks',
    cta: 'Save this framework to your investing checklist. Follow TheStatsAndStacks for calm investing frameworks without hype.',
    firstComment: 'Do you check `margins` first?',
    altText: 'SanDisk `risk filter` carousel.',
  }, {
    topic: 'SanDisk (SNDK) AI Storage Heat Check: What the Move Actually Means',
    hook: 'SanDisk is a case study.',
    format: 'WATCHLIST_EDUCATION',
    slideCount: 8,
    slideBreakdown: [],
    reasoning: 'test',
    targetAudience: 'Canadian investors',
    searchKeywords: ['SNDK stock', 'AI storage stocks'],
  });

  assert.doesNotMatch(copy.caption, /`|AMD|Advanced Micro Devices/);
  assert.equal((copy.caption.match(/Follow/gi) || []).length, 1);
  assert.doesNotMatch(copy.firstComment, /`/);
  assert.doesNotMatch(copy.altText, /`/);
});

test('CostGuardAgent blocks paid image generation in zero-cost mode', async () => {
  const originalZeroCost = process.env.ZERO_COST_MODE;
  const originalFreeOnly = process.env.FREE_IMAGE_GENERATION_ONLY;
  const originalPaidImages = process.env.ALLOW_PAID_IMAGE_GENERATION;
  const originalGeminiImages = process.env.GEMINI_IMAGE_GENERATION_ENABLED;
  const originalGeminiSpend = process.env.ALLOW_GEMINI_IMAGE_API_SPEND;
  const originalCloudflareEnabled = process.env.CLOUDFLARE_WORKERS_AI_ENABLED;

  process.env.ZERO_COST_MODE = 'true';
  process.env.FREE_IMAGE_GENERATION_ONLY = 'false';
  process.env.ALLOW_PAID_IMAGE_GENERATION = 'true';
  process.env.GEMINI_IMAGE_GENERATION_ENABLED = 'true';
  process.env.ALLOW_GEMINI_IMAGE_API_SPEND = 'true';
  process.env.CLOUDFLARE_WORKERS_AI_ENABLED = 'false';

  try {
    const report = await new CostGuardAgent().execute();
    assert.equal(report.isSafe, false);
    assert.match(report.failures.join(' '), /ALLOW_PAID_IMAGE_GENERATION/);
    assert.match(report.failures.join(' '), /FREE_IMAGE_GENERATION_ONLY/);
    assert.match(report.failures.join(' '), /GEMINI_IMAGE_GENERATION_ENABLED/);
    assert.match(report.failures.join(' '), /ALLOW_GEMINI_IMAGE_API_SPEND/);
  } finally {
    restoreEnv('ZERO_COST_MODE', originalZeroCost);
    restoreEnv('FREE_IMAGE_GENERATION_ONLY', originalFreeOnly);
    restoreEnv('ALLOW_PAID_IMAGE_GENERATION', originalPaidImages);
    restoreEnv('GEMINI_IMAGE_GENERATION_ENABLED', originalGeminiImages);
    restoreEnv('ALLOW_GEMINI_IMAGE_API_SPEND', originalGeminiSpend);
    restoreEnv('CLOUDFLARE_WORKERS_AI_ENABLED', originalCloudflareEnabled);
  }
});

test('CostGuardAgent allows capped Cloudflare free-allocation image backgrounds', async () => {
  const originals = captureEnv([
    'ZERO_COST_MODE',
    'FREE_IMAGE_GENERATION_ONLY',
    'ALLOW_PAID_IMAGE_GENERATION',
    'CLOUDFLARE_WORKERS_AI_ENABLED',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_IMAGE_MODEL',
    'CLOUDFLARE_MAX_IMAGES_PER_RUN',
    'CLOUDFLARE_ALLOW_PAID_OVERAGE',
    'GOOGLE_IMAGE_SCRAPING_ENABLED',
    'GOOGLE_PHOTOS_SOURCING_ENABLED',
  ]);

  process.env.ZERO_COST_MODE = 'true';
  process.env.FREE_IMAGE_GENERATION_ONLY = 'true';
  process.env.ALLOW_PAID_IMAGE_GENERATION = 'false';
  process.env.CLOUDFLARE_WORKERS_AI_ENABLED = 'true';
  process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
  process.env.CLOUDFLARE_API_TOKEN = 'test-token';
  process.env.CLOUDFLARE_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
  process.env.CLOUDFLARE_MAX_IMAGES_PER_RUN = '8';
  process.env.CLOUDFLARE_ALLOW_PAID_OVERAGE = 'false';
  process.env.GOOGLE_IMAGE_SCRAPING_ENABLED = 'false';
  process.env.GOOGLE_PHOTOS_SOURCING_ENABLED = 'false';

  try {
    const report = await new CostGuardAgent().execute();
    assert.equal(report.isSafe, true);
    assert.match(report.policy, /Cloudflare free-allocation backgrounds/);
  } finally {
    restoreCapturedEnv(originals);
  }
});

test('CostGuardAgent blocks risky Cloudflare image settings in zero-cost mode', async () => {
  const originals = captureEnv([
    'ZERO_COST_MODE',
    'FREE_IMAGE_GENERATION_ONLY',
    'ALLOW_PAID_IMAGE_GENERATION',
    'CLOUDFLARE_WORKERS_AI_ENABLED',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_IMAGE_MODEL',
    'CLOUDFLARE_MAX_IMAGES_PER_RUN',
    'CLOUDFLARE_ALLOW_PAID_OVERAGE',
    'GOOGLE_IMAGE_SCRAPING_ENABLED',
    'GOOGLE_PHOTOS_SOURCING_ENABLED',
  ]);

  process.env.ZERO_COST_MODE = 'true';
  process.env.FREE_IMAGE_GENERATION_ONLY = 'true';
  process.env.ALLOW_PAID_IMAGE_GENERATION = 'false';
  process.env.CLOUDFLARE_WORKERS_AI_ENABLED = 'true';
  process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account';
  process.env.CLOUDFLARE_API_TOKEN = 'test-token';
  process.env.CLOUDFLARE_IMAGE_MODEL = '@cf/leonardo/phoenix-1.0';
  process.env.CLOUDFLARE_MAX_IMAGES_PER_RUN = '12';
  process.env.CLOUDFLARE_ALLOW_PAID_OVERAGE = 'true';
  process.env.GOOGLE_IMAGE_SCRAPING_ENABLED = 'false';
  process.env.GOOGLE_PHOTOS_SOURCING_ENABLED = 'false';

  try {
    const report = await new CostGuardAgent().execute();
    assert.equal(report.isSafe, false);
    assert.match(report.failures.join(' '), /CLOUDFLARE_IMAGE_MODEL/);
    assert.match(report.failures.join(' '), /CLOUDFLARE_MAX_IMAGES_PER_RUN/);
    assert.match(report.failures.join(' '), /CLOUDFLARE_ALLOW_PAID_OVERAGE/);
  } finally {
    restoreCapturedEnv(originals);
  }
});

test('ComplianceQAAgent blocks investment recommendation language', async () => {
  const report = await new ComplianceQAAgent().execute({
    strategy: {
      topic: 'Best stocks to buy now',
      hook: 'Buy these stocks today',
      format: 'WATCHLIST_EDUCATION',
      slideCount: 1,
      slideBreakdown: ['Slide 1: Buy these stocks today | Guaranteed returns | Price target $100'],
      reasoning: 'test',
      targetAudience: 'Canadians',
      searchKeywords: ['stocks'],
    },
  });

  assert.equal(report.isValid, false);
  assert.ok(report.failures.length >= 2);
});

test('ComplianceQAAgent blocks unsafe hot-stock performance claims', async () => {
  const report = await new ComplianceQAAgent().execute({
    strategy: {
      topic: 'SanDisk explodes 4068% in 1 day',
      hook: '4068% today',
      format: 'WATCHLIST_EDUCATION',
      slideCount: 1,
      slideBreakdown: ['Slide 1: SanDisk explodes 4068% in 1 day | Phantom surge | Inactive ticker'],
      reasoning: 'test',
      targetAudience: 'Canadians',
      searchKeywords: ['SNDK stock'],
    },
  });

  assert.equal(report.isValid, false);
  assert.match(report.failures.join(' '), /Hype-style market language/);
  assert.match(report.failures.join(' '), /Extreme one-day performance/);
  assert.match(report.failures.join(' '), /ticker-status/);
});

test('HistoryGuardAgent blocks a topic that matches a recent entry', async () => {
  const { HistoryGuardAgent } = await import('../src/lib/agents/historyGuardAgent');
  const agent = new HistoryGuardAgent();
  const history = [{ date: '2026-05-15', topic: 'TFSA vs RRSP comparison guide', hook: '', format: 'CAROUSEL', slideCount: 6, keywords: ['tfsa', 'rrsp', 'comparison'] }];
  const result = await agent.execute({ topic: 'TFSA vs RRSP: which is better?', contentHistory: history });
  assert.equal(result.block, true);
  assert.ok(typeof result.suggestedPivot === 'string');
});

test('HistoryGuardAgent passes a clearly different topic', async () => {
  const { HistoryGuardAgent } = await import('../src/lib/agents/historyGuardAgent');
  const agent = new HistoryGuardAgent();
  const history = [{ date: '2026-05-15', topic: 'TFSA vs RRSP comparison guide', hook: '', format: 'CAROUSEL', slideCount: 6, keywords: ['tfsa', 'rrsp'] }];
  const result = await agent.execute({ topic: 'How to build an emergency fund', contentHistory: history });
  assert.equal(result.block, false);
});

test('TickersInNewsAgent returns tickers array with required fields', async () => {
  const { TickersInNewsAgent } = await import('../src/lib/agents/tickersInNewsAgent');
  const agent = new TickersInNewsAgent();
  const result = await agent.execute({});
  assert.ok(Array.isArray(result.tickers));
  for (const t of result.tickers) {
    assert.ok(typeof t.symbol === 'string');
    assert.ok(typeof t.headline === 'string');
    assert.ok(typeof t.source === 'string');
    assert.ok([-1, 0, 1].includes(t.sentiment), `sentiment must be -1, 0, or 1, got ${t.sentiment}`);
  }
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

function captureEnv(keys: string[]): Record<string, string | undefined> {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreCapturedEnv(values: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(values)) {
    restoreEnv(key, value);
  }
}
