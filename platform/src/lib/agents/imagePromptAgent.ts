import { BaseAgent } from './interfaces';
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import type { SlideSpec } from './slideNarrativeAgent';
import type { FormatDecision } from './formatStyleAgent';
import type { StrategyDecision } from './contentStrategyAgent';
import type { CarouselConstraints } from './carouselConstraintAgent';
import type { ContentHistoryEntry } from '../services/contentHistory';
import { PROMPT_LIBRARY, type ViralStyle } from './promptLibrary';
import { recommendModelForStyle, modelRecommendationLabel } from './modelRecommendation';
import { TickerLogoAgent } from './tickerLogoAgent';

export interface SlideImagePrompt {
  slideNumber: number;
  role: SlideSpec['role'];
  slideTitle: string;
  geminiPrompt: string;
  recommendedModel: 'seedance' | 'chatgpt_image' | 'either';
  recommendedModelLabel: string;
  canvaFallbackSuggested: boolean;
  canvaFallbackData?: string;
}

export interface ImagePromptSet {
  slides: SlideImagePrompt[];
}

const CANVA_FALLBACK_STYLES: ViralStyle[] = [
  'EARNINGS_HEAT_TABLE',
  'INSTITUTIONAL_FLOW_SANKEY',
  'PORTFOLIO_BAR_RACE',
];

const PREMIUM_POLISH_KIT = `
PREMIUM POLISH (always apply):
- Lighting: pick one — Rembrandt rim (portraits), Kino softbox (product), hard rim + atmospheric smoke (action), golden-hour window light (lifestyle).
- Camera vocabulary: Hasselblad H6D-100c f/2.8 (portrait), ARRI Alexa 65 anamorphic (cinematic), Phase One IQ4 (editorial product).
- Film emulation: Kodak Portra 400 (warm lifestyle), Cinestill 800T (night/neon), Ilford HP5 (BW gravitas).
- Materials named, never generic: brushed titanium, polished Calacatta marble, oxidized brass, raw concrete, smoked oak.

NEGATIVE PROMPT (avoid in every render):
- No purple-blue gradient backgrounds.
- No centered hero plus glowing CTA button cliché.
- No glassmorphism panels.
- No stock-photo corporate handshakes.
- No AI-hand artifacts (deformed fingers).
- No floating geometric blobs.
- No emoji decoration.
- No Midjourney or Stable Diffusion CLI flags (--ar, --style, --v, --s) — they break Seedance and ChatGPT image gen.
`.trim();

const COVER_PREMIUM_PLAYBOOK = `
COVER SLIDE PREMIUM PLAYBOOK (apply to role === 'cover'):
- One subject, dead-center or rule-of-thirds-left.
- If a data point is the hero, render the number AS the visual (e.g. "+18.2%" fills 70% of canvas).
- At least 40% negative space.
- Single accent color, single light source — multi-color covers read as AI slop.
- Eyebrow label as top-left "tag" — 8-12pt, uppercase, letter-spacing tracked +200.
- 7:1 contrast minimum, light-on-dark preferred for feed thumb-stop.
`.trim();

const WATERMARK_LINE = 'Lower-edge brand mark: along the bottom 60 pixels of the canvas, left-aligned with 48px padding, render the single line "@thestatsandstacks" in clean modern geometric sans-serif, all lowercase, 28pt, white at 90% opacity. No icon, no logo glyph, no border above or below. Pure typography only. Spelling must be exact.';

const FINANCIAL_TEXT_RENDERING = `
FINANCIAL TEXT RENDERING (apply when slide contains numbers or chart):
- Anchor numbers early in the visual description, quote them literally (e.g. the exact figure "$2.4B").
- Specify font class per text element: monospaced sans-serif for tickers/prices, bold sans-serif for headlines, elegant serif for pull-quotes.
- One hero number per slide. Multiple numbers must live in a table/grid where structure protects text.
- Negative-prompt the failures: "no extra digits, no duplicated numerals, no spelling errors, no random floating letters."
- Use recognized-template anchors when relevant: "Bloomberg terminal," "FT print infographic," "TradingView capture," "WSJ chart."
- Do not ask for tiny gridline labels. Label 3-4 gridlines max; leave the rest unlabeled.
- Visual-stands-alone clause: if any chart text rendering fails, the composition's color, structure, and shape alone must still communicate the direction (up/down/concentration/flow).
`.trim();

export class ImagePromptAgent extends BaseAgent {
  private tickerLogoAgent = new TickerLogoAgent();

  constructor() {
    super('ImagePromptAgent');
  }

