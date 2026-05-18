// platform/src/remotion/Root.tsx
import { Composition, registerRoot, type CalculateMetadataFunction } from 'remotion';
import { SlideShow, type SlideShowProps } from './SlideShow';

const FPS = 25;
const FRAMES_PER_SLIDE = 125; // 5 s per slide
const CROSSFADE_FRAMES = 12;  // 0.48 s overlap

const calculateMetadata: CalculateMetadataFunction<SlideShowProps> = async ({ props }) => ({
  durationInFrames:
    props.filenames.length > 0
      ? props.filenames.length * (FRAMES_PER_SLIDE - CROSSFADE_FRAMES) + CROSSFADE_FRAMES
      : FRAMES_PER_SLIDE,
  fps: FPS,
  width: 1080,
  height: 1350,
});

function RemotionRoot() {
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
      calculateMetadata={calculateMetadata}
    />
  );
}

registerRoot(RemotionRoot);
