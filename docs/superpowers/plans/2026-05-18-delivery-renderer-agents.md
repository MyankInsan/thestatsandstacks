# TheStatsAndStacks — Delivery, Renderer, and Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Telegram delivery so slides arrive as inline photos with copy-ready labeled messages; replace the Sharp/SVG renderer with Puppeteer + React slide templates using Inter/JetBrains Mono webfonts; add six new agents, structured Vision Critic output, and a real-data dashboard.

**Architecture:** Three independent phases. Phase 1 rewrites two service files — immediate UX win, no new deps. Phase 2 adds a `puppeteerRenderer.ts` module that SSR-renders TSX slide templates to HTML and screenshots them at 1080×1350; the existing `generateLocalSlides()` path delegates to Puppeteer when `PUPPETEER_EXECUTABLE_PATH` is set and falls back to Sharp/SVG otherwise. Phase 3 adds six agents, two Prisma models, and ports the design system dashboard components.

**Tech Stack:** Node 24, TypeScript, `puppeteer-core`, React 18 `renderToStaticMarkup`, `node:test`, Prisma (SQLite/Postgres), BullMQ, Telegram Bot API `sendMediaGroup`.

---

## Phase 1 — Fix Telegram and email delivery

### Task 1: Add pure message-builder exports and tests to `telegramDelivery.ts`

**Files:**
- Modify: `platform/src/lib/services/telegramDelivery.ts`
- Create: `platform/__tests__/telegramDelivery.test.ts`

- [ ] **Step 1.1: Write the failing tests**

```typescript
// platform/__tests__/telegramDelivery.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAlbumCaption,
  buildCaptionMessage,
  buildHashtagsMessage,
  buildPinnedCommentMessage,
  chunkIntoAlbums,
} from '../src/lib/services/telegramDelivery';

const mockStrategy = {
  topic: 'TFSA vs RRSP',
  hook: 'The wrong account costs you.',
  format: 'CAROUSEL' as const,
  slideCount: 6,
  slideBreakdown: [],
  reasoning: '',
  targetAudience: '',
  searchKeywords: [],
};

const mockQA = {
  allPassed: true,
  slideReports: [],
  overallScore: 0.91,
  failedSlides: [],
};

test('buildAlbumCaption includes topic, format, and QA score', () => {
  const result = buildAlbumCaption(mockStrategy, mockQA);
  assert.ok(result.includes('TFSA vs RRSP'));
  assert.ok(result.includes('CAROUSEL'));
  assert.ok(result.includes('91%'));
});

test('buildCaptionMessage has the correct prefix', () => {
  const result = buildCaptionMessage('My caption here.');
  assert.ok(result.startsWith('📝 CAPTION'));
  assert.ok(result.includes('My caption here.'));
});

test('buildHashtagsMessage has the correct prefix', () => {
  const result = buildHashtagsMessage('#CanadianFinance');
  assert.ok(result.startsWith('# HASHTAGS'));
  assert.ok(result.includes('#CanadianFinance'));
});

test('buildPinnedCommentMessage has the correct prefix', () => {
  const result = buildPinnedCommentMessage('What would you check first?');
  assert.ok(result.startsWith('📌 PIN THIS COMMENT'));
  assert.ok(result.includes('What would you check first?'));
});

test('chunkIntoAlbums splits correctly at MAX boundary', () => {
  const items = Array.from({ length: 12 }, (_, i) => i);
  const chunks = chunkIntoAlbums(items, 10);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].length, 10);
  assert.equal(chunks[1].length, 2);
});

test('chunkIntoAlbums returns single chunk when items <= max', () => {
  const items = [1, 2, 3];
  const chunks = chunkIntoAlbums(items, 10);
  assert.equal(chunks.length, 1);
  assert.deepEqual(chunks[0], [1, 2, 3]);
});
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
cd platform && npm test -- --test-name-pattern "buildAlbumCaption|buildCaptionMessage|buildHashtagsMessage|buildPinnedCommentMessage|chunkIntoAlbums" 2>&1 | head -20
```

Expected: fails with "is not a function" or similar since exports don't exist yet.

- [ ] **Step 1.3: Add the exported pure functions to `telegramDelivery.ts`**

Add these exports at the bottom of `platform/src/lib/services/telegramDelivery.ts` (before any existing helper functions):

```typescript
export function buildAlbumCaption(strategy: StrategyDecision, qaReport: QAReport): string {
  return `TheStatsAndStacks\n${strategy.topic}\n${strategy.format} · QA ${(qaReport.overallScore * 100).toFixed(0)}%`;
}

export function buildCaptionMessage(caption: string): string {
  return `📝 CAPTION — copy this into Instagram:\n\n${caption}`;
}

export function buildHashtagsMessage(hashtags: string): string {
  return `# HASHTAGS — copy these:\n\n${hashtags}`;
}

export function buildPinnedCommentMessage(firstComment: string): string {
  return `📌 PIN THIS COMMENT — post after publishing:\n\n${firstComment}`;
}

export function chunkIntoAlbums<T>(items: T[], maxPerAlbum: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += maxPerAlbum) {
    chunks.push(items.slice(i, i + maxPerAlbum));
  }
  return chunks;
}
```

- [ ] **Step 1.4: Run tests to confirm they pass**

```bash
cd platform && npm test -- --test-name-pattern "buildAlbumCaption|buildCaptionMessage|buildHashtagsMessage|buildPinnedCommentMessage|chunkIntoAlbums"
```

Expected: 6 passing tests.

- [ ] **Step 1.5: Commit**

```bash
git add platform/__tests__/telegramDelivery.test.ts platform/src/lib/services/telegramDelivery.ts
git commit -m "feat: add pure message-builder exports to telegramDelivery"
```

---

### Task 2: Replace `sendDocument` image loop with `sendMediaGroup` + 4 labeled messages

**Files:**
- Modify: `platform/src/lib/services/telegramDelivery.ts`

- [ ] **Step 2.1: Replace `sendPostToTelegram` and add `sendPhotoAlbum` helper**

Replace the entire `sendPostToTelegram` function and the `uploadTelegramDocument`-for-images call with the following. Keep the existing `callTelegram`, `withTelegramRetry`, `fetchWithTimeout`, `delay`, and `buildMediaSummary` helpers unchanged. Keep `uploadTelegramDocument` for the reference documents.

```typescript
const MAX_PHOTOS_PER_ALBUM = 10;

export async function sendPostToTelegram(input: {
  images: GeneratedImage[];
  copy: CopyBundle;
  strategy: StrategyDecision;
  qaReport: QAReport;
  manualPromptPath?: string;
  researchBriefPath?: string;
  visualAssetPlanPath?: string;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[TelegramDelivery] Skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set).');
    return;
  }

  // 1: Photo album — images display inline, not as file downloads
  await sendPhotoAlbum(token, chatId, input.images, buildAlbumCaption(input.strategy, input.qaReport));

  // 2: Caption — copy-ready labeled message
  await callTelegram(token, 'sendMessage', {
    chat_id: chatId,
    text: buildCaptionMessage(input.copy.caption).slice(0, 4096),
  });

  // 3: Hashtags — copy-ready labeled message
  await callTelegram(token, 'sendMessage', {
    chat_id: chatId,
    text: buildHashtagsMessage(input.copy.hashtags).slice(0, 4096),
  });

  // 4: Pinned comment — copy-ready labeled message
  await callTelegram(token, 'sendMessage', {
    chat_id: chatId,
    text: buildPinnedCommentMessage(input.copy.firstComment).slice(0, 4096),
  });

  // Reference documents (research brief, visual plan, manual prompts)
  const docs: Array<{ path: string | undefined; caption: string }> = [
    { path: input.manualPromptPath,     caption: 'Manual image prompts & style lock' },
    { path: input.researchBriefPath,    caption: 'Research brief & content rationale' },
    { path: input.visualAssetPlanPath,  caption: 'Visual source plan & attribution' },
  ];
  for (const doc of docs) {
    if (doc.path && fs.existsSync(doc.path)) {
      await uploadTelegramDocument({
        token, chatId,
        filePath: doc.path,
        caption: doc.caption,
        contentType: 'text/markdown',
      });
    }
  }

  console.log(`[TelegramDelivery] ✅ Sent ${input.images.length} slides as inline photos + 3 copy-ready messages.`);
}

async function sendPhotoAlbum(
  token: string,
  chatId: string,
  images: GeneratedImage[],
  firstCaption: string,
): Promise<void> {
  const chunks = chunkIntoAlbums(images, MAX_PHOTOS_PER_ALBUM);

  for (const [chunkIdx, chunk] of chunks.entries()) {
    await withTelegramRetry(`sendMediaGroup:chunk${chunkIdx}`, async () => {
      const form = new FormData();
      form.append('chat_id', chatId);

      const mediaArr = chunk.map((img, localIdx) => {
        const globalIdx = chunkIdx * MAX_PHOTOS_PER_ALBUM + localIdx;
        const fieldName = `photo${globalIdx}`;
        const buf = fs.readFileSync(img.localPath);
        form.append(
          fieldName,
          new Blob([new Uint8Array(buf)], { type: 'image/png' }),
          path.basename(img.localPath),
        );
        return {
          type: 'photo',
          media: `attach://${fieldName}`,
          ...(globalIdx === 0 ? { caption: firstCaption } : {}),
        };
      });

      form.append('media', JSON.stringify(mediaArr));

      const response = await fetchWithTimeout(
        `https://api.telegram.org/bot${token}/sendMediaGroup`,
        { method: 'POST', body: form },
      );
      if (!response.ok) {
        throw new Error(`Telegram sendMediaGroup chunk ${chunkIdx} failed: ${response.status} ${await response.text()}`);
      }
    });
  }
}
```

- [ ] **Step 2.2: Run the full test suite to confirm nothing broke**

```bash
cd platform && npm test
```

Expected: all existing tests pass.

- [ ] **Step 2.3: Commit**

```bash
git add platform/src/lib/services/telegramDelivery.ts
git commit -m "feat: send slides as inline Telegram photos with 4 labeled copy-ready messages"
```

---

### Task 3: Add labeled PIN THIS COMMENT section to email delivery

**Files:**
- Modify: `platform/src/lib/services/emailDelivery.ts`

The HTML body currently shows `firstComment` without a "pin this" instruction. The plain-text version does say "Post this immediately after publishing" but doesn't label it as a pinned comment.

- [ ] **Step 3.1: Update both the HTML and plain-text sections in `emailDelivery.ts`**

Find the HTML block that renders `firstComment`:
```html
<div style="background: #1E293B; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
  <p style="color: #94A3B8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">💬 FIRST COMMENT — Post this right after publishing:</p>
  <p style="color: #E2E8F0; font-size: 13px; margin: 0;">${copy.firstComment}</p>
