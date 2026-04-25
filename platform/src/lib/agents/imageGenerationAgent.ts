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
}

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
    if (process.env.ALLOW_PAID_IMAGE_GENERATION === 'true' && process.env.OPENAI_API_KEY) {
      return this.generateWithOpenAI({ ...input, runSlug });
    }

    console.log(`[${this.name}] 🖼️  Using cost-safe local PNG slide generation (no paid image API calls).`);
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
    console.log(`[${this.name}] 🖼️  Generating ${input.prompts.length} premium background images with OpenAI ${model} (${quality}, ${size}).`);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const images: GeneratedImage[] = [];
    for (const prompt of input.prompts) {
      console.log(`   → Generating slide ${prompt.slideNumber}...`);

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
          await this.writePremiumCompositedSlide(buffer, prompt.slideNumber, prompt.slideDescription, localPath, input.runSlug);

          images.push({ slideNumber: prompt.slideNumber, localPath, mimeType: 'image/png', source: 'openai' });
          console.log(`   ✅ Slide ${prompt.slideNumber} saved.`);
          break;
        } catch (error) {
          retries++;
          const message = error instanceof Error ? error.message : 'Unknown image generation error';
          console.error(`   ❌ Attempt ${retries} failed: ${message}`);
          if (retries === 2) {
            console.warn(`   ⚠️  Falling back to local renderer for slide ${prompt.slideNumber}.`);
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
      console.log(`   ✅ Slide ${prompt.slideNumber} saved locally.`);
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
    const svg = this.createSlideSvg(prompt.slideNumber, prompt.slideDescription, runSlug);
    await sharp(Buffer.from(svg)).png().toFile(localPath);
    return { slideNumber: prompt.slideNumber, localPath, mimeType: 'image/png', source: 'local' };
  }

  private async writePremiumCompositedSlide(
    background: Buffer,
    slideNumber: number,
    description: string,
    localPath: string,
    runSlug: string
  ): Promise<void> {
    const overlay = this.createPremiumOverlaySvg(slideNumber, description, runSlug);
    await sharp(background)
      .resize(1080, 1350, { fit: 'cover' })
      .composite([{ input: Buffer.from(overlay), top: 0, left: 0 }])
      .png()
      .toFile(localPath);
  }

  private createSlideSvg(slideNumber: number, description: string, runSlug: string): string {
    const cleanDescription = description.replace(/^Slide\s+\d+:\s*/i, '').trim();
    const [headlinePart, ...supportingPoints] = cleanDescription.split('|').map((part) => part.trim()).filter(Boolean);
    const title = headlinePart || cleanDescription || description;
    const lines = wrapText(title, 23).slice(0, 5);
    const lineTspans = lines
      .map((line, index) => `<tspan x="118" y="${350 + index * 72}">${escapeXml(line)}</tspan>`)
      .join('');

    const eyebrow = slideNumber === 1 ? 'CANADIAN MONEY MAP' : `FRAME ${String(slideNumber).padStart(2, '0')}`;
    const footer = slideNumber === 1 ? 'Swipe for the decision framework' : 'Educational only, not financial advice';
    const theme = getDailyTheme(`${runSlug}:${cleanDescription}`);
    const pointCards = buildPointCards(supportingPoints.slice(0, 3), theme);
    const accent = slideNumber % 2 === 0 ? theme.accent : theme.secondaryAccent;
    const secondaryAccent = slideNumber % 2 === 0 ? theme.secondaryAccent : theme.accent;
    const visual = buildVisualSystem(slideNumber, accent, secondaryAccent, theme);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#06111f"/>
      <stop offset="48%" stop-color="${theme.bgMid}"/>
      <stop offset="100%" stop-color="${theme.bgEnd}"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.panel}" stop-opacity="0.98"/>
      <stop offset="100%" stop-color="${theme.panelEnd}" stop-opacity="0.96"/>
    </linearGradient>
    <radialGradient id="spot" cx="72%" cy="18%" r="70%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.2"/>
      <stop offset="55%" stop-color="${secondaryAccent}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
      <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#23384c" stroke-width="1" opacity="0.42"/>
    </pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="28" stdDeviation="24" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <rect width="1080" height="1350" fill="url(#spot)"/>
  <rect width="1080" height="1350" fill="url(#grid)" opacity="0.5"/>
  <path d="M 700 -30 L 1120 -30 L 1120 410 C 980 355 850 270 700 -30 Z" fill="${accent}" opacity="0.12"/>
  <path d="M -40 1110 C 180 1010 330 1120 520 1348 L -40 1348 Z" fill="${secondaryAccent}" opacity="0.08"/>
  <rect x="52" y="50" width="976" height="1250" rx="38" fill="none" stroke="#2c4055" stroke-width="2"/>
  ${theme.backgroundShape}
  <rect x="86" y="88" width="908" height="1174" rx="30" fill="url(#panel)" filter="url(#shadow)"/>
  <text x="592" y="370" fill="#ffffff" opacity="0.045" font-family="Arial, Helvetica, sans-serif" font-size="250" font-weight="900">${String(slideNumber).padStart(2, '0')}</text>
  <rect x="118" y="126" width="92" height="9" rx="4.5" fill="${accent}"/>
  <rect x="226" y="126" width="56" height="9" rx="4.5" fill="${secondaryAccent}"/>
  <text x="118" y="192" fill="#e5e7eb" font-family="Arial, Helvetica, sans-serif" font-size="35" font-weight="800">TheStatsAndStacks</text>
  <text x="118" y="268" fill="${secondaryAccent}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900">${escapeXml(theme.labelPrefix)} / ${escapeXml(eyebrow)}</text>
  <text fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="62" font-weight="900">${lineTspans}</text>
  ${visual}
  ${pointCards}
  <rect x="118" y="1016" width="842" height="122" rx="24" fill="${theme.card}" stroke="${theme.stroke}"/>
  <text x="158" y="1069" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900">Built for saves, not hype.</text>
  <text x="158" y="1112" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="24">Clear rules. Better decisions. No guru talk.</text>
  <text x="118" y="1208" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="25">${escapeXml(footer)}</text>
  <circle cx="902" cy="1200" r="56" fill="${accent}" opacity="0.16"/>
  <circle cx="902" cy="1200" r="22" fill="${secondaryAccent}" opacity="0.95"/>
  </svg>`;
  }

  private createPremiumOverlaySvg(slideNumber: number, description: string, runSlug: string): string {
    const cleanDescription = description.replace(/^Slide\s+\d+:\s*/i, '').trim();
    const [headlinePart, ...supportingPoints] = cleanDescription.split('|').map((part) => part.trim()).filter(Boolean);
    const title = headlinePart || cleanDescription || description;
    const titleLines = wrapText(title, 22).slice(0, 5);
    const titleTspans = titleLines
      .map((line, index) => `<tspan x="112" y="${330 + index * 74}">${escapeXml(line)}</tspan>`)
      .join('');
    const theme = getDailyTheme(`${runSlug}:premium:${cleanDescription}`);
    const accent = slideNumber % 2 === 0 ? theme.accent : theme.secondaryAccent;
    const secondaryAccent = slideNumber % 2 === 0 ? theme.secondaryAccent : theme.accent;
    const points = supportingPoints.length ? supportingPoints.slice(0, 3) : ['Save the framework', 'Verify the details', 'Decide without hype'];

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#020617" stop-opacity="0.92"/>
      <stop offset="56%" stop-color="#020617" stop-opacity="0.76"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0.45"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a" stop-opacity="0.84"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0.68"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#000000" flood-opacity="0.38"/>
    </filter>
  </defs>
  <rect width="1080" height="1350" fill="url(#scrim)"/>
  <rect x="54" y="54" width="972" height="1242" rx="34" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="2"/>
  <rect x="86" y="92" width="908" height="1170" rx="30" fill="url(#glass)" stroke="#ffffff" stroke-opacity="0.1" filter="url(#softShadow)"/>
  <rect x="112" y="128" width="98" height="9" rx="4.5" fill="${accent}"/>
  <rect x="226" y="128" width="58" height="9" rx="4.5" fill="${secondaryAccent}"/>
  <text x="112" y="190" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="900">TheStatsAndStacks</text>
  <text x="112" y="262" fill="${secondaryAccent}" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="900">${slideNumber === 1 ? 'PREMIUM MONEY BRIEF' : `FRAME ${String(slideNumber).padStart(2, '0')}`}</text>
  <text fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="900">${titleTspans}</text>
  ${points.map((point, index) => buildOverlayPoint(point, index, accent, secondaryAccent)).join('\n  ')}
  <rect x="112" y="1012" width="856" height="124" rx="24" fill="#020617" fill-opacity="0.48" stroke="#ffffff" stroke-opacity="0.1"/>
  <text x="152" y="1066" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900">Built for saves, not hype.</text>
  <text x="152" y="1110" fill="#dbeafe" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700">Clear framework. Better questions. No guru talk.</text>
  <text x="112" y="1208" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="24">${slideNumber === 1 ? 'Swipe for the framework' : 'Educational only, not financial advice'}</text>
  <circle cx="902" cy="1200" r="55" fill="${accent}" opacity="0.14"/>
  <circle cx="902" cy="1200" r="22" fill="${secondaryAccent}" opacity="0.96"/>
</svg>`;
  }
}

