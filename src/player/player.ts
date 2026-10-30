import { useSyncExternalStore } from "react";
import { audioBlob } from "../store/audio";
import { playable, type Track } from "../store/types";
import { toast } from "../ui/Toast";

// One <audio> element for the whole app, exposed as a tiny external store.
// Its sound goes through Web Audio: an analyser (for the reactive cover glow) and a gain used for soft fades.
export type Repeat = "off" | "all" | "one";
type PlayerState = {
  id: string | null;
  playing: boolean;
  loading: boolean;
  time: number;
  duration: number;
  shuffle: boolean;
  repeat: Repeat;
  queue: string[];
  volume: number;
  muted: boolean;
};

const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem("stash.player") ?? "{}") as Partial<PlayerState>;
  } catch {
    return {};
  }
})();

let state: PlayerState = {
  id: null,
  playing: false,
  loading: false,
  time: 0,
  duration: 0,
  shuffle: false,
  repeat: "off",
  queue: [],
  volume: typeof saved.volume === "number" ? saved.volume : 0.9,
  muted: saved.muted === true,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<PlayerState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// Select a primitive (or stable value) to re-render only when it changes.
export const usePlayer = <T,>(select: (s: PlayerState) => T): T => useSyncExternalStore(subscribe, () => select(state));

const audio = typeof Audio === "undefined" ? null : new Audio();
if (audio) audio.volume = state.muted ? 0 : state.volume;
let lookup: (id: string) => Track | undefined = () => undefined;
let onStart: (id: string) => void = () => {};
let objectUrl: string | null = null;
let loadedId: string | null = null;
let frame = 0;
let fadeToken = 0;

type Graph = { ctx: AudioContext; gain: GainNode; analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> };
let graph: Graph | null = null;

// Built on the first play (browsers only allow audio after a user gesture).
function ensureGraph() {
  if (graph || !audio) return graph;
  try {
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.75;
    const gain = ctx.createGain();
    source.connect(analyser).connect(gain).connect(ctx.destination);
    graph = { ctx, gain, analyser, data: new Uint8Array(analyser.fftSize) };
  } catch {
    graph = null; // plain <audio> still works, just without glow and fades
  }
  return graph;
}

function fade(to: number, seconds: number) {
  if (!graph) return Promise.resolve();
  const { gain } = graph;
  const now = gain.context.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(to, now + seconds);
  return new Promise((r) => setTimeout(r, seconds * 1000));
}

// Loudness of what's playing right now, 0..1 (read every frame by the cover glow).
export function level() {
  if (!graph || !state.playing) return 0;
  graph.analyser.getByteTimeDomainData(graph.data);
  let sum = 0;
  for (const v of graph.data) sum += ((v - 128) / 128) ** 2;
  return Math.min(1, Math.sqrt(sum / graph.data.length) * 2.6);
}

const media = typeof navigator !== "undefined" && "mediaSession" in navigator ? navigator.mediaSession : null;
let lastPosition = 0;

// the <audio> still holds the old track for a moment after switching: its position must not carry over
const ownTime = () => (audio && loadedId === state.id ? { time: audio.currentTime } : {});

const tick = () => {
  if (!audio) return;
  set(ownTime());
  if (media && Number.isFinite(audio.duration) && performance.now() - lastPosition > 1000) {
    lastPosition = performance.now();
    media.setPositionState?.({ duration: audio.duration, position: Math.min(audio.currentTime, audio.duration), playbackRate: 1 });
  }
  if (!audio.paused) frame = requestAnimationFrame(tick);
};

audio?.addEventListener("play", () => {
  set({ playing: true });
  if (media) media.playbackState = "playing";
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(tick);
});
audio?.addEventListener("pause", () => {
  set({ playing: false, ...ownTime() });
  if (media) media.playbackState = "paused";
});
audio?.addEventListener("loadedmetadata", () => Number.isFinite(audio.duration) && set({ duration: audio.duration }));
audio?.addEventListener("ended", () => {
  if (state.repeat === "one") player.seek(0, true);
  else player.next(true);
});

async function load(id: string) {
  const track = lookup(id);
  if (!audio || !track || !playable(track)) return false;
  if (loadedId === id) return true;
  // keep a position picked on the waveform before the first play
  set({ id, loading: true, ...(state.id === id ? {} : { time: 0, duration: track.duration }) });
  try {
    const blob = await audioBlob(track);
    if (state.id !== id) return false; // another track was picked while this one loaded
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(blob);
    audio.src = objectUrl;
    loadedId = id;
    if (media) media.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: "stash" });
    return true;
  } catch (e) {
    toast(`Couldn't play “${track.title}”`, { description: (e as Error).message, type: "error" });
    return false;
  } finally {
    if (state.id === id) set({ loading: false });
  }
}

