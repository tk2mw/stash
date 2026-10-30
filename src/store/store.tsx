import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { player } from "../player/player";
import { playSound } from "../ui/sound";
import { progressToast, toast } from "../ui/Toast";
import { getProfile } from "./profile";
import { analyzeFile, audioBlob, downloadTrack, fileName, isKitFile, isSupported, parseName, saveBlob } from "./audio";
import { clearFiles, deleteFile, loadState, putFile, saveState } from "./db";
import { chooseFolder as pickFolder, exportToFolder, folderLimit, removeAllFiles, removeFile, saveFile } from "./folder";
import { dayKey, emptyState, migrate } from "./seed";
import { playable, type Folder, type LibraryState, type Playlist, type Track } from "./types";
import { uniqueNames, zip } from "./zip";
import { descendants, pathOf } from "./tree";

const uid = () => crypto.randomUUID().slice(0, 8);

// Cover art: any image the browser can show (JPG, PNG, WebP, AVIF, SVG…), scaled to fit 1024 px, stored as WebP.
// GIFs are stored as they are, so they keep moving (redrawn on a canvas only the first frame would survive).
export async function shrinkImage(file: Blob, max = 1024): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Pick an image file (JPG, PNG, WebP, GIF, AVIF or SVG).");
  if (file.type === "image/gif" && file.size > 20e6) throw new Error("GIFs can be up to 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode().catch(() => {
      throw new Error("This image can't be opened.");
    });
    if (file.type === "image/gif") return file;
    const w = img.naturalWidth || max;
    const h = img.naturalHeight || max;
    const k = Math.min(1, max / Math.max(w, h));
    const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(w * k), height: Math.round(h * k) });
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/webp", 0.9));
  } finally {
    URL.revokeObjectURL(url);
  }
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
export const ARTIST = "talk2me";

