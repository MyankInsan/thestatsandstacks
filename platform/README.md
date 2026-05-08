This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Daily Automation

Run the GitHub Actions-compatible daily pipeline locally:

```bash
npm run daily
```

Use `env.example` as the non-secret reference for local and GitHub Actions variables.

By default, image generation is free and local: the pipeline creates branded PNG carousel slides with SVG + Sharp, saves a `MANUAL_IMAGE_PROMPTS.md` packet for optional manual refinement, and does not call a paid image API. The GitHub Actions workflow is scheduled for 8:00 AM Vancouver time and can also be manually dispatched.

`ZERO_COST_MODE=true` is enabled by default. If someone accidentally turns on paid image/video generation env vars, the pipeline stops before generating assets instead of risking a charge.

The local renderer uses exact SVG typography, content-aware mini visual systems, and topic/date-based visual variation so slides stay readable and do not repeat the same generic account-map look every day.

For more eye-catching market-news posts, the pipeline can optionally use Cloudflare Workers AI for $0-background generation on the Free daily allocation, then overlay all text locally with Sharp/SVG. This is the preferred DayTrading-inspired pattern: photo-style background, dark lower gradient, one oversized hook, cyan/green emphasis, and no model-generated text.

```bash
CLOUDFLARE_WORKERS_AI_ENABLED=true
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
CLOUDFLARE_IMAGE_STEPS=4
CLOUDFLARE_MAX_IMAGES_PER_RUN=8
CLOUDFLARE_ALLOW_PAID_OVERAGE=false
```

Keep the Cloudflare model and cap unchanged in zero-cost mode. The cost guard blocks other Cloudflare image models or paid-overage flags because the goal is to stay at $0.

The strategy layer now includes a reference-informed growth pass: it studies patterns from high-follower finance and personal-finance accounts, then converts them into original TheStatsAndStacks formats such as sharper cover hooks, one-framework posts, save/share/follow packaging, and risk-first market education. It should not copy creator templates, screenshots, hooks, or visual identities.

The hot-topic desk runs before the main strategist:

- `MarketHeatAgent` scans a free ticker watchlist for current market heat.
- `CatalystNewsAgent` maps hot tickers to recent public finance headlines.
- `ViralFinanceFormatAgent` converts that attention into compliant carousel ideas.
- `HotTopicDeskAgent` ranks the ideas and passes them to `TrendResearchAgent`.
- `MediaFormatDecisionAgent` decides whether the day should be one picture or a carousel.
- `CarouselPlanningAgent` decides the exact slide count and role of each frame.
- `VisualAssetSourcingAgent` chooses the legal visual source per slide before rendering.

This lets the account react to advanced investing-page topics such as SanDisk/SNDK or AI-storage momentum while staying educational: what happened, why it matters, what to watch, and what risks to respect. It never creates buy/sell/hold calls, price targets, or "stocks to buy" content.

The visual sourcing order is free-first and rights-safe. Google Images scraping and Google Photos sourcing are intentionally not used. Google Images does not grant reuse rights, and Google Photos requires user OAuth for a private library, so neither is a good unattended GitHub Actions source. The pipeline uses:

- Cloudflare Workers AI when configured, for original photo-style backgrounds.
- Pexels when `PEXELS_API_KEY` is configured, for free licensed stock images with attribution notes.
- Wikimedia Commons only when explicitly enabled, for reusable public-license educational assets with attribution notes.
- Local Sharp/SVG rendering as the guaranteed fallback.

```bash
ENABLE_LICENSED_ASSET_SOURCING=true
PREFER_STOCK_ASSET_SOURCING=false
PEXELS_API_KEY=...
ENABLE_WIKIMEDIA_SOURCING=false
WIKIMEDIA_USER_AGENT=thestatsandstacks-content-bot/1.0
```

The daily automation is picture-only. It does not create Reels, MP4s, audio tracks, or FFmpeg-rendered videos; delivery sends the generated PNG slides and copy package.

To intentionally use OpenAI image generation locally later, you would need to opt out of free-only mode and set:

```bash
FREE_IMAGE_GENERATION_ONLY=false
ALLOW_PAID_IMAGE_GENERATION=true
OPENAI_API_KEY=your_api_key
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_QUALITY=medium
OPENAI_IMAGE_SIZE=1024x1536
```

OpenAI API usage is billed separately from ChatGPT subscriptions, including ChatGPT Business. Keep `FREE_IMAGE_GENERATION_ONLY=true` and `ALLOW_PAID_IMAGE_GENERATION=false` if you do not want image charges.

Caption packaging is intentionally conservative for Instagram: captions are normalized below 1,100 characters, hashtags are capped at 5, and hashtags are kept out of the caption body so the final copy is easier to paste into Instagram.

The daily workflow keeps a lightweight topic memory in `/tmp/thestatsandstacks-history/content-history.json` and, when manually run on GitHub, can restore that memory from Actions cache so it avoids repeating the same topic too soon. Optional Reddit research uses Reddit's API when these are set; unsupported scraping is intentionally not used:

```bash
ENABLE_REDDIT_RESEARCH=true
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USER_AGENT=thestatsandstacks-content-research/1.0
```

The hot-topic market watchlist is optional and free:

```bash
HOT_TOPIC_WATCHLIST=SNDK,WDC,MU,NVDA,AVGO,AMD,PLTR,APP,HOOD,COIN,MSTR,SMCI,TSLA,SOFI,RKLB,IONQ
```

Delivery is automatic when credentials are present:

```bash
GMAIL_ADDRESS=...
GMAIL_APP_PASSWORD=...
DELIVERY_EMAIL=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

For $0 hosted operation, keep the repository public or use a self-hosted runner. If the repository is private, GitHub-hosted scheduled runs consume the private-repo Actions minute allowance.

Useful checks:

```bash
npm run lint
npm run typecheck
npm test
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
