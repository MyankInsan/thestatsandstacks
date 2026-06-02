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

`run-daily.ts` is the only entryway. It runs via `npm run daily` (and via GitHub Actions). Each invocation is scoped to **one of 6 daily slots** identified by `SLOT_OVERRIDE` (or resolved from cron). The Next.js `src/app/` directory exists but only shows a placeholder. Prisma is in deps but unused. Importing `run-daily.ts` does NOT execute the pipeline — `main()` is guarded by `require.main === module`; the side-effect-free `isTickerActive()` lives in `tickerMatch.ts`.

### 6-slot persona system (the variety primitive)

Each day the pipeline runs 6 times, once per slot. Slot personas are locked in `platform/src/lib/agents/slotConfig.ts` (PT hours below match the `ptHour` fields there):

| Slot | PT time | Persona | Format pool | Angle pool | Hook formulas |
| --- | --- | --- | --- | --- | --- |
| 1 | 07:00 | Pre-market news | NEWS_FLASH, MARKET_UPDATE | Catalyst news, earnings, index rebalance | ANTI_FOMO, CALENDAR_TRIGGER |
| 2 | 09:00 | Portfolio / power-player | EXPERT_SHOCK, MARKET_UPDATE | 13F, cap-tables, politician disclosures | RECEIPT_DROP, CAP_TABLE |
| 3 | 11:00 | Data / education | MARKET_UPDATE, MINIMAL_TECH | ETF X-ray, comparisons, fees | IF_THEN_LADDER, DECISION_FORK |
| 4 | 13:00 | Contrarian / myth-bust | MINIMAL_TECH, EXPERT_SHOCK | Reactive sentiment (manual), reverse-survivorship | MYTH_STRIKE, PREMIUM_CONTRARIAN |
| 5 | 14:00 | Lifestyle / storytelling | LUXURY_LIFESTYLE | Hypothetical reversals, behavioral receipts | TIME_CAPSULE, COHORT_TRUTH |
| 6 | 15:00 | Meme / financial humor | MEME_HUMOR | Hypothetical reversals, behavioral receipts, comparisons | REVERSE_SURVIVORSHIP, MYTH_STRIKE |

By construction, the 6 same-day posts come from 6 different lanes. Slot index is resolved in `slotContextAgent.ts` from the cron's UTC hour mapped through PDT/PST tables; `workflow_dispatch` **requires** `SLOT_OVERRIDE=1..6` (fails fast otherwise). `.github/workflows/daily-post.yml` schedules all 6 slots (see CI section).

### Agent pipeline (run-daily.ts)

| # | Agent | File |
| --- | --- | --- |
| 0 | Cost guard | `costGuardAgent.ts` |
| 1 | Slot context resolver | `slotContextAgent.ts` |
| 2A | Tickers in news (parallel) | `tickersInNewsAgent.ts` |
| 2B | Trend research (includes HotTopicDeskAgent) | `trendResearchAgent.ts` |
| 3 | Topic angle expansion | `topicAngleAgent.ts` |
| 4 | History guard (extended mustAvoid output) | `historyGuardAgent.ts` |
| 3.5 | Selected topic decision (preserves angle ranking + slideSkeleton through HistoryGuard pivots) | `topicSelection.ts` |
| 5 | Content strategy (slot-aware, picks hookFormulaId + ctaId, consumes `selectedTopic`) | `contentStrategyAgent.ts` |
| 6 | Format style (slot-aware allowedFormats + LRU) | `formatStyleAgent.ts` |
| 7 | Carousel constraints (runs BEFORE narrative) | `carouselConstraintAgent.ts` |
| 7.5 | **Visual plan (deterministic — LOCKS slide grammar + storyboard + compositionSignature before copy)** | `visualPlanAgent.ts` |
| 8 | Slide narrative (copy-only — fills the locked plan; drift retry then deterministic copy) | `slideNarrativeAgent.ts` |
| 9 | Compliance QA (strategy) | `complianceQAAgent.ts` |
| 10 | Image prompts (slot-aware scene variety, ChatGPT Images 2.0 packet, evidence suppression) | `imagePromptAgent.ts` |
| 11 | Copywriting (fills CTA pattern from library) | `copywritingAgent.ts` |
| 12 | Final compliance QA (copy) | `complianceQAAgent.ts` |
| — | Telegram delivery (Post x/6 label, primary route, review block, variety warning) | `services/telegramDelivery.ts` |

`FinancialVizPicker` and `HookQualityGate` are utilities invoked from inside the constraint and strategy agents respectively. `ResearchEvidenceGate` (`researchEvidenceGate.ts`) is a deterministic utility: it computes claim-level `reviewFlags`, builds the Telegram review block, and drives "illustrative" figure suppression. The ten-day variety contract lives in `varietyContract.ts`.

Unused/experimental (exist but not wired): `visionQaCriticAgent.ts`, `imageGenerationPipeline.ts`.

