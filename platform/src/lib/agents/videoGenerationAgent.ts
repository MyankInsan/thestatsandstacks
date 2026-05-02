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

type MotionSceneKind = 'intro' | 'chart' | 'flow' | 'checklist' | 'risk' | 'outro';

interface MotionScene {
  kind: MotionSceneKind;
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

const DEFAULT_SCENE_SECONDS = 2.8;
const DEFAULT_VIDEO_FPS = 20;
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const BRAND_GREEN = '#18C58F';
const BRAND_GOLD = '#E0B64C';
const BRAND_CYAN = '#62D7FF';
const BRAND_ROSE = '#FB7185';
const PANEL = '#101B2E';
const PANEL_LIGHT = '#18243A';
const TEXT = '#F8FAFC';
const MUTED = '#94A3B8';

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
    console.log(`[${this.name}] Rendering animated educational Reel...`);

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
    const outputPath = path.join(input.outputDir, `${runSlug}_animated_reel.mp4`);
    const framesDir = path.join(input.outputDir, `${runSlug}_animated_reel_frames`);
    const scenes = buildMotionScenes(input.strategy);
    const fps = getVideoFps();
    const sceneSeconds = getSceneSeconds();
    const framesPerScene = Math.max(24, Math.round(sceneSeconds * fps));
    const frameCount = scenes.length * framesPerScene;
    const durationSeconds = Number((frameCount / fps).toFixed(1));

    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });

    const seed = hashText(`${input.strategy.topic} ${input.strategy.hook}`);
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
        strategy: input.strategy,
        seed,
      });
      const framePath = path.join(framesDir, `${String(frameIndex + 1).padStart(5, '0')}.png`);
      await sharp(Buffer.from(svg)).png().toFile(framePath);
    }

    await runFfmpeg(buildEncodeArgs({
      framesDir,
      outputPath,
      fps,
      durationSeconds,
    }));

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
  const parsed = Number(process.env.VIDEO_SCENE_SECONDS || process.env.VIDEO_SECONDS_PER_SLIDE || DEFAULT_SCENE_SECONDS);
  if (!Number.isFinite(parsed)) return DEFAULT_SCENE_SECONDS;
  return Math.max(2.2, Math.min(4, parsed));
}

function getVideoFps(): number {
  const parsed = Number(process.env.VIDEO_FPS || DEFAULT_VIDEO_FPS);
  if (!Number.isFinite(parsed)) return DEFAULT_VIDEO_FPS;
  return Math.max(16, Math.min(30, Math.round(parsed)));
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
  const fadeOutStart = Math.max(0, input.durationSeconds - 1.2).toFixed(2);
  const duration = input.durationSeconds.toFixed(2);
  const audioFilter = [
    `[1:a]volume=0.032,afade=t=in:st=0:d=0.8,afade=t=out:st=${fadeOutStart}:d=1.2[a1]`,
    `[2:a]volume=0.012,afade=t=in:st=0:d=0.6,afade=t=out:st=${fadeOutStart}:d=1.2[a2]`,
    `[3:a]volume=0.009,afade=t=in:st=0:d=0.6,afade=t=out:st=${fadeOutStart}:d=1.2[a3]`,
    '[a1][a2][a3]amix=inputs=3:duration=shortest,alimiter=limit=0.18[a]',
  ].join(';');

  return [
    '-y',
    '-framerate', String(input.fps),
    '-i', path.join(input.framesDir, '%05d.png'),
    '-f', 'lavfi',
    '-i', `sine=frequency=92:duration=${duration}:sample_rate=44100`,
    '-f', 'lavfi',
    '-i', `sine=frequency=184:beep_factor=2:duration=${duration}:sample_rate=44100`,
    '-f', 'lavfi',
    '-i', `sine=frequency=368:beep_factor=4:duration=${duration}:sample_rate=44100`,
    '-filter_complex', audioFilter,
    '-map', '0:v',
    '-map', '[a]',
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-level', '4.1',
    '-preset', process.env.VIDEO_FFMPEG_PRESET || 'veryfast',
    '-crf', process.env.VIDEO_FFMPEG_CRF || '24',
    '-pix_fmt', 'yuv420p',
    '-r', String(input.fps),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest',
    '-movflags', '+faststart',
    input.outputPath,
  ];
}

