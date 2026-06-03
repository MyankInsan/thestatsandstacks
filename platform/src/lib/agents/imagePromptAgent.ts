import { BaseAgent } from './interfaces';
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import type { SlideSpec } from './slideNarrativeAgent';
import { isLightBackground, type FormatDecision } from './formatStyleAgent';
import type { StrategyDecision } from './contentStrategyAgent';
import type { CarouselConstraints } from './carouselConstraintAgent';
import type { ContentHistoryEntry } from '../services/contentHistory';
import { PROMPT_LIBRARY, type ViralStyle } from './promptLibrary';
import { recommendModelForStyle, modelRecommendationLabel } from './modelRecommendation';
import { TickerLogoAgent } from './tickerLogoAgent';
import type { StoryboardContinuity } from './visualPlanAgent';

export interface SlideImagePrompt {
  slideNumber: number;
  role: SlideSpec['role'];
  slideTitle: string;
  geminiPrompt: string;
  recommendedModel: 'seedance' | 'chatgpt_image' | 'either';
  recommendedModelLabel: string;
  canvaFallbackSuggested: boolean;
  canvaFallbackData?: string;
  /** Stable fingerprint of the compiled prompt — used for same-day reuse guards. */
  promptFingerprint: string;
}

export function promptFingerprint(prompt: string): string {
  let h = 0;
  for (let i = 0; i < prompt.length; i++) h = ((h << 5) - h + prompt.charCodeAt(i)) | 0;
  return `pf_${Math.abs(h).toString(36)}`;
}

export interface ImagePromptSet {
  slides: SlideImagePrompt[];
}

const CANVA_FALLBACK_STYLES: ViralStyle[] = [
  'EARNINGS_HEAT_TABLE',
  'INSTITUTIONAL_FLOW_SANKEY',
  'PORTFOLIO_BAR_RACE',
  'REDDIT_POST_SCREENSHOT',
  'TWEET_STOCK_CHART_SPLIT',
  'EDITORIAL_STAT_CARD',
];

/**
 * Several PROMPT_LIBRARY templates describe a SPECIFIC scene (Gulfstream + Rolex,
 * Wall Street building, tech corporate office). When the same template fires
 * on multiple slides, image gen renders the same scene N times. The fix:
 * for each "scene-literal" style, define N distinct scene variants and rotate
 * deterministically per slide so the carousel feels varied even when the
 * underlying style category repeats.
 */
// Refreshed lifestyle/storytelling scenes — premium and cinematic, but anchored
// in real life, time and patience rather than the tired wealth-flex monoculture
// (jet + Rolex + yacht + Patek + Bentley). No brand-name watches/jets/yachts.
const LUXURY_SCENE_VARIANTS = [
  { setting: 'in a sunlit minimalist home office at dawn, warm light spilling across a pale oak desk and linen curtains', hero: 'a single ceramic pour-over coffee beside a worn cloth-bound book left open mid-page', light: 'soft low-angle morning sun, long gentle shadows, Kodak Portra 400 warmth' },
  { setting: 'in a quiet modern study at blue hour, a wall of matte bookshelves softly out of focus behind', hero: 'a fountain pen resting on a half-written page of cotton-grain paper beside a low brass lamp', light: 'a single warm desk lamp pooling amber light against cool twilight from the window' },
  { setting: 'on a private rooftop terrace at golden hour with a softly blurred city skyline far below', hero: 'a small espresso cup and a pair of reading glasses on a weathered concrete ledge', light: 'low golden-hour glow, gentle haze, subtle natural lens flare' },
  { setting: 'in a warm modernist kitchen with morning light filtering through sheer blinds', hero: 'a hand placing a single coin into a heavy glass jar already half-full of coins', light: 'bright diffuse morning light, shallow depth of field, soft warm tones' },
  { setting: 'by a moving train window at dawn, soft landscape motion blur outside, calm muted interior', hero: 'a phone held in one hand showing a long, steady upward line, a paper coffee cup on the tray table', light: 'cool dawn light from the window mixing with warm interior tungsten' },
  { setting: 'at a simple wooden desk in a lakeside cabin in autumn, a window framing still water and turning leaves', hero: 'an old film photograph propped beside a modern smartphone — a quiet then-and-now contrast', light: 'soft overcast daylight, calm muted palette, Cinestill warmth' },
];

