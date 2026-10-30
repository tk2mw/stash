// Mirrored bar waveform from precomputed peaks (0..1).
// Without `progress` it is a static preview; with it, bars before the playhead read as played.
// `bars` downsamples (max per bucket) so narrow previews stay crisp instead of blurring into a block.
export function Waveform({ peaks, progress, bars, className }: { peaks: number[]; progress?: number; bars?: number; className?: string }) {
  const data =
    bars && bars < peaks.length
      ? Array.from({ length: bars }, (_, i) =>
          Math.max(...peaks.slice(Math.floor((i * peaks.length) / bars), Math.floor(((i + 1) * peaks.length) / bars))),
        )
      : peaks;
  const n = data.length;
  return (
    <svg viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" aria-hidden className={className}>
      {data.map((p, i) => {
        const h = Math.max(4, p * 100);
        const fill =
          progress === undefined ? "var(--color-wave-idle)" : i / n < progress ? "var(--color-wave-played)" : "var(--color-wave)";
        return <rect key={i} x={i + 0.275} width={0.45} y={50 - h / 2} height={h} fill={fill} />;
      })}
      {progress !== undefined && (
        <line
          x1={progress * n}
          x2={progress * n}
          y1={0}
          y2={100}
          stroke="var(--color-fg)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
