import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { BorderBeam } from "border-beam";
import { IconProvider, UploadIcon } from "./ui/icons";
import { player, usePlayer } from "./player/player";
import { StoreProvider, useStore } from "./store/store";
import { Toaster, toast } from "./ui/Toast";
import { TooltipProvider } from "./ui/Button";
import { ease } from "./ui/motion";
import { cx } from "./ui/cx";
import { DialogProvider, useDialog, useUpload } from "./app/dialogs";
import { NowPlaying, MiniPlayer, PlayerBar } from "./app/NowPlaying";
import { parseRoute, useHash } from "./app/route";
import { Sidebar } from "./app/Sidebar";
import { TopBar } from "./app/TopBar";
import { PlaylistPage } from "./app/PlaylistPage";
import { ProfilePage } from "./app/ProfilePage";
import { tourSeen } from "./app/Tour";
import { TitleBar } from "./app/TitleBar";
import { Onboarding } from "./app/Onboarding";
import { useProfile } from "./store/profile";
import { ACCEPT } from "./store/audio";
import { allowFolder, useFolder } from "./store/folder";
import { TrackBrowser } from "./app/TrackBrowser";
import { viewFor } from "./app/views";

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest("input, textarea, select, [contenteditable], [role=menu], [role=dialog], [role=slider], [role=listbox]");