interface SlideTheme {
  name: string;
  labelPrefix: string;
  accent: string;
  secondaryAccent: string;
  bgMid: string;
  bgEnd: string;
  panel: string;
  panelEnd: string;
  card: string;
  stroke: string;
  visualKind: 'wave' | 'bars' | 'ladder' | 'matrix' | 'radar';
  backgroundShape: string;
}

function buildPointCards(points: string[], theme: SlideTheme): string {
  if (points.length === 0) {
    return `<rect x="118" y="706" width="842" height="172" rx="24" fill="${theme.card}" stroke="${theme.stroke}"/>
  <text x="158" y="774" fill="${theme.accent}" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="900">Keep it simple.</text>
  <text x="158" y="830" fill="#dbeafe" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700">One clear idea per slide. Save the framework.</text>`;
  }

  return points.map((point, index) => {
    const y = 690 + index * 100;
    const wrapped = wrapText(point, 42).slice(0, 2);
    const tspans = wrapped
      .map((line, lineIndex) => `<tspan x="214" y="${y + 43 + lineIndex * 31}">${escapeXml(line)}</tspan>`)
      .join('');
    return `<rect x="118" y="${y}" width="842" height="82" rx="22" fill="${theme.card}" stroke="${theme.stroke}"/>
  <circle cx="164" cy="${y + 41}" r="19" fill="${index === 1 ? theme.secondaryAccent : theme.accent}" opacity="0.98"/>
  <text fill="#dbeafe" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800">${tspans}</text>`;
  }).join('\n  ');
}