</div>
```

Replace with:
```html
<div style="background: #1E293B; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
  <p style="color: #94A3B8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">📌 PIN THIS COMMENT — Post this immediately after publishing, then pin it to the top of your comments:</p>
  <p style="color: #E2E8F0; font-size: 13px; margin: 0;">${copy.firstComment}</p>
</div>
```

Find the plain-text section header:
```
💬 FIRST COMMENT (Post this immediately after publishing):
```

Replace with:
```
📌 PIN THIS COMMENT (Post immediately after publishing — then pin it to the top of your comments):
```

- [ ] **Step 3.2: Run tests**

```bash
cd platform && npm test
```

Expected: all tests pass.

- [ ] **Step 3.3: Commit**

```bash
git add platform/src/lib/services/emailDelivery.ts
git commit -m "fix: label email first-comment section as pinned comment"
```

---

## Phase 2 — Puppeteer renderer + React slide templates

### Task 4: Install `puppeteer-core` and update GitHub Actions workflow

**Files:**
- Modify: `platform/package.json`
- Modify: `.github/workflows/daily-post.yml`

- [ ] **Step 4.1: Install `puppeteer-core`**

```bash
cd platform && npm install puppeteer-core
```

- [ ] **Step 4.2: Add Chromium install step and env var to `daily-post.yml`**

Find the `steps:` block. After `- name: Checkout code` and before `- name: Check Vancouver send window`, add:

```yaml
      - name: Install Chromium
        run: sudo apt-get update -qq && sudo apt-get install -y chromium-browser
```

In the `- name: Run Daily Pipeline` step, add to the `env:` block:

```yaml
          PUPPETEER_EXECUTABLE_PATH: /usr/bin/chromium-browser
          PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: "true"
```

- [ ] **Step 4.3: Add `PUPPETEER_EXECUTABLE_PATH` to `platform/env.example`**

Append to `platform/env.example`:
```
# Puppeteer renderer (Phase 2)
# macOS: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
# Linux / CI: /usr/bin/chromium-browser
PUPPETEER_EXECUTABLE_PATH=
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
```

- [ ] **Step 4.4: Commit**

```bash
git add platform/package.json platform/package-lock.json platform/env.example .github/workflows/daily-post.yml
git commit -m "chore: add puppeteer-core and Chromium CI setup for slide renderer"
```

---

### Task 5: Copy design tokens CSS and slides CSS

**Files:**
- Create: `platform/src/app/render/tokens.css`
- Create: `platform/src/components/slide-templates/slides.css`

- [ ] **Step 5.1: Copy `colors_and_type.css` from the design bundle**

Copy `/tmp/design-bundle/thestatsandstacks-design-system/project/colors_and_type.css` verbatim to `platform/src/app/render/tokens.css`.

Note: the file has a syntax error at line 220 — the `:root {}` closing brace is followed by a rule without a selector (`background: var(--surface-app)` is orphaned). This needs a `.tss body {` wrapper. Find this section:

```css
  --pulse-dur:  2s;       /* emerald system-status dot */
}

  background: var(--surface-app);
```

And replace with:

```css
  --pulse-dur:  2s;       /* emerald system-status dot */
}

.tss body {
  background: var(--surface-app);
```

Then close it with `}` after the last `.tss .slide-grid { ... }` block.

- [ ] **Step 5.2: Copy `slides.css` from the design bundle**

Copy `/tmp/design-bundle/thestatsandstacks-design-system/project/ui_kits/slides/slides.css` verbatim to `platform/src/components/slide-templates/slides.css`.

- [ ] **Step 5.3: Create the render directory**

```bash
mkdir -p platform/src/app/render/slide platform/src/components/slide-templates
```

- [ ] **Step 5.4: Commit**

```bash
git add platform/src/app/render/tokens.css platform/src/components/slide-templates/slides.css
git commit -m "chore: add design token CSS and slide canvas CSS"
```

---

### Task 6: Port `SlideFrame` and `CoverSlide` as TSX, add renderer test

**Files:**
- Create: `platform/src/components/slide-templates/SlideFrame.tsx`
- Create: `platform/src/components/slide-templates/CoverSlide.tsx`
- Create: `platform/__tests__/slideTemplates.test.ts`

- [ ] **Step 6.1: Write the failing render test**

```typescript
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
```

- [ ] **Step 6.2: Run to confirm failure**

```bash
cd platform && npm test -- --test-name-pattern "SlideFrame|CoverSlide"
```

Expected: fails — modules don't exist yet.

- [ ] **Step 6.3: Create `SlideFrame.tsx`**

Port directly from the JSX. Remove `window.SlideFrame = SlideFrame`. The `useEffect`/`useRef` for ResizeObserver stay — they're silently skipped during `renderToStaticMarkup` and work correctly in the browser render route.

```tsx
// platform/src/components/slide-templates/SlideFrame.tsx
'use client';
import React, { useEffect, useRef } from 'react';

interface SlideFrameProps {
  children?: React.ReactNode;
  label?: string;
  frameNo?: number;
  totalFrames?: number;
  theme?: { acc?: string; acc2?: string; acc3?: string; bg?: string };
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  hideBrand?: boolean;
  hideFooter?: boolean;
  footer?: Record<string, unknown>;
  scale?: boolean;
}

