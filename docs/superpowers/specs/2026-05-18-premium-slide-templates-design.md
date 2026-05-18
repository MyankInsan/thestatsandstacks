# Premium Slide Templates — Design Spec
**Date:** 2026-05-18  
**Status:** Approved — ready for implementation planning

---

## Overview

Upgrade all 12 existing slide templates and add 1 new template (`OptionelitySlide`) to match a premium financial infographic visual standard. Reference images show dark navy backgrounds, emerald + gold accents, real SVG data visualizations, editorial typography, and a redesigned brand footer.

Approach: template-by-template (not a big-bang rewrite), with chart primitives emerging from real usage.

---

## Architecture

### New files

```
src/components/charts/
  BarChart.tsx
  DualBarChart.tsx
  LineChart.tsx
  DonutChart.tsx
  BranchingPath.tsx

src/components/slide-templates/
  OptionelitySlide.tsx          ← new template
```

### Modified files

```
src/components/slide-templates/
  SlideFrame.tsx                ← structural redesign
  slides.css                    ← dot-bg, new brand footer styles
  CoverSlide.tsx
  CashflowSlide.tsx
  FrameworkSlide.tsx
  BigNumberSlide.tsx
  ComparisonSlide.tsx
  OutroSlide.tsx
  QuoteSlide.tsx
  RiskMapSlide.tsx
  MythVsFactSlide.tsx
  PureStatSlide.tsx
  MarketPosterSlide.tsx
  PureCoverSlide.tsx

src/lib/agents/
  imagePromptAgent.ts           ← new template routing + richer prop payloads

src/app/render/slide/
  page.tsx                      ← register OptionelitySlide
```

---

## Section 1 — SlideFrame Redesign

Global changes that apply to all 13 templates automatically.

### Top area — slide number treatment

Replace the current `brand-bar` (logo + wordmark + frame counter pill) with a minimal top-left element:

```
01                    ← frameNo, emerald monospace, ~22px
DECISION FILTER       ← category label, 9px, letter-spaced caps, slate-500
────                  ← 24px accent line, var(--tone-acc)
```

`SlideFrame` gains a new `category?: string` prop. Each template passes its eyebrow string as `category`. The brand logo moves entirely to the bottom.

### Bottom area — brand footer

Replace current `foot-bar` (`EDUCATIONAL ONLY` / `@THESTATSANDSTACKS`) with:

```
[icon] THESTATS        FOLLOW @THESTATSANDSTACKS
       ANDSTACKS        FOR VISUAL BREAKDOWNS ON MONEY, MARKETS & STRATEGY. →
```

Logo icon (existing BrandMark SVG, scaled to 28px), wordmark with `STATS` in emerald and `STACKS` in amber, CTA text right-aligned in slate-500 caps. Border-top: `1px solid rgba(52,211,153,0.12)`.

### Background texture

Add `.dot-bg` CSS class alongside existing `.grid-bg`:

```css
.dot-bg {
  position: absolute; inset: 0;
  background-image: radial-gradient(circle, rgba(52,211,153,0.16) 1px, transparent 1px);
  background-size: 28px 28px;
  opacity: 0.5;
  pointer-events: none;
}
```

Templates switch from `.grid-bg` to `.dot-bg`. Keep `.grid-bg` in CSS for any template that still wants it.

### SlideFrame updated props

```ts
interface SlideFrameProps {
  children?: React.ReactNode;
  frameNo?: number;
  totalFrames?: number;
  category?: string;          // ← new: shown under slide number
  theme?: { acc?: string; acc2?: string; acc3?: string; bg?: string };
  tone?: 'emerald' | 'cyan' | 'amber' | 'rose';
  hideBrand?: boolean;
  hideFooter?: boolean;
  scale?: boolean;
}
```

---

## Section 2 — Chart Primitives

All five components live in `src/components/charts/`. All are pure SVG, no external chart library, fully data-driven via props.

### `BarChart.tsx`

```ts
interface BarChartProps {
  bars: { label: string; value: number; color?: string }[];
  maxValue?: number;       // defaults to max of bars
  height?: number;         // default 120
  width?: number;          // default 100% (stretch)
  showValues?: boolean;    // render value above each bar
  showLabels?: boolean;    // render label below each bar
  barRadius?: number;      // default 4
}
```

Used by: BigNumberSlide (supporting sparkline bars), CoverSlide (background chart element), MarketPosterSlide.

### `DualBarChart.tsx`

