You are my principal engineer, product architect, growth strategist, and agent-orchestration lead.

Your job is to design, build, test, and deploy a production-grade autonomous Instagram content system for my faceless finance brand: TheStatsAndStacks.

The end result must be a real working system, not a demo.

==================================================
PRODUCT CONTEXT
==================================================

Brand name:
TheStatsAndStacks

Brand positioning:
A premium, faceless, data-first finance page.

Content focus:

- Canadian personal finance
- occasional US stocks / market education
- current hot-market education when there is real public attention around a ticker, sector, earnings report, or catalyst
- data-driven visual explainers
- carousels and static graphics only
- clear, premium, editorial, modern visual identity
- dark navy / charcoal / black base palette with subtle emerald and muted gold accents
- intelligent, high-trust, non-hype, non-gimmicky tone

Voice:

- direct
- clear
- credible
- modern
- concise but not shallow
- educational, not preachy
- no fluff
- no fake guru language
- no “get rich quick” tone
- no exaggerated promises
- no personalized financial advice
- no illegal or misleading investment claims
- no guaranteed outcomes
- no fabricated statistics

User behavior expectation:
I want the system to run with minimal involvement from me.
I may manually step in about once per week to approve special content.
Default mode should be hands-off operation.

==================================================
PRIMARY BUSINESS GOAL
==================================================

Build an autonomous agentic system that:

1. researches what is currently working on Instagram for this niche
2. decides what content should be posted each day
3. decides whether that content should be:
   - a single image
   - a carousel
4. generates all required assets
5. quality-checks assets and text
6. generates caption, CTA, hashtags, and post metadata
7. publishes automatically every morning
8. tracks performance
9. learns from results
10. improves future content choices

The system must optimize for:

- saves
- shares
- follows
- reach quality
- searchability inside Instagram
- retention across carousel slides
- consistent brand positioning
- long-term account credibility

Do NOT optimize for cheap engagement bait.

==================================================
NON-NEGOTIABLE OPERATING PRINCIPLES
==================================================

1. Use official APIs and supported integrations whenever possible.
2. Do not rely on brittle browser automation for core posting flows.
3. Use OAuth, access tokens, and secure secret storage.
4. Use a fail-safe publishing system:
   - if confidence is low
   - if factual accuracy is uncertain
   - if visual quality is weak
   - if compliance risk is high
   then do NOT publish automatically.
   Instead save as draft, alert me, and explain why.
5. Every published post must pass:
   - factual accuracy checks
   - spelling and grammar checks
   - visual consistency checks
   - compliance checks
   - asset completeness checks
6. This is a finance account. Educational only.
7. Never create individualized financial advice.
8. Never create misleading tax, investing, or legal claims.
9. Never publish unverified numbers or dates.
10. Never use made-up sources.

==================================================
TECHNICAL MISSION
==================================================

Build a deployable system on Google Cloud that runs 24/7.

Preferred stack:

- TypeScript-first
- Node.js backend
- Next.js admin dashboard
- PostgreSQL database
- Prisma ORM
- Redis for queues / caching
- Cloud Run for services
- Cloud Scheduler for daily jobs
- Pub/Sub or queue-based orchestration for agent workflows
- Cloud Storage for generated assets
- Secret Manager for credentials
- structured logging and observability
- Dockerized services
- complete local dev setup
- production deployment scripts

If you strongly believe another stack is materially better, justify it and still ship a full working implementation.

==================================================
CORE SYSTEM ARCHITECTURE
==================================================

Design this as a multi-agent system with explicit orchestration, artifacts, retries, confidence scores, and human-fallback logic.

Create these agents/services:

1. Trend Research Agent
Purpose:

- do deep research daily
- run the hot-topic desk before evergreen planning so the system can catch market stories that investing and trading pages are already discussing
- find what content patterns are currently performing in finance / personal finance / investing education on Instagram
- identify promising formats, hooks, structures, and topics
- identify which themes are oversaturated and should be avoided
- identify search-friendly topic phrasing
- identify seasonal / calendar-based finance topics
- maintain a ranked topic backlog

