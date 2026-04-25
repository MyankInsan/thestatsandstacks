This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Daily Automation

Run the GitHub Actions-compatible daily pipeline locally:

```bash
npm run daily
```

Use `env.example` as the non-secret reference for local and GitHub Actions variables.

By default, image generation is cost-safe: the pipeline creates branded local PNG carousel slides, saves a `MANUAL_IMAGE_PROMPTS.md` packet for optional ChatGPT/Gemini refinement, and does not call a paid image API. To intentionally use OpenAI image generation, set both:

```bash
ALLOW_PAID_IMAGE_GENERATION=true
OPENAI_API_KEY=your_api_key
```

OpenAI API usage is billed separately from ChatGPT subscriptions, including ChatGPT Business. Keep `ALLOW_PAID_IMAGE_GENERATION=false` if you do not want additional API image charges. If paid image generation is enabled, the default model is `chatgpt-image-latest`.

Delivery is automatic when credentials are present:

```bash
GMAIL_ADDRESS=...
GMAIL_APP_PASSWORD=...
DELIVERY_EMAIL=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

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
