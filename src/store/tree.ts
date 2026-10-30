import type { Folder } from "./types";

// Subfolders: a folder with `parentId` lives inside another one (inside packs: 808s, Snares, Hi-hats…).

export const childrenOf = (folders: Folder[], id: string) => folders.filter((f) => f.parentId === id);

// `id` and every folder below it
export function descendants(folders: Folder[], id: string): string[] {
  return [id, ...childrenOf(folders, id).flatMap((f) => descendants(folders, f.id))];
}

// From the top folder down to `id` (empty if it doesn't exist). A broken parent link ends the walk.
export function pathOf(folders: Folder[], id: string | null | undefined): Folder[] {
  const path: Folder[] = [];
  for (let f = folders.find((x) => x.id === id); f && !path.includes(f); f = folders.find((x) => x.id === f!.parentId)) path.unshift(f);
  return path;
}

// The pack a folder belongs to (itself, if it's the pack)
export const packOf = (folders: Folder[], id: string | null | undefined) => pathOf(folders, id).find((f) => f.pack);

// "Drum Kit / 808s", for pickers that list every folder
export const folderLabel = (folders: Folder[], id: string) => pathOf(folders, id).map((f) => f.name).join(" / ");

// self-check (runs once in dev)
if (import.meta.env?.DEV) {
  const fs = [
    { id: "p", name: "Kit", createdAt: 0, pack: { kind: "Drum kit" } },
    { id: "a", name: "808s", createdAt: 0, parentId: "p" },
    { id: "b", name: "Long", createdAt: 0, parentId: "a" },
    { id: "x", name: "Loose", createdAt: 0 },
  ] satisfies Folder[];
  console.assert(descendants(fs, "p").join() === "p,a,b", "tree descendants");
  console.assert(pathOf(fs, "b").map((f) => f.id).join() === "p,a,b" && pathOf(fs, "nope").length === 0, "tree path");
  console.assert(packOf(fs, "b")?.id === "p" && packOf(fs, "x") === undefined, "tree packOf");
  console.assert(folderLabel(fs, "b") === "Kit / 808s / Long", "tree label");
}