function buildVisualSystem(slideNumber: number, accent: string, secondaryAccent: string, theme: SlideTheme): string {
  const chipY = 565;
  const sparkline = slideNumber % 2 === 0
    ? 'M 126 636 C 210 606 258 646 334 610 S 480 572 548 612 S 690 666 780 598 S 910 560 956 584'
    : 'M 126 636 C 210 674 270 588 346 620 S 492 668 566 596 S 704 552 778 602 S 892 656 956 578';

  if (theme.visualKind === 'bars') {
    return `<text x="118" y="514" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="800">PRIORITY SCOREBOARD</text>
  <rect x="118" y="540" width="842" height="92" rx="24" fill="#07111f" stroke="${theme.stroke}"/>
  ${buildBar(154, 600, 132, accent, 'RISK')}
  ${buildBar(356, 575, 170, secondaryAccent, 'TAX')}
  ${buildBar(590, 615, 118, accent, 'TIME')}
  ${buildBar(772, 560, 185, secondaryAccent, 'GOAL')}`;
  }

  if (theme.visualKind === 'ladder') {
    return `<text x="118" y="514" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="800">STEP-BY-STEP MONEY LADDER</text>
  <rect x="118" y="540" width="842" height="92" rx="24" fill="#07111f" stroke="${theme.stroke}"/>
  <path d="M 156 602 L 302 602 L 302 572 L 450 572 L 450 612 L 606 612 L 606 558 L 770 558 L 770 586 L 930 586" fill="none" stroke="${secondaryAccent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="156" cy="602" r="12" fill="${accent}"/><circle cx="450" cy="612" r="12" fill="${accent}"/><circle cx="930" cy="586" r="12" fill="${accent}"/>`;
  }

  if (theme.visualKind === 'matrix') {
    return `<text x="118" y="514" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="800">MYTH / FACT FILTER</text>
  <rect x="118" y="540" width="842" height="92" rx="24" fill="#07111f" stroke="${theme.stroke}"/>
  <rect x="154" y="565" width="160" height="42" rx="21" fill="${secondaryAccent}" opacity="0.18" stroke="${secondaryAccent}"/><text x="234" y="593" text-anchor="middle" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900">MYTH</text>
  <path d="M 348 586 L 522 586" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>
  <rect x="556" y="565" width="160" height="42" rx="21" fill="${accent}" opacity="0.18" stroke="${accent}"/><text x="636" y="593" text-anchor="middle" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="900">FACT</text>
  <text x="786" y="594" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800">FILTER</text>`;
  }

  if (theme.visualKind === 'radar') {
    return `<text x="118" y="514" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="800">TIMELINE RISK MAP</text>
  <rect x="118" y="540" width="842" height="92" rx="24" fill="#07111f" stroke="${theme.stroke}"/>
  <path d="M 158 600 L 342 560 L 526 600 L 710 560 L 916 600" fill="none" stroke="${secondaryAccent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 158 600 L 342 560 L 526 600 L 710 560 L 916 600 L 916 625 L 158 625 Z" fill="${accent}" opacity="0.12"/>
  <text x="164" y="590" fill="#dbeafe" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800">CASH</text>
  <text x="820" y="590" fill="#dbeafe" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800">GROWTH</text>`;
  }

  return `<rect x="118" y="540" width="842" height="92" rx="24" fill="#07111f" stroke="#263b52"/>
  ${buildChip(145, chipY, 'TFSA', accent)}
  ${buildChip(326, chipY, 'RRSP', secondaryAccent)}
  ${buildChip(510, chipY, 'FHSA', accent)}
  <text x="725" y="594" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800">CANADA</text>
  <path d="${sparkline}" fill="none" stroke="${secondaryAccent}" stroke-width="7" stroke-linecap="round" opacity="0.95"/>
  <circle cx="956" cy="${slideNumber % 2 === 0 ? 584 : 578}" r="10" fill="${accent}"/>
  <text x="118" y="514" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="800">ACCOUNT PRIORITY FRAMEWORK</text>`;
}

