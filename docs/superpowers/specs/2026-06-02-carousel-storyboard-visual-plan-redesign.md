# Carousel Storyboard And Visual Plan Redesign

**Date:** 2026-06-02
**Status:** Approved direction, pending written-spec review
**Scope:** `platform/`

---

## Goal

Deliver six zero-incremental-cost Telegram prompt packets per day. Each packet must:

- tell one understandable visual story from cover to CTA;
- produce highly detailed prompts for ChatGPT Images 2.0 as the primary manual rendering target;
- support text-heavy graphics, infographics, candlesticks, editorial graphics, social-post mockups, and premium photography when the topic warrants them;
- avoid repeating the same visual composition grammar for roughly ten days;
- preserve a strict `$0` API-spend boundary;
- stop unsupported factual claims from becoming polished finance graphics.

The pipeline continues to generate prompts and copy only. It does not call paid image APIs, publish to Instagram, or render Instagram images automatically.

## Confirmed Current Problems

1. `ImagePromptAgent.pickSceneVariant()` hashes only date and slide number. Same-day slots can receive the same CTA scene. Existing artifacts show three May 30 packets ending with the same Gulfstream-plus-Rolex image.
2. `SlideNarrativeAgent` still chooses slide styles and positions even though `CarouselConstraintAgent` claims to constrain them. Most declared constraints are not validated.
3. Angle candidates are inserted with `unshift()`, reversing ranking. After HistoryGuard pivots a topic, later agents still use the original first angle ID. Topic, visualization, and slide skeleton can diverge.
4. `TopicAngle.slideSkeleton` exists in `data/topicAngles.json` but is discarded before strategy generation.
5. History stores carousel summaries, not full slide-level visual grammar. It cannot prevent a familiar composition from returning under a different style label.
6. Prompt packets are compiled slide by slide without a shared premise, recurring motif, or progression beat. A visually attractive second image may not explain or advance the first.
7. The repo pins `gemini-flash-latest`. Google documents that `latest` aliases can hot-swap to stable, preview, or experimental variants. That is too loose for a strict `$0` workflow.
8. `imagePromptAgent.test.ts` imports `isTickerActive` from `run-daily.ts`, whose top-level `main()` executes on import. A test run can accidentally launch a live pipeline.
9. Telegram still renders `Post x/5` even though the checked-in schedule has six daily slots.
10. Research topics carry loose URLs but not claim-level evidence. A Yahoo five-year high is named `allTimeHigh`, raw closes can be corporate-action-sensitive, and secondary news can become overly precise graphics.

## Design Principles

- Keep the brand recognizable while rotating the visual argument.
- Select and lock visual grammar before narrative copy is written.
- Prefer deterministic policy stages over extra LLM calls. Better decisions should not consume more Gemini quota than necessary.
- Treat ChatGPT Images 2.0 as capable of sophisticated graphics. Do not artificially simplify prompts.
- Separate semantic correctness from visual polish. A rich prompt is allowed only when its factual inputs are supportable.
- Fail closed on any API path that could introduce incremental cost.

## Pipeline

```text
CostGuardAgent
  -> SlotContextAgent
  -> TrendResearchAgent + TickersInNewsAgent
  -> TopicAngleAgent
  -> HistoryGuardAgent
  -> SelectedTopicDecision
  -> ContentStrategyAgent
  -> FormatStyleAgent
  -> FinancialVizPicker
  -> CarouselConstraintAgent
  -> VisualPlanAgent
  -> SlideNarrativeAgent
  -> ResearchEvidenceGate
  -> ComplianceQAAgent
  -> ImagePromptAgent
  -> CopywritingAgent
  -> ComplianceQAAgent
  -> TelegramDelivery
  -> content history v3
```

`VisualPlanAgent` is the only new pipeline agent. It is deterministic and side-effect-free. `ResearchEvidenceGate` is a deterministic utility, not an LLM agent. Storyboard continuity is a nested contract inside the visual plan, not another Gemini call.

## Selected Topic Decision

Use one selected angle object end to end:

```ts
interface SelectedTopicDecision {
  topic: TrendTopic;
  angleId?: AngleId;
  angleSlideSkeleton?: string[];
  sourceUrls: string[];
  reviewFlags: ResearchReviewFlag[];
}
```

