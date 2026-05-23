# Photo-Only Pipeline Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all video/dashboard code and replace the abstract-background image prompt system with a viral-format-rotating pipeline that outputs complete, ready-to-paste Gemini image prompts (text rendered into the image) delivered as a Telegram document every morning.

**Architecture:** Two new agents (FormatStyleAgent, SlideNarrativeAgent) are inserted between ContentStrategyAgent and the rewritten ImagePromptAgent. FormatStyleAgent picks one of 8 rotating visual formats; SlideNarrativeAgent writes exact slide content (text, colors, visual element) per slide; ImagePromptAgent converts those specs into complete Gemini prompts using a deterministic template — no extra LLM call. Telegram delivery sends one intro message + one `.txt` document attachment.

**Tech Stack:** TypeScript, Node.js test runner via `tsx --test`, Gemini 2.5 Flash (text), no image generation, no Puppeteer, no Remotion, no Redis/BullMQ.

---

## File Map

**Delete entirely:**
- `platform/src/lib/agents/remotionAgent.ts`
- `platform/src/lib/agents/dayTypeAgent.ts`
- `platform/src/lib/agents/imageGenerationAgent.ts`
- `platform/src/lib/agents/visionQAAgent.ts`
- `platform/src/lib/agents/visualAssetSourcingAgent.ts`
- `platform/src/lib/agents/regenLoopAgent.ts`
- `platform/src/lib/agents/mediaPlanningAgent.ts`
- `platform/src/lib/agents/editorialAgent.ts`
- `platform/src/lib/agents/finalGateAgent.ts`
- `platform/src/lib/agents/publisherAgent.ts`
- `platform/src/lib/render/` (directory)
- `platform/src/lib/queue/` (directory)
- `platform/src/lib/services/imageCount.ts`
- `platform/src/remotion/` (directory)
- `platform/src/components/` (entire directory)
- `platform/src/app/api/` (entire directory)
- `platform/src/app/render/` (directory)
- `platform/render-preview.ts`
- `platform/Dockerfile`
- `platform/docker-compose.yml`
- `platform/__tests__/slideTemplates.test.ts`

**Create:**
- `platform/src/lib/agents/formatStyleAgent.ts`
- `platform/src/lib/agents/slideNarrativeAgent.ts`
- `platform/__tests__/formatStyleAgent.test.ts`
- `platform/__tests__/slideNarrativeAgent.test.ts`
- `platform/__tests__/imagePromptAgent.test.ts`

**Rewrite completely:**
- `platform/src/lib/agents/imagePromptAgent.ts`
- `platform/run-daily.ts`
- `platform/src/app/page.tsx` (1-line placeholder)

**Modify:**
- `platform/src/lib/agents/interfaces.ts` — remove video types
- `platform/src/lib/agents/contentStrategyAgent.ts` — remove dead import
- `platform/src/lib/services/contentHistory.ts` — add `formatType` field
- `platform/src/lib/services/telegramDelivery.ts` — remove video/image fns, redesign sendPromptsToTelegram
- `platform/src/app/layout.tsx` — remove slide-template CSS imports
- `platform/package.json` — remove dead deps
- `platform/.github/workflows/daily-post.yml` — strip video env vars + Chromium step
- `platform/__tests__/agents.test.ts` — remove tests for deleted agents

---

## Task 1: Delete all dead code

**Files:** All files listed under "Delete entirely" above.

- [ ] **Step 1: Delete agent files**

```bash
cd platform
rm -f src/lib/agents/remotionAgent.ts
rm -f src/lib/agents/dayTypeAgent.ts
rm -f src/lib/agents/imageGenerationAgent.ts
rm -f src/lib/agents/visionQAAgent.ts
rm -f src/lib/agents/visualAssetSourcingAgent.ts
rm -f src/lib/agents/regenLoopAgent.ts
rm -f src/lib/agents/mediaPlanningAgent.ts
rm -f src/lib/agents/editorialAgent.ts
rm -f src/lib/agents/finalGateAgent.ts
rm -f src/lib/agents/publisherAgent.ts
```

- [ ] **Step 2: Delete infrastructure files**

```bash
rm -rf src/lib/render/
rm -rf src/lib/queue/
rm -f src/lib/services/imageCount.ts
rm -rf src/remotion/
rm -rf src/components/
rm -rf src/app/api/
rm -rf src/app/render/
rm -f render-preview.ts
rm -f Dockerfile
rm -f docker-compose.yml
rm -f __tests__/slideTemplates.test.ts
```

- [ ] **Step 3: Commit**

```bash
cd platform
git add -A
git commit -m "chore: delete video, dashboard, and image generation code"
```

---

## Task 2: Remove dead npm dependencies

**Files:** `platform/package.json`

- [ ] **Step 1: Remove packages**

```bash
cd platform
npm uninstall @remotion/bundler @remotion/renderer remotion puppeteer-core bullmq ioredis sharp node-cron
```

- [ ] **Step 2: Verify package.json — confirm these are gone**

The following should no longer appear in `dependencies` or `devDependencies`:
`@remotion/bundler`, `@remotion/renderer`, `remotion`, `puppeteer-core`, `bullmq`, `ioredis`, `sharp`, `node-cron`

```bash
grep -E "remotion|puppeteer|bullmq|ioredis|sharp|node-cron" package.json
```

Expected output: empty (no matches).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove video and image generation dependencies"
```

---

## Task 3: Clean up interfaces.ts

**Files:** `platform/src/lib/agents/interfaces.ts`

- [ ] **Step 1: Replace the file**

```typescript
// platform/src/lib/agents/interfaces.ts
export interface TrendResearchResult {
  topics: Array<{
    title: string;
    score: number;
    reasoning: string;
    suggestedFormat?: string;
    suggestedSlideCount?: number;
    searchKeywords?: string[];
    sourceUrls?: string[];
    contentPillar?: string;
    freshnessSignal?: string;
  }>;
  signalBriefs?: Array<{
    source: string;
    status: 'live' | 'fallback' | 'disabled';
    summary: string;
    topicSeeds: string[];
    sourceUrls: string[];
  }>;
  generatedAt?: string;
}

export interface ValidationResult {
  isValid: boolean;
  confidenceScore: number;
  failures: string[];
}

