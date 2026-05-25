import { BaseAgent } from './interfaces';
import { getGeminiClient, getGeminiTextModelName } from '../services/gemini';
import type { SlideSpec } from './slideNarrativeAgent';
import type { FormatDecision } from './formatStyleAgent';
import type { StrategyDecision } from './contentStrategyAgent';
import { PROMPT_LIBRARY } from './promptLibrary';

export interface SlideImagePrompt {
  slideNumber: number;
  role: SlideSpec['role'];
  slideTitle: string;
  geminiPrompt: string;
}

export interface ImagePromptSet {
  slides: SlideImagePrompt[];
}

export class ImagePromptAgent extends BaseAgent {
  constructor() {
    super('ImagePromptAgent');
  }

  async execute(input: {
    slides: SlideSpec[];
    format: FormatDecision;
    strategy?: StrategyDecision;
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
        slides: Array<{
          slideNumber: number;
          visualDescription: string;
        }>;
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
        err instanceof Error ? err.message : String(err)
      );
    }

    const slides = input.slides.map(slide => {
      let visualDescription = generatedPromptsMap.get(slide.slideNumber);
      if (!visualDescription) {
        visualDescription = buildFallbackVisualDescription(slide, input.format);
      }

      // Ensure v6 parameters are present at the end of the prompt
      if (!visualDescription.includes('--ar 4:5')) {
        visualDescription = `${visualDescription.trim()} --ar 4:5 --style raw --v 6.0 --s 200`;
      }

      const compiledPrompt = compilePromptString(slide, visualDescription, input.format);

      return {
        slideNumber: slide.slideNumber,
        role: slide.role,
        slideTitle: slide.role.toUpperCase().replace(/_/g, ' '),
        geminiPrompt: compiledPrompt,
      };
    });

    return { slides };
  }
}

