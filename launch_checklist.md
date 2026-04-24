# Launch Checklist & Blockers

## Known Blockers & Fixes
1. **Instagram Graph API Tokens**:
   - *Blocker*: Instagram long-lived access tokens expire every 60 days.
   - *Fix*: Implement an automated token refresh background job, or build a reconnect button in the Admin Dashboard that alerts you 5 days before expiration.
2. **DALL-E Text Quality**:
   - *Blocker*: DALL-E 3 struggles with heavy text layouts (like long carousels).
   - *Fix*: The Vision QA agent will reject slides with bad spelling. As a fallback, we can use DALL-E just for the background/art and use a library like `satori` or `puppeteer` to overlay perfect HTML/CSS typography onto the images before publishing.
3. **Finance Verification Sources**:
   - *Blocker*: The LLM might hallucinate finance limits.
   - *Fix*: Maintain a hardcoded JSON or database table of current tax limits (e.g. TFSA $7,000 for 2024) and inject it into the prompt so the LLM doesn't have to guess.

## Pre-Launch Checklist
- [x] Review architecture and agent design
- [x] Set up PostgreSQL and Prisma Schema
- [x] Build core Agent implementations (Strategy, Editorial, QA)
- [x] Configure Next.js Admin Dashboard
- [x] Develop Dry-Run API Workflow
- [x] Setup Docker & Deployment Scripts
- [x] Implement Fail-Safe logic tests (Jest)
- [ ] Connect Instagram Business Account and get permanent API credentials
- [ ] Add real `OPENAI_API_KEY` to `.env`
- [ ] Populate `BrandSettings` table in the database
- [ ] Run End-to-End simulation with Image Generation enabled
- [ ] Deploy to Google Cloud Run and schedule cron triggers
