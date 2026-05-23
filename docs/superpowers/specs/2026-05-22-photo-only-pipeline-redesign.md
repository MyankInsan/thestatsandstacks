# Spec: Photo-Only Pipeline Redesign + Viral Format System

**Date:** 2026-05-22  
**Status:** Approved  
**Scope:** platform/

---

## Problem

1. The pipeline generated prompts for abstract backgrounds (wood, metal, lifestyle textures) because it was built for a Puppeteer renderer that overlaid React slide components on top. Now that the user pastes prompts directly into Gemini to generate final images, those prompts produce unusable abstract art.
2. Video generation (Remotion, FFmpeg, dayTypeAgent) is unwanted and must be fully removed.
3. The Next.js admin dashboard is unused and must be fully removed.
4. Prompts lack variety — same three aesthetic variants (Quiet Luxury, Dark Terminal, Atmospheric Lifestyle) every day regardless of topic or market mood.

## Goal

Every morning, a Telegram message arrives containing:
- A complete, ready-to-generate Gemini image prompt **per slide** (text + visual + layout — Gemini renders the whole finished slide)
- Caption, hashtags, and pinned comment — all copy-paste ready
- A different visual format type every day so the feed never looks repetitive

---

## Architecture

### Pipeline (run-daily.ts) — new order

```
0.  CostGuardAgent           (unchanged)
1A. TickersInNewsAgent        (parallel, unchanged)
1.  TrendResearchAgent        (unchanged)
1B. HistoryGuardAgent         (unchanged)
2.  ContentStrategyAgent      (unchanged — topic, hook, angle, slideBreakdown)
3.  FormatStyleAgent          (NEW — picks visual format + slide count + color scheme)
4.  SlideNarrativeAgent       (NEW — exact text + visual spec per slide)
5.  ComplianceQAAgent         (unchanged, strategy pass)
6.  ImagePromptAgent          (FULL REWRITE — complete Gemini prompts, no backgrounds)
7.  CopywritingAgent          (unchanged)
8.  ComplianceQAAgent         (unchanged, final pass)
    TelegramDelivery          (REDESIGNED — intro message + .txt document)
```

MediaFormatDecisionAgent and CarouselPlanningAgent are **deleted** — FormatStyleAgent absorbs both.

---

## New Agents

### FormatStyleAgent (`src/lib/agents/formatStyleAgent.ts`)

**Input:** `{ strategy: StrategyDecision, contentHistory: ContentHistoryEntry[], tickersInNews: TickersResult }`

**Output:**
```typescript
interface FormatDecision {
  formatType: FormatType;
  slideCount: number;         // 6–9
  colorScheme: {
    bg: string;               // hex, e.g. "#000000"
    primaryText: string;      // hex, e.g. "#FFFFFF"
    accent1: string;          // hex, e.g. "#39FF14" neon green
    accent2: string;          // hex, e.g. "#00CFFF" cyan
  };
  visualTone: string;         // e.g. "shocked trader, dramatic, high energy"
  reasoning: string;
}

type FormatType =
  | 'BREAKING_NEWS'       // "JUST IN:" hook, dark bg, bold stats
  | 'HUMOR_MEME'          // illustrated cartoon character, relatable absurdity
  | 'DATA_SHOCK'          // chart/screencap style, pure number reveal
  | 'CEO_AUTHORITY'       // portrait + logo + milestone achievement
  | 'EDUCATIONAL_CAROUSEL'// clean numbered infographic breakdown
  | 'HOT_TAKE'            // bold contrarian opinion, gradient bg
  | 'MARKET_SCOREBOARD'   // multiple tickers in grid layout
  | 'MYTH_VS_FACT';       // split-screen contrast, misconception bust
```

**Selection logic (Gemini LLM call with these rules):**
- If today's topic is a real breaking market event → prefer `BREAKING_NEWS`
- If markets did something objectively absurd (huge % swing, ironic news) → prefer `HUMOR_MEME`
- If topic centers on a massive stat (ATH, ATL, record earnings) → prefer `DATA_SHOCK`
- If topic involves a CEO quote or company milestone → prefer `CEO_AUTHORITY`
- If topic is complex and educational ("how compound interest works") → prefer `EDUCATIONAL_CAROUSEL`
- If topic is a contrarian market view → prefer `HOT_TAKE`
- If watchlist has multiple movers today → prefer `MARKET_SCOREBOARD`
- If topic corrects a common misconception → prefer `MYTH_VS_FACT`
- **Never repeat the same formatType as the previous 2 days** (consulted from contentHistory)
- slideCount: 6 for simple topics, 7-8 for multi-angle stories, 9 for deep educational

