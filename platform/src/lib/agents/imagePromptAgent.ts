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

  return {
    slideNumber: slide.slideNumber,
    role: slide.role,
    slideTitle: slide.role.toUpperCase().replace(/_/g, ' '),
    geminiPrompt: finalPrompt,
  };
}