```ts
interface BarGroup {
  label: string;           // "CASH INFLOW" / "CASH OUTFLOW"
  total: number;           // displayed as dollar amount above bars
  color: string;           // emerald or amber
  items: { label: string; amount: number }[];
}

interface DualBarChartProps {
  left: BarGroup;
  right: BarGroup;
  height?: number;         // bar area height, default 140
  currencySymbol?: string; // default '$'
}
```

Renders: direction arrow + label + total amount + grouped bars + legend rows with dot + label + amount. Separated by a centred "VS" divider. Used exclusively by CashflowSlide.

### `LineChart.tsx`

```ts
interface LineChartProps {
  points: number[];        // raw values, auto-scaled to viewBox
  color?: string;          // default var(--tone-acc)
  width?: number;
  height?: number;         // default 40
  filled?: boolean;        // area fill under line
  strokeWidth?: number;    // default 1.5
}
```

Used by: CashflowSlide (trend box top-right), CoverSlide (mini market overview panel).

### `DonutChart.tsx`

```ts
interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;           // diameter, default 64
  thickness?: number;      // stroke width, default 10
}
```

Used by: CoverSlide (mini portfolio allocation panel).

### `BranchingPath.tsx`

```ts
interface BranchPath {
  color: string;           // hex or CSS var
  dashed?: boolean;        // dashed stroke for "closed" paths
}

interface BranchIcon {
  symbol: string;          // emoji or single char
  color: string;
}

interface BranchingPathProps {
  paths: BranchPath[];     // ordered top-to-bottom; origin is fixed center-left
  endIcons?: BranchIcon[]; // one per path, rendered as circles at path endpoints
  width?: number;
  height?: number;
}
```

Computes bezier control points automatically from path count. Origin circle is fixed at (25% of width, 50% of height). Endpoint x-position is fixed at 90% of width; endpoint y-positions are evenly distributed across the full height with a small top/bottom margin. Used exclusively by OptionelitySlide.

---

## Section 3 — Per-Template Upgrades

### Templates with interface breaks

#### `CashflowSlide`

**Old props (removed):**
```ts
rows?: { label: string; pct: number; color?: string; note?: string }[];
items?: same;  // alias
```

**New props:**
```ts
interface CashflowSlideProps {
  eyebrow?: string;
  inflow: {
    total: number;
    items: { label: string; amount: number }[];
  };
  outflow: {
    total: number;
    items: { label: string; amount: number }[];
  };
  trend?: number[];          // sparkline points for top-right trend box
  trendLabel?: string;       // e.g. "+18.6% VS LAST MONTH"
  tone?: 'emerald' | 'amber';
  frameNo?: number;
  totalFrames?: number;
}
```

**Layout:**
- Top-right: mini trend box with `LineChart` + net cash flow value + `trendLabel`
- Center: `DualBarChart` (left=inflow emerald, right=outflow amber)
- Bottom: summary strip — `↑ INFLOW $X − ↓ OUTFLOW $Y = ↗ NET $Z`

#### `CoverSlide`

**Added prop (optional, falls back gracefully):**
```ts
dashboardPanels?: {
  marketReturn: number;          // e.g. 7.68
  allocation: {
    equities: number;            // percentage 0-100
    bonds: number;
    cash: number;
    alternatives: number;
  };
  metrics: {
    returnYtd: number;
    volatility: number;
    sharpe: number;
    maxDrawdown: number;         // negative number
  };
}
```

**Layout additions when `dashboardPanels` present:**
- Three mini panels across the bottom (above brand footer): Market Overview (`LineChart` sparkline + YTD %), Portfolio Allocation (`DonutChart`), Key Metrics (4-row table).
- Background: faint `BarChart` bars spanning right 55% of slide, low opacity, as a decorative element.

When `dashboardPanels` is absent, slide renders clean cover without panels.

#### `OptionelitySlide` (new)

```ts
interface OptionelitySlideProps {
  eyebrow?: string;              // e.g. "OPTIONALITY FILTER"
  headline: string;              // e.g. "OPTIONALITY CREATES FUTURE CHOICES."
  accentWord?: string;           // word within headline to render in --tone-acc
  kicker?: string;               // subline e.g. "WILL THIS DECISION OPEN MORE DOORS LATER?"
  paths: {
    color: 'emerald' | 'amber' | 'muted';
    dashed?: boolean;
  }[];                           // 4-6 paths; top paths = best outcomes
  endIcons?: {
    symbol: string;
    color: 'emerald' | 'amber' | 'muted';
  }[];                           // one per path
  items: {
    icon: string;
    label: string;               // e.g. "FLEXIBILITY TODAY"
    body: string;                // e.g. "Stay adaptable to change."
  }[];                           // 4 items, rendered 2×2 grid at bottom
  tone?: 'emerald' | 'amber';
  frameNo?: number;
  totalFrames?: number;
}
```

