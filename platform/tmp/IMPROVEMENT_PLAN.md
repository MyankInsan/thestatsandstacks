# TheStatsAndStacks — Daily Carousel Workflow Improvement Plan

> Status: PROPOSAL for review. No code changed yet. Scope: the `platform/` daily prompt pipeline (`run-daily.ts` + agents) that emails/Telegrams 6 ChatGPT-Images-2.0 prompt packets per day.
> Verified facts used below: CoinGecko public/Demo API, SEC EDGAR full-text + submissions, and major-outlet RSS (CNBC/MarketWatch/Nasdaq/Yahoo/CoinDesk + Google News RSS) are free + keyless in 2026; 2026 IG ranks saves + DM "sends" above likes and gives carousels a "second-chance" slide-2 impression (Mosseri). Sources listed at the end.
> **This plan was QA-reviewed by an independent agent (verdict: APPROVE-WITH-CHANGES) and revised.** All 9 code-grounded claims were confirmed; 6 must-fix gaps were folded in (marked “[QA]” inline).
>
> **Design principle (from QA): measured-and-warned, not asserted-guarantee.** Where the first draft promised hard guarantees ("≥4 timely/day by construction," "variety banks large enough"), the revised plan converts them to per-slot policies + soft LRU rotation that the QC gate *measures and warns on*, so the system degrades visibly instead of silently or jamming into permanent fallback.

---

## 0. TL;DR — what's actually wrong and the shape of the fix

The pipeline's *infrastructure* is genuinely strong (slot personas, deterministic visual plan that locks grammar before copy, a 60-packet composition-signature variety contract, an evidence gate, zero-cost guard, GitHub-Actions hosting). The problems are **policy and content**, not architecture:

1. **Every cover is the same layout by construction.** `visualPlanAgent.ts` forces `visualPosition='top'` for every cover (`naturalPositionForStyle`, line ~187), which makes every cover's `layoutArchetype = 'hero-top'`. So 100% of covers are "headline stacked in the top third over a photo." The variety contract can't fix this because the cover's layout axis is a constant. **This is the single biggest cause of the "text + image feel separated / everything looks the same" complaint.**
2. **Text is always a separate overlay zone, never baked into the scene.** `compilePromptString` always emits a positioned `EXACT TEXT` block. There is no "integrated text" mode (text on a magazine cover, a phone screen, a newspaper, a chart axis, a terminal).
3. **The exact clichés you named are hardcoded and in active rotation:** missile (`MILITARY_AEROSPACE_METAPHOR`), bull (`ANIMAL_METAPHOR`), vault (`VAULT_SECURITY`), Rolex/jet/yacht (`LUXURY_SCENE_VARIANTS`), plant-in-coins (`NATURE_METAPHOR`), glowing-globe boardroom (`PREMIUM_CTA`). Nothing tracks "cliché-motif density."
4. **The topic engine is Canada-first, fighting your 80%-US goal.** `trendResearchAgent.ts` literally says "premium Canadian personal finance brand," its evergreen backlog is ~80% Canadian, and `growthScoreAdjustment` *rewards* Canadian keywords. Production history shows TFSA/RRSP/FHSA, HISA/GIC/ETF, and "Credit Score Myths" each repeating within 2–3 days.
5. **Not hot enough.** Live data exists (Yahoo quotes + news, Reddit) but: indices are only S&P 500 + TSX (no Nasdaq/Dow/VIX), **no crypto at all**, **no IPO detection**, **no news RSS**, and slots 4/5/6 almost never run on news.
6. **CTA visuals are luxury-cliché.** `CTA_STYLE_POOL = [PREMIUM_CTA, LUXURY_LIFESTYLE, VAULT_SECURITY, GLOWING_QUOTE, MAGAZINE_COVER]` — i.e., the globe-boardroom / Rolex-desk / business-card-skyline endings you flagged. CTA copy is hardcoded Canadian.
7. **Anti-repetition has blind spots:** cover layout is constant (above); no camera/crop axis; no motif ledger; **palette rotation is dead code** (`last4Color` is computed then `void`-discarded in `carouselConstraintAgent.ts`), so the whole feed reads as black + one accent.

The fix is staged: rebalance policy first (low-risk config), then add free hot-topic sources, then add layout/camera/motif/palette variety + integrated-text prompts, then a consolidated QC gate. Everything stays zero-cost and keeps running with your computer off (already true today).

---

## 1. Diagnosis (detailed)

