import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { BaseAgent } from './interfaces';
import { GeneratedImage } from './imageGenerationAgent';
import { StrategyDecision } from './contentStrategyAgent';
import { getLocalDateKey, getRunSlug, sanitizeFilePart } from '../services/dateUtils';

export type VideoGenerationMode = 'disabled' | 'auto' | 'always' | 'alternating';

export interface GeneratedVideo {
  localPath: string;
  mimeType: 'video/mp4';
  source: 'local-ffmpeg';
  width: number;
  height: number;
  durationSeconds: number;
  frameCount: number;
}

export interface VideoGenerationResult {
  video: GeneratedVideo | null;
  skippedReason?: string;
  framesDir?: string;
  manifestPath?: string;
}

type ReelSceneKind = 'hook' | 'chart' | 'screen' | 'risk' | 'save';

interface ReelScene {
  kind: ReelSceneKind;
  eyebrow: string;
  title: string;
  subtitle: string;
  bullets: string[];
  accent: string;
}

interface ParsedSlide {
  title: string;
  bullets: string[];
}

interface TextLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
}

const DEFAULT_SCENE_SECONDS = 3.15;
const DEFAULT_VIDEO_FPS = 20;
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const SAFE_X = 92;
const SAFE_W = 848;
const TOP_SAFE_Y = 112;
const BRAND_GREEN = '#18C58F';
const BRAND_GOLD = '#E0B64C';
const BRAND_CYAN = '#67E8F9';
const BRAND_ROSE = '#FB7185';
const TEXT = '#F8FAFC';
const SOFT_TEXT = '#CBD5E1';
const MUTED = '#94A3B8';
const PANEL = '#0B1626';
const PANEL_2 = '#101B2E';
const STROKE = '#2A3B59';

export class VideoGenerationAgent extends BaseAgent {
  constructor() {
    super('VideoGenerationAgent');
  }

  static getMode(): VideoGenerationMode {
    const configured = (process.env.VIDEO_GENERATION_MODE || 'auto').toLowerCase();
    if (configured === 'disabled' || configured === 'always' || configured === 'alternating') return configured;
    return 'auto';
  }

  static isAvailable(): boolean {
    return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
  }

  static willRenderToday(date = new Date()): boolean {
    const mode = VideoGenerationAgent.getMode();
    if (mode === 'disabled') return false;
    if (mode === 'always' || mode === 'auto') return true;
    return isAlternatingVideoDay(date);
  }

  static shouldRenderForStrategy(strategy: Pick<StrategyDecision, 'format'>, date = new Date()): boolean {
    const mode = VideoGenerationAgent.getMode();
    if (mode === 'disabled') return false;
    if (mode === 'always') return true;
    if (mode === 'alternating') return isAlternatingVideoDay(date);
    return strategy.format === 'REEL_DRAFT';
  }

  async execute(input: {
    images: GeneratedImage[];
    strategy: StrategyDecision;
    outputDir: string;
  }): Promise<VideoGenerationResult> {
    console.log(`[${this.name}] Rendering Instagram-safe animated Reel...`);

    if (!VideoGenerationAgent.shouldRenderForStrategy(input.strategy)) {
      return { video: null, skippedReason: 'Video generation mode did not request a video for this strategy.' };
    }

    if (!VideoGenerationAgent.isAvailable()) {
      return {
        video: null,
        skippedReason: 'ffmpeg is not installed. Install ffmpeg to enable free local MP4 video rendering.',
      };
    }

    fs.mkdirSync(input.outputDir, { recursive: true });
    const runSlug = sanitizeFilePart(getRunSlug());
    const outputPath = path.join(input.outputDir, `${runSlug}_premium_reel.mp4`);
    const framesDir = path.join(input.outputDir, `${runSlug}_premium_reel_frames`);
    const scenes = buildReelScenes(input.strategy);
    const fps = getVideoFps();
    const sceneSeconds = getSceneSeconds();
    const framesPerScene = Math.max(42, Math.round(sceneSeconds * fps));
    const frameCount = scenes.length * framesPerScene;
    const durationSeconds = Number((frameCount / fps).toFixed(1));
    const seed = hashText(`${input.strategy.topic} ${input.strategy.hook}`);

    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const sceneIndex = Math.floor(frameIndex / framesPerScene);
      const sceneFrame = frameIndex % framesPerScene;
      const progress = framesPerScene <= 1 ? 1 : sceneFrame / (framesPerScene - 1);
      const globalProgress = frameCount <= 1 ? 1 : frameIndex / (frameCount - 1);
      const svg = renderFrame({
        scene: scenes[sceneIndex],
        sceneIndex,
        sceneCount: scenes.length,
        progress,
        globalProgress,
        seed: seed + sceneIndex * 73,
      });
      const framePath = path.join(framesDir, `${String(frameIndex + 1).padStart(5, '0')}.png`);
      await sharp(Buffer.from(svg)).png().toFile(framePath);
    }