  async execute(input: {
    slides: SlideSpec[];
    format: FormatDecision;
    strategy?: StrategyDecision;
    constraints?: CarouselConstraints;
    recentHistory?: ContentHistoryEntry[];
    tickerSymbols?: string[];
  }): Promise<ImagePromptSet> {
    console.log(`[${this.name}] 🎨 Composing dynamic visual prompts for ${input.slides.length} slides...`);

    const generatedPromptsMap = new Map<number, string>();

    try {
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({ model: getGeminiTextModelName() });
      const promptText = buildLlmPrompt(input);
      const result = await model.generateContent(promptText);
      const response = await result.response;
      const text = response.text().trim();
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const parsed = JSON.parse(cleaned) as {
        slides: Array<{ slideNumber: number; visualDescription: string }>;
      };

      if (Array.isArray(parsed.slides)) {
        for (const item of parsed.slides) {
          if (item && typeof item.slideNumber === 'number' && typeof item.visualDescription === 'string') {
            generatedPromptsMap.set(item.slideNumber, item.visualDescription);
          }
        }
      }
    } catch (err) {
      console.warn(
        `[${this.name}] Gemini prompt generation failed; using fallback templates.`,
        err instanceof Error ? err.message : String(err),
      );
    }

    const slides = input.slides.map((slide) => {
      let visualDescription = generatedPromptsMap.get(slide.slideNumber);
      if (!visualDescription) {
        visualDescription = buildFallbackVisualDescription(slide, input.format, input.constraints);
      }

      const compiledPrompt = compilePromptString(slide, visualDescription, input.format, input.constraints);
      const recommended = recommendModelForStyle(slide.visualStyle);
      const canvaFallback = CANVA_FALLBACK_STYLES.includes(slide.visualStyle);
      const canvaFallbackData = canvaFallback ? buildCanvaFallbackData(slide, input.tickerSymbols ?? []) : undefined;

      return {
        slideNumber: slide.slideNumber,
        role: slide.role,
        slideTitle: slide.role.toUpperCase().replace(/_/g, ' '),
        geminiPrompt: compiledPrompt,
        recommendedModel: recommended,
        recommendedModelLabel: modelRecommendationLabel(recommended),
        canvaFallbackSuggested: canvaFallback,
        canvaFallbackData,
      };
    });

    return { slides };
  }
}