function buildBar(x: number, y: number, height: number, color: string, label: string): string {
  return `<rect x="${x}" y="${642 - height}" width="82" height="${height}" rx="18" fill="${color}" opacity="0.82"/>
  <text x="${x + 41}" y="612" text-anchor="middle" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="900">${label}</text>`;
}

function buildChip(x: number, y: number, label: string, color: string): string {
  return `<rect x="${x}" y="${y - 34}" width="136" height="54" rx="27" fill="${color}" opacity="0.16" stroke="${color}" stroke-width="2"/>
  <text x="${x + 68}" y="${y}" text-anchor="middle" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900">${label}</text>`;
}

function getDailyTheme(seed = ''): SlideTheme {
  const themes: SlideTheme[] = [
    {
      name: 'market-terminal',
      labelPrefix: 'MAP',
      accent: '#10b981',
      secondaryAccent: '#d4a843',
      bgMid: '#0e1728',
      bgEnd: '#151515',
      panel: '#111c30',
      panelEnd: '#08111f',
      card: '#0b1626',
      stroke: '#263b52',
      visualKind: 'wave',
      backgroundShape: '<path d="M 690 -10 L 1120 -10 L 1120 410 C 960 340 830 260 690 -10 Z" fill="#10b981" opacity="0.1"/>',
    },
    {
      name: 'audit-report',
      labelPrefix: 'AUDIT',
      accent: '#38bdf8',
      secondaryAccent: '#f59e0b',
      bgMid: '#111827',
      bgEnd: '#0c0a09',
      panel: '#111827',
      panelEnd: '#09090b',
      card: '#111827',
      stroke: '#334155',
      visualKind: 'bars',
      backgroundShape: '<path d="M -60 160 L 420 -40 L 560 1360 L -60 1360 Z" fill="#38bdf8" opacity="0.07"/>',
    },
    {
      name: 'payday-system',
      labelPrefix: 'SYSTEM',
      accent: '#22c55e',
      secondaryAccent: '#eab308',
      bgMid: '#102019',
      bgEnd: '#101010',
      panel: '#102018',
      panelEnd: '#07130f',
      card: '#0d1b15',
      stroke: '#27513d',
      visualKind: 'ladder',
      backgroundShape: '<path d="M 560 -80 L 1120 200 L 1120 1360 L 870 1360 Z" fill="#eab308" opacity="0.07"/>',
    },
    {
      name: 'myth-lab',
      labelPrefix: 'FILTER',
      accent: '#2dd4bf',
      secondaryAccent: '#fb7185',
      bgMid: '#111827',
      bgEnd: '#171717',
      panel: '#111827',
      panelEnd: '#0f172a',
      card: '#101827',
      stroke: '#334155',
      visualKind: 'matrix',
      backgroundShape: '<path d="M -80 1030 C 220 860 510 980 820 1360 L -80 1360 Z" fill="#fb7185" opacity="0.07"/>',
    },
    {
      name: 'timeline-map',
      labelPrefix: 'TIMELINE',
      accent: '#34d399',
      secondaryAccent: '#c084fc',
      bgMid: '#111827',
      bgEnd: '#0b1020',
      panel: '#101827',
      panelEnd: '#070b15',
      card: '#101827',
      stroke: '#2f3f61',
      visualKind: 'radar',
      backgroundShape: '<path d="M 740 -40 C 860 210 1010 360 1120 430 L 1120 -40 Z" fill="#c084fc" opacity="0.08"/>',
    },
  ];

  const dayIndex = Math.floor(Date.now() / 86_400_000);
  return themes[Math.abs(hashString(`${dayIndex}:${seed}`)) % themes.length];
}

function buildSlideFilename(runSlug: string, slideNumber: number): string {
  return `${sanitizeFilePart(runSlug)}_slide_${String(slideNumber).padStart(2, '0')}.png`;
}

function buildOverlayPoint(point: string, index: number, accent: string, secondaryAccent: string): string {
  const y = 680 + index * 102;
  const color = index === 1 ? secondaryAccent : accent;
  const tspans = wrapText(point, 42).slice(0, 2)
    .map((line, lineIndex) => `<tspan x="210" y="${y + 43 + lineIndex * 31}">${escapeXml(line)}</tspan>`)
    .join('');

  return `<rect x="112" y="${y}" width="856" height="84" rx="22" fill="#020617" fill-opacity="0.5" stroke="#ffffff" stroke-opacity="0.1"/>
  <circle cx="160" cy="${y + 42}" r="20" fill="${color}" opacity="0.96"/>
  <text fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800">${tspans}</text>`;
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

function wrapText(value: string, maxChars: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
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
  }

  if (current) lines.push(current);
  return lines;
}
