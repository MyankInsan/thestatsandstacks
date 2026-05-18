// platform/src/remotion/SlideShow.tsx
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { ProgressBar } from './ProgressBar';
import { SlideScene } from './SlideScene';

export interface SlideShowProps extends Record<string, unknown> {
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
          <Sequence key={`${i}-${filename}`} from={from} durationInFrames={framesPerSlide}>
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
