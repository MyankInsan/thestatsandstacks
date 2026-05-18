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
