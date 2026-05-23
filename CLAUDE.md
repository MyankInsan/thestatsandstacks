# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Next.js version warning

**Read `platform/node_modules/next/dist/docs/` before writing any Next.js code.** This version has breaking changes from training data. Heed all deprecation notices.

## Commands

All commands run from the `platform/` directory.

```bash
cd platform

npm run dev          # Next.js dev server (admin dashboard)
npm run build        # Production Next.js build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (no emit, type-check only)
npm run test         # Node test runner via tsx (runs __tests__/*.test.ts)
npm run daily        # Run the standalone daily content pipeline (run-daily.ts)

# Run a single test file
npx tsx --test __tests__/agents.test.ts

# Prisma
npx prisma migrate dev    # Apply migrations (local SQLite)
npx prisma studio         # Browse the DB
npx prisma generate       # Regenerate client after schema changes
```

## Architecture

### Two execution modes

**1. Standalone daily pipeline** (`run-daily.ts`) — what runs in CI  
Runs `npm run daily`, no Next.js server or database required. Orchestrates all agents, delivers a Telegram message with the creative brief, and saves a content-history JSON to `/tmp/thestatsandstacks-history/content-history.json`. Output artifacts go to `/tmp/thestatsandstacks/<date>/`.

**2. Next.js admin dashboard** (`src/app/`) — local/manual use  
Exposes `/api/run-workflow` (triggers the full workflow with DB writes via `src/lib/queue/workflow.ts`) and `/api/images/[...path]` (serves generated PNGs from the output folder). The dashboard UI is in `src/app/page.tsx` and `src/components/dashboard/`.

### Agent pipeline

Both modes follow the same logical sequence (agents 0–11); `run-daily.ts` is the authoritative pipeline for GitHub Actions and skips DB writes. `src/lib/queue/workflow.ts` is the DB-backed version used by the Next.js API route.

| # | Agent | File |
|---|-------|------|
| 0 | Zero-cost guard | `costGuardAgent.ts` |
| 1 | Trend research + TickersInNews + HistoryGuard | `trendResearchAgent.ts`, `tickersInNewsAgent.ts`, `historyGuardAgent.ts` |
| 2 | Media format decision (carousel vs single) | `mediaPlanningAgent.ts` |
| 3 | Carousel planning (slide count + frame roles) | `mediaPlanningAgent.ts` |
| 4 | Content strategy | `contentStrategyAgent.ts` |
| 5 | Compliance QA (strategy) | `complianceQAAgent.ts` |
| 6 | Image prompt generation | `imagePromptAgent.ts` |
| 7 | Copywriting (caption, hashtags, CTA, alt text) | `copywritingAgent.ts` |
| 8 | Final compliance QA (copy) | `complianceQAAgent.ts` |
| — | Telegram delivery | `telegramDelivery.ts` |

The full-server workflow adds Visual Asset Sourcing, Image Generation, and Vision QA with regeneration loop between steps 6 and 7.

All agents extend `BaseAgent` (`src/lib/agents/interfaces.ts`). Every agent takes a typed input object and returns a typed result — never `unknown` in practice despite the abstract signature.

### AI model

All agents use **Gemini** (`src/lib/services/gemini.ts`). Default model: `gemini-2.5-flash` (overridable via `GEMINI_TEXT_MODEL`). OpenAI is wired for image generation only and is blocked by default via `ALLOW_PAID_IMAGE_GENERATION=false`.

### Image generation & rendering

`ImageGenerationAgent` (`src/lib/agents/imageGenerationAgent.ts`) has three backends selected at runtime:

1. **Local Sharp SVG → PNG** — always free, always the fallback
2. **Cloudflare Workers AI** (Flux Schnell) — optional, capped free allocation
3. **Pexels / Wikimedia stock** — optional, license-safe sourcing

Slide templates (`src/components/slide-templates/`) are React components rendered to PNG by Puppeteer: `puppeteerRenderer.ts` does SSR (`renderToStaticMarkup`) then screenshots via headless Chrome at 1080×1350. CSS tokens come from `src/app/render/tokens.css`; slide styles from `src/components/slide-templates/slides.css`.

`RemotionAgent` (`src/lib/agents/remotionAgent.ts`) is the video path: bundles the Remotion root (`src/remotion/Root.tsx`), renders H.264 via headless Chrome, generates ambient A-minor music via FFmpeg, then merges them. Output: `<slug>_reel.mp4`. Remotion composition is 1080×1350 @ 25fps, 5s per slide with 0.48s crossfade.

### Content history & novelty

`src/lib/services/contentHistory.ts` maintains a rolling 45-entry JSON log of published topics. `HistoryGuardAgent` uses Jaccard similarity to block repeats (threshold 0.72 = hard block, 0.52 = score penalty). The file path is set via `CONTENT_HISTORY_PATH`; in CI it's cached between runs via `actions/cache`.

### Database

Prisma with SQLite (`platform/prisma/dev.db`) for local dev. Production targets PostgreSQL (swap `provider` in `schema.prisma`). The standalone pipeline (`run-daily.ts`) bypasses Prisma entirely. Schema models: `BrandSettings`, `ContentIdea`, `PostBrief`, `Prompt`, `GeneratedAsset`, `Post`, `PostAsset`, `Analytics`, `AgentRun`, `RegenAttempt`.

### CI / GitHub Actions

`.github/workflows/daily-post.yml` triggers at 8:00 AM Vancouver time (dual UTC crons at 15:00 and 16:00 to handle PST/PDT). The Vancouver-check step skips the off-hour cron. `workflow_dispatch` supports a `day_type` override (`auto` | `photo` | `video`). Required GitHub secrets: `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Optional: `CLOUDFLARE_*`, `PEXELS_API_KEY`, `REDDIT_*`, `GMAIL_*`.

### Zero-cost mode

`ZERO_COST_MODE=true` and `FREE_IMAGE_GENERATION_ONLY=true` are the defaults in CI. `CostGuardAgent` validates the env flags at run start and hard-blocks any paid API if the guard conditions aren't met. Never disable this without confirming you intend to incur charges.

## Key conventions

- `run-daily.ts` is the canonical pipeline for CI. When adding agents or pipeline steps, update both `run-daily.ts` and `src/lib/queue/workflow.ts`.
- Slide template props must be serializable — no functions, no React nodes — because they pass through JSON in the Remotion input props path.
- `PUPPETEER_EXECUTABLE_PATH` must be set for any local rendering or Remotion render. On macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- The `dayTypeAgent` (`decideDayType`) drives the `photo` vs `video` branch. Video days run `RemotionAgent` after image generation; photo days skip it.
- Content brand voice: Canadian personal finance audience, data-first, premium tone, educational not advisory. No buy/sell calls. The `ComplianceQAAgent` enforces this.
