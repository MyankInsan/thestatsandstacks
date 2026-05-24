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
      slides: input.slides.map(slide => buildPrompt(slide, input.format, input.strategy)),
    };
  }
}

// Literal Prompt Templates tailored for Gemini Nano Banana Pro

const PARAMETERS = '--ar 4:5 --style raw --v 6.0 --s 200';

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

function buildHypotheticalChartPrompt(slide: SlideSpec, format: FormatDecision): string {
  const { colorScheme } = format;
  const text = getTypographyDetails(slide);
  return `A simple, photorealistic, high-contrast 2D line chart on a pitch-black background. The chart compares two assets over a 15-year timeline. A sharp, jagged line goes exponentially up in a bright neon ${colorScheme.accent1} color, with a dot at the end. A flat, steady line goes slightly up in a bright neon ${colorScheme.accent2} color. The x-axis is labeled with years. Overlaying the chart: ${text}. The entire image must be clean, data-focused, and highly legible, optimized for an Instagram post. ${PARAMETERS}`;
}

function buildBillionDollarWebPrompt(slide: SlideSpec, format: FormatDecision): string {
  const text = getTypographyDetails(slide);
  return `A high-tech, cinematic diagram on a dark abstract background with glowing HUD rings and futuristic elements. In the center, a massive, glowing corporate logo. Surrounding the center in a perfect circle are 6 smaller glowing orbs, each containing a crisp, perfectly legible company logo representing an acquisition or ecosystem partner. Superimposed over this high-tech web is the following text: ${text}. The style is dramatic, insider-knowledge, and highly detailed. ${PARAMETERS}`;
}

function buildInsiderPortfolioPrompt(slide: SlideSpec, format: FormatDecision): string {
  const text = getTypographyDetails(slide);
  return `A flawless, modern, dark-mode donut chart / pie chart. The background is pitch black. The chart has exactly 8 distinct colored slices in a sleek matte finish. In the empty center hole of the donut chart is a high-quality cutout portrait of a famous investor or financial figure looking confident. Floating next to the slices are crisp stock tickers and percentages (e.g., "$NVDA 11.4%", "$AMD 7.09%"). At the top, bold white and green text reads: ${text}. Clean corporate aesthetic. ${PARAMETERS}`;
}

function buildBoldRealityPrompt(slide: SlideSpec, format: FormatDecision): string {
  const text = getTypographyDetails(slide);
  return `A cinematic, hyper-realistic, slightly desaturated photograph of a corporate headquarters, a Wall Street building, or an intense trading floor. Overlaid directly in the center of the image is: ${text}. The text must be huge, high-contrast, perfectly legible, and dominate 40% of the screen. The background should be slightly out of focus to ensure the neon typography pops perfectly. ${PARAMETERS}`;
}

function buildPopCultureWinnerPrompt(slide: SlideSpec, format: FormatDecision): string {
  const text = getTypographyDetails(slide);
  return `A cinematic, highly stylized portrait of a famous movie star or pop culture figure (e.g., Leonardo DiCaprio in a pinstripe suit) standing confidently. The background is a blurred cityscape or trading floor. Floating around the figure are 4 crisp white glowing circles, each containing a well-known tech stock logo. Superimposed over the entire scene is: ${text}. The text must be massive, white, bold, and high-impact. The vibe is wealth, success, and insider secrets. ${PARAMETERS}`;
}

function buildPrompt(slide: SlideSpec, format: FormatDecision, strategy: StrategyDecision): SlideImagePrompt {
  let promptText = '';
  
  switch (strategy.viralFormat) {
    case 'HYPOTHETICAL_CHART':
      promptText = buildHypotheticalChartPrompt(slide, format);
      break;
    case 'BILLION_DOLLAR_WEB':
      promptText = buildBillionDollarWebPrompt(slide, format);
      break;
    case 'INSIDER_PORTFOLIO':
      promptText = buildInsiderPortfolioPrompt(slide, format);
      break;
    case 'BOLD_REALITY':
      promptText = buildBoldRealityPrompt(slide, format);
      break;
    case 'POP_CULTURE_WINNER':
      promptText = buildPopCultureWinnerPrompt(slide, format);
      break;
    default:
      promptText = buildBoldRealityPrompt(slide, format); // Safe fallback
      break;
  }

  return {
    slideNumber: slide.slideNumber,
    role: slide.role,
    slideTitle: slide.role.toUpperCase().replace(/_/g, ' '),
    geminiPrompt: promptText,
  };
}
