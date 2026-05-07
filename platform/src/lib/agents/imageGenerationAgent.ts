import { BaseAgent } from './interfaces';
import OpenAI from 'openai';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { getRunSlug, sanitizeFilePart } from '../services/dateUtils';

export interface GeneratedImage {
  slideNumber: number;
  localPath: string;
  mimeType: string;
  source: 'local' | 'openai';
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
const SAVE_CARD_H = 104;

export class ImageGenerationAgent extends BaseAgent {
  constructor() {
    super('ImageGenerationAgent');
  }

  async execute(input: {
    prompts: Array<{ slideNumber: number; slideDescription: string; dallePrompt: string }>,
    outputDir: string
  }): Promise<{ images: GeneratedImage[] }> {
    fs.mkdirSync(input.outputDir, { recursive: true });
    const runSlug = getRunSlug();
    const freeOnly = process.env.FREE_IMAGE_GENERATION_ONLY !== 'false';
    if (!freeOnly && process.env.ALLOW_PAID_IMAGE_GENERATION === 'true' && process.env.OPENAI_API_KEY) {
      return this.generateWithOpenAI({ ...input, runSlug });
    }

    console.log(`[${this.name}] Using premium zero-cost local PNG slide generation.`);
    return this.generateLocalSlides({ ...input, runSlug });
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
    const rendered = this.createSlideSvg(prompt.slideNumber, prompt.slideDescription, runSlug);
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
  const leftW = Math.round(innerW * 0.44);
  const rightX = innerX + leftW + 34;
  const rightW = innerW - leftW - 34;
  const badgeLabels = ['SAVE', 'SHARE', 'FOLLOW'];
  const rowLabels = points.slice(0, 3).map((point) => clampText(point, 34, '...'));
  const subcopyY = innerY + Math.min(212, height - 92);
  const badgeY = innerY + Math.max(154, height - 112);
  const rowH = 44;
  const rowGap = Math.max(52, Math.floor((height - 112) / 3));

  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="20" fill="#050B14" stroke="${theme.stroke}" stroke-width="1.8"/>
    <rect x="${x + 1}" y="${y + 1}" width="${width - 2}" height="${height - 2}" rx="19" fill="${theme.accent}" opacity="0.045"/>
    <path d="M${x + 28} ${y + height - 42} C${x + 210} ${y + height - 154}, ${x + 394} ${y + 32}, ${x + width - 34} ${y + 72}" fill="none" stroke="${theme.secondaryAccent}" stroke-width="4" opacity="0.28"/>
    <text x="${innerX}" y="${y + 34}" fill="#9fb2c8" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900" letter-spacing="1">${escapeXml(context.label.toUpperCase())}</text>
    <rect x="${innerX}" y="${innerY + 32}" width="${leftW}" height="${height - 104}" rx="26" fill="${theme.card}" stroke="${theme.stroke}" stroke-width="1.5"/>
    <circle cx="${innerX + 86}" cy="${innerY + 104}" r="52" fill="${theme.accent}" opacity="0.16"/>
    <circle cx="${innerX + 86}" cy="${innerY + 104}" r="26" fill="${theme.secondaryAccent}" opacity="0.82"/>
    <text x="${innerX + 154}" y="${innerY + 82}" fill="${theme.accent}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900">FRAMEWORK</text>
    <text x="${innerX + 154}" y="${innerY + 122}" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="900">Save this</text>
    <text x="${innerX + 34}" y="${subcopyY}" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="800">One clean rule. No hype.</text>
    ${badgeLabels.map((label, index) => {
      const badgeX = innerX + 34 + index * 116;
      const color = index === 1 ? theme.secondaryAccent : index === 2 ? theme.tertiaryAccent : theme.accent;
      return `<g>
        <rect x="${badgeX}" y="${badgeY}" width="96" height="38" rx="19" fill="${color}" opacity="0.16" stroke="${color}" stroke-width="1.2"/>
        <text x="${badgeX + 48}" y="${badgeY + 25}" text-anchor="middle" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="900">${label}</text>
      </g>`;
    }).join('')}
    <rect x="${rightX}" y="${innerY + 34}" width="${rightW}" height="${height - 108}" rx="26" fill="#07111f" stroke="${theme.stroke}" stroke-width="1.4"/>
    ${rowLabels.map((label, index) => {
      const rowY = innerY + 62 + index * rowGap;
      const color = index === 1 ? theme.secondaryAccent : theme.accent;
      return `<g>
        <rect x="${rightX + 26}" y="${rowY}" width="${rightW - 52}" height="${rowH}" rx="14" fill="${theme.card}" stroke="${theme.stroke}" stroke-width="1.2"/>
        <text x="${rightX + 44}" y="${rowY + 20}" fill="#dbeafe" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="900">${escapeXml(label)}</text>
        <rect x="${rightX + 44}" y="${rowY + 29}" width="${Math.round((rightW - 112) * (0.44 + index * 0.16))}" height="8" rx="4" fill="${color}" opacity="0.72"/>
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
    <rect x="${CONTENT_X}" y="${y}" width="${CONTENT_W}" height="${SAVE_CARD_H}" rx="24" fill="#07111f" stroke="${theme.stroke}" stroke-width="1.5"/>
    <text x="${CONTENT_X + 36}" y="${y + 44}" fill="${theme.accent}" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="900">Save the framework. Share the risk check.</text>
    <text x="${CONTENT_X + 36}" y="${y + 78}" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">Follow for Canadian finance without hype.</text>
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