export abstract class BaseAgent {
  protected name: string;
  constructor(name: string) {
    this.name = name;
  }
  abstract execute(input: unknown): Promise<unknown>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agents/interfaces.ts
git commit -m "chore: remove video types from interfaces"
```

---

## Task 4: Update contentHistory.ts — add formatType

**Files:** `platform/src/lib/services/contentHistory.ts`

- [ ] **Step 1: Add `formatType` to the interface**

Open `platform/src/lib/services/contentHistory.ts`. Change:

```typescript
export interface ContentHistoryEntry {
  date: string;
  topic: string;
  hook: string;
  format: string;
  slideCount: number;
  keywords: string[];
  visualSignature?: string;
}
```

To:

```typescript
export interface ContentHistoryEntry {
  date: string;
  topic: string;
  hook: string;
  format: string;
  formatType?: string;   // e.g. 'BREAKING_NEWS' | 'HUMOR_MEME' etc.
  slideCount: number;
  keywords: string[];
  visualSignature?: string;
}
```

No other changes needed — `isHistoryEntry` type guard doesn't need to check `formatType` (it's optional).

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/contentHistory.ts
git commit -m "feat: add formatType field to ContentHistoryEntry"
```

---

## Task 5: Fix ContentStrategyAgent dead import

**Files:** `platform/src/lib/agents/contentStrategyAgent.ts`

- [ ] **Step 1: Remove the dead import line**

Find and remove this line (it imports from the now-deleted `mediaPlanningAgent.ts`):

```typescript
import { CarouselPlan, MediaFormatDecision } from './mediaPlanningAgent';
```

Replace the `execute()` input type — change:

```typescript
async execute(input: {
  trends: TrendResearchResult,
  contentHistory?: ContentHistoryEntry[],
  formatDecision?: MediaFormatDecision,
  carouselPlan?: CarouselPlan,
}): Promise<StrategyDecision> {
```

To:

```typescript
async execute(input: {
  trends: TrendResearchResult,
  contentHistory?: ContentHistoryEntry[],
}): Promise<StrategyDecision> {
```

The agent body does not use `formatDecision` or `carouselPlan` in any logic — they were only passed through to the Gemini prompt context. Verify by searching the file:

```bash
grep -n "formatDecision\|carouselPlan" src/lib/agents/contentStrategyAgent.ts
```

If any references remain in the prompt string, remove those lines from the prompt template too.

- [ ] **Step 2: Commit**

```bash
git add src/lib/agents/contentStrategyAgent.ts
git commit -m "chore: remove mediaPlanningAgent dependency from ContentStrategyAgent"
```

---

## Task 6: Implement FormatStyleAgent (with tests)

**Files:**
- Create: `platform/src/lib/agents/formatStyleAgent.ts`
- Create: `platform/__tests__/formatStyleAgent.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// platform/__tests__/formatStyleAgent.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormatStyleAgent, FORMAT_TYPES, COLOR_SCHEMES } from '../src/lib/agents/formatStyleAgent';
import type { StrategyDecision } from '../src/lib/agents/contentStrategyAgent';

const mockStrategy: StrategyDecision = {
  topic: 'NVDA earnings beat',
  hook: 'Nvidia just crushed estimates',
  format: 'CAROUSEL',
  slideCount: 7,
  slideBreakdown: ['Cover', 'The number', 'Why it matters', 'What to watch', 'Risk note', 'Checklist', 'CTA'],
  reasoning: 'Hot topic',
  targetAudience: 'Canadian retail investors',
  searchKeywords: ['NVDA', 'earnings'],
};

test('FormatStyleAgent fallback returns valid FormatDecision shape', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  const agent = new FormatStyleAgent();
  const result = await agent.execute({ strategy: mockStrategy, contentHistory: [], tickerSymbols: ['NVDA'] });

  process.env.GEMINI_API_KEY = saved ?? '';

  assert.ok(FORMAT_TYPES.includes(result.formatType), `Unknown formatType: ${result.formatType}`);
  assert.ok(result.slideCount >= 6 && result.slideCount <= 9, `slideCount out of range: ${result.slideCount}`);
  assert.ok(result.colorScheme.bg.startsWith('#'), 'bg must be hex');
  assert.ok(result.colorScheme.accent1.startsWith('#'), 'accent1 must be hex');
  assert.ok(result.visualTone.length > 0, 'visualTone must not be empty');
});

test('FormatStyleAgent fallback avoids the last two format types', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  const agent = new FormatStyleAgent();
  const result = await agent.execute({
    strategy: mockStrategy,
    contentHistory: [
      { date: '2026-05-21', topic: 't', hook: 'h', format: 'CAROUSEL', formatType: 'BREAKING_NEWS', slideCount: 7, keywords: [] },
      { date: '2026-05-20', topic: 't', hook: 'h', format: 'CAROUSEL', formatType: 'HUMOR_MEME', slideCount: 7, keywords: [] },
    ],
    tickerSymbols: [],
  });

  process.env.GEMINI_API_KEY = saved ?? '';

  assert.notEqual(result.formatType, 'BREAKING_NEWS', 'Should not repeat BREAKING_NEWS');
  assert.notEqual(result.formatType, 'HUMOR_MEME', 'Should not repeat HUMOR_MEME');
});

test('COLOR_SCHEMES covers all FORMAT_TYPES', () => {
  for (const ft of FORMAT_TYPES) {
    const scheme = COLOR_SCHEMES[ft];
    assert.ok(scheme, `Missing color scheme for ${ft}`);
    assert.ok(scheme.bg.startsWith('#'));
    assert.ok(scheme.primaryText.startsWith('#'));
    assert.ok(scheme.accent1.startsWith('#'));
    assert.ok(scheme.accent2.startsWith('#'));
  }
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd platform
npx tsx --test __tests__/formatStyleAgent.test.ts 2>&1 | tail -5
```

Expected: `Cannot find module '../src/lib/agents/formatStyleAgent'`

- [ ] **Step 3: Implement FormatStyleAgent**

```typescript
// platform/src/lib/agents/formatStyleAgent.ts
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import type { ContentHistoryEntry } from '../services/contentHistory';
import type { StrategyDecision } from './contentStrategyAgent';

export type FormatType =
  | 'BREAKING_NEWS'
  | 'HUMOR_MEME'
  | 'DATA_SHOCK'
  | 'CEO_AUTHORITY'
  | 'EDUCATIONAL_CAROUSEL'
  | 'HOT_TAKE'
  | 'MARKET_SCOREBOARD'
  | 'MYTH_VS_FACT';

export const FORMAT_TYPES: FormatType[] = [
  'BREAKING_NEWS', 'HUMOR_MEME', 'DATA_SHOCK', 'CEO_AUTHORITY',
  'EDUCATIONAL_CAROUSEL', 'HOT_TAKE', 'MARKET_SCOREBOARD', 'MYTH_VS_FACT',
];

export interface ColorScheme {
  bg: string;
  primaryText: string;
  accent1: string;
  accent2: string;
}

export interface FormatDecision {
  formatType: FormatType;
  slideCount: number;
  colorScheme: ColorScheme;
  visualTone: string;
  reasoning: string;
}

export const COLOR_SCHEMES: Record<FormatType, ColorScheme> = {
  BREAKING_NEWS:        { bg: '#000000', primaryText: '#FFFFFF', accent1: '#39FF14', accent2: '#00CFFF' },
  HUMOR_MEME:           { bg: '#0D0D0D', primaryText: '#FFFFFF', accent1: '#FF4500', accent2: '#FFD700' },
  DATA_SHOCK:           { bg: '#020617', primaryText: '#FFFFFF', accent1: '#00FF87', accent2: '#FFFFFF' },
  CEO_AUTHORITY:        { bg: '#0A0A0A', primaryText: '#FFFFFF', accent1: '#FFD700', accent2: '#FFFFFF' },
  EDUCATIONAL_CAROUSEL: { bg: '#050510', primaryText: '#FFFFFF', accent1: '#6366F1', accent2: '#22D3EE' },
  HOT_TAKE:             { bg: '#1A0000', primaryText: '#FFFFFF', accent1: '#FF3B30', accent2: '#FFFFFF' },
  MARKET_SCOREBOARD:    { bg: '#000000', primaryText: '#FFFFFF', accent1: '#00FF87', accent2: '#FF3B30' },
  MYTH_VS_FACT:         { bg: '#080808', primaryText: '#FFFFFF', accent1: '#FF3B30', accent2: '#39FF14' },
};

export class FormatStyleAgent {
  async execute(input: {
    strategy: StrategyDecision;
    contentHistory: ContentHistoryEntry[];
    tickerSymbols: string[];
  }): Promise<FormatDecision> {
    const recentTypes = input.contentHistory
      .slice(-3)
      .map(e => e.formatType)
      .filter((t): t is string => Boolean(t));

    const prompt = buildPrompt(input.strategy, recentTypes, input.tickerSymbols);

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(text) as {
        formatType: FormatType;
        slideCount: number;
        visualTone: string;
        reasoning: string;
      };

      const formatType = FORMAT_TYPES.includes(parsed.formatType) ? parsed.formatType : fallbackType(recentTypes);
      return {
        formatType,
        slideCount: Math.min(9, Math.max(6, Number(parsed.slideCount) || 7)),
        colorScheme: COLOR_SCHEMES[formatType],
        visualTone: parsed.visualTone || 'dramatic, bold, high-energy',
        reasoning: parsed.reasoning || '',
      };
    } catch {
      return buildFallback(recentTypes);
    }
  }
}

function buildPrompt(strategy: StrategyDecision, recentTypes: string[], tickers: string[]): string {
  return `You are a viral finance Instagram content strategist. Pick the best visual format for today's post.

TODAY'S TOPIC: ${strategy.topic}
HOOK: ${strategy.hook}
TICKERS IN NEWS: ${tickers.join(', ') || 'none'}
RECENT FORMATS USED (do NOT repeat): ${recentTypes.join(', ') || 'none'}

AVAILABLE FORMATS — pick exactly one you haven't used recently:
- BREAKING_NEWS: Real market event today. "JUST IN:" urgency. Bold dark poster style.
- HUMOR_MEME: Markets did something absurd or ironic. Illustrated cartoon character. Relatable humor.
- DATA_SHOCK: Massive number to reveal — ATH, ATL, record earnings. Pure stat as hero.
- CEO_AUTHORITY: Company milestone or CEO quote. Portrait + logo + achievement.
- EDUCATIONAL_CAROUSEL: Complex concept needing step-by-step explanation. Clean numbered breakdown.
- HOT_TAKE: Contrarian market view that surprises. Bold opinion statement on gradient.
- MARKET_SCOREBOARD: Multiple tickers moving significantly today. Grid of ticker cards.
- MYTH_VS_FACT: Common financial misconception to bust. Split-screen contrast.

SLIDE COUNT: 6 (simple), 7-8 (multi-angle story), 9 (deep educational only)

Return ONLY valid JSON, no markdown fences:
{"formatType":"BREAKING_NEWS","slideCount":7,"visualTone":"urgent and dramatic — shocked trader at terminal","reasoning":"NVDA earnings is a real breaking event"}`;
}

function fallbackType(recentTypes: string[]): FormatType {
  const recent = new Set(recentTypes);
  return FORMAT_TYPES.find(t => !recent.has(t)) ?? 'EDUCATIONAL_CAROUSEL';
}

function buildFallback(recentTypes: string[]): FormatDecision {
  const formatType = fallbackType(recentTypes);
  return {
    formatType,
    slideCount: 7,
    colorScheme: COLOR_SCHEMES[formatType],
    visualTone: 'dramatic, bold, high-energy finance content',
    reasoning: 'Fallback — Gemini unavailable',
  };
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd platform
npx tsx --test __tests__/formatStyleAgent.test.ts 2>&1 | tail -10
```

Expected: `3 pass, 0 fail`

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents/formatStyleAgent.ts __tests__/formatStyleAgent.test.ts
git commit -m "feat: add FormatStyleAgent with 8 rotating visual formats"
```

---

## Task 7: Implement SlideNarrativeAgent (with tests)

**Files:**
- Create: `platform/src/lib/agents/slideNarrativeAgent.ts`
- Create: `platform/__tests__/slideNarrativeAgent.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// platform/__tests__/slideNarrativeAgent.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { SlideNarrativeAgent } from '../src/lib/agents/slideNarrativeAgent';
import type { StrategyDecision } from '../src/lib/agents/contentStrategyAgent';
import type { FormatDecision } from '../src/lib/agents/formatStyleAgent';
import { COLOR_SCHEMES } from '../src/lib/agents/formatStyleAgent';

const mockStrategy: StrategyDecision = {
  topic: 'NVDA earnings beat',
  hook: 'Nvidia just crushed estimates',
  format: 'CAROUSEL',
  slideCount: 7,
  slideBreakdown: ['Cover', 'The stat', 'Context', 'Why it matters', 'What to watch', 'Risk', 'CTA'],
  reasoning: 'Hot topic',
  targetAudience: 'Canadian retail investors',
  searchKeywords: ['NVDA'],
};

const mockFormat: FormatDecision = {
  formatType: 'BREAKING_NEWS',
  slideCount: 6,
  colorScheme: COLOR_SCHEMES.BREAKING_NEWS,
  visualTone: 'urgent and dramatic',
  reasoning: 'breaking event',
};

test('SlideNarrativeAgent fallback produces correct slide count', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  const agent = new SlideNarrativeAgent();
  const result = await agent.execute({ strategy: mockStrategy, format: mockFormat, tickerSymbols: ['NVDA'] });

  process.env.GEMINI_API_KEY = saved ?? '';

  assert.equal(result.slides.length, mockFormat.slideCount);
});

