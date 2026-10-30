import type { LibraryState } from "./types";

// A brand-new library: nothing in it until the user uploads.
export const emptyState = (): LibraryState => ({ version: 2, tracks: [], folders: [], playlists: [], activity: {} });

// v1 libraries came with demo content: keep only what the user uploaded or created.
const DEMO_FOLDERS = ["f1", "f2", "f3", "f4", "f5"];
const DEMO_PLAYLISTS = ["l1", "l2", "l3", "l4"];

export function migrate(saved: { version: number } & Omit<Partial<LibraryState>, "version">): LibraryState {
  if (saved.version === 2) return saved as LibraryState;
  if (saved.version !== 1) return emptyState();
  const tracks = (saved.tracks ?? [])
    .filter((t) => t.fileId)
    .map((t) => ({ ...t, folderId: t.folderId && DEMO_FOLDERS.includes(t.folderId) ? null : t.folderId }));
  const kept = new Set(tracks.map((t) => t.id));
  return {
    version: 2,
    tracks,
    folders: (saved.folders ?? []).filter((f) => !DEMO_FOLDERS.includes(f.id)),
    playlists: (saved.playlists ?? []).filter((p) => !DEMO_PLAYLISTS.includes(p.id)).map((p) => ({ ...p, trackIds: p.trackIds.filter((id) => kept.has(id)) })),
    activity: {},
  };
}

export const dayKey = (t: number) => new Date(t).toLocaleDateString("sv-SE"); // YYYY-MM-DD in local time

// self-check for the migration (runs once in dev)
if (import.meta.env.DEV) {
  const m = migrate({
    version: 1,
    tracks: [
      { id: "t1", fileId: null, folderId: "f1" },
      { id: "u1", fileId: "u1", folderId: "f1" },
    ] as never,
    folders: [{ id: "f1" }, { id: "mine" }] as never,
    playlists: [{ id: "l1", trackIds: [] }, { id: "p9", trackIds: ["t1", "u1"] }] as never,
  });
  console.assert(m.tracks.length === 1 && m.tracks[0].folderId === null && m.folders.length === 1 && m.playlists[0].trackIds.join() === "u1", "migrate", m);
}
