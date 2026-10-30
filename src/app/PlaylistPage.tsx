import type { DragEvent } from "react";
import { motion } from "motion/react";
import { DotsIcon, ImageIcon, ImageRemoveIcon, PauseIcon, PenIcon, PlayIcon, PlusIcon, ShuffleIcon, TrashIcon } from "../ui/icons";
import { player, usePlayer } from "../player/player";
import { ARTIST, useStore } from "../store/store";
import { useProfile } from "../store/profile";
import type { Playlist, Track } from "../store/types";
import { IconButton } from "../ui/Button";
import { Cover } from "../ui/Cover";
import { ContextMenuArea, MenuButton } from "../ui/Menu";
import { spring } from "../ui/motion";
import { cx } from "../ui/cx";
import { useDialog } from "./dialogs";
import { startTrackDrag } from "./dnd";
import { Equalizer, formatTime } from "./TrackBrowser";
import { pickImage, useTrackActions } from "./trackActions";

// "Oct 8", "Yesterday", "Today"; older years get the year.
function added(t: number) {
  const day = (d: number) => new Date(d).toDateString();
  if (day(t) === day(Date.now())) return "Today";
  if (day(t) === day(Date.now() - 864e5)) return "Yesterday";
  const sameYear = new Date(t).getFullYear() === new Date().getFullYear();
  return new Date(t).toLocaleDateString("en", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

const total = (s: number) =>
  s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s` : `${Math.floor(s)}s`;

// A playlist as an album page: the cover on the left, title, play controls and the numbered tracks on the right.
export function PlaylistPage({ playlist, items, query, selectedId, onSelect }: { playlist: Playlist; items: Track[]; query: string; selectedId: string | null; onSelect: (id: string) => void }) {
  const { actions } = useStore();
  const profile = useProfile();
  const dialog = useDialog();
  const actionsFor = useTrackActions();
  const currentId = usePlayer((s) => s.id);
  const isPlaying = usePlayer((s) => s.playing);
  const shuffle = usePlayer((s) => s.shuffle);
  const ids = items.map((t) => t.id);
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((t) => t.title.toLowerCase().includes(q) || t.tags.some((tag) => tag.includes(q))) : items;
  const playingHere = isPlaying && !!currentId && ids.includes(currentId);

  const play = (id: string) => {
    onSelect(id);
    if (currentId === id && isPlaying) player.pause();
    else player.play(id, ids);
  };
  const playAll = () => {
    if (playingHere) return player.pause();
    if (currentId && ids.includes(currentId)) return player.play();
    const first = shuffle ? ids[Math.floor(Math.random() * ids.length)] : ids[0];
    if (first) play(first);
  };

  const menu = [
    { label: "Rename…", icon: <PenIcon size="1rem" />, onSelect: () => dialog({ kind: "name", title: "Rename playlist", label: "Name", initial: playlist.name, submit: "Save", onSubmit: (n) => actions.renamePlaylist(playlist.id, n) }) },
    { label: "Change cover…", icon: <ImageIcon size="1rem" />, onSelect: () => pickImage((f) => actions.setCover("playlist", playlist.id, f)) },
    ...(playlist.coverId ? [{ label: "Remove cover", icon: <ImageRemoveIcon size="1rem" />, onSelect: () => actions.setCover("playlist", playlist.id, null) }] : []),
    "separator" as const,
    {
      label: "Delete playlist…",
      icon: <TrashIcon size="1rem" />,
      danger: true,
      onSelect: () =>
        dialog({
          kind: "confirm",
          title: `Delete “${playlist.name}”?`,
          description: "Only the playlist is deleted, not its tracks.",
          confirm: "Delete playlist",
          danger: true,
          onConfirm: () => {
            actions.deletePlaylist(playlist.id);
            location.hash = "#/library";
          },
        }),
    },
  ];

  return (
    <div className="@container mx-auto max-w-[68rem]">
      <div className="grid gap-8 pt-7 @min-[46rem]:grid-cols-[minmax(14rem,22rem)_minmax(0,1fr)] @min-[46rem]:gap-10">
        {/* the cover is the button to change it */}
        <button
          type="button"
          onClick={() => pickImage((f) => actions.setCover("playlist", playlist.id, f))}
          aria-label="Change cover"
          className="group relative aspect-square w-full max-w-[22rem] self-start overflow-hidden rounded-xl shadow-[0_24px_60px_-28px_rgb(0_0_0/0.9)] @min-[46rem]:sticky @min-[46rem]:top-2"
        >
          <Cover seed={playlist.id} image={playlist.coverId} className="size-full transition-transform duration-500 ease-out group-hover:scale-105" />
          <span className="absolute inset-0 grid place-content-center justify-items-center gap-2 bg-black/55 text-base font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
            <ImageIcon size="1.5rem" />
            Change cover
          </span>
        </button>

        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-title font-semibold">{playlist.name}</h2>
              <p className="mt-1.5 text-base text-fg-muted">
                {profile?.name || ARTIST} · {items.length} track{items.length === 1 ? "" : "s"}
                {items.length > 0 && ` · ${total(items.reduce((s, t) => s + t.duration, 0))}`}
              </p>
            </div>
            <MenuButton label="Playlist options" items={menu}>
              <DotsIcon size="1.25rem" weight="bold" />
            </MenuButton>
            <IconButton label="Shuffle" pressed={shuffle} onClick={player.toggleShuffle} className={cx(shuffle && "text-fg")}>
              <ShuffleIcon size="1.375rem" />
            </IconButton>
            <motion.button
              type="button"
              aria-label={playingHere ? "Pause" : "Play playlist"}
              data-sound={playingHere ? "pause" : "play"}
              disabled={!items.length}
              onClick={playAll}
              whileTap={{ scale: 0.92 }}
              transition={spring.snappy}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition duration-300 ease-out hover:-translate-y-px hover:shadow-[0_8px_28px_-8px_rgb(255_255_255/0.55)] disabled:opacity-40"
            >
              {playingHere ? <PauseIcon size="1.25rem" /> : <PlayIcon size="1.25rem" className="translate-x-px" />}
            </motion.button>
          </div>

          <button
            type="button"
            onClick={() => dialog({ kind: "addTracks", playlistId: playlist.id })}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-surface text-base font-medium text-fg/90 transition-colors duration-200 hover:bg-surface-2 hover:text-fg"
          >
            <PlusIcon size="1.125rem" />
            Add tracks
          </button>

          {shown.length === 0 ? (
            <p className="mt-8 text-center text-base text-fg-muted">{q ? `No tracks match “${query.trim()}”.` : "This playlist is empty. Add tracks from your library, or drag them onto it in the sidebar."}</p>
          ) : (
            <ol className="mt-4">
              {shown.map((t, i) => {
                const playing = t.id === currentId && isPlaying;
                return (
                  <ContextMenuArea
                    key={t.id}
                    items={actionsFor(t, { queue: ids, playlistId: playlist.id })}
                    render={
                      <motion.li
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0, transition: { ...spring.smooth, delay: Math.min(i, 14) * 0.025 } }}
                        draggable
                        onDragStartCapture={(e: DragEvent) => startTrackDrag(e, [t.id])}
                        onClick={() => onSelect(t.id)}
                        onDoubleClick={() => play(t.id)}
                        data-sound-hover
                        className={cx(
                          "group grid h-[3.375rem] cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)_auto_2rem] items-center gap-3 rounded-md px-2 transition-colors duration-200",
                          t.id === selectedId ? "bg-surface" : "hover:bg-surface/60",
                        )}
                      />
                    }
                  >
                    <button
                      type="button"
                      aria-label={playing ? `Pause ${t.title}` : `Play ${t.title}`}
                      data-sound={playing ? "pause" : "play"}
                      onClick={(e) => {
                        e.stopPropagation();
                        play(t.id);
                      }}
                      className="grid h-8 place-items-center text-base tabular-nums text-fg-muted"
                    >
                      {playing ? (
                        <Equalizer />
                      ) : (
                        <>
                          <span className="group-hover:hidden">{i + 1}</span>
                          <PlayIcon size="1rem" className="hidden text-fg group-hover:block" />
                        </>
                      )}
                    </button>
                    <span className="min-w-0">
                      <span className={cx("block truncate text-md font-medium", playing ? "text-fg" : "text-fg/95")}>{t.title}</span>
                      <span className="block text-xs text-fg-subtle">{added(t.addedAt)}</span>
                    </span>
                    <span className="text-sm tabular-nums text-fg-muted">{t.duration ? formatTime(t.duration) : "—"}</span>
                    <span onClick={(e) => e.stopPropagation()}>
                      <MenuButton label={`More options for ${t.title}`} items={actionsFor(t, { queue: ids, playlistId: playlist.id })} className="opacity-70 transition-opacity group-hover:opacity-100 data-popup-open:opacity-100">
                        <DotsIcon size="1.25rem" weight="bold" />
                      </MenuButton>
                    </span>
                  </ContextMenuArea>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
