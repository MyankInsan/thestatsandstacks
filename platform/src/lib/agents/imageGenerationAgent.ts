import { BaseAgent } from './interfaces';
import OpenAI from 'openai';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { getRunSlug, sanitizeFilePart } from '../services/dateUtils';
import type { VisualAssetSlidePlan, VisualAssetSourcingPlan } from './visualAssetSourcingAgent';

export interface GeneratedImage {
  slideNumber: number;
  localPath: string;
  mimeType: string;
  source: 'local' | 'openai' | 'cloudflare' | 'pexels' | 'wikimedia';
  attribution?: string;
  sourcePage?: string;
  license?: string;
  layoutWarnings?: string[];
}

interface ParsedSlide {
  title: string;
  points: string[];
}

interface SlideTheme {
  name: string;
  labelPrefix: string;
  accent: string;
  secondaryAccent: string;
  tertiaryAccent: string;
  bgMid: string;
  bgEnd: string;
  panel: string;
  panelEnd: string;
  card: string;
  stroke: string;
  visualKind: 'accounts' | 'market' | 'cashflow' | 'credit' | 'tax' | 'decision';
}

interface VisualContext {
  label: string;
  chips: [string, string, string, string];
  leftLabel: string;
  rightLabel: string;
}

interface TextBlockLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  bottomY: number;
}

interface SlideRender {
  svg: string;
  layoutWarnings: string[];
}

const SLIDE_WIDTH = 1080;
const SLIDE_HEIGHT = 1350;
const PANEL_X = 74;
const PANEL_Y = 72;
const PANEL_W = 932;
const PANEL_H = 1206;
const CONTENT_X = 116;
const CONTENT_W = 848;
const POINT_ROW_H = 76;
const POINT_ROW_GAP = 88;
const SAVE_CARD_H = 78;
const CLOUDFLARE_FREE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

export class ImageGenerationAgent extends BaseAgent {
  constructor() {
    super('ImageGenerationAgent');
  }

  async execute(input: {
    prompts: Array<{ slideNumber: number; slideDescription: string; dallePrompt: string }>,
    outputDir: string,
    visualPlan?: VisualAssetSourcingPlan,
  }): Promise<{ images: GeneratedImage[] }> {
    fs.mkdirSync(input.outputDir, { recursive: true });
    const runSlug = getRunSlug();
    const freeOnly = process.env.FREE_IMAGE_GENERATION_ONLY !== 'false';
    if (input.visualPlan?.slides.some((slide) => Boolean(slide.assetUrl))) {
      return this.generateFromVisualPlan({
        prompts: input.prompts,
        outputDir: input.outputDir,
        visualPlan: input.visualPlan,
        runSlug,
        freeOnly,
      });
    }

    if (freeOnly && isCloudflareWorkersAiReady()) {
      return this.generateWithCloudflare({ ...input, runSlug });
    }

    if (!freeOnly && process.env.ALLOW_PAID_IMAGE_GENERATION === 'true' && process.env.OPENAI_API_KEY) {
      return this.generateWithOpenAI({ ...input, runSlug });
    }

    console.log(`[${this.name}] Using premium zero-cost local PNG slide generation.`);
    return this.generateLocalSlides({ ...input, runSlug });
  }

  private async generateFromVisualPlan(input: {
    prompts: Array<{ slideNumber: number; slideDescription: string; dallePrompt: string }>,
    outputDir: string,
    visualPlan: VisualAssetSourcingPlan,
    runSlug: string,
    freeOnly: boolean,
  }): Promise<{ images: GeneratedImage[] }> {
    console.log(`[${this.name}] Using visual asset sourcing plan with legal/free provider fallbacks.`);
    const planBySlide = new Map(input.visualPlan.slides.map((slide) => [slide.slideNumber, slide]));
    const images: GeneratedImage[] = [];
    let cloudflareCount = 0;
    const maxCloudflareImages = clamp(Number.parseInt(process.env.CLOUDFLARE_MAX_IMAGES_PER_RUN || '8', 10) || 8, 1, 8);

    for (const prompt of input.prompts) {
      const plan = planBySlide.get(prompt.slideNumber);
      if (plan?.assetUrl && (plan.provider === 'pexels' || plan.provider === 'wikimedia')) {
        try {
          const background = await downloadVisualAsset(plan);
          const filename = buildSlideFilename(input.runSlug, prompt.slideNumber);
          const localPath = path.join(input.outputDir, filename);
          const layoutWarnings = await this.writeSourcedCompositedSlide(
            background,
            prompt.slideNumber,
            prompt.slideDescription,
            localPath,
            input.runSlug
          );
          images.push({
            slideNumber: prompt.slideNumber,
            localPath,
            mimeType: 'image/png',
            source: plan.provider,
            attribution: plan.attribution,
            sourcePage: plan.sourcePage,
            license: plan.license,
            layoutWarnings,
          });
          console.log(`   Slide ${prompt.slideNumber} saved with ${plan.provider} source image.`);
          continue;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`   ${plan.provider} asset failed for slide ${prompt.slideNumber}; falling back. ${message}`);
        }
      }

      if (
        input.freeOnly
        && isCloudflareWorkersAiReady()
        && (!plan || plan.provider === 'cloudflare')
        && cloudflareCount < maxCloudflareImages
      ) {
        const cloudflareImage = await this.generateCloudflareSlide(prompt, input.outputDir, input.runSlug);
        images.push(cloudflareImage);
        cloudflareCount++;
        continue;
      }

      images.push(await this.generateLocalSlide(prompt, input.outputDir, input.runSlug));
      console.log(`   Slide ${prompt.slideNumber} saved locally.`);
    }