`TopicAngleAgent` retains `slideSkeleton` in each candidate. `run-daily.ts` associates injected angle metadata with the exact topic candidate. When HistoryGuard pivots, the surviving candidate's angle ID, skeleton, and sources survive with it. `ContentStrategyAgent` receives that selected object and preserves the skeleton's ordering in `slideBreakdown`.

This fixes topic-selection quality without adding another paid or quota-consuming decision agent.

## Visual Plan

Add `src/lib/agents/visualPlanAgent.ts`.

```ts
type StructureFamily =
  | 'NEWS_FLASH'
  | 'DATA_SNAPSHOT'
  | 'COMPARISON_XRAY'
  | 'CANDLESTICK_STORY'
  | 'RECEIPT_DROP'
  | 'EDITORIAL_MYTH_BUST'
  | 'HUMAN_EDITORIAL'
  | 'PREMIUM_LIFESTYLE';

type CoverMechanism =
  | 'HERO_NUMBER'
  | 'HEADLINE_OBJECT'
  | 'ANNOTATED_CHART'
  | 'DOCUMENT_RECEIPT'
  | 'EDITORIAL_PORTRAIT'
  | 'SPLIT_CONTRAST'
  | 'TYPOGRAPHIC_POSTER'
  | 'CINEMATIC_SCENE';

interface StoryboardContinuity {
  premise: string;
  anchorPrompt: string;
  sharedVisualInvariants: string[];
  progressionRule: string;
  resolutionRule: string;
  varietyRule: string;
}

interface SlideVisualGrammar {
  slideNumber: number;
  intendedRole: SlideRole;
  structureFamily: StructureFamily;
  coverMechanism?: CoverMechanism;
  layoutArchetype: string;
  primaryEncoding: string;
  visualStyle: ViralStyle;
  bucket: Bucket;
  visualPosition: VisualPosition;
  dominantSubjectClass: DominantSubjectClass;
  sceneConceptId: string;
  ctaConceptId?: string;
}

interface VisualPlan {
  slides: SlideVisualGrammar[];
  storyboard: StoryboardContinuity;
  narrativeArc: NarrativeArc;
  portraitSelection?: PortraitSelection;
  payoffSlideIndex?: number;
  compositionSignature: string;
}
```

`CarouselConstraintAgent` remains the policy builder. `VisualPlanAgent` converts policy into a complete slide-by-slide plan and validates it before narrative generation.

## Storyboard Continuity

Every carousel has one clear premise and one visual through-line.

- Slide 1 establishes the premise and creates the anchor image.
- Each middle slide advances one distinct state, evidence point, consequence, or decision branch.
- The CTA resolves the original motif instead of switching to a generic luxury scene.
- Every prompt repeats shared invariants after scene selection, including literal-template fallbacks.
- Per-slide composition may change: camera angle, crop, chart type, layout, and subject placement should vary while the motif, palette logic, and brand treatment remain coherent.

Extend `SlideSpec`:

```ts
interface SlideSpec {
  // existing fields
  storyboardBeat: string;
}
```

`SlideNarrativeAgent` fills copy into the locked visual plan. It does not choose styles or positions.

## Ten-Day Variety Contract

At six packets per day, the trailing ten-day window is 60 packets. A typical seven-slide day can produce roughly 420 slide prompts, so a flat list of style IDs is insufficient.

Hard-block:

- identical `compositionSignature` within the trailing 60 packets;
- same-day `sceneConceptId`, `ctaConceptId`, or prompt fingerprint reuse;
- identical distinctive premium-photo scenes within the trailing 60 packets;
- identical cover mechanism plus layout archetype plus dominant subject class within the trailing 60 packets;
- repeated portrait subjects inside the existing portrait cooldown;
- adjacent slides with the same bucket or dominant subject class unless a semantic override is logged.

Soft-cap:

- broad structure families, because news and education lanes must remain available;
- semantically valid chart types, because correctness comes before novelty;
- palette families, while allowing stable brand colors;
- candlestick stories, which should appear only when price action is central.

Fallbacks are bucket-aware and least-recently-used. If the plan library is stressed, Telegram receives a visible warning. The system must never silently fall back to a generic Gulfstream, neon chart wall, or silver-haired portfolio manager.

