import { useEffect, useMemo, useState, type DragEvent, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  UndoIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DotsIcon,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  ListIcon,
  BoxIcon,
  PlayIcon,
  PlusIcon,
  GridIcon,
  StarIcon,
  TrashIcon,
  WaveformIcon,
  CloseIcon,
  UploadIcon,
} from "../ui/icons";
import { player, usePlayer } from "../player/player";
import { useStore } from "../store/store";
import { descendants } from "../store/tree";
import { playable, type Folder, type ItemType, type Track } from "../store/types";
import { Chip, Tag } from "../ui/Chip";
import { IconButton } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Cover } from "../ui/Cover";
import { ExpandableActionBar, type ExpandableActionBarItem } from "../ui/ExpandableActionBar";
import { ContextMenuArea, FilterMenu, MenuButton, type FilterOption, type MenuEntry } from "../ui/Menu";
import { SegmentedControl } from "../ui/SegmentedControl";
import { Waveform } from "../ui/Waveform";
import { cx } from "../ui/cx";
import { spring as motionSpring } from "../ui/motion";
import { TiltCard } from "../ui/TiltCard";
import { BorderBeam } from "border-beam";
import { useDialog } from "./dialogs";
import { startTrackDrag, useTrackDrop } from "./dnd";
import { href } from "./route";
import { folderMenu, useTrackActions } from "./trackActions";

export const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const spring = motionSpring.smooth;

const typeFilters: { label: string; value: ItemType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Tracks", value: "track" },
  { label: "Packs", value: "pack" },
  { label: "Samples", value: "sample" },
];

const bpmRanges = [
  { value: "0-129", label: "Under 130 BPM", min: 0, max: 129 },
  { value: "130-139", label: "130–139 BPM", min: 130, max: 139 },
  { value: "140-149", label: "140–149 BPM", min: 140, max: 149 },
  { value: "150-999", label: "150+ BPM", min: 150, max: 999 },
];

// Distinct values with how many items have each, most common first.
function facet(values: string[]): FilterOption[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, label: value, count }));
}

// Three bouncing bars: this row is the one playing.
export function Equalizer() {
  return (
    <span aria-hidden className="flex h-3.5 items-end gap-[2px]">
      {[0, 0.2, 0.4].map((d) => (
        <span key={d} className="w-[3px] origin-bottom animate-[eq_0.9s_ease-in-out_infinite] rounded-full bg-white" style={{ animationDelay: `${d}s`, height: "100%" }} />
      ))}
    </span>
  );
}

// Cover with a play button on hover and bars while playing.
function CoverPlay({ track, size, playing, onPlay }: { track: Track; size: string; playing: boolean; onPlay: () => void }) {
  return (
    <span className={cx("group/cover relative block shrink-0 overflow-hidden rounded-sm", size)}>
      <Cover seed={track.id} image={track.coverId} className="size-full transition-transform duration-300 ease-out group-hover/cover:scale-110" />
      {!playable(track) ? (
        <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">
          {track.type === "pack" ? <BoxIcon size="1.125rem" /> : <FileIcon size="1.125rem" />}
        </span>
      ) : (
        <button
          type="button"
          aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
          data-sound={playing ? "pause" : "play"}
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          className={cx(
            "absolute inset-0 grid place-items-center bg-black/40 text-white transition-opacity duration-200",
            playing ? "opacity-100" : "opacity-0 group-hover/cover:opacity-100 focus-visible:opacity-100",
          )}
        >
          {playing ? <Equalizer /> : <PlayIcon size="1.125rem" weight="fill" />}
        </button>
      )}
    </span>
  );
}

type RowProps = {
  track: Track;
  index: number;
  active: boolean;
  playing: boolean;
  checked: boolean;
  compact: boolean;
  actions: MenuEntry[];
  dragIds: () => string[];
  hovered: boolean;
  onHover: () => void;
  onSelect: () => void;
  onPlay: () => void;
  onStar: () => void;
  onCheck: (checked: boolean) => void;
  activeTags: string[];
  onTag: (tag: string) => void;
};

