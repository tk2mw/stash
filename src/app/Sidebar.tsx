import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CloudIcon,
  FolderIcon,
  HeartIcon,
  ListIcon,
  BoxIcon,
  PenIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  LibraryIcon,
  WaveformIcon,
} from "../ui/icons";
import { useFolder } from "../store/folder";
import { useStore } from "../store/store";
import { Badge } from "../ui/Chip";
import { IconButton } from "../ui/Button";
import { Logo } from "../ui/Logo";
import { ContextMenuArea, type MenuEntry } from "../ui/Menu";
import { ProgressBar } from "../ui/ProgressBar";
import { cx } from "../ui/cx";
import { spring } from "../ui/motion";
import { useDialog } from "./dialogs";
import { useTrackDrop } from "./dnd";
import { href, type Route } from "./route";

type Item = { label: string; count: number; icon: ReactNode; to: Route; noActive?: boolean; onDrop?: (ids: string[]) => void; menu?: MenuEntry[] };

// One hover highlight for the whole sidebar: it glides to whichever item the pointer is on.
const NavHover = createContext<[string | null, (key: string | null) => void]>([null, () => {}]);

const same = (a: Route, b: Route) => a.name === b.name && ("id" in a ? "id" in b && a.id === b.id : true);
export const formatBytes = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(0.1, b / 1e6).toFixed(1)} MB`);

function NavLink({ item, route, badge, onNavigate }: { item: Item; route: Route; badge?: boolean; onNavigate?: () => void }) {
  const active = !item.noActive && same(item.to, route);
  const drop = useTrackDrop(item.onDrop ?? (() => {}));
  const [hover, setHover] = useContext(NavHover);
  const key = href(item.to) + item.label;
  const link = (
    <a
      href={href(item.to)}
      onClick={onNavigate}
      onMouseEnter={() => setHover(key)}
      onFocus={() => setHover(key)}
      aria-current={active ? "page" : undefined}
      {...(item.onDrop ? drop.props : {})}
      className={cx(
        "group relative flex h-8.5 items-center gap-3 rounded-md px-3 text-base transition-colors duration-200 ease-out",
        active ? "text-fg" : "text-fg/75 hover:text-fg",
        drop.over && "bg-surface-3 ring-1 ring-fg/40",
      )}
    >
      <AnimatePresence>
        {hover === key && (
          <motion.span layoutId="nav-hover" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.glide} className="absolute inset-0 -z-10 rounded-md bg-surface-2" />
        )}
      </AnimatePresence>
      {active && <motion.span layoutId="nav-active" transition={spring.glide} className="absolute inset-0 -z-10 rounded-md bg-surface-3" />}
      <span className="text-fg/90 transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:scale-110">{item.icon}</span>
      <span className="flex-1 truncate">{item.label}</span>
      <motion.span key={item.count} initial={{ y: -3, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        {badge ? <Badge>{item.count}</Badge> : <span className="text-sm tabular-nums text-fg-muted">{item.count}</span>}
      </motion.span>
    </a>
  );
  return <li className="isolate">{item.menu ? <ContextMenuArea items={item.menu} render={<div />}>{link}</ContextMenuArea> : link}</li>;
}

function Section({ title, items, route, add, empty, onNavigate }: { title: string; items: Item[]; route: Route; add: { label: string; onClick: () => void }; empty: string; onNavigate?: () => void }) {
  return (
    <nav aria-label={title}>
      <div className="mb-1 flex items-center justify-between pl-3">
        <h2 className="text-2xs font-medium uppercase text-fg-muted">{title}</h2>
        <IconButton size="sm" label={add.label} onClick={add.onClick} className="hover:[&_svg]:rotate-90">
          <PlusIcon size="1rem" />
        </IconButton>
      </div>
      <ul>
        {items.length === 0 && <li className="px-3 py-1.5 text-sm text-fg-subtle">{empty}</li>}
        {items.map((item) => (
          <NavLink key={href(item.to) + item.label} item={item} route={route} onNavigate={onNavigate} />
        ))}
      </ul>
    </nav>
  );
}

export function Sidebar({ route, className, onNavigate }: { route: Route; className?: string; onNavigate?: () => void }) {
  const { state, actions } = useStore();
  const dialog = useDialog();
  const [quota, setQuota] = useState<number | null>(null);
  useEffect(() => {
    navigator.storage?.estimate().then((e) => setQuota(e.quota ?? null)).catch(() => setQuota(null));
  }, []);

  const hover = useState<string | null>(null);
  const live = state.tracks.filter((t) => !t.trashedAt);
  const { folder } = useFolder();
  const used = state.tracks.reduce((sum, t) => sum + t.size, 0);
  // with a folder on the computer the user's own limit is the capacity; otherwise what the browser allows
  const capacity = folder?.limit ?? quota ?? 50e9;

  const main: Item[] = [
    { label: "Library", count: live.length, icon: <LibraryIcon />, to: { name: "library" } },
    { label: "Packs", count: live.filter((t) => t.type === "pack").length + state.folders.filter((f) => f.pack).length, icon: <BoxIcon />, to: { name: "packs" } },
    { label: "Starred", count: live.filter((t) => t.starred).length, icon: <StarIcon />, to: { name: "starred" }, onDrop: (ids) => actions.setStarred(ids, true) },
    { label: "Trash", count: state.tracks.length - live.length, icon: <TrashIcon />, to: { name: "trash" }, onDrop: (ids) => actions.trash(ids) },
  ];
  const collections: Item[] = [
    { label: "All Tracks", count: live.filter((t) => t.type === "track").length, icon: <ListIcon />, to: { name: "library" }, noActive: true },
    ...state.folders
      .filter((f) => !f.pack && !f.parentId)
      .map((f) => ({
      label: f.name,
      count: live.filter((t) => t.folderId === f.id).length,
      icon: <FolderIcon />,
      to: { name: "folder", id: f.id } as Route,
      onDrop: (ids: string[]) => actions.move(ids, f.id),
      menu: [
        { label: "Rename…", icon: <PenIcon size="1rem" />, onSelect: () => dialog({ kind: "name", title: "Rename folder", label: "Name", initial: f.name, submit: "Save", onSubmit: (name) => actions.updateFolder(f.id, { name }) }) },
        { label: "Delete folder…", icon: <TrashIcon size="1rem" />, danger: true, onSelect: () => dialog({ kind: "confirm", title: `Delete “${f.name}”?`, description: "The folder goes away; its items stay in your Library.", confirm: "Delete folder", danger: true, onConfirm: () => actions.deleteFolder(f.id) }) },
      ] satisfies MenuEntry[],
    })),
  ];
  const playlists: Item[] = state.playlists.map((p) => ({
    label: p.name,
    count: p.trackIds.filter((id) => live.some((t) => t.id === id)).length,
    icon: p.icon === "folder" ? <FolderIcon /> : <WaveformIcon />,
    to: { name: "playlist", id: p.id } as Route,
    onDrop: (ids: string[]) => actions.addToPlaylist(p.id, ids),
    menu: [
      { label: "Rename…", icon: <PenIcon size="1rem" />, onSelect: () => dialog({ kind: "name", title: "Rename playlist", label: "Name", initial: p.name, submit: "Save", onSubmit: (n) => actions.renamePlaylist(p.id, n) }) },
      { label: "Delete playlist…", icon: <TrashIcon size="1rem" />, danger: true, onSelect: () => dialog({ kind: "confirm", title: `Delete “${p.name}”?`, description: "Only the playlist is deleted, not its tracks.", confirm: "Delete playlist", danger: true, onConfirm: () => actions.deletePlaylist(p.id) }) },
    ] satisfies MenuEntry[],
  }));

  return (
    <NavHover.Provider value={hover}>
    <aside onMouseLeave={() => hover[1](null)} className={cx("flex flex-col gap-5 overflow-hidden rounded-2xl border border-line bg-panel px-3 pb-4 pt-5 shadow-panel lg:rounded-none lg:border-0 lg:border-r", className)}>
      {/* the strip around the logo also moves the window in the desktop app */}
      <div className="drag-window -mx-3 -mt-5 px-3 pt-5">
        <a href="#/library" onClick={onNavigate} className="mb-1 block w-fit px-2" aria-label="stash home">
          <Logo />
        </a>
      </div>

      <nav aria-label="Main">
        <ul>
          {main.map((item) => (
            <NavLink key={item.label} item={item} route={route} badge onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>

      {/* only this part scrolls, and only when there are more folders and playlists than fit */}
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 [scrollbar-width:none]">
        <Section
          title="Collections"
          empty="No collections yet"
          items={collections}
          route={route}
          onNavigate={onNavigate}
          add={{ label: "New collection", onClick: () => dialog({ kind: "name", title: "New collection", label: "Name", submit: "Create", onSubmit: (n) => actions.createFolder(n) }) }}
        />
        <Section
          title="Playlists"
          empty="No playlists yet"
          items={playlists}
          route={route}
          onNavigate={onNavigate}
          add={{ label: "New playlist", onClick: () => dialog({ kind: "name", title: "New playlist", label: "Name", submit: "Create", onSubmit: (n) => actions.createPlaylist(n) }) }}
        />
      </div>

      <button
        type="button"
        onClick={() => dialog({ kind: "storage" })}
        className="flex shrink-0 items-center gap-3.5 rounded-lg border border-line px-3.5 py-3 text-left transition-colors hover:bg-surface"
        title={folder ? `Saved in ${folder.place}` : "Space stash may use inside this browser"}
      >
        {folder ? <FolderIcon size="1.75rem" weight="light" className="shrink-0" /> : <CloudIcon size="1.75rem" weight="light" className="shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="block text-base">Storage</span>
          <span className="block truncate text-sm text-fg-muted">
            {formatBytes(used)} of {formatBytes(capacity)}
          </span>
          <ProgressBar value={Math.max(Math.min(used / capacity, 1), 0.02)} max={1} label="Storage used" className="mt-1.5" />
        </span>
      </button>
      <p aria-label="Made with love in Italy by talk2me" className="-mt-1.5 shrink-0 text-center text-2xs text-fg-subtle">
        Made with <HeartIcon size="0.7rem" weight="bold" aria-hidden className="inline -translate-y-px text-fg-muted" /> in Italy by talk2me
      </p>
    </aside>
    </NavHover.Provider>
  );
}