    await runFfmpeg(buildEncodeArgs({ framesDir, outputPath, fps, durationSeconds }));

    if (process.env.KEEP_VIDEO_FRAMES !== 'true') {
      fs.rmSync(framesDir, { recursive: true, force: true });
    }

    return {
      video: {
        localPath: outputPath,
        mimeType: 'video/mp4',
        source: 'local-ffmpeg',
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        durationSeconds,
        frameCount,
      },
      framesDir: process.env.KEEP_VIDEO_FRAMES === 'true' ? framesDir : undefined,
    };
  }
}

function getSceneSeconds(): number {
  const parsed = Number(process.env.VIDEO_SCENE_SECONDS || DEFAULT_SCENE_SECONDS);
  if (!Number.isFinite(parsed)) return DEFAULT_SCENE_SECONDS;
  return Math.max(2.6, Math.min(4, parsed));
}

function getVideoFps(): number {
  const parsed = Number(process.env.VIDEO_FPS || DEFAULT_VIDEO_FPS);
  if (!Number.isFinite(parsed)) return DEFAULT_VIDEO_FPS;
  return Math.max(18, Math.min(30, Math.round(parsed)));
}

function isAlternatingVideoDay(date: Date): boolean {
  const localDateKey = getLocalDateKey(date);
  const [year, month, day] = localDateKey.split('-').map(Number);
  const utcDay = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  const cycleDay = ((utcDay % 4) + 4) % 4;
  return cycleDay >= 2;
}

function buildEncodeArgs(input: {
  framesDir: string;
  outputPath: string;
  fps: number;
  durationSeconds: number;
}): string[] {
  const duration = input.durationSeconds.toFixed(2);
  const fadeOutStart = Math.max(0, input.durationSeconds - 1.15).toFixed(2);
  const audioFilter = [
    `[1:a]volume=0.024,afade=t=in:st=0:d=0.8,afade=t=out:st=${fadeOutStart}:d=1.15[a1]`,
    `[2:a]volume=0.012,afade=t=in:st=0:d=0.8,afade=t=out:st=${fadeOutStart}:d=1.15[a2]`,
    `[3:a]lowpass=f=850,volume=0.006,afade=t=in:st=0:d=0.6,afade=t=out:st=${fadeOutStart}:d=1.15[a3]`,
    '[a1][a2][a3]amix=inputs=3:duration=shortest,alimiter=limit=0.18[a]',
  ].join(';');

  return [
    '-y',
    '-framerate', String(input.fps),
    '-i', path.join(input.framesDir, '%05d.png'),
    '-f', 'lavfi',
    '-i', `sine=frequency=96:duration=${duration}:sample_rate=44100`,
    '-f', 'lavfi',
    '-i', `sine=frequency=192:duration=${duration}:sample_rate=44100`,
    '-f', 'lavfi',
    '-i', `anoisesrc=color=pink:amplitude=0.018:duration=${duration}:sample_rate=44100`,
    '-filter_complex', audioFilter,
    '-map', '0:v',
    '-map', '[a]',
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-level', '4.1',
    '-preset', process.env.VIDEO_FFMPEG_PRESET || 'veryfast',
    '-crf', process.env.VIDEO_FFMPEG_CRF || '23',
    '-pix_fmt', 'yuv420p',
    '-r', String(input.fps),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    '-movflags', '+faststart',
    input.outputPath,
  ];
}