## Prompt Packet For ChatGPT Images 2.0

ChatGPT Images 2.0 is the primary manual target. The output packet must instruct the user to create the carousel in one ChatGPT conversation:

1. Paste the packet-level anchor prompt.
2. Generate slide 1 first.
3. Keep working in the same conversation.
4. For slides 2 through N, paste the per-slide prompt and use the prior image as the reference when useful.
5. Preserve the `MUST KEEP` list and change only the requested slide content.

Each prompt uses labeled sections:

```text
DELIVERABLE
STORYBOARD CONTINUITY
MUST KEEP
CHANGE ONLY
PURPOSE
INFORMATION ARCHITECTURE
SUBJECT AND SCENE
COMPOSITION
EXACT TEXT
DATA GRAPHIC SPECIFICATION
STYLE AND MATERIALS
NEGATIVE CONSTRAINTS
```

Prompts remain rich and explicit. Camera vocabulary is used only when it controls the requested look. It is not copied into every slide as decorative boilerplate.

The final prompt packet names:

- `Primary: ChatGPT Images 2.0`
- `Alternate: Seedream` for cinematic image-first scenes
- `Canva overlay recommended` when mission-critical chart labels or dense exact text require manual verification

The current `Seedance` image-route label is corrected to `Seedream`. No Seedream API integration is added.

## Zero-Cost Boundary

No OpenAI API key is required or used. The workflow generates text prompts for manual use with the user's existing ChatGPT subscription.

Pin Gemini text generation to:

```text
GEMINI_TEXT_MODEL=gemini-3.5-flash
```

`CostGuardAgent` fails closed in `ZERO_COST_MODE=true` unless:

- the Gemini text model is in an explicit stable free-tier allowlist;
- no `latest`, preview, experimental, image, audio, Live API, grounding, batch, or caching path is enabled;
- paid OpenAI image generation remains disabled;
- Gemini image generation remains disabled;
- paid video generation remains disabled;
- Cloudflare paid overage remains disabled.

Code cannot prove a Google project is unbilled. The operational hard stop is a dedicated Gemini API project with billing disabled or unlinked. The scheduled workflow must use only that project's API key. Quota exhaustion stops the run; it must not switch to a paid provider.

No additional API key is required for this implementation. Google recommends the maintained `@google/genai` SDK instead of the repo's deprecated `@google/generative-ai` package. Migrate that dependency in a separate reviewed change after the storyboard redesign unless the pinned stable model proves incompatible with the existing client.

## Research Evidence Gate

This implementation adds a focused evidence gate, not a complete source-ingestion rewrite.

```ts
type ResearchReviewFlag =
  | 'MANUAL_REVIEW_REQUIRED'
  | 'SECONDARY_ONLY_NEWS'
  | 'POLITICIAN_DISCLOSURE'
  | 'RECORD_HIGH_CLAIM'
  | 'CORPORATE_ACTION_SENSITIVE_RETURN'
  | 'ANOMALY_MOVE'
  | 'MISSING_EVIDENCE_ID';

interface ResearchEvidenceRef {
  evidenceId: string;
  sourceUrl: string;
  sourceTier: 'official' | 'primary' | 'secondary';
  fetchedAt: string;
  publishedAt?: string;
  asOf?: string;
  claimType: string;
  value?: number;
  unit?: string;
  period?: string;
  reviewFlags: ResearchReviewFlag[];
}
```

Phase-one behavior:

- Rename Yahoo's five-year index high fields so they cannot be described as all-time highs.
- Carry evidence refs and review flags through selected topics and strategy decisions when known.
- Require manual-review flags for politician disclosures, record-high claims, corporate-action-sensitive returns, anomaly moves, and secondary-only news.
- Suppress unsupported exact figures from image prompts. Use `illustrative` language when a factual number is not evidence-backed.
- Include a visible review block in Telegram when human verification is required.

Official-source ingestion for SEC EDGAR, Bank of Canada Valet, Statistics Canada WDS, Federal Reserve calendars, House disclosures, Senate disclosures, and other evidence-backed lanes should be designed as a follow-up spec.

## History Schema V3

Persist the selected visual plan:

```ts
interface PersistedVisualPlan {
  compositionSignature: string;
  structureFamily: StructureFamily;
  coverMechanism?: CoverMechanism;
  sceneConceptIds: string[];
  ctaConceptId?: string;
  slides: Array<{
    slideNumber: number;
    layoutArchetype: string;
    primaryEncoding: string;
    visualStyle: string;
    bucket: Bucket;
    visualPosition: VisualPosition;
    dominantSubjectClass: DominantSubjectClass;
    sceneConceptId: string;
    promptFingerprint?: string;
  }>;
}
```

Preserve existing summary fields for compatibility. V2 entries migrate to V3 without inventing missing grammar. History guards use V3 plans when present and gracefully fall back to legacy cover fields.

## Safety Refactor

Before any broad test run:

- move `isTickerActive()` from `run-daily.ts` into a side-effect-free utility;
- stop tests from importing the live entrypoint;
- make the live entrypoint explicit so module imports cannot execute Telegram delivery or history writes;
- extract Telegram packet formatting into a pure function.

## Telegram Packet

Telegram sends:

- correct `Post x/6` slot label;
- primary rendering route;
- packet-level anchor workflow;
- composition signature and storyboard premise;
- per-slide role, style, bucket, dominant subject, layout, storyboard beat, and prompt;
- review flags and evidence refs when applicable;
- Canva fallback data for dense factual graphics;
- a warning when variety fallback pressure is elevated.

## Error Handling

- Gemini quota exhaustion: stop the run with a clear zero-cost error. Do not switch providers.
- Invalid visual plan: retry deterministic selection with the next least-recently-used valid grammar. If exhausted, emit a visible warning and select the lowest-risk valid fallback.
- Narrative drift: reject narrative output that changes locked styles, positions, roles, or storyboard beats; retry once, then use deterministic copy fallback.
- Unsupported exact claim: suppress the number from the image prompt and add a manual-review warning.
- Telegram formatting: format locally first, then send with the existing retry policy.

## Verification

Add or update tests for:

- entrypoint import safety and side-effect-free ticker matching;
- six-slot history deduplication and Telegram labels;
- stable free-tier Gemini model allowlisting and zero-cost fail-closed behavior;
- selected angle object preservation after HistoryGuard pivots;
- complete visual-plan generation;
- ten-day signature blocking and same-day scene uniqueness;
- CTA scene variety;
- bucket adjacency, human caps, chart requirements, payoff placement, and dominant-subject alternation;
- storyboard premise, anchor prompt, progression beats, and CTA resolution;
- narrative preservation of locked grammar;
- ChatGPT Images 2.0 anchor workflow and `MUST KEEP` blocks;
- history V2-to-V3 migration and V3 round-trip persistence;
- review-flag propagation and suppression of unsupported exact claims;
- Telegram pure formatter output.

Run isolated tests first. Run the full suite only after the import hazard is removed. Report existing lint or typecheck failures separately if they remain unrelated.

## Documentation Updates

Update tracked docs after implementation:

- `CLAUDE.md`
- `platform/README.md`
- `platform/env.example`

The untracked root `AGENTS.md` is user-authored and must remain untouched.

## Source Notes

Current official guidance used for this design:

- OpenAI: [ChatGPT Images 2.0 release](https://openai.com/index/introducing-chatgpt-images-2-0/), [`gpt-image-2` model page](https://developers.openai.com/api/docs/models/gpt-image-2), [image generation guide](https://developers.openai.com/api/docs/guides/image-generation), [`gpt-image-2` prompting guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide)
- Google: [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [models](https://ai.google.dev/gemini-api/docs/models), [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits), [billing](https://ai.google.dev/gemini-api/docs/billing), [libraries](https://ai.google.dev/gemini-api/docs/libraries)
- Public design research: [Visual Capitalist playbook](https://elements.visualcapitalist.com/wp-content/uploads/2025/10/vc-playbook.pdf), [Voronoi story-first guidance](https://about.voronoiapp.com/2025/05/26/start-with-the-story-not-the-chart/), [Voronoi visual-hook guidance](https://about.voronoiapp.com/2025/06/09/stop-the-scroll-with-a-powerful-visual-hook/)
