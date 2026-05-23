import type { SlideSpec } from './slideNarrativeAgent';
import type { FormatDecision } from './formatStyleAgent';
import type { StrategyDecision } from './contentStrategyAgent';

export interface SlideImagePrompt {
  slideNumber: number;
  role: SlideSpec['role'];
  slideTitle: string;
  geminiPrompt: string;
}

export interface ImagePromptSet {
  slides: SlideImagePrompt[];
}

export class ImagePromptAgent {
  execute(input: {
    slides: SlideSpec[];
    format: FormatDecision;
    strategy: StrategyDecision;
  }): ImagePromptSet {
    const total = input.slides.length;
    return {
      slides: input.slides.map(slide => buildPrompt(slide, input.format, total)),
    };
  }
}

function buildPrompt(slide: SlideSpec, format: FormatDecision, total: number): SlideImagePrompt {
  const { colorScheme, formatType } = format;
  const counter = `${slide.slideNumber}/${total}`;
  const textZonePercent = slide.visualPosition === 'background' ? 65 : 50;
  const visualZoneLabel = slide.visualPosition === 'top'
    ? `upper ${100 - textZonePercent}% of canvas`
    : slide.visualPosition === 'background'
    ? 'full canvas, behind everything else, opacity 25-35%'
    : `${slide.visualPosition} half of canvas`;

  const textLines: string[] = [];

  if (slide.eyebrow) {
    textLines.push(
      `- EYEBROW: Render "${slide.eyebrow}" in ${colorScheme.accent2}, bold condensed sans-serif, ` +
      `~45px, centered, wide letter-spacing, positioned at top of text zone`
    );
  }

  if (slide.headlineColorMap.length > 0) {
    const colorParts = slide.headlineColorMap.map(part => {
      const hex = part.color === 'accent1' ? colorScheme.accent1
                : part.color === 'accent2' ? colorScheme.accent2
                : colorScheme.primaryText;
      return `"${part.text}" in ${hex}`;
    });
    textLines.push(
      `- HEADLINE: ${colorParts.join(', then ')} — bold condensed Impact-style sans-serif, ` +
      `~100-120px, centered, stacked in 1-2 lines, tight line-height`
    );
  } else {
    textLines.push(
      `- HEADLINE: "${slide.headline}" in ${colorScheme.primaryText}, bold condensed Impact-style sans-serif, ~110px, centered`
    );
  }

  if (slide.dataPoint) {
    textLines.push(
      `- DATA POINT (visual centerpiece): "${slide.dataPoint}" in ${colorScheme.accent1}, ` +
      `ultra-bold condensed, ~140-160px, centered — make this the most visually dominant element`
    );
  }

  if (slide.subtext) {
    textLines.push(
      `- SUBTEXT: "${slide.subtext}" in ${colorScheme.primaryText}, regular weight, ~48px, centered, below headline`
    );
  }

  const bgDetail = BACKGROUND_DETAILS[formatType] ?? 'minimal texture, clean and dark';

  const prompt = [
    `Create a 1080x1350 portrait Instagram image. This is slide ${counter} of a ${formatType} finance carousel.`,
    ``,
    `BACKGROUND: Fill entire canvas with ${colorScheme.bg}. ${bgDetail}.`,
    ``,
    `VISUAL ELEMENT (${visualZoneLabel}):`,
    slide.visualElement,
    `Style: photorealistic editorial illustration or high-quality cinematic render. Mood: ${slide.mood}.`,
    `Important: do not render any text inside this visual element area.`,
    ``,
    `TEXT ZONE (lower ${textZonePercent}% of canvas, centered horizontally, stacked vertically):`,
    ...textLines,
    ``,
    `GRADIENT OVERLAY: Apply a dark gradient from ${100 - textZonePercent - 10}% canvas height to the bottom edge, `,
    `color ${colorScheme.bg}, opacity 80-88%, ensuring all text above is fully legible against the visual element.`,
    ``,
    `BRAND ELEMENTS:`,
    `- Bottom-left corner: small upward bar-chart icon (30x30px) + text "@thestatsandstacks" in white (#FFFFFF), 26px, 28px margin from edges`,
    `- Top-right corner: slide counter "${counter}" in white (#FFFFFF), 22px, 28px margin from edges`,
    `- Top-left corner: small filled square in ${colorScheme.accent1}, 36x36px, 28px margin, acts as brand color mark`,
    ``,
    `STRICT RULES:`,
    `- Render ALL text exactly as specified above — every word, every color. Numbers must be pixel-perfect.`,
    `- Use ONLY these hex colors: bg=${colorScheme.bg}, text=${colorScheme.primaryText}, accent1=${colorScheme.accent1}, accent2=${colorScheme.accent2}, white=#FFFFFF.`,
    `- Do not add any other text, borders, watermarks, UI elements, or decorations beyond what is listed.`,
    `- Overall mood: ${slide.mood}.`,
  ].join('\n');

  return {
    slideNumber: slide.slideNumber,
    role: slide.role,
    slideTitle: slide.role.toUpperCase().replace(/_/g, ' '),
    geminiPrompt: prompt,
  };
}

const BACKGROUND_DETAILS: Record<string, string> = {
  BREAKING_NEWS:        'Subtle upward-trending green candlestick chart pattern barely visible in upper 25%, opacity 8%',
  HUMOR_MEME:           'Very faint diagonal speed lines, comic-book texture, opacity 5%',
  DATA_SHOCK:           'Faint circuit-board or data-grid pattern, opacity 6%',
  CEO_AUTHORITY:        'Subtle radial gradient from center lighter outward, spotlight feel, opacity 12%',
  EDUCATIONAL_CAROUSEL: 'Clean geometric grid lines at 15° angle, very subtle, opacity 4%',
  HOT_TAKE:             'Deep red gradient bleeding from bottom-right, opacity 18%',
  MARKET_SCOREBOARD:    'Matrix-style faint falling number columns, opacity 5%',
  MYTH_VS_FACT:         'Subtle split-tone: slightly warmer left half, cooler right half, opacity 7%',
};
