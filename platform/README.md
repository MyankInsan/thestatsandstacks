This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Daily Automation

Run the GitHub Actions-compatible daily pipeline locally:

```bash
npm run daily
```

Use `env.example` as the non-secret reference for local and GitHub Actions variables.

By default, image generation is free and local: the pipeline creates branded PNG carousel slides with SVG + Sharp, saves a `MANUAL_IMAGE_PROMPTS.md` packet for optional manual refinement, and does not call a paid image API. The GitHub Actions workflow is locked to `FREE_IMAGE_GENERATION_ONLY=true`, so the daily Telegram images will not use OpenAI image generation even if an OpenAI key exists in repository secrets.

`ZERO_COST_MODE=true` is enabled by default. If someone accidentally turns on paid image/video generation env vars, the pipeline stops before generating assets instead of risking a charge.

The local renderer uses exact SVG typography, content-aware mini visual systems, and topic/date-based visual variation so slides stay readable and do not repeat the same generic account-map look every day.

Video generation is also free and local. The workflow can render a vertical MP4 Reel draft from the approved slide assets using FFmpeg, then run a video QA pass. This is intentionally not a paid text-to-video API: the system chooses `REEL_DRAFT` only when local FFmpeg is available, or you can force a Reel draft from every post.

```bash
# macOS example
brew install ffmpeg

# auto = only when strategy chooses REEL_DRAFT
# always = render a Reel draft from carousel slides too
# disabled = never render video
VIDEO_GENERATION_MODE=auto
VIDEO_SECONDS_PER_SLIDE=2.6
```

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

The daily workflow keeps a lightweight topic memory in `/tmp/thestatsandstacks-history/content-history.json` and GitHub Actions cache so it avoids repeating the same topic too soon. Optional Reddit research uses Reddit's API when these are set; unsupported scraping is intentionally not used:

```bash
ENABLE_REDDIT_RESEARCH=true
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USER_AGENT=thestatsandstacks-content-research/1.0
```

Delivery is automatic when credentials are present:

```bash
GMAIL_ADDRESS=...
GMAIL_APP_PASSWORD=...
DELIVERY_EMAIL=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

For Telegram delivery while your computer is off, run through the included GitHub Actions schedule and set the Telegram secrets in GitHub. The workflow runs on a GitHub-hosted Ubuntu runner, installs FFmpeg, generates media, then sends images and any generated MP4 to Telegram. Your laptop and current Wi-Fi do not need to be online for that cloud run.

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