### Variety enforcement contract

- **Cross-day**: `HistoryGuardAgent` returns a `mustAvoid` set covering recently used visual styles (last 6), portrait subjects (last 10), hook formulas (last 3), tickers as hero (last 4), narrative arcs (last 3), color triples (last 4), and `REACTIVE_SENTIMENT` angle (last 35 ≈ 7 days hard block).
- **Pre-narrative constraints**: `CarouselConstraintAgent` runs BEFORE `VisualPlanAgent` and `SlideNarrativeAgent` (not after — this avoids copy/visual desync from post-hoc mutation). It produces `excludedStyles`, narrative arc, portrait selection, chart suggestions, max human slides, CTA shape implications, and `payoffSlideIndex` for swipe_promise.
- **Locked visual grammar**: `VisualPlanAgent` (deterministic, side-effect-free) converts policy into a complete slide-by-slide `VisualPlan` — per-slide `visualStyle`, `visualPosition`, `role`, `bucket`, `dominantSubjectClass`, `layoutArchetype`, `primaryEncoding`, `sceneConceptId`, plus `StoryboardContinuity` (premise, anchor, shared invariants, progression/resolution rules) and a `compositionSignature`. It enforces no-adjacent-bucket / no-adjacent-dominant-subject, human caps, required chart slides, and payoff placement.
- **Copy-only narrative**: `SlideNarrativeAgent` fills copy into the locked plan and does NOT choose styles/positions/roles. Grammar drift in Gemini output is rejected (one retry), then a deterministic copy fallback fills the locked grammar. The legacy constraint-only path remains for callers that pass no `visualPlan`.
- **Ten-day variety contract** (`varietyContract.ts`): hard-blocks an identical `compositionSignature` within the trailing 60 packets, same-day `sceneConceptId`/`ctaConceptId`/prompt-fingerprint reuse, and an identical cover composition within a shorter cover window (10 packets — the cover-tuple space is too small for a 60-window). `VisualPlanAgent` retries with growing style exclusions to escape collisions; if it can't, it flags `usedFallback` so Telegram surfaces a variety-pressure warning. It never silently reuses a composition.
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

**ChatGPT Images 2.0** is the PRIMARY manual render target; **Seedream** is the cinematic image-first alternate (the old `Seedance` label was a misnomer and is corrected). Each compiled prompt is a labeled-section packet (`DELIVERABLE`, `STORYBOARD CONTINUITY`, `MUST KEEP`, `CHANGE ONLY`, `PURPOSE`, `INFORMATION ARCHITECTURE`, `SUBJECT AND SCENE`, `COMPOSITION`, `EXACT TEXT`, `DATA GRAPHIC SPECIFICATION`, `STYLE AND MATERIALS`, `NEGATIVE CONSTRAINTS`) designed for one ChatGPT conversation: paste the slide-1 anchor, then continue in the same chat keeping the `MUST KEEP` invariants. `modelRecommendation.ts` tags each slide; `imagePromptAgent.ts` seeds scene variants with `${date}-s${slot}` so same-day slots don't collapse onto the same scene. No Seedream/Seedance API is integrated — prompts are pasted manually. NOT optimized for Gemini Imagen or Midjourney; the LLM prompt forbids Midjourney CLI flags.

### Watermark

Each prompt instructs the model to render `@thestatsandstacks` as a typographic lower-third bar (no logo glyph). If a single render mis-renders the handle, user can fix one-off in Canva.

### AI model

All LLM calls use **Gemini** (`src/lib/services/gemini.ts`). Default model is pinned to a stable model: **`gemini-3.5-flash`** (overridable via `GEMINI_TEXT_MODEL`). `CostGuardAgent` fails closed in zero-cost mode unless the configured model is on the explicit stable free-tier allowlist (`STABLE_GEMINI_TEXT_MODELS`: gemini-3.5-flash, gemini-3.1-flash-lite, gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.0-flash, gemini-2.0-flash-lite) and contains no `latest`/preview/experimental/image/audio/live token. No image generation in the pipeline — the user pastes prompts into ChatGPT Images 2.0 (or Seedream) manually. The deprecated `@google/generative-ai` SDK is kept for now; a migration to `@google/genai` is a separate reviewed change.

### Content history & schema migration

`src/lib/services/contentHistory.ts` maintains a rolling **250-entry** JSON log (~42 days at 6 posts/day). **Composite dedup key** `${date}_s${slotIndex}` so 6 posts/day correctly produce 6 entries/day. Schema is `schemaVersion: 3`: v2 categorical fields plus a `visualPlan` (`PersistedVisualPlan`: `compositionSignature`, `structureFamily`, `coverMechanism`, `sceneConceptIds`, `ctaConceptId`, `usedFallback`, and slide-level `layoutArchetype`/`primaryEncoding`/`visualStyle`/`bucket`/`visualPosition`/`dominantSubjectClass`/`sceneConceptId`/`promptFingerprint`). **In-process auto-migration** runs in `loadContentHistory` — pre-v3 entries auto-upgrade on first load WITHOUT inventing missing grammar; variety guards read v3 plans when present and fall back to legacy cover fields.