function BrandMark() {
  return (
    <svg className="brand-bar__mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0B1120" />
      <g transform="translate(8 6)">
        <path d="M0 50 L0 0 L50 0" fill="#34D399" opacity="0.95" />
        <path d="M13 36 L23 24 L33 30 L45 14" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 46 H46" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M16 46 V38 M28 46 V30 M40 46 V23" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function SlideFrame({
  children,
  frameNo,
  totalFrames,
  theme = {},
  tone = 'emerald',
  hideBrand = false,
  hideFooter = false,
  scale = true,
}: SlideFrameProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scale) return;
    const fit = () => {
      if (!stageRef.current || !frameRef.current) return;
      const s = stageRef.current.getBoundingClientRect();
      const k = Math.min(s.width / 1080, s.height / 1350);
      frameRef.current.style.transform = `scale(${k})`;
      frameRef.current.style.transformOrigin = 'center center';
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, [scale]);

  const style: React.CSSProperties = {
    ['--acc' as string]: theme.acc ?? 'var(--tone-acc)',
    ['--acc-2' as string]: theme.acc2 ?? 'var(--tone-acc-soft)',
    ['--acc-3' as string]: theme.acc3 ?? 'var(--tone-acc-soft)',
    background: theme.bg ?? 'linear-gradient(135deg,#06101D 0%,#0d1b2a 52%,#111111 100%)',
  };

  return (
    <div className={scale ? 'slide-stage' : 'slide-stage slide-stage--inline'} ref={stageRef}>
      <div className={`slide-frame tone-${tone}`} ref={frameRef} style={style}>
        <div className="halo" />
        {!hideBrand && (
          <div className="brand-bar">
            <div className="brand-bar__left">
              <BrandMark />
              <div className="brand-bar__wm">TheStatsAndStacks</div>
            </div>
            {frameNo && (
              <div className="brand-bar__frame">
                {String(frameNo).padStart(2, '0')}
                {totalFrames ? ` / ${String(totalFrames).padStart(2, '0')}` : ''}
              </div>
            )}
          </div>
        )}
        {!hideBrand && <div className="brand-bar__rule" />}
        {children}
        {!hideFooter && (
          <div className="foot-bar">
            <div className="foot-bar__l"><span>EDUCATIONAL ONLY</span></div>
            <div className="foot-bar__r"><span>@THESTATSANDSTACKS</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6.4: Create `CoverSlide.tsx`**

```tsx
// platform/src/components/slide-templates/CoverSlide.tsx
'use client';
import React from 'react';
import { SlideFrame } from './SlideFrame';

interface CoverSlideProps {
  eyebrow?: string;
  headline: string;
  accent?: string;
  kicker?: string;
  frameNo?: number;
  totalFrames?: number;
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  footer?: Record<string, unknown>;
}

export function CoverSlide({
  eyebrow = 'MARKET EDUCATION',
  headline,
  accent,
  kicker = 'Swipe for the research filter, not a buy signal.',
  frameNo = 1,
  totalFrames = 6,
  tone = 'emerald',
  footer,
}: CoverSlideProps) {
  const parts = accent ? headline.split(accent) : [headline];
  return (
    <SlideFrame frameNo={frameNo} totalFrames={totalFrames} tone={tone} footer={footer} scale={false}>
      <div className="grid-bg" />
      <div className="frame-body" style={{ gap: 32, paddingTop: 16 }}>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="display" style={{ fontSize: 116, margin: 0, lineHeight: 0.98, fontWeight: 800 }}>
          {parts.map((p, i) => (
            <span key={i}>
              {p}
              {accent && i < parts.length - 1 && <em>{accent}</em>}
            </span>
          ))}
        </h1>
        <div style={{ fontSize: 28, fontWeight: 500, color: '#94A3B8', lineHeight: 1.4, maxWidth: 820 }}>
          {kicker}
        </div>
      </div>
    </SlideFrame>
  );
}
```

Note: `scale={false}` on `SlideFrame` is used for all templates — when rendering for screenshot, the browser viewport is already 1080×1350.

- [ ] **Step 6.5: Run tests to confirm they pass**

```bash
cd platform && npm test -- --test-name-pattern "SlideFrame|CoverSlide"
```

Expected: 2 passing tests.

- [ ] **Step 6.6: Commit**

```bash
git add platform/src/components/slide-templates/ platform/__tests__/slideTemplates.test.ts
git commit -m "feat: port SlideFrame and CoverSlide as TSX with render tests"
```

---

### Task 7: Port remaining 11 slide templates

**Files:**
- Create: `platform/src/components/slide-templates/PureCoverSlide.tsx`
- Create: `platform/src/components/slide-templates/MarketPosterSlide.tsx`
- Create: `platform/src/components/slide-templates/FrameworkSlide.tsx`
- Create: `platform/src/components/slide-templates/ComparisonSlide.tsx`
- Create: `platform/src/components/slide-templates/MythVsFactSlide.tsx`
- Create: `platform/src/components/slide-templates/BigNumberSlide.tsx`
- Create: `platform/src/components/slide-templates/PureStatSlide.tsx`
- Create: `platform/src/components/slide-templates/QuoteSlide.tsx`
- Create: `platform/src/components/slide-templates/CashflowSlide.tsx`
- Create: `platform/src/components/slide-templates/RiskMapSlide.tsx`
- Create: `platform/src/components/slide-templates/OutroSlide.tsx`
- Create: `platform/src/components/slide-templates/index.ts`
- Modify: `platform/__tests__/slideTemplates.test.ts`

- [ ] **Step 7.1: Add render tests for all 11 templates**

Append to `platform/__tests__/slideTemplates.test.ts`:

```typescript
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
```

- [ ] **Step 7.2: Run to confirm failures**

```bash
cd platform && npm test -- --test-name-pattern "renders without throwing"
```

Expected: 11 failures for the new templates.

- [ ] **Step 7.3: Port each template**

Port each JSX file from `/tmp/design-bundle/thestatsandstacks-design-system/project/ui_kits/slides/slides/` to a matching `.tsx` file. For each file:
1. Add `'use client';` at the top
2. Add `import React from 'react';` and `import { SlideFrame } from './SlideFrame';`
3. Define a TypeScript interface for props
4. Export the component as a named export (e.g. `export function MarketPosterSlide(...)`)
5. Add `scale={false}` to every `<SlideFrame>` usage
6. Remove `window.ComponentName = ComponentName;`

The source files are at:
- `/tmp/design-bundle/thestatsandstacks-design-system/project/ui_kits/slides/slides/PureCoverSlide.jsx`
- `/tmp/design-bundle/thestatsandstacks-design-system/project/ui_kits/slides/slides/MarketPosterSlide.jsx`
- `/tmp/design-bundle/thestatsandstacks-design-system/project/ui_kits/slides/slides/FrameworkSlide.jsx`
- `/tmp/design-bundle/thestatsandstacks-design-system/project/ui_kits/slides/slides/ComparisonSlide.jsx`
- `/tmp/design-bundle/thestatsandstacks-design-system/project/ui_kits/slides/slides/MythVsFactSlide.jsx`
- `/tmp/design-bundle/thestatsandstacks-design-system/project/ui_kits/slides/slides/BigNumberSlide.jsx`
- `/tmp/design-bundle/thestatsandstacks-design-system/project/ui_kits/slides/slides/PureStatSlide.jsx`
- `/tmp/design-bundle/thestatsandstacks-design-system/project/ui_kits/slides/slides/QuoteSlide.jsx`
- `/tmp/design-bundle/thestatsandstacks-design-system/project/ui_kits/slides/slides/CashflowSlide.jsx`
- `/tmp/design-bundle/thestatsandstacks-design-system/project/ui_kits/slides/slides/RiskMapSlide.jsx`
- `/tmp/design-bundle/thestatsandstacks-design-system/project/ui_kits/slides/slides/OutroSlide.jsx`

- [ ] **Step 7.4: Create the barrel export `index.ts`**

```typescript
// platform/src/components/slide-templates/index.ts
export { SlideFrame } from './SlideFrame';
export { CoverSlide } from './CoverSlide';
export { PureCoverSlide } from './PureCoverSlide';
export { MarketPosterSlide } from './MarketPosterSlide';
export { FrameworkSlide } from './FrameworkSlide';
export { ComparisonSlide } from './ComparisonSlide';
export { MythVsFactSlide } from './MythVsFactSlide';
export { BigNumberSlide } from './BigNumberSlide';
export { PureStatSlide } from './PureStatSlide';
export { QuoteSlide } from './QuoteSlide';
export { CashflowSlide } from './CashflowSlide';
export { RiskMapSlide } from './RiskMapSlide';
export { OutroSlide } from './OutroSlide';

import { CoverSlide } from './CoverSlide';
import { PureCoverSlide } from './PureCoverSlide';
import { MarketPosterSlide } from './MarketPosterSlide';
import { FrameworkSlide } from './FrameworkSlide';
import { ComparisonSlide } from './ComparisonSlide';
import { MythVsFactSlide } from './MythVsFactSlide';
import { BigNumberSlide } from './BigNumberSlide';
import { PureStatSlide } from './PureStatSlide';
import { QuoteSlide } from './QuoteSlide';
import { CashflowSlide } from './CashflowSlide';
import { RiskMapSlide } from './RiskMapSlide';
import { OutroSlide } from './OutroSlide';
import React from 'react';

export const SLIDE_TEMPLATES: Record<string, React.ComponentType<Record<string, unknown>>> = {
  CoverSlide,
  PureCoverSlide,
  MarketPosterSlide,
  FrameworkSlide,
  ComparisonSlide,
  MythVsFactSlide,
  BigNumberSlide,
  PureStatSlide,
  QuoteSlide,
  CashflowSlide,
  RiskMapSlide,
  OutroSlide,
};
```

- [ ] **Step 7.5: Run all slide tests**

```bash
cd platform && npm test -- --test-name-pattern "renders without throwing"
```

Expected: 13 passing.

- [ ] **Step 7.6: Commit**

```bash
git add platform/src/components/slide-templates/ platform/__tests__/slideTemplates.test.ts
git commit -m "feat: port all 13 slide templates as TSX with render tests"
```

---

### Task 8: Create `puppeteerRenderer.ts`

**Files:**
- Create: `platform/src/lib/render/puppeteerRenderer.ts`
- Modify: `platform/__tests__/slideTemplates.test.ts`

- [ ] **Step 8.1: Add `buildSlideHtml` test**

Append to `platform/__tests__/slideTemplates.test.ts`:

```typescript
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
```

- [ ] **Step 8.2: Run to confirm failures**

```bash
cd platform && npm test -- --test-name-pattern "buildSlideHtml"
```

- [ ] **Step 8.3: Create `platform/src/lib/render/puppeteerRenderer.ts`**

```typescript
// platform/src/lib/render/puppeteerRenderer.ts
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import fs from 'fs';
import path from 'path';
import type { Browser } from 'puppeteer-core';
import { SLIDE_TEMPLATES, CoverSlide } from '../../components/slide-templates';

let browser: Browser | null = null;

export async function getOrCreateBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!execPath) throw new Error('PUPPETEER_EXECUTABLE_PATH is not set. Set it to the path of Chrome or Chromium.');
  const puppeteer = (await import('puppeteer-core')).default;
  browser = await puppeteer.launch({
    executablePath: execPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1080, height: 1350 },
  });
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) { await browser.close(); browser = null; }
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
    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1350 } });
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
```

- [ ] **Step 8.4: Run tests**

```bash
cd platform && npm test -- --test-name-pattern "buildSlideHtml"
```

Expected: 2 passing.

- [ ] **Step 8.5: Commit**

```bash
git add platform/src/lib/render/ platform/__tests__/slideTemplates.test.ts
git commit -m "feat: add puppeteerRenderer with buildSlideHtml and renderSlideToBuffer"
```

---

### Task 9: Add `template` field to prompt types and wire Puppeteer into `ImageGenerationAgent`

**Files:**
- Modify: `platform/src/lib/agents/imagePromptAgent.ts`
- Modify: `platform/src/lib/agents/imageGenerationAgent.ts`
- Modify: `platform/run-daily.ts`

- [ ] **Step 9.1: Extend the prompt interface in `imagePromptAgent.ts`**

Change:
```typescript
export interface ImagePromptSet {
  prompts: Array<{
    slideNumber: number;
    slideDescription: string;
    dallePrompt: string;
  }>;
}
```

To:
```typescript
export interface SlidePrompt {
  slideNumber: number;
  slideDescription: string;
  dallePrompt: string;
  template: string;
  templateProps: Record<string, unknown>;
}

export interface ImagePromptSet {
  prompts: SlidePrompt[];
}
```

- [ ] **Step 9.2: Emit `template` and `templateProps` from `ImagePromptAgent`**

In `ImagePromptAgent.execute()`, replace the `.map(...)`:

```typescript
return {
  prompts: input.strategy.slideBreakdown.map((slide, index) => {
    const slideNumber = index + 1;
    const template = resolveTemplate(input.strategy, slide, slideNumber);
    return {
      slideNumber,
      slideDescription: slide,
      dallePrompt: buildPremiumImagePrompt(input.strategy, slide, slideNumber),
      template,
      templateProps: buildTemplateProps(input.strategy, slide, slideNumber, template),
    };
  }),
};
```

Add these two helpers at the bottom of the file:

```typescript
function resolveTemplate(strategy: StrategyDecision, slide: string, slideNumber: number): string {
  const lower = slide.toLowerCase();
  if (slideNumber === 1) return 'CoverSlide';
  if (/market|ticker|stock|catalyst|case study|heat/.test(lower)) return 'MarketPosterSlide';
  if (/framework|filter|checklist|step|how to/.test(lower)) return 'FrameworkSlide';
  if (/vs|versus|compare|tfsa.*rrsp|rrsp.*tfsa/.test(lower)) return 'ComparisonSlide';
  if (/myth|fact|misconception|truth/.test(lower)) return 'MythVsFactSlide';
  if (/\$|number|stat|data point|figure/.test(lower)) return 'BigNumberSlide';
  if (/risk|watch|warning|caution/.test(lower)) return 'RiskMapSlide';
  if (/save|follow|cta|outro|takeaway/.test(lower)) return 'OutroSlide';
  return 'FrameworkSlide';
}

function buildTemplateProps(
  strategy: StrategyDecision,
  slide: string,
  slideNumber: number,
  template: string,
): Record<string, unknown> {
  const base = {
    frameNo: slideNumber,
    totalFrames: strategy.slideCount,
    tone: 'emerald' as const,
  };
  if (template === 'CoverSlide') {
    return { ...base, eyebrow: strategy.contentPillar?.toUpperCase() ?? 'MARKET EDUCATION', headline: strategy.hook.toUpperCase(), kicker: slide };
  }
  if (template === 'MarketPosterSlide') {
    const tickerMatch = strategy.topic.match(/\b([A-Z]{2,5})\b/);
    return { ...base, ticker: tickerMatch?.[1] ?? '—', name: strategy.topic, delta: '', headline: slide };
  }
  return { ...base, headline: slide };
}
```

- [ ] **Step 9.3: Add Puppeteer path in `ImageGenerationAgent.generateLocalSlides()`**

In `imageGenerationAgent.ts`, find `generateLocalSlides` (the method that handles the Sharp/SVG path). Add this near the top of the method, before the existing `for (const prompt of input.prompts)` loop:

```typescript
const usePuppeteer = Boolean(process.env.PUPPETEER_EXECUTABLE_PATH);
if (usePuppeteer) {
  return this.generateWithPuppeteer(input);
}
```

Then add the new method to the class:

```typescript
private async generateWithPuppeteer(input: {
  prompts: Array<SlidePrompt>,
  outputDir: string,
  runSlug: string,
}): Promise<{ images: GeneratedImage[] }> {
  const { renderSlideToBuffer, closeBrowser } = await import('../render/puppeteerRenderer');
  const images: GeneratedImage[] = [];
  try {
    for (const prompt of input.prompts) {
      const filename = buildSlideFilename(input.runSlug, prompt.slideNumber);
      const localPath = path.join(input.outputDir, filename);
      const buf = await renderSlideToBuffer(prompt.template, prompt.templateProps);
      fs.writeFileSync(localPath, buf);
      images.push({
        slideNumber: prompt.slideNumber,
        localPath,
        mimeType: 'image/png',
        source: 'local',
      });
      console.log(`   [Puppeteer] Slide ${prompt.slideNumber} rendered: ${filename}`);
    }
  } finally {
    await closeBrowser();
  }
  return { images };
}
```

Add `import type { SlidePrompt } from './imagePromptAgent';` at the top of `imageGenerationAgent.ts`.

- [ ] **Step 9.4: Update the `run-daily.ts` prompts type to use `SlidePrompt`**

Find the `const plannedPrompts` line and change the type annotation where the array is filtered:

```typescript
import type { SlidePrompt } from './src/lib/agents/imagePromptAgent';
// ...
const plannedPrompts: SlidePrompt[] = promptSet.prompts.slice(0, getImageCount(strategy));
```

This ensures TypeScript accepts the extended prompt shape throughout run-daily.ts.

- [ ] **Step 9.5: Run all tests**

```bash
cd platform && npm test
```

Expected: all pass.

- [ ] **Step 9.6: Commit**

```bash
git add platform/src/lib/agents/imagePromptAgent.ts platform/src/lib/agents/imageGenerationAgent.ts platform/run-daily.ts
git commit -m "feat: wire Puppeteer renderer into ImageGenerationAgent via PUPPETEER_EXECUTABLE_PATH"
```

---

### Task 10: Add the Next.js render route (dashboard preview)

**Files:**
- Create: `platform/src/app/render/slide/page.tsx`

This route is for local dashboard preview only. It is NOT used by the standalone `run-daily.ts` script.

- [ ] **Step 10.1: Create `platform/src/app/render/slide/page.tsx`**

```tsx
// platform/src/app/render/slide/page.tsx
'use client';
import React from 'react';
import '../tokens.css';
import '../../../components/slide-templates/slides.css';
import { SLIDE_TEMPLATES, CoverSlide } from '../../../components/slide-templates';

interface PageProps {
  searchParams?: Promise<{ template?: string; props?: string }>;
}

export default async function RenderSlidePage({ searchParams }: PageProps) {
  const params = await searchParams ?? {};
  const templateName = params.template ?? 'CoverSlide';
  let props: Record<string, unknown> = {};
  try {
    if (params.props) props = JSON.parse(decodeURIComponent(params.props));
  } catch {
    // use empty props
  }
  const Component = SLIDE_TEMPLATES[templateName] ?? CoverSlide;
  return (
    <div style={{ width: 1080, height: 1350, overflow: 'hidden', background: '#020617' }}>
      <Component {...props} scale={false} />
    </div>
  );
}
```

- [ ] **Step 10.2: Verify the page compiles**

```bash
cd platform && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10.3: Commit**

```bash
git add platform/src/app/render/
git commit -m "feat: add /render/slide dashboard preview route"
```

---

## Phase 3 — New agents, Prisma schema, and dashboard

### Task 11: Add `AgentRun` and `RegenAttempt` to Prisma schema

**Files:**
- Modify: `platform/prisma/schema.prisma`

Note: these models are used by the web server path (`workflow.ts` and the dashboard). The standalone `run-daily.ts` does not use Prisma and is unaffected.

- [ ] **Step 11.1: Add the two models to `schema.prisma`**

Append at the end of `platform/prisma/schema.prisma`:

```prisma
model AgentRun {
  id        String    @id @default(cuid())
  postId    String
  post      Post      @relation(fields: [postId], references: [id])
  agent     String
  status    String    // 'idle' | 'running' | 'done' | 'failed'
  startedAt DateTime?
  endedAt   DateTime?
  output    Json?
}

model RegenAttempt {
  id          String  @id @default(cuid())
  postId      String
  slideNumber Int
  attempt     Int
  scoreBefore Float
  scoreAfter  Float
  critique    Json
  resolved    Boolean
}
```

Also add back-relations on `Post`:

```prisma
model Post {
  // ... existing fields ...
  AgentRuns      AgentRun[]
  RegenAttempts  RegenAttempt[]
}
```

- [ ] **Step 11.2: Create and apply the migration**

```bash
cd platform && npx prisma migrate dev --name add-agent-run-regen-attempt
```

Expected: migration file created at `prisma/migrations/…_add_agent_run_regen_attempt/migration.sql`, client regenerated.

- [ ] **Step 11.3: Verify no TypeScript errors**

```bash
cd platform && npx tsc --noEmit
```

- [ ] **Step 11.4: Commit**

```bash
git add platform/prisma/
git commit -m "feat: add AgentRun and RegenAttempt Prisma models"
```

---

### Task 12: `TickersInNewsAgent`

**Files:**
- Create: `platform/src/lib/agents/tickersInNewsAgent.ts`
- Modify: `platform/__tests__/agents.test.ts`

- [ ] **Step 12.1: Write the failing test**

Append to `platform/__tests__/agents.test.ts`:

```typescript
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
```

- [ ] **Step 12.2: Run to confirm failure**

```bash
cd platform && npm test -- --test-name-pattern "TickersInNewsAgent"
```

- [ ] **Step 12.3: Create `tickersInNewsAgent.ts`**

```typescript
// platform/src/lib/agents/tickersInNewsAgent.ts
import { BaseAgent } from './interfaces';
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';

export interface TickerNewsEntry {
  symbol: string;
  name: string;
  headline: string;
  source: string;
  publishedAt: string;
  sentiment: -1 | 0 | 1;
}

export interface TickersInNewsResult {
  tickers: TickerNewsEntry[];
}

const RSS_FEEDS = [
  'https://feeds.reuters.com/reuters/businessNews',
  'https://www.cnbc.com/id/10001147/device/rss/rss.html',
];

const MAX_ARTICLES = 30;

export class TickersInNewsAgent extends BaseAgent {
  constructor() {
    super('TickersInNewsAgent');
  }

  async execute(_input: Record<string, never>): Promise<TickersInNewsResult> {
    console.log(`[${this.name}] 📰 Scanning news headlines for market tickers...`);
    const rawItems = await fetchRssHeadlines();
    if (!rawItems.length) {
      console.log(`   No headlines fetched; returning empty tickers list.`);
      return { tickers: [] };
    }
    return this.extractTickersWithGemini(rawItems.slice(0, MAX_ARTICLES));
  }

  private async extractTickersWithGemini(
    headlines: Array<{ title: string; source: string; pubDate: string }>,
  ): Promise<TickersInNewsResult> {
    const model = getGeminiClient().getGenerativeModel({ model: getGeminiTextModelName() });
    const headlineText = headlines.map((h, i) => `${i + 1}. [${h.source}] ${h.title}`).join('\n');
    const prompt = `You are a financial news analyst. Read these headlines and extract only tickers that have clear newsworthy events (earnings, M&A, product launch, regulatory action, unusual price movement).

Headlines:
${headlineText}

Rules:
- Include a ticker only if the headline is specifically about that company.
- sentiment must be exactly -1 (negative news), 0 (neutral/mixed), or 1 (positive news).
- Do NOT include buy/sell/hold recommendations.
- If no tickers have clear events, return an empty array.

Return a JSON object: { "tickers": [ { "symbol": "SNDK", "name": "SanDisk Corp.", "headline": "...", "source": "Reuters", "publishedAt": "...", "sentiment": 1 } ] }`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(text) as TickersInNewsResult;
      return { tickers: (parsed.tickers ?? []).filter(isValidEntry) };
    } catch {
      console.warn(`[${this.name}] Gemini extraction failed; returning empty tickers list.`);
      return { tickers: [] };
    }
  }
}

function isValidEntry(t: Partial<TickerNewsEntry>): t is TickerNewsEntry {
  return (
    typeof t.symbol === 'string' && t.symbol.length > 0 &&
    typeof t.headline === 'string' &&
    typeof t.source === 'string' &&
    [-1, 0, 1].includes(t.sentiment as number)
  );
}

async function fetchRssHeadlines(): Promise<Array<{ title: string; source: string; pubDate: string }>> {
  const results: Array<{ title: string; source: string; pubDate: string }> = [];
  for (const url of RSS_FEEDS) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!resp.ok) continue;
      const xml = await resp.text();
      const source = new URL(url).hostname.replace('www.', '');
      const titleMatches = xml.matchAll(/<title><!\[CDATA\[([^\]]+)]]><\/title>|<title>([^<]+)<\/title>/g);
      const pubDateMatches = xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g);
      const titles = [...titleMatches].map((m) => (m[1] ?? m[2]).trim()).filter(Boolean).slice(1);
      const dates = [...pubDateMatches].map((m) => m[1].trim());
      titles.forEach((t, i) => results.push({ title: t, source, pubDate: dates[i] ?? new Date().toISOString() }));
    } catch {
      // network errors are non-fatal
    }
  }
  return results;
}
```

- [ ] **Step 12.4: Run tests**

```bash
cd platform && npm test -- --test-name-pattern "TickersInNewsAgent"
```

Expected: pass (agent returns valid structure even if RSS feeds time out in test environment).

- [ ] **Step 12.5: Commit**

```bash
git add platform/src/lib/agents/tickersInNewsAgent.ts platform/__tests__/agents.test.ts
git commit -m "feat: add TickersInNewsAgent reading free RSS feeds"
```

---

### Task 13: `HistoryGuardAgent`

**Files:**
- Create: `platform/src/lib/agents/historyGuardAgent.ts`
- Modify: `platform/__tests__/agents.test.ts`

- [ ] **Step 13.1: Write the failing tests**

Append to `platform/__tests__/agents.test.ts`:

```typescript
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
```

- [ ] **Step 13.2: Run to confirm failures**

```bash
cd platform && npm test -- --test-name-pattern "HistoryGuardAgent"
```

- [ ] **Step 13.3: Create `historyGuardAgent.ts`**

```typescript
// platform/src/lib/agents/historyGuardAgent.ts
import { BaseAgent } from './interfaces';
import { ContentHistoryEntry } from '../services/contentHistory';