function buildLlmPrompt(input: {
  slides: SlideSpec[];
  format: FormatDecision;
  strategy?: StrategyDecision;
}): string {
  const topic = input.strategy?.topic || 'Canadian Personal Finance';
  const hook = input.strategy?.hook || '';
  const formatType = input.format.formatType;
  const tone = input.format.visualTone;
  const colors = `bg=${input.format.colorScheme.bg}, accent1=${input.format.colorScheme.accent1}, accent2=${input.format.colorScheme.accent2}`;

  // Format slides list for LLM
  const slidesJson = input.slides.map(s => ({
    slideNumber: s.slideNumber,
    role: s.role,
    headline: s.headline,
    subtext: s.subtext || '',
    dataPoint: s.dataPoint || '',
    suggestedStyle: s.visualStyle,
  }));

  // Style reference list for prompt context
  const styleReference = Object.entries(PROMPT_LIBRARY)
    .map(([style, desc]) => `- ${style}: ${desc}`)
    .join('\n');

  return `You are a world-class creative director and Midjourney v6 prompt engineer for "TheStatsAndStacks", a premium Canadian personal finance brand on Instagram.

TODAY'S POST CONTEXT:
- TOPIC: ${topic}
- HOOK: ${hook}
- DAILY FORMAT: ${formatType}
- VISUAL TONE: ${tone}
- COLOR PALETTE: ${colors}

SLIDE SPECS:
${JSON.stringify(slidesJson, null, 2)}

YOUR MISSION:
Write a unique, context-specific visual description for the main visual element of each slide in the carousel. The description must be directly tailored to the slide's headline, role, and the overall daily topic.

PROMPT DESIGN RULES:
1. CUSTOMIZE SUBJECTS & LOGOS:
   - For office scenes, describe the target company's logo (e.g. AppLovin, NVIDIA) on the wall.
   - For executive lineups, describe the actual founder/CEO (e.g. Jensen Huang in a black leather jacket, Sanjay Mehrotra, Satya Nadella) instead of generic placeholders.
   - For aerospace/defense topics (e.g. RTX), describe specific assets like a "sleek hypersonic cruise missile flying with cinematic heat trails" rather than a generic rocket.
   - For political/macro topics (e.g. Trump defense budget), describe the specific leader (e.g. Donald Trump in a dark suit) with relevant circular badges behind them.
2. INCORPORATE THE SUGGESTED STYLES:
   Use the following list of styling concepts as reference templates. Map each slide's "suggestedStyle" to its corresponding template, replace general placeholders with topic-specific entities, map the palette colors (accent1, accent2), and build a highly detailed prompt:
${styleReference}
3. ENFORCE SEQUENCE-AWARE VARIETY:
   Ensure there is distinct visual variety across slides. Alternately rotate camera angles and styles (e.g., Close-up studio cutout -> Wide-angle workspace -> 2D clean visual chart -> Abstract dynamic action shot). No two adjacent slides should look identical in layout or main subject.
4. MIDJOURNEY V6 PARAMETERS:
   Ensure all visual descriptions end with "--ar 4:5 --style raw --v 6.0 --s 200".
5. EXCLUDE GRAPHICAL TEXT & WATERMARKS:
   Do not describe overlapping text, random floating letters, labels, or photo watermarks in your visual descriptions. The code will handle text overlays.
6. PREMIUM CTA SLIDE RULE:
   For the final slide (role: cta), do NOT write prompts for simple checklists or plain flat backgrounds. Instead, construct a highly premium, cinematic visual scene (e.g., a stunning, ultra-premium cinematic executive boardroom with a large dark marble table and floor-to-ceiling glass windows overlooking a glowing nighttime city skyline, or a glowing bank vault door filled with gold bars, or a premium glassmorphic geometric composition with high specular highlights) that represents long-term wealth, compounding growth, or financial success. This makes the CTA feel extremely high-end.

Return ONLY valid JSON matching this exact schema (no markdown, no code fences):
{
  "slides": [
    {
      "slideNumber": number,
      "visualDescription": "The complete, highly detailed Midjourney v6 prompt starting with the main subject and ending with --ar 4:5 --style raw --v 6.0 --s 200"
    }
  ]
}`;
}

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

function buildFallbackVisualDescription(slide: SlideSpec, format: FormatDecision): string {
  const { colorScheme } = format;
  const typographyText = getTypographyDetails(slide);
  let promptTemplate = PROMPT_LIBRARY[slide.visualStyle];
  if (!promptTemplate) {
    promptTemplate = PROMPT_LIBRARY.ARCHITECTURAL_OVERLAY;
  }
  return promptTemplate
    .replace('[text]', typographyText)
    .replace('[accent1]', colorScheme.accent1)
    .replace('[accent2]', colorScheme.accent2);
}

function compilePromptString(slide: SlideSpec, visualDescription: string, format: FormatDecision): string {
  const { colorScheme } = format;
  const textElements: string[] = [];
  if (slide.eyebrow) textElements.push(`Eyebrow: "${slide.eyebrow}"`);
  if (slide.headline) textElements.push(`Headline: "${slide.headline}"`);
  if (slide.subtext) textElements.push(`Subtext: "${slide.subtext}"`);
  if (slide.dataPoint) textElements.push(`Data Point: "${slide.dataPoint}"`);
  const textSection = textElements.join(' | ');

  return [
    `Create a 1080x1350 portrait Instagram image.`,
    `Background: Solid background color ${colorScheme.bg} with clean dark-mode gradients and cinematic studio lighting.`,
    `Visual element: ${visualDescription}`,
    textSection ? `Text overlay layout details: ${textSection}` : '',
    `Brand watermark: Faint logo mark and "@thestatsandstacks" in small white font in the bottom-left corner.`,
    `Constraints: High-end professional rendering, perfect spelling and legible typography, no overlapping letters, no other borders or watermarks.`
  ].filter(line => line !== '').join('\n\n');
}
