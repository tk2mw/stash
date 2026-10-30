import { useEffect, useMemo, useRef, useState } from "react";
import { getFile } from "../store/db";
import { cx } from "./cx";

// Artwork: "satin ridges", flowing satin folds catching soft highlights (our own WebGL take on the React Bits Pro
// look). Each seed (a track or folder id) gets its own palette, fold angle, density, bend and phase.
// One shared WebGL canvas paints every visible cover into that cover's own 2D canvas: a long list costs one GL context.

type Look = { colors: number[]; params: [number, number, number, number]; light: [number, number]; speed: number; fallback: string; swatches: string[]; glowHsl: string };

function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const hsl = (h: number, s: number, l: number) => {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
};
const css = ([r, g, b]: number[]) => `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;

export function lookFor(seed: string): Look {
  const r = rng(seed);
  const hue = r() * 360;
  // the highlight sits next to the base hue, or opposite it for one cover in four
  const hue2 = (hue + (r() < 0.25 ? 150 + r() * 60 : (r() < 0.5 ? -1 : 1) * (25 + r() * 45)) + 360) % 360;
  const deep = hsl(hue, 0.55 + r() * 0.3, 0.06 + r() * 0.08);
  const mid = hsl(hue, 0.6 + r() * 0.35, 0.38 + r() * 0.17);
  const glow = hsl(hue2, 0.7 + r() * 0.3, 0.72 + r() * 0.14);
  return {
    colors: [...deep, ...mid, ...glow],
    params: [r() * Math.PI, 3 + r() * 2.4, 0.6 + r() * 0.8, r() * 100],
    light: [r() * 1.6 - 0.8, r() * 1.6 - 0.8],
    speed: 0.12 + r() * 0.14,
    fallback: `radial-gradient(60% 60% at 30% 25%, ${css(glow)}, transparent 70%), linear-gradient(135deg, ${css(mid)}, ${css(deep)})`,
    swatches: [css(glow), css(mid), css(hsl(hue2, 0.9, 0.62))],
    glowHsl: `${Math.round(hue2)} 85 78`,
  };
}

const VERT = `attribute vec2 p; varying vec2 uv; void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `precision highp float;
varying vec2 uv;
uniform float t;
uniform vec3 c0, c1, c2;
uniform vec4 k; // angle, density, bend, phase
uniform vec2 light;
float ridge(vec2 p) {
  vec2 q = p + k.z * 0.35 * vec2(sin(p.y * 1.3 + t * 0.7 + k.w), cos(p.x * 1.1 - t * 0.5 + k.w * 1.3));
  q += 0.12 * vec2(sin(q.y * 2.7 - t * 0.9), sin(q.x * 2.3 + t * 0.6));
  float u = cos(k.x) * q.x + sin(k.x) * q.y;
  return sin(u * k.y + 1.4 * sin(q.y * 0.8 + t * 0.3 + k.w));
}
void main() {
  vec2 p = (uv - 0.5) * 2.0;
  float e = 0.004, h = ridge(p);
  vec2 g = vec2(ridge(p + vec2(e, 0.0)) - h, ridge(p + vec2(0.0, e)) - h) / e;
  vec3 n = normalize(vec3(-g * 0.13, 1.0));
  vec3 l = normalize(vec3(light, 0.8));
  float diff = clamp(dot(n, l), 0.0, 1.0);
  float spec = pow(clamp(dot(n, normalize(l + vec3(0.0, 0.0, 1.0))), 0.0, 1.0), 28.0);
  float sheen = pow(1.0 - n.z, 0.8);
  vec3 col = mix(c0, c1, smoothstep(0.15, 1.0, diff));
  col = mix(col, c2, clamp(spec * 0.8 + sheen * 0.35, 0.0, 1.0));
  col *= 1.0 - 0.18 * dot(p, p);
  gl_FragColor = vec4(col, 1.0);
}`;

