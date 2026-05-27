# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the `platform/` directory.

```bash
cd platform

npm run dev              # Next.js dev server (placeholder only)
npm run build            # Production Next.js build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run test             # Node test runner via tsx (runs __tests__/*.test.ts)
npm run daily            # Run the standalone daily content pipeline (run-daily.ts)
npm run migrate-history  # One-time seed-history loader (idempotent; in-process auto-migration runs every pipeline boot anyway)

# Run a single test file
npx tsx --test __tests__/ctaLibrary.test.ts
```

## Architecture (v2 — slot-aware, constraint-driven)

### One execution mode: standalone slot-aware pipeline

`run-daily.ts` is the only entryway. It runs via `npm run daily` (and via GitHub Actions). Each invocation is scoped to **one of 5 daily slots** identified by `SLOT_OVERRIDE` (or resolved from cron). The Next.js `src/app/` directory exists but only shows a placeholder. Prisma is in deps but unused.

### 5-slot persona system (the variety primitive)

Each day the pipeline runs 5 times, once per slot. Slot personas are locked in `platform/src/lib/agents/slotConfig.ts`:

| Slot | PT time | Persona | Format pool | Angle pool | Hook formulas |
| --- | --- | --- | --- | --- | --- |
| 1 | 07:00 | Pre-market news | NEWS_FLASH, MARKET_UPDATE | Catalyst news, earnings, index rebalance | ANTI_FOMO, CALENDAR_TRIGGER |
| 2 | 10:00 | Portfolio / power-player | EXPERT_SHOCK, MARKET_UPDATE | 13F, cap-tables, politician disclosures | RECEIPT_DROP, CAP_TABLE |
| 3 | 13:00 | Data / education | MARKET_UPDATE, MINIMAL_TECH | ETF X-ray, comparisons, fees | IF_THEN_LADDER, DECISION_FORK |
| 4 | 16:30 | Contrarian / myth-bust | MINIMAL_TECH, EXPERT_SHOCK | Reactive sentiment (manual), reverse-survivorship | MYTH_STRIKE, PREMIUM_CONTRARIAN |
| 5 | 19:30 | Lifestyle / storytelling | LUXURY_LIFESTYLE | Hypothetical reversals, behavioral receipts | TIME_CAPSULE, COHORT_TRUTH |

By construction, the 5 same-day posts come from 5 different lanes. Slot index is resolved in `slotContextAgent.ts` from the cron's UTC hour mapped through PDT/PST tables; `workflow_dispatch` **requires** `SLOT_OVERRIDE=1..5` (fails fast otherwise).

### Agent pipeline (run-daily.ts)

| # | Agent | File |
| --- | --- | --- |
| 0 | Cost guard | `costGuardAgent.ts` |
| 1 | Slot context resolver | `slotContextAgent.ts` |
| 2A | Tickers in news (parallel) | `tickersInNewsAgent.ts` |
| 2B | Trend research (includes HotTopicDeskAgent) | `trendResearchAgent.ts` |
| 3 | Topic angle expansion | `topicAngleAgent.ts` |
| 4 | History guard (extended mustAvoid output) | `historyGuardAgent.ts` |
| 5 | Content strategy (slot-aware, picks hookFormulaId + ctaId) | `contentStrategyAgent.ts` |
| 6 | Format style (slot-aware allowedFormats + LRU) | `formatStyleAgent.ts` |
| 7 | Carousel constraints (runs BEFORE narrative) | `carouselConstraintAgent.ts` |
| 8 | Slide narrative (constraint-aware, 1 re-roll) | `slideNarrativeAgent.ts` |
| 9 | Compliance QA (strategy) | `complianceQAAgent.ts` |
| 10 | Image prompts (RECENT_MEMORY block, model recommendation) | `imagePromptAgent.ts` |
| 11 | Copywriting (fills CTA pattern from library) | `copywritingAgent.ts` |
| 12 | Final compliance QA (copy) | `complianceQAAgent.ts` |
| — | Telegram delivery (slot label, model rec, Canva fallback) | `telegramDelivery.ts` |