    return { images };
  }

  private async generateWithOpenAI(input: {
    prompts: Array<{ slideNumber: number; slideDescription: string; dallePrompt: string }>,
    outputDir: string,
    runSlug: string
  }): Promise<{ images: GeneratedImage[] }> {
    const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
    const quality = (process.env.OPENAI_IMAGE_QUALITY || 'medium') as 'low' | 'medium' | 'high' | 'auto';
    const size = (process.env.OPENAI_IMAGE_SIZE || '1024x1536') as '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
    console.log(`[${this.name}] Generating ${input.prompts.length} background images with OpenAI ${model} (${quality}, ${size}).`);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const images: GeneratedImage[] = [];
    for (const prompt of input.prompts) {
      console.log(`   -> Generating slide ${prompt.slideNumber}...`);

      let retries = 0;
      while (retries < 2) {
        try {
          const response = await openai.images.generate({
            model,
            prompt: prompt.dallePrompt,
            size,
            quality,
            output_format: 'png',
            n: 1,
          });

          const imageData = response.data?.[0]?.b64_json;
          if (!imageData) throw new Error('No base64 image data returned by OpenAI');

          const buffer = Buffer.from(imageData, 'base64');
          const filename = buildSlideFilename(input.runSlug, prompt.slideNumber);
          const localPath = path.join(input.outputDir, filename);
          const layoutWarnings = await this.writePremiumCompositedSlide(buffer, prompt.slideNumber, prompt.slideDescription, localPath, input.runSlug);

          images.push({ slideNumber: prompt.slideNumber, localPath, mimeType: 'image/png', source: 'openai', layoutWarnings });
          console.log(`   Slide ${prompt.slideNumber} saved.`);
          break;
        } catch (error) {
          retries++;
          const message = error instanceof Error ? error.message : 'Unknown image generation error';
          console.error(`   Attempt ${retries} failed: ${message}`);
          if (retries === 2) {
            console.warn(`   Falling back to local renderer for slide ${prompt.slideNumber}.`);
            images.push(await this.generateLocalSlide(prompt, input.outputDir, input.runSlug));
            break;
          }
        }
      }
    }

    return { images };
  }

  private async generateWithCloudflare(input: {
    prompts: Array<{ slideNumber: number; slideDescription: string; dallePrompt: string }>,
    outputDir: string,
    runSlug: string
  }): Promise<{ images: GeneratedImage[] }> {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken) {
      throw new Error('Cloudflare Workers AI is enabled, but CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is missing.');
    }

    const model = process.env.CLOUDFLARE_IMAGE_MODEL || CLOUDFLARE_FREE_MODEL;
    const steps = clamp(Number.parseInt(process.env.CLOUDFLARE_IMAGE_STEPS || '4', 10) || 4, 1, 8);
    const maxImages = clamp(Number.parseInt(process.env.CLOUDFLARE_MAX_IMAGES_PER_RUN || '8', 10) || 8, 1, 8);
    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const images: GeneratedImage[] = [];

    console.log(`[${this.name}] Using Cloudflare Workers AI ${model} for zero-cost photo-style backgrounds.`);
    for (const prompt of input.prompts) {
      if (images.length >= maxImages) {
        console.warn(`   Cloudflare max images per run reached (${maxImages}); using local renderer for slide ${prompt.slideNumber}.`);
        images.push(await this.generateLocalSlide(prompt, input.outputDir, input.runSlug));
        continue;
      }

      try {
        images.push(await this.generateCloudflareSlide(prompt, input.outputDir, input.runSlug, { accountId, apiToken, model, steps, apiUrl }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`   Cloudflare background failed for slide ${prompt.slideNumber}; using local renderer. ${message}`);
        images.push(await this.generateLocalSlide(prompt, input.outputDir, input.runSlug));
      }
    }

    return { images };
  }

  private async generateCloudflareSlide(
    prompt: { slideNumber: number; slideDescription: string; dallePrompt: string },
    outputDir: string,
    runSlug: string,
    config?: {
      accountId: string;
      apiToken: string;
      model: string;
      steps: number;
      apiUrl: string;
    }
  ): Promise<GeneratedImage> {
    const accountId = config?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = config?.apiToken || process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken) {
      throw new Error('Cloudflare Workers AI is enabled, but CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is missing.');
    }

    const model = config?.model || process.env.CLOUDFLARE_IMAGE_MODEL || CLOUDFLARE_FREE_MODEL;
    const steps = config?.steps || clamp(Number.parseInt(process.env.CLOUDFLARE_IMAGE_STEPS || '4', 10) || 4, 1, 8);
    const apiUrl = config?.apiUrl || `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: buildBackgroundOnlyPrompt(prompt.dallePrompt, prompt.slideDescription),
        steps,
        seed: Math.abs(hashString(`${runSlug}:${prompt.slideNumber}:${prompt.slideDescription}`)),
      }),
    });

    const payload = await response.json() as {
      success?: boolean;
      errors?: Array<{ message?: string }>;
      result?: { image?: string };
      image?: string;
    };

    if (!response.ok || payload.success === false) {
      const message = payload.errors?.map((error) => error.message).filter(Boolean).join('; ') || response.statusText;
      throw new Error(message);
    }

    const base64Image = payload.result?.image || payload.image;
    if (!base64Image) throw new Error('Cloudflare response did not include base64 image data.');

    const filename = buildSlideFilename(runSlug, prompt.slideNumber);
    const localPath = path.join(outputDir, filename);
    const layoutWarnings = await this.writeViralCompositedSlide(
      Buffer.from(base64Image, 'base64'),
      prompt.slideNumber,
      prompt.slideDescription,
      localPath,
      runSlug
    );
    console.log(`   Slide ${prompt.slideNumber} saved with Cloudflare background.`);
    return { slideNumber: prompt.slideNumber, localPath, mimeType: 'image/png', source: 'cloudflare', layoutWarnings };
  }

  private async generateLocalSlides(input: {
    prompts: Array<{ slideNumber: number; slideDescription: string; dallePrompt: string }>,
    outputDir: string,
    runSlug: string
  }): Promise<{ images: GeneratedImage[] }> {
    const images: GeneratedImage[] = [];

    for (const prompt of input.prompts) {
      images.push(await this.generateLocalSlide(prompt, input.outputDir, input.runSlug));
      console.log(`   Slide ${prompt.slideNumber} saved locally.`);
    }

    return { images };
  }

  private async generateLocalSlide(
    prompt: { slideNumber: number; slideDescription: string; dallePrompt: string },
    outputDir: string,
    runSlug: string
  ): Promise<GeneratedImage> {
    const filename = buildSlideFilename(runSlug, prompt.slideNumber);
    const localPath = path.join(outputDir, filename);
    const rendered = shouldUseViralPoster(prompt.slideDescription)
      ? this.createViralPosterSvg(prompt.slideNumber, prompt.slideDescription, runSlug, true)
      : this.createSlideSvg(prompt.slideNumber, prompt.slideDescription, runSlug);
    await sharp(Buffer.from(rendered.svg)).png().toFile(localPath);
    return {
      slideNumber: prompt.slideNumber,
      localPath,
      mimeType: 'image/png',
      source: 'local',
      layoutWarnings: rendered.layoutWarnings,
    };
  }

  private async writePremiumCompositedSlide(
    background: Buffer,
    slideNumber: number,
    description: string,
    localPath: string,
    runSlug: string
  ): Promise<string[]> {
    const overlay = this.createSlideSvg(slideNumber, description, `${runSlug}:overlay`);
    await sharp(background)
      .resize(SLIDE_WIDTH, SLIDE_HEIGHT, { fit: 'cover' })
      .composite([{ input: Buffer.from(overlay.svg), top: 0, left: 0 }])
      .png()
      .toFile(localPath);
    return overlay.layoutWarnings;
  }

  private async writeViralCompositedSlide(
    background: Buffer,
    slideNumber: number,
    description: string,
    localPath: string,
    runSlug: string
  ): Promise<string[]> {
    const overlay = this.createViralPosterSvg(slideNumber, description, `${runSlug}:viral`);
    await sharp(background)
      .resize(SLIDE_WIDTH, SLIDE_HEIGHT, { fit: 'cover' })
      .modulate({ brightness: 0.84, saturation: 1.12 })
      .composite([{ input: Buffer.from(overlay.svg), top: 0, left: 0 }])
      .png()
      .toFile(localPath);
    return overlay.layoutWarnings;
  }

  private async writeSourcedCompositedSlide(
    background: Buffer,
    slideNumber: number,
    description: string,
    localPath: string,
    runSlug: string
  ): Promise<string[]> {
    return shouldUseViralPoster(description)
      ? this.writeViralCompositedSlide(background, slideNumber, description, localPath, runSlug)
      : this.writePremiumCompositedSlide(background, slideNumber, description, localPath, runSlug);
  }

  private createViralPosterSvg(slideNumber: number, description: string, runSlug: string, includeSyntheticBackground = false): SlideRender {
    const parsed = parseSlideDescription(description);
    const theme = getDailyTheme(`${runSlug}:${description}`);
    const context = getVisualContext(description);
    const headline = buildPosterHeadline(parsed, slideNumber);
    const layout = layoutPosterHeadline(headline);
    const textBottom = layout.startY + (layout.lines.length - 1) * layout.lineHeight + layout.fontSize;
    const layoutWarnings = getPosterLayoutWarnings(layout, textBottom);
    const accent = context.label.includes('storage') ? '#51d6e8' : theme.accent;

    return {
      layoutWarnings,
      svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" viewBox="0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}">
  <defs>
    <linearGradient id="localPosterBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07111f"/>
      <stop offset="42%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <radialGradient id="localPosterGlow" cx="70%" cy="16%" r="68%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.5"/>
      <stop offset="46%" stop-color="${theme.accent}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="topShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020617" stop-opacity="0.78"/>
      <stop offset="28%" stop-color="#020617" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bottomShade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020617" stop-opacity="0"/>
      <stop offset="24%" stop-color="#020617" stop-opacity="0.76"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.98"/>
    </linearGradient>
    <filter id="posterShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="#000000" flood-opacity="0.86"/>
    </filter>
  </defs>
  ${includeSyntheticBackground ? renderSyntheticPosterBackground(theme, accent, context) : ''}
  <rect width="${SLIDE_WIDTH}" height="360" fill="url(#topShade)"/>
  <rect y="530" width="${SLIDE_WIDTH}" height="820" fill="url(#bottomShade)"/>
  ${renderPosterMarketTrace(theme)}
  ${renderPosterBrand(slideNumber, theme, context)}
  ${renderPosterBadge(context.label, accent)}
  ${renderPosterHeadline(layout, accent)}
  ${renderPosterFooter(theme)}
</svg>`,
    };
  }

  private createSlideSvg(slideNumber: number, description: string, runSlug: string): SlideRender {
    const parsed = parseSlideDescription(description);
    const theme = getDailyTheme(`${runSlug}:${description}`);
    const context = getVisualContext(description);
    const visualKind = getVisualKind(description, context);
    const slideTheme = { ...theme, visualKind };
    const titleLayout = layoutTitle(parsed.title);
    const eyebrow = slideNumber === 1 ? context.label : `${context.label} / FRAME ${String(slideNumber).padStart(2, '0')}`;
    const visualY = clamp(titleLayout.bottomY + 34, 386, 512);
    const visualH = titleLayout.lines.length >= 4 ? 252 : titleLayout.lines.length === 3 ? 286 : 320;
    const pointsY = visualY + visualH + 30;
    const pointRows = normalizePoints(parsed.points, slideNumber, description);
    const visualMarkup = slideNumber === 1
      ? renderCoverVisualSystem(CONTENT_X, visualY, CONTENT_W, visualH, slideTheme, context, pointRows)
      : renderVisualSystem(CONTENT_X, visualY, CONTENT_W, visualH, slideTheme, context);
    const pointsBottom = pointsY + (pointRows.length - 1) * POINT_ROW_GAP + POINT_ROW_H;
    const footerY = clamp(pointsBottom + 34, 1038, 1122);
    const layoutWarnings = getSlideLayoutWarnings({
      titleBottomY: titleLayout.bottomY,
      visualY,
      visualBottomY: visualY + visualH,
      pointsY,
      pointsBottomY: pointsBottom,
      footerY,
      saveBottomY: footerY + SAVE_CARD_H,
    });

    return {
      layoutWarnings,
      svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" viewBox="0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#06101d"/>
      <stop offset="52%" stop-color="${slideTheme.bgMid}"/>
      <stop offset="100%" stop-color="${slideTheme.bgEnd}"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${slideTheme.panel}" stop-opacity="0.97"/>
      <stop offset="100%" stop-color="${slideTheme.panelEnd}" stop-opacity="0.96"/>
    </linearGradient>
    <radialGradient id="halo" cx="74%" cy="12%" r="78%">
      <stop offset="0%" stop-color="${slideTheme.accent}" stop-opacity="0.22"/>
      <stop offset="52%" stop-color="${slideTheme.secondaryAccent}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse">
      <path d="M72 0 L0 0 0 72" fill="none" stroke="#29405a" stroke-width="1" opacity="0.36"/>
    </pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="26" stdDeviation="25" flood-color="#000000" flood-opacity="0.34"/>
    </filter>
  </defs>
  <rect width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" fill="url(#bg)"/>
  <rect width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" fill="url(#halo)"/>
  <rect width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" fill="url(#grid)" opacity="0.42"/>
  ${renderBackgroundGeometry(slideTheme)}
  <rect x="${PANEL_X}" y="${PANEL_Y}" width="${PANEL_W}" height="${PANEL_H}" rx="34" fill="url(#panel)" stroke="#33465f" stroke-width="1.8" filter="url(#shadow)"/>
  <text x="806" y="254" fill="#ffffff" opacity="0.035" font-family="Arial, Helvetica, sans-serif" font-size="156" font-weight="900">${String(slideNumber).padStart(2, '0')}</text>
  ${renderBrandHeader(slideTheme, slideNumber)}
  <text x="${CONTENT_X}" y="232" fill="${slideTheme.secondaryAccent}" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="900" letter-spacing="1">${escapeXml(`${slideTheme.labelPrefix} / ${eyebrow}`.toUpperCase())}</text>
  ${renderTextBlock(parsed.title, CONTENT_X, 306, titleLayout, '#f8fafc', 900)}
  ${visualMarkup}
  ${renderPointCards(pointRows, pointsY, slideTheme)}
  ${renderSaveCard(footerY, slideTheme)}
  ${renderFooter(slideNumber, slideTheme)}
</svg>`,
    };
  }
}

function parseSlideDescription(description: string): ParsedSlide {
  const cleanDescription = description.replace(/^Slide\s+\d+:\s*/i, '').trim();
  const [headlinePart, ...supportingPoints] = cleanDescription.split('|').map((part) => part.trim()).filter(Boolean);
  return {
    title: headlinePart || cleanDescription || 'Finance framework',
    points: supportingPoints,
  };
}

interface PosterHeadlineLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  startY: number;
}

function isCloudflareWorkersAiReady(): boolean {
  return process.env.CLOUDFLARE_WORKERS_AI_ENABLED === 'true'
    && Boolean(process.env.CLOUDFLARE_ACCOUNT_ID)
    && Boolean(process.env.CLOUDFLARE_API_TOKEN);
}

async function downloadVisualAsset(plan: VisualAssetSlidePlan): Promise<Buffer> {
  if (!plan.assetUrl) throw new Error('Visual asset plan did not include an asset URL.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(plan.assetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': process.env.WIKIMEDIA_USER_AGENT || 'thestatsandstacks-content-bot/1.0',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (contentType && !contentType.startsWith('image/')) {
      throw new Error(`Expected an image, got ${contentType}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

function buildBackgroundOnlyPrompt(basePrompt: string, description: string): string {
  const lower = description.toLowerCase();
  const topicDirection = /sandisk|sndk|storage|memory|semiconductor|data center|datacenter|nand/.test(lower)
    ? 'high-end semiconductor and AI data-center scene, abstract storage hardware, glowing server aisles, premium editorial market-news energy'
    : /stock|watchlist|valuation|ticker|earnings|market|catalyst/.test(lower)
      ? 'premium financial-news scene with market screens, analyst desk, dramatic but credible lighting, chart energy without readable numbers'
      : 'premium personal-finance editorial scene, realistic desk materials, financial planning objects, cinematic light and depth';

  return [
    topicDirection,
    basePrompt,
    'Full-bleed vertical Instagram background, 4:5 portrait composition, strong subject in the upper half, visually rich but not cluttered.',
    'Leave the lower 45 percent darker and calmer for large text overlay.',
    'No readable text, no numbers, no logos, no watermarks, no fake UI, no fake brokerage screenshots.',
    'Use realistic photographic lighting, sharp details, high contrast, premium finance magazine style.',
  ].join(' ');
}

function shouldUseViralPoster(description: string): boolean {
  return /sandisk|sndk|storage|memory|semiconductor|data center|datacenter|nand|stock|watchlist|valuation|ticker|earnings|market|catalyst|portfolio|margin|guidance/i.test(description);
}

function buildPosterHeadline(parsed: ParsedSlide, slideNumber: number): string {
  const title = parsed.title.trim();
  const joiner = /[.!?]$/.test(title) ? ' ' : ': ';
  const coverSource = parsed.title.length < 56 && parsed.points[0]
    ? `${title}${joiner}${parsed.points[0]}`
    : title;
  const source = slideNumber === 1
    ? coverSource
    : [parsed.title, parsed.points[0]].filter(Boolean).join(' ');
  return clampText(
    source
      .replace(/\bframework\b/gi, 'filter')
      .replace(/\beducational only\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim(),
    108,
    '...'
  );
}

function layoutPosterHeadline(headline: string): PosterHeadlineLayout {
  const cleaned = headline.toUpperCase();
  const length = cleaned.length;
  const fontSize = length > 92 ? 58 : length > 74 ? 66 : length > 56 ? 78 : 96;
  const maxChars = length > 92 ? 20 : length > 74 ? 19 : length > 56 ? 18 : 15;
  const lines = wrapText(cleaned, maxChars, 6);
  const lineHeight = Math.round(fontSize * 0.95);
  const blockHeight = (lines.length - 1) * lineHeight + fontSize;
  const startY = clamp(1212 - blockHeight, 812, 900);

  return { lines, fontSize, lineHeight, startY };
}

function getPosterLayoutWarnings(layout: PosterHeadlineLayout, textBottom: number): string[] {
  const warnings: string[] = [];
  if (layout.startY < 716) warnings.push('Poster headline starts too high for safe focal-image space.');
  if (textBottom > 1230) warnings.push('Poster headline is too low for footer safe area.');
  if (layout.lines.length > 6) warnings.push('Poster headline has too many lines.');
  return warnings;
}

function renderPosterMarketTrace(theme: SlideTheme): string {
  const path = 'M54 560 C168 520 214 426 300 462 C390 498 438 354 526 300 C620 242 662 346 736 292 C836 220 906 234 1024 172';
  return `<g opacity="0.74">
    <path d="${path}" fill="none" stroke="#06120b" stroke-width="16" stroke-linecap="round" opacity="0.42"/>
    <path d="${path}" fill="none" stroke="${theme.accent}" stroke-width="8" stroke-linecap="round" opacity="0.74"/>
    <path d="${path}" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.2"/>
  </g>`;
}

function renderSyntheticPosterBackground(theme: SlideTheme, accent: string, context: VisualContext): string {
  const lowerLabel = context.label.toLowerCase();
  const isStorage = lowerLabel.includes('storage');
  return `<g>
    <rect width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" fill="url(#localPosterBg)"/>
    <rect width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" fill="url(#localPosterGlow)"/>
    <rect x="0" y="0" width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" fill="#020617" opacity="0.12"/>
    ${renderSyntheticServerRoom(accent)}
    ${isStorage ? renderSyntheticChipHero(accent, theme) : renderSyntheticTerminalHero(accent, theme)}
    <rect x="-120" y="575" width="1320" height="300" fill="#020617" opacity="0.22"/>
  </g>`;
}

function renderSyntheticServerRoom(accent: string): string {
  const racks = Array.from({ length: 9 }, (_, index) => {
    const x = 36 + index * 118;
    const height = 250 + (index % 3) * 34;
    const y = 272 - (index % 2) * 24;
    return `<g opacity="${0.38 + (index % 2) * 0.12}">
      <rect x="${x}" y="${y}" width="74" height="${height}" rx="10" fill="#111827" stroke="#334155" stroke-width="2"/>
      ${Array.from({ length: 8 }, (__, row) => {
        const rowY = y + 24 + row * 26;
        return `<rect x="${x + 12}" y="${rowY}" width="50" height="5" rx="3" fill="${row % 3 === 0 ? accent : '#64748b'}" opacity="${row % 3 === 0 ? 0.72 : 0.28}"/>`;
      }).join('')}
    </g>`;
  }).join('');

  return `<g>
    <path d="M0 506 L1080 390 L1080 590 L0 710 Z" fill="#020617" opacity="0.42"/>
    ${racks}
    <path d="M120 560 C290 412 420 498 560 365 C698 234 808 328 1030 184" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" opacity="0.22"/>
    <path d="M120 560 C290 412 420 498 560 365 C698 234 808 328 1030 184" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.18"/>
  </g>`;
}

function renderSyntheticChipHero(accent: string, theme: SlideTheme): string {
  return `<g filter="url(#posterShadow)" transform="translate(384 232) rotate(-9)">
    <rect x="0" y="0" width="322" height="244" rx="32" fill="#0f172a" stroke="#94a3b8" stroke-width="5"/>
    <rect x="42" y="38" width="238" height="168" rx="22" fill="#111827" stroke="${accent}" stroke-width="4"/>
    <text x="161" y="123" text-anchor="middle" fill="#f8fafc" font-family="Arial Black, Impact, Arial, sans-serif" font-size="54" font-weight="900">AI</text>
    <text x="161" y="164" text-anchor="middle" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="900" letter-spacing="2">STORAGE</text>
    ${Array.from({ length: 10 }, (_, index) => `<line x1="${-28}" y1="${28 + index * 20}" x2="0" y2="${28 + index * 20}" stroke="${theme.accent}" stroke-width="5" opacity="0.62"/>`).join('')}
    ${Array.from({ length: 10 }, (_, index) => `<line x1="322" y1="${28 + index * 20}" x2="350" y2="${28 + index * 20}" stroke="${theme.accent}" stroke-width="5" opacity="0.62"/>`).join('')}
  </g>`;
}

function renderSyntheticTerminalHero(accent: string, theme: SlideTheme): string {
  return `<g filter="url(#posterShadow)" transform="translate(170 245)">
    <rect x="0" y="0" width="742" height="314" rx="34" fill="#050b14" stroke="#334155" stroke-width="4"/>
    <rect x="32" y="34" width="202" height="236" rx="24" fill="#0f172a" stroke="${theme.stroke}" stroke-width="3"/>
    <text x="74" y="96" fill="${accent}" font-family="Arial Black, Impact, Arial, sans-serif" font-size="38" font-weight="900">HOT</text>
    <text x="74" y="142" fill="#f8fafc" font-family="Arial Black, Impact, Arial, sans-serif" font-size="38" font-weight="900">TOPIC</text>
    <rect x="74" y="176" width="108" height="13" rx="7" fill="${accent}" opacity="0.82"/>
    <rect x="74" y="206" width="74" height="13" rx="7" fill="#f8fafc" opacity="0.52"/>
    <path d="M294 242 C366 218 390 144 458 158 C522 172 540 76 618 62 C660 54 684 40 710 20" fill="none" stroke="${accent}" stroke-width="9" stroke-linecap="round"/>
    <path d="M294 242 C366 218 390 144 458 158 C522 172 540 76 618 62 C660 54 684 40 710 20" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.32"/>
    ${Array.from({ length: 5 }, (_, index) => `<line x1="294" y1="${82 + index * 36}" x2="700" y2="${82 + index * 36}" stroke="#334155" stroke-width="2" opacity="0.62"/>`).join('')}
  </g>`;
}

function renderPosterBrand(slideNumber: number, theme: SlideTheme, context: VisualContext): string {
  return `<g filter="url(#posterShadow)">
    <g transform="translate(54 58)">
      <path d="M0 58 L0 0 L58 0" fill="${theme.accent}" opacity="0.92"/>
      <path d="M15 41 L27 29 L38 35 L52 17" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M16 52 H52" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
      <path d="M18 52 V43 M30 52 V34 M42 52 V27" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
    </g>
    <text x="138" y="100" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900" letter-spacing="1">THESTATSANDSTACKS</text>
    <text x="138" y="134" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="800" letter-spacing="1">${escapeXml(context.label.toUpperCase())}</text>
    <rect x="880" y="58" width="122" height="70" rx="35" fill="#111827" opacity="0.78"/>
    <text x="941" y="104" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="900">FRAME ${String(slideNumber).padStart(2, '0')}</text>
  </g>`;
}

function renderPosterBadge(label: string, accent: string): string {
  const lowerLabel = label.toLowerCase();
  const badge = lowerLabel.includes('storage') ? 'MARKET HEAT' : lowerLabel.includes('research') ? 'WATCHLIST' : 'TRENDING';
  return `<g filter="url(#posterShadow)">
    <line x1="72" y1="738" x2="394" y2="738" stroke="#ffffff" stroke-width="5" opacity="0.86"/>
    <line x1="686" y1="738" x2="1008" y2="738" stroke="#ffffff" stroke-width="5" opacity="0.86"/>
    <path d="M434 700 H646 L620 778 H408 Z" fill="${accent}" opacity="0.96"/>
    <text x="527" y="751" text-anchor="middle" fill="#ffffff" font-family="Arial Black, Impact, Arial, sans-serif" font-size="31" font-weight="900" font-style="italic">${badge}</text>
  </g>`;
}

function renderPosterHeadline(layout: PosterHeadlineLayout, accent: string): string {
  return `<text x="540" y="${layout.startY}" text-anchor="middle" fill="#f8fafc" filter="url(#posterShadow)" font-family="Impact, Arial Black, Arial, sans-serif" font-size="${layout.fontSize}" font-weight="900" letter-spacing="0">
    ${layout.lines.map((line, index) => {
      const fill = isAccentPosterLine(line, index) ? accent : '#f8fafc';
      return `<tspan x="540" dy="${index === 0 ? 0 : layout.lineHeight}" fill="${fill}">${escapeXml(line)}</tspan>`;
    }).join('')}
  </text>`;
}

function renderPosterFooter(theme: SlideTheme): string {
  return `<g>
    <line x1="72" y1="1280" x2="318" y2="1280" stroke="#ffffff" stroke-width="4" opacity="0.88"/>
    <line x1="762" y1="1280" x2="1008" y2="1280" stroke="#ffffff" stroke-width="4" opacity="0.88"/>
    <text x="540" y="1293" text-anchor="middle" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="900" letter-spacing="1">EDUCATIONAL ONLY</text>
    <circle cx="986" cy="1212" r="36" fill="${theme.accent}" opacity="0.18"/>
    <text x="986" y="1221" text-anchor="middle" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900">TS</text>
  </g>`;
}

function isAccentPosterLine(line: string, index: number): boolean {
  return /[$%0-9]|SANDISK|SNDK|AI|STORAGE|STOCK|MARKET|RISK|WATCH|TAX|TFSA|RRSP|FHSA/.test(line) || index % 3 === 1;
}

function layoutTitle(title: string): TextBlockLayout {
  const length = title.length;
  const fontSize = length > 92 ? 46 : length > 72 ? 50 : length > 54 ? 55 : 62;
  const lineHeight = Math.round(fontSize * 1.14);
  const maxChars = length > 92 ? 31 : length > 72 ? 29 : length > 54 ? 27 : 24;
  const lines = wrapText(title, maxChars, 4);
  return {
    lines,
    fontSize,
    lineHeight,
    bottomY: 306 + (lines.length - 1) * lineHeight + Math.round(fontSize * 0.3),
  };
}

function renderTextBlock(
  text: string,
  x: number,
  y: number,
  layout: TextBlockLayout,
  fill: string,
  weight: number
): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial, Helvetica, sans-serif" font-size="${layout.fontSize}" font-weight="${weight}">
    ${layout.lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : layout.lineHeight}">${escapeXml(line)}</tspan>`).join('')}
  </text>`;
}

function renderBrandHeader(theme: SlideTheme, slideNumber: number): string {
  return `<g>
    <rect x="${CONTENT_X}" y="116" width="92" height="8" rx="4" fill="${theme.accent}"/>
    <rect x="${CONTENT_X + 108}" y="116" width="58" height="8" rx="4" fill="${theme.secondaryAccent}"/>
    <text x="${CONTENT_X}" y="176" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="900">TheStatsAndStacks</text>
    <text x="${CONTENT_X + CONTENT_W}" y="176" text-anchor="end" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800">FRAME ${String(slideNumber).padStart(2, '0')}</text>
  </g>`;
}

function renderVisualSystem(
  x: number,
  y: number,
  width: number,
  height: number,
  theme: SlideTheme,
  context: VisualContext
): string {
  const innerX = x + 28;
  const innerY = y + 46;
  const innerW = width - 56;
  const bottomY = y + height - 28;
  const bodyH = Math.max(136, height - 116);
  const label = `<text x="${x + 28}" y="${y + 34}" fill="#9fb2c8" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="900" letter-spacing="1">${escapeXml(context.label)}</text>`;
  const shell = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="18" fill="#07111f" stroke="${theme.stroke}" stroke-width="1.6"/>
  <rect x="${x + 1}" y="${y + 1}" width="${width - 2}" height="58" rx="17" fill="#0b1626" opacity="0.72"/>`;

  if (theme.visualKind === 'accounts') {
    return `${shell}
  ${label}
  ${renderEditorialCards(innerX, innerY + 14, innerW, Math.min(150, bodyH), theme, context.chips, ['Priority', 'Tax room', 'Goal fit', 'Next move'])}
  ${renderSignalFooter(innerX, bottomY, innerW, theme, context.leftLabel, context.rightLabel)}`;
  }

  if (theme.visualKind === 'market') {
    return `${shell}
  ${label}
  ${renderMiniCandles(innerX, innerY + 10, innerW - 238, bodyH, theme)}
  <rect x="${innerX + innerW - 198}" y="${innerY + 12}" width="192" height="${bodyH - 2}" rx="22" fill="${theme.card}" stroke="${theme.stroke}"/>
  <text x="${innerX + innerW - 160}" y="${innerY + 58}" fill="${theme.secondaryAccent}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900">CHECK</text>
  <text x="${innerX + innerW - 160}" y="${innerY + 96}" fill="#dbeafe" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900">Risk first</text>
  <text x="${innerX + innerW - 160}" y="${innerY + 124}" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700">No buy signals</text>
  <rect x="${innerX + innerW - 160}" y="${innerY + 154}" width="126" height="12" rx="6" fill="#1f3147"/>
  <rect x="${innerX + innerW - 160}" y="${innerY + 154}" width="82" height="12" rx="6" fill="${theme.accent}"/>`;
  }

  if (theme.visualKind === 'cashflow') {
    return `${shell}
  ${label}
  ${renderLedgerFlow(innerX, innerY + 14, innerW, bodyH, theme, context.chips)}
  ${renderSignalFooter(innerX, bottomY, innerW, theme, context.leftLabel, context.rightLabel)}`;
  }

  if (theme.visualKind === 'credit' || theme.visualKind === 'tax') {
    const rows = theme.visualKind === 'credit' ? ['MYTH', 'FACT', 'VERIFY'] : ['DOCS', 'ROOM', 'PROOF'];
    const rowH = 44;
    const rowGap = 14;
    const startY = innerY + Math.max(8, Math.floor((bodyH - rows.length * rowH - (rows.length - 1) * rowGap) / 2));
    return `${shell}
  ${label}
  ${rows.map((row, index) => {
    const rowY = startY + index * (rowH + rowGap);
    const color = index === 1 ? theme.secondaryAccent : theme.accent;
    return `<g>
      <rect x="${innerX}" y="${rowY}" width="${innerW}" height="${rowH}" rx="13" fill="${theme.card}" stroke="${theme.stroke}"/>
      <rect x="${innerX}" y="${rowY}" width="${Math.round(innerW * (0.45 + index * 0.16))}" height="${rowH}" rx="13" fill="${color}" opacity="0.24"/>
      <text x="${innerX + 20}" y="${rowY + 29}" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900">${row}</text>
      <text x="${innerX + innerW - 20}" y="${rowY + 29}" text-anchor="end" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="800">${escapeXml(context.chips[index])}</text>
    </g>`;
  }).join('')}`;
  }

  return `${shell}
  ${label}
  ${renderDecisionMatrix(innerX, innerY + 14, innerW, 132, theme, context.chips)}
  ${renderSignalFooter(innerX, bottomY, innerW, theme, context.leftLabel, context.rightLabel)}`;
}

function renderCoverVisualSystem(
  x: number,
  y: number,
  width: number,
  height: number,
  theme: SlideTheme,
  context: VisualContext,
  points: string[]
): string {
  const innerX = x + 30;
  const innerY = y + 36;
  const innerW = width - 60;
  const cardY = innerY + 50;
  const cardH = height - 108;
  const leftW = Math.round(innerW * 0.52);
  const rightX = innerX + leftW + 36;
  const rightW = innerW - leftW - 36;
  const rowLabels = points.slice(0, 2).map((point) => clampText(point, 42, '...'));

  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="20" fill="#050B14" stroke="${theme.stroke}" stroke-width="1.8"/>
    <rect x="${x + 1}" y="${y + 1}" width="${width - 2}" height="${height - 2}" rx="19" fill="${theme.accent}" opacity="0.045"/>
    <text x="${innerX}" y="${y + 34}" fill="#9fb2c8" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" letter-spacing="1">${escapeXml(context.label.toUpperCase())}</text>
    <rect x="${innerX}" y="${cardY}" width="${leftW}" height="${cardH}" rx="24" fill="${theme.card}" stroke="${theme.stroke}" stroke-width="1.4"/>
    <path d="M${innerX + 34} ${cardY + cardH - 42} C${innerX + 130} ${cardY + 70}, ${innerX + 248} ${cardY + cardH - 110}, ${innerX + leftW - 36} ${cardY + 54}" fill="none" stroke="${theme.secondaryAccent}" stroke-width="5" opacity="0.58"/>
    <circle cx="${innerX + 88}" cy="${cardY + 92}" r="50" fill="${theme.accent}" opacity="0.14"/>
    <circle cx="${innerX + 88}" cy="${cardY + 92}" r="20" fill="${theme.secondaryAccent}" opacity="0.9"/>
    <text x="${innerX + 154}" y="${cardY + 82}" fill="${theme.accent}" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="900">FILTER</text>
    <text x="${innerX + 154}" y="${cardY + 120}" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="900">Risk first</text>
    <text x="${innerX + 34}" y="${cardY + cardH - 34}" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="800">One idea. Clear tradeoffs.</text>
    <rect x="${rightX}" y="${cardY}" width="${rightW}" height="${cardH}" rx="24" fill="#07111f" stroke="${theme.stroke}" stroke-width="1.4"/>
    <text x="${rightX + 30}" y="${cardY + 50}" fill="${theme.secondaryAccent}" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="900">WHY SWIPE</text>
    ${rowLabels.map((label, index) => {
      const rowY = cardY + 78 + index * 70;
      const color = index === 1 ? theme.secondaryAccent : theme.accent;
      return `<g>
        <rect x="${rightX + 30}" y="${rowY}" width="${rightW - 60}" height="46" rx="15" fill="${theme.card}" stroke="${theme.stroke}" stroke-width="1.1"/>
        <rect x="${rightX + 48}" y="${rowY + 29}" width="${Math.round((rightW - 104) * (0.58 + index * 0.16))}" height="7" rx="4" fill="${color}" opacity="0.76"/>
        <text x="${rightX + 48}" y="${rowY + 23}" fill="#e5eefb" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="900">${escapeXml(label)}</text>
      </g>`;
    }).join('')}
  </g>`;
}

function renderPointCards(points: string[], y: number, theme: SlideTheme): string {
  return points.slice(0, 3).map((point, index) => {
    const rowY = y + index * POINT_ROW_GAP;
    const color = index === 1 ? theme.secondaryAccent : theme.accent;
    const lines = wrapText(point, 56, 2);
    return `<g>
      <rect x="${CONTENT_X}" y="${rowY}" width="${CONTENT_W}" height="${POINT_ROW_H}" rx="16" fill="${theme.card}" stroke="${theme.stroke}" stroke-width="1.5"/>
      <rect x="${CONTENT_X + 24}" y="${rowY + 21}" width="34" height="34" rx="10" fill="${color}" opacity="0.2" stroke="${color}" stroke-width="1.5"/>
      <text x="${CONTENT_X + 41}" y="${rowY + 45}" text-anchor="middle" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900">${index + 1}</text>
      <text x="${CONTENT_X + 82}" y="${rowY + 32}" fill="#e5eefb" font-family="Arial, Helvetica, sans-serif" font-size="${lines.length > 1 ? 19 : 21}" font-weight="850">
        ${lines.map((line, lineIndex) => `<tspan x="${CONTENT_X + 82}" dy="${lineIndex === 0 ? 0 : 25}">${escapeXml(line)}</tspan>`).join('')}
      </text>
    </g>`;
  }).join('');
}

function renderSaveCard(y: number, theme: SlideTheme): string {
  return `<g>
    <rect x="${CONTENT_X}" y="${y}" width="${CONTENT_W}" height="${SAVE_CARD_H}" rx="20" fill="#07111f" stroke="${theme.stroke}" stroke-width="1.4"/>
    <text x="${CONTENT_X + 34}" y="${y + 47}" fill="${theme.accent}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900">Save this framework for later.</text>
    <text x="${CONTENT_X + CONTENT_W - 34}" y="${y + 47}" text-anchor="end" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800">Educational only</text>
  </g>`;
}

function renderFooter(slideNumber: number, theme: SlideTheme): string {
  return `<g>
    <text x="${CONTENT_X}" y="1250" fill="#a8b5c7" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="650">${slideNumber === 1 ? 'Swipe for the decision framework' : 'Educational only, not financial advice'}</text>
    <circle cx="912" cy="1222" r="46" fill="${theme.accent}" opacity="0.15"/>
    <circle cx="912" cy="1222" r="18" fill="${theme.secondaryAccent}"/>
  </g>`;
}

function renderBackgroundGeometry(theme: SlideTheme): string {
  return `<g opacity="0.9">
    <path d="M680 -60 L1120 -60 L1120 360 C960 318 836 206 680 -60 Z" fill="${theme.accent}" opacity="0.09"/>
    <path d="M-70 1070 C166 940 396 1010 596 1370 L-70 1370 Z" fill="${theme.secondaryAccent}" opacity="0.07"/>
    <path d="M420 -80 L562 -80 L338 1370 L194 1370 Z" fill="${theme.tertiaryAccent}" opacity="0.045"/>
  </g>`;
}

function renderMiniCandles(x: number, y: number, width: number, height: number, theme: SlideTheme): string {
  const candles = [
    [0.52, 0.18, 0.72, 0.34],
    [0.36, 0.12, 0.56, 0.48],
    [0.50, 0.28, 0.78, 0.66],
    [0.68, 0.34, 0.86, 0.42],
    [0.44, 0.20, 0.62, 0.32],
    [0.34, 0.16, 0.58, 0.52],
    [0.54, 0.26, 0.74, 0.38],
    [0.40, 0.18, 0.68, 0.60],
  ];
  const gap = 18;
  const candleW = (width - gap * (candles.length - 1)) / candles.length;
  const grid = [0, 1, 2, 3].map((line) => {
    const gy = y + (height / 3) * line;
    return `<line x1="${x}" y1="${gy}" x2="${x + width}" y2="${gy}" stroke="#26384f" stroke-width="1"/>`;
  }).join('');
  return `<g>
    <rect x="${x}" y="${y - 14}" width="${width}" height="${height + 28}" rx="22" fill="#050d19" stroke="${theme.stroke}"/>
    ${grid}
    ${candles.map((candle, index) => {
      const cx = x + index * (candleW + gap) + candleW / 2;
      const openY = y + candle[0] * height;
      const highY = y + candle[1] * height;
      const lowY = y + candle[2] * height;
      const closeY = y + candle[3] * height;
      const up = closeY < openY;
      const color = up ? theme.accent : '#fb7185';
      const bodyY = Math.min(openY, closeY);
      const bodyH = Math.max(9, Math.abs(openY - closeY));
      return `<line x1="${cx}" y1="${highY}" x2="${cx}" y2="${lowY}" stroke="${color}" stroke-width="5" stroke-linecap="round"/>
      <rect x="${cx - candleW / 2}" y="${bodyY}" width="${candleW}" height="${bodyH}" rx="5" fill="${color}"/>`;
    }).join('')}
  </g>`;
}

function renderEditorialCards(
  x: number,
  y: number,
  width: number,
  height: number,
  theme: SlideTheme,
  labels: string[],
  captions: string[]
): string {
  const gap = 14;
  const cardW = (width - gap * 3) / 4;
  return `<g>
    ${labels.slice(0, 4).map((label, index) => {
      const cardX = x + index * (cardW + gap);
      const color = index % 2 === 0 ? theme.accent : theme.secondaryAccent;
      return `<g>
        <rect x="${cardX}" y="${y}" width="${cardW}" height="${height}" rx="16" fill="${theme.card}" stroke="${theme.stroke}" stroke-width="1.4"/>
        <rect x="${cardX + 14}" y="${y + 14}" width="42" height="42" rx="12" fill="${color}" opacity="0.18" stroke="${color}" stroke-width="1.3"/>
        <text x="${cardX + 35}" y="${y + 42}" text-anchor="middle" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900">${String(index + 1).padStart(2, '0')}</text>
        <text x="${cardX + 16}" y="${y + 84}" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900">${escapeXml(label)}</text>
        <text x="${cardX + 16}" y="${y + 112}" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="800">${escapeXml(captions[index])}</text>
      </g>`;
    }).join('')}
  </g>`;
}

function renderLedgerFlow(
  x: number,
  y: number,
  width: number,
  height: number,
  theme: SlideTheme,
  labels: string[]
): string {
  const rowH = 32;
  const rowGap = 10;
  const amounts = ['55%', '15%', '20%', '10%'];
  const firstRowY = y + Math.max(18, Math.floor((height - (rowH * 4 + rowGap * 3)) / 2));
  const labelW = 118;
  const amountW = 66;
  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="16" fill="${theme.card}" stroke="${theme.stroke}" stroke-width="1.4"/>
    ${labels.slice(0, 4).map((label, index) => {
      const rowY = firstRowY + index * (rowH + rowGap);
      const color = index === 0 ? theme.accent : index === 1 ? theme.secondaryAccent : theme.tertiaryAccent;
      const barTrackX = x + labelW + 32;
      const barTrackW = width - labelW - amountW - 64;
      const barW = Math.round(barTrackW * (0.44 + index * 0.1));
      return `<g>
        <text x="${x + 22}" y="${rowY + 22}" fill="#e5eefb" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900">${escapeXml(label)}</text>
        <rect x="${barTrackX}" y="${rowY}" width="${barTrackW}" height="${rowH}" rx="9" fill="#06101d" stroke="#1f3147" stroke-width="1"/>
        <rect x="${barTrackX}" y="${rowY}" width="${barW}" height="${rowH}" rx="9" fill="${color}" opacity="0.32"/>
        <text x="${x + width - 24}" y="${rowY + 22}" text-anchor="end" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900">${amounts[index]}</text>
      </g>`;
    }).join('')}
  </g>`;
}

function renderDecisionMatrix(
  x: number,
  y: number,
  width: number,
  height: number,
  theme: SlideTheme,
  labels: string[]
): string {
  const cols = labels.slice(0, 3);
  const gap = 14;
  const cellW = (width - gap * 2) / 3;
  return `<g>
    ${cols.map((label, index) => {
      const cellX = x + index * (cellW + gap);
      const color = index === 1 ? theme.secondaryAccent : theme.accent;
      return `<g>
        <rect x="${cellX}" y="${y}" width="${cellW}" height="${height}" rx="16" fill="${theme.card}" stroke="${theme.stroke}" stroke-width="1.4"/>
        <text x="${cellX + 20}" y="${y + 36}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="900">${escapeXml(label)}</text>
        <rect x="${cellX + 20}" y="${y + 58}" width="${cellW - 40}" height="12" rx="6" fill="#1f3147"/>
        <rect x="${cellX + 20}" y="${y + 58}" width="${Math.round((cellW - 40) * (0.48 + index * 0.16))}" height="12" rx="6" fill="${color}"/>
        <text x="${cellX + 20}" y="${y + 104}" fill="#e5eefb" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900">${index === 0 ? 'Define' : index === 1 ? 'Compare' : 'Act'}</text>
      </g>`;
    }).join('')}
  </g>`;
}

function renderSignalFooter(
  x: number,
  bottomY: number,
  width: number,
  theme: SlideTheme,
  leftLabel: string,
  rightLabel: string
): string {
  return `<g>
    <rect x="${x}" y="${bottomY - 32}" width="${width}" height="40" rx="14" fill="#050d19" stroke="${theme.stroke}" stroke-width="1.2"/>
    <rect x="${x + 16}" y="${bottomY - 16}" width="${Math.round(width * 0.42)}" height="8" rx="4" fill="${theme.accent}" opacity="0.72"/>
    <rect x="${x + Math.round(width * 0.52)}" y="${bottomY - 16}" width="${Math.round(width * 0.22)}" height="8" rx="4" fill="${theme.secondaryAccent}" opacity="0.52"/>
    <text x="${x + 18}" y="${bottomY + 1}" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900">${escapeXml(leftLabel)}</text>
    <text x="${x + width - 18}" y="${bottomY + 1}" text-anchor="end" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900">${escapeXml(rightLabel)}</text>
  </g>`;
}

function normalizePoints(points: string[], slideNumber: number, description: string): string[] {
  const defaults = getDefaultPointHints(description, slideNumber);
  const merged = [...points, ...defaults].map((point) => clampText(point, 88));
  return uniqueTexts(merged).slice(0, 3);
}

function getDefaultPointHints(description: string, slideNumber: number): string[] {
  const lower = description.toLowerCase();
  if (slideNumber === 1) {
    return ['Start with the goal', 'Spot the tradeoff', 'Save the framework'];
  }
  if (/stock|watchlist|valuation|ticker|portfolio|earnings|market|balance sheet|catalyst/.test(lower)) {
    return ['Source the numbers', 'Stress-test the risk', 'Decide without hype'];
  }
  if (/payday|bill|debt|emergency|spend|budget|money disappears|cash/.test(lower)) {
    return ['Name the money job', 'Protect the buffer', 'Automate the next step'];
  }
  if (/tfsa|rrsp|fhsa|account|contribution/.test(lower)) {
    return ['Match account to goal', 'Check contribution room', 'Verify before moving money'];
  }
  if (/credit|score|balance|utilization|card/.test(lower)) {
    return ['Separate myth from fact', 'Watch utilization', 'Pay on time'];
  }
  if (/tax|deduction|refund|filing/.test(lower)) {
    return ['Keep the proof', 'Check the deadline', 'Verify the claim'];
  }
  return ['Name the tradeoff', 'Check the downside', 'Choose the next step'];
}

function getSlideLayoutWarnings(input: {
  titleBottomY: number;
  visualY: number;
  visualBottomY: number;
  pointsY: number;
  pointsBottomY: number;
  footerY: number;
  saveBottomY: number;
}): string[] {
  const warnings: string[] = [];
  if (input.visualY - input.titleBottomY < 28) {
    warnings.push('Headline and visual module are too close.');
  }
  if (input.pointsY - input.visualBottomY < 24) {
    warnings.push('Visual module and point cards are too close.');
  }
  if (input.footerY - input.pointsBottomY < 28) {
    warnings.push('Point cards and save card are too close.');
  }
  if (input.saveBottomY > 1218) {
    warnings.push('Save card is too low for the footer safe area.');
  }
  if (input.pointsBottomY > input.footerY - 18) {
    warnings.push('Point cards overlap the save card.');
  }
  return warnings;
}

function getVisualKind(description: string, context: VisualContext): SlideTheme['visualKind'] {
  const lower = description.toLowerCase();
  if (/stock|watchlist|valuation|ticker|portfolio|earnings|candle|market|balance sheet|catalyst|sandisk|sndk|storage|memory|semiconductor|data center|datacenter|margin|guidance/.test(lower)) return 'market';
  if (/payday|bill|debt|emergency|spend|budget|money disappears|cash/.test(lower)) return 'cashflow';
  if (/credit|score|balance|utilization|card/.test(lower)) return 'credit';
  if (/tfsa|rrsp|fhsa|account|contribution/.test(lower) || context.label.includes('ACCOUNT')) return 'accounts';
  if (/tax|deduction|refund|filing/.test(lower)) return 'tax';
  return 'decision';
}

function getVisualContext(description: string): VisualContext {
  const lower = description.toLowerCase();
  if (/sandisk|sndk|storage|memory|semiconductor|data center|datacenter|nand/.test(lower)) {
    return { label: 'AI storage heat map', chips: ['CATALYST', 'MARGIN', 'CYCLE', 'RISK'], leftLabel: 'HEADLINE', rightLabel: 'THESIS' };
  }
  if (/earnings|revenue|margin|cash flow|guidance/.test(lower)) {
    return { label: 'Earnings quality check', chips: ['REV', 'MARGIN', 'CASH', 'GUIDE'], leftLabel: 'REPORT', rightLabel: 'THESIS' };
  }
  if (/stock|watchlist|valuation|ticker|portfolio|balance sheet|catalyst/.test(lower)) {
    return { label: 'Research screen', chips: ['QUALITY', 'RISK', 'VALUE', 'FIT'], leftLabel: 'HYPE', rightLabel: 'THESIS' };
  }
  if (/payday|bill|debt|emergency|spend|budget|money disappears|cash/.test(lower)) {
    return { label: 'Money flow system', chips: ['BILLS', 'BUFFER', 'DEBT', 'GOALS'], leftLabel: 'CASH IN', rightLabel: 'PLAN' };
  }
  if (/credit|score|balance|utilization|card/.test(lower)) {
    return { label: 'Credit signal filter', chips: ['MYTH', 'FACT', 'SCORE', 'RISK'], leftLabel: 'NOISE', rightLabel: 'SIGNAL' };
  }
  if (/tfsa|rrsp|fhsa|account|contribution/.test(lower)) {
    return { label: 'Account priority framework', chips: ['TFSA', 'RRSP', 'FHSA', 'GOAL'], leftLabel: 'TODAY', rightLabel: 'FUTURE' };
  }
  if (/tax|deduction|refund|filing/.test(lower)) {
    return { label: 'Tax checklist map', chips: ['DOCS', 'DATES', 'ROOM', 'PROOF'], leftLabel: 'CLAIM', rightLabel: 'VERIFY' };
  }
  return { label: 'Decision framework', chips: ['GOAL', 'TIME', 'RISK', 'NEXT'], leftLabel: 'QUESTION', rightLabel: 'ACTION' };
}

function getDailyTheme(seed = ''): SlideTheme {
  const themes: SlideTheme[] = [
    {
      name: 'terminal-green',
      labelPrefix: 'MAP',
      accent: '#16c784',
      secondaryAccent: '#f6c453',
      tertiaryAccent: '#38bdf8',
      bgMid: '#0d1b2a',
      bgEnd: '#111111',
      panel: '#101b2d',
      panelEnd: '#07111f',
      card: '#0b1626',
      stroke: '#263b52',
      visualKind: 'decision',
    },
    {
      name: 'cyan-gold',
      labelPrefix: 'AUDIT',
      accent: '#38bdf8',
      secondaryAccent: '#f59e0b',
      tertiaryAccent: '#22c55e',
      bgMid: '#111827',
      bgEnd: '#0c0a09',
      panel: '#111827',
      panelEnd: '#09090b',
      card: '#111827',
      stroke: '#334155',
      visualKind: 'decision',
    },
    {
      name: 'teal-rose',
      labelPrefix: 'FILTER',
      accent: '#2dd4bf',
      secondaryAccent: '#fb7185',
      tertiaryAccent: '#c084fc',
      bgMid: '#0f1b2b',
      bgEnd: '#171717',
      panel: '#101827',
      panelEnd: '#0f172a',
      card: '#101827',
      stroke: '#334155',
      visualKind: 'decision',
    },
    {
      name: 'emerald-violet',
      labelPrefix: 'TIMELINE',
      accent: '#34d399',
      secondaryAccent: '#c084fc',
      tertiaryAccent: '#60a5fa',
      bgMid: '#111827',
      bgEnd: '#0b1020',
      panel: '#101827',
      panelEnd: '#070b15',
      card: '#101827',
      stroke: '#2f3f61',
      visualKind: 'decision',
    },
  ];

  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return themes[Math.abs(hashString(`${dayIndex}:${seed}`)) % themes.length];
}

function buildSlideFilename(runSlug: string, slideNumber: number): string {
  return `${sanitizeFilePart(runSlug)}_slide_${String(slideNumber).padStart(2, '0')}.png`;
}

function wrapText(value: string, maxChars: number, maxLines = Number.POSITIVE_INFINITY): string[] {
  const words = value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length > maxLines) lines.length = maxLines;

  const renderedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (renderedWords < words.length && lines.length > 0) {
    lines[lines.length - 1] = clampText(lines[lines.length - 1], Math.max(6, maxChars - 3), '...');
  }

  return lines.length ? lines : [' '];
}

function uniqueTexts(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clampText(value: string, maxLength: number, suffix = ''): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - suffix.length)).trim()}${suffix}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
