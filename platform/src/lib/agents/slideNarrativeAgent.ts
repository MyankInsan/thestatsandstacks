import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import type { StrategyDecision } from './contentStrategyAgent';
import type { FormatDecision } from './formatStyleAgent';
import type { ViralStyle } from './promptLibrary';
import { ROTATION_ALLOWLIST } from './promptLibrary';
import type { CarouselConstraints } from './carouselConstraintAgent';

const THEMATIC_STYLES_BY_FORMAT: Record<string, string[]> = {
  PHOTOREALISTIC_NEWS_FLASH:        ['ARCHITECTURAL_OVERLAY', 'CROWD_PANIC', 'MILITARY_AEROSPACE_METAPHOR', 'NEON_TERMINAL', 'GLOWING_QUOTE', 'CANDLESTICK_CHART'],
  PHOTOREALISTIC_LUXURY_LIFESTYLE:  ['LUXURY_LIFESTYLE', 'MAGAZINE_COVER', 'CHESS_BOARD_STRATEGY', 'VAULT_SECURITY', 'GLOWING_QUOTE', 'PREMIUM_CTA'],
  PHOTOREALISTIC_MARKET_UPDATE:     ['TRADER_DESK_SILHOUETTE', 'LINE_CHART', 'CORPORATE_OFFICE_SPACE', 'AREA_CHART', 'SANKEY_DIAGRAM', 'DONUT_CHART', 'BAR_CHART_HORIZONTAL', 'CANDLESTICK_HERO', 'TICKER_TAPE_HERO', 'EARNINGS_HEAT_TABLE'],
  PHOTOREALISTIC_EXPERT_SHOCK:      ['EXPERT_CUTOUT', 'CARICATURE_PORTRAIT', 'EXECUTIVE_LINEUP', 'LEADER_LOGO_CUTOUTS', 'EDITORIAL_REACTION_CARICATURE', 'POP_CULTURE_PORTRAIT', 'CIRCULAR_PORTFOLIO_WHEEL', 'PORTFOLIO_DOUGHNUT_PORTRAIT'],
  PHOTOREALISTIC_MINIMAL_TECH:      ['MINIMALIST_CHECKLIST', 'TYPOGRAPHIC_MEGA_NUMBER', 'COMPARISON_TABLE', 'GLASSMORPHISM_UI', 'NEON_TERMINAL', 'CAP_TABLE_GRID', 'POSITION_CONCENTRATION_TREEMAP', 'MACRO_FLOW_DIAGRAM', 'PRICE_TIMELINE_ANNOTATED', 'PORTFOLIO_BAR_RACE', 'EDITORIAL_SPLIT_LAYOUT', 'EARNINGS_CARD', 'MAP_DATA_OVERLAY'],
  MEME_HUMOR:                       ['EDITORIAL_REACTION_CARICATURE', 'CARICATURE_PORTRAIT', 'MEME_COMIC_PLATE', 'SATIRICAL_METAPHOR', 'FUNNY_COMPARISON', 'GLOWING_QUOTE', 'ANIMAL_METAPHOR'],
};

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
    let previousViolations: string[] = [];
    let previousOffendingStyles: ViralStyle[] = [];

    for (let attempt = 1; attempt <= 2; attempt++) {
      const prompt = buildPrompt(input.strategy, input.format, input.tickerSymbols, input.constraints, attempt, previousViolations, previousOffendingStyles);
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
          console.warn(`[SlideNarrativeAgent] Attempt ${attempt} violated constraints: ${violations.join('; ')}. ${attempt < 2 ? 'Retrying with stricter prompt + ban-list.' : 'Falling back.'}`);
          if (attempt < 2) {
            previousViolations = violations;
            previousOffendingStyles = collectOffendingStyles(candidate, violations);
            continue;
          }
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
  previousViolations: string[] = [],
  previousOffendingStyles: ViralStyle[] = [],
): string {
  const constraintsBlock = constraints ? buildConstraintsBlock(constraints, attempt, previousViolations) : '';
  const allowedStyles = filterAllowedStyles(constraints, previousOffendingStyles);
  const formatThematic = THEMATIC_STYLES_BY_FORMAT[format.formatType] ?? [];
  const primaryCandidates = formatThematic.filter(s => allowedStyles.includes(s as ViralStyle));
  const otherAllowed = allowedStyles.filter(s => !primaryCandidates.includes(s));

  return `You are a viral finance Instagram content writer. Write the complete slide narrative for a ${format.slideCount}-slide carousel.

TOPIC: ${strategy.topic}
HOOK: ${strategy.hook}
FORMAT TYPE: ${format.formatType}
VISUAL TONE: ${format.visualTone}
TICKERS: ${tickers.join(', ') || 'none'}
TARGET AUDIENCE: ${strategy.targetAudience}
COLOR SCHEME: bg=${format.colorScheme.bg}, accent1=${format.colorScheme.accent1}, accent2=${format.colorScheme.accent2}
${constraintsBlock}

- RECOMMENDED VISUAL STYLES FOR THIS FORMAT (${format.formatType}): ${primaryCandidates.join(', ')}. You should prioritize these to maintain a cohesive visual theme.
- OTHER ALLOWED VISUAL STYLES: ${otherAllowed.join(', ')}. Use these only when needed for specific slide roles (like charts or CTAs).

SLIDE NARRATIVE RULES:
- Slide 1: Cover — highest energy hook, 4-7 word headline, eyebrow label
- Slide 2: Agitator / Secondary Hook — deepen the problem or expand the hook
- Middle slides: PAS (Problem-Agitate-Solve) framework. Each middle slide ends with an "Open Loop" transition.
- Penultimate Slide: Summary / Cheat-sheet (highly savable bulleted list).
- Last slide: Always role "cta" — strong follow/save prompt. For the CTA slide, use visualStyle "PREMIUM_CTA" or another premium cinematic style (LUXURY_LIFESTYLE or VAULT_SECURITY). Never use MINIMALIST_CHECKLIST for CTA.
- Each headline: max 8 words, bold and punchy.
- headlineColorMap: break headline into parts, assign each part a color (primary=white, accent1=neon, accent2=cyan/secondary).
- visualStyle: assign a DIFFERENT visualStyle to each slide based on its role. Choose EXACTLY ONE from the RECOMMENDED VISUAL STYLES list where possible, and fallback to the OTHER ALLOWED VISUAL STYLES list only if necessary (e.g. for charts or CTAs). Do not use the same visualStyle twice in a row.
- For ANY slide where the dataPoint contains "$", "%", an OHLC pattern name, or a named institution, set role to "chart_data" and pick a Data-bucket visualStyle (CANDLESTICK_HERO, CAP_TABLE_GRID, EARNINGS_HEAT_TABLE, INSTITUTIONAL_FLOW_SANKEY, POSITION_CONCENTRATION_TREEMAP, PORTFOLIO_DOUGHNUT_PORTRAIT, MACRO_FLOW_DIAGRAM, PRICE_TIMELINE_ANNOTATED, PORTFOLIO_BAR_RACE, EARNINGS_CARD, TICKER_TAPE_HERO, COMPARISON_TABLE, LINE_CHART, DONUT_CHART, BAR_CHART_HORIZONTAL, HEATMAP_GRID).
- visualPosition: Vary the visualPosition property across slides. Do NOT default to 'top' for all slides. Choose 'left' or 'right' for split-column layout slides (like checklists, tables, or cards), 'center' for quotes or CTAs, 'background' for full-frame textures or charts, and 'top' only for covers or standard layouts. Ensure at least 3 different positions are used in the carousel to maximize visual layout variety.
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

function buildConstraintsBlock(c: CarouselConstraints, attempt: number, previousViolations: string[] = []): string {
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
  if (attempt > 1 && previousViolations.length > 0) {
    lines.push('- ATTEMPT #' + attempt + '. The previous attempt violated these constraints (you MUST fix them now):');
    for (const v of previousViolations) lines.push('    • ' + v);
    lines.push('  Pick DIFFERENT visualStyles than the offending ones. No two adjacent slides may share a visualStyle.');
  }
  return lines.join('\n');
}

function filterAllowedStyles(constraints: CarouselConstraints | undefined, previousOffendingStyles: ViralStyle[] = []): ViralStyle[] {
  const base = ROTATION_ALLOWLIST;
  const excluded = new Set<ViralStyle>([
    ...(constraints?.excludedStyles ?? []),
    ...previousOffendingStyles,
  ]);
  const filtered = base.filter((s) => !excluded.has(s));
  // Never let the allowlist collapse below 8 styles — fall back to the base list.
  return filtered.length >= 8 ? filtered : base.filter((s) => !(constraints?.excludedStyles ?? []).includes(s));
}

function collectOffendingStyles(slides: SlideSpec[], violations: string[]): ViralStyle[] {
  const offenders = new Set<ViralStyle>();
  for (const v of violations) {
    const match = v.match(/\b([A-Z_]+)\b\s*$/);
    if (match) {
      const style = match[1] as ViralStyle;
      if (slides.some((s) => s.visualStyle === style)) offenders.add(style);
    }
  }
  return Array.from(offenders);
}

function validateAgainstConstraints(slides: SlideSpec[], constraints: CarouselConstraints | undefined): string[] {
  if (!constraints) return [];
  const violations: string[] = [];

  for (const slide of slides) {
    if (constraints.excludedStyles.includes(slide.visualStyle)) {
      violations.push(`Slide ${slide.slideNumber} uses excluded style ${slide.visualStyle}`);
    }
  }

  const seenStyles = new Set<string>();
  for (const slide of slides) {
    if (seenStyles.has(slide.visualStyle)) {
      violations.push(`Slide ${slide.slideNumber} repeats visualStyle ${slide.visualStyle} which is already used in this carousel`);
    }
    seenStyles.add(slide.visualStyle);
  }

  return violations;
}

const FALLBACK_EYEBROWS: Record<string, string> = {
  PHOTOREALISTIC_NEWS_FLASH:        'BREAKING:',
  PHOTOREALISTIC_LUXURY_LIFESTYLE:  'LIFESTYLE:',
  PHOTOREALISTIC_MARKET_UPDATE:     'MARKET:',
  PHOTOREALISTIC_EXPERT_SHOCK:      'INSIGHT:',
  PHOTOREALISTIC_MINIMAL_TECH:      'NOTE:',
  MEME_HUMOR:                       'HOT TAKE:',
};

const FALLBACK_VISUAL_VARIANTS: Record<string, ViralStyle[]> = {
  PHOTOREALISTIC_NEWS_FLASH:        ['ARCHITECTURAL_OVERLAY', 'CROWD_PANIC', 'MILITARY_AEROSPACE_METAPHOR'],
  PHOTOREALISTIC_LUXURY_LIFESTYLE:  ['LUXURY_LIFESTYLE', 'MAGAZINE_COVER'],
  PHOTOREALISTIC_MARKET_UPDATE:     ['TRADER_DESK_SILHOUETTE', 'LINE_CHART', 'CORPORATE_OFFICE_SPACE'],
  PHOTOREALISTIC_EXPERT_SHOCK:      ['EXPERT_CUTOUT', 'CARICATURE_PORTRAIT', 'EXECUTIVE_LINEUP', 'LEADER_LOGO_CUTOUTS'],
  PHOTOREALISTIC_MINIMAL_TECH:      ['MINIMALIST_CHECKLIST', 'TYPOGRAPHIC_MEGA_NUMBER', 'COMPARISON_TABLE'],
  MEME_HUMOR:                       ['EDITORIAL_REACTION_CARICATURE', 'CARICATURE_PORTRAIT', 'SATIRICAL_METAPHOR'],
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

function getNaturalPositionForStyle(style: ViralStyle): SlideSpec['visualPosition'] {
  if (['PREMIUM_CTA', 'GLOWING_QUOTE', 'TYPOGRAPHIC_MEGA_NUMBER', 'GLASSMORPHISM_UI', 'EARNINGS_CARD'].includes(style)) {
    return 'center';
  }
  if (['MINIMALIST_CHECKLIST', 'COMPARISON_TABLE', 'CAP_TABLE_GRID', 'EDITORIAL_SPLIT_LAYOUT', 'EXPERT_CUTOUT'].includes(style)) {
    return 'left';
  }
  if (
    [
      'LINE_CHART',
      'DONUT_CHART',
      'BAR_CHART_HORIZONTAL',
      'SANKEY_DIAGRAM',
      'RADAR_CHART',
      'AREA_CHART',
      'CANDLESTICK_CHART',
      'HEATMAP_GRID',
      'CANDLESTICK_HERO',
      'CANDLESTICK_PATTERN_ANNOTATED',
      'POSITION_CONCENTRATION_TREEMAP',
      'MAP_DATA_OVERLAY',
      'EARNINGS_HEAT_TABLE',
      'PORTFOLIO_BAR_RACE',
      'INSTITUTIONAL_FLOW_SANKEY',
    ].includes(style)
  ) {
    return 'background';
  }
  return 'top';
}

function buildFallback(strategy: StrategyDecision, format: FormatDecision, constraints: CarouselConstraints | undefined): SlideSpec[] {
  const count = format.slideCount;
  const eyebrow = FALLBACK_EYEBROWS[format.formatType] ?? 'KEY INSIGHT:';
  const baseVariants = FALLBACK_VISUAL_VARIANTS[format.formatType] ?? FALLBACK_VISUAL_VARIANTS.PHOTOREALISTIC_NEWS_FLASH;
  const excluded = new Set(constraints?.excludedStyles ?? []);

  const HUMAN_STYLES = new Set<ViralStyle>([
    'POP_CULTURE_PORTRAIT',
    'CARICATURE_PORTRAIT',
    'EXPERT_CUTOUT',
    'TRADER_DESK_SILHOUETTE',
    'EXECUTIVE_LINEUP',
    'LEADER_LOGO_CUTOUTS',
    'EDITORIAL_REACTION_CARICATURE',
    'CIRCULAR_PORTFOLIO_WHEEL',
    'PORTFOLIO_DOUGHNUT_PORTRAIT',
  ]);

  const maxHuman = constraints?.maxHumanSlides ?? 2;
  const maxHumanFirst3 = constraints?.maxHumanInFirst3 ?? 1;

  let humanCount = 0;
  let humanInFirst3 = 0;

  const chosenStyles: ViralStyle[] = [];

  const isValidChoice = (style: ViralStyle, isFirst3: boolean): boolean => {
    if (chosenStyles.includes(style)) return false;
    if (excluded.has(style)) return false;

    const isHuman = HUMAN_STYLES.has(style);
    if (isHuman) {
      if (humanCount >= maxHuman) return false;
      if (isFirst3 && humanInFirst3 >= maxHumanFirst3) return false;
    }
    return true;
  };

  // 1. Choose Cover Style
  let coverStyle: ViralStyle = baseVariants[0] ?? 'ARCHITECTURAL_OVERLAY';
  if (excluded.has(coverStyle)) {
    coverStyle = (baseVariants.find((v) => !excluded.has(v)) || 'ARCHITECTURAL_OVERLAY') as ViralStyle;
  }
  chosenStyles.push(coverStyle);
  if (HUMAN_STYLES.has(coverStyle)) {
    humanCount++;
    humanInFirst3++;
  }

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
    visualStyle: coverStyle,
    visualPosition: getNaturalPositionForStyle(coverStyle),
    mood: format.visualTone,
    narrativeNote: 'Cover hook',
  });

  // 2. Choose Middle Styles
  for (let i = 2; i < count; i++) {
    const isFirst3 = i <= 3;
    let style = baseVariants.find((v) => isValidChoice(v, isFirst3));

    if (!style) {
      style = ROTATION_ALLOWLIST.find((v) => isValidChoice(v, isFirst3));
    }

    if (!style) {
      style = ROTATION_ALLOWLIST.find((v) => !chosenStyles.includes(v) && !excluded.has(v));
    }

    if (!style) {
      style = 'ARCHITECTURAL_OVERLAY';
    }

    chosenStyles.push(style);
    if (HUMAN_STYLES.has(style)) {
      humanCount++;
      if (isFirst3) humanInFirst3++;
    }

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
      visualStyle: style,
      visualPosition: getNaturalPositionForStyle(style),
      mood: format.visualTone,
      narrativeNote: `Slide ${i} of the breakdown`,
    });
  }

  // 3. Choose CTA Style
  let ctaStyle: ViralStyle = 'PREMIUM_CTA';
  if (excluded.has(ctaStyle) || chosenStyles.includes(ctaStyle)) {
    ctaStyle = (ROTATION_ALLOWLIST.find(
      (v) => ['LUXURY_LIFESTYLE', 'VAULT_SECURITY', 'ARCHITECTURAL_OVERLAY'].includes(v) && !chosenStyles.includes(v),
    ) || 'PREMIUM_CTA') as ViralStyle;
  }
  chosenStyles.push(ctaStyle);

  slides.push({
    slideNumber: count,
    role: 'cta',
    headline: 'FOLLOW FOR DAILY INSIGHTS',
    headlineColorMap: [
      { text: 'FOLLOW FOR', color: 'primary' },
      { text: 'DAILY INSIGHTS', color: 'accent1' },
    ],
    subtext: 'Canadian finance, no hype — @thestatsandstacks',
    visualStyle: ctaStyle,
    visualPosition: getNaturalPositionForStyle(ctaStyle),
    mood: 'confident and inviting',
    narrativeNote: 'CTA — drive follows and saves',
  });

  return slides;
}