### 1a. Why outputs look visually repetitive
- **Cover layout is a constant.** `naturalPositionForStyle(style, 'cover')` → `'top'` always ⇒ `layoutArchetypeFor` → `hero-top` always. The cover variety tuple in `varietyContract.ts` is `coverMechanism | layoutArchetype | dominantSubjectClass`; with `layoutArchetype` pinned, cover distinctiveness collapses to mechanism × subject — a small space — so covers rhyme. **The attached examples prove it:** missile, vault, bull, F1 car, plant-in-coins, monitor-chart all share the identical "eyebrow + 2-line caps headline + thin subtext in the top third, cinematic image filling the rest."
- **Text never integrates with the image.** Every slide compiles a separate `EXACT TEXT` overlay positioned in a corner/third. There's no archetype where the headline *is* the scene.
- **Monochrome feed.** Palette rotation is dead code; `format.colorScheme` trends to black bg + white + 1 accent. Premium per-post, monotonous across the grid.
- **Cliché motifs recur.** The metaphor styles ship fixed iconography; the variety contract blocks identical *signatures* but not "we used a charging bull, a missile, and a vault this week."
- **Same type system every slide** (condensed bold caps headline, tracked-out eyebrow, thin subtext) — correct for brand cohesion but, combined with the above, reads as one template.

### 1b. Where topic selection is weak
- **Canada bias upstream.** `trendResearchAgent` prompt + `buildResearchBacklog` (13 candidates, ~10 Canadian) + `growthScoreAdjustment` (+0.02 for `tfsa|rrsp|fhsa|canadian|canada`). `contentStrategyAgent` is already correctly "North American (US & Canadian)" and region-matches references — but it picks from a Canada-skewed funnel, and 6 of its 9 fallback strategies are Canadian.
- **Evergreen over-rotation.** History shows the same evergreen topics within days. `isTooSimilarToRecent` (Jaccard ≥0.62 over last 10) catches near-identical titles but not "same evergreen concept, reworded," and there's no concept-family cooldown.
- **Thin hot-topic surface.** Only 2 indices, no crypto/IPO/RSS. Single-stock catalysts come only from a static watchlist via Yahoo news search. Slots 4 (contrarian), 5 (lifestyle), 6 (meme) pull evergreen angles, so ≥3 of 6 daily posts are rarely timely — the opposite of your "4–5 of 6 should be verified-timely" target.
- **Accuracy leak.** Despite the careful 5-year-high naming guard, "TSX Record High" and "S&P 500 Record High" leaked into *topic titles* (2026-05-30). The guard protects the rendered figure, not the LLM-authored title.

### 1c. Why CTA slides feel boring
- **CTA visual = luxury cliché.** `CTA_STYLE_POOL` overrides the storyboard's own "resolve the slide-1 motif" rule with globe-boardroom / jet-Rolex / vault. The two "FOLLOW FOR DAILY INSIGHTS" and "INVEST LIKE THE SMART MONEY" examples are exactly this pool.
- **CTA copy is hardcoded Canadian** ("Follow for daily Canadian finance posts") — wrong for an 80%-US feed.
- **CTA concept only deduped same-day** (`ctaConceptId`), so the same luxury-desk ending recurs across days.

### 1d. What to KEEP (do not "fix" these)
- The labeled-section packet (`DELIVERABLE → STORYBOARD CONTINUITY → MUST KEEP → CHANGE ONLY → … → NEGATIVE CONSTRAINTS`) and the single-conversation anchor workflow — excellent for ChatGPT Images 2.0.
- Deterministic `VisualPlanAgent` locking grammar *before* copy, with copy-only `SlideNarrativeAgent`. Keep this ordering; extend it.
- The 60-packet composition-signature contract + LRU pickers + HistoryGuard `mustAvoid`. Genuinely good; extend, don't replace.
- `researchEvidenceGate` (illustrative-figure suppression, 5-year-high naming), `CostGuardAgent` zero-cost enforcement, exact-text control, palette anchoring, Midjourney-flag bans, premium-polish/financial-text kits, watermark line.

---

## 2. Daily topic engine (hotter, verified, US-weighted)

**Goal: ≥4 of 6 daily posts on verified, <48h finance/market/crypto/IPO/business news; evergreen only when timely or packaged with a strong angle; ~80% US / 20% CA.**

### 2a. New free, keyless sources (no new secrets required)
Add small, isolated collectors that follow the existing `signalBriefs` contract (so they slot into `trendResearchAgent` with no plumbing changes):

| New agent | Source (free, keyless) | What it adds |
| --- | --- | --- |
| `newsRssAgent.ts` | RSS: CNBC markets, MarketWatch top stories, Nasdaq, Yahoo Finance, CoinDesk (crypto), **+ Google News RSS queries** (`news.google.com/rss/search?q=…`) | A 24h "what happened in finance" digest of headlines with publish timestamps + source links |
| `cryptoHeatAgent.ts` | CoinGecko public/Demo API (`/coins/markets`, `/search/trending`) + Yahoo `BTC-USD`, `ETH-USD` | BTC/ETH/SOL moves, trending coins, rallies/crashes — the entire CRYPTO category is currently unfed |
| `ipoFilingsAgent.ts` | SEC EDGAR full-text search (`efts.sec.gov/LATEST/search-index?forms=S-1`) + daily index Atom | Fresh S-1 / IPO / 424B filings → "new IPO filed" posts |
| (extend) `MarketHeatAgent` | Yahoo: add `^IXIC` (Nasdaq), `^DJI` (Dow), `^VIX` | Nasdaq/Dow highs+selloffs, volatility spikes |

