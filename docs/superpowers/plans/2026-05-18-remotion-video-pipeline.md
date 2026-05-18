# Remotion Video Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the FFmpeg slideshow `VideoCompilationAgent` with a Remotion-based renderer that produces premium animated MP4 Reels — spring-entrance per slide, Ken Burns zoom, sweeping progress bar, and ambient music.

**Architecture:** Remotion 4 bundles a React composition (`Root.tsx → SlideShow → SlideScene`) via esbuild, then `renderMedia()` from `@remotion/renderer` drives headless Chromium to render each frame. Because the slide PNGs are already rendered by Puppeteer, the Remotion composition simply animates those PNGs using `<Img>` — no slide template CSS or font re-loading needed. Ambient music is generated separately by FFmpeg's `aevalsrc` and merged in a final pass, exactly as before.

**Tech Stack:** `remotion@4.0.462`, `@remotion/bundler@4.0.462`, `@remotion/renderer@4.0.462`, Node.js `tsx`, FFmpeg, Chromium headless

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `platform/src/remotion/Root.tsx` | Registers `SlideShow` Composition with Remotion runtime |
| Create | `platform/src/remotion/SlideShow.tsx` | Maps `imagePaths[]` → Sequences of `SlideScene` + `ProgressBar` |
| Create | `platform/src/remotion/SlideScene.tsx` | Animates a single PNG: spring entrance + Ken Burns zoom + exit fade |
| Create | `platform/src/remotion/ProgressBar.tsx` | Thin accent bar sweeping left→right across full video duration |
| Create | `platform/src/lib/agents/remotionAgent.ts` | Orchestrates bundle → selectComposition → renderMedia → mergeAV |
| Modify | `platform/run-daily.ts` | Swap `VideoCompilationAgent` import/call for `RemotionAgent` (add await) |
| Delete | `platform/src/lib/agents/videoCompilationAgent.ts` | Replaced by remotionAgent.ts |

---

## Task 1: Install Remotion packages

**Files:**
- Modify: `platform/package.json` (via npm install)

- [ ] **Step 1: Install the three Remotion packages at the same version**

```bash
cd platform
npm install remotion@4.0.462 @remotion/bundler@4.0.462 @remotion/renderer@4.0.462
```

Expected output: `added N packages` with no peer-dep errors.

- [ ] **Step 2: Verify TypeScript still compiles clean**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add platform/package.json platform/package-lock.json
git commit -m "chore: install remotion 4 packages for video pipeline"
```

---

## Task 2: Create `ProgressBar.tsx`

**Files:**
- Create: `platform/src/remotion/ProgressBar.tsx`

- [ ] **Step 1: Create the file**

```tsx
// platform/src/remotion/ProgressBar.tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export function ProgressBar({ totalFrames }: { totalFrames: number }) {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [0, totalFrames], [0, 100], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 4,
          width: `${width}%`,
          background: 'linear-gradient(90deg, #34D399, #06B6D4)',
          opacity: 0.75,
        }}
      />
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd platform && npx tsc --noEmit
```

Expected: no output.

---

## Task 3: Create `SlideScene.tsx`

**Files:**
- Create: `platform/src/remotion/SlideScene.tsx`

- [ ] **Step 1: Create the file**

```tsx
// platform/src/remotion/SlideScene.tsx
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

interface SlideSceneProps {
  /** basename of the PNG, resolved via Remotion staticFile() */
  filename: string;
  durationFrames: number;
  crossfadeFrames: number;
}

