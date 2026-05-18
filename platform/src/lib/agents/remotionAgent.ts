// platform/src/lib/agents/remotionAgent.ts
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FPS = 25;
const FRAMES_PER_SLIDE = 125;
const CROSSFADE_FRAMES = 12;

export interface RemotionAgentInput {
  imagePaths: string[];
  outputDir: string;
  runSlug: string;
}

export interface RemotionAgentResult {
  videoPath: string;
  durationSeconds: number;
}

export class RemotionAgent {
  private readonly name = 'RemotionAgent';

  async execute(input: RemotionAgentInput): Promise<RemotionAgentResult> {
    const { imagePaths, outputDir, runSlug } = input;
    if (imagePaths.length === 0) throw new Error('[RemotionAgent] No images provided.');

    const n = imagePaths.length;
    const totalFrames = n * (FRAMES_PER_SLIDE - CROSSFADE_FRAMES) + CROSSFADE_FRAMES;
    const durationSeconds = totalFrames / FPS;

    console.log(`[${this.name}] 🎬 Rendering ${n} slides via Remotion (${durationSeconds.toFixed(1)}s)...`);

    const videoNoAudioPath = path.join(outputDir, `${runSlug}_no_audio.mp4`);
    const musicPath = path.join(outputDir, `${runSlug}_music.aac`);
    const videoPath = path.join(outputDir, `${runSlug}_reel.mp4`);

    // filenames only — images live in outputDir which becomes the publicDir
    const filenames = imagePaths.map((p) => path.basename(p));
    const inputProps = { filenames, framesPerSlide: FRAMES_PER_SLIDE, crossfadeFrames: CROSSFADE_FRAMES };

    const chromiumOptions = {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      disableWebSecurity: true,
      headless: true,
    };

    // 1: Bundle — publicDir = outputDir so staticFile(filename) resolves to the PNGs
    const entryPoint = path.resolve(__dirname, '../../remotion/Root.tsx');
    console.log(`[${this.name}]   Bundling composition...`);
    const bundled = await bundle({
      entryPoint,
      publicDir: outputDir,
      enableCaching: false,
    });
    console.log(`[${this.name}]   ✓ Bundled`);

    let composition;
    try {
      // 2: Evaluate calculateMetadata to get real composition duration
      composition = await selectComposition({
        serveUrl: bundled,
        id: 'SlideShow',
        inputProps,
        chromiumOptions,
      });
      console.log(`[${this.name}]   ✓ Composition selected (${composition.durationInFrames} frames)`);

      // 3–5: Render, generate music, merge — always clean up intermediates
      try {
        let lastLoggedPct = -1;
        await renderMedia({
          composition,
          serveUrl: bundled,
          codec: 'h264',
          outputLocation: videoNoAudioPath,
          chromiumOptions,
          inputProps,
          concurrency: Number(process.env.REMOTION_CONCURRENCY ?? 1),
          onProgress: ({ progress }) => {
            const pct = Math.floor(progress * 100);
            if (pct % 25 === 0 && pct !== lastLoggedPct) {
              lastLoggedPct = pct;
              console.log(`[${this.name}]   Rendering: ${pct}%`);
            }
          },
        });
        console.log(`[${this.name}]   ✓ Video rendered`);

        // 4: Generate ambient A-minor music via FFmpeg
        const actualDurationSeconds = composition.durationInFrames / composition.fps;
        const expr =
          '(0.14*sin(2*PI*110*t)' +
          '+0.11*sin(2*PI*130.81*t)' +
          '+0.09*sin(2*PI*164.81*t)' +
          '+0.05*sin(2*PI*220*t))' +
          '*(0.82+0.18*sin(2*PI*0.12*t))';
        ffmpeg(
          [
            '-y',
            '-f', 'lavfi',
            '-i', `aevalsrc=${expr}:s=44100`,
            '-t', String(Math.ceil(actualDurationSeconds) + 1),
            '-af', 'aecho=0.6:0.5:40:0.3,volume=0.9',
            '-c:a', 'aac', '-b:a', '128k',
            musicPath,
          ],
          'generateAmbientMusic',
        );
        console.log(`[${this.name}]   ✓ Music generated`);

        // 5: Merge video + audio
        ffmpeg(
          ['-y', '-i', videoNoAudioPath, '-i', musicPath, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-shortest', videoPath],
          'mergeAV',
        );
      } finally {
        for (const f of [videoNoAudioPath, musicPath]) {
          if (fs.existsSync(f)) fs.unlinkSync(f);
        }
      }
    } finally {
      fs.rmSync(bundled, { recursive: true, force: true });
    }
    console.log(`[${this.name}]   ✓ Final video: ${videoPath}`);

    return { videoPath, durationSeconds: composition.durationInFrames / composition.fps };
  }
}

function ffmpeg(args: string[], label: string): void {
  const result = spawnSync('ffmpeg', args, { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 });
  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? '';
    throw new Error(`[RemotionAgent] ffmpeg ${label} failed (exit ${result.status}):\n${stderr.slice(-2000)}`);
  }
}
