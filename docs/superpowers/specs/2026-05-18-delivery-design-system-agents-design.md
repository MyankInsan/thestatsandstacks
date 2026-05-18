# TheStatsAndStacks — Full Implementation Spec
_Approved: 2026-05-18_

## Context

Autonomous Instagram content system for TheStatsAndStacks (faceless Canadian personal finance brand). The pipeline already runs daily via GitHub Actions at 8 AM Vancouver time. Both Telegram and email delivery services exist but have UX gaps. A full design system was produced in claude.ai/design and needs to be ported into the production codebase.

The operator (user) does not open their computer during the day. They receive the daily post package on Telegram or email and post it to Instagram manually from their phone.

---

## Phase 1 — Fix delivery experience

**Problem:**
- `telegramDelivery.ts` sends images via `sendDocument` → files that must be tapped and downloaded. Images don't show inline.
- Caption, hashtags, and pinned comment arrive in a single text blob with no copy-ready separation.
- Email delivery has embedded images but the pinned comment is not labeled separately.

**Solution — Telegram: 4 sequential messages**

1. **Album message** — `sendMediaGroup` with all slide PNGs as `InputMediaPhoto`. Caption on message 1 only: `TheStatsAndStacks · {topic} · {format} · QA {score}%`. Up to 10 photos per album (carousel fits; if >10, split into two albums).
2. **Caption message** — plain text, prefixed with `📝 CAPTION — copy this into Instagram:\n\n{caption}`
3. **Hashtags message** — plain text, prefixed with `# HASHTAGS — copy these:\n\n{hashtags}`
4. **Pinned comment message** — plain text, prefixed with `📌 PIN THIS COMMENT — post after publishing:\n\n{firstComment}`