export interface HistoryGuardResult {
  block: boolean;
  conflictsWith?: string;
  conflictDate?: string;
  suggestedPivot?: string;
}

const BLOCK_THRESHOLD = 0.52;
const WINDOW_DAYS = 60;

export class HistoryGuardAgent extends BaseAgent {
  constructor() {
    super('HistoryGuardAgent');
  }

  async execute(input: {
    topic: string;
    contentHistory: ContentHistoryEntry[];
  }): Promise<HistoryGuardResult> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS);
    const windowedHistory = input.contentHistory.filter(
      (e) => new Date(e.date) >= cutoff,
    );

    const normalized = normalizeWords(input.topic);
    for (const entry of windowedHistory) {
      const entryNorm = normalizeWords(entry.topic);
      const similarity = jaccardSimilarity(normalized, entryNorm);
      if (similarity >= BLOCK_THRESHOLD) {
        const pivot = buildPivotSuggestion(input.topic, entry.topic);
        console.log(`[${this.name}] ⛔ Blocked — "${input.topic}" too similar to "${entry.topic}" (score ${similarity.toFixed(2)}). Pivot: ${pivot}`);
        return { block: true, conflictsWith: entry.topic, conflictDate: entry.date, suggestedPivot: pivot };
      }
    }
    return { block: false };
  }
}