function buildReelScenes(strategy: StrategyDecision): ReelScene[] {
  const parsed = strategy.slideBreakdown.map(parseSlide);
  const isMarket = isMarketEducation(strategy);
  const hook = cleanShortLine(firstNonEmpty(strategy.hook, parsed[0]?.title, strategy.topic), 70);
  const topic = cleanShortLine(strategy.topic, 72);
  const research = pickBullets(parsed.slice(1), 3);
  const risk = pickRiskBullets(parsed);

  const scenes: ReelScene[] = [
    {
      kind: 'hook',
      eyebrow: isMarket ? 'Market lesson' : 'Money lesson',
      title: hook,
      subtitle: topic,
      bullets: parsed[0]?.bullets?.slice(0, 2) || [],
      accent: BRAND_GREEN,
    },
    {
      kind: 'chart',
      eyebrow: isMarket ? 'Read the chart' : 'Read the flow',
      title: isMarket ? 'Candles are context, not a signal.' : 'The route matters more than the app.',
      subtitle: isMarket ? 'Trend, volume, then thesis.' : 'Cash needs a job before it disappears.',
      bullets: isMarket ? ['Trend', 'Volume', 'Thesis'] : ['Bills', 'Buffer', 'Goals'],
      accent: BRAND_CYAN,
    },
    {
      kind: 'screen',
      eyebrow: isMarket ? 'Research screen' : 'Decision screen',
      title: cleanShortLine(parsed[1]?.title || 'Use a checklist before acting', 62),
      subtitle: cleanShortLine(parsed[1]?.bullets[0] || 'Make the decision slower than the emotion.', 86),
      bullets: research,
      accent: BRAND_GOLD,
    },
    {
      kind: 'risk',
      eyebrow: 'Risk check',
      title: cleanShortLine(risk[0] || 'What could prove this wrong?', 58),
      subtitle: cleanShortLine(risk[1] || 'Good finance content shows the downside too.', 86),
      bullets: risk,
      accent: BRAND_ROSE,
    },
    {
      kind: 'save',
      eyebrow: 'Save this',
      title: cleanShortLine(parsed[parsed.length - 1]?.title || 'Research first. Decide later.', 62),
      subtitle: 'Education only. Verify the numbers before decisions.',
      bullets: ['Research', 'Risk', 'Decision'],
      accent: BRAND_GREEN,
    },
  ];

  return scenes.map((scene) => ({
    ...scene,
    title: cleanShortLine(scene.title, 72),
    subtitle: cleanShortLine(scene.subtitle, 92),
    bullets: scene.bullets.map((bullet) => cleanShortLine(bullet, 38)).filter(Boolean).slice(0, 3),
  }));
}

function parseSlide(slide: string): ParsedSlide {
  const cleaned = slide
    .replace(/^slide\s+\d+\s*:\s*/i, '')
    .replace(/^point\s+\d+\s*:\s*/i, '')
    .trim();
  const parts = cleaned.split('|').map((part) => part.trim()).filter(Boolean);
  return {
    title: parts[0] || cleaned || 'Finance lesson',
    bullets: parts.slice(1),
  };
}

function pickBullets(slides: ParsedSlide[], count: number): string[] {
  const bullets: string[] = [];
  for (const slide of slides) {
    if (slide.title) bullets.push(slide.title);
    for (const bullet of slide.bullets) bullets.push(bullet);
    if (bullets.length >= count) break;
  }
  return uniqueTexts(bullets).slice(0, count);
}

function pickRiskBullets(slides: ParsedSlide[]): string[] {
  const riskWords = /(risk|debt|valuation|red flag|guaranteed|hype|interest|wrong|avoid|downside|concentration|liquidity|mistake|advice|recommendation)/i;
  const matches = slides.flatMap((slide) => [slide.title, ...slide.bullets]).filter((text) => riskWords.test(text));
  return uniqueTexts(matches.length ? matches : ['No guaranteed outcomes', 'Check the downside', 'Size the risk']).slice(0, 3);
}

function isMarketEducation(strategy: StrategyDecision): boolean {
  return /(stock|stocks|ticker|market|watchlist|candlestick|candle|earnings|valuation|portfolio|etf|investor|daytrading|trading)/i.test(
    `${strategy.format} ${strategy.topic} ${strategy.searchKeywords?.join(' ') || ''}`
  );
}

