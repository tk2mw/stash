import { useSyncExternalStore } from "react";
import { deleteFile, getFile, getSetting, putFile, setSetting } from "./db";

// Where music files live on this computer: a folder the user picks (Chrome and Edge can write to the disk),
// otherwise inside the browser. Covers always stay in the browser: they aren't the user's files.
declare global {
  interface Window {
    showDirectoryPicker?: (options?: { id?: string; mode?: "read" | "readwrite"; startIn?: "music" | "documents" | "desktop" }) => Promise<FileSystemDirectoryHandle>;
  }
  interface FileSystemHandle {
    queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
    requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  }
}

// `place` is the folder the user picked (the browser never reveals full paths); `limit` is in bytes.
export type Folder = { handle: FileSystemDirectoryHandle; place: string; limit: number };
type State = { supported: boolean; folder: Folder | null; access: PermissionState | null };

const KEY = "folder";
export const DEFAULT_LIMIT = 20e9;
const listeners = new Set<() => void>();
let state: State = { supported: typeof window !== "undefined" && typeof window.showDirectoryPicker === "function", folder: null, access: null };
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

// The folder picked last time on this computer. After a browser restart the OK may have to be given again.
const ready = getSetting<Folder>(KEY)
  .then(async (folder) => folder && set({ folder, access: await folder.handle.queryPermission({ mode: "readwrite" }) }))
  .catch(() => undefined);

// file id → its name in the folder. The id in brackets is how stash finds its files again, even in a re-picked folder.
let index: Map<string, string> | null = null;
const ID_IN_NAME = /\(([0-9a-f]{8})\)(\.[^.]+)?$/;

async function names(dir: FileSystemDirectoryHandle) {
  if (index) return index;
  const map = new Map<string, string>();
  for await (const entry of dir.values()) {
    const id = entry.kind === "file" ? entry.name.match(ID_IN_NAME)?.[1] : undefined;
    if (id) map.set(id, entry.name);
  }
  return (index = map);
}

// "Kick 01.wav" → "Kick 01 (a1b2c3d4).wav"
export function nameFor(id: string, original: string) {
  const dot = original.lastIndexOf(".");
  const base = (dot > 0 ? original.slice(0, dot) : original).replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 80) || "sound";
  return `${base} (${id})${dot > 0 ? original.slice(dot).toLowerCase() : ""}`;
}

const usable = () => (state.folder && state.access === "granted" ? state.folder.handle : null);
const askFirst = () => new Error("stash needs your OK to open its folder. Press Allow in Storage.");

async function write(dir: FileSystemDirectoryHandle, name: string, blob: Blob) {
  const out = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await out.write(blob);
  await out.close();
}

// A pack exported as a real folder: a new folder called `name` inside one the user picks, with `files`
// ("808s/Boom.wav"…) in their subfolders. It never writes into a folder that's already there: "Kit (2)", "Kit (3)"…
export async function exportToFolder(name: string, files: { name: string; blob: Blob }[]) {
  const picked = await window.showDirectoryPicker!({ id: "stash-export", mode: "readwrite", startIn: "desktop" });
  const base = name.replace(/[\\/:*?"<>|]/g, "-").trim().replace(/^\.+/, "") || "pack";
  let dir: FileSystemDirectoryHandle | undefined;
  for (let i = 1; !dir; i++) {
    const n = i === 1 ? base : `${base} (${i})`;
    try {
      await picked.getDirectoryHandle(n);
    } catch (e) {
      if ((e as Error).name === "NotFoundError") dir = await picked.getDirectoryHandle(n, { create: true });
    }
  }
  for (const f of files) {
    const parts = f.name.split("/");
    let d = dir;
    for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
    await write(d, parts.at(-1)!, f.blob);
  }
  return dir.name;
}

export async function saveFile(id: string, file: File) {
  await ready;
  if (state.folder && state.access !== "granted") throw askFirst();
  const dir = usable();
  if (!dir) return putFile(id, file);
  const name = nameFor(id, file.name);
  await write(dir, name, file);
  (await names(dir)).set(id, name);
}

export async function readFile(id: string): Promise<Blob | undefined> {
  await ready;
  const dir = usable();
  const name = dir && (await names(dir)).get(id);
  if (dir && name) return (await dir.getFileHandle(name)).getFile();
  const inBrowser = await getFile(id); // saved before the folder existed
  if (!inBrowser && state.folder && !dir) throw askFirst(); // probably in the folder stash may not open yet
  return inBrowser;
}

export async function removeFile(id: string) {
  await ready;
  const dir = usable();
  const name = dir && (await names(dir)).get(id);
  if (dir && name) {
    await dir.removeEntry(name);
    index?.delete(id);
  }
  await deleteFile(id);
}

// "Delete all data": stash's own files only, never anything else the user keeps in that folder.
export async function removeAllFiles() {
  await ready;
  const dir = usable();
  if (!dir) return;
  for (const [id, name] of await names(dir)) {
    await dir.removeEntry(name);
    index!.delete(id);
  }
}

// Pick (or change) the folder; the files stash already keeps move into it, each copied before its old copy goes.
// shortcut: files in a previous folder stash may no longer open stay where they are; ask for that folder's OK if it matters
export async function chooseFolder(files: { id: string; name: string }[], onProgress: (done: number, total: number) => void) {
  // the picker must be the first await: browsers only open it straight from a click
  const picked = await window.showDirectoryPicker!({ id: "stash", mode: "readwrite", startIn: "music" });
  // a folder already called "stash" is used as it is; otherwise stash makes its own inside
  const handle = picked.name.toLowerCase() === "stash" ? picked : await picked.getDirectoryHandle("stash", { create: true });
  const from = usable();
  const fromNames = from ? await names(from) : null;
  const folder: Folder = { handle, place: picked.name.toLowerCase() === "stash" ? picked.name : `${picked.name}/stash`, limit: state.folder?.limit ?? DEFAULT_LIMIT };
  index = null;
  await setSetting(KEY, folder);
  set({ folder, access: "granted" });

  const target = await names(handle);
  let done = 0;
  for (const f of files) {
    if (!target.has(f.id)) {
      const oldName = fromNames?.get(f.id);
      const blob = oldName ? await (await from!.getFileHandle(oldName)).getFile() : await getFile(f.id);
      if (blob) {
        const name = oldName ?? nameFor(f.id, f.name);
        await write(handle, name, blob);
        target.set(f.id, name);
        if (oldName) await from!.removeEntry(oldName);
        else await deleteFile(f.id);
      }
    }
    onProgress(++done, files.length);
  }
}

export async function allowFolder() {
  if (state.folder) set({ access: await state.folder.handle.requestPermission({ mode: "readwrite" }) });
}

export async function setFolderLimit(limit: number) {
  if (!state.folder) return;
  const folder = { ...state.folder, limit };
  await setSetting(KEY, folder);
  set({ folder });
}

export const folderLimit = () => state.folder?.limit ?? null;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useFolder = () => useSyncExternalStore(subscribe, () => state);

// self-check (runs once in dev)
if (import.meta.env.DEV) {
  console.assert(nameFor("a1b2c3d4", "Kick 01.WAV") === "Kick 01 (a1b2c3d4).wav", "folder name", nameFor("a1b2c3d4", "Kick 01.WAV"));
  console.assert(nameFor("a1b2c3d4", "a/b:c.fxp").match(ID_IN_NAME)?.[1] === "a1b2c3d4" && nameFor("00ff00ff", "README").endsWith("(00ff00ff)"), "folder id");
}