function buildLlmPrompt(input: {
  slides: SlideSpec[];
  format: FormatDecision;
  strategy?: StrategyDecision;
  constraints?: CarouselConstraints;
  recentHistory?: ContentHistoryEntry[];
  tickerSymbols?: string[];
}): string {
  const topic = input.strategy?.topic || 'Canadian Personal Finance';
  const hook = input.strategy?.hook || '';
  const formatType = input.format.formatType;
  const tone = input.format.visualTone;
  const colors = `bg=${input.format.colorScheme.bg}, accent1=${input.format.colorScheme.accent1}, accent2=${input.format.colorScheme.accent2}`;

  const slidesJson = input.slides.map((s) => ({
    slideNumber: s.slideNumber,
    role: s.role,
    headline: s.headline,
    subtext: s.subtext || '',
    dataPoint: s.dataPoint || '',
    suggestedStyle: s.visualStyle,
  }));

  const recentBlock = buildRecentMemoryBlock(input.recentHistory ?? []);

  const portraitSection = input.constraints?.portraitSelection
    ? `PORTRAIT (use as written; do NOT substitute another person):\n- Tier ${input.constraints.portraitSelection.tier}\n- Subject slug: ${input.constraints.portraitSelection.slug}\n- Render description: "${input.constraints.portraitSelection.promptHint}"`
    : 'PORTRAIT: none required for this carousel.';

  const ctaSection = input.constraints
    ? `CTA SHAPE (final slide must reinforce this):\n- ctaId: ${input.constraints.ctaId}\n- impact: ${input.constraints.ctaCarouselImpactNote}${input.constraints.payoffSlideIndex ? `\n- payoffSlideIndex: ${input.constraints.payoffSlideIndex}` : ''}`
    : '';

  const tickerLogoSection = buildTickerLogoSection(input.tickerSymbols ?? []);

  const styleReference = Object.entries(PROMPT_LIBRARY)
    .filter(([style]) => !['POP_CULTURE_PORTRAIT', 'FLUID_LIQUID_TEXT', 'BILLBOARD_HIGHWAY', 'GRUNGE_STREET_POSTER', 'GLASSMORPHISM_UI'].includes(style))
    .map(([style, desc]) => `- ${style}: ${desc}`)
    .join('\n');

  return `You are a world-class creative director and AI image prompt expert for "TheStatsAndStacks", a premium Canadian personal finance brand on Instagram. The user pastes these prompts into Seedance and ChatGPT image gen (NOT Midjourney, NOT Stable Diffusion).

TODAY'S POST CONTEXT:
- TOPIC: ${topic}
- HOOK: ${hook}
- FORMAT: ${formatType}
- VISUAL TONE: ${tone}
- PALETTE: ${colors}

${recentBlock}

${portraitSection}

${ctaSection}

${tickerLogoSection}

SLIDE SPECS:
${JSON.stringify(slidesJson, null, 2)}

YOUR MISSION:
Write a unique, context-specific visual description for the main visual of each slide. Each description must be directly tailored to the slide's headline, role, and the overall daily topic.

PROMPT DESIGN RULES:
1. PORTRAIT SUBSTITUTION RULE: Every PROMPT_LIBRARY template that mentions a real person (e.g., "Cathie Wood", "Donald Trump", "Elon Musk", "Jensen Huang", etc.) is illustrative ONLY. Replace ANY named person in the templates with the portrait subject given in the PORTRAIT section above. Never reuse a named person from the template examples.
2. CUSTOMIZE SUBJECTS & LOGOS:
   - For office scenes, describe the target company's logo from the TICKER LOGO section.
   - For executive portraits, use the portrait section's subject description.
   - For aerospace/defense topics, describe specific assets (sleek hypersonic cruise missile flying with cinematic heat trails).
   - For political/macro topics, the portrait section names who to render.
3. INCORPORATE SUGGESTED STYLES from the style reference list, mapping each slide's suggestedStyle to its template, then customize. Replace [accent1]/[accent2]/[bg] with the palette hex codes. Replace [portraitSubject]/[portraitDescription] with the portrait section description. Replace [stock]/[price]/[pct] from slide data.
4. SEQUENCE-AWARE VARIETY: alternately rotate camera angles, compositions, and subject classes across slides. No two adjacent slides should share a visualStyle or share the same dominant subject class (portrait, chart, building, metaphor, typography).
5. NO IN-IMAGE TEXT OR LOGOS THAT THE CODE WILL ADD: do not describe overlapping text, random floating letters, headline labels, or watermarks in your visual descriptions. The compiler appends text-overlay instructions separately.
6. ANTI-MIDJOURNEY RULE: Do NOT include Midjourney/SD CLI flags like --ar 4:5, --style raw, --v 6.0, --s 200. These break Seedance and ChatGPT image gen. They must not appear in your output.
7. PREMIUM CTA SLIDE RULE: For the final slide (role: cta), construct a highly premium cinematic scene matching the CTA SHAPE above (executive boardroom for save_specific, story-poll display for story_vote, etc.). Never describe simple checklists or flat backgrounds for the CTA.

${PREMIUM_POLISH_KIT}

${FINANCIAL_TEXT_RENDERING}

STYLE REFERENCE (use as guides, customize per slide; never copy named subjects from these — substitute the PORTRAIT section's subject):
${styleReference}

Return ONLY valid JSON matching this exact schema (no markdown, no code fences):
{
  "slides": [
    {
      "slideNumber": number,
      "visualDescription": "The complete, highly detailed prompt starting with the main subject, written for Seedance or ChatGPT image gen. No Midjourney flags."
    }
  ]
}`;
}