function normalizeWords(text: string): Set<string> {
  const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'is', 'are', 'to', 'of', 'in', 'for', 'on', 'with', 'how', 'vs', 'versus']);
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

function buildPivotSuggestion(topic: string, conflict: string): string {
  return `Try a different angle on this topic — for example, instead of comparing account types, focus on a single lesser-known rule or a case study. (Blocked by: "${conflict}")`;
}
```

- [ ] **Step 13.4: Run tests**

```bash
cd platform && npm test -- --test-name-pattern "HistoryGuardAgent"
```

Expected: 2 passing.

- [ ] **Step 13.5: Commit**

```bash
git add platform/src/lib/agents/historyGuardAgent.ts platform/__tests__/agents.test.ts
git commit -m "feat: add HistoryGuardAgent with 60-day Jaccard similarity block"
```

---

### Task 14: `FinalGateAgent`

**Files:**
- Create: `platform/src/lib/agents/finalGateAgent.ts`
- Modify: `platform/__tests__/agents.test.ts`

- [ ] **Step 14.1: Write the failing tests**

Append to `platform/__tests__/agents.test.ts`:

```typescript
const baseCopy = {
  caption: 'SanDisk is up year-to-date. Here is the research filter. Educational only, not financial advice.',
  hashtags: '#CanadianFinance #InvestingCanada',
  cta: 'Save this.',
  firstComment: 'What would you check first?',
  altText: 'Carousel about SNDK.',
};

test('FinalGateAgent passes clean copy', async () => {
  const { FinalGateAgent } = await import('../src/lib/agents/finalGateAgent');
  const agent = new FinalGateAgent();
  const result = await agent.execute({ copy: baseCopy });
  assert.equal(result.passed, true);
  assert.equal(result.failedChecks.length, 0);
});

test('FinalGateAgent fails on banned hype word', async () => {
  const { FinalGateAgent } = await import('../src/lib/agents/finalGateAgent');
  const agent = new FinalGateAgent();
  const result = await agent.execute({ copy: { ...baseCopy, caption: 'This stock explodes to new highs.' } });
  assert.equal(result.passed, false);
  assert.ok(result.failedChecks.some((c) => c.includes('banned')));
});

test('FinalGateAgent fails when disclosure is missing', async () => {
  const { FinalGateAgent } = await import('../src/lib/agents/finalGateAgent');
  const agent = new FinalGateAgent();
  const result = await agent.execute({ copy: { ...baseCopy, caption: 'Great returns await. Save this.' } });
  assert.equal(result.passed, false);
  assert.ok(result.failedChecks.some((c) => c.includes('disclosure')));
});

test('FinalGateAgent fails when caption exceeds 1100 chars', async () => {
  const { FinalGateAgent } = await import('../src/lib/agents/finalGateAgent');
  const agent = new FinalGateAgent();
  const longCaption = 'A'.repeat(1101) + ' Educational only, not financial advice.';
  const result = await agent.execute({ copy: { ...baseCopy, caption: longCaption } });
  assert.equal(result.passed, false);
  assert.ok(result.failedChecks.some((c) => c.includes('caption')));
});

test('FinalGateAgent fails when hashtag count exceeds 5', async () => {
  const { FinalGateAgent } = await import('../src/lib/agents/finalGateAgent');
  const agent = new FinalGateAgent();
  const result = await agent.execute({ copy: { ...baseCopy, hashtags: '#a #b #c #d #e #f' } });
  assert.equal(result.passed, false);
  assert.ok(result.failedChecks.some((c) => c.includes('hashtag')));
});
```

- [ ] **Step 14.2: Run to confirm failures**

```bash
cd platform && npm test -- --test-name-pattern "FinalGateAgent"
```

- [ ] **Step 14.3: Create `finalGateAgent.ts`**

```typescript
// platform/src/lib/agents/finalGateAgent.ts
import { BaseAgent } from './interfaces';
import { CopyBundle } from './copywritingAgent';

export interface FinalGateResult {
  passed: boolean;
  failedChecks: string[];
  revisedCopy?: CopyBundle;
}

const BANNED_WORDS = ['explodes', 'moons', 'blasts off', 'skyrockets', "can't miss", 'moon shot', 'to the moon'];
const DISCLOSURE_PHRASES = ['educational only', 'not financial advice', 'educational general information'];
const MAX_CAPTION_CHARS = 1100;
const MAX_HASHTAGS = 5;

export class FinalGateAgent extends BaseAgent {
  constructor() {
    super('FinalGateAgent');
  }

  async execute(input: { copy: CopyBundle }): Promise<FinalGateResult> {
    const checks = runChecks(input.copy);
    if (checks.length === 0) {
      console.log(`[${this.name}] ✅ Final gate passed.`);
      return { passed: true, failedChecks: [] };
    }
    console.warn(`[${this.name}] ❌ Final gate failed:`, checks);
    return { passed: false, failedChecks: checks };
  }
}