type Entry = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; look: Look; res: number; visible: boolean };
const entries = new Set<Entry>();
const byCanvas = new WeakMap<Element, Entry>();
let gl: WebGLRenderingContext | null | undefined;
let glCanvas: HTMLCanvasElement;
let u: Record<string, WebGLUniformLocation | null> = {};
let raf = 0;
let lastFrame = 0;
const still = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function setup() {
  if (gl !== undefined) return gl;
  glCanvas = document.createElement("canvas");
  gl = glCanvas.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: false });
  if (!gl) return gl;
  const prog = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]] as const) {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    gl.attachShader(prog, sh);
  }
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return (gl = null); // the CSS fallback stays
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  u = Object.fromEntries(["t", "c0", "c1", "c2", "k", "light"].map((n) => [n, gl!.getUniformLocation(prog, n)]));
  glCanvas.addEventListener("webglcontextlost", () => (gl = null)); // covers keep their last frame
  return gl;
}

function paint(e: Entry, seconds: number) {
  const { canvas, look } = e;
  if (!gl || !canvas.width || !canvas.height) return;
  if (glCanvas.width < canvas.width || glCanvas.height < canvas.height) {
    glCanvas.width = Math.max(glCanvas.width, canvas.width);
    glCanvas.height = Math.max(glCanvas.height, canvas.height);
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform1f(u.t, seconds * look.speed);
  gl.uniform3fv(u.c0, look.colors.slice(0, 3));
  gl.uniform3fv(u.c1, look.colors.slice(3, 6));
  gl.uniform3fv(u.c2, look.colors.slice(6, 9));
  gl.uniform4fv(u.k, look.params);
  gl.uniform2fv(u.light, look.light);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // GL draws from the bottom-left corner of its (possibly larger) canvas
  e.ctx.drawImage(glCanvas, 0, glCanvas.height - canvas.height, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
}

// shortcut: one frame every ~33 ms for every visible cover; drop to fewer covers per frame if long grids stutter
function loop(now: number) {
  raf = 0;
  if (!gl) return;
  if (now - lastFrame > 32) {
    lastFrame = now;
    for (const e of entries) if (e.visible) paint(e, now / 1000);
  }
  if (!still && entries.size) raf = requestAnimationFrame(loop);
}
const kick = () => {
  if (!raf) raf = requestAnimationFrame(loop);
};

const sizeObserver =
  typeof ResizeObserver !== "undefined"
    ? new ResizeObserver((items) => {
        for (const it of items) {
          const e = byCanvas.get(it.target);
          if (!e) continue;
          const dpr = Math.min(2, window.devicePixelRatio || 1) * e.res;
          e.canvas.width = Math.max(1, Math.min(1024, Math.round(it.contentRect.width * dpr)));
          e.canvas.height = Math.max(1, Math.min(1024, Math.round(it.contentRect.height * dpr)));
          if (still) paint(e, e.look.params[3]);
        }
        lastFrame = 0;
        kick();
      })
    : null;
const viewObserver =
  typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver((items) => {
        for (const it of items) {
          const e = byCanvas.get(it.target);
          if (e) e.visible = it.isIntersecting;
        }
        lastFrame = 0;
        kick();
      })
    : null;

// Custom artwork blobs -> object URLs, made once per file and kept (a few covers, small WebP files).
const imageUrls = new Map<string, Promise<string>>();
const imageUrl = (id: string) => {
  let url = imageUrls.get(id);
  if (!url) imageUrls.set(id, (url = getFile(id).then((b) => (b ? URL.createObjectURL(b) : "")).catch(() => "")));
  return url;
};

// `image` = id of a custom cover; without it the seeded satin artwork is drawn.
export function Cover({ seed, image, res = 1, className }: { seed: string; image?: string | null; res?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const look = useMemo(() => lookFor(seed), [seed]);
  const [src, setSrc] = useState("");
  useEffect(() => {
    setSrc("");
    if (!image) return;
    let live = true;
    imageUrl(image).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [image]);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !setup()) return;
    const e: Entry = { canvas, ctx, look, res, visible: !viewObserver };
    entries.add(e);
    byCanvas.set(canvas, e);
    sizeObserver?.observe(canvas);
    viewObserver?.observe(canvas);
    return () => {
      entries.delete(e);
      sizeObserver?.unobserve(canvas);
      viewObserver?.unobserve(canvas);
    };
  }, [look, res, image]);
  if (image) return src ? <img src={src} alt="" draggable={false} className={cx("block object-cover", className)} /> : <span aria-hidden className={cx("block bg-surface-2", className)} />;
  return <canvas ref={ref} aria-hidden className={cx("block", className)} style={{ background: look.fallback }} />;
}