function buildRecentMemoryBlock(recent: ContentHistoryEntry[]): string {
  if (recent.length === 0) return 'RECENT MEMORY: no prior posts (cold start).';
  const last10 = recent.slice(-10);
  const styles = unique(last10.flatMap((e) => (e.coverVisualStyle ? [e.coverVisualStyle] : [])));
  const portraits = unique(last10.flatMap((e) => e.portraitSubjects ?? []));
  const archetypes = unique(last10.flatMap((e) => e.archetypesUsed ?? []));
  const tickers = unique(last10.flatMap((e) => e.tickersFeatured ?? []));
  return `RECENT MEMORY (avoid reusing these in this carousel):
- Recent cover styles: ${styles.join(', ') || 'none'}
- Recent portrait subjects: ${portraits.join(', ') || 'none'}
- Recent archetypes used: ${archetypes.join(', ') || 'none'}
- Recent tickers featured: ${tickers.join(', ') || 'none'}`;
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function buildTickerLogoSection(tickerSymbols: string[]): string {
  if (tickerSymbols.length === 0) return 'TICKER LOGOS: none required.';
  const agent = new TickerLogoAgent();
  const resolved = agent.resolveMany(tickerSymbols).filter((r) => r.entry);
  if (resolved.length === 0) return 'TICKER LOGOS: none in static map.';
  const lines = resolved.map((r) => `- ${r.ticker} (${r.entry!.companyName}): ${r.entry!.markStyle} in brand color ${r.entry!.brandColorHex}`);
  return `TICKER LOGOS (render exactly as described — do not invent alternate brand marks):\n${lines.join('\n')}`;
}

function buildFallbackVisualDescription(slide: SlideSpec, format: FormatDecision, constraints?: CarouselConstraints): string {
  const { colorScheme } = format;
  const templateKey = pickFallbackStyle(slide.visualStyle, constraints);
  const template = PROMPT_LIBRARY[templateKey];

  const portraitDescription = constraints?.portraitSelection?.promptHint ?? 'a sharp 50-something portfolio manager with silver hair, navy chalk-stripe suit, no tie';
  const stock = (slide.dataPoint && /[A-Z]{2,5}/.test(slide.dataPoint)) ? slide.dataPoint.match(/[A-Z]{2,5}/)![0] : 'a major company';

  return template
    .replace(/\[accent1\]/g, colorScheme.accent1)
    .replace(/\[accent2\]/g, colorScheme.accent2)
    .replace(/\[bg\]/g, colorScheme.bg)
    .replace(/\[portraitSubject\]/g, constraints?.portraitSelection?.displayName ?? 'a senior portfolio manager')
    .replace(/\[portraitDescription\]/g, portraitDescription)
    .replace(/\[stock\]/g, stock)
    .replace(/\[price\]/g, slide.dataPoint ?? 'price')
    .replace(/\[pct\]/g, slide.dataPoint ?? 'change')
    .replace(/\[text\]/g, slide.headline);
}

function pickFallbackStyle(suggested: ViralStyle, constraints?: CarouselConstraints): ViralStyle {
  if (constraints?.excludedStyles.includes(suggested)) {
    const alt = constraints.chartHeroSuggestion && !constraints.excludedStyles.includes(constraints.chartHeroSuggestion)
      ? constraints.chartHeroSuggestion
      : constraints.chartSupportingSuggestions.find((s) => !constraints.excludedStyles.includes(s));
    if (alt) return alt;
    return 'ARCHITECTURAL_OVERLAY';
  }
  if (PROMPT_LIBRARY[suggested]) return suggested;
  return 'ARCHITECTURAL_OVERLAY';
}

function compilePromptString(
  slide: SlideSpec,
  visualDescription: string,
  format: FormatDecision,
  constraints?: CarouselConstraints,
): string {
  const { colorScheme } = format;
  const textElements: string[] = [];
  if (slide.eyebrow) textElements.push(`a small uppercase eyebrow label reading "${slide.eyebrow}"`);
  if (slide.headline) textElements.push(`a massive headline reading "${slide.headline}"`);
  if (slide.subtext) textElements.push(`a clean supporting line reading "${slide.subtext}"`);
  if (slide.dataPoint) textElements.push(`a hero data figure reading "${slide.dataPoint}"`);

  const textProse = textElements.length > 0
    ? `Render the following exact text, perfectly spelled with no extra characters: ${textElements.join('; ')}.`
    : '';

  const isCoverSlide = slide.role === 'cover';
  const coverDirective = isCoverSlide ? `\n\n${COVER_PREMIUM_PLAYBOOK}` : '';

  const isChartData = ['chart_data', 'data', 'shock_stat'].includes(slide.role);
  const chartGuidance = isChartData ? `\n\n${FINANCIAL_TEXT_RENDERING}` : '';

  const sceneDescription = `${visualDescription} The composition uses ${colorScheme.bg} as the dominant background hue with clean dark-mode gradients and cinematic studio lighting calibrated to the visual element above.`;

  return [
    `Create a 1080x1350 portrait Instagram image for Seedance or ChatGPT image gen (NOT Midjourney — do not include --ar, --style, --v, or --s flags).`,
    `Visual element: ${sceneDescription}`,
    textProse,
    WATERMARK_LINE,
    `Constraints: High-end professional rendering, perfect spelling, legible typography, no overlapping letters, no extra borders or watermarks beyond the lower-edge brand mark.`,
    coverDirective,
    chartGuidance,
  ].filter((line) => line && line.trim().length > 0).join('\n\n');
}

function buildCanvaFallbackData(slide: SlideSpec, tickerSymbols: string[]): string {
  const lines: string[] = [];
  if (slide.headline) lines.push(`Headline: ${slide.headline}`);
  if (slide.subtext) lines.push(`Subtext: ${slide.subtext}`);
  if (slide.dataPoint) lines.push(`Data Point: ${slide.dataPoint}`);
  if (tickerSymbols.length > 0) lines.push(`Tickers: ${tickerSymbols.join(', ')}`);
  lines.push('(If the generated chart text garbles, regenerate visual-only and overlay this data in Canva.)');
  return lines.join('\n');
}
