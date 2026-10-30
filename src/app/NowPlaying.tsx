import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useAnimationFrame, useMotionValue, useSpring, useTransform } from "motion/react";
import { Popover } from "@animate-ui/react/primitives/base-ui/popover";
import {
  CloseIcon,
  DotsIcon,
  HeartIcon,
  LibraryIcon,
  ListIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RepeatIcon,
  RepeatOnceIcon,
  ShuffleIcon,
  SkipBackIcon,
  SkipForwardIcon,
  VolumeIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
} from "../ui/icons";
import { level, player, usePlayer } from "../player/player";
import { useStore } from "../store/store";
import { playable, type Credit, type Track } from "../store/types";
import { IconButton } from "../ui/Button";
import { Tag } from "../ui/Chip";
import { BorderGlow } from "../ui/BorderGlow";
import { Cover, lookFor } from "../ui/Cover";
import { MenuButton } from "../ui/Menu";
import { PlayerWaveform } from "../ui/PlayerWaveform";
import { spring } from "../ui/motion";
import { SpecularButton } from "../ui/SpecularButton";
import { WakeSlider } from "../ui/WakeSlider";
import { cx } from "../ui/cx";
import { useDialog } from "./dialogs";
import { formatTime } from "./TrackBrowser";
import { useTrackActions } from "./trackActions";

// Position of the given track: live when it's the loaded one, else 0.
function useTrackTime(track: Track) {
  const isCurrent = usePlayer((s) => s.id === track.id);
  const time = usePlayer((s) => (s.id === track.id ? s.time : 0));
  const duration = usePlayer((s) => (s.id === track.id && s.duration ? s.duration : track.duration));
  return { isCurrent, time, duration };
}

