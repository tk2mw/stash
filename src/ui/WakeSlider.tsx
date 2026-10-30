// Wake slider from bencho.dev (?c=wake-slider): a range made of thin bars, no thumb; drag fast and the bars
// you sweep past spring up in a wake behind the hand. Adapted: controlled 0..1 value, stretches to its container,
// our tokens instead of --fill-on/--fill-slab, our "notch" sound.
import { useEffect, useRef, type PointerEvent } from "react";
import { playSound } from "./sound";
import { cx } from "./cx";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function WakeSlider({ value, onChange, label, bars = 36, wake = 60, className }: { value: number; onChange: (v: number) => void; label: string; bars?: number; wake?: number; className?: string }) {
  const n = Math.round(clamp(bars, 12, 64));
  const track = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLSpanElement | null)[]>([]);
  const s = useRef({ energy: new Float32Array(n), down: false, lastX: 0, lastT: 0, speed: 0, raf: 0, at: value, lastBar: -1, lastNotch: 0 });

  useEffect(() => {
    s.current.energy = new Float32Array(n);
  }, [n]);
  useEffect(() => () => cancelAnimationFrame(s.current.raf), []);

  // EACH BAR HOLDS A LITTLE ENERGY. Crossing a bar fills it from the drag's speed; every frame all of it
  // decays alike, so the bars crossed longest ago have fallen furthest: the wake.
  const animate = () => {
    const st = s.current;
    if (st.raf) return;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let alive = false;
      const decay = Math.exp(-dt * 6.5);
      for (let i = 0; i < st.energy.length; i++) {
        st.energy[i] *= decay;
        if (st.energy[i] < 0.002) st.energy[i] = 0;
        else alive = true;
        const bar = els.current[i];
        if (bar) bar.style.transform = `scaleY(${(1 + st.energy[i] * 1.6).toFixed(3)})`;
      }
      st.raf = alive || st.down ? requestAnimationFrame(frame) : 0;
    };
    st.raf = requestAnimationFrame(frame);
  };

  const set = (to: number, speed: number) => {
    const st = s.current;
    to = clamp(to, 0, 1);
    const a = Math.round(st.at * (n - 1));
    const b = Math.round(to * (n - 1));
    st.at = to;
    const push = (1 - Math.exp(-speed / 900)) * (wake / 60);
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) st.energy[i] = Math.max(st.energy[i], push);
    if (b !== st.lastBar) {
      st.lastBar = b;
      if (performance.now() - st.lastNotch > 28) {
        st.lastNotch = performance.now();
        playSound("notch");
      }
    }
    onChange(to);
    animate();
  };

  const fraction = (x: number) => {
    const r = track.current!.getBoundingClientRect();
    return (x - r.left) / r.width;
  };

  const percent = Math.round(value * 100);
  const lit = Math.round(value * (n - 1));
  return (
    <div className={cx("flex items-center gap-3", className)}>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}%`}
        onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
          const st = s.current;
          e.currentTarget.setPointerCapture(e.pointerId);
          st.down = true;
          st.at = value;
          st.lastX = e.clientX;
          st.lastT = performance.now();
          st.speed = 0;
          set(fraction(e.clientX), 0);
        }}
        onPointerMove={(e) => {
          const st = s.current;
          if (!st.down) return;
          const now = performance.now();
          const dt = Math.max(0.008, (now - st.lastT) / 1000);
          st.speed = st.speed * 0.5 + (Math.abs(e.clientX - st.lastX) / dt) * 0.5;
          st.lastX = e.clientX;
          st.lastT = now;
          set(fraction(e.clientX), st.speed);
        }}
        onPointerUp={() => (s.current.down = false)}
        onPointerCancel={() => (s.current.down = false)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 1;
          const next = { ArrowRight: percent + step, ArrowUp: percent + step, ArrowLeft: percent - step, ArrowDown: percent - step, Home: 0, End: 100 }[e.key];
          if (next === undefined) return;
          e.preventDefault();
          s.current.at = value;
          set(clamp(next, 0, 100) / 100, 600);
        }}
        className="flex h-9 min-w-0 flex-1 cursor-ew-resize touch-none select-none items-center justify-between rounded-xs [-webkit-tap-highlight-color:transparent]"
      >
        {Array.from({ length: n }, (_, i) => (
          <span
            key={i}
            ref={(el) => {
              els.current[i] = el;
            }}
            data-on={(percent > 0 && i <= lit) || undefined}
            className="h-3.5 w-[3px] flex-none rounded-[3px] bg-fg/25 transition-colors duration-150 data-on:bg-fg"
          />
        ))}
      </div>
      <span className="min-w-[3ch] text-right text-sm tabular-nums text-fg-muted">{percent}</span>
    </div>
  );
}
