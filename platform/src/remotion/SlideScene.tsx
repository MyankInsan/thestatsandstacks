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
    <AbsoluteFill style={{ opacity: entryOpacity * exitOpacity, overflow: 'hidden', transform: `translateY(${translateY}px)` }}>
      <Img
        src={staticFile(filename)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      />
    </AbsoluteFill>
  );
}
