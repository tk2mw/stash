// "pack" = an imported archive (zip/rar) of sounds; "file" = MIDI or a synth/effect preset kept in a pack.
// Neither has a waveform or can be played. Packs made inside stash are folders with `pack` set.
export type ItemType = "track" | "sample" | "pack" | "file";
export const playable = (t: { type: ItemType }) => t.type === "track" || t.type === "sample";

export type Track = {
  id: string;
  title: string;
  artist: string;
  type: ItemType;
  tags: string[];
  key: string; // "" = unknown
  bpm: number | null;
  duration: number; // seconds
  format: string;
  size: number; // bytes
  addedAt: number;
  peaks: number[];
  folderId: string | null;
  starred: boolean;
  trashedAt: number | null;
  fileId: string | null; // blob in IndexedDB; null = demo item (audio is generated)
  coverId?: string | null; // custom artwork blob in IndexedDB; none = generated cover
  credits?: Credit[]; // who else worked on it
};

export type Credit = { name: string; role: string };

// `pack` makes the folder a pack made in stash (drum kit, loop kit…): it lives under Packs and exports as a ZIP.
// `parentId` makes it a subfolder (inside a pack: 808s, Snares…); see store/tree.ts.
export type Folder = { id: string; name: string; createdAt: number; coverId?: string | null; pack?: { kind: string }; parentId?: string };

export type Playlist = { id: string; name: string; icon: "waveform" | "folder"; trackIds: string[]; createdAt: number; coverId?: string | null };

export type LibraryState = {
  version: 2;
  tracks: Track[];
  folders: Folder[];
  playlists: Playlist[];
  activity: Record<string, number>; // "YYYY-MM-DD" -> uploads + plays
};