function runChecks(copy: CopyBundle): string[] {
  const failures: string[] = [];
  const captionLower = copy.caption.toLowerCase();

  const foundBanned = BANNED_WORDS.find((w) => captionLower.includes(w));
  if (foundBanned) failures.push(`Caption contains banned hype word: "${foundBanned}"`);

  const hasDisclosure = DISCLOSURE_PHRASES.some((p) => captionLower.includes(p));
  if (!hasDisclosure) failures.push('Caption is missing the required educational disclosure phrase.');

  if (copy.caption.length > MAX_CAPTION_CHARS) {
    failures.push(`Caption length ${copy.caption.length} exceeds ${MAX_CAPTION_CHARS} character limit.`);
  }

  const hashtagCount = (copy.hashtags.match(/#\S+/g) ?? []).length;
  if (hashtagCount > MAX_HASHTAGS) {
    failures.push(`Hashtag count ${hashtagCount} exceeds ${MAX_HASHTAGS} limit.`);
  }

  return failures;
}
```

- [ ] **Step 14.4: Run tests**

```bash
cd platform && npm test -- --test-name-pattern "FinalGateAgent"
```

Expected: 5 passing.

- [ ] **Step 14.5: Commit**

```bash
git add platform/src/lib/agents/finalGateAgent.ts platform/__tests__/agents.test.ts
git commit -m "feat: add FinalGateAgent with hype-word, disclosure, length, and hashtag checks"
```

---

### Task 15: `RegenLoopAgent` (replaces simple regen loop in `run-daily.ts`)

**Files:**
- Create: `platform/src/lib/agents/regenLoopAgent.ts`
- Modify: `platform/__tests__/agents.test.ts`

- [ ] **Step 15.1: Write the failing tests**

Append to `platform/__tests__/agents.test.ts`:

```typescript
test('RegenLoopAgent returns on first attempt when score >= 0.80', async () => {
  const { RegenLoopAgent } = await import('../src/lib/agents/regenLoopAgent');
  const agent = new RegenLoopAgent();

  let generateCalls = 0;
  const mockGenerate = async () => { generateCalls++; return { slideNumber: 1, localPath: '/tmp/s1.png', mimeType: 'image/png', source: 'local' as const }; };
  const mockCritique = async () => ({ score: 0.92, pass: true, issues: [] });

  const result = await agent.execute({ slideNumber: 1, prompt: { slideNumber: 1, slideDescription: 'Cover', dallePrompt: '', template: 'CoverSlide', templateProps: {} }, generate: mockGenerate, critique: mockCritique });
  assert.equal(result.resolved, true);
  assert.equal(result.attempts, 1);
  assert.equal(generateCalls, 1);
});

test('RegenLoopAgent retries up to MAX_ATTEMPTS then resolves with best available', async () => {
  const { RegenLoopAgent } = await import('../src/lib/agents/regenLoopAgent');
  const agent = new RegenLoopAgent();

  let calls = 0;
  const mockGenerate = async () => { calls++; return { slideNumber: 1, localPath: `/tmp/s1-${calls}.png`, mimeType: 'image/png', source: 'local' as const }; };
  const mockCritique = async () => ({ score: 0.55, pass: false, issues: [{ severity: 'high' as const, body: 'misaligned text' }] });

  const result = await agent.execute({ slideNumber: 1, prompt: { slideNumber: 1, slideDescription: 'Cover', dallePrompt: '', template: 'CoverSlide', templateProps: {} }, generate: mockGenerate, critique: mockCritique });
  assert.equal(calls, 5);
  assert.equal(result.resolved, false);
  assert.equal(result.attempts, 5);
});
```

- [ ] **Step 15.2: Run to confirm failures**

```bash
cd platform && npm test -- --test-name-pattern "RegenLoopAgent"
```

- [ ] **Step 15.3: Create `regenLoopAgent.ts`**

```typescript
// platform/src/lib/agents/regenLoopAgent.ts
import { BaseAgent } from './interfaces';
import { GeneratedImage } from './imageGenerationAgent';

export interface CritiqueResult {
  score: number;
  pass: boolean;
  issues: Array<{ severity: 'high' | 'medium' | 'low'; body: string }>;
  layoutSuggestion?: string;
}

export interface RegenLoopInput {
  slideNumber: number;
  prompt: {
    slideNumber: number;
    slideDescription: string;
    dallePrompt: string;
    template: string;
    templateProps: Record<string, unknown>;
  };
  generate: (prompt: RegenLoopInput['prompt'], correctionNotes: string) => Promise<GeneratedImage>;
  critique: (image: GeneratedImage) => Promise<CritiqueResult>;
}

export interface RegenLoopResult {
  image: GeneratedImage;
  attempts: number;
  resolved: boolean;
  finalScore: number;
  critiqueHistory: CritiqueResult[];
}

const MAX_ATTEMPTS = 5;
const PASS_THRESHOLD = 0.80;

export class RegenLoopAgent extends BaseAgent {
  constructor() {
    super('RegenLoopAgent');
  }

  async execute(input: RegenLoopInput): Promise<RegenLoopResult> {
    const history: CritiqueResult[] = [];
    let correctionNotes = '';
    let bestImage: GeneratedImage | null = null;
    let bestScore = -1;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const image = await input.generate(input.prompt, correctionNotes);
      const critique = await input.critique(image);
      history.push(critique);

      if (critique.score > bestScore) { bestScore = critique.score; bestImage = image; }

      if (critique.pass) {
        console.log(`[${this.name}] ✅ Slide ${input.slideNumber} passed on attempt ${attempt} (score ${(critique.score * 100).toFixed(0)}%).`);
        return { image: bestImage!, attempts: attempt, resolved: true, finalScore: critique.score, critiqueHistory: history };
      }

      correctionNotes = critique.issues.filter((i) => i.severity === 'high').map((i) => i.body).join('. ') || critique.issues.map((i) => i.body).join('. ');
      if (critique.layoutSuggestion) correctionNotes += ` Layout fix: ${critique.layoutSuggestion}`;
      console.warn(`[${this.name}] Attempt ${attempt}/${MAX_ATTEMPTS} slide ${input.slideNumber} failed (score ${(critique.score * 100).toFixed(0)}%). Issues: ${correctionNotes}`);
    }

    console.warn(`[${this.name}] ⚠️ Slide ${input.slideNumber} unresolved after ${MAX_ATTEMPTS} attempts. Using best result (score ${(bestScore * 100).toFixed(0)}%).`);
    return { image: bestImage!, attempts: MAX_ATTEMPTS, resolved: false, finalScore: bestScore, critiqueHistory: history };
  }
}
```

- [ ] **Step 15.4: Run tests**

```bash
cd platform && npm test -- --test-name-pattern "RegenLoopAgent"
```

Expected: 2 passing.

- [ ] **Step 15.5: Commit**

```bash
git add platform/src/lib/agents/regenLoopAgent.ts platform/__tests__/agents.test.ts
git commit -m "feat: add RegenLoopAgent with 5-attempt ceiling and best-result fallback"
```

---

### Task 16: Wire new agents into `run-daily.ts`

**Files:**
- Modify: `platform/run-daily.ts`

- [ ] **Step 16.1: Add TickersInNewsAgent (parallel with HotTopicDeskAgents)**

After the `TrendResearchAgent` import block at the top of `run-daily.ts`, add:

```typescript
import { TickersInNewsAgent } from './src/lib/agents/tickersInNewsAgent';
import { HistoryGuardAgent } from './src/lib/agents/historyGuardAgent';
import { FinalGateAgent } from './src/lib/agents/finalGateAgent';
import { RegenLoopAgent } from './src/lib/agents/regenLoopAgent';
```

- [ ] **Step 16.2: Run TickersInNewsAgent in parallel with AGENT 1 (Trend Research)**

Find the `// ── AGENT 1: TREND RESEARCH ──` block. Before it, add a parallel call:

```typescript
// ── AGENT 1A: TICKERS IN NEWS (parallel with Trend Research) ──
console.log('━━━ AGENT 1A: TICKERS IN NEWS ━━━');
const tickersInNewsPromise = new TickersInNewsAgent().execute({}).catch((err) => {
  console.warn(`   [TickersInNews] Non-fatal failure: ${err instanceof Error ? err.message : err}`);
  return { tickers: [] };
});
```

After the `trends` result is available, resolve the parallel call:

```typescript
const tickersInNews = await tickersInNewsPromise;
console.log(`   Tickers in news: ${tickersInNews.tickers.map((t) => t.symbol).join(', ') || 'none'}`);
```

Then pass `tickersInNews` to the `TrendResearchAgent` by including it in the `execute` call:

```typescript
const trends = await researchAgent.execute({ contentHistory, tickersInNews });
```

Update `TrendResearchAgent.execute()`'s input type to accept `tickersInNews?: TickersInNewsResult` (add as optional — existing callers are unaffected).

- [ ] **Step 16.3: Run HistoryGuardAgent after Trend Research, before Strategy**

After `trends` is resolved and before the AGENT 4 (Content Strategy) block:

```typescript
// ── AGENT 1B: HISTORY GUARD ──
console.log('━━━ AGENT 1B: HISTORY GUARD ━━━');
const topTopic = trends.topics[0]?.title ?? '';
const historyGuard = await new HistoryGuardAgent().execute({ topic: topTopic, contentHistory });
if (historyGuard.block) {
  console.warn(`   ⛔ History Guard blocked "${topTopic}". Pivot: ${historyGuard.suggestedPivot}`);
  // Re-rank: demote the blocked topic and try the next one
  if (trends.topics.length > 1) {
    const [blocked, ...rest] = trends.topics;
    trends.topics = [...rest, { ...blocked, score: (blocked.score ?? 0) * 0.3 }];
    console.log(`   Using next topic: "${trends.topics[0]?.title}"`);
  }
}
```

- [ ] **Step 16.4: Replace the existing regen while-loop with `RegenLoopAgent`**

Find the `while (!qaReport.allPassed && regen < 2)` block (approximately lines 137–148 in `run-daily.ts`) and replace the entire vision QA + regen section:

```typescript
// ── AGENT 9: VISION QA + REGEN LOOP ──
console.log('━━━ AGENT 9: VISION QA + REGEN LOOP ━━━');
const qaAgent = new VisionQAAgent();
const regenAgent = new RegenLoopAgent();
const finalImages: GeneratedImage[] = [];

for (const img of generatedImages.images) {
  const prompt = plannedPrompts.find((p) => p.slideNumber === img.slideNumber);
  if (!prompt) { finalImages.push(img); continue; }

  const result = await regenAgent.execute({
    slideNumber: img.slideNumber,
    prompt,
    generate: async (p, _correctionNotes) => {
      const res = await imageGenAgent.execute({ prompts: [p], outputDir, visualPlan: visualAssetPlan });
      return res.images[0] ?? img;
    },
    critique: async (image) => {
      const report = await qaAgent.execute({ images: [image] });
      const sr = report.slideReports[0];
      return {
        score: sr?.confidenceScore ?? 0,
        pass: (sr?.confidenceScore ?? 0) >= 0.80,
        issues: (sr?.failures ?? []).map((b) => ({ severity: 'high' as const, body: b })),
      };
    },
  });
  finalImages.push(result.image);
}

const qaReport = await qaAgent.execute({ images: finalImages });
console.log(`   📊 Overall QA Score: ${(qaReport.overallScore * 100).toFixed(1)}%`);
if (!qaReport.allPassed) {
  throw new Error(`Image QA failed after regen loop: ${qaReport.slideReports.flatMap((r) => r.failures).join(' ')}`);
}
// Replace generatedImages with final
generatedImages.images.length = 0;
generatedImages.images.push(...finalImages);
```

- [ ] **Step 16.5: Add FinalGateAgent before delivery**

After the AGENT 11 (Final Compliance QA) block and before the email/Telegram delivery, add:

```typescript
// ── AGENT 11B: FINAL GATE ──
console.log('━━━ AGENT 11B: FINAL GATE ━━━');
const finalGate = await new FinalGateAgent().execute({ copy });
if (!finalGate.passed) {
  throw new Error(`Final Gate blocked delivery: ${finalGate.failedChecks.join('; ')}`);
}
```

- [ ] **Step 16.6: Run TypeScript check**

```bash
cd platform && npx tsc --noEmit
```

Fix any type errors. Common issue: `TrendResearchAgent.execute()` input type may need `tickersInNews` added as optional.

- [ ] **Step 16.7: Run all tests**

```bash
cd platform && npm test
```

Expected: all pass.

- [ ] **Step 16.8: Commit**

```bash
git add platform/run-daily.ts platform/src/lib/agents/trendResearchAgent.ts
git commit -m "feat: wire TickersInNews, HistoryGuard, RegenLoop, and FinalGate into run-daily.ts"
```

---

### Task 17: Port dashboard components as TSX

**Files:**
- Create: `platform/src/components/dashboard/dashboard.css`
- Create: `platform/src/components/dashboard/Header.tsx`
- Create: `platform/src/components/dashboard/StatBar.tsx`
- Create: `platform/src/components/dashboard/BriefModule.tsx`
- Create: `platform/src/components/dashboard/SlideGrid.tsx`
- Create: `platform/src/components/dashboard/PostMeta.tsx`
- Create: `platform/src/components/dashboard/RegenLoopCard.tsx`
- Create: `platform/src/components/dashboard/PipelineStrip.tsx`

- [ ] **Step 17.1: Copy `dashboard.css`**

Copy `/tmp/design-bundle/thestatsandstacks-design-system/project/ui_kits/dashboard/dashboard.css` verbatim to `platform/src/components/dashboard/dashboard.css`.

- [ ] **Step 17.2: Port `Header.tsx`**

```tsx
// platform/src/components/dashboard/Header.tsx
'use client';
import React, { useState } from 'react';

function PulseDot() {
  return <span className="pulse-dot" />;
}

function Wordmark() {
  return (
    <h1 className="wordmark">
      The<span className="stats">Stats</span>And<span className="stacks">Stacks</span>
    </h1>
  );
}

interface RunPipelineButtonProps { onRun?: () => Promise<void>; }

function RunPipelineButton({ onRun }: RunPipelineButtonProps) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const handle = async () => {
    setRunning(true); setStatus('Starting agents…');
    if (onRun) {
      try { await onRun(); setStatus('Done.'); }
      catch { setStatus('Pipeline failed.'); }
      finally { setTimeout(() => { setRunning(false); setStatus(''); }, 2000); }
    } else {
      setTimeout(() => setStatus('Trend research…'), 800);
      setTimeout(() => setStatus('Image generation…'), 2000);
      setTimeout(() => { setStatus('Done.'); setTimeout(() => { setRunning(false); setStatus(''); }, 1800); }, 3400);
    }
  };
  return (
    <div className="run-wrap">
      {status && <span className="run-status mono">{status}</span>}
      <button className="btn btn--primary" onClick={handle} disabled={running}>
        {running ? '⏳ Agents working…' : '▶ Run full pipeline'}
      </button>
    </div>
  );
}

export function Header({ onRun }: { onRun?: () => Promise<void> }) {
  return (
    <header className="dash-header">
      <div className="dash-header__inner">
        <div className="dash-header__left">
          <PulseDot />
          <Wordmark />
          <span className="pill pill--emerald mono">SYSTEM ONLINE</span>
        </div>
        <RunPipelineButton onRun={onRun} />
      </div>
      <div className="dash-header__rule" />
    </header>
  );
}
```

- [ ] **Step 17.3: Port `StatBar.tsx`**

```tsx
// platform/src/components/dashboard/StatBar.tsx
import React from 'react';

interface StatProps { value: string | number; label: string; accent?: boolean; }

function Stat({ value, label, accent }: StatProps) {
  return (
    <div className="stat">
      <div className={`stat__value${accent ? ' stat__value--em' : ''}`}>{value}</div>
      <div className="stat__label mono">{label}</div>
    </div>
  );
}

export function StatBar({ posts, ideas, qa }: { posts: number; ideas: number; qa: string }) {
  return (
    <div className="stat-bar">
      <Stat value={posts} label="Posts published" />
      <Stat value={ideas} label="Ideas researched" />
      <Stat value={qa} label="QA score" accent />
    </div>
  );
}
```

- [ ] **Step 17.4: Port `BriefModule.tsx`**

```tsx
// platform/src/components/dashboard/BriefModule.tsx
import React from 'react';

export interface BriefData {
  heatTicker?: string;
  hotTopic: string;
  research: string;
  format: string;
  layout: string;
  compliance: string;
}

function Step({ icon, label, value, status = 'done' }: { icon: string; label: string; value: string; status?: string }) {
  return (
    <div className={`brief__step brief__step--${status}`}>
      <div className="brief__step-head">
        <span className="brief__icon">{icon}</span>
        <span className="brief__label mono">{label}</span>
      </div>
      <div className="brief__value">{value}</div>
    </div>
  );
}

export function BriefModule({ brief }: { brief: BriefData }) {
  return (
    <section className="brief">
      <header className="brief__header">
        <h2 className="brief__title">{"Today's brief"}</h2>
        {brief.heatTicker && <span className="pill pill--cyan mono">MARKET HEAT · {brief.heatTicker}</span>}
      </header>
      <div className="brief__chain">
        <Step icon="🔥" label="HOT TOPIC"  value={brief.hotTopic} />
        <Step icon="🔍" label="RESEARCH"   value={brief.research} />
        <Step icon="🧭" label="FORMAT"     value={brief.format} />
        <Step icon="📐" label="LAYOUT"     value={brief.layout} />
        <Step icon="✓"  label="COMPLIANCE" value={brief.compliance} />
      </div>
    </section>
  );
}
```

- [ ] **Step 17.5: Port `SlideGrid.tsx`, `PostMeta.tsx`, `RegenLoopCard.tsx`, `PipelineStrip.tsx`**

For each, port the JSX directly from the design bundle, following the same pattern:
- Add `'use client';` if the component uses `useState`
- Add `import React from 'react';`
- Export as named export
- Remove `window.Component = Component`
- Replace implicit any props with typed interfaces

Source files:
- `/tmp/design-bundle/.../ui_kits/dashboard/components/SlideGrid.jsx` → `SlideGrid.tsx`
- `/tmp/design-bundle/.../ui_kits/dashboard/components/PostMeta.jsx` → `PostMeta.tsx`
- `/tmp/design-bundle/.../ui_kits/dashboard/components/RegenLoopCard.jsx` → `RegenLoopCard.tsx`
- `/tmp/design-bundle/.../ui_kits/dashboard/components/PipelineStrip.jsx` → `PipelineStrip.tsx`

- [ ] **Step 17.6: Verify TypeScript compilation**

```bash
cd platform && npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 17.7: Commit**

```bash
git add platform/src/components/dashboard/
git commit -m "feat: port all 7 dashboard components as TSX"
```

---

### Task 18: Rebuild `page.tsx` with real Prisma data and design system components

**Files:**
- Modify: `platform/src/app/page.tsx`
- Modify: `platform/src/app/globals.css`
- Create: `platform/public/brand/wordmark.svg`
- Create: `platform/public/brand/avatar-mark.svg`

- [ ] **Step 18.1: Copy brand SVG assets**

Copy from the design bundle:
```bash
mkdir -p platform/public/brand
cp /tmp/design-bundle/thestatsandstacks-design-system/project/assets/wordmark.svg platform/public/brand/
cp /tmp/design-bundle/thestatsandstacks-design-system/project/assets/avatar-mark.svg platform/public/brand/
```

- [ ] **Step 18.2: Import tokens CSS in `globals.css`**

Add at the very top of `platform/src/app/globals.css`:

```css
@import './render/tokens.css';
```

- [ ] **Step 18.3: Replace `page.tsx` with real-data dashboard**

```tsx
// platform/src/app/page.tsx
import { PrismaClient } from '@prisma/client';
import './render/tokens.css';
import '../components/dashboard/dashboard.css';
import { Header } from '../components/dashboard/Header';
import { StatBar } from '../components/dashboard/StatBar';
import { BriefModule } from '../components/dashboard/BriefModule';
import { SlideGrid } from '../components/dashboard/SlideGrid';
import { PostMeta } from '../components/dashboard/PostMeta';
import { RegenLoopCard } from '../components/dashboard/RegenLoopCard';
import { PipelineStrip } from '../components/dashboard/PipelineStrip';
import { RunWorkflowButton } from '../components/RunWorkflowButton';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

export default async function Dashboard() {
  const [postsCount, ideasCount, latestPost, agentRuns, regenAttempts] = await Promise.all([
    prisma.post.count(),
    prisma.contentIdea.count(),
    prisma.post.findFirst({
      orderBy: { createdAt: 'desc' },
      include: { brief: true, Assets: { include: { asset: true }, orderBy: { orderIndex: 'asc' } } },
    }),
    latestPost ? prisma.agentRun.findMany({ where: { postId: latestPost.id }, orderBy: { startedAt: 'asc' } }) : [],
    latestPost ? prisma.regenAttempt.findMany({ where: { postId: latestPost.id } }) : [],
  ]);

  const brief = latestPost?.brief ? {
    hotTopic: latestPost.brief.hook,
    research: `${latestPost.Assets?.length ?? 0} slides generated`,
    format: latestPost.brief.format,
    layout: Array.isArray(latestPost.brief.outline) ? (latestPost.brief.outline as string[]).slice(0, 3).join(' · ') : String(latestPost.brief.outline ?? ''),
    compliance: 'Educational frame only · no buy/sell language',
  } : null;

  const slides = (latestPost?.Assets ?? []).map((pa) => ({
    bg: 'linear-gradient(135deg,#06101D,#0d1b2a 55%,#111111)',
    eyebrow: `SLIDE ${pa.orderIndex + 1}`,
    headline: latestPost?.brief?.hook ?? '—',
    viz: 'quote' as const,
    qa: pa.asset.visionScore ?? 0,
    imageUrl: pa.asset.imageUrl,
  }));

  const postMeta = latestPost ? {
    topic: latestPost.brief?.hook ?? '—',
    format: latestPost.brief?.format ?? '—',
    pillar: 'MARKET EDUCATION',
    confidence: latestPost.confidenceScore,
    caption: latestPost.caption,
    hashtags: latestPost.hashtags,
    firstComment: latestPost.firstComment ?? '',
    scheduledFor: latestPost.publishDate?.toLocaleString('en-CA', { timeZone: 'America/Vancouver' }) ?? '—',
    status: latestPost.status,
    statusTone: latestPost.status === 'PUBLISHED' ? 'emerald' : latestPost.status === 'FAILED' ? 'rose' : 'amber',
  } : null;

  const regenEntries = regenAttempts.map((r) => ({
    slide: r.slideNumber,
    status: r.resolved ? 'resolved' : 'retrying',
    attempts: r.attempt,
    cap: 5,
    before: { score: r.scoreBefore, bg: 'linear-gradient(135deg,#06101D,#0d1b2a 55%,#111111)' },
    after:  { score: r.scoreAfter,  bg: 'linear-gradient(135deg,#06101D,#0d1b2a 55%,#111111)' },
    notes: (r.critique as Array<{ severity: string; body: string }>).map((c) => ({ severity: c.severity, text: c.body })),
  }));

  const agents = (agentRuns.length ? agentRuns : defaultAgents()).map((r) => ({
    name: 'agent' in r ? r.agent : (r as { name: string }).name,
    icon: agentIcon('agent' in r ? r.agent : (r as { name: string }).name),
    status: 'status' in r ? r.status : 'done',
  }));

  const qaScore = latestPost ? `${(latestPost.confidenceScore * 100).toFixed(0)}%` : '—';

  return (
    <div className="tss">
      <Header />
      <main className="dash-main">
        <StatBar posts={postsCount} ideas={ideasCount} qa={qaScore} />
        {brief && <BriefModule brief={brief} />}
        <div className="main-row">
          <SlideGrid slides={slides} />
          {postMeta && <PostMeta post={postMeta} />}
        </div>
        {regenEntries.length > 0 && <RegenLoopCard entries={regenEntries} />}
        <PipelineStrip agents={agents} />
      </main>
    </div>
  );
}

function agentIcon(name: string): string {
  const map: Record<string, string> = {
    CostGuardAgent: '◎', HotTopicDeskAgent: '🔥', TickersInNewsAgent: '📰',
    TrendResearchAgent: '🔍', HistoryGuardAgent: '🧬', ContentStrategyAgent: '🧠',
    MediaFormatDecisionAgent: '🧭', ReelPlannerAgent: '🎬', EditorialAgent: '🗞️',
    ComplianceQAAgent: '✓', ImagePromptAgent: '🎨', ImageGenerationAgent: '🖼️',
    SoundDesignAgent: '🎚️', VisionQAAgent: '🔎', RegenLoopAgent: '↻',
    CopywritingAgent: '✍️', FinalGateAgent: '🛡️', PublisherAgent: '🚀',
  };
  return map[name] ?? '◉';
}

function defaultAgents() {
  return [
    'CostGuardAgent', 'HotTopicDeskAgent', 'TickersInNewsAgent', 'TrendResearchAgent',
    'HistoryGuardAgent', 'ContentStrategyAgent', 'MediaFormatDecisionAgent', 'ReelPlannerAgent',
    'EditorialAgent', 'ComplianceQAAgent', 'ImagePromptAgent', 'ImageGenerationAgent',
    'SoundDesignAgent', 'VisionQAAgent', 'RegenLoopAgent', 'CopywritingAgent',
    'FinalGateAgent', 'PublisherAgent',
  ].map((name) => ({ name, status: 'idle' }));
}
```

Note: the Promise.all above has a bug — `latestPost` is not yet resolved when `agentRuns` and `regenAttempts` queries reference it. Fix by splitting into two awaits:

```tsx
const [postsCount, ideasCount, latestPost] = await Promise.all([
  prisma.post.count(),
  prisma.contentIdea.count(),
  prisma.post.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { brief: true, Assets: { include: { asset: true }, orderBy: { orderIndex: 'asc' } } },
  }),
]);