function buildMotionScenes(strategy: StrategyDecision): MotionScene[] {
  const parsedSlides = strategy.slideBreakdown.map(parseSlide);
  const isMarketTopic = isMarketEducation(strategy);
  const slideOne = parsedSlides[0] || { title: strategy.hook, bullets: [] };
  const middleSlides = parsedSlides.slice(1, -1);
  const finalSlide = parsedSlides[parsedSlides.length - 1] || slideOne;
  const researchBullets = pickBullets(middleSlides, 3);
  const riskBullets = pickRiskBullets(parsedSlides);
  const accountBullets = pickBullets(middleSlides.slice(2), 3);

  const scenes: MotionScene[] = [
    {
      kind: 'intro',
      eyebrow: strategy.contentPillar || 'TheStatsAndStacks',
      title: firstNonEmpty(strategy.hook, slideOne.title, strategy.topic),
      subtitle: strategy.topic,
      bullets: slideOne.bullets.slice(0, 2),
      accent: BRAND_GREEN,
    },
    isMarketTopic
      ? {
          kind: 'chart',
          eyebrow: 'Chart literacy',
          title: 'Read the candle before the hype',
          subtitle: 'Wicks show the range. Bodies show the open-close fight.',
          bullets: ['Trend first', 'Volume second', 'Thesis last'],
          accent: BRAND_CYAN,
        }
      : {
          kind: 'flow',
          eyebrow: 'Money system',
          title: 'Map where the cash actually goes',
          subtitle: 'A simple route beats a vague budget.',
          bullets: accountBullets.length ? accountBullets : ['Bills', 'Buffer', 'Goals'],
          accent: BRAND_CYAN,
        },
    {
      kind: 'checklist',
      eyebrow: isMarketTopic ? 'Research screen' : 'Action screen',
      title: middleSlides[0]?.title || 'Use a checklist before acting',
      subtitle: middleSlides[0]?.bullets[0] || 'Make the decision slower than the emotion.',
      bullets: researchBullets,
      accent: BRAND_GOLD,
    },
    {
      kind: isMarketTopic ? 'flow' : 'checklist',
      eyebrow: isMarketTopic ? 'Research order' : 'Fix order',
      title: middleSlides[1]?.title || (isMarketTopic ? 'Research first. Decide later.' : 'Fix the visible leak first'),
      subtitle: middleSlides[1]?.bullets[0] || 'The order matters more than the excitement.',
      bullets: accountBullets.length ? accountBullets : researchBullets,
      accent: isMarketTopic ? BRAND_GREEN : BRAND_GOLD,
    },
    {
      kind: 'risk',
      eyebrow: 'Risk check',
      title: riskBullets[0] || 'What could prove this wrong?',
      subtitle: riskBullets[1] || 'Good content shows the downside too.',
      bullets: riskBullets.slice(0, 3),
      accent: BRAND_ROSE,
    },
    {
      kind: 'outro',
      eyebrow: 'Save this',
      title: finalSlide.title || 'Save before you act',
      subtitle: 'Education only. Verify the numbers before making decisions.',
      bullets: finalSlide.bullets.length ? finalSlide.bullets.slice(0, 3) : ['Research first', 'Risk check second', 'Decision last'],
      accent: BRAND_GREEN,
    },
  ];

  return scenes.map((scene) => ({
    ...scene,
    title: clampText(scene.title, 78),
    subtitle: clampText(scene.subtitle, 120),
    bullets: scene.bullets.map((bullet) => clampText(bullet, 70)).filter(Boolean).slice(0, 3),
  }));
}

