import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import type { StrategyDecision } from './contentStrategyAgent';
import type { FormatDecision } from './formatStyleAgent';
import type { ViralStyle } from './promptLibrary';
import { ROTATION_ALLOWLIST } from './promptLibrary';
import type { CarouselConstraints } from './carouselConstraintAgent';

export interface HeadlineColor {
  text: string;
  color: 'primary' | 'accent1' | 'accent2';
}

export type SlideRole = 'cover' | 'shock_stat' | 'context' | 'breakdown' | 'data' | 'humor' | 'cta' | 'chart_data';

export interface SlideSpec {
  slideNumber: number;
  role: SlideRole;
  headline: string;
  headlineColorMap: HeadlineColor[];
  subtext?: string;
  eyebrow?: string;
  dataPoint?: string;
  visualStyle: ViralStyle;
  visualPosition: 'top' | 'background' | 'left' | 'right' | 'center';
  mood: string;
  narrativeNote: string;
}

export interface SlideNarrative {
  slides: SlideSpec[];
  hadConstraintViolation: boolean;
}

export interface SlideNarrativeInput {
  strategy: StrategyDecision;
  format: FormatDecision;
  tickerSymbols: string[];
  constraints?: CarouselConstraints;
}

export class SlideNarrativeAgent {
  async execute(input: SlideNarrativeInput): Promise<SlideNarrative> {
    console.log(`[SlideNarrativeAgent] Writing ${input.format.slideCount} slide specs${input.constraints ? ' with constraints' : ''}...`);

    let parsed: SlideSpec[] | null = null;
    let hadViolation = false;
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt++) {
      const prompt = buildPrompt(input.strategy, input.format, input.tickerSymbols, input.constraints, attempt);
      try {
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
        const result = await model.generateContent(prompt);
        const text = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const json = JSON.parse(text) as { slides: SlideSpec[] };

        if (!Array.isArray(json.slides) || json.slides.length === 0) {
          throw new Error('Empty slides array from Gemini');
        }

        const candidate = json.slides.slice(0, input.format.slideCount).map((s, i) => ({
          ...s,
          slideNumber: i + 1,
          headlineColorMap: Array.isArray(s.headlineColorMap) ? s.headlineColorMap : [{ text: s.headline, color: 'primary' as const }],
          visualPosition: s.visualPosition || 'top',
        }));

        if (candidate.length > 0) candidate[candidate.length - 1].role = 'cta';

        const violations = validateAgainstConstraints(candidate, input.constraints);
        if (violations.length === 0) {
          parsed = candidate;
          break;
        } else {
          hadViolation = true;
          console.warn(`[SlideNarrativeAgent] Attempt ${attempt} violated constraints: ${violations.join('; ')}. ${attempt < 2 ? 'Retrying with stricter prompt.' : 'Falling back.'}`);
          if (attempt < 2) continue;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[SlideNarrativeAgent] Attempt ${attempt} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (parsed) {
      return { slides: parsed, hadConstraintViolation: hadViolation };
    }

    void lastError;
    return { slides: buildFallback(input.strategy, input.format, input.constraints), hadConstraintViolation: true };
  }
}

function buildPrompt(
  strategy: StrategyDecision,
  format: FormatDecision,
  tickers: string[],
  constraints: CarouselConstraints | undefined,
  attempt: number,
): string {
  const constraintsBlock = constraints ? buildConstraintsBlock(constraints, attempt) : '';
  const allowedStyles = filterAllowedStyles(constraints);

  return `You are a viral finance Instagram content writer. Write the complete slide narrative for a ${format.slideCount}-slide carousel.

TOPIC: ${strategy.topic}
HOOK: ${strategy.hook}
FORMAT TYPE: ${format.formatType}
VISUAL TONE: ${format.visualTone}
TICKERS: ${tickers.join(', ') || 'none'}
TARGET AUDIENCE: ${strategy.targetAudience}
COLOR SCHEME: bg=${format.colorScheme.bg}, accent1=${format.colorScheme.accent1}, accent2=${format.colorScheme.accent2}
${constraintsBlock}

SLIDE NARRATIVE RULES:
- Slide 1: Cover — highest energy hook, 4-7 word headline, eyebrow label
- Slide 2: Agitator / Secondary Hook — deepen the problem or expand the hook
- Middle slides: PAS (Problem-Agitate-Solve) framework. Each middle slide ends with an "Open Loop" transition.
- Penultimate Slide: Summary / Cheat-sheet (highly savable bulleted list).
- Last slide: Always role "cta" — strong follow/save prompt. For the CTA slide, use visualStyle "PREMIUM_CTA" or another premium cinematic style (LUXURY_LIFESTYLE or VAULT_SECURITY). Never use MINIMALIST_CHECKLIST for CTA.
- Each headline: max 8 words, bold and punchy.
- headlineColorMap: break headline into parts, assign each part a color (primary=white, accent1=neon, accent2=cyan/secondary).
- visualStyle: assign a DIFFERENT visualStyle to each slide based on its role. Choose EXACTLY ONE from this list of keys: ${allowedStyles.join(', ')}. Do not use the same visualStyle twice in a row.
- For ANY slide where the dataPoint contains "$", "%", an OHLC pattern name, or a named institution, set role to "chart_data" and pick a Data-bucket visualStyle (CANDLESTICK_HERO, CAP_TABLE_GRID, EARNINGS_HEAT_TABLE, INSTITUTIONAL_FLOW_SANKEY, POSITION_CONCENTRATION_TREEMAP, PORTFOLIO_DOUGHNUT_PORTRAIT, MACRO_FLOW_DIAGRAM, PRICE_TIMELINE_ANNOTATED, PORTFOLIO_BAR_RACE, EARNINGS_CARD, TICKER_TAPE_HERO, COMPARISON_TABLE, LINE_CHART, DONUT_CHART, BAR_CHART_HORIZONTAL, HEATMAP_GRID).
- dataPoint: include only if there's a real number/stat to hero (e.g. "+18.2% EPS BEAT").
- subtext: one short line of supporting context, max 12 words.
- narrativeNote: if the dataPoint is inferred (not directly from research), include the literal word "illustrative" in the note so the image pipeline knows to suppress specific-but-wrong claims.

Return ONLY valid JSON matching this exact schema (no markdown):
{
  "slides": [
    {
      "slideNumber": 1,
      "role": "cover",
      "headline": "NVIDIA JUST BROKE",
      "headlineColorMap": [
        {"text": "NVIDIA", "color": "accent2"},
        {"text": "JUST BROKE", "color": "primary"}
      ],
      "eyebrow": "JUST IN:",
      "subtext": "Wall Street didn't see this coming",
      "dataPoint": null,
      "visualStyle": "ARCHITECTURAL_OVERLAY",
      "visualPosition": "top",
      "mood": "urgent, high-energy, breaking news",
      "narrativeNote": "Opens with the hook — sets up the big reveal in slide 2"
    }
  ]
}`;
}

function buildConstraintsBlock(c: CarouselConstraints, attempt: number): string {
  const lines: string[] = ['', 'HARD CONSTRAINTS (must satisfy):'];
  if (c.excludedStyles.length > 0) {
    lines.push(`- Do NOT use these visualStyles (recently used): ${c.excludedStyles.join(', ')}`);
  }
  lines.push(`- Max ${c.maxHumanSlides} Human-bucket slides in this carousel (portraits / cutouts).`);
  lines.push(`- Max ${c.maxHumanInFirst3} Human-bucket slide in slides 1-3.`);
  if (c.requiredChartSlideRole) {
    lines.push(`- At least one middle slide must use role "${c.requiredChartSlideRole}" with a Data-bucket visualStyle (chart).`);
  }
  lines.push(`- narrativeArc: ${c.narrativeArc} (use the corresponding role sequence).`);
  if (c.portraitSelection) {
    lines.push(`- For any slide using a portrait-style visualStyle, the subject MUST be: "${c.portraitSelection.displayName}" (${c.portraitSelection.promptHint}). Do not substitute a different person.`);
  }
  if (c.chartHeroSuggestion) {
    lines.push(`- SUGGESTED chart hero visualStyle: ${c.chartHeroSuggestion}. Use it for the data slide unless a different chart style is strictly better.`);
  }
  if (c.ctaId) {
    lines.push(`- CTA shape (final slide must reinforce this): ${c.ctaId} — ${c.ctaCarouselImpactNote}`);
  }
  if (c.payoffSlideIndex !== undefined) {
    lines.push(`- payoff slide index: ${c.payoffSlideIndex}. The cover headline should reference "Slide ${c.payoffSlideIndex}" payoff, and slide ${c.payoffSlideIndex} must deliver the hero data point.`);
  }
  if (attempt > 1) {
    lines.push('- This is attempt #' + attempt + '. The previous output violated constraints. Be strict this time.');
  }
  return lines.join('\n');
}

function filterAllowedStyles(constraints: CarouselConstraints | undefined): ViralStyle[] {
  const base = ROTATION_ALLOWLIST;
  if (!constraints) return base;
  return base.filter((s) => !constraints.excludedStyles.includes(s));
}

function validateAgainstConstraints(slides: SlideSpec[], constraints: CarouselConstraints | undefined): string[] {
  if (!constraints) return [];
  const violations: string[] = [];

  for (const slide of slides) {
    if (constraints.excludedStyles.includes(slide.visualStyle)) {
      violations.push(`Slide ${slide.slideNumber} uses excluded style ${slide.visualStyle}`);
    }
  }

  for (let i = 1; i < slides.length; i++) {
    if (slides[i].visualStyle === slides[i - 1].visualStyle) {
      violations.push(`Slides ${i} and ${i + 1} share visualStyle ${slides[i].visualStyle}`);
    }
  }

  return violations;
}

const FALLBACK_EYEBROWS: Record<string, string> = {
  PHOTOREALISTIC_NEWS_FLASH:        'BREAKING:',
  PHOTOREALISTIC_LUXURY_LIFESTYLE:  'LIFESTYLE:',
  PHOTOREALISTIC_MARKET_UPDATE:     'MARKET:',
  PHOTOREALISTIC_EXPERT_SHOCK:      'INSIGHT:',
  PHOTOREALISTIC_MINIMAL_TECH:      'NOTE:',
};

const FALLBACK_VISUAL_VARIANTS: Record<string, ViralStyle[]> = {
  PHOTOREALISTIC_NEWS_FLASH:        ['ARCHITECTURAL_OVERLAY', 'CROWD_PANIC', 'MILITARY_AEROSPACE_METAPHOR'],
  PHOTOREALISTIC_LUXURY_LIFESTYLE:  ['LUXURY_LIFESTYLE', 'MAGAZINE_COVER'],
  PHOTOREALISTIC_MARKET_UPDATE:     ['TRADER_DESK_SILHOUETTE', 'LINE_CHART', 'CORPORATE_OFFICE_SPACE'],
  PHOTOREALISTIC_EXPERT_SHOCK:      ['EXPERT_CUTOUT', 'CARICATURE_PORTRAIT', 'EXECUTIVE_LINEUP', 'LEADER_LOGO_CUTOUTS'],
  PHOTOREALISTIC_MINIMAL_TECH:      ['MINIMALIST_CHECKLIST', 'TYPOGRAPHIC_MEGA_NUMBER', 'COMPARISON_TABLE'],
};

function stripBreakdownPrefixes(text: string): string {
  return text
    .replace(/^slide\s*\d+[:.]\s*/i, '')
    .replace(/^\w[\w]*\s+\d+[:.]\s*/i, '')
    .trim();
}

function parseBreakdown(breakdown: string): { headline: string; subtext: string } {
  const stripped = stripBreakdownPrefixes(breakdown);
  const parts = stripped.split(' | ').map((p) => p.trim()).filter(Boolean);
  const headlineRaw = (parts[0] ?? stripped).toUpperCase();
  const subtextRaw = parts[1] ?? '';
  return {
    headline: headlineRaw.split(' ').slice(0, 7).join(' '),
    subtext: subtextRaw,
  };
}

function buildFallback(strategy: StrategyDecision, format: FormatDecision, constraints: CarouselConstraints | undefined): SlideSpec[] {
  const count = format.slideCount;
  const eyebrow = FALLBACK_EYEBROWS[format.formatType] ?? 'KEY INSIGHT:';
  const baseVariants = FALLBACK_VISUAL_VARIANTS[format.formatType] ?? FALLBACK_VISUAL_VARIANTS.PHOTOREALISTIC_NEWS_FLASH;
  const excluded = new Set(constraints?.excludedStyles ?? []);
  const visualVariants = baseVariants.filter((v) => !excluded.has(v));
  const variants = visualVariants.length > 0 ? visualVariants : baseVariants;

  const slides: SlideSpec[] = [];

  const coverWords = strategy.hook.toUpperCase().split(' ').slice(0, 8);
  const half = Math.ceil(coverWords.length / 2);
  slides.push({
    slideNumber: 1,
    role: 'cover',
    headline: coverWords.join(' '),
    headlineColorMap: [
      { text: coverWords.slice(0, half).join(' '), color: 'accent1' },
      { text: coverWords.slice(half).join(' '), color: 'primary' },
    ],
    eyebrow,
    subtext: strategy.topic,
    visualStyle: variants[0],
    visualPosition: 'top',
    mood: format.visualTone,
    narrativeNote: 'Cover hook',
  });

  for (let i = 2; i < count; i++) {
    const rawBreakdown = strategy.slideBreakdown[i - 1] ?? `Point ${i - 1}`;
    const { headline, subtext } = parseBreakdown(rawBreakdown);
    const headlineWords = headline.split(' ');
    const headlineHalf = Math.ceil(headlineWords.length / 2);
    slides.push({
      slideNumber: i,
      role: 'breakdown',
      headline,
      headlineColorMap: [
        { text: headlineWords.slice(0, headlineHalf).join(' '), color: 'accent1' },
        { text: headlineWords.slice(headlineHalf).join(' '), color: 'primary' },
      ],
      subtext,
      visualStyle: variants[i % variants.length],
      visualPosition: 'top',
      mood: format.visualTone,
      narrativeNote: `Slide ${i} of the breakdown`,
    });
  }

  slides.push({
    slideNumber: count,
    role: 'cta',
    headline: 'FOLLOW FOR DAILY INSIGHTS',
    headlineColorMap: [
      { text: 'FOLLOW FOR', color: 'primary' },
      { text: 'DAILY INSIGHTS', color: 'accent1' },
    ],
    subtext: 'Canadian finance, no hype — @thestatsandstacks',
    visualStyle: 'PREMIUM_CTA',
    visualPosition: 'center',
    mood: 'confident and inviting',
    narrativeNote: 'CTA — drive follows and saves',
  });

  return slides;
}
