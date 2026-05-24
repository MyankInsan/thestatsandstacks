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
    return {
      slides: input.slides.map(slide => buildPrompt(slide, input.format)),
    };
  }
}

function buildPrompt(slide: SlideSpec, format: FormatDecision): SlideImagePrompt {
  const { colorScheme, formatType } = format;
  const slideIndex = slide.slideNumber - 1;
  const layout = LAYOUT_SEQUENCE[slideIndex % LAYOUT_SEQUENCE.length];
  const layoutRules = getLayoutRules(layout, colorScheme.bg);

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
    `Create a 1080x1350 portrait Instagram image. This is a ${formatType} finance carousel slide.`,
    ``,
    `BACKGROUND: Fill entire canvas with ${colorScheme.bg}. ${bgDetail}.`,
    ``,
    `VISUAL ELEMENT (${layoutRules.visualZoneLabel}):`,
    slide.visualElement,
    `Style: Hyper-realistic cinematic photography, shot on 35mm lens, 8k resolution, photorealistic lighting, extremely lifelike. The scene must look like a real photograph, not AI generated. Mood: ${slide.mood}.`,
    `Important: adhere strictly to the visual zone boundaries.`,
    ``,
    `TEXT ZONE (${layoutRules.textZoneLabel}):`,
    ...textLines,
    ``,
    `OVERLAY/BACKGROUND FX: ${layoutRules.overlayRules}`,
    ``,
    `BRAND ELEMENT:`,
    `- Bottom-left corner: a small upward-trending bar-chart icon followed by the text "@thestatsandstacks" — rendered in white, small and subtle, placed near the bottom-left edge`,
    ``,
    `STRICT RULES:`,
    `- Render ALL text exactly as specified above — every word, every color. Numbers must be pixel-perfect.`,
    `- Use ONLY these hex colors: bg=${colorScheme.bg}, text=${colorScheme.primaryText}, accent1=${colorScheme.accent1}, accent2=${colorScheme.accent2}, white=#FFFFFF.`,
    `- Do not add any other text, numbers, labels, counters, borders, watermarks, UI elements, or decorations beyond what is listed above.`,
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
  PHOTOREALISTIC_NEWS_FLASH:        'Cinematic depth of field, dramatic shadows, highly detailed',
  PHOTOREALISTIC_LUXURY_LIFESTYLE:  'Luxury aesthetic, golden hour lighting, rich textures, bokeh effect',
  PHOTOREALISTIC_MARKET_UPDATE:     'High-contrast lighting, glowing screen reflections, sharp focus on foreground',
  PHOTOREALISTIC_EXPERT_SHOCK:      'Studio lighting, moody atmosphere, sharp subject with soft blurred background',
  PHOTOREALISTIC_MINIMAL_TECH:      'Sleek, bright minimal studio background, subtle glass reflections',
};

type LayoutType = 'FULL_BLEED' | 'BOTTOM_SPLIT' | 'TOP_SPLIT' | 'LETTERBOX' | 'LOWER_THIRD' | 'MINIMAL_CARD';

const LAYOUT_SEQUENCE: LayoutType[] = [
  'FULL_BLEED',
  'BOTTOM_SPLIT',
  'TOP_SPLIT',
  'LETTERBOX',
  'LOWER_THIRD',
  'MINIMAL_CARD',
  'BOTTOM_SPLIT',
  'TOP_SPLIT',
  'MINIMAL_CARD'
];

function getLayoutRules(layout: LayoutType, bgHex: string) {
  switch (layout) {
    case 'FULL_BLEED': return {
      visualZoneLabel: 'fills the entire 1080x1350 canvas',
      textZoneLabel: 'centered exactly in the middle of the canvas, overlaid on the photo',
      overlayRules: `Apply a heavy dark vignette around the edges and a subtle 40% darkening over the entire center image so white text is highly legible.`
    };
    case 'BOTTOM_SPLIT': return {
      visualZoneLabel: 'upper 60% of canvas',
      textZoneLabel: 'lower 40% of canvas, centered horizontally, stacked vertically',
      overlayRules: `Apply a dark gradient from 50% canvas height to the bottom edge, color ${bgHex}, opacity 100% at bottom.`
    };
    case 'TOP_SPLIT': return {
      visualZoneLabel: 'lower 60% of canvas',
      textZoneLabel: 'upper 40% of canvas, centered horizontally, stacked vertically',
      overlayRules: `Apply a dark gradient from 50% canvas height to the top edge, color ${bgHex}, opacity 100% at top.`
    };
    case 'LETTERBOX': return {
      visualZoneLabel: 'exact center of the canvas, rendered as a 1:1 square photo',
      textZoneLabel: 'split between the top 20% and bottom 20% of the canvas',
      overlayRules: `No gradient. The top and bottom 20% areas should be solid ${bgHex} blocks framing the center square photo.`
    };
    case 'LOWER_THIRD': return {
      visualZoneLabel: 'fills entire canvas, but subject framed heavily in upper half',
      textZoneLabel: 'absolute bottom 25% of canvas, compact text',
      overlayRules: `Sharp, highly opaque dark gradient strictly in the bottom 30% of the image, fading sharply into the photo above it.`
    };
    case 'MINIMAL_CARD': return {
      visualZoneLabel: 'very subtle, soft focus in the background, heavily blurred, opacity 15%',
      textZoneLabel: 'occupies the entire center 60% of the canvas, lots of negative space',
      overlayRules: `Solid ${bgHex} background over the entire canvas, letting the visual element barely peek through as a watermark texture.`
    };
  }
}