function parseSlide(slide: string): ParsedSlide {
  const cleaned = slide.replace(/^slide\s+\d+\s*:\s*/i, '').trim();
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
  const riskWords = /(risk|debt|valuation|red flag|guaranteed|hype|interest|wrong|avoid|downside|concentration|liquidity|mistake)/i;
  const matches = slides.flatMap((slide) => [slide.title, ...slide.bullets]).filter((text) => riskWords.test(text));
  return uniqueTexts(matches.length ? matches : ['No guaranteed outcomes', 'Check the downside', 'Size the risk']).slice(0, 3);
}

function isMarketEducation(strategy: StrategyDecision): boolean {
  return /(stock|stocks|ticker|market|watchlist|candlestick|candle|earnings|valuation|portfolio|etf|investor)/i.test(
    `${strategy.format} ${strategy.topic} ${strategy.searchKeywords?.join(' ') || ''}`
  );
}

function renderFrame(input: {
  scene: MotionScene;
  sceneIndex: number;
  sceneCount: number;
  progress: number;
  globalProgress: number;
  strategy: StrategyDecision;
  seed: number;
}): string {
  const eased = easeOutCubic(input.progress);
  const sceneBody = renderSceneBody(input.scene, input.progress, eased, input.seed + input.sceneIndex * 97);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${VIDEO_WIDTH}" height="${VIDEO_HEIGHT}" viewBox="0 0 ${VIDEO_WIDTH} ${VIDEO_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07111F"/>
      <stop offset="48%" stop-color="#0A1424"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#132038"/>
      <stop offset="100%" stop-color="#0B1322"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="${VIDEO_WIDTH}" height="${VIDEO_HEIGHT}" fill="url(#bg)"/>
  ${renderAnimatedBackdrop(input.globalProgress, input.seed)}
  ${renderHeader(input.scene, input.sceneIndex, input.sceneCount, input.globalProgress)}
  ${sceneBody}
  ${renderFooter(input.strategy)}
</svg>`;
}

function renderSceneBody(scene: MotionScene, progress: number, eased: number, seed: number): string {
  switch (scene.kind) {
    case 'intro':
      return renderIntroScene(scene, progress, eased, seed);
    case 'chart':
      return renderChartScene(scene, progress, eased, seed);
    case 'flow':
      return renderFlowScene(scene, progress, eased);
    case 'checklist':
      return renderChecklistScene(scene, progress, eased);
    case 'risk':
      return renderRiskScene(scene, progress, eased);
    case 'outro':
      return renderOutroScene(scene, progress, eased, seed);
  }
}

function renderHeader(scene: MotionScene, sceneIndex: number, sceneCount: number, globalProgress: number): string {
  const progressWidth = Math.max(4, 936 * globalProgress);
  return `
  <g>
    <text x="72" y="88" fill="${TEXT}" font-family="Inter, Arial, sans-serif" font-size="31" font-weight="800">The<tspan fill="${BRAND_GREEN}">Stats</tspan>And<tspan fill="${BRAND_GOLD}">Stacks</tspan></text>
    <text x="1008" y="86" text-anchor="end" fill="${MUTED}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700">${String(sceneIndex + 1).padStart(2, '0')} / ${String(sceneCount).padStart(2, '0')}</text>
    <rect x="72" y="124" width="936" height="7" rx="3.5" fill="#1E293B"/>
    <rect x="72" y="124" width="${progressWidth.toFixed(1)}" height="7" rx="3.5" fill="${scene.accent}"/>
    <text x="72" y="174" fill="${scene.accent}" font-family="Inter, Arial, sans-serif" font-size="23" font-weight="800" letter-spacing="2">${escapeXml(scene.eyebrow.toUpperCase())}</text>
  </g>`;
}

function renderFooter(strategy: StrategyDecision): string {
  const topic = clampText(strategy.topic, 58);
  return `
  <g>
    <rect x="72" y="1786" width="936" height="1" fill="#25344F"/>
    <text x="72" y="1838" fill="${MUTED}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="600">${escapeXml(topic)}</text>
    <text x="1008" y="1838" text-anchor="end" fill="${BRAND_GOLD}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800">Education, not advice</text>
  </g>`;
}

function renderAnimatedBackdrop(progress: number, seed: number): string {
  const lineA = 120 + 22 * Math.sin(progress * Math.PI * 2);
  const lineB = 1360 + 40 * Math.cos(progress * Math.PI * 2);
  const ticker = buildSparkline(70, 1430, 940, 210, seed, progress);
  return `
  <g opacity="0.38">
    ${range(0, 12).map((i) => `<line x1="${72 + i * 78}" y1="220" x2="${72 + i * 78}" y2="1730" stroke="#1F2C44" stroke-width="1"/>`).join('')}
    ${range(0, 12).map((i) => `<line x1="50" y1="${260 + i * 118}" x2="1030" y2="${260 + i * 118}" stroke="#1F2C44" stroke-width="1"/>`).join('')}
    <path d="${ticker}" fill="none" stroke="${BRAND_CYAN}" stroke-width="5" stroke-linecap="round" opacity="0.22"/>
    <line x1="-120" y1="${lineA.toFixed(1)}" x2="1200" y2="${(lineA + 340).toFixed(1)}" stroke="${BRAND_GREEN}" stroke-width="2" opacity="0.22"/>
    <line x1="-120" y1="${lineB.toFixed(1)}" x2="1200" y2="${(lineB - 260).toFixed(1)}" stroke="${BRAND_GOLD}" stroke-width="2" opacity="0.18"/>
  </g>`;
}

function renderIntroScene(scene: MotionScene, progress: number, eased: number, seed: number): string {
  const titleY = 474 - 32 * (1 - eased);
  const cardY = 1090 + 45 * (1 - eased);
  const title = textBlock(scene.title, 72, titleY, 62, 72, 86, TEXT, 900, 4);
  const subtitle = textBlock(scene.subtitle, 76, titleY + 330, 37, 32, 43, MUTED, 650, 3);
  const points = scene.bullets.length ? scene.bullets : ['Learn the framework', 'Check the risk'];
  return `
  <g opacity="${fadeIn(progress, 0, 0.3).toFixed(2)}">
    <rect x="72" y="290" width="936" height="680" rx="34" fill="url(#panel)" stroke="#263854" stroke-width="2" filter="url(#softShadow)"/>
    ${title}
    ${subtitle}
    ${renderMiniSignalCards(points, cardY, progress)}
    ${renderCandles(610, 765, 330, 210, seed, Math.min(1, progress * 1.35), true)}
  </g>`;
}

function renderChartScene(scene: MotionScene, progress: number, eased: number, seed: number): string {
  const chartProgress = clamp((progress - 0.12) / 0.75, 0, 1);
  const title = textBlock(scene.title, 72, 308, 54, 58, 70, TEXT, 900, 3);
  const subtitle = textBlock(scene.subtitle, 76, 536, 42, 30, 42, MUTED, 650, 3);
  return `
  <g opacity="${fadeIn(progress, 0, 0.24).toFixed(2)}">
    ${title}
    ${subtitle}
    <rect x="72" y="690" width="936" height="720" rx="30" fill="${PANEL}" stroke="#263854" stroke-width="2" filter="url(#softShadow)"/>
    <text x="116" y="762" fill="${BRAND_CYAN}" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="800">CANDLESTICK LESSON</text>
    ${renderCandles(118, 825, 642, 440, seed, chartProgress, false)}
    ${renderCallout(784, 830, 'Wick', 'Full trading range', BRAND_CYAN, fadeIn(progress, 0.35, 0.2))}
    ${renderCallout(784, 1014, 'Body', 'Open vs close', BRAND_GREEN, fadeIn(progress, 0.48, 0.2))}
    ${renderCallout(784, 1198, 'Context', 'One candle is not a thesis', BRAND_GOLD, fadeIn(progress, 0.62, 0.2))}
    ${renderBulletStrip(scene.bullets, 1540, eased, scene.accent)}
  </g>`;
}

function renderFlowScene(scene: MotionScene, progress: number, eased: number): string {
  const title = textBlock(scene.title, 72, 306, 52, 56, 68, TEXT, 900, 3);
  const subtitle = textBlock(scene.subtitle, 76, 520, 42, 30, 42, MUTED, 650, 3);
  const labels = scene.bullets.length >= 3 ? scene.bullets.slice(0, 3) : ['Research', 'Risk check', 'Decision'];
  return `
  <g opacity="${fadeIn(progress, 0, 0.24).toFixed(2)}">
    ${title}
    ${subtitle}
    <rect x="72" y="690" width="936" height="720" rx="30" fill="${PANEL}" stroke="#263854" stroke-width="2" filter="url(#softShadow)"/>
    ${renderRoutingPath(progress, scene.accent)}
    ${renderFlowCard(132, 780, '1', labels[0], 'Start with the facts', BRAND_CYAN, fadeIn(progress, 0.10, 0.2))}
    ${renderFlowCard(454, 1038, '2', labels[1], 'Then pressure-test it', BRAND_GOLD, fadeIn(progress, 0.34, 0.2))}
    ${renderFlowCard(132, 1296, '3', labels[2], 'Act only after sizing risk', BRAND_GREEN, fadeIn(progress, 0.58, 0.2))}
    ${renderBulletStrip(scene.bullets, 1540, eased, scene.accent)}
  </g>`;
}

function renderChecklistScene(scene: MotionScene, progress: number, eased: number): string {
  const title = textBlock(scene.title, 72, 310, 53, 56, 68, TEXT, 900, 3);
  const subtitle = textBlock(scene.subtitle, 76, 542, 42, 30, 42, MUTED, 650, 3);
  const bullets = scene.bullets.length ? scene.bullets : ['Check the source', 'Check the numbers', 'Check the risk'];
  return `
  <g opacity="${fadeIn(progress, 0, 0.22).toFixed(2)}">
    ${title}
    ${subtitle}
    <rect x="72" y="718" width="936" height="670" rx="30" fill="${PANEL}" stroke="#263854" stroke-width="2" filter="url(#softShadow)"/>
    ${bullets.slice(0, 3).map((bullet, index) => renderChecklistItem(132, 800 + index * 178, index + 1, bullet, scene.accent, fadeIn(progress, 0.16 + index * 0.18, 0.18))).join('')}
    ${renderMeter(160, 1428, 760, 34, eased, scene.accent)}
    <text x="540" y="1530" text-anchor="middle" fill="${MUTED}" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700">Slow the decision down. Make the inputs better.</text>
  </g>`;
}

function renderRiskScene(scene: MotionScene, progress: number, eased: number): string {
  const title = textBlock(scene.title, 72, 308, 53, 56, 68, TEXT, 900, 3);
  const subtitle = textBlock(scene.subtitle, 76, 530, 42, 30, 42, MUTED, 650, 3);
  const riskProgress = clamp((progress - 0.16) / 0.66, 0, 1);
  return `
  <g opacity="${fadeIn(progress, 0, 0.22).toFixed(2)}">
    ${title}
    ${subtitle}
    <rect x="72" y="704" width="936" height="724" rx="30" fill="${PANEL}" stroke="#3A2432" stroke-width="2" filter="url(#softShadow)"/>
    ${renderRiskGauge(540, 1010, 260, riskProgress)}
    ${renderCallout(126, 1236, 'No certainty', 'Avoid guaranteed-return language.', BRAND_ROSE, fadeIn(progress, 0.42, 0.18))}
    ${renderCallout(548, 1236, 'No signal alone', 'Charts support research. They do not replace it.', BRAND_GOLD, fadeIn(progress, 0.56, 0.18))}
    ${renderBulletStrip(scene.bullets, 1540, eased, scene.accent)}
  </g>`;
}

function renderOutroScene(scene: MotionScene, progress: number, eased: number, seed: number): string {
  const title = textBlock(scene.title, 72, 352, 56, 64, 76, TEXT, 900, 4);
  const subtitle = textBlock(scene.subtitle, 76, 704, 42, 31, 43, MUTED, 650, 3);
  return `
  <g opacity="${fadeIn(progress, 0, 0.24).toFixed(2)}">
    <rect x="72" y="286" width="936" height="1010" rx="36" fill="url(#panel)" stroke="#263854" stroke-width="2" filter="url(#softShadow)"/>
    ${title}
    ${subtitle}
    ${renderMiniSignalCards(scene.bullets, 876, progress)}
    ${renderCandles(128, 1338, 824, 250, seed, eased, true)}
    <text x="540" y="1668" text-anchor="middle" fill="${BRAND_GREEN}" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="900">Save this framework</text>
  </g>`;
}

function renderCandles(
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
  progress: number,
  compact: boolean
): string {
  const candles = makeCandles(seed, compact ? 11 : 15);
  const values = candles.flatMap((candle) => [candle.open, candle.high, candle.low, candle.close]);
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const toY = (value: number) => y + height - ((value - min) / (max - min)) * height;
  const gap = compact ? 12 : 16;
  const candleWidth = (width - gap * (candles.length - 1)) / candles.length;
  const visible = Math.ceil(candles.length * progress);
  const grid = range(0, 5).map((i) => {
    const gy = y + (height / 4) * i;
    return `<line x1="${x}" y1="${gy.toFixed(1)}" x2="${x + width}" y2="${gy.toFixed(1)}" stroke="#263854" stroke-width="1"/>`;
  }).join('');
  const candleMarkup = candles.slice(0, visible).map((candle, index) => {
    const cx = x + index * (candleWidth + gap) + candleWidth / 2;
    const openY = toY(candle.open);
    const closeY = toY(candle.close);
    const highY = toY(candle.high);
    const lowY = toY(candle.low);
    const up = candle.close >= candle.open;
    const fill = up ? BRAND_GREEN : BRAND_ROSE;
    const bodyY = Math.min(openY, closeY);
    const bodyH = Math.max(6, Math.abs(openY - closeY));
    const opacity = fadeIn(progress, index / candles.length * 0.55, 0.2);
    return `
      <g opacity="${opacity.toFixed(2)}">
        <line x1="${cx.toFixed(1)}" y1="${highY.toFixed(1)}" x2="${cx.toFixed(1)}" y2="${lowY.toFixed(1)}" stroke="${fill}" stroke-width="${compact ? 5 : 6}" stroke-linecap="round"/>
        <rect x="${(cx - candleWidth / 2).toFixed(1)}" y="${bodyY.toFixed(1)}" width="${candleWidth.toFixed(1)}" height="${bodyH.toFixed(1)}" rx="5" fill="${fill}"/>
      </g>`;
  }).join('');
  const highlightX = x + Math.max(0, visible - 1) * (candleWidth + gap) + candleWidth / 2;
  return `
    <g>
      <rect x="${x - 18}" y="${y - 24}" width="${width + 36}" height="${height + 48}" rx="22" fill="#0A1323" stroke="#25344F" stroke-width="1.5"/>
      ${grid}
      ${candleMarkup}
      <circle cx="${highlightX.toFixed(1)}" cy="${(y + height * 0.18).toFixed(1)}" r="${(10 + 10 * Math.sin(progress * Math.PI)).toFixed(1)}" fill="${BRAND_CYAN}" opacity="${progress > 0.55 ? 0.35 : 0}"/>
    </g>`;
}

function makeCandles(seed: number, count: number): Array<{ open: number; high: number; low: number; close: number }> {
  let price = 52 + (seed % 17);
  return range(0, count).map((index) => {
    const wave = Math.sin((seed + index * 11) * 0.33) * 3.6;
    const drift = index * 0.9;
    const open = price;
    const close = open + wave + drift / count;
    const high = Math.max(open, close) + 2.6 + Math.abs(Math.cos(seed + index));
    const low = Math.min(open, close) - 2.4 - Math.abs(Math.sin(seed - index));
    price = close + Math.sin(index + seed) * 1.3;
    return { open, high, low, close };
  });
}

function renderMiniSignalCards(labels: string[], y: number, progress: number): string {
  return labels.slice(0, 3).map((label, index) => {
    const opacity = fadeIn(progress, 0.15 + index * 0.16, 0.18);
    const x = 72 + index * 312;
    const translate = 34 * (1 - opacity);
    return `
    <g transform="translate(0 ${translate.toFixed(1)})" opacity="${opacity.toFixed(2)}">
      <rect x="${x}" y="${y}" width="286" height="150" rx="24" fill="${PANEL_LIGHT}" stroke="#2A3B59" stroke-width="2"/>
      <circle cx="${x + 42}" cy="${y + 48}" r="14" fill="${index === 0 ? BRAND_CYAN : index === 1 ? BRAND_GOLD : BRAND_GREEN}"/>
      ${textBlock(label, x + 30, y + 98, 22, 24, 31, TEXT, 800, 2)}
    </g>`;
  }).join('');
}

function renderBulletStrip(bullets: string[], y: number, progress: number, accent: string): string {
  const safeBullets = bullets.length ? bullets.slice(0, 3) : ['Source it', 'Check risk', 'Decide later'];
  return `
  <g>
    ${safeBullets.map((bullet, index) => {
      const opacity = fadeIn(progress, 0.18 + index * 0.16, 0.18);
      return `
      <g opacity="${opacity.toFixed(2)}">
        <rect x="72" y="${y + index * 74}" width="936" height="54" rx="16" fill="#0B1322" stroke="#27364F" stroke-width="1.5"/>
        <rect x="98" y="${y + 17 + index * 74}" width="20" height="20" rx="6" fill="${accent}"/>
        <text x="140" y="${y + 38 + index * 74}" fill="${TEXT}" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="750">${escapeXml(clampText(bullet, 62))}</text>
      </g>`;
    }).join('')}
  </g>`;
}

function renderRoutingPath(progress: number, accent: string): string {
  const dash = 1250;
  const offset = dash * (1 - easeOutCubic(progress));
  return `
  <path d="M270 922 C420 930, 455 980, 540 1046 S704 1208, 560 1295 S316 1408, 246 1398" fill="none" stroke="#243551" stroke-width="18" stroke-linecap="round"/>
  <path d="M270 922 C420 930, 455 980, 540 1046 S704 1208, 560 1295 S316 1408, 246 1398" fill="none" stroke="${accent}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${dash}" stroke-dashoffset="${offset.toFixed(1)}"/>
  <circle cx="${(270 + progress * 390).toFixed(1)}" cy="${(922 + Math.sin(progress * Math.PI) * 360).toFixed(1)}" r="13" fill="${accent}" opacity="${fadeIn(progress, 0.12, 0.2).toFixed(2)}"/>`;
}

function renderFlowCard(x: number, y: number, number: string, title: string, subtitle: string, accent: string, opacity: number): string {
  return `
  <g opacity="${opacity.toFixed(2)}">
    <rect x="${x}" y="${y}" width="494" height="150" rx="24" fill="${PANEL_LIGHT}" stroke="#2A3B59" stroke-width="2"/>
    <circle cx="${x + 58}" cy="${y + 74}" r="34" fill="${accent}" opacity="0.18"/>
    <text x="${x + 58}" y="${y + 84}" text-anchor="middle" fill="${accent}" font-family="Inter, Arial, sans-serif" font-size="31" font-weight="900">${number}</text>
    ${textBlock(title, x + 112, y + 58, 28, 25, 31, TEXT, 850, 2)}
    <text x="${x + 112}" y="${y + 118}" fill="${MUTED}" font-family="Inter, Arial, sans-serif" font-size="21" font-weight="650">${escapeXml(subtitle)}</text>
  </g>`;
}

function renderChecklistItem(x: number, y: number, index: number, text: string, accent: string, opacity: number): string {
  return `
  <g opacity="${opacity.toFixed(2)}">
    <rect x="${x}" y="${y}" width="816" height="132" rx="24" fill="${PANEL_LIGHT}" stroke="#2A3B59" stroke-width="2"/>
    <circle cx="${x + 62}" cy="${y + 66}" r="34" fill="${accent}" opacity="0.16"/>
    <path d="M${x + 44} ${y + 67} l14 15 l28 -36" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    ${textBlock(`${index}. ${text}`, x + 126, y + 54, 42, 29, 36, TEXT, 800, 2)}
  </g>`;
}

function renderMeter(x: number, y: number, width: number, height: number, progress: number, accent: string): string {
  return `
  <g>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="#0B1322" stroke="#27364F" stroke-width="1"/>
    <rect x="${x}" y="${y}" width="${Math.max(height, width * progress).toFixed(1)}" height="${height}" rx="${height / 2}" fill="${accent}"/>
  </g>`;
}

function renderRiskGauge(cx: number, cy: number, radius: number, progress: number): string {
  const start = polar(cx, cy, radius, 205);
  const endBase = polar(cx, cy, radius, 335);
  const endProgress = polar(cx, cy, radius, 205 + 130 * progress);
  const needle = polar(cx, cy, radius * 0.74, 205 + 130 * progress);
  return `
  <g>
    <path d="M${start.x} ${start.y} A${radius} ${radius} 0 0 1 ${endBase.x} ${endBase.y}" fill="none" stroke="#27364F" stroke-width="38" stroke-linecap="round"/>
    <path d="M${start.x} ${start.y} A${radius} ${radius} 0 0 1 ${endProgress.x} ${endProgress.y}" fill="none" stroke="${BRAND_ROSE}" stroke-width="38" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${needle.x}" y2="${needle.y}" stroke="${TEXT}" stroke-width="10" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="24" fill="${TEXT}"/>
    <text x="${cx}" y="${cy + 112}" text-anchor="middle" fill="${MUTED}" font-family="Inter, Arial, sans-serif" font-size="25" font-weight="750">Risk is part of the lesson</text>
  </g>`;
}

function renderCallout(x: number, y: number, label: string, detail: string, accent: string, opacity: number): string {
  return `
  <g opacity="${opacity.toFixed(2)}">
    <rect x="${x}" y="${y}" width="238" height="134" rx="22" fill="#0B1322" stroke="#2A3B59" stroke-width="1.5"/>
    <text x="${x + 24}" y="${y + 48}" fill="${accent}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="900">${escapeXml(label)}</text>
    ${textBlock(detail, x + 24, y + 86, 20, 19, 25, MUTED, 650, 2)}
  </g>`;
}

function textBlock(
  text: string,
  x: number,
  y: number,
  maxChars: number,
  fontSize: number,
  lineHeight: number,
  fill: string,
  weight: number,
  maxLines: number
): string {
  const lines = wrapText(text, maxChars, maxLines);
  return `
  <text x="${x}" y="${y}" fill="${fill}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="${weight}">
    ${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join('')}
  </text>`;
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
  if (lines.length > maxLines) lines.length = maxLines;
  const consumedWordCount = lines.join(' ').split(' ').filter(Boolean).length;
  if (consumedWordCount < words.length && lines.length > 0) {
    lines[lines.length - 1] = clampText(lines[lines.length - 1], Math.max(8, maxChars - 3), '...');
  }
  return lines.length ? lines : [' '];
}

function buildSparkline(x: number, y: number, width: number, height: number, seed: number, progress: number): string {
  const points = range(0, 28).map((index) => {
    const px = x + (index / 27) * width;
    const py = y + height / 2 + Math.sin(index * 0.76 + seed) * 52 + Math.cos(index * 0.27 + progress * 6) * 24;
    return `${px.toFixed(1)} ${py.toFixed(1)}`;
  });
  return `M${points.join(' L')}`;
}

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash || 1);
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

function clampText(text: string, maxLength: number, suffix = ''): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - suffix.length)).trim()}${suffix}`;
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