// Cover with an ambient glow (a blurred copy behind it) that breathes with the loudness of the music.
function ReactiveCover({ track, live }: { track: Track; live: boolean }) {
  const raw = useMotionValue(0);
  const smooth = useSpring(raw, { stiffness: 180, damping: 22, mass: 0.6 });
  const glow = useTransform(smooth, [0, 1], [0.28, 0.85]);
  const glowScale = useTransform(smooth, [0, 1], [0.92, 1.08]);
  const scale = useTransform(smooth, [0, 1], [1, 1.025]);
  useAnimationFrame(() => raw.set(live ? level() : 0));

  return (
    <div className="relative size-full">
      <motion.div aria-hidden style={{ opacity: glow, scale: glowScale }} className="absolute inset-[6%] blur-2xl saturate-150">
        <Cover seed={track.id} image={track.coverId} res={0.25} className="size-full rounded-full" />
      </motion.div>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={track.id}
          initial={{ opacity: 0, scale: 0.92, filter: "blur(8px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
          transition={spring.smooth}
          className="absolute inset-0"
        >
          <motion.div style={{ scale }} className="size-full">
            <Cover seed={track.id} image={track.coverId} className="size-full rounded-xl shadow-[0_24px_60px_-28px_rgb(0_0_0/0.9)]" />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// The waveform as a seek slider: click or drag to jump, arrows ±5 s, the time under the pointer on hover.
function SeekWave({ track, queue, className }: { track: Track; queue: string[]; className?: string }) {
  const { isCurrent, time, duration } = useTrackTime(track);
  const [hover, setHover] = useState<number | null>(null);
  const progress = duration ? Math.min(1, time / duration) : 0;
  const seekTo = (fraction: number) => {
    const s = Math.min(1, Math.max(0, fraction)) * duration;
    if (isCurrent) player.seek(s);
    else player.playFrom(track.id, s, queue);
  };
  const fractionAt = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  const onKey = (e: KeyboardEvent) => {
    const step = duration ? 5 / duration : 0.05;
    const next = { ArrowRight: progress + step, ArrowLeft: progress - step, Home: 0, End: 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    seekTo(next);
  };
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(time)}
      aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        seekTo(fractionAt(e));
      }}
      onPointerMove={(e) => {
        setHover(fractionAt(e));
        if (e.buttons === 1) seekTo(fractionAt(e));
      }}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKey}
      className={cx("relative cursor-pointer touch-none rounded-xs", className)}
    >
      <PlayerWaveform peaks={track.peaks} progress={progress} hover={hover} trackKey={track.id} className="size-full" />
      <AnimatePresence>
        {hover !== null && (
          <motion.span
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            transition={spring.snappy}
            className="pointer-events-none absolute -top-6 -translate-x-1/2 rounded-xs bg-fg px-1.5 py-0.5 text-2xs font-medium tabular-nums tracking-normal text-on-accent"
            style={{ left: `${hover * 100}%` }}
          >
            {formatTime(hover * duration)}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function Seekbar({ track, queue }: { track: Track; queue: string[] }) {
  const { time, duration } = useTrackTime(track);
  const [remaining, setRemaining] = useState(false);
  if (!track.peaks.length)
    return <p className="mt-4 rounded-md bg-surface px-3 py-3 text-sm text-fg-muted">{track.type === "file" ? `${track.format} files` : "Packs"} have no audio preview. Download to open it.</p>;
  return (
    <div className="mt-3">
      <SeekWave track={track} queue={queue} className="h-12" />
      <div className="mt-2 flex justify-between text-sm tabular-nums text-fg/85">
        <span>{formatTime(time)}</span>
        <button type="button" onClick={() => setRemaining((r) => !r)} title="Show remaining time" className="rounded-xs transition-colors hover:text-fg">
          {remaining ? `-${formatTime(Math.max(0, duration - time))}` : formatTime(duration)}
        </button>
      </div>
    </div>
  );
}

// Toggle with a small dot under it while on (shuffle, repeat).
function ModeButton({ label, on, onClick, children }: { label: string; on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <IconButton label={label} pressed={on} onClick={onClick} className={cx("relative", on && "text-fg")}>
      {children}
      <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring.bouncy} className="absolute bottom-0.5 size-1 rounded-full bg-fg" />}</AnimatePresence>
    </IconButton>
  );
}

// Play/pause: React Bits SpecularButton (glass with a lit edge that follows the pointer); solid white while playing.
function PlayButton({ track, queue, size = "3.25rem" }: { track: Track; queue: string[]; size?: string }) {
  const isCurrent = usePlayer((s) => s.id === track.id);
  const playing = usePlayer((s) => s.playing && s.id === track.id);
  const loading = usePlayer((s) => s.loading && s.id === track.id);
  const toggle = () => (isCurrent ? player.toggle() : player.play(track.id, queue));
  return (
    <span className="relative grid place-items-center">
      {playing && (
        <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-full border border-fg/50" animate={{ scale: [1, 1.4], opacity: [0.5, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }} />
      )}
      <SpecularButton
        aria-label={playing ? "Pause" : "Play"}
        data-sound={playing ? "pause" : "play"}
        onClick={toggle}
        disabled={!playable(track)}
        radius={999}
        tint="#fafafa"
        tintOpacity={playing ? 1 : 0.06}
        textColor={playing ? "#0a0a0a" : "#f4f4f4"}
        baseColor="#5a5a5a"
        idleIntensity={0.5}
        proximity={180}
        style={{ width: size, height: size, padding: 0 }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={loading ? "l" : playing ? "p" : "s"}
            initial={{ scale: 0.5, opacity: 0, filter: "blur(4px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
            exit={{ scale: 0.5, opacity: 0, filter: "blur(4px)" }}
            transition={spring.snappy}
            className="grid"
          >
            {loading ? (
              <span className="block size-5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            ) : playing ? (
              <PauseIcon size="1.5rem" />
            ) : (
              <PlayIcon size="1.5rem" className="translate-x-px" />
            )}
          </motion.span>
        </AnimatePresence>
      </SpecularButton>
    </span>
  );
}

function Controls({ track, queue }: { track: Track; queue: string[] }) {
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  return (
    <div className="mt-1 flex items-center justify-between">
      <ModeButton label="Shuffle" on={shuffle} onClick={player.toggleShuffle}>
        <ShuffleIcon size="1.375rem" />
      </ModeButton>
      <motion.button type="button" aria-label="Previous" onClick={player.prev} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88, x: -3 }} transition={spring.snappy} className="grid size-10 place-items-center rounded-full text-fg">
        <SkipBackIcon size="1.5rem" />
      </motion.button>
      <PlayButton track={track} queue={queue} />
      <motion.button type="button" aria-label="Next" onClick={() => player.next()} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.88, x: 3 }} transition={spring.snappy} className="grid size-10 place-items-center rounded-full text-fg">
        <SkipForwardIcon size="1.5rem" />
      </motion.button>
      <ModeButton label={`Repeat: ${repeat}`} on={repeat !== "off"} onClick={player.cycleRepeat}>
        {repeat === "one" ? <RepeatOnceIcon size="1.375rem" /> : <RepeatIcon size="1.375rem" />}
      </ModeButton>
    </div>
  );
}

function Volume() {
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const v = muted ? 0 : volume;
  const kind = v === 0 ? "mute" : v < 0.5 ? "low" : "high";
  const Icon = { mute: VolumeMuteIcon, low: VolumeLowIcon, high: VolumeIcon }[kind];
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <IconButton size="sm" label={muted ? "Unmute" : "Mute"} onClick={player.toggleMute}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={kind} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={spring.snappy} className="grid">
            <Icon size="1.125rem" />
          </motion.span>
        </AnimatePresence>
      </IconButton>
      <WakeSlider label="Volume" value={v} onChange={player.setVolume} className="flex-1" />
    </div>
  );
}