`parseEnumOrInfer` coerces free-text Gemini output to nearest valid enum so categorical fields aren't poisoned by bad LLM responses.

### CI / GitHub Actions

`.github/workflows/daily-post.yml`: **10 cron lines** (UTC 14:00–23:00) that, via a Node-based slot resolver keyed on current Vancouver DST, resolve to exactly **6 firing slots per day** (the overlapping hours map to different slots under PDT vs PST and skip otherwise). `slotConfig.ts` maps all 6 slots in both DST flavors. Scheduled runs always execute against the default branch (`main`), so new pipeline code must be merged to `main` to take effect. `concurrency: { group: daily-post, cancel-in-progress: false }` serializes runs so concurrent slots cannot race on the `content-history.json` push. The history commit step does `git pull --rebase + 3 retries` to survive any remaining races.

`workflow_dispatch` requires the `slot_override` input (1-6); optional `force_angle` input for REACTIVE_SENTIMENT etc.

### Research evidence gate

`researchEvidenceGate.ts` separates semantic correctness from visual polish. `computeReviewFlags` deterministically flags claim shapes (`RECORD_HIGH_CLAIM`, `POLITICIAN_DISCLOSURE`, `CORPORATE_ACTION_SENSITIVE_RETURN`, `ANOMALY_MOVE`, `SECONDARY_ONLY_NEWS`, → `MANUAL_REVIEW_REQUIRED`); flags propagate via `SelectedTopicDecision` → `StrategyDecision.reviewFlags` and surface as a Telegram review block. The narrative marks inferred figures with the literal word `illustrative`, and `ImagePromptAgent` suppresses those exact numbers from the render. Yahoo's 5-year index window is named `fiveYearHigh` (never "all-time high") so a 5-year high can't become a polished record-high graphic.

`HOT_TOPIC_WATCHLIST` is read from `platform/data/hotTopicWatchlist.json` at runtime (committed; single source of truth). `tickerLogoAgent.test.ts` fails CI if any watchlist ticker has no logo entry in `tickerLogoAgent.ts`.

Required secrets: `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. Optional: `REDDIT_*`, `GMAIL_*`.

### Zero-cost mode

`ZERO_COST_MODE=true` is enforced in CI. `CostGuardAgent` validates env flags at run start and hard-blocks paid APIs (OpenAI images, Cloudflare Workers AI). Never disable this in CI without intent to incur charges. See `env.example` for full flag set.

## Key conventions

- `run-daily.ts` is the canonical pipeline. Adding a new agent = update `run-daily.ts` and write tests in `__tests__/`.
- New typed enum-categorical fields go through `parseEnumOrInfer` for LLM input robustness.
- All pickers (portrait, format, hook, CTA, angle, style) use the shared `lruRank`/`lruPick` from `services/lruPicker.ts` to ensure rotation primitives don't go cold.
- Order is `CarouselConstraintAgent` → `VisualPlanAgent` (locks grammar) → `SlideNarrativeAgent` (copy-only). Constraints/plan flow forward into copy, never post-hoc mutation — this maintains copy↔visual coherence.
- `VisualPlanAgent` is deterministic and side-effect-free. Any new per-slide visual decision (style, position, bucket, encoding) belongs there, not in `SlideNarrativeAgent`. Persist new grammar in `PersistedVisualPlan` and account for it in `varietyContract.ts`.
- The selected angle/topic is one object (`SelectedTopicDecision` from `topicSelection.ts`) threaded end-to-end. Never read `angleCandidates[0]` directly downstream — the surviving topic after a HistoryGuard pivot carries the correct angle.
- `ImagePromptAgent` strips/parametrizes named-person strings in PROMPT_LIBRARY templates AND passes a `RECENT_MEMORY` block to Gemini so the LLM has explicit "don't reuse" awareness on top of programmatic guards. Scene variants are seeded with `${date}-s${slot}` to avoid same-day collisions.
- Importing `run-daily.ts` must stay side-effect-free (`main()` is `require.main`-guarded). Tests import `isTickerActive` from `tickerMatch.ts`, never the entrypoint.
- Content brand voice: Canadian personal finance, data-first, premium tone, educational not advisory. No buy/sell calls. `ComplianceQAAgent` enforces this.
- Hook formulas in `hookFormulas.ts` are typed; `HookQualityGate` enum-validates `hookFormulaId`, substantiation-checks via lemma/stem matching against slide breakdown, rejects WSB tone and hype verbs. Max 2 re-rolls then deterministic fallback.
- Test runner: `npx tsx --test __tests__/*.test.ts`. No Jest, no Vitest.