test('SlideNarrativeAgent fallback — each slide has required fields', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  const agent = new SlideNarrativeAgent();
  const result = await agent.execute({ strategy: mockStrategy, format: mockFormat, tickerSymbols: [] });

  process.env.GEMINI_API_KEY = saved ?? '';

  for (const slide of result.slides) {
    assert.ok(slide.slideNumber >= 1, 'slideNumber must be >= 1');
    assert.ok(slide.headline.length > 0, 'headline must not be empty');
    assert.ok(Array.isArray(slide.headlineColorMap), 'headlineColorMap must be an array');
    assert.ok(slide.visualElement.length > 0, 'visualElement must not be empty');
    assert.ok(['cover','shock_stat','context','breakdown','data','humor','cta'].includes(slide.role), `Unknown role: ${slide.role}`);
  }
});

test('SlideNarrativeAgent fallback — last slide is CTA', async () => {
  const saved = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = '';

  const agent = new SlideNarrativeAgent();
  const result = await agent.execute({ strategy: mockStrategy, format: mockFormat, tickerSymbols: [] });

  process.env.GEMINI_API_KEY = saved ?? '';

  const last = result.slides[result.slides.length - 1];
  assert.equal(last.role, 'cta');
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
cd platform
npx tsx --test __tests__/slideNarrativeAgent.test.ts 2>&1 | tail -5
```

Expected: `Cannot find module '../src/lib/agents/slideNarrativeAgent'`

- [ ] **Step 3: Implement SlideNarrativeAgent**

```typescript
// platform/src/lib/agents/slideNarrativeAgent.ts
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import type { StrategyDecision } from './contentStrategyAgent';
import type { FormatDecision } from './formatStyleAgent';

export interface HeadlineColor {
  text: string;
  color: 'primary' | 'accent1' | 'accent2';
}

export type SlideRole = 'cover' | 'shock_stat' | 'context' | 'breakdown' | 'data' | 'humor' | 'cta';

export interface SlideSpec {
  slideNumber: number;
  role: SlideRole;
  headline: string;
  headlineColorMap: HeadlineColor[];
  subtext?: string;
  eyebrow?: string;
  dataPoint?: string;
  visualElement: string;
  visualPosition: 'top' | 'background' | 'left' | 'right' | 'center';
  mood: string;
  narrativeNote: string;
}

export interface SlideNarrative {
  slides: SlideSpec[];
}

export class SlideNarrativeAgent {
  async execute(input: {
    strategy: StrategyDecision;
    format: FormatDecision;
    tickerSymbols: string[];
  }): Promise<SlideNarrative> {
    console.log(`[SlideNarrativeAgent] Writing ${input.format.slideCount} slide specs...`);

    const prompt = buildPrompt(input.strategy, input.format, input.tickerSymbols);

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(text) as { slides: SlideSpec[] };

      if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
        return buildFallback(input.strategy, input.format);
      }

      // Enforce correct slide numbers and guarantee CTA last
      const slides = parsed.slides.slice(0, input.format.slideCount).map((s, i) => ({
        ...s,
        slideNumber: i + 1,
        headlineColorMap: Array.isArray(s.headlineColorMap) ? s.headlineColorMap : [{ text: s.headline, color: 'primary' as const }],
        visualPosition: s.visualPosition || 'top',
      }));

      if (slides.length > 0) slides[slides.length - 1].role = 'cta';
      return { slides };
    } catch {
      console.warn('[SlideNarrativeAgent] Gemini failed, using fallback.');
      return buildFallback(input.strategy, input.format);
    }
  }
}