const ARCHITECTURE_SCENE_VARIANTS = [
  { setting: 'the NYSE building facade with its iconic Greek columns shot from a low angle at golden hour', mood: 'institutional gravitas, classic Wall Street', region: 'US' },
  { setting: 'the Bay Street skyline of Toronto at dusk with RBC tower in focus, glass and steel reflecting orange clouds', mood: 'Canadian financial district, contemporary corporate', region: 'CA' },
  { setting: 'the Bank of Canada building in Ottawa, Brutalist concrete and stone facade with deep shadows', mood: 'central-bank authority, restrained modernism', region: 'CA' },
  { setting: 'a Manhattan glass skyscraper from street level looking up, dramatic vanishing-point perspective', mood: 'vertical ambition, post-modern finance', region: 'neutral' },
  { setting: 'Brookfield Place atrium in Toronto with its arched glass roof, late-afternoon light pouring through', mood: 'high-end corporate, light-filled', region: 'CA' },
  { setting: 'the Federal Reserve facade in Washington DC, marble columns and stone steps shot in early morning light', mood: 'monetary policy gravitas, classical Americana', region: 'US' },
];

const OFFICE_SCENE_VARIANTS = [
  { setting: 'a modern tech HQ open floor — concrete walls, exposed-beam ceilings, sleek monitor banks, smart-casual employees mid-stride', mood: 'Big Tech HQ', region: 'neutral' },
  { setting: 'a quant fund trading floor — wall of curved monitors, dark carpets, headset-wearing analysts at every desk', mood: 'quantitative trading', region: 'neutral' },
  { setting: 'a Canadian Big-5 bank executive floor — oak panels, deep navy carpet, brass fixtures, fitted bankers in dark suits', mood: 'Bay Street old guard', region: 'CA' },
  { setting: 'a hedge fund war room — dual-screen Bloomberg terminals everywhere, leather chairs, dim cinematic lighting', mood: 'macro hedge fund', region: 'neutral' },
  { setting: 'a Shopify-style modern office — bright natural light, plants, exposed brick, casual founder-energy', mood: 'tech scale-up', region: 'neutral' },
  { setting: 'a SoftBank-style VC partner office — minimalist white, single large abstract artwork, glass desk, single founder visitor seat', mood: 'global VC fund', region: 'neutral' },
];

function pickSceneVariant<T>(variants: T[], slideNumber: number, varietySeed: string): T {
  // varietySeed includes the slot so same-day slots don't all collapse onto the
  // same scene (the old hash used only date + slide number, which made three
  // same-day packets end on the identical Gulfstream + Rolex CTA scene).
  const hash = simpleHash(`${varietySeed}-slide-${slideNumber}`) % variants.length;
  return variants[hash];
}

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Returns a scene-variant-substituted version of the PROMPT_LIBRARY template
 * for styles that ship with built-in scene variants. For other styles, returns
 * null and the caller uses the original template.
 */
function getSceneVarySubstitutedTemplate(
  style: ViralStyle,
  slideNumber: number,
  varietySeed: string,
  tickerSymbols?: string[],
  strategyTopic?: string,
): string | null {
  const tickerLogoAgent = new TickerLogoAgent();
  const resolvedTicker = tickerSymbols && tickerSymbols.length > 0 ? tickerLogoAgent.resolve(tickerSymbols[0]) : undefined;

  const isCanadian = strategyTopic ? /canada|canadian|tsx|bay street|\.to\b|cppib|cdpq|tfsa|rrsp|fhsa|cra\b/i.test(strategyTopic) : false;

  if (style === 'LUXURY_LIFESTYLE') {
    const v = pickSceneVariant(LUXURY_SCENE_VARIANTS, slideNumber, varietySeed);
    return `A hyper-realistic, cinematic editorial photograph ${v.setting}. The hero of the composition: ${v.hero}. Lighting: ${v.light}. Shot on Hasselblad H6D-100c, f/2.8, shallow depth of field, premium color grading with deep rich shadows. Pure editorial photography, no AI artifacts.`;
  }
  if (style === 'ARCHITECTURAL_OVERLAY') {
    const pool = isCanadian 
      ? ARCHITECTURE_SCENE_VARIANTS 
      : ARCHITECTURE_SCENE_VARIANTS.filter(v => v.region !== 'CA');
    const v = pickSceneVariant(pool, slideNumber, varietySeed);
    let settingStr = v.setting;
    if (resolvedTicker) {
      settingStr = settingStr.replace(/a corporate headquarters/i, `the modern glass and steel corporate headquarters of ${resolvedTicker.companyName}`);
    }
    return `A cinematic, hyper-realistic, slightly desaturated photograph of ${settingStr}. Mood: ${v.mood}. Sharp architectural lines, premium editorial photography, shot on Phase One IQ4 with a tilt-shift lens. No people, no text overlays — pure architectural geometry.`;
  }
  if (style === 'CORPORATE_OFFICE_SPACE') {
    const pool = isCanadian 
      ? OFFICE_SCENE_VARIANTS 
      : OFFICE_SCENE_VARIANTS.filter(v => v.region !== 'CA');
    const v = pickSceneVariant(pool, slideNumber, varietySeed);
    let logoStr = 'a subtle corporate logo mark';
    if (resolvedTicker) {
      logoStr = `a subtle corporate logo mark of ${resolvedTicker.companyName} (${resolvedTicker.markStyle})`;
    }
    return `A premium, clean editorial photograph of ${v.setting}. Setting mood: ${v.mood}. A concrete wall displays ${logoStr} in the background. Moody studio side-lighting, shot with cinematic depth of field.`;
  }
  return null;
}

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
- No AI-hand artifacts (deformed fingers) — render correct hands with exactly five fingers.
- No floating geometric blobs.
- No emoji decoration.
- Avoid the overused AI-finance clichés unless the topic literally calls for them: no glowing holographic globe/boardroom, no charging bull or bear statue as a generic metaphor, no missile/rocket as a stand-in for "growth", no open bank vault, no Rolex/luxury watch, no whiskey glass, no superyacht/private jet, no single green sprout growing from a pile of gold coins, no generic skyline-desk-with-business-cards.
- Physically correct lighting: real reflections and shadows from a single consistent light source; no plastic or waxy skin; no plastic-looking props.
- No duplicated or warped UI chrome, no repeated/garbled logos, no gibberish micro-text.
- No Midjourney or Stable Diffusion CLI flags (--ar, --style, --v, --s) — they break ChatGPT Images 2.0 and Seedream.
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