function renderFrame(input: {
  scene: ReelScene;
  sceneIndex: number;
  sceneCount: number;
  progress: number;
  globalProgress: number;
  seed: number;
}): string {
  const eased = easeOutCubic(input.progress);
  const body = renderScene(input.scene, input.progress, eased, input.seed);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${VIDEO_WIDTH}" height="${VIDEO_HEIGHT}" viewBox="0 0 ${VIDEO_WIDTH} ${VIDEO_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050B15"/>
      <stop offset="54%" stop-color="#081322"/>
      <stop offset="100%" stop-color="#101014"/>
    </linearGradient>
    <radialGradient id="halo" cx="78%" cy="10%" r="68%">
      <stop offset="0%" stop-color="${input.scene.accent}" stop-opacity="0.20"/>
      <stop offset="58%" stop-color="#0B1220" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#000000" flood-opacity="0.34"/>
    </filter>
  </defs>
  <rect width="${VIDEO_WIDTH}" height="${VIDEO_HEIGHT}" fill="url(#bg)"/>
  <rect width="${VIDEO_WIDTH}" height="${VIDEO_HEIGHT}" fill="url(#halo)"/>
  ${renderBackdrop(input.globalProgress, input.seed)}
  ${renderTopChrome(input.scene, input.sceneIndex, input.sceneCount, input.globalProgress)}
  ${body}
</svg>`;
}

function renderTopChrome(scene: ReelScene, sceneIndex: number, sceneCount: number, globalProgress: number): string {
  const width = Math.max(8, SAFE_W * globalProgress);
  return `<g>
    <text x="${SAFE_X}" y="${TOP_SAFE_Y}" fill="${TEXT}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900">The<tspan fill="${BRAND_GREEN}">Stats</tspan>And<tspan fill="${BRAND_GOLD}">Stacks</tspan></text>
    <text x="${SAFE_X + SAFE_W}" y="${TOP_SAFE_Y}" text-anchor="end" fill="${MUTED}" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="800">${String(sceneIndex + 1).padStart(2, '0')} / ${String(sceneCount).padStart(2, '0')}</text>
    <rect x="${SAFE_X}" y="154" width="${SAFE_W}" height="6" rx="3" fill="#1E293B"/>
    <rect x="${SAFE_X}" y="154" width="${width.toFixed(1)}" height="6" rx="3" fill="${scene.accent}"/>
    <text x="${SAFE_X}" y="212" fill="${scene.accent}" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="900" letter-spacing="3">${escapeXml(scene.eyebrow.toUpperCase())}</text>
  </g>`;
}

function renderBackdrop(progress: number, seed: number): string {
  const spark = buildSparkline(64, 1365, 928, 180, seed, progress);
  return `<g opacity="0.36">
    ${range(0, 9).map((i) => `<line x1="${SAFE_X + i * 106}" y1="250" x2="${SAFE_X + i * 106}" y2="1600" stroke="#20314A" stroke-width="1"/>`).join('')}
    ${range(0, 8).map((i) => `<line x1="48" y1="${300 + i * 158}" x2="1010" y2="${300 + i * 158}" stroke="#20314A" stroke-width="1"/>`).join('')}
    <path d="${spark}" fill="none" stroke="${BRAND_CYAN}" stroke-width="5" stroke-linecap="round" opacity="0.16"/>
    <path d="M-100 ${220 + Math.sin(progress * 6.28) * 20} L1180 ${520 + Math.cos(progress * 6.28) * 26}" stroke="${BRAND_GREEN}" stroke-width="2" opacity="0.13"/>
    <path d="M-120 1560 L1180 ${1260 + Math.sin(progress * 6.28) * 28}" stroke="${BRAND_GOLD}" stroke-width="2" opacity="0.12"/>
  </g>`;
}

function renderScene(scene: ReelScene, progress: number, eased: number, seed: number): string {
  switch (scene.kind) {
    case 'hook':
      return renderHookScene(scene, progress, eased, seed);
    case 'chart':
      return renderChartScene(scene, progress, seed);
    case 'screen':
      return renderScreenScene(scene, progress, eased);
    case 'risk':
      return renderRiskScene(scene, progress);
    case 'save':
      return renderSaveScene(scene, progress, eased, seed);
  }
}

function renderHookScene(scene: ReelScene, progress: number, eased: number, seed: number): string {
  const title = layoutTitle(scene.title, 64, 3);
  const titleY = 360 - 26 * (1 - eased);
  return `<g opacity="${fadeIn(progress, 0, 0.24).toFixed(2)}">
    ${textBlock(title.lines, SAFE_X, titleY, title.fontSize, title.lineHeight, TEXT, 900)}
    ${subtitleBlock(scene.subtitle, SAFE_X, titleY + title.lines.length * title.lineHeight + 46, 34)}
    <rect x="${SAFE_X}" y="780" width="${SAFE_W}" height="484" rx="36" fill="${PANEL}" stroke="${STROKE}" stroke-width="2" filter="url(#shadow)"/>
    ${renderCandles(SAFE_X + 54, 854, 520, 286, seed, clamp(progress * 1.18, 0, 1))}
    ${renderSignalStack(SAFE_X + 612, 864, ['Source it', 'Stress test', 'Decide later'], scene.accent, progress)}
    ${renderPills(scene.bullets.length ? scene.bullets : ['Research first', 'Risk second'], 1318, progress, scene.accent)}
  </g>`;
}

function renderChartScene(scene: ReelScene, progress: number, seed: number): string {
  const title = layoutTitle(scene.title, 56, 3);
  const chartProgress = clamp((progress - 0.12) / 0.68, 0, 1);
  return `<g opacity="${fadeIn(progress, 0, 0.22).toFixed(2)}">
    ${textBlock(title.lines, SAFE_X, 322, title.fontSize, title.lineHeight, TEXT, 900)}
    ${subtitleBlock(scene.subtitle, SAFE_X, 322 + title.lines.length * title.lineHeight + 34, 31)}
    <rect x="${SAFE_X}" y="636" width="${SAFE_W}" height="632" rx="34" fill="${PANEL}" stroke="${STROKE}" stroke-width="2" filter="url(#shadow)"/>
    <text x="${SAFE_X + 42}" y="704" fill="${scene.accent}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900">CANDLESTICK BASICS</text>
    ${renderCandles(SAFE_X + 44, 766, SAFE_W - 88, 336, seed, chartProgress)}
    ${renderPills(['Wick = range', 'Body = open/close', 'Context matters'], 1150, progress, scene.accent)}
    ${renderThreeStep(scene.bullets, 1358, progress, scene.accent)}
  </g>`;
}

function renderScreenScene(scene: ReelScene, progress: number, eased: number): string {
  const title = layoutTitle(scene.title, 54, 3);
  const bullets = scene.bullets.length ? scene.bullets : ['Check the source', 'Check the numbers', 'Check the risk'];
  return `<g opacity="${fadeIn(progress, 0, 0.22).toFixed(2)}">
    ${textBlock(title.lines, SAFE_X, 322, title.fontSize, title.lineHeight, TEXT, 900)}
    ${subtitleBlock(scene.subtitle, SAFE_X, 322 + title.lines.length * title.lineHeight + 34, 31)}
    <rect x="${SAFE_X}" y="698" width="${SAFE_W}" height="574" rx="34" fill="${PANEL}" stroke="${STROKE}" stroke-width="2" filter="url(#shadow)"/>
    ${bullets.slice(0, 3).map((bullet, index) => renderChecklistRow(SAFE_X + 46, 784 + index * 142, index + 1, bullet, scene.accent, fadeIn(progress, 0.12 + index * 0.16, 0.18))).join('')}
    ${renderMeter(SAFE_X + 92, 1366, SAFE_W - 184, 28, eased, scene.accent)}
    <text x="${SAFE_X + SAFE_W / 2}" y="1444" text-anchor="middle" fill="${MUTED}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800">Slow decisions down. Improve the inputs.</text>
  </g>`;
}

function renderRiskScene(scene: ReelScene, progress: number): string {
  const title = layoutTitle(scene.title, 54, 3);
  return `<g opacity="${fadeIn(progress, 0, 0.22).toFixed(2)}">
    ${textBlock(title.lines, SAFE_X, 322, title.fontSize, title.lineHeight, TEXT, 900)}
    ${subtitleBlock(scene.subtitle, SAFE_X, 322 + title.lines.length * title.lineHeight + 34, 31)}
    <rect x="${SAFE_X}" y="698" width="${SAFE_W}" height="574" rx="34" fill="${PANEL}" stroke="#3A2432" stroke-width="2" filter="url(#shadow)"/>
    ${renderRiskGauge(SAFE_X + SAFE_W / 2, 984, 226, clamp((progress - 0.1) / 0.72, 0, 1))}
    ${renderPills(['No price targets', 'No guaranteed returns', 'No copy-my-trades'], 1328, progress, scene.accent)}
  </g>`;
}

function renderSaveScene(scene: ReelScene, progress: number, eased: number, seed: number): string {
  const title = layoutTitle(scene.title, 58, 3);
  return `<g opacity="${fadeIn(progress, 0, 0.22).toFixed(2)}">
    <rect x="${SAFE_X}" y="286" width="${SAFE_W}" height="1012" rx="40" fill="${PANEL}" stroke="${STROKE}" stroke-width="2" filter="url(#shadow)"/>
    ${textBlock(title.lines, SAFE_X + 46, 422, title.fontSize, title.lineHeight, TEXT, 900)}
    ${subtitleBlock(scene.subtitle, SAFE_X + 48, 422 + title.lines.length * title.lineHeight + 44, 30)}
    ${renderBigFormula(SAFE_X + 62, 820, progress)}
    ${renderCandles(SAFE_X + 92, 1132, SAFE_W - 184, 210, seed, eased)}
    <text x="${SAFE_X + SAFE_W / 2}" y="1484" text-anchor="middle" fill="${BRAND_GREEN}" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="900">Save the framework</text>
  </g>`;
}

function layoutTitle(text: string, baseSize: number, maxLines: number): TextLayout {
  const cleaned = cleanShortLine(text, 86);
  const fontSize = cleaned.length > 68 ? baseSize - 10 : cleaned.length > 52 ? baseSize - 5 : baseSize;
  const maxChars = cleaned.length > 68 ? 24 : cleaned.length > 52 ? 22 : 20;
  return {
    lines: wrapText(cleaned, maxChars, maxLines),
    fontSize,
    lineHeight: Math.round(fontSize * 1.14),
  };
}

function textBlock(lines: string[], x: number, y: number, fontSize: number, lineHeight: number, fill: string, weight: number): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="${weight}">
    ${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join('')}
  </text>`;
}

function subtitleBlock(text: string, x: number, y: number, fontSize: number): string {
  const lines = wrapText(cleanShortLine(text, 92), 34, 2);
  return `<text x="${x}" y="${y}" fill="${SOFT_TEXT}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="800">
    ${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : Math.round(fontSize * 1.32)}">${escapeXml(line)}</tspan>`).join('')}
  </text>`;
}

function renderCandles(x: number, y: number, width: number, height: number, seed: number, progress: number): string {
  const candles = makeCandles(seed, 12);
  const values = candles.flatMap((candle) => [candle.open, candle.high, candle.low, candle.close]);
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const toY = (value: number) => y + height - ((value - min) / (max - min)) * height;
  const gap = 14;
  const candleWidth = (width - gap * (candles.length - 1)) / candles.length;
  const visible = Math.ceil(candles.length * progress);

  return `<g>
    <rect x="${x}" y="${y - 26}" width="${width}" height="${height + 52}" rx="26" fill="#06101D" stroke="#263850" stroke-width="1.5"/>
    ${range(0, 4).map((line) => {
      const gy = y + (height / 3) * line;
      return `<line x1="${x + 20}" y1="${gy.toFixed(1)}" x2="${x + width - 20}" y2="${gy.toFixed(1)}" stroke="#22334B" stroke-width="1"/>`;
    }).join('')}
    ${candles.slice(0, visible).map((candle, index) => {
      const cx = x + index * (candleWidth + gap) + candleWidth / 2;
      const openY = toY(candle.open);
      const closeY = toY(candle.close);
      const highY = toY(candle.high);
      const lowY = toY(candle.low);
      const up = candle.close >= candle.open;
      const color = up ? BRAND_GREEN : BRAND_ROSE;
      const bodyY = Math.min(openY, closeY);
      const bodyH = Math.max(8, Math.abs(openY - closeY));
      const opacity = fadeIn(progress, index / candles.length * 0.48, 0.18);
      return `<g opacity="${opacity.toFixed(2)}">
        <line x1="${cx.toFixed(1)}" y1="${highY.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${lowY.toFixed(1)}" stroke="${color}" stroke-width="6" stroke-linecap="round"/>
        <rect x="${(cx - candleWidth / 2).toFixed(1)}" y="${bodyY.toFixed(1)}" width="${candleWidth.toFixed(1)}" height="${bodyH.toFixed(1)}" rx="6" fill="${color}"/>
      </g>`;
    }).join('')}
  </g>`;
}

function makeCandles(seed: number, count: number): Array<{ open: number; high: number; low: number; close: number }> {
  let price = 50 + (seed % 12);
  return range(0, count).map((index) => {
    const move = Math.sin((seed + index * 9) * 0.38) * 4 + index * 0.34;
    const open = price;
    const close = open + move;
    const high = Math.max(open, close) + 3 + Math.abs(Math.cos(seed + index * 2));
    const low = Math.min(open, close) - 3 - Math.abs(Math.sin(seed - index));
    price = close + Math.sin(seed + index) * 1.2;
    return { open, high, low, close };
  });
}

function renderSignalStack(x: number, y: number, labels: string[], accent: string, progress: number): string {
  return labels.map((label, index) => {
    const opacity = fadeIn(progress, 0.16 + index * 0.16, 0.18);
    return `<g opacity="${opacity.toFixed(2)}">
      <rect x="${x}" y="${y + index * 94}" width="230" height="72" rx="18" fill="${PANEL_2}" stroke="${STROKE}" stroke-width="1.5"/>
      <circle cx="${x + 35}" cy="${y + 36 + index * 94}" r="11" fill="${accent}"/>
      <text x="${x + 62}" y="${y + 45 + index * 94}" fill="${TEXT}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="850">${escapeXml(label)}</text>
    </g>`;
  }).join('');
}

function renderPills(labels: string[], y: number, progress: number, accent: string): string {
  const safe = labels.length ? labels.slice(0, 3) : ['Source it', 'Check risk', 'Decide later'];
  return `<g>
    ${safe.map((label, index) => {
      const opacity = fadeIn(progress, 0.18 + index * 0.13, 0.16);
      const width = 238;
      const x = SAFE_X + index * 286;
      return `<g opacity="${opacity.toFixed(2)}">
        <rect x="${x}" y="${y}" width="${width}" height="64" rx="32" fill="${accent}" opacity="0.16" stroke="${accent}" stroke-width="1.8"/>
        <text x="${x + width / 2}" y="${y + 41}" text-anchor="middle" fill="${TEXT}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="900">${escapeXml(cleanShortLine(label, 22))}</text>
      </g>`;
    }).join('')}
  </g>`;
}

function renderThreeStep(labels: string[], y: number, progress: number, accent: string): string {
  const safe = labels.length ? labels.slice(0, 3) : ['Trend', 'Risk', 'Thesis'];
  return safe.map((label, index) => {
    const opacity = fadeIn(progress, 0.22 + index * 0.14, 0.16);
    const x = SAFE_X + 32 + index * 274;
    return `<g opacity="${opacity.toFixed(2)}">
      <circle cx="${x}" cy="${y}" r="27" fill="${accent}" opacity="0.18"/>
      <text x="${x}" y="${y + 9}" text-anchor="middle" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="900">${index + 1}</text>
      <text x="${x + 44}" y="${y + 8}" fill="${TEXT}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="850">${escapeXml(label)}</text>
    </g>`;
  }).join('');
}

function renderChecklistRow(x: number, y: number, index: number, text: string, accent: string, opacity: number): string {
  const lines = wrapText(cleanShortLine(text, 54), 34, 2);
  return `<g opacity="${opacity.toFixed(2)}">
    <rect x="${x}" y="${y}" width="${SAFE_W - 92}" height="108" rx="24" fill="${PANEL_2}" stroke="${STROKE}" stroke-width="1.5"/>
    <circle cx="${x + 54}" cy="${y + 54}" r="30" fill="${accent}" opacity="0.16"/>
    <text x="${x + 54}" y="${y + 64}" text-anchor="middle" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900">${index}</text>
    <text x="${x + 108}" y="${y + 46}" fill="${TEXT}" font-family="Arial, Helvetica, sans-serif" font-size="${lines.length > 1 ? 24 : 27}" font-weight="850">
      ${lines.map((line, lineIndex) => `<tspan x="${x + 108}" dy="${lineIndex === 0 ? 0 : 32}">${escapeXml(line)}</tspan>`).join('')}
    </text>
  </g>`;
}

function renderMeter(x: number, y: number, width: number, height: number, progress: number, accent: string): string {
  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="#101827" stroke="${STROKE}" stroke-width="1"/>
    <rect x="${x}" y="${y}" width="${Math.max(height, width * progress).toFixed(1)}" height="${height}" rx="${height / 2}" fill="${accent}"/>
  </g>`;
}

