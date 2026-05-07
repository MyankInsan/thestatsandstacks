# Architecture Document & Implementation Plan

## 1. System Architecture Diagram
```mermaid
graph TD
    A[Local runner / 8 AM GitHub Schedule / Manual Dispatch] -->|Triggers Daily| Z(Zero-Cost Guard)
    Z --> H0(Hot Topic Desk)
    H0 --> H1(Market Heat Agent)
    H0 --> H2(Catalyst News Agent)
    H0 --> H3(Viral Finance Format Agent)
    H1 --> B(Trend Research Agent)
    H2 --> B
    H3 --> B
    B --> C(Content Strategy Agent)
    C --> D(Editorial Planning Agent)
    D --> E(Image Prompt Agent)
    E --> F(Image Generation Agent)
    F --> G(Vision QA Critic)
    G --> H(Finance Accuracy & Compliance)
    H --> I(Copywriting Agent)
    I --> J(Packaging Agent)
    J --> L{Publisher Agent}
    
    L -->|High Confidence| M[Instagram Graph API]
    L -->|Low Confidence / Error| N[Save as Draft & Alert]
    
    O[Analytics Agent] -->|Reads Daily| M
    O --> P(Weekly Digest Agent)
    
    Q[Next.js Admin Dashboard] --> R[(PostgreSQL / Prisma)]
    B -.-> R
    C -.-> R
    D -.-> R
    F -.-> R
    G -.-> R
    H -.-> R
    L -.-> R
    O -.-> R

    S[Redis / BullMQ] --- B
    S --- F
    S --- L
```

## 2. Core Stack Components
- **Framework**: Next.js 14 (App Router) for Admin Dashboard & API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Queue/Orchestration**: Redis + BullMQ (Handles multi-step agent workflows with retries)
- **AI Models**: OpenAI GPT-4o (Agents, Copy, Finance Checks), DALL-E 3 (Image Generation)
- **Hot Topic Desk**: Free ticker heat scan, catalyst/news mapping, and viral-format conversion before final strategy selection.
- **Picture Rendering**: Free local Sharp PNG rendering from generated carousel briefs; the daily automation is picture-only.
- **Zero-Cost Mode**: Paid image/video APIs are blocked by default; daily cloud runs use local Sharp images only.
- **Deployment**: GitHub Actions for the standalone daily picture workflow; the longer-term dashboard/worker architecture can still run on Cloud Run, Cloud Scheduler, and Cloud Storage.
- **Auth**: NextAuth / simple auth for Admin Dashboard

## 3. Implementation Plan

### Phase 1: Foundation & Data Layer
- Scaffold Next.js Monorepo structure.
- Setup PostgreSQL, Prisma, and define full `schema.prisma`.
- Setup Redis & BullMQ for job orchestration.
- Define internal base agent interfaces and LLM service abstractions.

### Phase 2: Core Agents Implementation
- **Trend Research & Strategy**: Implement daily trend extraction, hot-topic desk scoring, catalyst mapping, and topic scoring.
- **Editorial & Copywriting**: Generating structured post briefs and captions.
- **Image Generation Pipeline**: Implement DALL-E integration, prompts generation, vision QA, and asset storage (GCS/Local for MVP).
- **Compliance & Accuracy**: Implement factual checks against structured sources.

### Phase 3: Publishing & Orchestration
- **Instagram Graph API**: Implement OAuth, token refresh, and Publishing flows (single image, carousel).
- **Workflow Orchestrator**: Tie all agents together in a BullMQ flow (Step 1 to Step 10).
- Implement Fail-safe logic and confidence scoring aggregation.

### Phase 4: Admin Dashboard
- Build the UI to view active jobs, drafted posts, generated assets.
- Implement manual override, approvals, and confidence reports.

### Phase 5: Analytics & Delivery
- Implement delayed analytics collection.
- Implement Weekly Digest generation.
- Dockerize the app and provide deployment scripts for Google Cloud.

## 4. Environment Variables Required
- `DATABASE_URL`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `HOT_TOPIC_WATCHLIST`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `GMAIL_ADDRESS`
- `GMAIL_APP_PASSWORD`
- `DELIVERY_EMAIL`
- `INSTAGRAM_ACCESS_TOKEN`
- `INSTAGRAM_ACCOUNT_ID`
- `GCP_PROJECT_ID`
- `GCS_BUCKET_NAME`
