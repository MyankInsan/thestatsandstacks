# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the `platform/` directory.

```bash
cd platform

npm run dev          # Next.js dev server (placeholder only)
npm run build        # Production Next.js build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Node test runner via tsx (runs __tests__/*.test.ts)
npm run daily        # Run the standalone daily content pipeline (run-daily.ts)

# Run a single test file
npx tsx --test __tests__/formatStyleAgent.test.ts
```

## Architecture

### One execution mode: standalone daily pipeline

`run-daily.ts` is the only entryway that matters. It runs via `npm run daily` (and via GitHub Actions). No Next.js server, no database, no Puppeteer, no video, no image generation — just agents + Telegram delivery.

The Next.js `src/app/` directory exists but only shows a placeholder page. It is not used for anything.

### Agent pipeline (run-daily.ts)

| # | Agent | File |
|---|-------|------|
| 0 | Zero-cost guard | `costGuardAgent.ts` |
| 1A | Tickers in news (parallel) | `tickersInNewsAgent.ts` |
| 1 | Trend research | `trendResearchAgent.ts` |
| 1B | History guard (topic novelty) | `historyGuardAgent.ts` |
| 2 | Content strategy | `contentStrategyAgent.ts` |
| 3 | Format style (picks one of 8 visual formats) | `formatStyleAgent.ts` |
| 4 | Slide narrative (exact text + visual per slide) | `slideNarrativeAgent.ts` |
| 5 | Compliance QA (strategy pass) | `complianceQAAgent.ts` |
| 6 | Image prompt generation (synchronous template) | `imagePromptAgent.ts` |
| 7 | Copywriting (caption, hashtags, pinned comment) | `copywritingAgent.ts` |
| 8 | Final compliance QA (copy pass) | `complianceQAAgent.ts` |
| — | Telegram delivery (intro message + .txt document) | `telegramDelivery.ts` |

### How the photo pipeline works

1. **FormatStyleAgent** picks one of 8 rotating `FormatType` values each day (`BREAKING_NEWS`, `HUMOR_MEME`, `DATA_SHOCK`, `CEO_AUTHORITY`, `EDUCATIONAL_CAROUSEL`, `HOT_TAKE`, `MARKET_SCOREBOARD`, `MYTH_VS_FACT`). It consults `contentHistory` to avoid repeating the last 2 formats. It calls Gemini for the decision; has a deterministic fallback.

2. **SlideNarrativeAgent** calls Gemini with the topic + format type to write exact slide specs (`SlideSpec[]`): headline text, which words get which accent colors, visual element description, role (`cover` / `shock_stat` / `context` / `breakdown` / `data` / `humor` / `cta`). Has a structured fallback.

3. **ImagePromptAgent** is synchronous — no LLM call. It converts each `SlideSpec` + `FormatDecision` into a complete ~300-word Gemini Imagen prompt string. The prompt specifies canvas size (1080x1350), background hex, visual element and position, exact text with hex colors, gradient overlay, brand mark (`@thestatsandstacks`), and slide counter. The user pastes each prompt directly into Gemini Imagen.

4. **Telegram delivery** sends an intro text message + one `.txt` document attachment with all prompts, caption, hashtags, and pinned comment. The document bypasses Telegram's 4096-char per message limit.

### AI model

All agents use **Gemini** (`src/lib/services/gemini.ts`). Default model: `gemini-2.5-flash` (overridable via `GEMINI_TEXT_MODEL`). No image generation happens in the pipeline — Gemini prompts are delivered to the user to paste manually.

### Content history & novelty

`src/lib/services/contentHistory.ts` maintains a rolling 45-entry JSON log. Fields include `formatType` (added 2026-05-22) so `FormatStyleAgent` can avoid repeating the same visual format. `HistoryGuardAgent` uses Jaccard similarity to block repeated topics (≥ 0.72 = hard block). The file path is set via `CONTENT_HISTORY_PATH`; in CI it's cached between runs via `actions/cache`.

### CI / GitHub Actions

`.github/workflows/daily-post.yml` triggers at 8:00 AM Vancouver time (dual UTC crons at 15:00 and 16:00). Required secrets: `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Optional: `REDDIT_*`, `GMAIL_*`.

### Zero-cost mode

`ZERO_COST_MODE=true` is enforced in CI. `CostGuardAgent` validates env flags at run start and hard-blocks any paid API. Never disable this in CI without intent to incur charges.

## Key conventions

- `run-daily.ts` is the canonical pipeline. Adding a new agent = update `run-daily.ts` and write tests in `__tests__/`.
- `ImagePromptAgent.execute()` is **synchronous** — it's a pure template builder, no async/LLM call.
- `FormatStyleAgent` and `SlideNarrativeAgent` both have Gemini fallbacks that activate when `GEMINI_API_KEY` is empty — this is the CI test path.
- Content brand voice: Canadian personal finance, data-first, premium tone, educational not advisory. No buy/sell calls. `ComplianceQAAgent` enforces this.
- Test runner: `npx tsx --test __tests__/*.test.ts`. No Jest, no Vitest.