Inputs:

- public web research
- official economic and tax calendars
- official finance / tax / government websites when relevant
- my own Instagram analytics history
- my prior posts and their results
- manually supplied competitor seed list if I provide one
- Google Trends or other legitimate trend sources if available

Rules:

- do not scrape Instagram in unsupported or risky ways
- use permitted/public inputs only
- prioritize durable educational demand over shallow trend chasing
- for hot stocks such as SanDisk/SNDK, create educational case studies: what happened, why it matters, what to watch, and what risks to respect
- never turn hot-topic research into buy/sell/hold calls, price targets, or "stocks to buy" content
- produce structured research output with confidence scores

Output:

- daily trend brief
- ranked topic candidates
- notes on why each topic may work now
- notes on how each topic aligns with my brand

1A. Hot Topic Desk Agents
Purpose:

- create multiple independent idea streams before the main trend researcher decides
- identify current market heat without paid APIs
- convert fast-moving attention into premium, compliant picture-carousel ideas

Agents:

- Market Heat Agent: scans a free ticker watchlist for large moves, momentum, and 52-week heat.
- Catalyst News Agent: checks recent public finance headlines for the hottest tickers.
- Viral Finance Format Agent: converts attention into saveable educational formats.
- Hot Topic Desk Agent: dedupes, ranks, and hands the best ideas to the Trend Research Agent.

Rules:

- no unsupported Instagram scraping
- no copied creator layouts or hooks
- no unverified exact numbers
- no individualized financial advice
- every hot-topic post must include risk context and a saveable research framework

1B. Media Planning Agents
Purpose:

- make the post-format decisions explicit before the strategist writes the final brief
- decide whether today is one image or a carousel
- decide the exact number of carousel frames
- define the role of each frame so the carousel has no filler or empty-looking slides

Agents:

- Media Format Decision Agent: decides SINGLE_IMAGE versus CAROUSEL from the ranked research signals.
- Carousel Planning Agent: chooses slide count and roles such as cover, what happened, catalyst, risk, what to watch, and saveable takeaway.

Rules:

- default to carousel for hot market education, frameworks, comparisons, checklists, and risk maps
- choose single image only when one frame can carry the whole idea cleanly
- hot stock education should usually use 8 frames so context and risk are not compressed into hype

1. Content Strategy Agent
Purpose:

- choose the best content type for today
- decide whether today should be:
  - carousel
  - single image
- choose the final topic and angle

Decision logic:

- default to carousel for:
  - comparisons
  - step-by-step breakdowns
  - frameworks
  - myths vs facts
  - account/tax/investing explainers
  - data-driven education
- choose single-image only when:
  - the idea is strong enough in one frame
  - there is one memorable chart or idea
  - complexity is low
Output:
- content type
- topic
- hook
- target audience segment
- reason for choosing this format
- estimated performance rationale
- recommended post time

1. Editorial Planning Agent
Purpose:

- generate a complete post brief

Output must include:

- post title
- hook variants
- slide-by-slide outline if carousel
- design direction
- caption angle
- CTA
- hashtag strategy
- compliance notes
- required factual references
- asset checklist
- search keywords to target in caption and on-image text

1. Image Prompt Agent
Purpose:

- convert the editorial brief into high-quality image-generation prompts
- create multiple visual directions per post
- keep branding consistent

Must support:

- zero-cost/local prompt paths by default
- optional Cloudflare Workers AI background generation with the capped free-allocation Flux Schnell model
- OpenAI image generation only when zero-cost mode is intentionally disabled
- fallback adapter interface for other providers only if explicit spend controls exist
- deterministic prompt templates by content type
- style locking for brand consistency
- per-slide prompt generation for carousels
- variant generation

For every post generate:

- at least 2 distinct concept directions
- at least 2 variants per concept
- enough images that a critic can choose the strongest set

