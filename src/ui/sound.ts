// Interface sounds, synthesized with Web Audio (no files): short soft sine/triangle blips with a lowpass,
// in the spirit of bencho.dev but our own recipes. Clicks and hovers are picked up by delegation below,
// so components only add `data-sound="…"` when they want something other than the default tap.
import { useSyncExternalStore } from "react";

// atk = attack in ms (default 4); a slower attack sounds calmer
type Layer = { hz: number; to?: number; ms: number; gain: number; wave?: OscillatorType; at?: number; cut?: number; noise?: boolean; atk?: number };

const SOUNDS = {
  hover: [{ hz: 2100, ms: 22, gain: 0.011, cut: 4000 }],
  // calm, muted "bloop": barely gliding sine with a soft attack (the playful pop was too lively)
  tap: [{ hz: 520, to: 560, ms: 70, gain: 0.022, cut: 1400, atk: 10 }],
  // open/close: soft sine pair, no sweep (the triangle sweeps sounded like a video game)
  open: [
    { hz: 440, ms: 60, gain: 0.014, cut: 1400, atk: 8 },
    { hz: 660, ms: 80, gain: 0.01, cut: 1600, at: 40, atk: 8 },
  ],
  close: [
    { hz: 660, ms: 60, gain: 0.012, cut: 1400, atk: 8 },
    { hz: 440, ms: 80, gain: 0.012, cut: 1200, at: 40, atk: 8 },
  ],
  // volume slider bar crossed: a faint tick
  notch: [{ hz: 1500, ms: 14, gain: 0.006, cut: 3000 }],
  on: [
    { hz: 660, ms: 60, gain: 0.03, cut: 2600 },
    { hz: 990, ms: 110, gain: 0.03, cut: 3000, at: 55 },
  ],
  off: [
    { hz: 880, ms: 60, gain: 0.026, cut: 2400 },
    { hz: 560, ms: 110, gain: 0.026, cut: 2000, at: 55 },
  ],
  like: [
    { hz: 740, to: 1180, ms: 90, gain: 0.034, cut: 3200 },
    { hz: 1480, ms: 160, gain: 0.012, at: 60 },
  ],
  play: [
    { hz: 520, ms: 70, gain: 0.03, cut: 2400 },
    { hz: 780, ms: 140, gain: 0.03, cut: 2800, at: 60 },
  ],
  pause: [
    { hz: 780, ms: 70, gain: 0.028, cut: 2400 },
    { hz: 520, ms: 140, gain: 0.028, cut: 2000, at: 60 },
  ],
  danger: [
    { hz: 220, to: 120, ms: 140, gain: 0.05, wave: "triangle", cut: 900 },
    { hz: 900, ms: 60, gain: 0.012, noise: true, cut: 1400 },
  ],
  success: [
    { hz: 784, ms: 120, gain: 0.03, cut: 2800 },
    { hz: 1047, ms: 130, gain: 0.03, cut: 3000, at: 80 },
    { hz: 1568, ms: 420, gain: 0.026, cut: 3400, at: 160 },
  ],
  error: [
    { hz: 330, ms: 120, gain: 0.03, wave: "triangle", cut: 1400 },
    { hz: 247, ms: 220, gain: 0.03, wave: "triangle", cut: 1200, at: 110 },
  ],
} satisfies Record<string, Layer[]>;

export type SoundName = keyof typeof SOUNDS;

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let enabled = (() => {
  try {
    return localStorage.getItem("stash.sound") !== "off";
  } catch {
    return true;
  }
})();
const listeners = new Set<() => void>();

export function playSound(name: SoundName) {
  if (!enabled || typeof window === "undefined" || document.hidden) return;
  try {
    ctx ??= new AudioContext();
  } catch {
    return; // no Web Audio: stay silent
  }
  if (ctx.state !== "running") ctx.resume().catch(() => undefined);
  const now = ctx.currentTime + 0.005;
  for (const l of SOUNDS[name] as Layer[]) {
    const start = now + (l.at ?? 0) / 1000;
    const end = start + l.ms / 1000;
    let source: AudioScheduledSourceNode;
    if (l.noise) {
      noise ??= (() => {
        const b = ctx!.createBuffer(1, ctx!.sampleRate, ctx!.sampleRate);
        b.getChannelData(0).forEach((_, i, d) => (d[i] = Math.random() * 2 - 1));
        return b;
      })();
      const s = ctx.createBufferSource();
      s.buffer = noise;
      source = s;
    } else {
      const o = ctx.createOscillator();
      o.type = l.wave ?? "sine";
      o.frequency.setValueAtTime(l.hz, start);
      if (l.to) o.frequency.exponentialRampToValueAtTime(l.to, end);
      source = o;
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(l.gain, start + (l.atk ?? 4) / 1000);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    let node: AudioNode = source.connect(gain);
    if (l.cut) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = l.cut;
      node = node.connect(lp);
    }
    node.connect(ctx.destination);
    source.start(start);
    source.stop(end + 0.02);
  }
}

export const sounds = {
  enabled: () => enabled,
  toggle() {
    enabled = !enabled;
    try {
      localStorage.setItem("stash.sound", enabled ? "on" : "off");
    } catch {
      /* not remembered in private mode */
    }
    if (enabled) playSound("on");
    listeners.forEach((l) => l());
  },
};

export const useSoundsEnabled = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => enabled,
  );

// Pick the sound for a clicked element: explicit data-sound, toggles by their state, menus opening, else a tap.
function soundFor(el: Element): SoundName | null {
  const tagged = el.closest<HTMLElement>("[data-sound]");
  if (tagged) return tagged.dataset.sound === "none" ? null : (tagged.dataset.sound as SoundName);
  const target = el.closest<HTMLElement>("button, a[href], [role=menuitem], [role=menuitemcheckbox], [role=menuitemradio], [role=tab], [role=option], input[type=checkbox], label");
  if (!target || target.matches(":disabled, [aria-disabled=true], [data-disabled]")) return null;
  if (target.matches("[role=menuitem].text-danger")) return "danger";
  if (target.matches("input[type=checkbox]")) return (target as HTMLInputElement).checked ? "off" : "on";
  if (target.matches("[role=menuitemcheckbox]")) return target.getAttribute("aria-checked") === "true" ? "off" : "on";
  if (target.hasAttribute("aria-pressed")) return target.getAttribute("aria-pressed") === "true" ? "off" : "on";
  if (target.hasAttribute("aria-haspopup")) return target.getAttribute("aria-expanded") === "true" ? "close" : "open";
  return "tap";
}

if (typeof window !== "undefined") {
  // capture phase: runs before React flips aria-pressed / checked, so we read the state being left
  document.addEventListener(
    "click",
    (e) => {
      if (!(e.target instanceof Element)) return;
      const s = soundFor(e.target);
      if (s) playSound(s);
    },
    true,
  );

  // a faint tick when the pointer reaches anything clickable (not every pixel: once per element)
  let lastHover: Element | null = null;
  let lastAt = 0;
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse" || !(e.target instanceof Element)) return;
    const el = e.target.closest(
      "button, a[href], [role=menuitem], [role=menuitemcheckbox], [role=menuitemradio], [role=tab], [role=option], [role=slider], input[type=checkbox], label, [data-sound-hover]",
    );
    if (!el || el === lastHover || el.matches(":disabled, [aria-disabled=true], [data-disabled]")) return;
    lastHover = el;
    if (performance.now() - lastAt < 40) return;
    lastAt = performance.now();
    playSound("hover");
  });
}