// Columns grow with the list's own width (container queries), not the viewport.
const rowCols =
  "grid-cols-[1.75rem_2.5rem_minmax(0,1fr)_2.75rem_2rem] @min-[35rem]:grid-cols-[1.25rem_1.75rem_2.5rem_minmax(0,1fr)_4.5rem_3rem_3rem_2rem] @min-[47.5rem]:grid-cols-[1.25rem_1.75rem_2.5rem_minmax(0,1fr)_minmax(8.75rem,12.5rem)_5rem_3.25rem_3.25rem_2rem]";

function TrackRow({ track, index, active, playing, checked, compact, actions, dragIds, hovered, onHover, onSelect, onPlay, onStar, onCheck, activeTags, onTag }: RowProps) {
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <ContextMenuArea
      items={actions}
      render={
        <motion.li
          layout="position"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { ...spring, delay: Math.min(index, 14) * 0.025 } }}
          exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
          transition={spring}
          draggable
          onDragStartCapture={(e: DragEvent) => startTrackDrag(e, dragIds())}
          onClick={onSelect}
          onDoubleClick={onPlay}
          onMouseEnter={onHover}
          data-sound-hover
          className={cx("group relative isolate grid cursor-pointer items-center gap-x-3 rounded-md px-3 @min-[47.5rem]:gap-x-4", rowCols, compact ? "h-11" : "h-[3.375rem]")}
        />
      }
    >
      {/* one hover highlight glides between rows; the selected row has its own */}
      <AnimatePresence>
        {hovered && !active && (
          <motion.span layoutId="row-hover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={motionSpring.glide} className="absolute inset-0 -z-10 rounded-md bg-surface/60" />
        )}
      </AnimatePresence>
      {active && <motion.span layoutId="row-active" transition={motionSpring.glide} className="absolute inset-0 -z-10 rounded-md bg-surface" />}
      <span onClick={stop} className="hidden @min-[35rem]:block">
        <Checkbox checked={checked} onChange={onCheck} label={`Select ${track.title}`} />
      </span>
      <IconButton
        size="sm"
        label={track.starred ? `Unstar ${track.title}` : `Star ${track.title}`}
        data-sound={track.starred ? "off" : "like"}
        pressed={track.starred}
        onClick={(e) => {
          stop(e);
          onStar();
        }}
        className="-ml-1"
      >
        <motion.span key={String(track.starred)} initial={{ scale: track.starred ? 0.4 : 1, rotate: track.starred ? -40 : 0 }} animate={{ scale: 1, rotate: 0 }} transition={motionSpring.bouncy}>
          <StarIcon size="1.125rem" weight={track.starred ? "fill" : "regular"} className={track.starred ? "text-fg" : undefined} />
        </motion.span>
      </IconButton>
      <CoverPlay track={track} size={compact ? "size-8" : "size-10"} playing={playing} onPlay={onPlay} />
      <div className="min-w-0">
        <button type="button" aria-current={active || undefined} className="block max-w-full text-left">
          <span className={cx("block truncate text-md transition duration-300 ease-out group-hover:translate-x-0.5", playing ? "text-fg" : "text-fg/95")}>{track.title}</span>
        </button>
        {!compact && (
          <span className="mt-1 flex gap-1.5 overflow-hidden">
            {track.tags.length ? (
              track.tags.map((t) => (
                <Tag
                  key={t}
                  active={activeTags.includes(t)}
                  onClick={(e) => {
                    stop(e);
                    onTag(t);
                  }}
                >
                  {t}
                </Tag>
              ))
            ) : (
              <span className="text-xs text-fg-subtle">{!playable(track) ? `${track.format} ${track.type}` : track.type === "sample" ? "Sample" : "No tags"}</span>
            )}
          </span>
        )}
      </div>
      {track.peaks.length ? (
        <Waveform peaks={track.peaks} bars={66} className="hidden h-7 w-full opacity-80 transition-opacity group-hover:opacity-100 @min-[47.5rem]:block" />
      ) : (
        <span className="hidden text-sm text-fg-subtle @min-[47.5rem]:block">{(track.size / 1048576).toFixed(0)} MB</span>
      )}
      <span className={cx("hidden truncate text-base @min-[35rem]:block", active ? "text-fg" : "text-fg-muted")}>{track.key || "—"}</span>
      <span className={cx("hidden text-base tabular-nums @min-[35rem]:block", active ? "text-fg" : "text-fg/80")}>{track.bpm ?? "—"}</span>
      <span className="text-base tabular-nums text-fg-muted">{track.duration ? formatTime(track.duration) : "—"}</span>
      <span onClick={stop}>
        <MenuButton label={`More options for ${track.title}`} items={actions} className="opacity-70 transition-opacity group-hover:opacity-100 data-popup-open:opacity-100">
          <DotsIcon size="1.25rem" weight="bold" />
        </MenuButton>
      </span>
    </ContextMenuArea>
  );
}