**Layout:**
- Top-left: slide number treatment + headline with accent word
- Center-right: `BranchingPath` SVG spanning full height with icon circle endpoints on right edge
- Bottom: 2×2 grid of item cards (icon + label + body)

### Templates with visual upgrades only (props backward-compatible)

All of the following keep their existing prop interfaces. New optional props are added where noted but never required by the agent.

| Template | Changes |
|---|---|
| **FrameworkSlide** | Step number badges larger (96px → 96px + glow ring), left border on cards more prominent, `category` fed to SlideFrame |
| **BigNumberSlide** | Adds optional `sparkline?: number[]` for a supporting BarChart; number size tuned; `category` to SlideFrame |
| **ComparisonSlide** | Adds optional `leftScore?: number; rightScore?: number` (0–100) for a visual strength bar between columns |
| **RiskMapSlide** | Risk cards get a left-edge severity color band (rose=risk 1, amber=risk 2, emerald/slate=risk 3) |
| **MythVsFactSlide** | Two columns get ✗ / ✓ iconography, larger type, stronger contrast |
| **QuoteSlide** | Larger pull-quote marks (decorative SVG), citation line treatment below quote |
| **OutroSlide** | Redesigned for brand-forward CTA; uses new brand footer aesthetic for consistency |
| **PureStatSlide** | Typography bump, spacing refinements |
| **MarketPosterSlide** | Adds optional `priceHistory?: number[]` for a LineChart sparkline |
| **PureCoverSlide** | Typography and spacing tune-up only |

---

## Section 4 — Agent Updates (`imagePromptAgent.ts`)

### `resolveTemplate()` additions

Two new routing rules added before the catch-all `FrameworkSlide` return:

```ts
// Cash flow / budget posts
if (/cash flow|budget|inflow|outflow|income.*expense|spending.*income|monthly.*money/.test(t)) 
  return 'CashflowSlide';

// Optionality / flexibility posts  
if (/optionality|flexibility|future choice|open.*door|keeping.*option|more.*option/.test(t))
  return 'OptionelitySlide';
```

### `buildTemplateProps()` additions

**`CashflowSlide`:** Parses bullet content for dollar amounts using a regex (`/\$[\d,]+/g`). If fewer than 2 amounts are found, falls back to a fixed illustrative dataset: inflow `{total: 5800, items: [{Salary, 4200}, {Side Income, 900}, {Investments, 700}]}`, outflow `{total: 4550, items: [{Housing, 2000}, {Food, 700}, {Transport, 650}, {Lifestyle, 800}, {Other, 400}]}`. Always generates `trend` as a 7-point ascending array `[100, 112, 108, 125, 119, 138, 145]` scaled to the net cash flow amount.

**`OptionelitySlide`:** Generates `paths` as 3 emerald + 1 amber + 2 muted/dashed. Generates `items` array (4 items) from bullet content, with icon fallbacks per label keyword.

**`CoverSlide`:** Always includes `dashboardPanels` with illustrative but realistic Canadian finance numbers. Values use a fixed baseline (`returnYtd: 7.68, volatility: 11.42, sharpe: 0.67, maxDrawdown: -8.21, allocation: {equities: 65, bonds: 20, cash: 10, alternatives: 5}`) with a small integer offset derived from `topic.length % 5` so different topics render slightly different numbers without any randomness between renders.

### No other agents require changes

`imageGenerationAgent.ts`, `visionQAAgent.ts`, and the render pipeline are all template-agnostic. `page.tsx` in the render route simply needs `OptionelitySlide` added to its component map.

---

## Implementation Order

Build in this sequence to keep each step independently shippable:

1. **SlideFrame + slides.css** — global changes land first; all existing templates inherit immediately
2. **Chart primitives** — 5 components, no template dependencies
3. **CashflowSlide** — highest visual impact, uses DualBarChart + LineChart
4. **CoverSlide** — uses LineChart + DonutChart + BarChart
5. **OptionelitySlide** — uses BranchingPath; new template registered in render page
6. **imagePromptAgent.ts** — new routing + prop builders for CashflowSlide, CoverSlide, OptionelitySlide
7. **Remaining 9 templates** — visual upgrades, no primitive deps, can be done in parallel

---

## Out of Scope

- Animation / Remotion changes (separate concern)
- Dashboard UI changes
- Caption / hashtag generation
- Instagram publishing pipeline
- New font imports (Inter Variable already loaded)
