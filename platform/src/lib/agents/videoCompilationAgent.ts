import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface VideoCompilationInput {
  imagePaths: string[];   // ordered PNGs, 1080×1350
  outputDir: string;
  runSlug: string;
}

export interface VideoCompilationResult {
  videoPath: string;
  durationSeconds: number;
}

// Per-slide display time and crossfade length (seconds)
const SLIDE_DURATION = 4.5;
const CROSSFADE = 0.5;
const FPS = 25;
const WIDTH = 1080;
const HEIGHT = 1350;

export class VideoCompilationAgent {
  private readonly name = 'VideoCompilationAgent';

  execute(input: VideoCompilationInput): VideoCompilationResult {
    const { imagePaths, outputDir, runSlug } = input;
    if (imagePaths.length === 0) throw new Error('[VideoCompilationAgent] No images provided.');

    console.log(`[${this.name}] 🎬 Compiling ${imagePaths.length} slides into Reels video...`);

    const tmpDir = path.join(outputDir, 'video_tmp');
    fs.mkdirSync(tmpDir, { recursive: true });

    const videoOnlyPath = path.join(tmpDir, 'video_only.mp4');
    const musicPath = path.join(tmpDir, 'music.aac');
    const videoPath = path.join(outputDir, `${runSlug}_reel.mp4`);

    const n = imagePaths.length;
    const totalDuration = n * SLIDE_DURATION - (n - 1) * CROSSFADE;

    // Step 1: Build slideshow with xfade transitions
    buildSlideshow(imagePaths, videoOnlyPath, n, tmpDir);
    console.log(`[${this.name}]   ✓ Slideshow compiled (${totalDuration.toFixed(1)}s)`);

    // Step 2: Generate ambient background music (A-minor chord with tremolo)
    generateAmbientMusic(musicPath, totalDuration);
    console.log(`[${this.name}]   ✓ Ambient music generated`);

    // Step 3: Merge video + audio
    mergeAV(videoOnlyPath, musicPath, videoPath);
    console.log(`[${this.name}]   ✓ Final video: ${videoPath}`);

    // Cleanup temp files
    fs.rmSync(tmpDir, { recursive: true, force: true });

    return { videoPath, durationSeconds: totalDuration };
  }
}

// ---------------------------------------------------------------------------
// Slideshow builder — renders PNGs with fade transitions via FFmpeg
// ---------------------------------------------------------------------------
function buildSlideshow(imagePaths: string[], outputPath: string, n: number, tmpDir: string) {
  // Build input args: -loop 1 -t DURATION -i path
  const inputArgs: string[] = [];
  for (const p of imagePaths) {
    inputArgs.push('-loop', '1', '-t', String(SLIDE_DURATION), '-i', p);
  }

  // Scale each input stream to exact canvas size
  const scaleFilters = imagePaths.map((_, i) =>
    `[${i}:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,` +
    `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS}[v${i}]`,
  ).join(';');

  // Build xfade chain
  const xfadeFilters: string[] = [];
  let prevLabel = 'v0';
  for (let i = 1; i < n; i++) {
    const offset = i * (SLIDE_DURATION - CROSSFADE);
    const newLabel = `x${i}`;
    xfadeFilters.push(
      `[${prevLabel}][v${i}]xfade=transition=fade:duration=${CROSSFADE}:offset=${offset.toFixed(2)}[${newLabel}]`,
    );
    prevLabel = newLabel;
  }

  const filterComplex = [scaleFilters, ...xfadeFilters].join(';');
  const outputLabel = n === 1 ? 'v0' : `x${n - 1}`;

  // Write filter_complex to a temp file to avoid shell quoting issues
  const filterFile = path.join(tmpDir, 'filter.txt');
  fs.writeFileSync(filterFile, filterComplex);

  const args = [
    '-y',
    ...inputArgs,
    '-filter_complex_script', filterFile,
    '-map', `[${outputLabel}]`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p',
    outputPath,
  ];

  ffmpeg(args, 'buildSlideshow');
}

// ---------------------------------------------------------------------------
// Ambient music generator
// A-minor chord (A2 110Hz + C3 130.8Hz + E3 164.8Hz) with slow tremolo
// Sounds like a calm, atmospheric background note — on-brand for finance
// ---------------------------------------------------------------------------
function generateAmbientMusic(outputPath: string, durationSeconds: number) {
  const expr =
    '(0.14*sin(2*PI*110*t)' +
    '+0.11*sin(2*PI*130.81*t)' +
    '+0.09*sin(2*PI*164.81*t)' +
    '+0.05*sin(2*PI*220*t))' +
    '*(0.82+0.18*sin(2*PI*0.12*t))';  // slow 0.12Hz tremolo

  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', `aevalsrc=${expr}:s=44100`,
    '-t', String(Math.ceil(durationSeconds) + 1),
    '-af', 'aecho=0.6:0.5:40:0.3,volume=0.9',   // subtle echo/reverb + normalise
    '-c:a', 'aac', '-b:a', '128k',
    outputPath,
  ];

  ffmpeg(args, 'generateAmbientMusic');
}

// ---------------------------------------------------------------------------
// Merge video + audio streams
// ---------------------------------------------------------------------------
function mergeAV(videoPath: string, audioPath: string, outputPath: string) {
  const args = [
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '128k',
    '-shortest',
    outputPath,
  ];

  ffmpeg(args, 'mergeAV');
}

// ---------------------------------------------------------------------------
// FFmpeg runner — uses spawnSync to avoid shell quoting issues
// ---------------------------------------------------------------------------
function ffmpeg(args: string[], label: string) {
  const result = spawnSync('ffmpeg', args, { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 });
  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? '';
    throw new Error(
      `[VideoCompilationAgent] ffmpeg ${label} failed (exit ${result.status}):\n${stderr.slice(-2000)}`,
    );
  }
}
