import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { BaseAgent } from './interfaces';
import { GeneratedImage } from './imageGenerationAgent';
import { StrategyDecision } from './contentStrategyAgent';
import { getRunSlug, sanitizeFilePart } from '../services/dateUtils';

export type VideoGenerationMode = 'disabled' | 'auto' | 'always';

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
  manifestPath?: string;
}

const DEFAULT_SECONDS_PER_SLIDE = 2.6;
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const VIDEO_FPS = 30;

export class VideoGenerationAgent extends BaseAgent {
  constructor() {
    super('VideoGenerationAgent');
  }

  static getMode(): VideoGenerationMode {
    const configured = (process.env.VIDEO_GENERATION_MODE || 'auto').toLowerCase();
    if (configured === 'disabled' || configured === 'always') return configured;
    return 'auto';
  }

  static isAvailable(): boolean {
    return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
  }

  static shouldRenderForStrategy(strategy: Pick<StrategyDecision, 'format'>): boolean {
    const mode = VideoGenerationAgent.getMode();
    if (mode === 'disabled') return false;
    return mode === 'always' || strategy.format === 'REEL_DRAFT';
  }

  async execute(input: {
    images: GeneratedImage[];
    strategy: StrategyDecision;
    outputDir: string;
  }): Promise<VideoGenerationResult> {
    console.log(`[${this.name}] Rendering local Reel draft...`);

    if (!VideoGenerationAgent.shouldRenderForStrategy(input.strategy)) {
      return { video: null, skippedReason: 'Video generation mode did not request a video for this strategy.' };
    }

    if (!VideoGenerationAgent.isAvailable()) {
      return {
        video: null,
        skippedReason: 'ffmpeg is not installed. Install ffmpeg to enable free local MP4 video rendering.',
      };
    }

    const usableImages = [...input.images].sort((a, b) => a.slideNumber - b.slideNumber);
    if (usableImages.length === 0) {
      return { video: null, skippedReason: 'No approved slide images were available for video rendering.' };
    }

    fs.mkdirSync(input.outputDir, { recursive: true });
    const runSlug = getRunSlug();
    const secondsPerSlide = getSecondsPerSlide();
    const durationSeconds = Number((usableImages.length * secondsPerSlide).toFixed(1));
    const manifestPath = path.join(input.outputDir, `${sanitizeFilePart(runSlug)}_reel_manifest.txt`);
    const outputPath = path.join(input.outputDir, `${sanitizeFilePart(runSlug)}_reel.mp4`);
    fs.writeFileSync(manifestPath, buildConcatManifest(usableImages, secondsPerSlide), 'utf-8');

    const args = [
      '-y',
      '-safe', '0',
      '-f', 'concat',
      '-i', manifestPath,
      '-f', 'lavfi',
      '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-vf', [
        `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=decrease`,
        `pad=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0x0B1120`,
        'setsar=1',
        `fps=${VIDEO_FPS}`,
        'format=yuv420p',
      ].join(','),
      '-c:v', 'libx264',
      '-profile:v', 'high',
      '-level', '4.1',
      '-preset', process.env.VIDEO_FFMPEG_PRESET || 'veryfast',
      '-crf', process.env.VIDEO_FFMPEG_CRF || '20',
      '-r', String(VIDEO_FPS),
      '-c:a', 'aac',
      '-b:a', '128k',
      '-shortest',
      '-movflags', '+faststart',
      outputPath,
    ];

    await runFfmpeg(args);

    return {
      video: {
        localPath: outputPath,
        mimeType: 'video/mp4',
        source: 'local-ffmpeg',
        width: VIDEO_WIDTH,
        height: VIDEO_HEIGHT,
        durationSeconds,
        frameCount: Math.round(durationSeconds * VIDEO_FPS),
      },
      manifestPath,
    };
  }
}

function getSecondsPerSlide(): number {
  const parsed = Number(process.env.VIDEO_SECONDS_PER_SLIDE || DEFAULT_SECONDS_PER_SLIDE);
  if (!Number.isFinite(parsed)) return DEFAULT_SECONDS_PER_SLIDE;
  return Math.max(1.5, Math.min(4.5, parsed));
}

function buildConcatManifest(images: GeneratedImage[], secondsPerSlide: number): string {
  const lines: string[] = [];

  for (const image of images) {
    lines.push(`file '${escapeConcatPath(image.localPath)}'`);
    lines.push(`duration ${secondsPerSlide.toFixed(2)}`);
  }

  const last = images[images.length - 1];
  lines.push(`file '${escapeConcatPath(last.localPath)}'`);
  return `${lines.join('\n')}\n`;
}

function escapeConcatPath(filePath: string): string {
  return filePath.replace(/'/g, "'\\''");
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