Color scheme defaults by format:
- `BREAKING_NEWS`: bg `#000000`, accent1 `#39FF14`, accent2 `#00CFFF`
- `HUMOR_MEME`: bg `#0D0D0D`, accent1 `#FF4500`, accent2 `#FFD700`
- `DATA_SHOCK`: bg `#020617`, accent1 `#00FF87`, accent2 `#FFFFFF`
- `CEO_AUTHORITY`: bg `#0A0A0A`, accent1 `#FFD700`, accent2 `#FFFFFF`
- `EDUCATIONAL_CAROUSEL`: bg `#050510`, accent1 `#6366F1`, accent2 `#22D3EE`
- `HOT_TAKE`: bg `#1A0000`, accent1 `#FF3B30`, accent2 `#FFFFFF`
- `MARKET_SCOREBOARD`: bg `#000000`, accent1 `#00FF87`, accent2 `#FF3B30`
- `MYTH_VS_FACT`: bg `#080808`, accent1 `#FF3B30`, accent2 `#39FF14`

---

### SlideNarrativeAgent (`src/lib/agents/slideNarrativeAgent.ts`)

**Input:** `{ strategy: StrategyDecision, format: FormatDecision, tickersInNews: TickersResult }`

**Output:**
```typescript
interface SlideNarrative {
  slides: SlideSpec[];
}

interface SlideSpec {
  slideNumber: number;
  role: 'cover' | 'shock_stat' | 'context' | 'breakdown' | 'data' | 'humor' | 'cta';
  
  // Exact text content for the slide
  headline: string;               // primary large text, e.g. "NVIDIA JUST BROKE"
  headlineColorMap: {             // which words/phrases get accent colors
    text: string;
    color: 'primary' | 'accent1' | 'accent2';
  }[];
  subtext?: string;               // smaller supporting line below headline
  eyebrow?: string;               // small label above headline, e.g. "JUST IN:"
  dataPoint?: string;             // isolated big number/stat to render large
  
  // Visual direction
  visualElement: string;          // what to render: character, logo, chart, scene
  visualPosition: 'top' | 'background' | 'left' | 'right' | 'center';
  mood: string;                   // e.g. "shocked trader, dramatic lighting"
  
  // Narrative connective tissue
  narrativeNote: string;          // how this slide connects to prev/next
}
```

**Requirements:**
- All slides must tell a coherent story arc: hook → build tension → data → resolution → CTA
- Emotional escalation: cover has highest energy, middle slides build, CTA closes strong
- Each slide: ONE main idea, headline ≤ 8 words, subtext ≤ 15 words
- Last slide always ends with follow CTA for @thestatsandstacks
- `visualElement` must be specific enough to generate: not "person" but "shocked young man in business casual at trading desk, mouth open, hands on head, three monitors visible"

---

### ImagePromptAgent (`src/lib/agents/imagePromptAgent.ts`) — full rewrite

**Input:** `{ slides: SlideSpec[], format: FormatDecision, strategy: StrategyDecision }`

**Output:**
```typescript
interface ImagePromptSet {
  slides: SlideImagePrompt[];
}

interface SlideImagePrompt {
  slideNumber: number;
  role: SlideSpec['role'];
  geminiPrompt: string;   // complete prompt, paste directly into Gemini Imagen
  slideTitle: string;     // short label for Telegram header
}
```

**Prompt construction per slide — must include ALL of:**
1. Canvas size: `1080x1350 portrait Instagram image`
2. Background: exact color/gradient/pattern, hex codes
3. Visual element: specific description with position, lighting, style
4. Text blocks: exact text strings, font style (bold condensed sans-serif, Impact-style), approximate size in px, color in hex, vertical position (top/center/bottom, percentage)
5. Color accent instructions: which words render in which hex color
6. Brand mark: `small bar-chart growth icon + "@thestatsandstacks" in white 28px, bottom-left corner`
7. Slide counter: `"X/Y" in white 24px, top-right corner` (X=slideNumber, Y=totalSlides)
8. Constraint: `Do not add any other text, borders, watermarks, or UI elements`

**Example prompt structure:**
```
Create a 1080x1350 portrait Instagram image. 

Background: Pure black (#000000) with a very faint upward-trending 
green candlestick pattern barely visible in upper 30%, opacity 10%.

Visual element (upper 50% of canvas): [specific scene description],
photorealistic editorial illustration style, dramatic rim lighting,
cinematic mood.

Text layout (lower 50%):
- Eyebrow line: "[EYEBROW TEXT]" in [accent2 hex], bold condensed 
  sans-serif, ~45px, centered, top of text block
- Headline line 1: "[WORD1]" in white #FFFFFF + "[WORD2]" in [accent1 hex], 
  bold condensed sans-serif ~110px, centered
- Headline line 2: "[WORD3] [WORD4]" in white #FFFFFF, ~110px, centered
- Subtext: "[supporting line]" in white #FFFFFF, regular weight, ~50px, 
  centered, below headline

Dark gradient overlay from 40% height to bottom, opacity 80%, 
ensuring text readability.

Brand: Small bar-chart growth icon + "@thestatsandstacks" in white, 
28px, bottom-left corner, 30px margin.
Slide counter: "1/7" in white, 24px, top-right corner, 30px margin.

Do not add any other text, borders, watermarks, or UI elements.
```

---

## Telegram Delivery Redesign (`src/lib/services/telegramDelivery.ts`)