const WATERMARK_LINE = 'At the very bottom center of the canvas, render a tiny, elegant, low-profile watermark that reads "@thestatsandstacks" in a clean, modern sans-serif font with wide letter-spacing, integrated subtly into the background so it serves as a sophisticated, non-distracting brand signature.';

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
    dateKey?: string;
    slotIndex?: number;
    storyboard?: StoryboardContinuity;
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

    const dateKey = input.dateKey ?? new Date().toISOString().split('T')[0];
    // Slot-aware seed so same-day slots don't render the identical scene.
    const varietySeed = `${dateKey}-s${input.slotIndex ?? 0}`;

    const slides = input.slides.map((slide) => {
      let visualDescription = getSceneVarySubstitutedTemplate(slide.visualStyle, slide.slideNumber, varietySeed, input.tickerSymbols, input.strategy?.topic);
      if (!visualDescription) {
        visualDescription = generatedPromptsMap.get(slide.slideNumber) ?? null;
      }
      if (!visualDescription) {
        visualDescription = buildFallbackVisualDescription(slide, input.format, input.constraints, varietySeed, input.tickerSymbols);
      }

      const compiledPrompt = compilePromptString(slide, visualDescription, input.format, input.constraints, input.storyboard);
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
        promptFingerprint: promptFingerprint(compiledPrompt),
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
  const isLight = isLightBackground(input.format.colorScheme.bg);
  const colors = `bg=${input.format.colorScheme.bg}, accent1=${input.format.colorScheme.accent1}, accent2=${input.format.colorScheme.accent2}${isLight ? ' (LIGHT MODE)' : ' (DARK MODE)'}`;

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

  return `You are a world-class creative director and AI image prompt expert for "TheStatsAndStacks", a premium Canadian personal finance brand on Instagram. The user pastes these prompts into ChatGPT Images 2.0 (primary) or Seedream (cinematic alternate) — NOT Midjourney, NOT Stable Diffusion.

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

CRITICAL VISUAL DESIGN DIRECTIVES (MUST FOLLOW):
1. NO SIMPLE COPY-PASTE: Do NOT simply copy-paste the templates from the STYLE REFERENCE list and fill in brackets. The templates are ONLY compositional and stylistic references. You must write a completely custom, highly detailed, descriptive paragraph (75-150 words) outlining the core subject, exact setting, complex lighting, tactile textures, and precise layout for EACH slide.
2. PORTRAIT SUBSTITUTION RULE: Every PROMPT_LIBRARY template that mentions a real person (e.g., "Cathie Wood", "Donald Trump", "Elon Musk", "Jensen Huang", etc.) is illustrative ONLY. Replace ANY named person in the templates with the portrait subject given in the PORTRAIT section above. Never reuse a named person from the template examples.
3. SPECIFY MATTE & LUXURY MATERIALS: Explicitly name premium materials in your descriptions: brushed titanium, polished Calacatta marble, oxidized brass, raw concrete, smoked oak, polished walnut, or matte paper with visible cotton grain.
4. SPECIFY COMPLEX LIGHTING & ATMOSPHERE: Describe premium lighting setups: volumetric light rays, warm golden-hour window light, cool twilight mixing with warm desk glow, or Rembrandt rim lighting.
5. SPECIFY HIGH-END CAMERAS & PRIME LENSES: Explicitly write camera settings: "Shot on Hasselblad H6D-100c, f/2.8, shallow depth of field" (for portraits/archetypes), "Phase One IQ4, crisp focus, tilt-shift lens" (for products/infographics), or "ARRI Alexa 65 anamorphic, cinematic color grading, 35mm lens" (for cinematic/metaphors).
6. SEQUENCE-AWARE VARIETY: Alternately rotate camera angles, compositions, and subject classes across slides. No two adjacent slides should share a visualStyle or share the same dominant subject class (portrait, chart, building, metaphor, typography). Ensure the slides look like a cohesive yet diverse set of premium slides.
7. INTEGRATE SEMANTIC TEXT WHEN RELEVANT: If the slide style includes speech bubbles, signs, labels, chart axes, or scoreboard numbers, explicitly describe the exact text that should be rendered inside them (e.g. what a character is saying in a comic strip balloon, or what label is on a folder). Do not use blank templates or empty speech bubbles. (Only avoid describing the main overhead headline, sub-headline overlay, and the bottom "@thestatsandstacks" watermark, which are compiled separately).
8. LIGHT MODE ADAPTATION RULE: If the palette is LIGHT MODE (bg is light, e.g. #F8F9FA), you MUST adapt all templates and descriptions to fit a light, clean, bright aesthetic. Avoid phrases like "pitch-black", "dark room", "dark background", "dark navy", "black matte canvas", or "white text on light". Instead, use "clean light background", "bright room", "light matte canvas", "dark text on light", etc. Ensure high contrast so elements are readable.
9. ZERO-LIMITS ASSUMPTION: Never assume the AI image generation model has limitations or cannot render complex graphics, detailed charts, candlestick patterns, tables, or heavy text. The image generation models (ChatGPT Images 2.0, Seedream) are extremely capable of rendering precise, high-fidelity graphics, patterns, and text, provided the visual description is of supreme quality, highly detailed, and explicitly structured. Write rich, premium, and sophisticated prompts without simplifying the visuals.
10. LAYOUT & TEXT ALIGNMENT: Closely match the visual scene's composition to the slide's visualPosition property:
    - If visualPosition is 'left', place the main graphic/portrait subject on the left 50% of the canvas, leaving the right 50% as empty negative space for text overlays.
    - If visualPosition is 'right', place the main graphic/portrait subject on the right 50% of the canvas, leaving the left 50% as empty negative space for text overlays.
    - If visualPosition is 'center', center the visual subject and describe how text elements should wrap around or integrate below/above it.
    - If visualPosition is 'background', design the scene as a full-bleed texture or backdrop, ensuring there is high contrast and clear legibility for text overlays rendered on top.
    - If visualPosition is 'top', keep the top 30% of the canvas clear and uncluttered for headline text, placing the main visual subject in the lower 70%.

${PREMIUM_POLISH_KIT}

${FINANCIAL_TEXT_RENDERING}

STYLE REFERENCE (use as composition/style guides, customize per slide; never copy named subjects from these — substitute the PORTRAIT section's subject):
${styleReference}

Return ONLY valid JSON matching this exact schema (no markdown, no code fences):
{
  "slides": [
    {
      "slideNumber": number,
      "visualDescription": "The complete, highly detailed prompt starting with the main subject, written for ChatGPT Images 2.0 or Seedream. No Midjourney flags."
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

function getSatiricalConcept(headline: string, subtext: string): string {
  const text = `${headline} ${subtext}`.toLowerCase();
  if (text.includes('tax') || text.includes('cra') || text.includes('audit')) {
    return 'A magnificent, ornate vintage cast-iron tax stamp press with polished brass gears and intricate gold leaf filigree, dramatically crushing a thick, lustrous 24k gold coin into glittering dust on a dark slate surface. Tiny, delicate vintage tax forms with fine copperplate script flutter through the air. Low-key dramatic lighting, sharp focus on the metallic textures, shot on Phase One IQ4, tilt-shift lens, premium editorial aesthetic';
  }
  if (text.includes('housing') || text.includes('house') || text.includes('rent') || text.includes('mortgage')) {
    return 'An exquisite, architecturally complex birdhouse constructed entirely from meticulously stacked, gleaming Canadian Gold Maple Leaf coins, featuring a polished walnut roof and brass perches. The birdhouse sits on a perfectly manicured velvet moss turf under a focused studio spotlight. The background is a soft, dark forest green gradient. Shot on Hasselblad H6D-100c, f/4, crisp details of coin engravings, ultra-premium editorial print style';
  }
  if (text.includes('saving') || text.includes('hisa') || text.includes('gic') || text.includes('cash')) {
    return 'A heavy, monolithic safe crafted from polished black obsidian with a brushed platinum dial and hinges, its door slightly ajar to reveal a single, delicate green seed sprouting a detailed, glowing 24k gold leaf in the center. Volumetric lighting casts a soft amber glow from inside the safe. Smoked oak floor, high contrast, clean minimalist layout, shot on Phase One IQ4, tilt-shift lens';
  }
  if (text.includes('inflation') || text.includes('price') || text.includes('cost')) {
    return 'A highly detailed vintage brass scale where a single pristine coffee bean balances perfectly against a heavy, towering stack of crisp paper bills. The scale is set on a dark, polished mahogany table, with soft morning window light creating long, elegant shadows. Shallow depth of field, warm key light, shot on Hasselblad H6D-100c, f/2.8';
  }
  if (text.includes('debt') || text.includes('credit') || text.includes('loan')) {
    return 'A sleek, minimalist designer hourglass filled with flowing gold dust, where the bottom chamber is slowly turning into a dark, rough-textured concrete block. The hourglass is positioned on a brushed titanium surface under cool studio rim lighting. Cinematic desaturated tones, shot on ARRI Alexa 65 anamorphic, 35mm lens';
  }
  return 'A giant, hand-carved white marble piggy bank wearing a silk top hat and a polished gold monocle, greedily swallowing a tiny, beautifully detailed paper bag of groceries. The piggy bank sits on a sleek obsidian desk with a dark, moody background. Low-key studio side-lighting, high contrast, Vanity Fair caricature style, Phase One IQ4';
}

function getAnimalMetaphor(headline: string, subtext: string): string {
  const text = `${headline} ${subtext}`.toLowerCase();
  if (text.includes('bull') || text.includes('grow') || text.includes('rise') || text.includes('gain')) {
    return 'A majestic, muscular charging bull sculpted entirely from raw, polished green emerald, with its hooves kicking up a fine, shimmering jade dust. The bull charges forward through a dark, smoky studio space with a single glowing green line chart reflecting off its crystalline body. Dramatic rim lighting, high contrast, shot on ARRI Alexa 65, cinematic color grading';
  }
  if (text.includes('bear') || text.includes('fall') || text.includes('drop') || text.includes('crash')) {
    return 'A fierce, roaring grizzly bear sculpted from rough, charcoal-textured volcanic stone with glowing red lava-like veins running across its body. The background is a dark, desaturated space with a single desaturated red line chart fading into the shadows. Intense rim lighting, dramatic high-contrast composition, shot on ARRI Alexa 65 anamorphic';
  }
  if (text.includes('speed') || text.includes('fast') || text.includes('momentum')) {
    return 'A sleek, aerodynamic cheetah crafted from polished black obsidian with glowing 24k gold accents, captured mid-sprint across a dark synthwave grid. Shimmering gold particles streak behind its body, implying high speed. High-speed action, cinematic rim lighting, premium retro-futurist aesthetic, shot on ARRI Alexa 65';
  }
  if (text.includes('safe') || text.includes('protect') || text.includes('secure')) {
    return 'A powerful golden lion resting its paw protectively over a glowing, intricate holographic shield on a dark marble floor. Warm golden-hour light catches the lion\'s mane and reflects off the sleek blue holographic shield. Museum-style spotlighting, deep shadows, Phase One IQ4';
  }
  return 'A majestic white falcon with silver-tipped feathers and sharp brass talons, soaring high above a geometric, desaturated cityscape at sunrise. The soft morning light catches the falcon\'s wings, creating a warm, elegant rim glow. Clean minimalist composition, generous negative space, shot on Phase One IQ4';
}

function getFunnyComparison(headline: string, subtext: string): { left: string; right: string } {
  const text = `${headline} ${subtext}`.toLowerCase();
  if (text.includes('tfsa') || text.includes('rrsp') || text.includes('fhsa')) {
    return {
      left: 'a sleek golden pedestal with a single, highly detailed, glowing golden coin representing a disciplined investor\'s tax-free account. The coin is beautifully engraved with a geometric pattern of compounding lines',
      right: 'a chaotic, burning pile of lottery tickets, crumpled paper, and a tiny plastic toy rocket ship representing a speculative investor\'s reckless portfolio, with smoke rising in the background'
    };
  }
  if (text.includes('hisa') || text.includes('gic')) {
    return {
      left: 'a modern, clean glass vault showing neatly stacked bundles of cash, perfectly protected and organized, lit by a cool blue light',
      right: 'a leaky, water-damaged paper bag filled with rusty coins resting in a puddle of water, representing cash losing value to inflation, lit by a harsh, yellow light'
    };
  }
  return {
    left: 'a sleek golden pedestal with a single, highly detailed, glowing golden coin representing a disciplined investor\'s portfolio, beautifully shot in warm key light',
    right: 'a chaotic, burning pile of lottery tickets, crumpled paper, and a tiny plastic toy rocket ship representing a speculative investor\'s reckless portfolio, shot in cool side-lighting'
  };
}

function getMemeSpeechText(headline: string, subtext: string): { left: string; right: string } {
  const text = `${headline} ${subtext}`.toLowerCase();
  if (text.includes('quantum') || text.includes('ionq')) {
    return {
      left: '"Quantum is ready, it is the future!"',
      right: '"Wait, what is Note 18 in the risk disclosures?"'
    };
  }
  if (text.includes('tfsa') || text.includes('rrsp') || text.includes('fhsa')) {
    return {
      left: '"I will just pick the one with the highest contribution limit!"',
      right: '"Wait, I paid tax on my tax-free account?!"'
    };
  }
  if (text.includes('stock') || text.includes('watchlist') || text.includes('invest')) {
    return {
      left: '"This ticker only goes up, I am going all in!"',
      right: '"Wait, what do you mean by downside risk?!"'
    };
  }
  return {
    left: '"This is a guaranteed winner, no research needed!"',
    right: '"Wait, where did the returns go?"'
  };
}

function buildFallbackVisualDescription(
  slide: SlideSpec,
  format: FormatDecision,
  constraints?: CarouselConstraints,
  dateKey: string = new Date().toISOString().split('T')[0],
  tickerSymbols?: string[],
 ): string {
  const { colorScheme } = format;
  const templateKey = pickFallbackStyle(slide.visualStyle, constraints);
  
  let template = getSceneVarySubstitutedTemplate(templateKey, slide.slideNumber, dateKey, tickerSymbols);
  if (!template) {
    template = PROMPT_LIBRARY[templateKey];
  }

  const isLight = isLightBackground(colorScheme.bg);
  if (isLight) {
    template = template
      .replace(/pitch-black\s+\[bg\]/gi, 'clean [bg]')
      .replace(/dark matte navy background\. White text/gi, 'clean white background. Dark grey text')
      .replace(/on a dark charcoal-textured background/gi, 'on a clean light-textured background')
      .replace(/dark navy background/gi, 'clean light background')
      .replace(/dark background/gi, 'light background')
      .replace(/pitch-black matte canvas/gi, 'light matte canvas')
      .replace(/pitch black background/gi, 'light background')
      .replace(/deep charcoal/gi, 'light grey')
      .replace(/dark room/gi, 'bright room')
      .replace(/darkened room/gi, 'bright room')
      .replace(/dark, smoky space/gi, 'bright, clean space')
      .replace(/dark, moody forest/gi, 'sunlit open forest')
      .replace(/body line in light grey/gi, 'body line in dark grey')
      .replace(/outlines in white/gi, 'outlines in dark grey')
      .replace(/soft dark card/gi, 'soft light card')
      .replace(/Reflective black floor/gi, 'Reflective light floor');
  }

  const portraitDescription = constraints?.portraitSelection?.promptHint ?? 'a sharp 50-something portfolio manager with silver hair, navy chalk-stripe suit, no tie';
  const stock = (slide.dataPoint && /[A-Z0-9\-\.\^]{2,8}/.test(slide.dataPoint)) ? slide.dataPoint.match(/[A-Z0-9\-\.\^]{2,8}/)![0] : 'a major company';

  const satiricalConcept = getSatiricalConcept(slide.headline, slide.subtext ?? '');
  const animalMetaphor = getAnimalMetaphor(slide.headline, slide.subtext ?? '');
  const funnyComparison = getFunnyComparison(slide.headline, slide.subtext ?? '');
  const memeText = getMemeSpeechText(slide.headline, slide.subtext ?? '');

  const sharesMatch = (slide.subtext || slide.headline).match(/\b\d+[\d,]*\s*shares\b/i);
  const shares = sharesMatch ? sharesMatch[0] : '150 shares';

  const totalMatch = (slide.subtext || slide.headline).match(/\$\d+[\d,kKmM]*/);
  const total = totalMatch ? totalMatch[0] : '$15,000';

  const tweetText = slide.subtext || slide.headline;

  const statsList = (slide.subtext || '')
    .split('|')
    .map(s => s.trim())
    .filter(Boolean);
  const stats = statsList.length > 0 
    ? statsList.map(s => `- ${s}`).join('\n') 
    : `- ${slide.subtext || 'compounding returns'}`;

  const tickerLogoAgent = new TickerLogoAgent();
  const resolvedTicker = tickerSymbols && tickerSymbols.length > 0 ? tickerLogoAgent.resolve(tickerSymbols[0]) : undefined;
  const subjectCard = resolvedTicker 
    ? `corporate logo card for ${resolvedTicker.companyName} (${resolvedTicker.markStyle})`
    : `portrait description card for ${portraitDescription}`;

  return template
    .replace(/\[accent1\]/g, colorScheme.accent1)
    .replace(/\[accent2\]/g, colorScheme.accent2)
    .replace(/\[bg\]/g, colorScheme.bg)
    .replace(/\[portraitSubject\]/g, constraints?.portraitSelection?.displayName ?? 'a senior portfolio manager')
    .replace(/\[portraitDescription\]/g, portraitDescription)
    .replace(/\[stock\]/g, stock)
    .replace(/\[price\]/g, slide.dataPoint ?? 'price')
    .replace(/\[pct\]/g, slide.dataPoint ?? 'change')
    .replace(/\[text\]/g, slide.headline)
    .replace(/\[satiricalConcept\]/g, satiricalConcept)
    .replace(/\[animalMetaphor\]/g, animalMetaphor)
    .replace(/\[comparisonLeft\]/g, funnyComparison.left)
    .replace(/\[comparisonRight\]/g, funnyComparison.right)
    .replace(/\[leftText\]/g, memeText.left)
    .replace(/\[rightText\]/g, memeText.right)
    .replace(/\[shares\]/g, shares)
    .replace(/\[total\]/g, total)
    .replace(/\[tweetText\]/g, tweetText)
    .replace(/\[stats\]/g, stats)
    .replace(/\[subjectCard\]/g, subjectCard);
}

function pickFallbackStyle(suggested: ViralStyle, constraints?: CarouselConstraints): ViralStyle {
  if (PROMPT_LIBRARY[suggested]) return suggested;
  return 'ARCHITECTURAL_OVERLAY';
}

export function getTextLayoutDirective(position: SlideSpec['visualPosition']): string {
  switch (position) {
    case 'background':
      return 'Layout structure: Modern print-infographic layout where the main visual reads as a full-bleed background texture. The main visual chart or graphic spans the frame with ample breathing room. The accompanying text overlays are aligned cleanly in a compact, left-aligned editorial block in the top-left quadrant, keeping the rest of the space clear.';
    case 'left':
      return 'Layout structure: Clean vertical split-column layout. The main visual subject is positioned on the left side of the 1080x1350 frame, while the text overlays are aligned cleanly in a vertical column on the right 50% of the frame in spacious negative space.';
    case 'right':
      return 'Layout structure: Clean vertical split-column layout. The main visual subject is positioned on the right side of the 1080x1350 frame, while the text overlays are aligned cleanly in a vertical column on the left 50% of the frame in spacious negative space.';
    case 'center':
      return 'Layout structure: Center-aligned typographic overlay. The main visual subject is centered in the frame. The text overlays are centered and cleanly integrated, either above or below the main subject, maintaining perfect balance and legibility.';
    case 'top':
    default:
      return 'Layout structure: Standard top-third layout. The text elements are positioned cleanly in the top 30% of the canvas in a stacked, centered block. The main visual scene is positioned below, occupying the lower 70% of the canvas.';
  }
}

function compilePromptString(
  slide: SlideSpec,
  visualDescription: string,
  format: FormatDecision,
  constraints?: CarouselConstraints,
  storyboard?: StoryboardContinuity,
): string {
  const { colorScheme } = format;

  const isCover = slide.role === 'cover';
  // Suppress unsupported exact figures: if the narrative flagged the data point
  // as "illustrative" (inferred, not evidence-backed), do not render a precise
  // unverified number — keep the magnitude visual but label it illustrative.
  const suppressExactFigure = /illustrative/i.test(slide.narrativeNote ?? '');
  const textItems: string[] = [];

  if (slide.eyebrow) {
    textItems.push(`a small uppercase eyebrow label reading "${slide.eyebrow}"`);
  }
  
  if (slide.headline) {
    if (isCover) {
      textItems.push(`a massive bold headline reading "${slide.headline}"`);
    } else {
      switch (slide.visualPosition) {
        case 'left':
        case 'right':
          textItems.push(`a prominent, left-aligned bold title reading "${slide.headline}"`);
          break;
        case 'center':
          textItems.push(`a centered bold title reading "${slide.headline}"`);
          break;
        case 'background':
          textItems.push(`a clean, left-aligned title reading "${slide.headline}"`);
          break;
        case 'top':
        default:
          textItems.push(`a bold headline reading "${slide.headline}"`);
          break;
      }
    }
  }

  if (slide.subtext) {
    switch (slide.visualPosition) {
      case 'left':
      case 'right':
        textItems.push(`a clean supporting subtext paragraph reading "${slide.subtext}"`);
        break;
      case 'center':
        textItems.push(`a centered supporting line reading "${slide.subtext}"`);
        break;
      case 'background':
        textItems.push(`a small, clean supporting caption line reading "${slide.subtext}"`);
        break;
      case 'top':
      default:
        textItems.push(`a clean supporting line reading "${slide.subtext}"`);
        break;
    }
  }

  if (slide.dataPoint) {
    textItems.push(
      suppressExactFigure
        ? `an illustrative magnitude indicator (do NOT render the exact unverified figure "${slide.dataPoint}" as a precise number — show it as clearly illustrative)`
        : `a hero data figure reading "${slide.dataPoint}"`,
    );
  }

  let positionPrefix = '';
  switch (slide.visualPosition) {
    case 'left':
      // The visual subject is on the left, so the text overlays should occupy the right side
      positionPrefix = 'Aligned cleanly in a vertical column on the right side of the frame (occupying the right 45% of the canvas), render the following exact text, perfectly spelled with no extra characters:';
      break;
    case 'right':
      // The visual subject is on the right, so the text overlays should occupy the left side
      positionPrefix = 'Aligned cleanly in a vertical column on the left side of the frame (occupying the left 45% of the canvas), render the following exact text, perfectly spelled with no extra characters:';
      break;
    case 'center':
      positionPrefix = 'Centered perfectly in the middle of the frame with generous negative space, render the following exact text, perfectly spelled with no extra characters:';
      break;
    case 'background':
      // Overlaid on top of the background graphic, positioned in a neat corner block to avoid top-heavy look
      positionPrefix = 'Aligned cleanly in a modern, compact editorial block in the top-left quadrant of the frame (leaving the rest of the canvas open for the background viz), render the following exact text elements, perfectly spelled with no extra characters:';
      break;
    case 'top':
    default:
      positionPrefix = 'Positioned cleanly in the top-third of the frame in a stacked block, render the following exact text, perfectly spelled with no extra characters:';
      break;
  }

  const textProse = textItems.length > 0
    ? `${positionPrefix} ${textItems.join('; ')}.`
    : '';

  const isCoverSlide = slide.role === 'cover';
  const isChartData = ['chart_data', 'data', 'shock_stat'].includes(slide.role);

  const isLight = isLightBackground(colorScheme.bg);
  const lightingStyle = isLight
    ? 'clean light-mode studio gradients and bright professional lighting'
    : 'clean dark-mode gradients and cinematic studio lighting';

  const layoutDirective = getTextLayoutDirective(slide.visualPosition);
  const sceneDescription = `${visualDescription} ${layoutDirective} The composition uses ${colorScheme.bg} as the dominant background hue with ${lightingStyle} calibrated to the visual element above.`;

  // Labeled-section prompt packet for ChatGPT Images 2.0 (primary manual target).
  const sections: string[] = [];
  sections.push(`DELIVERABLE\nCreate a 1080x1350 portrait Instagram carousel slide for ChatGPT Images 2.0 (primary) or Seedream for cinematic image-first scenes. Do NOT use Midjourney/Stable Diffusion CLI flags (--ar, --style, --v, --s).`);

  if (storyboard) {
    sections.push(
      `STORYBOARD CONTINUITY\nPremise: ${storyboard.premise}\nThis slide's beat: ${slide.storyboardBeat ?? '—'}\nProgression: ${storyboard.progressionRule}\n` +
      (isCoverSlide
        ? 'This is the ANCHOR slide — generate it FIRST in the conversation; later slides reference this image.'
        : 'Stay coherent with the slide-1 anchor image and the MUST KEEP invariants below.'),
    );
    sections.push(`MUST KEEP (identical across every slide)\n${storyboard.sharedVisualInvariants.map((s) => `- ${s}`).join('\n')}`);
    sections.push(`CHANGE ONLY\n- This slide's subject/scene, data graphic, and the EXACT TEXT below. Keep palette logic, type system, and the brand watermark identical to the anchor.`);
  }

  sections.push(`PURPOSE\n${slide.role.toUpperCase().replace(/_/g, ' ')} slide${slide.narrativeNote ? ` — ${slide.narrativeNote}` : ''}`);
  sections.push(`INFORMATION ARCHITECTURE\n${layoutDirective}`);
  sections.push(`SUBJECT AND SCENE\n${sceneDescription}`);
  if (isCoverSlide) sections.push(`COMPOSITION\n${COVER_PREMIUM_PLAYBOOK}`);
  if (textProse) sections.push(`EXACT TEXT\n${textProse}`);
  sections.push(`WATERMARK\n${WATERMARK_LINE}`);
  if (isChartData) sections.push(`DATA GRAPHIC SPECIFICATION\n${FINANCIAL_TEXT_RENDERING}`);
  sections.push(`STYLE AND MATERIALS\nPremium editorial rendering: ${lightingStyle}; named materials (brushed titanium, polished marble, oxidized brass, raw concrete, smoked oak) over generic surfaces.`);
  sections.push(`NEGATIVE CONSTRAINTS\nHigh-end professional rendering, perfect spelling, legible typography, no overlapping letters, no extra borders, no extra digits or duplicated numerals, no AI-hand artifacts, no watermarks beyond the lower-edge brand mark.${suppressExactFigure ? ' Do NOT print the exact unverified figure as a precise number.' : ''}`);

  return sections.filter((line) => line && line.trim().length > 0).join('\n\n');
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
