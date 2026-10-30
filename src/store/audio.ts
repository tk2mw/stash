import { readFile } from "./folder";
import type { ItemType, Track } from "./types";

// stash is for producers: audio, packs of sounds, and inside kits MIDI and synth/effect presets. Nothing else.
const AUDIO_EXT = ["wav", "mp3", "flac", "aif", "aiff", "ogg", "oga", "opus", "m4a", "aac", "webm"];
const PACK_EXT = ["zip", "rar", "7z"];
const KIT_EXT = ["mid", "midi", "fxp", "fxb", "vstpreset", "aupreset", "nksf", "h2p", "vital", "serumpreset", "phaseplant", "adg", "adv"];

export const extOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");
export const isSupported = (name: string) => [...AUDIO_EXT, ...PACK_EXT].includes(extOf(name));
export const isArchive = (name: string) => PACK_EXT.includes(extOf(name));
// what a pack made in stash can hold
export const isKitFile = (name: string) => isSupported(name) || KIT_EXT.includes(extOf(name));
// the file picker shows only these
export const ACCEPT = ["audio/*", ...[...AUDIO_EXT, ...PACK_EXT, ...KIT_EXT].map((e) => `.${e}`)].join(",");

let ctx: AudioContext | null = null;

// Max |amplitude| per bucket, scaled so the loudest bucket is 1.
export function computePeaks(buffer: AudioBuffer, n = 100): number[] {
  const data = buffer.getChannelData(0);
  const size = Math.max(1, Math.floor(data.length / n));
  const peaks = Array.from({ length: n }, (_, i) => {
    let max = 0;
    for (let j = i * size, end = Math.min(data.length, j + size); j < end; j++) max = Math.max(max, Math.abs(data[j]));
    return max;
  });
  const top = Math.max(...peaks, 1e-6);
  return peaks.map((p) => Math.round((p / top) * 1000) / 1000);
}