function useLibraryActions(update: (fn: (s: LibraryState) => LibraryState) => void, get: () => LibraryState) {
  return useMemo(() => {
    const patchTracks = (ids: string[], patch: (t: Track) => Partial<Track>) =>
      update((s) => ({ ...s, tracks: s.tracks.map((t) => (ids.includes(t.id) ? { ...t, ...patch(t) } : t)) }));
    const bump = (n = 1) => update((s) => ({ ...s, activity: { ...s.activity, [dayKey(Date.now())]: (s.activity[dayKey(Date.now())] ?? 0) + n } }));
    const title = (id: string) => get().tracks.find((t) => t.id === id)?.title ?? "Item";

    const actions = {
      bump,

      updateTrack: (id: string, patch: Partial<Track>) => patchTracks([id], () => patch),
      setStarred: (ids: string[], starred: boolean) => {
        patchTracks(ids, () => ({ starred }));
        if (ids.length > 1) toast(starred ? `Starred ${plural(ids.length, "item")}` : `Unstarred ${plural(ids.length, "item")}`);
      },
      toggleStar: (id: string) => patchTracks([id], (t) => ({ starred: !t.starred })),

      trash: (ids: string[]) => {
        const name = ids.length === 1 ? `“${title(ids[0])}”` : plural(ids.length, "item");
        patchTracks(ids, () => ({ trashedAt: Date.now() }));
        toast(`Moved ${name} to Trash`, { action: { label: "Undo", onClick: () => actions.restore(ids, true) } });
      },
      restore: (ids: string[], quiet = false) => {
        patchTracks(ids, () => ({ trashedAt: null }));
        if (!quiet) toast(`Restored ${plural(ids.length, "item")}`);
      },
      destroy: async (ids: string[]) => {
        const gone = get().tracks.filter((t) => ids.includes(t.id));
        // the sound itself may be in the user's folder; covers always stay in the browser
        const files = gone.map((t) => t.fileId).filter((f): f is string => !!f);
        const covers = gone.map((t) => t.coverId).filter((f): f is string => !!f);
        player.forget(ids);
        update((s) => ({
          ...s,
          tracks: s.tracks.filter((t) => !ids.includes(t.id)),
          playlists: s.playlists.map((p) => ({ ...p, trackIds: p.trackIds.filter((id) => !ids.includes(id)) })),
        }));
        await Promise.all([...files.map(removeFile), ...covers.map(deleteFile)]).catch(() => toast("Some files could not be removed from this device", { type: "error" }));
        toast(`Deleted ${plural(ids.length, "item")} permanently`);
      },
      emptyTrash: () => {
        const ids = get().tracks.filter((t) => t.trashedAt).map((t) => t.id);
        if (ids.length) actions.destroy(ids);
      },

      move: (ids: string[], folderId: string | null) => {
        patchTracks(ids, () => ({ folderId }));
        // a folder made a moment ago (New folder…, Make a pack) isn't in get() until the next render
        const folder = get().folders.find((f) => f.id === folderId);
        toast(folder ? `Moved ${plural(ids.length, "item")} to ${folder.name}` : folderId ? `Moved ${plural(ids.length, "item")}` : `Removed ${plural(ids.length, "item")} from folder`);
      },

      createFolder: (name: string, pack?: Folder["pack"], parentId?: string): string => {
        const id = uid();
        update((s) => ({ ...s, folders: [...s.folders, { id, name, createdAt: Date.now(), ...(pack && { pack }), ...(parentId && { parentId }) } satisfies Folder] }));
        toast(`${pack ? "Pack" : "Folder"} “${name}” created`);
        return id;
      },
      updateFolder: (id: string, patch: Partial<Folder>) => update((s) => ({ ...s, folders: s.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
      // Its subfolders go too. Items move up: a subfolder's to its parent (they stay in the pack), the rest to the Library.
      deleteFolder: (id: string) => {
        const s0 = get();
        const folder = s0.folders.find((f) => f.id === id);
        const gone = descendants(s0.folders, id);
        const parent = s0.folders.find((f) => f.id === folder?.parentId);
        update((s) => ({
          ...s,
          folders: s.folders.filter((f) => !gone.includes(f.id)),
          tracks: s.tracks.map((t) => (t.folderId && gone.includes(t.folderId) ? { ...t, folderId: parent?.id ?? null } : t)),
        }));
        for (const f of s0.folders) if (gone.includes(f.id) && f.coverId) deleteFile(f.coverId).catch(() => undefined);
        toast(`${folder?.pack ? "Pack" : "Folder"} “${folder?.name}” deleted`, { description: parent ? `Its items are now in “${parent.name}”.` : "Its items are still in your Library." });
      },
      // A pack leaves stash arranged as it is inside: subfolders stay folders ("808s/Boom.wav").
      // `as`: a ZIP download, a real folder on the computer, or a RAR made by the user's own WinRAR (desktop app only).
      exportPack: async (id: string, as: "zip" | "folder" | "rar" = "zip") => {
        const s = get();
        const pack = s.folders.find((f) => f.id === id);
        const inside = descendants(s.folders, id);
        const items = s.tracks.filter((t) => t.folderId && inside.includes(t.folderId) && !t.trashedAt);
        if (!pack) return;
        if (!items.length) return toast("This pack is empty", { description: "Add sounds to it first." });
        // a "/" inside a name doesn't make a folder
        const entry = (t: Track) => [...pathOf(s.folders, t.folderId).slice(1).map((f) => f.name), fileName(t)].map((n) => n.replace(/\//g, "-")).join("/");
        const names = uniqueNames(items.map(entry));
        try {
          const files = await Promise.all(items.map(async (t, i) => ({ name: names[i], blob: await audioBlob(t) })));
          if (as === "zip") saveBlob(await zip(files), `${pack.name}.zip`);
          else if (as === "folder") {
            const made = await exportToFolder(pack.name, files);
            return toast(`Exported “${pack.name}”`, { description: `${plural(items.length, "file")} in the folder “${made}”.` });
          } else if (!(await window.stashWindow!.saveRar(pack.name, await Promise.all(files.map(async (f) => ({ path: f.name, data: await f.blob.arrayBuffer() })))))) return;
          toast(`Exported “${pack.name}”`, { description: `${plural(items.length, "file")} in a ${as.toUpperCase()}.` });
        } catch (e) {
          if ((e as Error).name === "AbortError") return; // the folder picker was closed
          toast(`Couldn't export “${pack.name}”`, { description: (e as Error).message, type: "error" });
        }
      },

      createPlaylist: (name: string, trackIds: string[] = []): string => {
        const id = uid();
        update((s) => ({ ...s, playlists: [...s.playlists, { id, name, icon: "waveform", trackIds, createdAt: Date.now() } satisfies Playlist] }));
        toast(`Playlist “${name}” created`);
        return id;
      },
      renamePlaylist: (id: string, name: string) => update((s) => ({ ...s, playlists: s.playlists.map((p) => (p.id === id ? { ...p, name } : p)) })),
      deletePlaylist: (id: string) => {
        const playlist = get().playlists.find((p) => p.id === id);
        update((s) => ({ ...s, playlists: s.playlists.filter((p) => p.id !== id) }));
        if (playlist?.coverId) deleteFile(playlist.coverId).catch(() => undefined);
        toast(`Playlist “${playlist?.name}” deleted`);
      },
      addToPlaylist: (playlistId: string, ids: string[]) => {
        const p = get().playlists.find((x) => x.id === playlistId);
        if (!p) return;
        const fresh = ids.filter((id) => !p.trackIds.includes(id));
        update((s) => ({ ...s, playlists: s.playlists.map((x) => (x.id === playlistId ? { ...x, trackIds: [...x.trackIds, ...fresh] } : x)) }));
        toast(fresh.length ? `Added ${plural(fresh.length, "item")} to ${p.name}` : `Already in ${p.name}`);
      },
      removeFromPlaylist: (playlistId: string, ids: string[]) =>
        update((s) => ({ ...s, playlists: s.playlists.map((p) => (p.id === playlistId ? { ...p, trackIds: p.trackIds.filter((id) => !ids.includes(id)) } : p)) })),


      download: async (ids: string[]) => {
        for (const t of get().tracks.filter((x) => ids.includes(x.id))) {
          await downloadTrack(t).catch((e: Error) => toast(`Couldn't download “${t.title}”`, { description: e.message, type: "error" }));
        }
      },

      // null removes the custom cover (back to the generated one)
      setCover: async (kind: "track" | "folder" | "playlist", id: string, file: File | null) => {
        const s0 = get();
        const old = (kind === "track" ? s0.tracks : kind === "folder" ? s0.folders : s0.playlists).find((x) => x.id === id)?.coverId;
        let coverId: string | null = null;
        if (file) {
          try {
            const blob = await shrinkImage(file);
            coverId = uid();
            await putFile(coverId, blob);
          } catch (e) {
            toast("Couldn't use that image", { description: (e as Error).message, type: "error" });
            return;
          }
        }
        const swap = <T extends { id: string }>(xs: T[]) => xs.map((x) => (x.id === id ? { ...x, coverId } : x));
        update((s) => (kind === "track" ? { ...s, tracks: swap(s.tracks) } : kind === "folder" ? { ...s, folders: swap(s.folders) } : { ...s, playlists: swap(s.playlists) }));
        if (old) deleteFile(old).catch(() => undefined);
        toast(file ? "Cover updated" : "Cover removed");
      },

      // `as` is what the user said the audio is; `intoPack` also keeps MIDI and synth presets
      // `playlistId`: dropped on a playlist page, so the new items join that playlist too
      upload: async (files: File[], folderId: string | null = null, as?: "track" | "sample", intoPack = false, playlistId?: string) => {
        const ok = files.filter((f) => (intoPack ? isKitFile(f.name) : isSupported(f.name)));
        const skipped = files.length - ok.length;
        if (skipped)
          toast(`Skipped ${plural(skipped, "file")}`, {
            description: intoPack ? "Packs take audio, MIDI and synth presets." : "Only audio (WAV, MP3, FLAC, AIFF, OGG, M4A) and ZIP/RAR packs. MIDI and presets go in a pack.",
          });
        if (!ok.length) return;
        // without this the browser may clear the library when the disk runs low
        navigator.storage?.persist?.().catch(() => undefined);
        const progress = progressToast.open(`Uploading ${plural(ok.length, "file")}`);
        // the space limit the user set for their stash folder (none while files live in the browser)
        const limit = folderLimit();
        let used = get().tracks.reduce((n, t) => n + (t.fileId ? t.size : 0), 0);
        const added: string[] = [];
        let full = 0;
        for (const file of ok) {
          if (limit && used + file.size > limit) {
            full++;
            progressToast.set(progress, (ok.indexOf(file) + 1) / ok.length, file.name);
            continue;
          }
          try {
            const analysis = await analyzeFile(file);
            const id = uid();
            try {
              await saveFile(id, file);
            } catch (e) {
              toast(`Couldn't save “${file.name}”`, { description: (e as Error).message, type: "error" });
              progressToast.set(progress, (ok.indexOf(file) + 1) / ok.length, file.name);
              continue;
            }
            used += file.size;
            const meta = parseName(file.name);
            const audio = playable(analysis);
            const track: Track = {
              id,
              ...analysis,
              type: audio && as ? as : analysis.type,
              title: meta.title,
              artist: getProfile()?.name || ARTIST,
              tags: [],
              // a BPM or key written in the file name wins over what the audio suggests
              key: audio ? meta.key || analysis.key : "",
              bpm: audio ? (meta.bpm ?? analysis.bpm) : null,
              size: file.size,
              addedAt: Date.now(),
              folderId,
              starred: false,
              trashedAt: null,
              fileId: id,
            };
            update((s) => ({ ...s, tracks: [track, ...s.tracks] }));
            added.push(id);
          } catch {
            toast(`Couldn't read “${file.name}”`, { description: "The file may be damaged or in an unsupported format.", type: "error" });
          }
          progressToast.set(progress, (ok.indexOf(file) + 1) / ok.length, file.name);
        }
        setTimeout(() => progressToast.close(progress), 600);
        if (full)
          toast(`${plural(full, "file")} didn't fit`, { description: `Your stash folder is limited to ${Math.round(limit! / 1e9)} GB. Raise the limit in Storage.`, type: "error" });
        if (added.length) {
          const playlist = playlistId && get().playlists.find((p) => p.id === playlistId);
          if (playlist) update((s) => ({ ...s, playlists: s.playlists.map((p) => (p.id === playlist.id ? { ...p, trackIds: [...p.trackIds, ...added] } : p)) }));
          toast(`Uploaded ${plural(added.length, "file")}`, playlist ? { description: `Added to ${playlist.name}.` } : undefined);
          playSound("success");
          bump(added.length);
        }
      },

      // pick or change the folder on this computer; the sounds already here move into it
      chooseFolder: async () => {
        const files = get()
          .tracks.filter((t) => t.fileId)
          .map((t) => ({ id: t.fileId!, name: fileName(t) }));
        let progress: string | null = null;
        try {
          await pickFolder(files, (n, total) => {
            progress ??= progressToast.open(`Moving ${plural(total, "file")} to your folder`);
            progressToast.set(progress, n / total);
          });
          toast("Folder ready", { description: "Your sounds are saved there from now on." });
        } catch (e) {
          // closing the picker isn't an error
          if ((e as Error).name !== "AbortError") toast("Couldn't use that folder", { description: (e as Error).message, type: "error" });
        } finally {
          if (progress) setTimeout(() => progressToast.close(progress!), 600);
        }
      },

      reset: async () => {
        player.forget(get().tracks.map((t) => t.id));
        await Promise.all([clearFiles(), removeAllFiles()]).catch(() => undefined);
        update(() => emptyState());
        toast("Library cleared");
      },
    };
    return actions;
  }, [update, get]);
}

export type Actions = ReturnType<typeof useLibraryActions>;
type Store = { state: LibraryState; actions: Actions };
const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState | null>(null);
  const ref = useRef<LibraryState | null>(null);
  ref.current = state;
  const persist = useRef(true);
  // Other open tabs: each save is sent to them, so a stale tab never overwrites newer changes.
  // shortcut: edits made in two tabs within the same ~250 ms keep only the last one; fine until the backend syncs.
  const channel = useRef<BroadcastChannel | null>(null);
  const fromOtherTab = useRef(false);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel("stash");
    c.onmessage = (e: MessageEvent<LibraryState>) => {
      fromOtherTab.current = true;
      setState(e.data);
    };
    channel.current = c;
    return () => c.close();
  }, []);

  useEffect(() => {
    loadState()
      // a newer state sent by another tab while this read was running wins
      .then((saved) => setState((cur) => cur ?? (saved ? migrate(saved) : emptyState())))
      .catch(() => {
        persist.current = false;
        setState(emptyState());
        toast("This browser can't save your library", { description: "Changes will be lost when you close the tab.", type: "error", timeout: 0 });
      });
  }, []);

  // save a moment after the last change
  useEffect(() => {
    if (!state) return;
    if (fromOtherTab.current) {
      fromOtherTab.current = false; // that tab already saved and sent it
      return;
    }
    const t = setTimeout(() => {
      if (persist.current)
        saveState(state)
          .then(() => channel.current?.postMessage(state))
          .catch(() => toast("Couldn't save your last changes", { description: "Storage may be full.", type: "error" }));
    }, 250);
    return () => clearTimeout(t);
  }, [state]);

  const update = useMemo(() => (fn: (s: LibraryState) => LibraryState) => setState((s) => (s ? fn(s) : s)), []);
  const get = useMemo(() => () => ref.current!, []);
  const actions = useLibraryActions(update, get);

  if (!state) return null;
  return <StoreContext.Provider value={{ state, actions }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore outside StoreProvider");
  return store;
}