// skips packs, preset/MIDI files and tracks that no longer exist
const playableQueue = () =>
  state.queue.filter((q) => {
    const t = lookup(q);
    return !!t && playable(t);
  });

const persist = () => {
  try {
    localStorage.setItem("stash.player", JSON.stringify({ volume: state.volume, muted: state.muted }));
  } catch {
    /* private mode: volume just isn't remembered */
  }
};

export const player = {
  // App passes how to find tracks and what to do when one starts (activity, selection).
  bind(find: (id: string) => Track | undefined, started: (id: string) => void) {
    lookup = find;
    onStart = started;
  },
  get: () => state,
  async play(id = state.id, queue?: string[]) {
    if (!id || !audio) return;
    if (queue) set({ queue });
    const switching = loadedId !== id;
    if (switching) audio.pause();
    if (!(await load(id))) return;
    if (switching && state.time > 0) audio.currentTime = state.time;
    fadeToken++;
    const g = ensureGraph();
    if (g) {
      await g.ctx.resume().catch(() => undefined);
      g.gain.gain.value = 0;
    }
    await audio.play().catch(() => undefined);
    set({ playing: !audio.paused }); // also covers resuming during a fade-out (no new "play" event)
    fade(1, 0.2);
    onStart(id);
  },
  // Start a track at a given second (clicking the waveform of a track that isn't loaded).
  playFrom(id: string, seconds: number, queue?: string[]) {
    if (state.id === id && loadedId === id) return player.seek(seconds, true);
    set({ id, time: seconds, duration: lookup(id)?.duration ?? 0 });
    loadedId = null;
    player.play(id, queue);
  },
  // Fade out, then pause (a hard stop clicks).
  async pause() {
    if (!audio || audio.paused) return;
    const token = ++fadeToken;
    set({ playing: false });
    await fade(0, 0.14);
    if (token === fadeToken) audio.pause();
  },
  toggle() {
    if (state.playing) player.pause();
    else player.play();
  },
  seek(seconds: number, resume = false) {
    const t = Math.max(0, Math.min(seconds, state.duration || 0));
    set({ time: t });
    if (audio && loadedId === state.id) audio.currentTime = t;
    if (resume) player.play();
  },
  next(auto = false) {
    const { queue, id, shuffle, repeat } = state;
    if (!queue.length) return player.pause();
    const list = playableQueue();
    const i = list.indexOf(id ?? "");
    let nextId: string | undefined;
    if (shuffle && list.length > 1) {
      do nextId = list[Math.floor(Math.random() * list.length)];
      while (nextId === id);
    } else nextId = list[i + 1] ?? (repeat === "all" || !auto ? list[0] : undefined);
    if (!nextId) return set({ playing: false, time: 0 });
    set({ id: nextId, time: 0, duration: lookup(nextId)?.duration ?? 0 });
    player.play(nextId);
  },
  prev() {
    if (audio && audio.currentTime > 3) return player.seek(0);
    const list = playableQueue();
    const i = list.indexOf(state.id ?? "");
    const prevId = list[i - 1] ?? list.at(-1);
    if (!prevId) return;
    set({ id: prevId, time: 0, duration: lookup(prevId)?.duration ?? 0 });
    player.play(prevId);
  },
  setVolume(volume: number) {
    const v = Math.max(0, Math.min(1, volume));
    set({ volume: v, muted: v === 0 });
    if (audio) audio.volume = v;
    persist();
  },
  toggleMute() {
    const muted = !state.muted;
    const volume = !muted && state.volume === 0 ? 0.6 : state.volume;
    set({ muted, volume });
    if (audio) audio.volume = muted ? 0 : volume;
    persist();
  },
  toggleShuffle: () => set({ shuffle: !state.shuffle }),
  cycleRepeat: () => set({ repeat: state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off" }),
  // These tracks were deleted: drop them from the queue, stop if one was loaded.
  forget(ids: string[]) {
    set({ queue: state.queue.filter((q) => !ids.includes(q)) });
    if (!state.id || !ids.includes(state.id)) return;
    audio?.pause();
    audio?.removeAttribute("src");
    loadedId = null;
    set({ id: null, playing: false, time: 0 });
  },
};

// keyboard media keys, headset buttons, lock screen
if (media) {
  const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
    ["play", () => player.play()],
    ["pause", () => player.pause()],
    ["previoustrack", () => player.prev()],
    ["nexttrack", () => player.next()],
    ["seekto", (d) => d.seekTime !== undefined && player.seek(d.seekTime)],
    ["seekbackward", (d) => player.seek(state.time - (d.seekOffset ?? 10))],
    ["seekforward", (d) => player.seek(state.time + (d.seekOffset ?? 10))],
  ];
  for (const [action, handler] of handlers) {
    try {
      media.setActionHandler(action, handler);
    } catch {
      /* action not supported by this browser */
    }
  }
}
