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

// Modular Prompt Dictionaries for "Premium, Non-Hype" Aesthetic
const FORMATS = [
  'Macro editorial photography',
  'Abstract 3D render',
  'Minimalist digital illustration',
  'Architectural visualization'
];

const SUBJECT_ABSTRACTIONS = [
  'smooth flowing topographic lines',
  'subtle ascending geometric forms',
  'interconnected delicate nodes',
  'monolithic abstract forms',
  'layered tectonic plates',
  'calm fluid dynamics',
  'minimalist data visualization',
  'abstract structured grid patterns',
  'clean translucent layering'
];

const MATERIALITIES = [
  'frosted glass and brushed charcoal metal',
  'matte navy surface with subtle gold foil accents',
  'dark emerald marble with brass inlay',
  'smooth dark silk and slate',
  'brushed steel and dark glass',
  'matte porcelain with subtle metallic veins'
];

const LIGHTING = [
  'soft studio lighting with subtle rim light',
  'cinematic volumetric lighting',
  'diffused soft-box lighting',
  'chiaroscuro lighting',
  'architectural lighting with soft ambient occlusion'
];

const COMPOSITION_STYLE = [
  'high-end editorial financial aesthetic, vast negative space, elegant, clean modern corporate style, hyper-realistic, 8k',
  'Swiss design influence, minimalist, sharp focus, sophisticated wealth management branding, pristine',
  'editorial magazine quality, clean layout, ample negative space for text overlay, balanced composition, ultra-detailed',
  'contemporary corporate aesthetic, rigid geometry, depth of field, minimalist perfection'
];

// Always include this for Midjourney/Ideogram to avoid the "finance bro" AI slop
const NEGATIVE_PROMPT = '--no coins, neon, literal arrows, bull, bear, cyberpunk, chaotic, messy, cluttered, low resolution, cheap 3d render, plastic, watermark, messy text, glowing green';

const PARAMETERS = '--ar 4:5 --style raw --v 6.0 --s 200';

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildPrompt(slide: SlideSpec, format: FormatDecision): SlideImagePrompt {
  const { colorScheme } = format;
  
  // 1. Pick randomized but curated modular elements for the visual
  const formatType = getRandomElement(FORMATS);
  const subject = getRandomElement(SUBJECT_ABSTRACTIONS);
  const materiality = getRandomElement(MATERIALITIES);
  const lighting = getRandomElement(LIGHTING);
  const style = getRandomElement(COMPOSITION_STYLE);
  
  // 2. Format the Color Palette
  const colorPalette = `${colorScheme.bg}, ${colorScheme.primaryText}, ${colorScheme.accent1}, and ${colorScheme.accent2} color palette`;

  // 3. Assemble the Text that needs to be generated in the image
  // For AI Image Generation, we need to be very explicit about what text is rendered.
  let textToRender = '';
  
  if (slide.headlineColorMap && slide.headlineColorMap.length > 0) {
    const headline = slide.headlineColorMap.map(part => part.text).join(' ');
    textToRender += `The large bold text "${headline}" centered on the surface. `;
  } else if (slide.headline) {
    textToRender += `The large bold text "${slide.headline}" centered on the surface. `;
  }

  if (slide.dataPoint) {
    textToRender += `The massive number "${slide.dataPoint}" written cleanly below the headline. `;
  }
  
  if (slide.subtext) {
    textToRender += `The small subtitle "${slide.subtext}" written below. `;
  }

  // 4. Construct the final Prompt using the Formula:
  // [Format] of [Subject], [Materiality]. [Color_Palette]. [Lighting]. [Composition_&_Style]. [Text]. [Parameters] [Negative_Prompt]
  
  const prompt = `${formatType} of ${subject}, ${materiality}. ${colorPalette}. ${lighting}. ${style}. ${textToRender.trim()} ${PARAMETERS} ${NEGATIVE_PROMPT}`;

  return {
    slideNumber: slide.slideNumber,
    role: slide.role,
    slideTitle: slide.role.toUpperCase().replace(/_/g, ' '),
    geminiPrompt: prompt,
  };
}
