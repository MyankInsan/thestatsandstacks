# AGENTS.md

Guidance for Codex / other coding agents working in this repository.

## Source of truth

**`CLAUDE.md` (repo root) is the authoritative, current description of the architecture.** Read it first. This file previously held a duplicate architecture summary that drifted out of date (it described an old 5-slot / schema-v2 / "Seedance" design); that content was removed to avoid misleading agents. Do not reintroduce a parallel architecture doc here — update `CLAUDE.md` instead.

Quick orientation (see `CLAUDE.md` for the full, current detail):

- The pipeline is **6 daily slots** (not 5), one ChatGPT-Images-2.0 prompt packet per slot, delivered to Telegram.
- Content history schema is **v3** (`PersistedVisualPlan` grammar) with in-process, non-destructive migration.
- Order is `CarouselConstraintAgent → VisualPlanAgent (locks grammar) → SlideNarrativeAgent (copy-only)`.
- Text generation uses **Gemini** (`gemini-3.5-flash` by default); `ZERO_COST_MODE=true` is enforced by `CostGuardAgent`.
- Brand voice is **North American, US-weighted (~80% US / 20% Canada)** market & money education — data-first, premium, educational, never buy/sell advice.
- An active, phased improvement effort (US-weighted topics, hotter news sourcing, visual-variety overhaul, CTA redesign, QC gate) is documented in `platform/tmp/IMPROVEMENT_PLAN.md` when present.

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
npm run migrate-history  # One-time seed-history loader (idempotent)

# Run a single test file
npx tsx --test __tests__/ctaLibrary.test.ts
```