function buildPrompt(strategy: StrategyDecision, format: FormatDecision, tickers: string[]): string {
  return `You are a viral finance Instagram content writer. Write the complete slide narrative for a ${format.slideCount}-slide carousel.

TOPIC: ${strategy.topic}
HOOK: ${strategy.hook}
FORMAT TYPE: ${format.formatType}
VISUAL TONE: ${format.visualTone}
TICKERS: ${tickers.join(', ') || 'none'}
TARGET AUDIENCE: ${strategy.targetAudience}
COLOR SCHEME: bg=${format.colorScheme.bg}, accent1=${format.colorScheme.accent1}, accent2=${format.colorScheme.accent2}

SLIDE NARRATIVE RULES:
- Slide 1: Cover — highest energy hook, 4-7 word headline, eyebrow label
- Middle slides: Build tension, reveal data, explain context
- Last slide: Always role "cta" — strong follow/save prompt for @thestatsandstacks
- Each headline: max 8 words, bold and punchy
- headlineColorMap: break headline into parts, assign each part a color (primary=white, accent1=neon, accent2=cyan/secondary)
- visualElement: describe a SPECIFIC scene (e.g. "shocked young man in business casual staring at phone, mouth open, three green monitors behind him, dramatic side lighting") — not vague like "person"
- dataPoint: include only if there's a real number/stat to hero (e.g. "+18.2% EPS BEAT")
- subtext: one short line of supporting context, max 12 words

Return ONLY valid JSON matching this exact schema (no markdown):
{
  "slides": [
    {
      "slideNumber": 1,
      "role": "cover",
      "headline": "NVIDIA JUST BROKE",
      "headlineColorMap": [
        {"text": "NVIDIA", "color": "accent2"},
        {"text": "JUST BROKE", "color": "primary"}
      ],
      "eyebrow": "JUST IN:",
      "subtext": "Wall Street didn't see this coming",
      "dataPoint": null,
      "visualElement": "shocked young man in business casual sitting at trading desk, mouth agape, three monitors showing green candles, dramatic rim lighting from the left",
      "visualPosition": "top",
      "mood": "urgent, high-energy, breaking news",
      "narrativeNote": "Opens with the hook — sets up the big reveal in slide 2"
    }
  ]
}`;
}

const FALLBACK_VISUAL_ELEMENTS: Record<string, string> = {
  BREAKING_NEWS: 'shocked trader in business casual at standing desk, multiple green monitors in background, dramatic overhead lighting',
  HUMOR_MEME: 'cartoon-style illustrated investor character with wide eyes and sweat drops, wearing a suit and holding a phone showing green numbers, comic-book style rendering',
  DATA_SHOCK: 'abstract glowing number display floating in dark space with radiant light beams emanating outward, futuristic data visualization style',
  CEO_AUTHORITY: 'confident executive in dark suit standing against blurred city skyline at night, single key light from above, authoritative posture',
  EDUCATIONAL_CAROUSEL: 'clean organized desk setup from above — laptop, notebook with numbered list, coffee cup, soft natural window light',
  HOT_TAKE: 'lone figure in dark silhouette standing at edge of skyscraper rooftop at dawn, city lights below, dramatic atmospheric shot',
  MARKET_SCOREBOARD: 'wall of illuminated ticker displays in a dark trading floor, multiple screens showing various green and red numbers, Bloomberg terminal aesthetic',
  MYTH_VS_FACT: 'split composition — left side shows a broken clock in warm red tones, right side shows a precise compass in cool green tones',
};