**[QA] Source list corrected + reliability treated as the expected case (not an edge case).**
- **Reuters dropped:** Reuters discontinued official public RSS in June 2020 — it would be a dead feed. Replaced with **Google News RSS** (`news.google.com/rss/search?q=<topic>+when:1d`), which is free, keyless, robust from datacenter IPs, and can target any source/topic — the single most resilient aggregator for unattended Actions.
- **Redundancy is a hard requirement, not a note:** ingest **5–6 feeds per category** so any one dead/changed feed is a non-event.
- **Throttling is expected:** CoinGecko keyless (5–15/min) and Yahoo unofficial endpoints frequently 429/403 from GitHub's shared IPs. Treat throttle as normal: cache the last good response, back off, and fall through to the next source. The optional free CoinGecko **Demo key** (100/min, 10k/mo) is the recommended hedge if crypto throttles often.
- **Fresh-signal health check:** the QC gate (§6) WARNs when a run produced **zero live timely signals** so a day that silently degrades to all-evergreen is *visible*, not invisible.

Implementation notes: parse RSS with a tiny dependency-light parser (`fast-xml-parser`, or a minimal regex extractor; prefer a real parser). All collectors must be `Promise.allSettled` + timeout-guarded exactly like `collectResearchSignals`, returning a `fallback` brief on failure so a dead feed never breaks a run. Send a descriptive `User-Agent` to SEC (their fair-access policy requires it; the codebase already uses this pattern). New collectors are deterministic HTTP — they add seconds, not extra LLM calls.

