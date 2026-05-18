// platform/src/lib/render/puppeteerRenderer.ts
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Browser } from 'puppeteer-core';
import { SLIDE_TEMPLATES, CoverSlide } from '../../components/slide-templates';

// tsx runs in ESM context; derive __dirname from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let browser: Browser | null = null;

export async function getOrCreateBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!execPath) {
    throw new Error(
      'PUPPETEER_EXECUTABLE_PATH is not set. Set it to the path of Chrome or Chromium.',
    );
  }
  const puppeteer = (await import('puppeteer-core')).default;
  browser = await puppeteer.launch({
    executablePath: execPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
    defaultViewport: { width: 1080, height: 1350 },
  });
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export async function renderSlideToBuffer(
  template: string,
  props: Record<string, unknown>,
): Promise<Buffer> {
  const b = await getOrCreateBrowser();
  const page = await b.newPage();
  try {
    const html = buildSlideHtml(template, props);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buf = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: 1080, height: 1350 },
    });
    return buf as Buffer;
  } finally {
    await page.close();
  }
}

export function buildSlideHtml(template: string, props: Record<string, unknown>): string {
  const Component = SLIDE_TEMPLATES[template] ?? CoverSlide;
  const componentHtml = renderToStaticMarkup(React.createElement(Component, props));

  const tokensCssPath = path.join(__dirname, '../../app/render/tokens.css');
  const slidesCssPath = path.join(__dirname, '../../components/slide-templates/slides.css');
  const tokensCss = fs.existsSync(tokensCssPath) ? fs.readFileSync(tokensCssPath, 'utf-8') : '';
  const slidesCss = fs.existsSync(slidesCssPath) ? fs.readFileSync(slidesCssPath, 'utf-8') : '';

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700;14..32,800;14..32,900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>${tokensCss}</style>
<style>${slidesCss}</style>
<style>html,body{margin:0;padding:0;width:1080px;height:1350px;overflow:hidden;background:#020617;}</style>
</head>
<body>${componentHtml}</body>
</html>`;
}