**Two messages per run:**

**Message 1 — intro (text):**
```
🎬 TheStatsAndStacks — [DATE]
━━━━━━━━━━━━━━━━━━━━
FORMAT: [FormatType]
TOPIC: [topic]
SLIDES: [slideCount]
━━━━━━━━━━━━━━━━━━━━
Prompt package attached 👇
```

**Message 2 — document attachment (.txt file):**
Full prompt package as a plain text file named `thestatsandstacks-[date].txt`:

```
THESTATSANDSTACKS — [DATE]
FORMAT: [FormatType]  |  TOPIC: [topic]  |  [N] SLIDES
════════════════════════════════════════

SLIDE 1 — COVER
────────────────
[Complete Gemini prompt — paste directly into Gemini Imagen]

SLIDE 2 — [ROLE]
────────────────
[Complete Gemini prompt]

... (all slides)

════════════════════════════════════════
CAPTION
════════════════════════════════════════
[Ready to copy]

════════════════════════════════════════
HASHTAGS
════════════════════════════════════════
[Ready to copy]

════════════════════════════════════════
PINNED COMMENT
════════════════════════════════════════
[Ready to copy]
```

**Rationale:** A single `.txt` document avoids Telegram's 4096-char per message limit, is easy to reference while working in Gemini, and is downloadable to the phone.

---

## Deletions

### Agent files (platform/src/lib/agents/)
- `remotionAgent.ts`
- `dayTypeAgent.ts`
- `imageGenerationAgent.ts`
- `visionQAAgent.ts`
- `visualAssetSourcingAgent.ts`
- `regenLoopAgent.ts`
- `mediaPlanningAgent.ts`
- `editorialAgent.ts`
- `finalGateAgent.ts`
- `publisherAgent.ts`

### Render / UI
- `src/lib/render/puppeteerRenderer.ts`
- `src/remotion/` (entire directory)
- `src/components/slide-templates/` (entire directory)
- `src/components/dashboard/` (entire directory)
- `src/components/charts/` (entire directory)
- `src/components/RunWorkflowButton.tsx`
- `src/app/api/run-workflow/` (entire route)
- `src/app/api/images/` (entire route)
- `src/app/render/` (entire directory)
- `src/app/page.tsx` → replace with 1-line placeholder
- `render-preview.ts`

### Infrastructure
- `platform/Dockerfile`
- `platform/docker-compose.yml`

### Queue (no longer used without dashboard)
- `src/lib/queue/bullmq.ts`
- `src/lib/queue/workflow.ts`

### Services
- `src/lib/services/imageCount.ts`

### Tests to delete (testing deleted agents)
- `__tests__/slideTemplates.test.ts`
- Agent tests that reference deleted agents (audit during implementation)

---

## Files Kept and Modified

| File | Change |
|------|--------|
| `run-daily.ts` | Major overhaul: remove video path, wire new agents |
| `imagePromptAgent.ts` | Complete rewrite (keep filename, replace contents) |
| `telegramDelivery.ts` | Redesign delivery functions, remove video/image functions |
| `interfaces.ts` | Remove VideoClipPrompt, VideoVariant, ImagePromptSet video fields |
| `contentStrategyAgent.ts` | Remove format/slideCount output (FormatStyleAgent takes over) |
| `contentHistory.ts` | Add `formatType` field to `ContentHistoryEntry` |
| `GitHub Actions workflow` | Remove all video/Remotion/image-gen env vars |
| `package.json` | Remove `@remotion/*`, `puppeteer-core`, `bullmq`, `ioredis`, `sharp` |
| `CLAUDE.md` | Update after implementation |

---

## Content History Update

Add `formatType` to `ContentHistoryEntry` so FormatStyleAgent can avoid repeating:

```typescript
interface ContentHistoryEntry {
  date: string;
  topic: string;
  hook: string;
  format: string;
  formatType?: FormatType;   // NEW
  slideCount: number;
  keywords: string[];
  visualSignature?: string;
}
```

---

## GitHub Actions Changes

Remove env vars: `CLOUDFLARE_*`, `PEXELS_*`, `WIKIMEDIA_*`, `PUPPETEER_*`, `REMOTION_*`, `FREE_IMAGE_GENERATION_ONLY`, `ALLOW_PAID_IMAGE_GENERATION`, `GEMINI_IMAGE_*`, `DAY_TYPE_OVERRIDE`.

Remove step: `Install Chromium and FFmpeg`.

Keep: `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GMAIL_*`, `REDDIT_*`, `HOT_TOPIC_WATCHLIST`.

---

## Success Criteria

1. `npm run daily` completes without error
2. Telegram receives: intro message + `.txt` document with all prompts + caption + hashtags + pinned comment
3. Each Gemini prompt is ≥ 200 words and describes background, visual element, exact text with colors, brand mark, slide counter
4. Format type differs from previous 2 days (verified via contentHistory)
5. `npm run typecheck` passes with zero errors
6. `npm run test` passes (after removing tests for deleted agents)
