import { useEffect, useRef } from "react";

// Player waveform on a canvas: rounded bars, played part filled smoothly (even mid-bar),
// a lighter preview up to the pointer, and bars that grow in from the left when the track changes.
export function PlayerWaveform({ peaks, progress, hover, trackKey, className }: { peaks: number[]; progress: number; hover: number | null; trackKey: string; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const intro = useRef({ key: "", start: 0 });
  const props = useRef({ peaks, progress, hover });
  props.current = { peaks, progress, hover };

  const draw = (now = performance.now()) => {
    const c = canvas.current;
    if (!c) return false;
    const { width, height } = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(width * dpr) || c.height !== Math.round(height * dpr)) {
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    const css = getComputedStyle(c);
    const played = css.getPropertyValue("--color-wave-played").trim() || "#d6d6d6";
    const idle = css.getPropertyValue("--color-wave").trim() || "#4a4a4a";
    const { peaks: data, progress: p, hover: h } = props.current;
    const n = data.length;
    const step = (width * dpr) / n;
    const bar = Math.max(1.5 * dpr, step * 0.52);
    const mid = (height * dpr) / 2;
    const elapsed = now - intro.current.start;

    const bars = (color: string, from: number, to: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(from * width * dpr, 0, (to - from) * width * dpr, height * dpr);
      ctx.clip();
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const grow = Math.min(1, Math.max(0, (elapsed - i * 4) / 320));
        const eased = 1 - (1 - grow) ** 3;
        const bh = Math.max(bar, data[i] * height * dpr * 0.94 * eased);
        ctx.roundRect(i * step + (step - bar) / 2, mid - bh / 2, bar, bh, bar / 2);
      }
      ctx.fill();
      ctx.restore();
    };

    ctx.clearRect(0, 0, c.width, c.height);
    bars(idle, 0, 1);
    if (h !== null && h > p) bars("rgb(255 255 255 / 0.42)", p, h);
    bars(played, 0, p);
    return elapsed < n * 4 + 320; // still growing in
  };

  // bars grow in again whenever the track changes
  useEffect(() => {
    intro.current = { key: trackKey, start: performance.now() };
    let raf = 0;
    const loop = (t: number) => {
      if (draw(t)) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [trackKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    draw();
  });

  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    if (canvas.current) ro.observe(canvas.current);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <canvas ref={canvas} aria-hidden className={className} />;
}