`FinancialVizPicker` and `HookQualityGate` are utilities invoked from inside the constraint and strategy agents respectively.

Unused/experimental (exist but not wired): `visionQaCriticAgent.ts`, `imageGenerationPipeline.ts`.

### Variety enforcement contract

- **Cross-day**: `HistoryGuardAgent` returns a `mustAvoid` set covering recently used visual styles (last 6), portrait subjects (last 10), hook formulas (last 3), tickers as hero (last 4), narrative arcs (last 3), color triples (last 4), and `REACTIVE_SENTIMENT` angle (last 35 ≈ 7 days hard block).
- **Pre-narrative constraints**: `CarouselConstraintAgent` runs BEFORE `SlideNarrativeAgent` (not after — this avoids copy/visual desync from post-hoc mutation). It produces `excludedStyles`, narrative arc, portrait selection, chart suggestions, max human slides, CTA shape implications, and `payoffSlideIndex` for swipe_promise.
- **Within-narrative validation**: `SlideNarrativeAgent` validates Gemini output against the constraints and retries ONCE with stricter prompting; second failure falls to a constraint-aware deterministic template.
- **LRU tiebreaker** in `services/lruPicker.ts` keeps the ~95 rotation primitives (formats, angles, hooks, CTAs, portraits, styles) all exercised within ~30 days.

### Portrait library (replaces hardcoded names)

`platform/src/lib/agents/portraitLibrary.ts` ships **20 named real people** (Tier 1, with `likenessConfidence: high|medium|low`) + **12 archetypes** (Tier 2). Picker filters by topic affinity, excludes last-10 subjects, prefers `high` confidence for cover slides, falls to Tier 2 when Tier 1 is exhausted. Templates in `promptLibrary.ts` use `[portraitSubject]` / `[portraitDescription]` placeholders — no hardcoded "Cathie Wood" / "Donald Trump" anchor strings.

### Visual style vocabulary

`promptLibrary.ts` is the canonical source for `ViralStyle`. ~50 templates grouped into: Data (charts), Cinematic/Metaphor, Human Elements, Typography/Layouts, plus 17 v2 specialized financial templates (CANDLESTICK_HERO, CAP_TABLE_GRID, INSTITUTIONAL_FLOW_SANKEY, EARNINGS_HEAT_TABLE, TYPOGRAPHIC_MEGA_NUMBER, EDITORIAL_REACTION_CARICATURE, etc.). `ROTATION_ALLOWLIST` excludes 4 styles (FLUID_LIQUID_TEXT, BILLBOARD_HIGHWAY, GRUNGE_STREET_POSTER, GLASSMORPHISM_UI) — they remain in the library for explicit override but never appear in rotation.

### CTA library + cohesive design

`platform/src/lib/agents/ctaLibrary.ts` exports 7 active CTA strategies (save_specific, share_use_case, comment_genuine_question, follow_authority, swipe_promise, question_open, reference_save) plus 2 gated ones (`dm_pull` requires `DM_AUTOMATION_ENABLED=true`; `story_vote` requires `STORY_AUTOMATION_ENABLED=true`). CTA selection happens in `ContentStrategyAgent` (not `CopywritingAgent`) so the chosen CTA shape flows into `CarouselConstraints` and influences narrative + visual. `CopywritingAgent` only **fills** the pattern slots.

### Reactive humor (manual-trigger only)

`REACTIVE_SENTIMENT` angle does NOT auto-detect market events (no S&P intraday or surge detection wired today). It fires only via `workflow_dispatch` with `SLOT_OVERRIDE=4` + `FORCE_ANGLE=REACTIVE_SENTIMENT`. Uses `EDITORIAL_REACTION_CARICATURE` style (editorial illustration tradition — explicitly NOT WSB-meme energy). Hard-capped to ≤1 per 7 days by HistoryGuardAgent.

### Image rendering targets

Prompts are tuned for **Seedance** (cinematic photoreal) and **ChatGPT image gen** (typography + charts). Each slide in the Telegram delivery is tagged with `Best: Seedance` / `Best: ChatGPT image gen` / `Either model works`. Mapping lives in `modelRecommendation.ts`. NOT optimized for Gemini Imagen or Midjourney; the LLM prompt explicitly forbids Midjourney CLI flags.