function buildFallback(strategy: StrategyDecision, format: FormatDecision): SlideNarrative {
  const count = format.slideCount;
  const topicWords = strategy.topic.toUpperCase().split(' ').slice(0, 3).join(' ');
  const visual = FALLBACK_VISUAL_ELEMENTS[format.formatType] ?? FALLBACK_VISUAL_ELEMENTS.BREAKING_NEWS;

  const slides: SlideSpec[] = [];

  slides.push({
    slideNumber: 1,
    role: 'cover',
    headline: strategy.hook.toUpperCase().split(' ').slice(0, 6).join(' '),
    headlineColorMap: [
      { text: strategy.hook.toUpperCase().split(' ').slice(0, 3).join(' '), color: 'accent1' },
      { text: strategy.hook.toUpperCase().split(' ').slice(3, 6).join(' '), color: 'primary' },
    ],
    eyebrow: 'JUST IN:',
    subtext: `What you need to know about ${strategy.topic}`,
    visualElement: visual,
    visualPosition: 'top',
    mood: format.visualTone,
    narrativeNote: 'Cover hook',
  });

  for (let i = 2; i < count; i++) {
    const breakdown = strategy.slideBreakdown[i - 1] ?? `Point ${i}`;
    slides.push({
      slideNumber: i,
      role: 'breakdown',
      headline: breakdown.toUpperCase().replace(/^slide\s*\d+[:.]\s*/i, '').split(' ').slice(0, 6).join(' '),
      headlineColorMap: [{ text: breakdown.toUpperCase().split(' ').slice(0, 4).join(' '), color: 'primary' }],
      subtext: `Key insight #${i - 1} on ${topicWords}`,
      visualElement: visual,
      visualPosition: 'top',
      mood: format.visualTone,
      narrativeNote: `Slide ${i} of the breakdown`,
    });
  }

  slides.push({
    slideNumber: count,
    role: 'cta',
    headline: 'FOLLOW FOR DAILY',
    headlineColorMap: [
      { text: 'FOLLOW FOR', color: 'primary' },
      { text: 'DAILY', color: 'accent1' },
    ],
    subtext: 'Canadian finance, no hype — @thestatsandstacks',
    visualElement: 'clean dark background with a subtle upward bar chart icon glowing in the center, minimalist and authoritative',
    visualPosition: 'center',
    mood: 'confident and inviting',
    narrativeNote: 'CTA — drive follows and saves',
  });

  return { slides };
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd platform
npx tsx --test __tests__/slideNarrativeAgent.test.ts 2>&1 | tail -10
```

Expected: `3 pass, 0 fail`

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents/slideNarrativeAgent.ts __tests__/slideNarrativeAgent.test.ts
git commit -m "feat: add SlideNarrativeAgent — exact text and visual specs per slide"
```

---

## Task 8: Rewrite ImagePromptAgent (with tests)

**Files:**
- Rewrite: `platform/src/lib/agents/imagePromptAgent.ts`
- Create: `platform/__tests__/imagePromptAgent.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// platform/__tests__/imagePromptAgent.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { ImagePromptAgent } from '../src/lib/agents/imagePromptAgent';
import type { SlideSpec } from '../src/lib/agents/slideNarrativeAgent';
import type { FormatDecision } from '../src/lib/agents/formatStyleAgent';
import type { StrategyDecision } from '../src/lib/agents/contentStrategyAgent';
import { COLOR_SCHEMES } from '../src/lib/agents/formatStyleAgent';

const mockSlides: SlideSpec[] = [
  {
    slideNumber: 1,
    role: 'cover',
    headline: 'NVIDIA JUST BROKE',
    headlineColorMap: [
      { text: 'NVIDIA', color: 'accent2' },
      { text: 'JUST BROKE', color: 'primary' },
    ],
    eyebrow: 'JUST IN:',
    subtext: 'Wall Street did not see this coming',
    visualElement: 'shocked young trader at desk, three green monitors, dramatic rim lighting',
    visualPosition: 'top',
    mood: 'urgent, dramatic',
    narrativeNote: 'cover hook',
  },
  {
    slideNumber: 2,
    role: 'shock_stat',
    headline: 'EPS BEAT BY',
    headlineColorMap: [{ text: 'EPS BEAT BY', color: 'primary' }],
    dataPoint: '$0.08 A SHARE',
    subtext: 'Wall Street expected $0.88',
    visualElement: 'glowing digital number display in dark space',
    visualPosition: 'background',
    mood: 'shock and awe',
    narrativeNote: 'the big number',
  },
];

const mockFormat: FormatDecision = {
  formatType: 'BREAKING_NEWS',
  slideCount: 2,
  colorScheme: COLOR_SCHEMES.BREAKING_NEWS,
  visualTone: 'urgent and dramatic',
  reasoning: 'test',
};

const mockStrategy: StrategyDecision = {
  topic: 'NVDA earnings', hook: 'h', format: 'CAROUSEL', slideCount: 2,
  slideBreakdown: [], reasoning: '', targetAudience: 'test', searchKeywords: [],
};

test('ImagePromptAgent returns one prompt per slide', () => {
  const agent = new ImagePromptAgent();
  const result = agent.execute({ slides: mockSlides, format: mockFormat, strategy: mockStrategy });
  assert.equal(result.slides.length, 2);
});

test('Each prompt contains canvas size, brand, and counter', () => {
  const agent = new ImagePromptAgent();
  const result = agent.execute({ slides: mockSlides, format: mockFormat, strategy: mockStrategy });

  for (const slide of result.slides) {
    assert.ok(slide.geminiPrompt.includes('1080x1350'), 'must specify canvas size');
    assert.ok(slide.geminiPrompt.includes('@thestatsandstacks'), 'must include brand handle');
    assert.ok(slide.geminiPrompt.includes(`${slide.slideNumber}/${mockSlides.length}`), 'must include slide counter');
  }
});

test('Prompt includes correct background hex color', () => {
  const agent = new ImagePromptAgent();
  const result = agent.execute({ slides: mockSlides, format: mockFormat, strategy: mockStrategy });
  assert.ok(result.slides[0].geminiPrompt.includes('#000000'), 'must include bg color');
});

test('Prompt includes exact headline text', () => {
  const agent = new ImagePromptAgent();
  const result = agent.execute({ slides: mockSlides, format: mockFormat, strategy: mockStrategy });
  assert.ok(result.slides[0].geminiPrompt.includes('NVIDIA'), 'must include headline word');
  assert.ok(result.slides[0].geminiPrompt.includes('JUST IN:'), 'must include eyebrow');
});

test('Prompt includes dataPoint when present', () => {
  const agent = new ImagePromptAgent();
  const result = agent.execute({ slides: mockSlides, format: mockFormat, strategy: mockStrategy });
  assert.ok(result.slides[1].geminiPrompt.includes('$0.08 A SHARE'), 'must include dataPoint');
});
```

- [ ] **Step 2: Run — confirm fail**

```bash
cd platform
npx tsx --test __tests__/imagePromptAgent.test.ts 2>&1 | tail -5
```

Expected: import errors (old file has wrong exports).

- [ ] **Step 3: Rewrite imagePromptAgent.ts**

```typescript
// platform/src/lib/agents/imagePromptAgent.ts
import type { SlideSpec } from './slideNarrativeAgent';
import type { FormatDecision } from './formatStyleAgent';
import type { StrategyDecision } from './contentStrategyAgent';

export interface SlideImagePrompt {
  slideNumber: number;
  role: SlideSpec['role'];
  slideTitle: string;
  geminiPrompt: string;
}

export interface ImagePromptSet {
  slides: SlideImagePrompt[];
}

export class ImagePromptAgent {
  execute(input: {
    slides: SlideSpec[];
    format: FormatDecision;
    strategy: StrategyDecision;
  }): ImagePromptSet {
    const total = input.slides.length;
    return {
      slides: input.slides.map(slide => buildPrompt(slide, input.format, total)),
    };
  }
}

function buildPrompt(slide: SlideSpec, format: FormatDecision, total: number): SlideImagePrompt {
  const { colorScheme, formatType } = format;
  const counter = `${slide.slideNumber}/${total}`;
  const textZonePercent = slide.visualPosition === 'background' ? 65 : 50;
  const visualZoneLabel = slide.visualPosition === 'top'
    ? `upper ${100 - textZonePercent}% of canvas`
    : slide.visualPosition === 'background'
    ? 'full canvas, behind everything else, opacity 25-35%'
    : `${slide.visualPosition} half of canvas`;

  // Build text block lines
  const textLines: string[] = [];

  if (slide.eyebrow) {
    textLines.push(
      `- EYEBROW: Render "${slide.eyebrow}" in ${colorScheme.accent2}, bold condensed sans-serif, ` +
      `~45px, centered, wide letter-spacing, positioned at top of text zone`
    );
  }

  if (slide.headlineColorMap.length > 0) {
    const colorParts = slide.headlineColorMap.map(part => {
      const hex = part.color === 'accent1' ? colorScheme.accent1
                : part.color === 'accent2' ? colorScheme.accent2
                : colorScheme.primaryText;
      return `"${part.text}" in ${hex}`;
    });
    textLines.push(
      `- HEADLINE: ${colorParts.join(', then ')} — bold condensed Impact-style sans-serif, ` +
      `~100-120px, centered, stacked in 1-2 lines, tight line-height`
    );
  } else {
    textLines.push(
      `- HEADLINE: "${slide.headline}" in ${colorScheme.primaryText}, bold condensed Impact-style sans-serif, ~110px, centered`
    );
  }

  if (slide.dataPoint) {
    textLines.push(
      `- DATA POINT (visual centerpiece): "${slide.dataPoint}" in ${colorScheme.accent1}, ` +
      `ultra-bold condensed, ~140-160px, centered — make this the most visually dominant element`
    );
  }

  if (slide.subtext) {
    textLines.push(
      `- SUBTEXT: "${slide.subtext}" in ${colorScheme.primaryText}, regular weight, ~48px, centered, below headline`
    );
  }

  const bgDetail = BACKGROUND_DETAILS[formatType] ?? 'minimal texture, clean and dark';

  const prompt = [
    `Create a 1080x1350 portrait Instagram image. This is slide ${counter} of a ${formatType} finance carousel.`,
    ``,
    `BACKGROUND: Fill entire canvas with ${colorScheme.bg}. ${bgDetail}.`,
    ``,
    `VISUAL ELEMENT (${visualZoneLabel}):`,
    slide.visualElement,
    `Style: photorealistic editorial illustration or high-quality cinematic render. Mood: ${slide.mood}.`,
    `Important: do not render any text inside this visual element area.`,
    ``,
    `TEXT ZONE (lower ${textZonePercent}% of canvas, centered horizontally, stacked vertically):`,
    ...textLines,
    ``,
    `GRADIENT OVERLAY: Apply a dark gradient from ${100 - textZonePercent - 10}% canvas height to the bottom edge, `,
    `color ${colorScheme.bg}, opacity 80-88%, ensuring all text above is fully legible against the visual element.`,
    ``,
    `BRAND ELEMENTS:`,
    `- Bottom-left corner: small upward bar-chart icon (30x30px) + text "@thestatsandstacks" in white (#FFFFFF), 26px, 28px margin from edges`,
    `- Top-right corner: slide counter "${counter}" in white (#FFFFFF), 22px, 28px margin from edges`,
    `- Top-left corner: small filled square in ${colorScheme.accent1}, 36x36px, 28px margin, acts as brand color mark`,
    ``,
    `STRICT RULES:`,
    `- Render ALL text exactly as specified above — every word, every color. Numbers must be pixel-perfect.`,
    `- Use ONLY these hex colors: bg=${colorScheme.bg}, text=${colorScheme.primaryText}, accent1=${colorScheme.accent1}, accent2=${colorScheme.accent2}, white=#FFFFFF.`,
    `- Do not add any other text, borders, watermarks, UI elements, or decorations beyond what is listed.`,
    `- Overall mood: ${slide.mood}.`,
  ].join('\n');

  return {
    slideNumber: slide.slideNumber,
    role: slide.role,
    slideTitle: slide.role.toUpperCase().replace(/_/g, ' '),
    geminiPrompt: prompt,
  };
}