function renderRiskGauge(cx: number, cy: number, radius: number, progress: number): string {
  const start = polar(cx, cy, radius, 220);
  const end = polar(cx, cy, radius, 320);
  const current = polar(cx, cy, radius, 220 + 100 * progress);
  const needle = polar(cx, cy, radius * 0.74, 220 + 100 * progress);
  return `<g>
    <path d="M${start.x} ${start.y} A${radius} ${radius} 0 0 1 ${end.x} ${end.y}" fill="none" stroke="#263850" stroke-width="42" stroke-linecap="round"/>
    <path d="M${start.x} ${start.y} A${radius} ${radius} 0 0 1 ${current.x} ${current.y}" fill="none" stroke="${BRAND_ROSE}" stroke-width="42" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${needle.x}" y2="${needle.y}" stroke="${TEXT}" stroke-width="10" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="25" fill="${TEXT}"/>
    <text x="${cx}" y="${cy + 124}" text-anchor="middle" fill="${SOFT_TEXT}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="900">Risk before excitement</text>
  </g>`;
}

function renderBigFormula(x: number, y: number, progress: number): string {
  const items = ['Research', 'Risk', 'Decision'];
  return items.map((item, index) => {
    const opacity = fadeIn(progress, 0.12 + index * 0.16, 0.18);
    const rowY = y + index * 116;
    const color = index === 1 ? BRAND_ROSE : index === 2 ? BRAND_GOLD : BRAND_GREEN;
    return `<g opacity="${opacity.toFixed(2)}">
      <rect x="${x}" y="${rowY}" width="724" height="82" rx="24" fill="${PANEL_2}" stroke="${STROKE}" stroke-width="1.5"/>
      <circle cx="${x + 48}" cy="${rowY + 41}" r="18" fill="${color}"/>
      <text x="${x + 92}" y="${rowY + 53}" fill="${TEXT}" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="900">${escapeXml(item)}</text>
    </g>`;
  }).join('');
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  const renderedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (renderedWords < words.length && lines.length > 0) {
    lines[lines.length - 1] = cleanShortLine(lines[lines.length - 1], Math.max(8, maxChars - 3), '...');
  }
  return lines.length ? lines : [' '];
}