### Watermark

Each prompt instructs the model to render `@thestatsandstacks` as a typographic lower-third bar (no logo glyph). If a single render mis-renders the handle, user can fix one-off in Canva.

### AI model

All LLM calls use **Gemini** (`src/lib/services/gemini.ts`). Default model: `gemini-2.5-flash` (overridable via `GEMINI_TEXT_MODEL`). No image generation in the pipeline — user pastes prompts into Seedance / ChatGPT image gen manually.

### Content history & schema migration

`src/lib/services/contentHistory.ts` maintains a rolling **250-entry** JSON log (~50 days at 5 posts/day). **Composite dedup key** `${date}_s${slotIndex}` so 5 posts/day correctly produce 5 entries/day. Schema is `schemaVersion: 2` with extended categorical fields (`slotIndex`, `hookFormulaId`, `ctaId`, `topicCategory`, `narrativeArc`, `visualStylesUsed`, `coverVisualStyle`, `portraitSubjects`, `archetypesUsed`, `colorSchemeUsed`, `dominantSubjectClass`, `tickersFeatured`, `angleId`). **In-process auto-migration** runs in `loadContentHistory` — pre-v2 entries auto-upgrade on first load; no manual script required for deploy.

`parseEnumOrInfer` coerces free-text Gemini output to nearest valid enum so categorical fields aren't poisoned by bad LLM responses.

### CI / GitHub Actions

`.github/workflows/daily-post.yml`: **10 cron lines** (5 slots × PDT/PST pairs) plus a Node-based slot resolver step (replaces the prior Python window filter). `concurrency: { group: daily-post, cancel-in-progress: false }` serializes runs so concurrent slots cannot race on the `content-history.json` push. The history commit step does `git pull --rebase + 3 retries` to survive any remaining races.

`workflow_dispatch` requires the `slot_override` input (1-5); optional `force_angle` input for REACTIVE_SENTIMENT etc.

`HOT_TOPIC_WATCHLIST` is read from `platform/data/hotTopicWatchlist.json` at runtime (committed; single source of truth). `tickerLogoAgent.test.ts` fails CI if any watchlist ticker has no logo entry in `tickerLogoAgent.ts`.

Required secrets: `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Optional: `REDDIT_*`, `GMAIL_*`.

### Zero-cost mode

`ZERO_COST_MODE=true` is enforced in CI. `CostGuardAgent` validates env flags at run start and hard-blocks paid APIs (OpenAI images, Cloudflare Workers AI). Never disable this in CI without intent to incur charges. See `env.example` for full flag set.

## Key conventions

- `run-daily.ts` is the canonical pipeline. Adding a new agent = update `run-daily.ts` and write tests in `__tests__/`.
- New typed enum-categorical fields go through `parseEnumOrInfer` for LLM input robustness.
- All pickers (portrait, format, hook, CTA, angle, style) use the shared `lruRank`/`lruPick` from `services/lruPicker.ts` to ensure rotation primitives don't go cold.
- `CarouselConstraintAgent` runs BEFORE `SlideNarrativeAgent` (not after) — constraints flow into the narrative prompt, not as post-hoc mutation. Maintains copy↔visual coherence.
- `ImagePromptAgent` strips/parametrizes named-person strings in PROMPT_LIBRARY templates AND passes a `RECENT_MEMORY` block to Gemini so the LLM has explicit "don't reuse" awareness on top of programmatic guards.
- Content brand voice: Canadian personal finance, data-first, premium tone, educational not advisory. No buy/sell calls. `ComplianceQAAgent` enforces this.
- Hook formulas in `hookFormulas.ts` are typed; `HookQualityGate` enum-validates `hookFormulaId`, substantiation-checks via lemma/stem matching against slide breakdown, rejects WSB tone and hype verbs. Max 2 re-rolls then deterministic fallback.
- Test runner: `npx tsx --test __tests__/*.test.ts`. No Jest, no Vitest.