const BACKGROUND_DETAILS: Record<string, string> = {
  BREAKING_NEWS:        'Subtle upward-trending green candlestick chart pattern barely visible in upper 25%, opacity 8%',
  HUMOR_MEME:           'Very faint diagonal speed lines, comic-book texture, opacity 5%',
  DATA_SHOCK:           'Faint circuit-board or data-grid pattern, opacity 6%',
  CEO_AUTHORITY:        'Subtle radial gradient from center lighter outward, spotlight feel, opacity 12%',
  EDUCATIONAL_CAROUSEL: 'Clean geometric grid lines at 15° angle, very subtle, opacity 4%',
  HOT_TAKE:             'Deep red gradient bleeding from bottom-right, opacity 18%',
  MARKET_SCOREBOARD:    'Matrix-style faint falling number columns, opacity 5%',
  MYTH_VS_FACT:         'Subtle split-tone: slightly warmer left half, cooler right half, opacity 7%',
};
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
cd platform
npx tsx --test __tests__/imagePromptAgent.test.ts 2>&1 | tail -10
```

Expected: `5 pass, 0 fail`

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents/imagePromptAgent.ts __tests__/imagePromptAgent.test.ts
git commit -m "feat: rewrite ImagePromptAgent — complete Gemini slide prompts with text rendered in image"
```

---

## Task 9: Redesign telegramDelivery.ts

**Files:** `platform/src/lib/services/telegramDelivery.ts`

- [ ] **Step 1: Replace the entire file**

Keep only the functions needed by the new pipeline. Remove `sendPostToTelegram`, `sendVideoToTelegram`, `sendPhotoAlbum`, and the old `sendPromptsToTelegram`. Keep the low-level helpers (`callTelegram`, `withTelegramRetry`, `fetchWithTimeout`, `delay`).

```typescript
// platform/src/lib/services/telegramDelivery.ts
import type { CopyBundle } from '../agents/copywritingAgent';
import type { StrategyDecision } from '../agents/contentStrategyAgent';
import type { FormatDecision } from '../agents/formatStyleAgent';
import type { ImagePromptSet } from '../agents/imagePromptAgent';
import { getLocalDateKey } from './dateUtils';

const TELEGRAM_RETRY_ATTEMPTS = 4;
const TELEGRAM_TIMEOUT_MS = 30_000;

export async function sendPromptsToTelegram(input: {
  copy: CopyBundle;
  strategy: StrategyDecision;
  format: FormatDecision;
  promptSet: ImagePromptSet;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[TelegramDelivery] Skipped — TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set.');
    return;
  }

  const today = getLocalDateKey(new Date());
  const formatLabel = input.format.formatType.replace(/_/g, ' ');

  // 1: Short intro message
  const intro = [
    `🎬 TheStatsAndStacks — ${today}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `FORMAT: ${formatLabel}`,
    `TOPIC: ${input.strategy.topic}`,
    `SLIDES: ${input.promptSet.slides.length}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Prompt package attached 👇`,
  ].join('\n');

  await callTelegram(token, 'sendMessage', { chat_id: chatId, text: intro });

  // 2: Build full document
  const sep = '═'.repeat(52);
  const lines: string[] = [
    `THESTATSANDSTACKS — ${today}`,
    `FORMAT: ${input.format.formatType}  |  TOPIC: ${input.strategy.topic}  |  ${input.promptSet.slides.length} SLIDES`,
    sep,
    '',
  ];

  for (const slide of input.promptSet.slides) {
    lines.push(`SLIDE ${slide.slideNumber} — ${slide.slideTitle}`);
    lines.push('─'.repeat(40));
    lines.push(slide.geminiPrompt);
    lines.push('');
    lines.push('');
  }

  lines.push(sep, 'CAPTION', sep, input.copy.caption, '');
  lines.push(sep, 'HASHTAGS', sep, input.copy.hashtags, '');
  lines.push(sep, 'PINNED COMMENT', sep, input.copy.firstComment, '');

  const docContent = lines.join('\n');
  const filename = `thestatsandstacks-${today}.txt`;

  // 3: Send as document attachment (no character limit)
  await withTelegramRetry('sendDocument:prompts', async () => {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', `📄 ${filename} — paste each prompt into Gemini Imagen`);
    form.append(
      'document',
      new Blob([docContent], { type: 'text/plain' }),
      filename,
    );
    const response = await fetchWithTimeout(
      `https://api.telegram.org/bot${token}/sendDocument`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      throw new Error(`Telegram sendDocument failed: ${response.status} ${await response.text()}`);
    }
  });

  console.log(`[TelegramDelivery] ✅ Sent intro + ${filename} (${input.promptSet.slides.length} slides).`);
}