### 2b. Verify vs rumor (extend `researchEvidenceGate.ts`)
Add a **source-tier + corroboration** model so nothing unverified ships unlabeled:
- `sourceTier`: `OFFICIAL` (SEC filing, exchange/Fed/BoC, company IR), `MARKET_DATA` (Yahoo/CoinGecko quote), `REPUTABLE_PRESS` (CNBC/Reuters/MarketWatch RSS), `AGGREGATED` (Reddit/social).
- A topic is `VERIFIED` only with ≥1 OFFICIAL/MARKET_DATA source **or** ≥2 independent REPUTABLE_PRESS items on the same claim; otherwise `DEVELOPING`. Reddit/social-only ⇒ `RUMOR`.
- New review flags: `RUMOR_SINGLE_SOURCE`, `UNCORROBORATED`, `STALE_SIGNAL` (>48h for a "breaking" slot). `RUMOR` topics are either dropped or rendered with an explicit "Unconfirmed / developing" label slide — never as fact.
- Keep the existing record-high / politician / anomaly flags; **add a title-level guard**: strip "record high / all-time high" from any LLM topic title unless `sourceTier=OFFICIAL` corroborates it (closes the 2026-05-30 "TSX/S&P Record High" leak where the figure-level guard held but the title didn't).
- **[QA] Persist `sourceTier` + source URLs into history** (not just the QC block) so rumor handling and the record-high guard have an auditable trail and future runs can detect re-posting the same catalyst. Merge this with the `trend-archive.json` idea in §8 (one store, not two).

### 2c. Engagement scoring (replace the ad-hoc score adds)
Add `topicEngagementScore(candidate, history)` combining, deterministically:
- **Freshness** (hours since publish; sharp decay after 48h),
- **Source tier** (VERIFIED > DEVELOPING > RUMOR),
- **Magnitude / notoriety** (size of move; mega-cap or marquee name: NVDA/TSLA/AAPL/MSFT/OpenAI/crypto majors),
- **Save/share shape** (comparison, checklist, hypothetical "$10k in X", receipt/scoreboard, myth-bust),
- **Region weight** (target 0.8 US / 0.2 CA; down-weight CA past quota),
- **Novelty** (concept-family cooldown — see 2d),
- Penalize hype/recommendation language (already partly done in `sanitizeTrendCandidate` / `containsBlocked*`).

### 2d. Trending vs evergreen quota + concept-family cooldown
- Tag every candidate with `topicMode: 'TIMELY' | 'EVERGREEN'` and a `topicFamily` (e.g. `ACCT_COMPARISON`, `CREDIT_MYTHS`, `INDEX_LEVEL`, `SINGLE_STOCK_CATALYST`, `CRYPTO_MOVE`, `IPO`, `HYPOTHETICAL_RETURN`).
- **[QA] Deterministic `topicFamily` classifier — the load-bearing piece.** The cooldown only works if an LLM-authored free-text title is reliably tagged; the current title-Jaccard (`isTooSimilarToRecent` ≥0.62 / `noveltyPenalty`) provably misses "same concept, reworded," which is the actual failure mode. Add `inferTopicFamily(title, keywords, angleId)` as a **regex/keyword → family-enum map** (exactly mirroring the existing `inferTopicCategoryFrom` precedent in `contentStrategyAgent.ts`), routed through `parseEnumOrInfer` for robustness. Without this classifier the cooldown is cosmetic, so it ships in the *same* change.
- **[QA] Slot topic-mode policy (per-slot, honestly scoped — NOT "by construction").** Each slot is an independent GitHub Actions job and cannot see what the other 5 slots picked *this* run (they only share `content-history.json` after each commits, serialized). So the policy is per-slot: slots 1, 2, 3, 6 = **timely-first** ("take a VERIFIED <48h topic *if one exists*, else evergreen-with-a-fresh-angle"); slots 4, 5 = evergreen-or-timely. The **actual** timely count is then *measured and reported* in the Telegram QC block (§6) and WARNed if it drops below 4 — rather than falsely guaranteed. On a rich news day you'll get 5–6 timely; on a quiet day the QC block tells you it was lower and why.
- **Concept-family cooldown:** block re-running the same `topicFamily` within ~21 days unless a fresh catalyst attaches; this is what finally stops "TFSA vs RRSP" / "HISA vs GIC" / "Credit Myths" running twice a week. Implemented as an extension of `noveltyPenalty` keyed on the classifier's family tag, read from history.
- **US/CA balance:** the strategist already region-matches references; add an explicit instruction + the region weight so ~80% of selected topics are US, and rewrite the upstream Canada-first framing in `trendResearchAgent` to "premium North American (US-weighted) markets & money brand." Remove the Canadian-keyword score bonus in `growthScoreAdjustment`.

### 2e. Expanded angle library (close the gaps)
Add angles so slots have hot material: `SINGLE_STOCK_CATALYST`, `CRYPTO_MOVE`, `IPO_WATCH`, `INDEX_MOVE` (up/down day or new high), `EARNINGS_SCORECARD`, `MEGA_CAP_RECAP`, `24H_FINANCE_DIGEST` ("what happened in finance in the last 24h"). Map each to existing chart styles in `financialVizPicker.ts` (candlestick, line+annotation, heat table, ticker tape, treemap). These are educational/"what happened + what to watch + risk" framings — no buy/sell calls (keeps compliance intact).

---

## 3. Visual rotation system (10–15 day anti-repetition, premium variety)

> **[QA] Satisfiability first — hard blocks vs soft rotation.** The existing contract already had to *shrink* the cover-tuple window to 10 packets because small-cardinality tuples over a 60-packet window are unsatisfiable (`varietyContract.ts:12-21`). Piling a 14-day motif ban + 10-day palette + 10-day layout-family as **hard blocks** on top of the 60-packet signature block risks permanent fallback. So the new axes are tiered:
> - **Hard blocks (reject the plan):** identical `compositionSignature` within 60 packets, and any same-day reuse of scene/CTA/prompt-fingerprint — *as today*.
> - **Soft LRU tiebreakers (rank, don't reject):** `coverLayoutFamily`, `cameraTreatment`, `motifTag`, `paletteId` use the existing `lruPicker` to *prefer* the least-recently-used option and avoid same-day repeats, but never hard-jam a build.
> - **Bank minimums** are sized so even the soft tiers rotate cleanly: **≥10 palettes, ≥12 motif tags, ≥8 cover-layout families, ≥7 camera treatments** (each ≥ its window). State these as build acceptance criteria.
> - **Acceptance test:** add a unit test that simulates **60 consecutive synthetic days (360 packets)** and asserts the hard-fallback rate stays under a threshold (e.g. <10%) and no permanent-fallback state. This is the gate that proves §3 actually works before it ships.

### 3a. Fix the root cause: covers must vary their LAYOUT, not just their style
Introduce a first-class **`CoverLayoutFamily`** dimension and let covers use any of it (not always `top-stack`):
- `TOP_STACK` (current — keep, but capped),
- `INTEGRATED_SCENE` (headline is a physical part of the scene — on a newspaper, a phone, a terminal, a stadium board),
- `FULL_BLEED_EDITORIAL` (magazine-cover masthead + coverline typography baked in),
- `SPLIT_EDITORIAL` (image one half, type the other — `EDITORIAL_SPLIT_LAYOUT` already exists, under-used),
- `HERO_NUMBER` (the number fills the frame — `TYPOGRAPHIC_MEGA_NUMBER`),
- `DASHBOARD_FILL` (a data UI fills the canvas, title in the chrome),
- `MOCK_SCREENSHOT` (brokerage/tweet/headline mock — `REDDIT_POST_SCREENSHOT`, `TWEET_STOCK_CHART_SPLIT` exist),
- `DOCUMENT_RECEIPT` (a filing/receipt/scorecard is the hero).

Track `coverLayoutFamily` in history. **Same-day repeat = hard-avoided** (slots already see `todayPriorEntries`); cross-day it's a **soft LRU tiebreaker** (prefer least-recently-used family, target the same family ≤2× per 10 days) so it rotates without jamming the build. Fold `coverLayoutFamily` into the composition signature so the *full* cover composition still can't hard-repeat within 60 packets.

### 3b. Add CAMERA/CROP and MOTIF axes to the variety contract
- **`cameraTreatment`** enum (≥7: `MACRO_CLOSEUP`, `WIDE_ESTABLISHING`, `OVERHEAD_FLATLAY`, `LOW_ANGLE_HERO`, `EYE_LEVEL_EDITORIAL`, `SCREEN_CAPTURE`, `ISOMETRIC_DIAGRAM`, `AERIAL`). Hard-avoid adjacent-slide repeats *within* a carousel (cheap, intra-plan); **soft LRU** for cross-day cover rotation. Directly answers "different crops, camera angles, and compositions."
- **`motifTag`** for every metaphor/scene style (≥12: `MISSILE`, `BULL`, `BEAR`, `VAULT`, `JET`, `YACHT`, `ROLEX`, `PLANT_COINS`, `GLOBE`, `SKYLINE_DESK`, `CHESS`, `ROCKET`, …). Rules: **≤1 metaphor-cliché motif per day** (hard, same-day, cheap) and a **soft 14-day LRU cooldown** per motif (prefer unused motifs, don't hard-jam). Worst-offending clichés are demoted out of default rotation entirely (see 3d) so the cooldown rarely binds.
- **Palette rotation (revive the dead code in `carouselConstraintAgent.ts`):** a curated **palette bank of ≥10** on-brand schemes beyond black+accent (off-white editorial / newsprint, deep forest green, oxblood, midnight navy, warm sand/cream, charcoal+amber, cool slate, high-key light, …). **Soft LRU** cross-day (target ~10-day no-repeat) + hard same-day no-repeat; persist `paletteId`. This breaks the monochrome-feed look while staying premium. Bank size ≥ window guarantees the soft rotation always has a fresh option.

### 3c. Premium style bank (promote what exists, add what's missing)
Promote the already-built-but-`UNTESTED_STYLES` editorial/data styles into normal rotation and add integrated-text cover variants. Target buckets and representative directions:
- **Editorial photography (documentary, not luxury cliché):** real newsroom/trading-floor candor, a single topic-relevant object shot like a still-life, street-level finance (an ATM line, a "SALE" sign for inflation) — *not* Rolex/whiskey/jet.
- **Magazine/editorial typography:** `MAGAZINE_COVER`, `EDITORIAL_SPLIT_LAYOUT`, `GLOWING_QUOTE`, pull-quote spreads.
- **Data dashboards & charts:** `CANDLESTICK_HERO`, `PRICE_TIMELINE_ANNOTATED`, `LINE_CHART`+annotation, `EARNINGS_HEAT_TABLE`, `POSITION_CONCENTRATION_TREEMAP`, `TICKER_TAPE_HERO`, `MAP_DATA_OVERLAY`, a true "Bloomberg dashboard" composite.
- **Mock screenshots:** brokerage order card, X/Tweet + chart, headline card, "your portfolio" UI.
- **Infographic systems:** `MACRO_FLOW_DIAGRAM`, `SANKEY`, `COMPARISON_TABLE`, checklist/scorecard.
- **Cinematic metaphor (rationed, fresher concepts):** keep a *few* but rotate motifs hard and ban the tired ones from default rotation.

### 3d. Demote / retire the worst clichés
Move `MILITARY_AEROSPACE_METAPHOR` (missile), the luxury jet/Rolex/yacht `LUXURY_SCENE_VARIANTS`, and the glowing-globe `PREMIUM_CTA` out of default rotation (like the existing `EXCLUDED_FROM_ROTATION` mechanism) — available only when the topic literally is aerospace/luxury/etc. Rewrite `ANIMAL_METAPHOR`/`VAULT_SECURITY`/`NATURE_METAPHOR` template text toward fresher, less stock-AI executions, or gate them behind the 14-day motif cooldown.

### 3e. Per-carousel cohesion vs distinctiveness
Keep the storyboard `sharedVisualInvariants` (palette/type/watermark/lighting) so a single post is cohesive — but vary **camera, crop, layout archetype, encoding, and subject class slide-to-slide** (the plan already forbids adjacent dominant-subject/bucket repeats; add camera + layout to that). Result: each carousel is internally coherent, and each *day's six* + each *10–15 day window* are visibly distinct.

---

## 4. Improved prompt architecture (premium realism, integrated text)

Preserve the packet structure and exact-text control. Add:

### 4a. Integrated-text mode (the key upgrade)
When `coverLayoutFamily ∈ {INTEGRATED_SCENE, FULL_BLEED_EDITORIAL, MOCK_SCREENSHOT, DOCUMENT_RECEIPT}`, `compilePromptString` must describe the headline as a **physical element inside the scene** (printed on the magazine, lit on the terminal, set as the newspaper headline, shown on the phone) instead of a floating overlay block. Add an `INTEGRATED TEXT` section variant; suppress the generic positioned overlay for those families. This is what makes posts read as designed editorial rather than "caption pasted on a stock photo."

### 4b. Two-chance hook (apply the 2026 algorithm fact)
IG re-serves slide 2 if a viewer doesn't swipe. So the plan should treat **slide 2 as a secondary hook** (a surprising number, a sharp contrast, a "wait, what?" visual) — not a low-energy "context" slide. Encode a `secondaryHook` beat for slide 2 in `deriveBeats`/storyboard and make its visual a strong standalone.

### 4c. Stronger hierarchy & legibility rules
- Explicit type scale (hero : sub : eyebrow ≈ 100 : 34 : 14), 7:1 contrast (already), and an **IG safe-zone** note (keep critical text out of the bottom ~220px where the UI sits and away from the top-right).
- "Thumbnail test": slide 1 must still read at 1:1 feed-thumbnail size.
- Per-encoding spec blocks: split `FINANCIAL_TEXT_RENDERING` into `candlestick`, `line+annotation`, `dashboard`, `brokerage-mock`, `table/heatmap`, `infographic` variants chosen by `primaryEncoding`, so the model gets a precise, type-appropriate spec.

### 4d. Stronger anti-AI-tells negative prompt
Extend `PREMIUM_POLISH_KIT`'s negative list with the named clichés + realism guards: no glowing holographic globe; no floating armored bull / missile-as-metaphor unless the topic is literally aerospace; no Rolex/whiskey/superyacht unless the topic is luxury goods; correct finger/hand counts; physically correct reflections & shadows; no plastic skin; no duplicated UI chrome or repeated logos; no gibberish micro-text; consistent single light source.

### 4e. Keep (unchanged)
Labeled packet, MUST KEEP / CHANGE ONLY storyboard continuity, exact-text spelling control, palette anchoring, evidence-gate illustrative suppression, watermark line, Midjourney/SD flag bans, zero-limits assumption, premium camera/material vocabulary.

---

## 5. CTA redesign

### 5a. Replace the luxury-cliché CTA visual pool
Swap `CTA_STYLE_POOL` for CTA visual concepts that **resolve the post's own slide-1 motif** (the storyboard already wants this) and lean into 2026 save/send behavior:
- `MOTIF_CALLBACK` — slide-1 visual returns with the answer revealed/resolved.
- `SAVE_CARD` — a phone mock showing the post being saved / a "save this" index card.
- `SEND_TO_FRIEND` — a DM/share card ("send this to the friend who…") — leans into "sends," IG's strongest 2026 signal.
- `CHECKLIST_RECEIPT` — the takeaways as a clean receipt/scorecard.
- `SCOREBOARD_RECAP` — a 1-slide recap of the carousel's numbers.
- `EDITORIAL_SIGNOFF` — a single restrained typographic poster (no globe, no desk).
- `TWO_OPTION_PROMPT` — "which side are you?" comment driver.

### 5b. Region-aware, fresh CTA copy
De-hardcode the Canadian CTA pattern; make follow/CTA copy topic- and region-aware ("Follow for daily US + Canadian market breakdowns — no hype, no advice"). Keep the existing `ctaLibrary` text strategies (save_specific, share_use_case, etc.) — the gap is the *visual* and the copy region.

### 5c. CTA anti-repetition
Persist `ctaVisualConcept` + `ctaCopyVariant`; block repeats within 10 days and never same-day (extend the existing `ctaConceptId` same-day rule to a cross-day window). Add a `cta-feedback.json`-driven LRU so your manual ratings steer which CTA concepts recur.

---

## 6. Quality control (deterministic gate before Telegram)

Add a consolidated `qcGateAgent.ts` (or extend the existing compliance/evidence gates) that runs **after** prompt compilation and **before** delivery, attaching a compact PASS/WARN report to the Telegram intro:

| Check | Rule |
| --- | --- |
| Factuality / verification | Every TIMELY topic carries ≥1 source URL + `sourceTier`; `VERIFIED` required for record-high/anomaly wording; RUMOR ⇒ labeled or dropped |
| **[QA] Fresh-signal health** | WARN if the run produced **zero live timely signals** (all feeds throttled/dead) so silent degradation to all-evergreen is visible |
| **[QA] Daily timely count** | Report the running count of timely posts today (from `content-history.json`); WARN if the day is trending below 4-of-6 |
| **[QA] Crypto/IPO compliance** | Extend `complianceQAAgent` patterns to block IPO-participation ("should you get in on the IPO") and crypto-speculation ("next 100x", token-pump) phrasing — new failure shapes the current regex doesn't catch |
| Topic freshness | Timely-first slots have a <48h signal or get a `STALE_SIGNAL` warning |
| Visual repetition | Re-run variety contract + new layout/camera/motif/palette checks; collision ⇒ retry, else WARN |
| Text completeness | No unresolved `[brackets]` in any compiled prompt (lint the final string); every slide has exact-text + watermark + negative-constraints + layout directive |
| Legibility | Headline ≤ word cap; safe-zone + contrast clauses present; slide-1 thumbnail clause present |
| Premium realism | Camera + named-materials + extended negative list present; ≤1 cliché motif/day; demoted motifs absent unless topic-justified |
| IG engagement | Slide 1 AND slide 2 are hooks; CTA present and non-cliché; 7–10 slides; 1080×1350 |
| Telegram delivery | Document not truncated; all N slide prompts present (already retried 4×) |
| Zero-cost | New sources asserted keyless/free; `CostGuardAgent` still passes; no paid flags set |

The report is informational + sets WARN flags (it shouldn't hard-block delivery except on compliance/zero-cost failures, so you still receive the packet and can decide).

---

## 7. Execution architecture (zero-cost, computer-off)

### 7a. Already solved: runs with your computer off
The pipeline already runs entirely on **GitHub Actions** (`.github/workflows/daily-post.yml`, 10 cron lines → 6 firing slots/day via the DST resolver). Nothing about "computer off" needs to change. Telegram delivery already works (intro message + `.txt` document, 4× retry).

### 7b. Private-repo zero-cost (the one real cost watch-item)
Private repos consume the **2,000 free Actions-minutes/month**. **[QA] Current state is worse than the first draft implied:** in `daily-post.yml` the `actions/checkout@v4` step with `fetch-depth: 0` (full-history clone) runs **before** the slot resolver, so *all 10* daily jobs pay the full-clone cost — including the 4 that then immediately skip. Rough usage ≈ 900–1,300 min/month — under budget today but the waste is real and grows as history grows. Trim (an explicit task, not a "nice-to-have"):
- **Move the "should this slot run?" resolver into a separate pre-`checkout` step/job** (it's pure Node on the cron string + DST; it needs no repo files), so the 4 non-firing crons exit in ~5–10s with no clone.
- Use shallow `fetch-depth: 1` for the firing jobs (history is read from the committed file, not git log).
- Keep `concurrency: { group: daily-post, cancel-in-progress: false }` (prevents history-push races — don't remove).
- Re-verify the monthly-minute estimate after adding the new collectors (which add seconds, not minutes).

### 7c. Secrets / credentials / MCP — what's needed
- **No new required secrets.** RSS, SEC EDGAR, and CoinGecko public all work keyless. Existing secrets (`GEMINI_API_KEY`, `TELEGRAM_*`, optional `REDDIT_*`, `GMAIL_*`) are unchanged.
- **Optional (free) niceties — only if you want them:** a free CoinGecko **Demo API key** (raises crypto rate limit to 100/min, 10k/mo) if the keyless 5–15/min ever throttles; that's the only credential I'd even consider, and it's free. I do **not** need any paid API, MCP server, or new repo access to build this.

### 7d. Risks / limits / tradeoffs
- **Yahoo unofficial endpoints** can throttle/403 from GitHub IPs. Mitigation: the new RSS + CoinGecko sources are independent fallbacks, and every collector already fails soft.
- **RSS feed URLs occasionally change** → ingest 5–6 feeds with redundancy so one dead feed is a non-event.
- **SEC fair-access** requires a descriptive User-Agent and ≤10 req/s (easily met).
- **Gemini free-tier limits** unchanged; new collectors are deterministic HTTP, not extra LLM calls (except an optional small "24h digest summarize" call, which stays on the stable free model the CostGuard allows).
- **More variety dimensions ⇒ more variety pressure.** Mitigated by the existing retry-with-growing-exclusions loop + the palette/motif banks being large enough; the QC report surfaces pressure rather than silently degrading.

---

## 8. Extra recommendations

- **Prompt quality score:** deterministic per-slide score (camera + materials + exact-text + negative list + integrated-text + legibility clauses present) logged to history; track the rolling average so quality regressions are visible.
- **Daily content-calendar memory:** persist `topicFamily`, `topicMode`, `region`, `paletteId`, `coverLayoutFamily`, `cameraTreatment`, `motifTag` in history; surface a 14-day "what ran" digest to the strategist and in the Telegram intro.
- **Trend archive / dedup log:** persist each day's ranked raw signals + their `sourceTier`/URLs (extend the existing `RESEARCH_BRIEF.md` artifact into a rolling `trend-archive.json`) so the same catalyst isn't re-posted and you can audit "why this topic." **[QA] This is the same store as the §2b source-tier persistence — build one, not two.**
- **A/B hook testing:** generate 2 cover-hook variants per post; you tap a 👍 in Telegram (or rate in a `hook-feedback.json` like `cta-feedback.json`); an LRU/score nudges future hooks.
- **Engagement-prediction badge:** show the `topicEngagementScore` + a simple "predicted save/share strength" in the Telegram intro so you can prioritize which of the 6 to actually post first. **[QA] Label it explicitly as a heuristic estimate** (not measured performance) so it isn't misread.
- **Schema migration:** the new history fields are **schema v4** — follow the existing non-destructive `migrateToCurrent` pattern (never invent missing grammar; guards fall back to legacy fields). Update `varietyContract.ts` + `contentHistory.ts` together with tests.
- **Seed the viral-examples library:** `viral-examples.json` / `viral-screenshots/` are empty but `ContentStrategyAgent` already reads them as "reference patterns — extract structure, don't copy." Dropping in 10–20 screenshots of posts you admire would immediately sharpen hooks/layouts.
- **Docs hygiene — do this in Phase 0, not Phase 3 [QA]:** the root `AGENTS.md` (untracked) is stale (describes the old 5-slot / schema-v2 / Seedance design) and will actively mislead Claude Code during the build. Update or delete it up front; keep `CLAUDE.md` (current) as the source of truth.
- **Manual reactive lever:** add `FORCE_TOPIC` (and reuse `FORCE_ANGLE` / a new `FORCE_STYLE`) `workflow_dispatch` inputs so you can fire a same-day reactive post on a big market event.

---

## Phasing (actionable build order for Claude Code)

- **Phase 0 — Policy/config (low risk, fast wins):** US-weight the topic framing + remove the Canada score bonus; add slot `topicMode` policy; swap the CTA visual pool + de-hardcode CTA copy; demote the missile/jet/globe clichés; extend the negative-prompt cliché list; revive palette rotation with the palette bank; title-level record-high guard; **sync/delete the stale `AGENTS.md`**. *(Mostly edits to `trendResearchAgent.ts`, `slotConfig.ts`, `visualPlanAgent.ts` pools, `imagePromptAgent.ts` negative kit, `carouselConstraintAgent.ts` palette, `contentStrategyAgent.ts` copy.)*
- **Phase 1 — Hot-topic engine:** `newsRssAgent.ts` (incl. Google News RSS + 5–6 redundant feeds), `cryptoHeatAgent.ts`, `ipoFilingsAgent.ts`; expand indices; `inferTopicFamily` classifier; source-tier/corroboration + rumor flags + sourceTier persistence in `researchEvidenceGate.ts`; `topicEngagementScore` + concept-family cooldown; new angles; **extend `complianceQAAgent` for crypto/IPO phrasing in this same phase**. Tests per new agent + a compliance test.
- **Phase 2 — Visual variety:** `CoverLayoutFamily` + `cameraTreatment` + `motifTag` + `paletteId` in `visualPlanAgent.ts`, tiered as **soft LRU** (hard blocks reserved for composition signature + same-day reuse); integrated-text mode in `imagePromptAgent.ts`; secondary-hook beat; history schema **v4** (non-destructive migration) + `varietyContract.ts` extensions; CTA visual concepts. **Ship the 60-day (360-packet) satisfiability test that asserts fallback rate stays under threshold** before merging.
- **Phase 3 — QC + extras:** `qcGateAgent.ts` + Telegram QC/engagement report (incl. fresh-signal health + daily-timely-count WARNs); prompt quality score; A/B hooks; merged source-tier/trend archive; **Actions-minutes trim (resolver before checkout + `fetch-depth: 1`)**. Update `CLAUDE.md`.

Each phase is independently shippable and reversible, keeps `ZERO_COST_MODE=true`, runs on Actions (computer-off), preserves the strong existing packet/storyboard architecture, and lands with tests in the repo's `npx tsx --test __tests__/*.test.ts` convention.

---

## Sources
- CoinGecko free API / Demo plan & keyless public API — https://www.coingecko.com/en/api/pricing , https://www.coingecko.com/learn/best-free-crypto-api
- SEC EDGAR free, no-key API + full-text search (10 req/s) — https://tldrfiling.com/blog/free-sec-edgar-api-guide/ , https://sec-api.io/docs/full-text-search-api
- Free finance RSS (CNBC/MarketWatch/Yahoo/Nasdaq/Reuters) — https://www.cnbc.com/rss-feeds/ , https://rss.feedspot.com/financial_news_rss_feeds/
- 2026 IG carousel best practices (saves/sends > likes, second-chance slide 2, 8–10 slides, 1080×1350) — https://www.truefuturemedia.com/articles/instagram-carousel-strategy-2026 , https://marketingagent.blog/2026/01/03/mastering-instagram-carousel-strategy-in-2026-the-algorithm-demands-swipes-not-just-scrolls/