// "0010 OTT 141 C#m.wav" -> title, bpm 141, key "C# min". Only fills what the name clearly says.
export function parseName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
  const bpmTagged = base.match(/(\d{2,3})\s*bpm/i);
  const numbers = [...base.matchAll(/(?<![\d.])(\d{2,3})(?![\d.])/g)].map((m) => Number(m[1])).filter((n) => n >= 60 && n <= 200);
  const bpm = bpmTagged ? Number(bpmTagged[1]) : (numbers.at(-1) ?? null);
  // capital note letter only, so words like "am" don't read as A minor
  const keyMatch = base.match(/(?:^|[\s\-(\[])([A-G])([#b♯♭]?)\s*([Mm]aj(?:or)?|MAJ|[Mm]in(?:or)?|MIN|m)(?=$|[\s\-)\]])/);
  const key = keyMatch ? `${keyMatch[1]}${keyMatch[2].replace("♯", "#").replace("♭", "b")} ${/^maj/i.test(keyMatch[3]) ? "maj" : "min"}` : "";
  return { title: base, bpm, key };
}

// Tempo from the onset envelope (how fast loudness rises in 5 ms frames, full band plus highs so hats and
// snares count): autocorrelation scored with the bar-level repeat at twice the lag and a wide preference for ~120.
export function detectBpm(data: Float32Array, rate: number): number | null {
  const hop = Math.round(rate / 200);
  const frames = Math.floor(data.length / hop);
  if (frames < 600) return null; // under 3 s: a one-shot has no tempo
  const raw = new Float32Array(frames);
  let prevFull = 0;
  let prevHigh = 0;
  let prevX = 0;
  let hits = 0;
  for (let f = 0; f < frames; f++) {
    let full = 0;
    let high = 0;
    for (let i = f * hop, end = i + hop; i < end; i++) {
      full += data[i] * data[i];
      high += (data[i] - prevX) ** 2;
      prevX = data[i];
    }
    const ef = Math.log(1e-6 + full / hop);
    const eh = Math.log(1e-6 + high / hop);
    raw[f] = f ? Math.max(0, ef - prevFull) + Math.max(0, eh - prevHigh) : 0;
    [prevFull, prevHigh] = [ef, eh];
    if (raw[f] > 2.5) hits++;
  }
  // fewer than one real hit a second (pads, ambience, speech): no tempo to read
  if (hits < frames / 200) return null;
  const env = new Float32Array(frames);
  let mean = 0;
  for (let f = 1; f < frames - 1; f++) mean += (env[f] = (raw[f - 1] + 2 * raw[f] + raw[f + 1]) / 4) / frames;
  let power = 0;
  for (let f = 0; f < frames; f++) power += (env[f] -= mean) ** 2 / frames;
  const fps = rate / hop;
  const lagOf = (bpm: number) => (60 * fps) / bpm;
  const maxLag = Math.min(frames - 1, Math.ceil(lagOf(70)) * 2 + 2);
  const ac = new Float32Array(maxLag + 1);
  for (let lag = Math.floor(lagOf(180)) - 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < frames; i++) sum += env[i] * env[i + lag];
    ac[lag] = sum / (frames - lag);
  }
  let best = 0;
  let bestScore = 0;
  for (let lag = Math.ceil(lagOf(180)); lag <= Math.floor(lagOf(70)); lag++) {
    const prior = Math.exp(-0.5 * Math.log2((60 * fps) / lag / 120) ** 2);
    const score = (Math.max(0, ac[lag]) + 0.5 * Math.max(0, ac[Math.min(maxLag, 2 * lag)])) * prior;
    if (score > bestScore) [best, bestScore] = [lag, score];
  }
  if (!best || ac[best] < 0.15 * power) return null;
  // half-time trap: kick and snare repeat every two beats; take the double tempo when its beat is strong too
  const half = Math.round(best / 2);
  if ((60 * fps) / best < 90 && ac[half] > 0.35 * ac[best]) best = half;
  const [a, b, c] = [ac[best - 1], ac[best], ac[best + 1]];
  const shift = a - 2 * b + c < 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
  return Math.round((60 * fps) / (best + shift));
}

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
// Krumhansl-Kessler key profiles, from C
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// In-place radix-2 FFT (re/im, length a power of two).
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j], im[i], im[j]] = [re[j], re[i], im[j], im[i]];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len / 2;
    const ang = (-2 * Math.PI) / len;
    for (let k = 0; k < half; k++) {
      const wr = Math.cos(ang * k);
      const wi = Math.sin(ang * k);
      for (let i = k; i < n; i += len) {
        const j = i + half;
        const xr = re[j] * wr - im[j] * wi;
        const xi = re[j] * wi + im[j] * wr;
        re[j] = re[i] - xr;
        im[j] = im[i] - xi;
        re[i] += xr;
        im[i] += xi;
      }
    }
  }
}