function Shell() {
  const { state, actions } = useStore();
  const dialog = useDialog();
  const upload = useUpload();
  const route = parseRoute(useHash());
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [dropping, setDropping] = useState(false);
  const dragDepth = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => state.tracks.find((t) => !t.trashedAt)?.id ?? null);
  const playingId = usePlayer((s) => s.id);

  // the player finds tracks through the latest state; a track starting becomes the selected one
  const tracksRef = useRef(state.tracks);
  tracksRef.current = state.tracks;
  useEffect(() => {
    player.bind(
      (id) => tracksRef.current.find((t) => t.id === id),
      (id) => {
        setSelectedId(id);
        actions.bump();
      },
    );
  }, [actions]);
  useEffect(() => {
    if (playingId) setSelectedId(playingId);
  }, [playingId]);

  // first start after setup: the tour (Skip ends it)
  useEffect(() => {
    if (!tourSeen()) dialog({ kind: "tour" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // after a browser restart Chrome may want a new OK for the stash folder: ask once, with a button (it needs a click)
  const { folder, access } = useFolder();
  useEffect(() => {
    if (folder && access === "prompt")
      toast("Allow stash to open your folder", { description: `Needed to play and save sounds in ${folder.place}.`, action: { label: "Allow", onClick: allowFolder }, timeout: 0 });
  }, [folder, access]);

  // on Packs, the panel follows the pack wheel: start on the first pack
  useEffect(() => {
    if (route.name !== "packs") return;
    const current = state.tracks.find((t) => t.id === selectedId);
    if (current?.type !== "pack") setSelectedId(state.tracks.find((t) => t.type === "pack" && !t.trashedAt)?.id ?? selectedId);
  }, [route.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = viewFor(route, state, actions, dialog, { upload: () => fileInput.current?.click(), select: setSelectedId, selectedId });
  const selected = state.tracks.find((t) => t.id === selectedId) ?? view.items[0];
  const queue = useMemo(() => view.items.map((t) => t.id), [view.items]);
  const nowPlaying = state.tracks.find((t) => t.id === playingId) ?? selected;
  const playlist = view.playlistId ? state.playlists.find((p) => p.id === view.playlistId) : undefined;

  // on a playlist the player is a floating bar at the bottom: toasts rise above it
  useEffect(() => {
    document.documentElement.style.setProperty("--toast-lift", playlist && nowPlaying ? "5.5rem" : "0px");
  }, [!!playlist, !!nowPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    setNavOpen(false);
  }, [view.key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.key === "Escape") setNavOpen(false);
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const p = player.get();
      if (e.code === "Space" && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) {
        e.preventDefault();
        if (p.id) player.toggle();
        else if (selected) player.play(selected.id, queue);
      } else if (e.key.toLowerCase() === "m") {
        player.toggleMute();
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        if (e.shiftKey) dir > 0 ? player.next() : player.prev();
        else if (p.id) player.seek(p.time + dir * 5);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, queue]);

  // dropping files anywhere uploads them (into the open folder, if any)
  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes("Files");
  const dropProps = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current++;
      setDropping(true);
    },
    onDragLeave: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDropping(false);
    },
    onDragOver: (e: DragEvent) => hasFiles(e) && e.preventDefault(),
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDropping(false);
      upload([...e.dataTransfer.files], view.uploadFolderId, view.playlistId);
    },
  };

  const count = view.count ?? view.items.length;
  return (
    <div {...dropProps} className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_minmax(0,1fr)_auto] lg:grid-cols-[15rem_minmax(0,1fr)_21rem] lg:grid-rows-[auto_auto_minmax(0,1fr)]">
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        accept={ACCEPT}
        onChange={(e) => {
          upload([...(e.target.files ?? [])], view.uploadFolderId, view.playlistId);
          e.target.value = "";
        }}
      />
      <AnimatePresence>{navOpen && <motion.div aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setNavOpen(false)} className="fixed inset-0 z-20 bg-black/60 lg:hidden" />}</AnimatePresence>
      <Sidebar
        route={route}
        onNavigate={() => setNavOpen(false)}
        className={cx(
          "fixed inset-y-3 left-3 z-30 w-65 transition-transform duration-300 ease-out lg:static lg:row-span-3 lg:w-auto lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-[calc(100%+24px)]",
        )}
      />
      {/* where the title bar was: same color as the header, the sidebar runs up beside it */}
      <TitleBar className="lg:col-span-2 lg:col-start-2" />
      <TopBar
        title={route.name === "profile" ? "Profile" : view.title}
        titleKey={route.name === "profile" ? "profile" : view.key}
        subtitle={route.name === "profile" ? "Saved on this computer only" : `${count} item${count === 1 ? "" : "s"}`}
        actions={view.headerActions}
        query={query}
        onQuery={setQuery}
        searchRef={searchRef}
        onMenu={() => setNavOpen(true)}
        uploadFolderId={view.uploadFolderId}
        playlistId={view.playlistId}
        className="lg:col-span-2 lg:col-start-2"
      />
      <main ref={mainRef} className={cx("min-h-0 overflow-y-auto px-5 pb-6 pt-2 lg:px-8", playlist && "lg:col-span-2 lg:pb-28")}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={route.name === "profile" ? "profile" : view.key} initial={{ opacity: 0, y: 14, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }} exit={{ opacity: 0, y: -6, filter: "blur(4px)" }} transition={{ duration: 0.32, ease }}>
            {route.name === "profile" ? (
              <ProfilePage />
            ) : playlist ? (
              <PlaylistPage playlist={playlist} items={view.items} query={query} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
            ) : (
            <TrackBrowser
              items={view.items}
              query={query}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
              showFolders={view.showFolders}
              playlistId={view.playlistId}
              manualOrder={view.manualOrder}
              hero={view.hero}
              listKey={view.listKey}
              empty={view.empty}
            />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      {playlist ? (
        nowPlaying && (
          // centred under the page, not stretched across it
          <div className="pointer-events-none fixed bottom-4 left-[17rem] right-8 z-30 flex justify-center max-lg:hidden">
            <PlayerBar
              track={nowPlaying}
              queue={queue}
              onSelect={setSelectedId}
              subtitle={playlist.trackIds.includes(nowPlaying.id) ? playlist.name : nowPlaying.artist}
              className="pointer-events-auto w-full max-w-[52rem]"
            />
          </div>
        )
      ) : (
        <NowPlaying track={selected} queue={queue} onSelect={setSelectedId} className="hidden rounded-tl-2xl border-l border-t lg:flex" />
      )}
      <MiniPlayer track={nowPlaying} queue={queue} onSelect={setSelectedId} className="lg:hidden" />

      <AnimatePresence>
        {dropping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-black/70 p-6 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.92, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} transition={{ type: "spring", stiffness: 380, damping: 28 }}>
              <BorderBeam size="md" colorVariant="colorful" theme="dark" borderRadius={24} className="rounded-xl">
                <div className="flex w-[min(28rem,calc(100vw-3rem))] flex-col items-center gap-3 rounded-xl border border-line-strong bg-panel px-8 py-12 text-center">
                  <motion.span animate={{ y: [0, -8, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} className="grid size-14 place-items-center rounded-full bg-accent text-on-accent">
                    <UploadIcon size="1.5rem" weight="bold" />
                  </motion.span>
                  <p className="text-lg font-medium">Drop to upload</p>
                  <p className="text-base text-fg-muted">
                    Audio files and ZIP/RAR packs{view.uploadFolderId || view.playlistId ? ` go into “${view.title}”` : " go into your Library"}.
                  </p>
                </div>
              </BorderBeam>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// First visit: intro, then the artist name and the folder, before the library opens.
function Gate() {
  const profile = useProfile();
  const hash = useHash();
  if (!profile) return <Onboarding screen={hash === "#/setup" ? "setup" : "welcome"} />;
  return <Shell />;
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <IconProvider size="1.25rem" strokeWidth={1.5}>
          <TooltipProvider delay={450}>
            <StoreProvider>
              <DialogProvider>
                <Gate />
              </DialogProvider>
            </StoreProvider>
          </TooltipProvider>
          <Toaster />
      </IconProvider>
    </MotionConfig>
  );
}
