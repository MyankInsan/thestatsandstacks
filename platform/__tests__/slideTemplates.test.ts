// platform/__tests__/slideTemplates.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

test('SlideFrame renders without throwing', async () => {
  const { SlideFrame } = await import('../src/components/slide-templates/SlideFrame');
  const html = renderToStaticMarkup(
    React.createElement(SlideFrame, { label: 'TEST', frameNo: 1, totalFrames: 6, tone: 'emerald' },
      React.createElement('div', null, 'content')
    )
  );
  assert.ok(html.includes('EDUCATIONAL ONLY'));
  assert.ok(html.includes('@THESTATSANDSTACKS'));
  assert.ok(html.includes('slide-frame'));
});

test('CoverSlide renders headline and eyebrow', async () => {
  const { CoverSlide } = await import('../src/components/slide-templates/CoverSlide');
  const html = renderToStaticMarkup(
    React.createElement(CoverSlide, {
      eyebrow: 'MARKET EDUCATION',
      headline: 'SAVE THIS FRAMEWORK',
      frameNo: 1,
      totalFrames: 6,
      tone: 'emerald',
    })
  );
  assert.ok(html.includes('MARKET EDUCATION'));
  assert.ok(html.includes('SAVE THIS FRAMEWORK'));
});

const templateTests: Array<[string, Record<string, unknown>]> = [
  ['PureCoverSlide',   { headline: 'TEST HEADLINE' }],
  ['MarketPosterSlide', { ticker: 'SNDK', name: 'SanDisk Corp.', delta: '+18%', headline: 'What happened' }],
  ['FrameworkSlide',   { headline: 'THREE CHECKS', steps: [{ label: 'Step 1', body: 'Body 1' }] }],
  ['ComparisonSlide',  { headline: 'TFSA VS RRSP', left: { label: 'TFSA', points: ['Tax-free growth'] }, right: { label: 'RRSP', points: ['Tax deduction'] } }],
  ['MythVsFactSlide',  { headline: 'COMMON MYTH', myth: 'You need $10K to invest.', fact: 'You can start with any amount.' }],
  ['BigNumberSlide',   { number: '$7,000', label: 'TFSA LIMIT 2024', context: 'Per calendar year' }],
  ['PureStatSlide',    { stat: '72%', label: 'of Canadians have no financial plan' }],
  ['QuoteSlide',       { quote: 'Compound interest is the eighth wonder of the world.', attribution: 'Albert Einstein' }],
  ['CashflowSlide',    { headline: 'WHERE YOUR MONEY GOES', items: [{ label: 'Housing', pct: 35 }] }],
  ['RiskMapSlide',     { headline: 'RISK MAP', risks: [{ label: 'Market risk', severity: 'high' }] }],
  ['OutroSlide',       { cta: 'Save this framework.' }],
];

for (const [name, props] of templateTests) {
  test(`${name} renders without throwing`, async () => {
    const mod = await import(`../src/components/slide-templates/${name}`);
    const Component = mod[name] as React.ComponentType<Record<string, unknown>>;
    assert.ok(typeof Component === 'function');
    const html = renderToStaticMarkup(React.createElement(Component, props));
    assert.ok(html.length > 100, `${name} rendered empty HTML`);
  });
}

test('buildSlideHtml returns complete HTML with font link and slide-frame', async () => {
  const { buildSlideHtml } = await import('../src/lib/render/puppeteerRenderer');
  const html = buildSlideHtml('CoverSlide', {
    headline: 'TFSA vs RRSP',
    eyebrow: 'MARKET EDUCATION',
    frameNo: 1,
    totalFrames: 6,
  });
  assert.ok(html.includes('<!DOCTYPE html>'));
  assert.ok(html.includes('fonts.googleapis.com'));
  assert.ok(html.includes('JetBrains+Mono'));
  assert.ok(html.includes('slide-frame'));
  assert.ok(html.includes('TFSA vs RRSP'));
});

test('buildSlideHtml falls back to CoverSlide for unknown template names', async () => {
  const { buildSlideHtml } = await import('../src/lib/render/puppeteerRenderer');
  const html = buildSlideHtml('UnknownTemplate', { headline: 'Fallback test' });
  assert.ok(html.includes('slide-frame'));
});