export function SlideScene({ filename, durationFrames, crossfadeFrames }: SlideSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring entrance: slide up from y=40, fade in
  const entrance = spring({ frame, fps, config: { damping: 22, stiffness: 75, mass: 1 } });
  const translateY = interpolate(entrance, [0, 1], [40, 0]);
  const entryOpacity = interpolate(entrance, [0, 1], [0, 1]);

  // Ken Burns: subtle zoom 1.00 → 1.04 over full slide duration
  const scale = interpolate(frame, [0, durationFrames], [1.0, 1.04], { extrapolateRight: 'clamp' });

  // Exit fade: starts crossfadeFrames before end
  const exitStart = durationFrames - crossfadeFrames;
  const exitOpacity =
    frame >= exitStart
      ? interpolate(frame, [exitStart, durationFrames], [1, 0], { extrapolateRight: 'clamp' })
      : 1;

  return (
    <AbsoluteFill style={{ opacity: entryOpacity * exitOpacity, overflow: 'hidden' }}>
      <Img
        src={staticFile(filename)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translateY(${translateY}px) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      />
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd platform && npx tsc --noEmit
```

Expected: no output.

---

## Task 4: Create `SlideShow.tsx`

**Files:**
- Create: `platform/src/remotion/SlideShow.tsx`

- [ ] **Step 1: Create the file**

```tsx
// platform/src/remotion/SlideShow.tsx
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { ProgressBar } from './ProgressBar';
import { SlideScene } from './SlideScene';

export interface SlideShowProps {
  /** Basenames (not full paths) of PNG files, in slide order */
  filenames: string[];
  framesPerSlide: number;
  crossfadeFrames: number;
}

export function SlideShow({ filenames, framesPerSlide, crossfadeFrames }: SlideShowProps) {
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: '#050E1C' }}>
      {filenames.map((filename, i) => {
        const from = i * (framesPerSlide - crossfadeFrames);
        return (
          <Sequence key={filename} from={from} durationInFrames={framesPerSlide}>
            <SlideScene
              filename={filename}
              durationFrames={framesPerSlide}
              crossfadeFrames={crossfadeFrames}
            />
          </Sequence>
        );
      })}
      <ProgressBar totalFrames={durationInFrames} />
    </AbsoluteFill>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd platform && npx tsc --noEmit
```

Expected: no output.

---

## Task 5: Create `Root.tsx`

**Files:**
- Create: `platform/src/remotion/Root.tsx`

- [ ] **Step 1: Create the file**

The `durationInFrames` in `<Composition>` is a placeholder — `calculateMetadata` always overrides it at render time based on actual `filenames.length`.

```tsx
// platform/src/remotion/Root.tsx
import { Composition } from 'remotion';
import { SlideShow, type SlideShowProps } from './SlideShow';

const FPS = 25;
const FRAMES_PER_SLIDE = 125; // 5 s per slide
const CROSSFADE_FRAMES = 12;  // 0.48 s overlap

export function RemotionRoot() {
  return (
    <Composition
      id="SlideShow"
      component={SlideShow}
      durationInFrames={FRAMES_PER_SLIDE}
      fps={FPS}
      width={1080}
      height={1350}
      defaultProps={
        {
          filenames: [],
          framesPerSlide: FRAMES_PER_SLIDE,
          crossfadeFrames: CROSSFADE_FRAMES,
        } satisfies SlideShowProps
      }
      calculateMetadata={async ({ props }) => ({
        durationInFrames:
          props.filenames.length > 0
            ? props.filenames.length * (FRAMES_PER_SLIDE - CROSSFADE_FRAMES) + CROSSFADE_FRAMES
            : FRAMES_PER_SLIDE,
        fps: FPS,
        width: 1080,
        height: 1350,
      })}
    />
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd platform && npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit Remotion composition files**

```bash
git add platform/src/remotion/
git commit -m "feat: add Remotion composition — SlideShow, SlideScene, ProgressBar, Root"
```

---

## Task 6: Create `remotionAgent.ts`

**Files:**
- Create: `platform/src/lib/agents/remotionAgent.ts`

This agent replaces `videoCompilationAgent.ts`. It:
1. Bundles the Remotion composition using `@remotion/bundler`, with `publicDir` pointing to the directory containing the PNGs so Remotion can serve them via `staticFile()`.
2. Calls `selectComposition` to evaluate `calculateMetadata` with the real input props.
3. Calls `renderMedia` to render to an audio-free MP4.
4. Generates ambient music via FFmpeg `aevalsrc`.
5. Merges video + audio.

- [ ] **Step 1: Create the file**

```typescript
// platform/src/lib/agents/remotionAgent.ts
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

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

    // 2: Evaluate calculateMetadata to get real composition duration
    const composition = await selectComposition({
      serveUrl: bundled,
      id: 'SlideShow',
      inputProps,
      chromiumOptions,
    });
    console.log(`[${this.name}]   ✓ Composition selected (${composition.durationInFrames} frames)`);

    // 3: Render video frames (no audio)
    let lastLoggedPct = -1;
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: 'h264',
      outputLocation: videoNoAudioPath,
      chromiumOptions,
      inputProps,
      concurrency: 2,
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
        '-t', String(Math.ceil(durationSeconds) + 1),
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
    fs.unlinkSync(videoNoAudioPath);
    fs.unlinkSync(musicPath);
    console.log(`[${this.name}]   ✓ Final video: ${videoPath}`);

    return { videoPath, durationSeconds };
  }
}

function ffmpeg(args: string[], label: string): void {
  const result = spawnSync('ffmpeg', args, { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 });
  if (result.status !== 0) {
    const stderr = result.stderr?.toString() ?? '';
    throw new Error(`[RemotionAgent] ffmpeg ${label} failed (exit ${result.status}):\n${stderr.slice(-2000)}`);
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd platform && npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add platform/src/lib/agents/remotionAgent.ts
git commit -m "feat: add RemotionAgent — bundle/render via @remotion/renderer + FFmpeg music merge"
```

---

## Task 7: Wire RemotionAgent into `run-daily.ts` and remove old agent

**Files:**
- Modify: `platform/run-daily.ts` (lines ~22–23, ~249–255)
- Delete: `platform/src/lib/agents/videoCompilationAgent.ts`

The only changes to `run-daily.ts`:
1. Change the import from `VideoCompilationAgent` to `RemotionAgent`
2. Change `new VideoCompilationAgent()` to `new RemotionAgent()`
3. Change `.execute(...)` call from synchronous to `await`ed (the call site is already inside an `async` function)

- [ ] **Step 1: Update the import at the top of `run-daily.ts`**

Find this line (around line 23):
```typescript
import { VideoCompilationAgent } from './src/lib/agents/videoCompilationAgent';
```

Replace with:
```typescript
import { RemotionAgent } from './src/lib/agents/remotionAgent';
```

- [ ] **Step 2: Update the call site in the video delivery block (around line 249)**

Find:
```typescript
    const videoAgent = new VideoCompilationAgent();
    const videoResult = videoAgent.execute({
      imagePaths: generatedImages.images.map((img) => img.localPath),
      outputDir,
      runSlug,
    });
```

Replace with:
```typescript
    const videoAgent = new RemotionAgent();
    const videoResult = await videoAgent.execute({
      imagePaths: generatedImages.images.map((img) => img.localPath),
      outputDir,
      runSlug,
    });
```

- [ ] **Step 3: Delete the old agent**

```bash
rm platform/src/lib/agents/videoCompilationAgent.ts
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd platform && npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add platform/run-daily.ts
git rm platform/src/lib/agents/videoCompilationAgent.ts
git commit -m "feat: wire RemotionAgent into run-daily, remove VideoCompilationAgent"
```

---

## Task 8: Push and trigger test run

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Trigger manual video run**

```bash
gh workflow run "Daily Instagram Post" \
  --repo MyankInsan/thestatsandstacks \
  --field day_type=video
```

- [ ] **Step 3: Watch the run**

```bash
gh run list --repo MyankInsan/thestatsandstacks --limit 1
# grab the run ID from output, then:
gh run watch <RUN_ID> --repo MyankInsan/thestatsandstacks --exit-status
```

Expected: all steps green in ~5–8 minutes (Remotion render is CPU-heavier than FFmpeg stitch).

- [ ] **Step 4: Confirm Telegram delivery**

Check Telegram for an inline video (not a download attachment) with smooth animated slide transitions, Ken Burns zoom, progress bar sweeping across the bottom, and ambient A-minor music.