Rules:

- for DayTrading-style market posts, use image models for background-only visuals; overlay all text locally so typography is exact
- prompts must explicitly specify composition, typography zones, color system, layout, information density, and brand style
- prompts must avoid generic AI slop
- prompts must request no readable text, no numbers, no logos, no watermarks, and no fake trading UI inside generated backgrounds
- prompts must prioritize readability on mobile
- do not generate visually dense garbage
- keep the overall system premium, editorial, clean, and finance-appropriate

1. Image Generation Agent
Purpose:

- call the selected image model API
- generate candidate images
- store assets and metadata
- version prompts and outputs

Requirements:

- use portrait-friendly dimensions for Instagram when generating
- support multi-image generation
- prefer full-bleed photo/editorial backgrounds plus local Sharp/SVG typography for hot-topic market posts
- store prompt, seed if available, model, timestamp, and file path
- retry failed jobs safely
- do not publish raw outputs before validation

5A. Visual Asset Sourcing Agent
Purpose:

- choose the safest free visual source for each slide before rendering
- source photo-style backgrounds without violating copyright or privacy rules
- preserve attribution and license notes in the delivered post package

Allowed sources:

- Cloudflare Workers AI for original generated backgrounds under the free allocation and hard cap
- Pexels API when a free key is configured
- Wikimedia Commons when explicitly enabled and license metadata is reusable
- local Sharp/SVG synthetic rendering as the guaranteed fallback

Blocked sources:

- Google Images scraping
- Google Photos as a public image source
- copied Instagram screenshots or creator templates

1. Vision QA / Design Critic Agent
Purpose:

- inspect every generated image using vision
- reject weak, broken, or risky outputs

Checks:

- text rendering quality
- spelling errors
- malformed letters
- layout alignment
- color consistency
- branding consistency
- readability on mobile
- clutter score
- aesthetic score
- obvious AI artifacts
- incorrect icons
- numbers rendered incorrectly
- factual mismatch between intended copy and visible copy
- whether the slide set is visually coherent as a series

For carousel sets:

- score each slide individually
- score the set holistically
- reject any set with even one broken slide if publishing confidence falls below threshold

The critic must prefer:

- clarity
- premium feel
- consistency
- legibility
- credibility

1. Finance Accuracy & Compliance Agent
Purpose:

- verify every factual claim before publishing

Requirements:

- detect all factual claims in captions and slides
- verify against approved source list
- flag unsupported claims
- flag personalized advice
- flag promissory language
- flag misleading tax language
- flag investment recommendation risk
- force rewrites when confidence is low

Approved-source priority:

- official government sites
- official regulator sites
- official tax authority sites
- official central bank / statistical agency data
- user-approved internal source library
- avoid random blogs for finance facts

Rules:

- if a fact cannot be verified, remove it or draft the post instead of publishing
- educational framing only
- no personalized recommendations
- no “you should buy this stock now” style language
- no guarantee claims
- no fake urgency

1. Copywriting Agent
Purpose:

- write final post copy assets

Generate:

- final on-image text
- final caption
- 3 caption variants
- CTA
- first comment
- optional pinned comment
- alt text / accessibility text
- short story teaser
- hashtag set
- internal SEO/search keyword tags

Tone:

- premium
- concise
- credible
- strong hook
- saveable
- shareable
- never cringe
- never spammy
- never too many hashtags

Rules:

- keep captions optimized for clarity and saves
- use search-relevant terms naturally
- vary CTAs
- do not overuse emojis
- finance tone should feel intelligent, not loud

1. Packaging Agent
Purpose:

- assemble the final publish-ready asset bundle

Bundle includes:

- selected image(s)
- final caption
- first comment
- hashtags
- alt text
- publish time
- content type
- confidence report
- source references used for verification
- cover slide selection

1. Publisher Agent
Purpose:

- publish content automatically every morning

Requirements:

- support scheduled publishing
- use secure authentication and token refresh
- handle single-image posts and carousel publishing flows
- create drafts when a format cannot be auto-published safely
- confirm successful publish and persist returned post ID / permalink / timestamp
- retry transient failures
- never publish duplicates
- protect against accidental double-posting

Publishing logic:

- local timezone must default to America/Vancouver unless configured otherwise
- default publish window: morning local time
- allow smart scheduling based on account analytics later

1. Analytics Agent
Purpose:

- collect post-performance metrics and feed learning back into the system

Track:

- impressions
- reach
- likes
- comments
- shares
- saves
- follows attributed if available
- engagement rate
- saves per reach
- shares per reach
- slide completion proxies for carousels if available
- caption pattern performance
- topic cluster performance
- posting-time performance
- content format performance

Output:

- per-post performance report
- weekly summary
- rolling insights
- content recommendations
- topic retirement suggestions
- next-best topics

1. Weekly Digest Agent
Purpose:

- give me one concise operator-level report once per week

Include:

- what posted
- what worked
- what failed
- best hooks
- best content types
- best times
- what to double down on
- what to stop
- what I personally should record next week if I want to add manual content

==================================================
DATA MODEL
==================================================

Design a robust schema for:

- brand settings
- accounts
- content ideas
- research artifacts
- post briefs
- prompts
- generated assets
- asset scores
- compliance checks
- factual claims and sources
- publishing jobs
- published posts
- analytics
- experiments
- weekly reports
- manual overrides
- failure logs

==================================================
ADMIN DASHBOARD
==================================================

Build a clean internal dashboard where I can:

- see today’s proposed post
- approve / reject / edit if I want
- view generated images
- view research notes
- view accuracy/compliance warnings
- see scheduled posts
- see published post history
- inspect analytics
- upload my own manual assets when needed
- maintain approved brand prompt templates
- maintain a “do not post” topic list
- maintain source whitelists
- set posting windows
- pause automation

The dashboard must be optional for daily use.
The system should still operate autonomously when confidence is high.

==================================================
INITIAL BRAND STRATEGY RULES
==================================================

Use these starting rules:

Brand promise:
“Clear, premium, data-first breakdowns on money, markets, and strategy.”

Target audience:

- Canadians interested in personal finance
- beginner to intermediate investors
- people comparing account types, tax strategies, money frameworks
- occasional broader North American market learners

Core content pillars:

1. Canadian money systems explained
2. investing frameworks and account selection
3. tax-aware money decisions
4. visual market breakdowns
5. decision frameworks, not hype
6. occasional US market education

Content rules:

- no celebrity finance gossip
- no clickbait fearmongering
- no meme spam
- no fake scarcity
- no day-trading bro aesthetic
- no “retire by 30” nonsense
- no fabricated screenshots
- no fake portfolio claims

Visual rules:

- premium dark editorial style
- clean composition
- high contrast
- mobile readability first
- no clutter
- limited palette
- consistent footer / brand signature if useful
- every slide should feel like part of one system

==================================================
DAILY AUTONOMOUS WORKFLOW
==================================================

Every day, run this workflow:

Step 1: research

- gather topic signals
- update topic scores
- identify one primary topic and two backups

Step 2: choose format

- decide carousel vs single image
- justify decision

Step 3: create post brief

- hook
- audience
- angle
- outline
- factual claim list

Step 4: verify facts

- source all factual claims
- revise weak claims

Step 5: generate image prompts

- at least 2 directions
- at least 2 variants per direction

Step 6: generate images

- produce candidate assets
- store everything

Step 7: critique images

- reject weak outputs
- score remaining sets

Step 8: write copy

- caption
- CTA
- hashtags
- comment
- alt text

Step 9: final packaging

- pick best asset set
- attach copy
- attach metadata
- assign confidence score

Step 10: publish or draft

- if confidence >= threshold and all checks pass, publish
- otherwise create draft + alert

Step 11: post-publish logging

