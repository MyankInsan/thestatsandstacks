import type { SlideSpec } from './slideNarrativeAgent';
import type { FormatDecision } from './formatStyleAgent';

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
  }): ImagePromptSet {
    return {
      slides: input.slides.map(slide => buildPrompt(slide, input.format)),
    };
  }
}

import { PROMPT_LIBRARY } from './promptLibrary';

function getTypographyDetails(slide: SlideSpec): string {
  let text = '';
  if (slide.headlineColorMap && slide.headlineColorMap.length > 0) {
    text += `Massive, distressed, ultra-bold sans-serif text reading "${slide.headlineColorMap.map(p => p.text).join(' ')}". `;
  } else if (slide.headline) {
    text += `Massive, distressed, ultra-bold sans-serif text reading "${slide.headline}". `;
  }
  if (slide.dataPoint) {
    text += `A huge neon callout reading "${slide.dataPoint}". `;
  }
  if (slide.subtext) {
    text += `A clean, bright secondary text below reading "${slide.subtext}". `;
  }
  return text.trim();
}

function buildPrompt(slide: SlideSpec, format: FormatDecision): SlideImagePrompt {
  const { colorScheme } = format;
  const typographyText = getTypographyDetails(slide);
  
  // Lookup the exact template from the advanced library based on the slide's specific style assignment
  let promptTemplate = PROMPT_LIBRARY[slide.visualStyle];
  
  // Safe fallback if for some reason the narrative agent hallucinates a style
  if (!promptTemplate) {
    promptTemplate = PROMPT_LIBRARY.ARCHITECTURAL_OVERLAY;
  }

  // Inject the specific colors and typography into the template
  const finalPrompt = promptTemplate
    .replace('[text]', typographyText)
    .replace('[accent1]', colorScheme.accent1)
    .replace('[accent2]', colorScheme.accent2);

  // Compile individual text pieces for the structured overlay layout section
  const textElements: string[] = [];
  if (slide.eyebrow) textElements.push(`Eyebrow: "${slide.eyebrow}"`);
  if (slide.headline) textElements.push(`Headline: "${slide.headline}"`);
  if (slide.subtext) textElements.push(`Subtext: "${slide.subtext}"`);
  if (slide.dataPoint) textElements.push(`Data Point: "${slide.dataPoint}"`);
  const textSection = textElements.join(' | ');

  // Wrap visual style prompt template with canvas, background, brand mark, and overlay specs
  const compiledPrompt = [
    `Create a 1080x1350 portrait Instagram image.`,
    `Background: Solid background color ${colorScheme.bg} with clean dark-mode gradients and cinematic studio lighting.`,
    `Visual element: ${finalPrompt}`,
    textSection ? `Text overlay layout details: ${textSection}` : '',
    `Brand watermark: Faint logo mark and "@thestatsandstacks" in small white font in the bottom-left corner.`,
    `Constraints: High-end professional rendering, perfect spelling and legible typography, no overlapping letters, no other borders or watermarks.`
  ].filter(line => line !== '').join('\n\n');

  return {
    slideNumber: slide.slideNumber,
    role: slide.role,
    slideTitle: slide.role.toUpperCase().replace(/_/g, ' '),
    geminiPrompt: compiledPrompt,
  };
}