async function callTelegram(token: string, method: string, body: Record<string, unknown>): Promise<void> {
  await withTelegramRetry(method, async () => {
    const response = await fetchWithTimeout(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Telegram ${method} failed: ${response.status} ${await response.text()}`);
    }
  });
}

async function withTelegramRetry(label: string, operation: () => Promise<void>): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= TELEGRAM_RETRY_ATTEMPTS; attempt++) {
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;
      if (attempt === TELEGRAM_RETRY_ATTEMPTS) break;
      const delayMs = 1_500 * attempt * attempt;
      console.warn(`[TelegramDelivery] ${label} attempt ${attempt} failed; retrying in ${delayMs}ms.`);
      await delay(delayMs);
    }
  }
  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`[TelegramDelivery] ${label} failed after ${TELEGRAM_RETRY_ATTEMPTS} attempts: ${msg}`);
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/telegramDelivery.ts
git commit -m "feat: redesign Telegram delivery — intro message + .txt document with all prompts"
```

---

## Task 10: Rewrite run-daily.ts

**Files:** `platform/run-daily.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
// platform/run-daily.ts
import 'dotenv/config';
import { CostGuardAgent } from './src/lib/agents/costGuardAgent';
import { TrendResearchAgent } from './src/lib/agents/trendResearchAgent';
import { ContentStrategyAgent } from './src/lib/agents/contentStrategyAgent';
import { ComplianceQAAgent } from './src/lib/agents/complianceQAAgent';
import { ImagePromptAgent } from './src/lib/agents/imagePromptAgent';
import { CopywritingAgent } from './src/lib/agents/copywritingAgent';
import { TickersInNewsAgent } from './src/lib/agents/tickersInNewsAgent';
import { HistoryGuardAgent } from './src/lib/agents/historyGuardAgent';
import { FormatStyleAgent } from './src/lib/agents/formatStyleAgent';
import { SlideNarrativeAgent } from './src/lib/agents/slideNarrativeAgent';
import { sendPromptsToTelegram } from './src/lib/services/telegramDelivery';
import { appendContentHistory, loadContentHistory } from './src/lib/services/contentHistory';
import { getLocalDateKey, getLocalTimestamp, getRunSlug } from './src/lib/services/dateUtils';
import path from 'path';
import fs from 'fs';

async function main() {
  const startTime = Date.now();
  const now = new Date();
  const today = getLocalDateKey(now);
  const runSlug = getRunSlug(now);
  process.env.CONTENT_RUN_SLUG = today;

  const outputDir = path.join('/tmp', 'thestatsandstacks', today);
  const historyPath = process.env.CONTENT_HISTORY_PATH
    || path.join('/tmp', 'thestatsandstacks-history', 'content-history.json');

  const contentHistory = loadContentHistory(historyPath);
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🚀 THESTATSANDSTACKS — DAILY PIPELINE');
  console.log(`  📅 ${today}`);
  console.log(`  🧠 History entries: ${contentHistory.length}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ── AGENT 0: ZERO-COST GUARD ──────────────────────────────────────────────
  console.log('━━━ AGENT 0: ZERO-COST GUARD ━━━');
  const costGuard = await new CostGuardAgent().execute();
  for (const note of costGuard.notes) console.log(`   ${note}`);
  if (!costGuard.isSafe) throw new Error(`Cost guard blocked: ${costGuard.failures.join(' ')}`);
  console.log('');

  // ── AGENT 1A: TICKERS IN NEWS (parallel with trend research) ──────────────
  console.log('━━━ AGENT 1A: TICKERS IN NEWS ━━━');
  const tickersPromise = new TickersInNewsAgent().execute({}).catch(err => {
    console.warn(`   [TickersInNews] Non-fatal: ${err instanceof Error ? err.message : err}`);
    return { tickers: [] as Array<{ symbol: string }> };
  });

  // ── AGENT 1: TREND RESEARCH ───────────────────────────────────────────────
  console.log('━━━ AGENT 1: TREND RESEARCH ━━━');
  const trends = await new TrendResearchAgent().execute({ contentHistory });
  const researchBriefPath = path.join(outputDir, 'RESEARCH_BRIEF.md');
  fs.writeFileSync(researchBriefPath, buildResearchBrief(trends, contentHistory), 'utf-8');
  console.log(`   Research brief: ${researchBriefPath}`);

  const tickersInNews = await tickersPromise;
  const tickerSymbols = tickersInNews.tickers.map(t => t.symbol);
  console.log(`   Tickers: ${tickerSymbols.join(', ') || 'none'}`);
  console.log('');

  // ── AGENT 1B: HISTORY GUARD ───────────────────────────────────────────────
  console.log('━━━ AGENT 1B: HISTORY GUARD ━━━');
  const topTopic = trends.topics[0]?.title ?? '';
  const historyGuard = await new HistoryGuardAgent().execute({ topic: topTopic, contentHistory });
  if (historyGuard.block) {
    console.warn(`   ⛔ Blocked "${topTopic}". Pivot: ${historyGuard.suggestedPivot}`);
    if (trends.topics.length > 1) {
      const [blocked, ...rest] = trends.topics;
      trends.topics = [...rest, { ...blocked, score: (blocked.score ?? 0) * 0.3 }];
      console.log(`   Using: "${trends.topics[0]?.title}"`);
    }
  }
  console.log('');

  // ── AGENT 2: CONTENT STRATEGY ─────────────────────────────────────────────
  console.log('━━━ AGENT 2: CONTENT STRATEGY ━━━');
  const strategy = await new ContentStrategyAgent().execute({ trends, contentHistory });
  console.log(`   Topic: ${strategy.topic}`);
  console.log(`   Hook:  ${strategy.hook}`);
  console.log('');

  // ── AGENT 3: FORMAT STYLE ─────────────────────────────────────────────────
  console.log('━━━ AGENT 3: FORMAT STYLE ━━━');
  const format = await new FormatStyleAgent().execute({ strategy, contentHistory, tickerSymbols });
  console.log(`   Format: ${format.formatType} (${format.slideCount} slides)`);
  console.log(`   Tone:   ${format.visualTone}`);
  console.log('');

  // ── AGENT 4: SLIDE NARRATIVE ──────────────────────────────────────────────
  console.log('━━━ AGENT 4: SLIDE NARRATIVE ━━━');
  const narrative = await new SlideNarrativeAgent().execute({ strategy, format, tickerSymbols });
  console.log(`   Wrote ${narrative.slides.length} slide specs`);
  narrative.slides.forEach(s => console.log(`   Slide ${s.slideNumber} [${s.role}]: ${s.headline}`));
  console.log('');

  // ── AGENT 5: COMPLIANCE QA ────────────────────────────────────────────────
  console.log('━━━ AGENT 5: COMPLIANCE QA ━━━');
  const compliance = await new ComplianceQAAgent().execute({ strategy });
  if (!compliance.isValid) throw new Error(`Compliance failed: ${compliance.failures.join(' ')}`);
  console.log(`   Score: ${(compliance.confidenceScore * 100).toFixed(0)}%`);
  console.log('');

  // ── AGENT 6: IMAGE PROMPTS ────────────────────────────────────────────────
  console.log('━━━ AGENT 6: IMAGE PROMPTS ━━━');
  const promptSet = new ImagePromptAgent().execute({ slides: narrative.slides, format, strategy });
  console.log(`   Generated ${promptSet.slides.length} complete Gemini prompts`);
  console.log('');

  // ── AGENT 7: COPYWRITING ──────────────────────────────────────────────────
  console.log('━━━ AGENT 7: COPYWRITING ━━━');
  const copy = await new CopywritingAgent().execute({ strategy });
  console.log('');

  // ── AGENT 8: FINAL COMPLIANCE ─────────────────────────────────────────────
  console.log('━━━ AGENT 8: FINAL COMPLIANCE ━━━');
  const finalCompliance = await new ComplianceQAAgent().execute({ strategy, copy });
  if (!finalCompliance.isValid) throw new Error(`Final compliance failed: ${finalCompliance.failures.join(' ')}`);
  console.log(`   Score: ${(finalCompliance.confidenceScore * 100).toFixed(0)}%`);
  console.log('');

  // ── TELEGRAM DELIVERY ─────────────────────────────────────────────────────
  console.log('━━━ TELEGRAM DELIVERY ━━━');
  await sendPromptsToTelegram({ copy, strategy, format, promptSet });
  console.log('');

  // ── PERSIST HISTORY ───────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  appendContentHistory(historyPath, {
    date: today,
    topic: strategy.topic,
    hook: strategy.hook,
    format: strategy.format,
    formatType: format.formatType,
    slideCount: narrative.slides.length,
    keywords: strategy.searchKeywords || [],
    visualSignature: runSlug,
  });

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ✅ DONE — ${elapsed}s`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
}

function buildResearchBrief(
  trends: Awaited<ReturnType<TrendResearchAgent['execute']>>,
  contentHistory: ReturnType<typeof loadContentHistory>,
): string {
  return `# TheStatsAndStacks Research Brief\n\nGenerated: ${getLocalTimestamp()}\n\n## Recent Topics\n\n${
    contentHistory.length
      ? contentHistory.slice(-10).map(e => `- ${e.date}: ${e.topic} (${e.formatType ?? e.format})`).join('\n')
      : '- No history'
  }\n\n## Research Signals\n\n${
    (trends.signalBriefs ?? []).map(s =>
      `### ${s.source} (${s.status})\n${s.summary}\nSeeds: ${s.topicSeeds.join(' | ')}\nSources: ${s.sourceUrls.join(' | ')}`
    ).join('\n\n')
  }\n\n## Ranked Topics\n\n${
    trends.topics.map((t, i) =>
      `${i + 1}. ${t.title}\n   Score: ${t.score} | ${t.suggestedFormat ?? ''} | ${t.contentPillar ?? ''}\n   Why now: ${t.freshnessSignal ?? t.reasoning}`
    ).join('\n\n')
  }`;
}

main().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify it imports cleanly (no runtime, just syntax)**

```bash
cd platform
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

