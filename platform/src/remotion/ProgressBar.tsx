// platform/src/remotion/ProgressBar.tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export function ProgressBar({ totalFrames }: { totalFrames: number }) {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [0, totalFrames - 1], [0, 100], { extrapolateRight: 'clamp' });

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