function TrackCard({ track, active, playing, actions, dragIds, onSelect, onPlay }: Pick<RowProps, "track" | "active" | "playing" | "actions" | "dragIds" | "onSelect" | "onPlay">) {
  return (
    <ContextMenuArea
      items={actions}
      render={
        <motion.li
          layout="position"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={spring}
          draggable
          onDragStartCapture={(e: DragEvent) => startTrackDrag(e, dragIds())}
          onClick={onSelect}
          onDoubleClick={onPlay}
          className="group cursor-pointer"
        />
      }
    >
      <TiltCard className="aspect-square rounded-lg">
        <CoverPlay track={track} size="size-full rounded-lg" playing={playing} onPlay={onPlay} />
        {/* drawn inside the cover: an outside ring with an offset left an uneven dark gap at the corners */}
        {active && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-inset ring-accent" />}
      </TiltCard>
      <button type="button" aria-current={active || undefined} className="mt-2.5 block w-full min-w-0 text-left">
        <span className="block truncate text-md">{track.title}</span>
        <span className="block text-sm text-fg-muted">{!playable(track) ? `${track.format} · ${(track.size / 1048576).toFixed(0)} MB` : `${track.key || "—"} · ${track.bpm ?? "—"} BPM`}</span>
      </button>
    </ContextMenuArea>
  );
}

function FolderCard({ folder, count, index }: { folder: Folder; count: number; index: number }) {
  const { state, actions } = useStore();
  const dialog = useDialog();
  const drop = useTrackDrop((ids) => actions.move(ids, folder.id));
  const items: MenuEntry[] = [
    { label: "Open", icon: <FolderOpenIcon size="1rem" />, onSelect: () => (location.hash = href({ name: "folder", id: folder.id })) },
    ...folderMenu(folder, actions, dialog, undefined, state.folders),
  ];
  return (
    <ContextMenuArea
      items={items}
      render={
        <motion.li
          layout
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, scale: drop.over ? 1.05 : 1 }}
          transition={{ ...spring, delay: index * 0.04 }}
          className="relative"
          {...drop.props}
        />
      }
    >
      <TiltCard className="rounded-lg">
      <a
        href={href({ name: "folder", id: folder.id })}
        className={cx("group relative block aspect-[15/16] overflow-hidden rounded-lg transition-shadow duration-300 ease-out hover:shadow-[0_22px_44px_-18px_rgb(0_0_0/0.95)]", drop.over && "ring-2 ring-accent")}
      >
        <Cover seed={folder.id} image={folder.coverId} className="absolute inset-0 size-full transition-transform duration-500 ease-out group-hover:scale-110" />
        <span className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent to-60%" />
        <span className="absolute inset-x-3 bottom-3 text-white">
          <span className="block truncate text-base font-medium">{folder.name}</span>
          <span className="block truncate text-xs text-white/75">
            {folder.pack?.kind && `${folder.pack.kind} · `}
            {count} item{count === 1 ? "" : "s"}
          </span>
        </span>
      </a>
      <MenuButton label={`More options for ${folder.name}`} items={items} className="absolute right-1.5 top-1.5 text-white/90 hover:bg-black/30 hover:text-white">
        <DotsIcon size="1.25rem" weight="bold" />
      </MenuButton>
      </TiltCard>
    </ContextMenuArea>
  );
}