- save post identifiers and preview

Step 12: delayed analytics collection

- collect and compare results later

==================================================
CONFIDENCE AND FAIL-SAFE LOGIC
==================================================

Define explicit confidence scoring.

Suggested categories:

- topic confidence
- factual confidence
- visual quality confidence
- copy confidence
- compliance confidence
- publishability confidence

Hard fail conditions:

- broken text in images
- unverifiable factual claim
- compliance red flag
- duplicate concept too soon
- wrong branding
- broken asset upload
- missing caption
- unsupported publish flow
- token/auth issue
- uncertainty above threshold

If hard fail:

- do not publish
- save draft
- notify
- explain exact reason
- propose one auto-fix path

==================================================
SEARCH AND GROWTH LOGIC
==================================================

The system must not chase shallow virality.

It must optimize for:

- searchable topic phrasing
- clear promise in first line / cover
- save-worthy utility
- share-worthy clarity
- repeatable brand point of view
- consistency
- strong hooks
- content that earns attention fast
- compounding learning from past wins

Growth heuristics:

- prefer educational content with one clear takeaway
- use comparison formats often
- build recurring series
- make content instantly understandable
- keep one main idea per post
- end carousels with one simple CTA only
- use strong cover slides
- reduce information density when mobile readability suffers
- test hooks systematically
- avoid overproducing generic AI-looking visuals

==================================================
MVP SCOPE
==================================================

Ship the MVP first.

MVP must include:

- daily research
- topic selection
- zero-cost image generation with local Sharp output and optional capped Cloudflare Workers AI backgrounds
- carousel + single image support
- caption generation
- compliance + visual QA
- automated publishing
- analytics ingestion
- admin dashboard
- weekly digest

Nice-to-have after MVP:

- A/B testing framework
- content series memory
- deeper trend clustering
- multilingual support
- auto comment reply assistant
- collaborative approval flow

==================================================
DELIVERABLES
==================================================

Produce all of the following:

1. architecture document
2. system design diagram
3. implementation plan
4. repository structure
5. working codebase
6. environment variable template
7. OAuth/auth flow
8. database schema
9. migration files
10. queue/orchestration implementation
11. API integrations
12. dashboard UI
13. test suite
14. Docker setup
15. local development instructions
16. deployment instructions
17. operations runbook
18. brand configuration file for TheStatsAndStacks
19. seed content rules
20. monitoring and alerting setup

==================================================
TESTING REQUIREMENTS
==================================================

Write tests for:

- scheduling
- topic selection
- content-type decisioning
- prompt generation
- image QA rejection logic
- finance compliance rules
- duplicate-post prevention
- publishing flow
- token refresh
- analytics ingestion
- fail-safe logic

Add integration tests and dry-run mode.

Implement:

- dry-run publish mode
- sandbox mode
- test content mode
- simulated daily run
- replayable artifact history

==================================================
OPERATOR EXPERIENCE
==================================================

I do not want lots of back-and-forth.

Make reasonable assumptions.
Document them clearly.
Build the system with a sensible default configuration.
If something is blocked by an external API limitation, do not stop.
Implement the next best compliant fallback and continue.
Minimize my required manual work.

==================================================
SUCCESS CRITERIA
==================================================

This project is successful only if:

- it can run daily with minimal intervention
- it can generate premium finance content automatically
- it avoids obvious factual and visual mistakes
- it publishes or drafts safely
- it learns from performance data
- it gives me confidence to be hands-off most days
- it is maintainable and production-grade

==================================================
EXECUTION INSTRUCTIONS
==================================================

Start by doing these in order:

1. write the full architecture and implementation plan
2. define the data schema and agent interfaces
3. scaffold the full repo
4. implement the integrations and core services
5. implement the dashboard
6. implement tests
7. implement deployment
8. run dry-run simulations
9. surface blockers with fixes
10. produce a launch checklist

Do not stay at the planning stage.
Ship the system.