const [agentRuns, regenAttempts] = latestPost
  ? await Promise.all([
      prisma.agentRun.findMany({ where: { postId: latestPost.id }, orderBy: { startedAt: 'asc' } }),
      prisma.regenAttempt.findMany({ where: { postId: latestPost.id } }),
    ])
  : [[], []];
```

- [ ] **Step 18.4: Verify TypeScript compilation**

```bash
cd platform && npx tsc --noEmit
```

Fix type errors. The `SlideGrid`, `PostMeta`, `RegenLoopCard`, and `PipelineStrip` components' prop interfaces must match what `page.tsx` passes in.

- [ ] **Step 18.5: Run all tests**

```bash
cd platform && npm test
```

Expected: all pass.

- [ ] **Step 18.6: Commit**

```bash
git add platform/src/app/ platform/src/components/dashboard/ platform/public/brand/
git commit -m "feat: rebuild dashboard with real Prisma data and design system components"
```

---

## Self-Review Against Spec

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Telegram: sendMediaGroup inline photos | Task 2 |
| Telegram: 4 labeled messages | Task 2 |
| Email: PIN THIS COMMENT label | Task 3 |
| Design tokens CSS | Task 5 |
| Puppeteer renderer + webfonts | Task 8 |
| 13 slide templates ported | Tasks 6–7 |
| `/render/slide` dashboard preview route | Task 10 |
| `template` field in prompt types | Task 9 |
| Puppeteer wired into ImageGenerationAgent | Task 9 |
| `AgentRun` + `RegenAttempt` Prisma models | Task 11 |
| `TickersInNewsAgent` | Task 12 |
| `HistoryGuardAgent` 60-day Jaccard block | Task 13 |
| `FinalGateAgent` hype/disclosure/length/hashtag | Task 14 |
| `RegenLoopAgent` 5-attempt ceiling | Task 15 |
| New agents wired into `run-daily.ts` | Task 16 |
| 7 dashboard components ported | Task 17 |
| Dashboard wired to real Prisma data | Task 18 |
| Brand SVG assets in `/public/brand/` | Task 18 |

**Spec items NOT covered in this plan (deferred per spec):**
- `ReelPlannerAgent` and `SoundDesignAgent` — spec marks these as stubs; deferred until pictures are shipping cleanly
- Video render path (ffmpeg) — explicitly deferred in spec
- BullMQ regen branch — spec acknowledges this is for the web server path; the standalone `run-daily.ts` uses `RegenLoopAgent` directly (Task 15/16)
- Vision Critic structured JSON output — the existing `VisionQAAgent` is used as the critique source inside `RegenLoopAgent` (Task 15); full structured output upgrade of `VisionQAAgent` to return `CritiqueResult` shape is a follow-up task