// shown while the library has no tags yet, so the first ones are one click away
const STARTER_TAGS = ["drums", "melody", "808", "vocal", "loop", "one-shot", "dark", "chill"];

function TagEditor({ track }: { track: Track }) {
  const { state, actions } = useStore();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  // "trap, Dark  Vibes" -> ["trap", "dark vibes"]
  const add = (raw: string) => {
    const fresh = raw.split(",").map((t) => t.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 24)).filter((t) => t && !track.tags.includes(t));
    if (fresh.length) actions.updateTrack(track.id, { tags: [...new Set([...track.tags, ...fresh])] });
    setValue("");
  };
  // library tags by use, minus this track's, narrowed by what's typed
  const used = new Map<string, number>();
  for (const t of state.tracks) if (!t.trashedAt) for (const tag of t.tags) used.set(tag, (used.get(tag) ?? 0) + 1);
  const pool = used.size ? [...used].sort((a, b) => b[1] - a[1]).map(([tag]) => tag) : STARTER_TAGS;
  const q = value.trim().toLowerCase();
  const suggestions = pool.filter((t) => !track.tags.includes(t) && t.includes(q)).slice(0, 8);
  return (
    <div className="flex flex-wrap gap-1.5">
      <AnimatePresence initial={false}>
        {track.tags.map((t) => (
          <motion.span
            key={t}
            layout
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={spring.snappy}
            className="group/tag inline-flex h-8 items-center gap-1 rounded-full bg-surface-2 pl-3.5 pr-2 text-base transition-colors duration-200 hover:bg-surface-3"
          >
            {t}
            <button
              type="button"
              aria-label={`Remove tag ${t}`}
              onClick={() => actions.updateTrack(track.id, { tags: track.tags.filter((x) => x !== t) })}
              className="grid size-5 place-items-center rounded-full text-fg-subtle transition hover:bg-surface hover:text-fg"
            >
              <CloseIcon size="0.75rem" weight="bold" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger render={<IconButton label="Add tag" variant="outline" className="size-8" />}>
          <PlusIcon size="1rem" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6} align="start" className="z-40">
            <Popover.Popup className="w-64 rounded-lg border border-line bg-surface p-2 shadow-popover outline-none">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  add(value);
                }}
                className="flex gap-1.5"
              >
                <input autoFocus value={value} maxLength={60} onChange={(e) => setValue(e.target.value)} placeholder="Add tags, comma separated" aria-label="New tag" className="h-8 min-w-0 flex-1 rounded-sm bg-surface-2 px-2.5 text-base outline-none placeholder:text-fg-subtle" />
                <button type="submit" disabled={!q} className="rounded-sm bg-accent px-2.5 text-sm font-medium text-on-accent transition active:scale-95 disabled:opacity-40">
                  Add
                </button>
              </form>
              {suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {suggestions.map((t) => (
                    <Tag key={t} onClick={() => add(t)}>
                      + {t}
                    </Tag>
                  ))}
                </div>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

const ROLES = ["Producer", "Co-producer", "Beatmaker", "Sound engineer", "Mix engineer", "Mastering engineer", "Songwriter", "Vocalist", "Musician"];

// Collaborators: another producer, a beatmaker, the engineer… Names already used in the library are suggested.
function CreditsEditor({ track }: { track: Track }) {
  const { state, actions } = useStore();
  const [open, setOpen] = useState(false);
  const credits = track.credits ?? [];
  const known = [...new Set(state.tracks.flatMap((t) => (t.credits ?? []).map((c) => c.name)))];
  const save = (next: Credit[]) => actions.updateTrack(track.id, { credits: next });
  return (
    <div className="flex flex-wrap gap-1.5">
      <AnimatePresence initial={false}>
        {credits.map((c, i) => (
          <motion.span
            key={`${c.name}-${c.role}`}
            layout
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={spring.snappy}
            className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-surface-2 pl-3.5 pr-2 text-base transition-colors duration-200 hover:bg-surface-3"
          >
            <span className="truncate">{c.name}</span>
            <span className="shrink-0 text-sm text-fg-muted">{c.role}</span>
            <button
              type="button"
              aria-label={`Remove ${c.name}`}
              onClick={() => save(credits.filter((_, j) => j !== i))}
              className="grid size-5 shrink-0 place-items-center rounded-full text-fg-subtle transition hover:bg-surface hover:text-fg"
            >
              <CloseIcon size="0.75rem" weight="bold" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger render={<IconButton label="Add collaborator" variant="outline" className="size-8" />}>
          <PlusIcon size="1rem" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6} align="start" className="z-40">
            <Popover.Popup className="w-72 rounded-lg border border-line bg-surface p-2 shadow-popover outline-none">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  const name = String(data.get("name")).trim();
                  const role = String(data.get("role")).trim() || ROLES[0];
                  if (name && !credits.some((c) => c.name === name && c.role === role)) save([...credits, { name, role }]);
                  setOpen(false);
                }}
                className="flex flex-col gap-1.5"
              >
                <input autoFocus required name="name" list="stash-collaborators" maxLength={60} placeholder="Name" aria-label="Collaborator name" className="h-8 rounded-sm bg-surface-2 px-2.5 text-base outline-none placeholder:text-fg-subtle" />
                <datalist id="stash-collaborators">
                  {known.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <div className="flex gap-1.5">
                  <input name="role" list="stash-roles" maxLength={40} placeholder="Role, e.g. Producer" aria-label="Role" className="h-8 min-w-0 flex-1 rounded-sm bg-surface-2 px-2.5 text-base outline-none placeholder:text-fg-subtle" />
                  <datalist id="stash-roles">
                    {ROLES.map((r) => (
                      <option key={r} value={r} />
                    ))}
                  </datalist>
                  <button type="submit" className="rounded-sm bg-accent px-2.5 text-sm font-medium text-on-accent transition active:scale-95">
                    Add
                  </button>
                </div>
              </form>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function Details({ track }: { track: Track }) {
  const dialog = useDialog();
  const look = lookFor(track.id);
  const facts = [
    ["Key", track.key || "—"],
    ["BPM", track.bpm ? String(track.bpm) : "—"],
    [track.format, `${(track.size / 1048576).toFixed(1)} MB`],
  ];
  return (
    <div className="flex flex-col gap-3">
      {/* React Bits BorderGlow: the edge lights up in this cover's colors near the pointer */}
      <BorderGlow backgroundColor="#141414" borderRadius={14} glowRadius={20} edgeSensitivity={25} colors={look.swatches} glowColor={look.glowHsl} innerClassName="overflow-visible!">
        <button type="button" onClick={() => dialog({ kind: "edit", trackId: track.id })} title="Edit details" className="grid grid-cols-3 divide-x divide-line rounded-[inherit] py-2 text-left">
          {facts.map(([label, value]) => (
            <span key={label} className="min-w-0 px-3">
              <span className="block text-sm leading-5 text-fg-muted">{label}</span>
              <span className="block truncate text-md leading-5 text-fg">{value}</span>
            </span>
          ))}
        </button>
      </BorderGlow>
      <section aria-label="Tags">
        <h3 className="mb-2 text-2xs font-medium uppercase text-fg-muted">Tags</h3>
        <TagEditor track={track} />
      </section>
      <section aria-label="Credits">
        <h3 className="mb-2 text-2xs font-medium uppercase text-fg-muted">Credits</h3>
        <CreditsEditor track={track} />
      </section>
    </div>
  );
}

// What plays next, from the current queue.
function Queue({ onSelect }: { onSelect: (id: string) => void }) {
  const { state } = useStore();
  const queue = usePlayer((s) => s.queue);
  const current = usePlayer((s) => s.id);
  const playing = usePlayer((s) => s.playing);
  const items = queue.map((id) => state.tracks.find((t) => t.id === id)).filter((t): t is Track => !!t && playable(t) && !t.trashedAt);
  if (!items.length) return <p className="text-sm text-fg-muted">Nothing queued. Play a track and the rest of its list lines up here.</p>;
  return (
    <ul className="-mx-1 h-full space-y-0.5 overflow-y-auto px-1">
      {items.map((t, i) => (
        <motion.li key={t.id} layout initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring.smooth, delay: Math.min(i, 10) * 0.02 }}>
          <button
            type="button"
            onClick={() => {
              onSelect(t.id);
              player.play(t.id, queue);
            }}
            className={cx("group/q flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors duration-200 hover:bg-surface", t.id === current && "bg-surface")}
          >
            <span className="relative size-8 shrink-0 overflow-hidden rounded-xs">
              <Cover seed={t.id} image={t.coverId} className="size-full transition-transform duration-300 ease-out group-hover/q:scale-110" />
              {t.id === current && playing && (
                <span className="absolute inset-0 grid place-items-center bg-black/40">
                  <span className="flex h-3 items-end gap-[2px]">
                    {[0, 0.2, 0.4].map((d) => (
                      <span key={d} className="h-full w-[2px] origin-bottom animate-[eq_0.9s_ease-in-out_infinite] rounded-full bg-white" style={{ animationDelay: `${d}s` }} />
                    ))}
                  </span>
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cx("block truncate text-base", t.id === current ? "text-fg" : "text-fg/85")}>{t.title}</span>
              <span className="block text-xs text-fg-subtle">
                {t.key || "—"} · {t.bpm ?? "—"} BPM
              </span>
            </span>
            <span className="text-sm tabular-nums text-fg-muted">{formatTime(t.duration)}</span>
          </button>
        </motion.li>
      ))}
    </ul>
  );
}

// Shown when the panel shows another track than the one playing: one tap goes back to it.
function NowPlayingStrip({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const { state } = useStore();
  const id = usePlayer((s) => s.id);
  const playing = usePlayer((s) => s.playing);
  const progress = usePlayer((s) => (s.duration ? s.time / s.duration : 0));
  const track = state.tracks.find((t) => t.id === id);
  return (
    <AnimatePresence initial={false}>
      {track && id !== selectedId && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring.smooth} className="shrink-0 overflow-hidden">
          <div className="relative mb-3 flex items-center gap-2.5 overflow-hidden rounded-lg bg-surface py-1.5 pl-1.5 pr-1">
            <button type="button" onClick={() => onSelect(track.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              <Cover seed={track.id} image={track.coverId} className="size-8 shrink-0 rounded-xs" />
              <span className="min-w-0">
                <span className="block text-2xs uppercase text-fg-muted">Now playing</span>
                <span className="block truncate text-sm text-fg">{track.title}</span>
              </span>
            </button>
            <IconButton size="sm" label={playing ? "Pause" : "Play"} data-sound={playing ? "pause" : "play"} onClick={() => player.toggle()} className="text-fg">
              {playing ? <PauseIcon size="1rem" /> : <PlayIcon size="1rem" />}
            </IconButton>
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-surface-3">
              <span className="block h-full bg-fg" style={{ width: `${progress * 100}%` }} />
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function NowPlaying({ track, queue, onSelect, className }: { track: Track | undefined; queue: string[]; onSelect: (id: string) => void; className?: string }) {
  const { actions } = useStore();
  const actionsFor = useTrackActions();
  const live = usePlayer((s) => s.playing && s.id === track?.id);

  return (
    <aside aria-label="Now playing" className={cx("flex-col overflow-hidden border-line bg-panel p-4.5 shadow-panel", className)}>
      {!track ? (
        <div className="m-auto flex max-w-60 flex-col items-center gap-3 text-center">
          <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="grid size-14 place-items-center rounded-full bg-surface text-fg-muted">
            <LibraryIcon size="1.5rem" />
          </motion.span>
          <p className="text-md font-medium">Nothing playing</p>
          <p className="text-base text-fg-muted">Upload some tracks and pick one to play it here.</p>
        </div>
      ) : (
        <>
          <NowPlayingStrip selectedId={track.id} onSelect={onSelect} />
          {/* the cover shrinks when height is short and the tabs take any extra height, so the panel never scrolls */}
          <div className="relative min-h-24 max-h-[18.75rem] flex-[1_1_18.75rem] [container-type:size]">
            <div className="relative mx-auto size-[min(100cqw,100cqh)]">
              <ReactiveCover track={track} live={live} />
              <MenuButton label="Track options" items={actionsFor(track, { queue })} className="absolute right-2 top-2 text-white/90 hover:bg-black/30 hover:text-white">
                <DotsIcon size="1.25rem" />
              </MenuButton>
            </div>
          </div>

          <div className="mt-3.5 flex items-start gap-3">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
                exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={spring.smooth}
                className="min-w-0 flex-1"
              >
                <h2 className="truncate text-lg font-medium">{track.title}</h2>
                <p className="truncate text-base text-fg-muted">{track.artist}</p>
              </motion.div>
            </AnimatePresence>
            <IconButton size="sm" label={track.starred ? "Unstar" : "Star"} pressed={track.starred} data-sound={track.starred ? "off" : "like"} onClick={() => actions.toggleStar(track.id)} className="-mr-1 text-fg">
              <motion.span key={String(track.starred)} initial={{ scale: track.starred ? 0.3 : 1 }} animate={{ scale: 1 }} transition={spring.bouncy} className="grid">
                <HeartIcon size="1.375rem" weight={track.starred ? "fill" : "regular"} />
              </motion.span>
            </IconButton>
          </div>

          <Seekbar track={track} queue={queue} />
          <Controls track={track} queue={queue} />
          <Volume />

          <div className="mt-3 flex min-h-0 flex-[1_0_12rem] flex-col gap-4">
            <Details track={track} />
            <section aria-labelledby="queue-heading" className="flex min-h-0 flex-1 flex-col">
              <h3 id="queue-heading" className="mb-1.5 text-2xs font-medium uppercase text-fg-muted">
                Queue
              </h3>
              <div className="min-h-0 flex-1">
                <Queue onSelect={onSelect} />
              </div>
            </section>
          </div>
        </>
      )}
    </aside>
  );
}

// Floating player bar for album-like pages (playlists), in place of the side panel: everything on one line.
export function PlayerBar({ track, queue, subtitle, onSelect, className }: { track: Track; queue: string[]; subtitle: string; onSelect: (id: string) => void; className?: string }) {
  const { time, duration } = useTrackTime(track);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const volume = usePlayer((s) => (s.muted ? 0 : s.volume));
  const VolumeNow = volume === 0 ? VolumeMuteIcon : volume < 0.5 ? VolumeLowIcon : VolumeIcon;
  const popup = "rounded-lg border border-line bg-surface shadow-popover outline-none";
  return (
    <div role="region" aria-label="Player" className={cx("flex h-[4.5rem] items-center gap-3 rounded-full border border-line bg-surface/85 pl-3 pr-3 shadow-popover backdrop-blur-xl", className)}>
      <Cover seed={track.id} image={track.coverId} className="size-12 shrink-0 rounded-full" />
      <div className="w-36 min-w-0 shrink-0">
        <p className="truncate text-base font-medium">{track.title}</p>
        <p className="truncate text-sm text-fg-muted">{subtitle}</p>
      </div>
      {track.peaks.length ? <SeekWave track={track} queue={queue} className="h-9 min-w-20 flex-1" /> : <span className="flex-1 text-sm text-fg-subtle">No audio preview</span>}
      <span className="shrink-0 text-sm tabular-nums text-fg-muted">
        {formatTime(time)} / {formatTime(duration)}
      </span>
      <div className="flex shrink-0 items-center gap-0.5">
        <IconButton label="Previous" onClick={player.prev} className="text-fg">
          <SkipBackIcon size="1.25rem" />
        </IconButton>
        <PlayButton track={track} queue={queue} size="2.75rem" />
        <IconButton label="Next" onClick={() => player.next()} className="text-fg">
          <SkipForwardIcon size="1.25rem" />
        </IconButton>
        <ModeButton label="Shuffle" on={shuffle} onClick={player.toggleShuffle}>
          <ShuffleIcon size="1.25rem" />
        </ModeButton>
        <ModeButton label={`Repeat: ${repeat}`} on={repeat !== "off"} onClick={player.cycleRepeat}>
          {repeat === "one" ? <RepeatOnceIcon size="1.25rem" /> : <RepeatIcon size="1.25rem" />}
        </ModeButton>
        <Popover.Root>
          <Popover.Trigger render={<IconButton label="Queue" />}>
            <ListIcon size="1.25rem" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="top" sideOffset={14} align="end" className="z-40">
              <Popover.Popup className={cx(popup, "h-80 w-80 p-2")}>
                <Queue onSelect={onSelect} />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
        <Popover.Root>
          <Popover.Trigger render={<IconButton label="Volume" />}>
            <VolumeNow size="1.25rem" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="top" sideOffset={14} align="end" className="z-40">
              <Popover.Popup className={cx(popup, "w-72 px-2 pb-1.5")}>
                <Volume />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  );
}

// Compact bar on narrow screens; tapping it opens the full player as a sheet you can swipe down.
export function MiniPlayer({ track, queue, onSelect, className }: { track: Track | undefined; queue: string[]; onSelect: (id: string) => void; className?: string }) {
  const playing = usePlayer((s) => s.playing);
  const progress = usePlayer((s) => (s.duration ? s.time / s.duration : 0));
  const [open, setOpen] = useState(false);
  if (!track) return null;
  return (
    <>
      <div role="region" aria-label="Now playing" className={cx("relative flex items-center gap-3 border-t border-line bg-panel px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]", className)}>
        <div aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-surface-3">
          <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
        <button type="button" onClick={() => setOpen(true)} aria-label="Open player" className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Cover seed={track.id} image={track.coverId} className="size-10 shrink-0 rounded-sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base">{track.title}</span>
            <span className="block truncate text-sm text-fg-muted">{track.artist}</span>
          </span>
        </button>
        <IconButton label={playing ? "Pause" : "Play"} data-sound={playing ? "pause" : "play"} onClick={() => (player.get().id ? player.toggle() : player.play(track.id, queue))} className="text-fg">
          {playing ? <PauseIcon size="1.375rem" /> : <PlayIcon size="1.375rem" />}
        </IconButton>
        <IconButton label="Next" onClick={() => player.next()} className="text-fg">
          <SkipForwardIcon size="1.375rem" />
        </IconButton>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Player"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={spring.smooth}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => (info.offset.y > 120 || info.velocity.y > 600) && setOpen(false)}
            className="fixed inset-0 z-40 flex flex-col bg-panel pt-[env(safe-area-inset-top)] lg:hidden"
          >
            <div className="flex justify-center pt-2">
              <button type="button" aria-label="Close player" onClick={() => setOpen(false)} className="h-1.5 w-12 rounded-full bg-surface-3" />
            </div>
            <NowPlaying track={track} queue={queue} onSelect={onSelect} className="flex min-h-0 flex-1" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