function buildSparkline(x: number, y: number, width: number, height: number, seed: number, progress: number): string {
  const points = range(0, 24).map((index) => {
    const px = x + (index / 23) * width;
    const py = y + height / 2 + Math.sin(index * 0.74 + seed) * 40 + Math.cos(index * 0.31 + progress * 4) * 19;
    return `${px.toFixed(1)} ${py.toFixed(1)}`;
  });
  return `M${points.join(' L')}`;
}

function cleanShortLine(text: string, maxLength: number, suffix = ''): string {
  const cleaned = text
    .replace(/^slide\s+\d+\s*:\s*/i, '')
    .replace(/^point\s+\d+\s*:\s*/i, '')
    .replace(/\b(buy|sell|hold)\b/gi, 'research')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - suffix.length)).trim()}${suffix}`;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => value && value.trim())?.trim() || 'Finance lesson';
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

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash || 1);
}

function fadeIn(progress: number, start: number, length: number): number {
  return clamp((progress - start) / length, 0, 1);
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function polar(cx: number, cy: number, radius: number, angleDegrees: number): { x: string; y: string } {
  const radians = (angleDegrees - 90) * Math.PI / 180;
  return {
    x: (cx + radius * Math.cos(radians)).toFixed(1),
    y: (cy + radius * Math.sin(radians)).toFixed(1),
  };
}

function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start) }, (_, index) => start + index);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`ffmpeg exited with code ${code}. ${stderr.trim()}`));
    });
  });
}