export function TrackBrowser({
  items,
  query,
  selectedId,
  onSelect,
  showFolders,
  playlistId,
  manualOrder,
  hero,
  listKey,
  empty,
}: {
  items: Track[];
  query: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showFolders?: "folders" | "packs";
  playlistId?: string;
  manualOrder?: boolean;
  hero?: ReactNode;
  // changes when the list is swapped for another (a pack's folders): the new rows appear at once, the old ones go without exit animations
  listKey?: string;
  empty: { icon: ReactNode; title: string; text: string; action?: ReactNode; upload?: () => void };
}) {
  const { state, actions } = useStore();
  const dialog = useDialog();
  const actionsFor = useTrackActions();
  const currentId = usePlayer((s) => s.id);
  const isPlaying = usePlayer((s) => s.playing);
  const [type, setType] = useState<ItemType | "all">("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [newestFirst, setNewestFirst] = useState(true);
  const [compact, setCompact] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const [bpm, setBpm] = useState<string[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const bpmOptions = bpmRanges.map((r) => ({ ...r, count: items.filter((t) => t.bpm !== null && t.bpm >= r.min && t.bpm <= r.max).length }));
  const keyOptions = useMemo(() => facet(items.map((t) => t.key).filter(Boolean)), [items]);
  const tagOptions = useMemo(() => facet(items.flatMap((t) => t.tags)), [items]);
  const filtering = bpm.length + keys.length + tags.length > 0 || type !== "all";
  const clearFilters = () => {
    setBpm([]);
    setKeys([]);
    setTags([]);
    setType("all");
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const range = bpmRanges.find((r) => r.value === bpm[0]);
    const list = items
      .filter((t) => type === "all" || t.type === type)
      .filter((t) => !range || (t.bpm !== null && t.bpm >= range.min && t.bpm <= range.max))
      .filter((t) => keys.length === 0 || keys.includes(t.key))
      .filter((t) => tags.length === 0 || t.tags.some((tag) => tags.includes(tag)))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.tags.some((tag) => tag.includes(q)) || t.key.toLowerCase().includes(q) || !!t.credits?.some((c) => c.name.toLowerCase().includes(q)));
    return manualOrder ? list : list.sort((a, b) => (newestFirst ? b.addedAt - a.addedAt : a.addedAt - b.addedAt));
  }, [items, type, bpm, keys, tags, query, newestFirst, manualOrder]);

  // drop selections that left the list (deleted, filtered out)
  const visibleIds = visible.map((t) => t.id);
  const selected = visibleIds.filter((id) => checked.has(id));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setChecked(new Set());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleChecked = (id: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const play = (t: Track) => {
    onSelect(t.id);
    if (currentId === t.id && isPlaying) player.pause();
    else player.play(t.id, visibleIds);
  };
  const dragIds = (id: string) => () => (checked.has(id) ? selected : [id]);
  const inTrash = items.some((t) => t.trashedAt);
  const packsPage = showFolders === "packs";
  // a pack counts what its subfolders hold too
  const folderCounts = (id: string) => {
    const inside = descendants(state.folders, id);
    return state.tracks.filter((t) => t.folderId && inside.includes(t.folderId) && !t.trashedAt).length;
  };

  const bulk: ExpandableActionBarItem[] = inTrash
    ? [
        { id: "clear", label: "Clear selection", icon: <CloseIcon />, badge: selected.length, onClick: () => setChecked(new Set()) },
        { id: "restore", label: "Restore", icon: <UndoIcon />, onClick: () => (actions.restore(selected), setChecked(new Set())) },
        {
          id: "delete",
          label: "Delete permanently",
          icon: <TrashIcon />,
          onClick: () =>
            dialog({
              kind: "confirm",
              title: `Delete ${selected.length} item${selected.length === 1 ? "" : "s"} permanently?`,
              description: "Their files will be removed from this device. This can't be undone.",
              confirm: "Delete",
              danger: true,
              onConfirm: () => {
                actions.destroy(selected);
                setChecked(new Set());
              },
            }),
        },
      ]
    : [
        { id: "clear", label: "Clear selection", icon: <CloseIcon />, badge: selected.length, onClick: () => setChecked(new Set()) },
        { id: "play", label: "Play", icon: <PlayIcon weight="fill" />, onClick: () => selected[0] && player.play(selected[0], selected) },
        { id: "star", label: "Star", icon: <StarIcon />, onClick: () => actions.setStarred(selected, !selected.every((id) => state.tracks.find((t) => t.id === id)?.starred)) },
        { id: "playlist", label: "Add to playlist", icon: <WaveformIcon />, onClick: () => dialog({ kind: "playlist", ids: selected }) },
        { id: "move", label: "Move", icon: <FolderIcon />, onClick: () => dialog({ kind: "move", ids: selected }) },
        {
          id: "pack",
          label: "Make a pack",
          icon: <BoxIcon />,
          onClick: () =>
            dialog({
              kind: "pack",
              title: `New pack from ${selected.length} sound${selected.length === 1 ? "" : "s"}`,
              submit: "Create pack",
              onSubmit: (name, kind) => {
                const id = actions.createFolder(name, { kind });
                actions.move(selected, id);
                setChecked(new Set());
                location.hash = href({ name: "folder", id });
              },
            }),
        },
        { id: "download", label: "Download", icon: <DownloadIcon />, onClick: () => actions.download(selected) },
        { id: "trash", label: "Trash", icon: <TrashIcon />, onClick: () => (actions.trash(selected), setChecked(new Set())) },
      ];

  return (
    <LayoutGroup>
      {hero}
      <div className="flex items-center gap-3">
        {/* chips scroll sideways on narrow screens instead of wrapping; py-2/-my-2 leave room for the hover lift and focus ring */}
        <div className="-my-2 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 -mx-1 py-2 [scrollbar-width:none]">
          {typeFilters.map((f) => (
            <span key={f.value} className="relative">
              {type === f.value && <motion.span layoutId="type-chip" transition={motionSpring.glide} className="absolute inset-0 rounded-full bg-accent" />}
              <Chip onPill={type === f.value} onClick={() => setType(f.value)} className="relative">
                {f.label}
              </Chip>
            </span>
          ))}
          <span className="w-2.5 shrink-0" />
          <FilterMenu label="BPM" options={bpmOptions} value={bpm} onChange={setBpm} />
          <FilterMenu label="Key" options={keyOptions} value={keys} onChange={setKeys} multiple />
          <FilterMenu label="Tags" options={tagOptions} value={tags} onChange={setTags} multiple />
        </div>
        <SegmentedControl
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: "List view", icon: <ListIcon size="1.25rem" /> },
            { value: "grid", label: "Grid view", icon: <GridIcon size="1.25rem" /> },
          ]}
        />
      </div>

      {showFolders && (
        <section aria-labelledby="folders-heading" className="mt-6">
          <h2 id="folders-heading" className="flex items-center gap-1.5 text-md font-medium">
            {packsPage ? "Your packs" : "Folders"} <ChevronRightIcon size="0.875rem" className="text-fg-muted" />
          </h2>
          <ul className="-mx-2 -mb-5 mt-1 grid auto-cols-[minmax(7.75rem,9.5rem)] grid-flow-col gap-3.5 overflow-x-auto px-2 pb-6 pt-2">
            <li>
              <motion.button
                type="button"
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.96 }}
                onClick={() =>
                  packsPage
                    ? // name, kind and sounds in one go; the new pack opens right away
                      dialog({
                        kind: "pack",
                        title: "New pack",
                        submit: "Create pack",
                        files: true,
                        onSubmit: (name, kind, files) => {
                          const id = actions.createFolder(name, { kind });
                          if (files.length) actions.upload(files, id, "sample", true);
                          location.hash = href({ name: "folder", id });
                        },
                      })
                    : dialog({ kind: "name", title: "New folder", label: "Name", submit: "Create", onSubmit: (n) => actions.createFolder(n) })
                }
                className="group grid aspect-[15/16] w-full place-content-center justify-items-center gap-2 rounded-lg border border-dashed border-line-strong text-base text-fg/85 transition-colors duration-200 ease-out hover:border-fg/40 hover:bg-surface"
              >
                <PlusIcon size="1.5rem" weight="light" />
                {packsPage ? "New Pack" : "New Folder"}
              </motion.button>
            </li>
            <AnimatePresence>
              {state.folders.filter((f) => !!f.pack === packsPage && !f.parentId).map((f, i) => (
                <FolderCard key={f.id} folder={f} count={folderCounts(f.id)} index={i} />
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      <section aria-labelledby="tracks-heading" className={showFolders || hero ? "mt-7" : "mt-6"}>
        <div className="flex items-center justify-between">
          <h2 id="tracks-heading" className="flex items-baseline gap-2 text-md font-medium">
            {packsPage ? "Imported" : showFolders ? "Tracks" : "Items"}
            <motion.span key={visible.length} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-normal tabular-nums text-fg-subtle">
              {visible.length}
            </motion.span>
          </h2>
          <div className="flex items-center gap-3">
            {!manualOrder && (
              <button type="button" onClick={() => setNewestFirst((v) => !v)} className="flex items-center gap-1.5 rounded-full px-2 py-1 text-base text-fg transition-colors hover:bg-surface-2">
                Date added
                <ChevronDownIcon size="0.875rem" className={cx("transition-transform duration-300 ease-out", !newestFirst && "rotate-180")} />
                <span className="sr-only">{newestFirst ? "(newest first)" : "(oldest first)"}</span>
              </button>
            )}
            <IconButton size="sm" label="Compact rows" pressed={compact} onClick={() => setCompact((v) => !v)}>
              <ListIcon size="1.25rem" />
            </IconButton>
          </div>
        </div>

        {visible.length === 0 && empty.upload && !filtering && !query.trim() ? (
          // an empty library is one big invitation to drop files
          <motion.div initial={listKey ? false : { opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={motionSpring.smooth} className="mt-6">
            <BorderBeam size="md" colorVariant="mono" theme="dark" borderRadius={20} duration={6} className="rounded-xl">
              <motion.button
                type="button"
                onClick={empty.upload}
                whileHover={{ scale: 1.005 }}
                whileTap={{ scale: 0.99 }}
                className="group flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface/30 px-6 py-16 text-center transition-colors duration-300 hover:border-fg/30 hover:bg-surface/60"
              >
                <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="grid size-16 place-items-center rounded-full bg-accent text-on-accent transition-transform duration-300 group-hover:scale-110">
                  <UploadIcon size="1.75rem" weight="bold" />
                </motion.span>
                <span className="text-lg font-medium">{empty.title}</span>
                <span className="max-w-sm text-base text-fg-muted">{empty.text}</span>
                <span className="mt-1 text-sm text-fg-subtle">WAV · MP3 · FLAC · AIFF · OGG · M4A · ZIP/RAR packs</span>
              </motion.button>
            </BorderBeam>
          </motion.div>
        ) : visible.length === 0 ? (
          <motion.div initial={listKey ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-14 flex flex-col items-center gap-3 text-center">
            <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="grid size-14 place-items-center rounded-full bg-surface text-fg-muted">
              {filtering || query.trim() ? <CloseIcon size="1.5rem" /> : empty.icon}
            </motion.span>
            <p className="text-md font-medium">{filtering || query.trim() ? "Nothing matches" : empty.title}</p>
            <p className="max-w-xs text-base text-fg-muted">
              {query.trim() ? `No results for “${query.trim()}”${filtering ? " with these filters" : ""}.` : filtering ? "Try other filters." : empty.text}
            </p>
            {filtering ? <Chip onClick={clearFilters}>Clear filters</Chip> : !query.trim() && empty.action}
          </motion.div>
        ) : view === "list" ? (
          <ul key={listKey} onMouseLeave={() => setHoverRow(null)} className="@container relative mt-1.5 divide-y divide-line">
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((t, i) => (
                <TrackRow
                  key={t.id}
                  track={t}
                  index={i}
                  active={t.id === selectedId}
                  playing={t.id === currentId && isPlaying}
                  checked={checked.has(t.id)}
                  compact={compact}
                  actions={actionsFor(t, { queue: visibleIds, playlistId })}
                  dragIds={dragIds(t.id)}
                  hovered={hoverRow === t.id}
                  onHover={() => setHoverRow(t.id)}
                  onSelect={() => onSelect(t.id)}
                  onPlay={() => play(t)}
                  onStar={() => actions.toggleStar(t.id)}
                  onCheck={(on) => toggleChecked(t.id, on)}
                  activeTags={tags}
                  onTag={(tag) => setTags((ts) => (ts.includes(tag) ? ts.filter((x) => x !== tag) : [...ts, tag]))}
                />
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <ul key={listKey} className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-x-4 gap-y-6">
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map((t) => (
                <TrackCard
                  key={t.id}
                  track={t}
                  active={t.id === selectedId}
                  playing={t.id === currentId && isPlaying}
                  actions={actionsFor(t, { queue: visibleIds, playlistId })}
                  dragIds={dragIds(t.id)}
                  onSelect={() => onSelect(t.id)}
                  onPlay={() => play(t)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={spring}
            className="pointer-events-none sticky bottom-4 z-20 mt-6 flex justify-center"
          >
            <div className="pointer-events-auto">
              <ExpandableActionBar items={bulk} classNames={{ badge: "bg-accent! text-on-accent!" }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