Fix any import errors before moving on.

- [ ] **Step 3: Commit**

```bash
git add run-daily.ts
git commit -m "feat: overhaul run-daily.ts — photo-only pipeline with FormatStyleAgent and SlideNarrativeAgent"
```

---

## Task 11: Update GitHub Actions workflow

**Files:** `platform/.github/workflows/daily-post.yml` — note: the actual file path is `.github/workflows/daily-post.yml` at the repo root.

- [ ] **Step 1: Replace the Run Daily Pipeline env block**

In `.github/workflows/daily-post.yml`, replace the `env:` block under "Run Daily Pipeline" with:

```yaml
      - name: Run Daily Pipeline
        if: steps.send-window.outputs.should_run == 'true'
        working-directory: platform
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GEMINI_TEXT_MODEL: gemini-2.5-flash
          WORKFLOW_TIME_ZONE: America/Vancouver
          CONTENT_HISTORY_PATH: /tmp/thestatsandstacks-history/content-history.json
          ZERO_COST_MODE: "true"
          ENABLE_REDDIT_RESEARCH: "true"
          REDDIT_CLIENT_ID: ${{ secrets.REDDIT_CLIENT_ID }}
          REDDIT_CLIENT_SECRET: ${{ secrets.REDDIT_CLIENT_SECRET }}
          REDDIT_USER_AGENT: thestatsandstacks-content-research/1.0
          HOT_TOPIC_WATCHLIST: SNDK,WDC,MU,NVDA,AVGO,AMD,PLTR,APP,HOOD,COIN,MSTR,SMCI,TSLA,SOFI,RKLB,IONQ
          GMAIL_ADDRESS: ${{ secrets.GMAIL_ADDRESS }}
          GMAIL_APP_PASSWORD: ${{ secrets.GMAIL_APP_PASSWORD }}
          DELIVERY_EMAIL: ${{ secrets.DELIVERY_EMAIL }}
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: npm run daily
```

- [ ] **Step 2: Remove the Chromium + FFmpeg installation step**

Delete this entire step from the workflow:

```yaml
      - name: Install Chromium and FFmpeg
        if: steps.send-window.outputs.should_run == 'true'
        run: sudo apt-get update -qq && sudo apt-get install -y chromium-browser ffmpeg
```

- [ ] **Step 3: Remove `DAY_TYPE_OVERRIDE` from workflow_dispatch inputs** (no longer needed)

Remove from the `inputs:` block:
```yaml
      day_type:
        description: 'Override day type (auto = use schedule)'
        required: false
        default: 'auto'
        type: choice
        options:
          - auto
          - photo
          - video
```

- [ ] **Step 4: Commit**

```bash
git add ../.github/workflows/daily-post.yml
git commit -m "chore: strip video and image-gen env vars from GitHub Actions workflow"
```

---

## Task 12: Clean up app + tests

**Files:** `platform/src/app/page.tsx`, `platform/src/app/layout.tsx`, `platform/__tests__/agents.test.ts`

- [ ] **Step 1: Replace page.tsx with placeholder**

```typescript
// platform/src/app/page.tsx
export default function Page() {
  return <main style={{ padding: 40, fontFamily: 'monospace' }}>TheStatsAndStacks pipeline running via GitHub Actions.</main>;
}
```

- [ ] **Step 2: Simplify layout.tsx**

Open `platform/src/app/layout.tsx`. Remove any imports referencing `slide-templates`, `dashboard`, or `render` directories. Keep the basic HTML shell and `globals.css` import only.

- [ ] **Step 3: Remove deleted-agent tests from agents.test.ts**

Open `platform/__tests__/agents.test.ts`. Remove any `test()` blocks that import from deleted agents:
- `PublisherAgent` (from `publisherAgent.ts`)
- `VisualAssetSourcingAgent` (from `visualAssetSourcingAgent.ts`)
- `MediaFormatDecisionAgent` / `CarouselPlanningAgent` (from `mediaPlanningAgent.ts`)

Keep tests for: `CostGuardAgent`, `ComplianceQAAgent`, `normalizeCopyBundle`.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx __tests__/agents.test.ts
git commit -m "chore: replace dashboard placeholder, clean up test suite"
```

---

## Task 13: Full typecheck + test run + CLAUDE.md update

- [ ] **Step 1: Run full typecheck**

```bash
cd platform
npm run typecheck 2>&1
```

Fix any remaining type errors. Common issues to look for:
- Missing imports from deleted files
- `formatType` not being passed to `appendContentHistory` (fix: it's now in the interface)
- Any remaining references to `MediaFormatDecision`, `CarouselPlan`, `VideoVariant`

- [ ] **Step 2: Run all tests**

```bash
cd platform
npm run test 2>&1
```

Expected: all tests in `formatStyleAgent.test.ts`, `slideNarrativeAgent.test.ts`, `imagePromptAgent.test.ts`, and the surviving tests in `agents.test.ts` pass.

- [ ] **Step 3: Update CLAUDE.md at repo root**

In `/Users/myank/Desktop/thestatsandstacks/CLAUDE.md`, update the pipeline table and the "What gets deleted" section to match the final state. Specifically:
- Update the agent pipeline table to show the new 8-agent order
- Remove all mentions of Remotion, Puppeteer, video, dashboard, BullMQ
- Add the FormatStyleAgent and SlideNarrativeAgent rows

- [ ] **Step 4: Final commit**

```bash
cd /Users/myank/Desktop/thestatsandstacks
git add platform/ CLAUDE.md
git commit -m "feat: photo-only pipeline — viral format rotation, complete Gemini slide prompts, Telegram document delivery"
```