function pearson(x: number[], y: number[]) {
  const mx = x.reduce((a, b) => a + b) / x.length;
  const my = y.reduce((a, b) => a + b) / y.length;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

// Key from a chromagram (spectrum folded onto the 12 notes, 60 Hz-2 kHz, up to 48 frames across the file)
// matched against the major/minor profiles. "" when nothing fits well (drums, noise).
export function detectKey(data: Float32Array, rate: number): string {
  const n = 16384;
  if (data.length < n) return "";
  const pc = new Int8Array(n / 2).fill(-1);
  const tilt = new Float32Array(n / 2);
  for (let k = 1; k < n / 2; k++) {
    const f = (k * rate) / n;
    if (f < 60 || f > 2000) continue;
    pc[k] = ((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12;
    tilt[k] = Math.sqrt(2000 / f); // lower notes weigh more: the bass usually plays the root
  }
  const hann = Float32Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  const chroma: number[] = new Array(12).fill(0);
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  const step = Math.max(n, Math.floor((data.length - n) / 48));
  const frame: number[] = new Array(12);
  for (let start = 0; start + n <= data.length; start += step) {
    for (let i = 0; i < n; i++) re[i] = data[start + i] * hann[i];
    im.fill(0);
    fft(re, im);
    frame.fill(0);
    for (let k = 1; k < n / 2; k++) if (pc[k] >= 0) frame[pc[k]] += Math.hypot(re[k], im[k]) * tilt[k];
    // each frame counts the same, so a loud kick can't outvote the chords
    const total = frame.reduce((x, y) => x + y) || 1;
    for (let i = 0; i < 12; i++) chroma[i] += frame[i] / total;
  }
  let best = "";
  let bestR = 0.55;
  for (let root = 0; root < 12; root++) {
    const rotated = chroma.slice(root).concat(chroma.slice(0, root));
    for (const [profile, mode] of [[MAJOR, "maj"], [MINOR, "min"]] as const) {
      const r = pearson(rotated, profile);
      if (r > bestR) [best, bestR] = [`${NOTES[root]} ${mode}`, r];
    }
  }
  return best;
}

export type Analysis = Pick<Track, "type" | "duration" | "peaks" | "format" | "bpm" | "key">;

// Length from the file's header only (no decoding).
function mediaDuration(file: Blob) {
  return new Promise<number>((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const done = (d: number) => (URL.revokeObjectURL(url), resolve(Number.isFinite(d) ? d : 0));
    a.preload = "metadata";
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(0);
    a.src = url;
  });
}

export async function analyzeFile(file: File): Promise<Analysis> {
  const ext = extOf(file.name);
  if (PACK_EXT.includes(ext)) return { type: "pack", duration: 0, peaks: [], format: ext.toUpperCase(), bpm: null, key: "" };
  if (!AUDIO_EXT.includes(ext)) return { type: "file", duration: 0, peaks: [], format: ext.toUpperCase() || "FILE", bpm: null, key: "" };
  // shortcut: files over 300 MB aren't decoded (that takes several GB of memory and can crash the app): a flat waveform
  // (still a seek bar), BPM and key only from the file name. Decode in chunks if long stems need a waveform.
  if (file.size > 300e6) return { type: "track", duration: await mediaDuration(file), peaks: Array(120).fill(0.25), format: ext === "aif" ? "AIFF" : ext.toUpperCase(), bpm: null, key: "" };
  ctx ??= new AudioContext();
  const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  const type: ItemType = buffer.duration < 15 ? "sample" : "track";
  const data = buffer.getChannelData(0);
  return {
    type,
    duration: buffer.duration,
    peaks: computePeaks(buffer),
    format: ext === "aif" ? "AIFF" : ext.toUpperCase(),
    bpm: detectBpm(data, buffer.sampleRate),
    key: detectKey(data, buffer.sampleRate),
  };
}

export async function audioBlob(track: Track): Promise<Blob> {
  const blob = track.fileId ? await readFile(track.fileId) : undefined;
  if (!blob) throw new Error("The file is missing on this device.");
  return blob;
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// The name a track gets when it leaves stash (download, pack ZIP).
export const fileName = (track: Track) => (track.format === "FILE" ? track.title : `${track.title}.${track.format.toLowerCase()}`);

export async function downloadTrack(track: Track) {
  saveBlob(await audioBlob(track), fileName(track));
}

// self-check for the name parser (runs once in dev)
if (import.meta.env.DEV) {
  const p = parseName("0010 OTT 141 C#m.wav");
  console.assert(p.bpm === 141 && p.key === "C# min" && p.title === "0010 OTT 141 C#m", "parseName", p);
  console.assert(parseName("Dark Loop 90bpm Abmin.mp3").key === "Ab min", "parseName flat");
  console.assert(parseName("vocals final.wav").bpm === null, "parseName no bpm");
  console.assert(parseName("i am here.wav").key === "", "parseName no false key");

  // detectors on synthetic audio: click tracks, noise and two triads
  const rate = 22050;
  const clicks = (bpm: number) =>
    Float32Array.from({ length: rate * 12 }, (_, i) => {
      const t = (i / rate) % (60 / bpm);
      return t < 0.03 ? Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t * 80) : 0;
    });
  const chord = (hz: number[]) => Float32Array.from({ length: rate * 3 }, (_, i) => hz.reduce((sum, f) => sum + Math.sin((2 * Math.PI * f * i) / rate), 0) / hz.length);
  console.assert(detectBpm(clicks(120), rate) === 120, "detectBpm 120", detectBpm(clicks(120), rate));
  console.assert(detectBpm(clicks(140), rate) === 140, "detectBpm 140", detectBpm(clicks(140), rate));
  console.assert(detectBpm(Float32Array.from({ length: rate * 8 }, () => Math.random() - 0.5), rate) === null, "detectBpm noise");
  console.assert(detectKey(chord([220, 261.63, 329.63]), rate) === "A min", "detectKey A min", detectKey(chord([220, 261.63, 329.63]), rate));
  console.assert(detectKey(chord([261.63, 329.63, 392]), rate) === "C maj", "detectKey C maj", detectKey(chord([261.63, 329.63, 392]), rate));
}