Retain existing retry/timeout logic. Remove the old `sendDocument` image loop. Keep research brief, visual asset plan, and manual prompt as documents (they're reference files, not action items).

**Solution — Email: labeled sections**

Add a clearly labeled "PIN THIS COMMENT" section to `emailDelivery.ts` HTML and text bodies. Currently the first comment is present but not separated with the "pin" instruction. Minor copy change only.

**Files changed:**
- `platform/src/lib/services/telegramDelivery.ts` — replace `uploadTelegramDocument` image loop with `sendMediaGroup` + 3 follow-up messages
- `platform/src/lib/services/emailDelivery.ts` — add labeled PIN THIS COMMENT section

---

## Phase 2 — Puppeteer renderer + design system slide templates

**Problem:**
The current renderer (`imageGenerationAgent.ts`) builds SVG strings and pipes them through Sharp. Sharp has no webfont loader — slides render in Arial/Impact. The design system specifies Inter Variable + JetBrains Mono. The visual output doesn't match the premium editorial spec.

**Solution:**

### 2a. Design tokens
Copy `colors_and_type.css` from the design bundle into `platform/src/app/render/tokens.css`. This file is the canonical source of truth for all color, typography, spacing, radius, shadow, and motion tokens.

### 2b. Puppeteer renderer module
New file: `platform/src/lib/render/puppeteerRenderer.ts`
- On boot: launch one headless Chromium with `puppeteer-core` + `@sparticuz/chromium` (Cloud Run–compatible). Keep it warm for the worker lifetime.
- Per slide: navigate to `http://localhost:3000/render/slide?template={name}&props={urlEncodedJson}`
- `page.screenshot({ type: 'png', clip: { x:0, y:0, width:1080, height:1350 } })` → PNG buffer
- Fallback: if Puppeteer fails, fall through to existing Sharp/SVG renderer

### 2c. Render route
New Next.js page: `platform/src/app/render/slide/page.tsx`
- Query params: `template` (string), `props` (url-encoded JSON)
- Imports the correct slide template component, mounts it client-side, renders at 1080×1350
- Links `tokens.css` + `slides.css`
- Must be a client component (`'use client'`) — server components can't render into the Puppeteer viewport

### 2d. Slide templates
Port all 13 JSX templates from `thestatsandstacks-design-system/project/ui_kits/slides/slides/` to `platform/src/components/slide-templates/*.tsx`:
- `SlideFrame.tsx` — outer frame, brand mark, disclosure, tone class
- `CoverSlide.tsx`
- `PureCoverSlide.tsx`
- `MarketPosterSlide.tsx`
- `FrameworkSlide.tsx`
- `ComparisonSlide.tsx`
- `MythVsFactSlide.tsx`
- `BigNumberSlide.tsx`
- `PureStatSlide.tsx`
- `QuoteSlide.tsx`
- `CashflowSlide.tsx`
- `RiskMapSlide.tsx`
- `OutroSlide.tsx`

Also port: `platform/src/components/slide-templates/slides.css`

### 2e. Wire into image generation agent
In `imageGenerationAgent.ts`, replace `generateLocalSlide()` with a call to `puppeteerRenderer.renderSlide(template, props)`. Keep existing Sharp/SVG as documented fallback. The `ImagePromptAgent` must pass a `template` field in each prompt object so the renderer knows which component to mount.

### 2f. Container
`Dockerfile`: add `puppeteer-core` + `@sparticuz/chromium`. Bump memory to 1Gi on Cloud Run. `package.json`: add `puppeteer-core`, `@sparticuz/chromium`.

---

## Phase 3 — New agents + dashboard

### 3a. Six new agents

**TickersInNewsAgent** (`platform/src/lib/agents/tickersInNewsAgent.ts`)
- Reads free RSS: CNBC, Reuters, MarketWatch. Cap 30 articles/day.
- Output: `{ tickers: [{ symbol, name, headline, source, publishedAt, sentiment }] }` — sentiment is +1/0/-1, never buy/sell
- Runs in parallel with HotTopicDeskAgents. Both feed TrendResearchAgent.

**HistoryGuardAgent** (`platform/src/lib/agents/historyGuardAgent.ts`)
- Loads last 60 days of posts from Prisma
- Computes Jaccard similarity on keywords. Blocks if overlap > 0.40.
- Returns `{ block: boolean, conflictsWith?: postId, suggestedPivot?: string }`
- Runs after TrendResearch, before Strategy. If blocked, Strategy retries with pivot.

**ReelPlannerAgent** (`platform/src/lib/agents/reelPlannerAgent.ts`)
- Only runs when `formatDecision.mediaFormat === 'REEL'`
- Output: `{ count, durationSec, scenes: [{ template, durationSec, props }] }`
- Constraint: `durationSec >= 7 && durationSec <= 12`

**SoundDesignAgent** (`platform/src/lib/agents/soundDesignAgent.ts`)
- Picks from local license-free ambient sound library based on tone
- Output: `{ audioPath, fadeInMs, fadeOutMs }`
- Library: 6 cues seeded in `platform/public/sounds/`. No Spotify/Apple/YouTube.

**RegenLoopAgent** (`platform/src/lib/agents/regenLoopAgent.ts`)
- Replaces simple `if (score < 0.80) reject` in VisionQA
- Loop: generate → critique → if score >= 0.80 return; else inject `correctionNotes` and retry
- MAX_ATTEMPTS = 5. On attempt 5, swap to fallback layout template.
- Writes each attempt to `RegenAttempt` Prisma model.

**FinalGateAgent** (`platform/src/lib/agents/finalGateAgent.ts`)
- Last-mile compliance check before delivery
- Checks: disclosure present, no banned hype words, no stray tickers, caption ≤ 1100 chars, hashtags ≤ 5
- On failure: auto-revise via Copywriter with `failedChecks` injected; re-check; max 2 revision attempts
- Hard block if still failing after 2 revisions → save draft, alert

### 3b. Vision Critic structured output
Replace current `VisionQAAgent` score-only return with:
```ts
interface CritiqueResult {
  score: number;
  pass: boolean;
  issues: Array<{ severity: 'high' | 'medium' | 'low'; body: string }>;
  layoutSuggestion?: string;
}
```
Gemini vision prompt updated to return JSON with all fields.

### 3c. BullMQ regen branch
Wire: `imageGen.queue → visionCritic.queue`
- pass: `copywriter.queue`
- fail: `regenLoop.queue` (re-enqueues imageGen with correctionNotes)

### 3d. Prisma schema additions
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
  critique    Json    // [{ severity, body }]
  resolved    Boolean
}
```

### 3e. Dashboard component port
Port all 7 components from `ui_kits/dashboard/components/` to `platform/src/components/dashboard/*.tsx`:
- `Header.tsx` — pulse dot, wordmark, Run Pipeline button
- `StatBar.tsx` — Posts / Ideas / QA Score grid
- `BriefModule.tsx` — 5-step brief chain
- `SlideGrid.tsx` — 3-col slide thumbnail grid with QA badges
- `PostMeta.tsx` — caption / hashtags / first comment / status cards
- `RegenLoopCard.tsx` — before/after diff + critic notes
- `PipelineStrip.tsx` — 18-agent chip strip with status

Copy `dashboard.css` to `platform/src/components/dashboard/dashboard.css`.

Replace `platform/src/app/page.tsx` inline Tailwind with these components, wired to real Prisma queries for `AgentRun` and `RegenAttempt`.

### 3f. Assets
Copy `assets/wordmark.svg` and `assets/avatar-mark.svg` to `platform/public/brand/`.

---

## Wire-up changes to `run-daily.ts`

- Add TickersInNewsAgent call (parallel with HotTopicDeskAgents)
- Add HistoryGuardAgent call (after TrendResearch, before Strategy)
- Replace `VisionQAAgent` + regen loop with `RegenLoopAgent`
- Add `FinalGateAgent` call (after Copywriting, before delivery)
- Log `AgentRun` records for each agent start/end

---

## Constraints carried from master.md

- Never recommend specific tickers as buys
- Never include price targets
- Never use hype verbs (explodes, moons, blasts off, skyrockets, can't miss)
- Never publish without "Educational only" disclosure
- Always cap hashtags at 5, captions at 1,100 chars
- Always save-as-draft and alert on FinalGate failure
- History Guard blocks topic repeats within 60-day window

---

## Success criteria

- Operator receives images as inline photos in Telegram (not file downloads)
- Caption, hashtags, pinned comment each arrive as separate copy-ready messages
- Generated slides render with Inter + JetBrains Mono webfonts (not Arial/Impact)
- Vision Critic self-corrects up to 5 times before falling back to alternate template
- Final Gate auto-revises non-compliant copy before failing hard
- Dashboard shows real AgentRun and RegenAttempt data, not hardcoded mock
