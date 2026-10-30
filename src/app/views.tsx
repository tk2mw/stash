import type { ReactNode } from "react";
import { BoxIcon, StarIcon, TrashIcon, UploadIcon, LibraryIcon, WaveformIcon, DotsIcon, FolderIcon } from "../ui/icons";
import type { Actions } from "../store/store";
import type { LibraryState, Track } from "../store/types";
import { Button } from "../ui/Button";
import { MenuButton } from "../ui/Menu";
import { FuseButton } from "../ui/FuseButton";
import { WheelCarousel } from "../ui/WheelCarousel";
import type { DialogState } from "./dialogs";
import type { Route } from "./route";
import { folderMenu } from "./trackActions";
import { PackTree } from "./PackTree";
import { packOf } from "../store/tree";

export type View = {
  key: string; // a new key animates the page in
  listKey?: string; // a new list without the page animating (folders inside one pack switch instantly)
  title: string;
  items: Track[];
  count?: number; // header count when it isn't items.length
  showFolders?: "folders" | "packs";
  playlistId?: string;
  manualOrder?: boolean;
  uploadFolderId: string | null;
  headerActions?: ReactNode;
  hero?: ReactNode;
  empty: { icon: ReactNode; title: string; text: string; action?: ReactNode; upload?: () => void };
};

const icon = (I: typeof BoxIcon) => <I size="1.5rem" weight="light" />;

// What each route shows. Unknown folder/playlist ids fall back to the Library.
export function viewFor(
  route: Route,
  state: LibraryState,
  actions: Actions,
  dialog: (d: DialogState) => void,
  ui: { upload: () => void; select: (id: string) => void; selectedId: string | null },
): View {
  const live = state.tracks.filter((t) => !t.trashedAt);
  const uploadAction = (
    <Button icon={<UploadIcon size="1.125rem" />} onClick={ui.upload}>
      Upload files
    </Button>
  );
  const library: View = {
    key: "library",
    title: "Library",
    items: live,
    showFolders: "folders",
    uploadFolderId: null,
    empty: { icon: icon(LibraryIcon), title: "Drop your first tracks here", text: "Drag beats, stems and samples anywhere on the page, or click to choose files. BPM and key are detected automatically.", action: uploadAction, upload: ui.upload },
  };

  switch (route.name) {
    case "packs": {
      const packs = live.filter((t) => t.type === "pack");
      const index = Math.max(0, packs.findIndex((p) => p.id === ui.selectedId));
      return {
        key: "packs",
        title: "Packs",
        items: packs,
        count: packs.length + state.folders.filter((f) => f.pack).length,
        showFolders: "packs",
        uploadFolderId: null,
        hero: packs.length > 0 && (
          <section aria-label="Browse packs" className="mb-6 h-56 overflow-hidden rounded-xl border border-line bg-surface/40">
            <WheelCarousel
              items={packs.map((p) => ({ label: p.title, cover: p.id, coverImage: p.coverId }))}
              activeIndex={index}
              onActiveChange={(_, i) => ui.select(packs[i].id)}
              photoAspect="1/1"
              photoWidth={26}
              photoRadius={14}
              radius={260}
              spacing={15}
              visibleItems={5}
              apexInset={16}
              contentWidth={4000}
              gap={24}
              className="h-full min-h-0 px-6"
              itemClassName="text-[1.375rem]"
            />
          </section>
        ),
        empty: { icon: icon(BoxIcon), title: "No imported packs", text: "Drop a ZIP or RAR of sounds here, or make your own drum kit, loop kit or preset kit with New Pack.", action: uploadAction },
      };
    }
    case "starred":
      return { key: "starred", title: "Starred", items: live.filter((t) => t.starred), uploadFolderId: null, empty: { icon: icon(StarIcon), title: "No starred items", text: "Star tracks you come back to, or drag them onto Starred." } };
    case "trash": {
      const trashed = state.tracks.filter((t) => t.trashedAt).sort((a, b) => b.trashedAt! - a.trashedAt!);
      return {
        key: "trash",
        title: "Trash",
        items: trashed,
        manualOrder: true,
        uploadFolderId: null,
        // deletes only when the fuse burns out (4 s); the pill is Undo until then
        headerActions: trashed.length > 0 && (
          <FuseButton
            label="Empty Trash"
            undoLabel="Undo"
            doneLabel="Trash emptied"
            size="sm"
            radius={18}
            commitOn="fuseEnd"
            background="#1c1c1c"
            color="#f4f4f4"
            fuseColor="#ff6b6b"
            onCommit={actions.emptyTrash}
            className="ml-2 shrink-0"
          />
        ),
        empty: { icon: icon(TrashIcon), title: "Trash is empty", text: "Deleted items wait here until you empty the Trash." },
      };
    }
    case "folder": {
      const folder = state.folders.find((f) => f.id === route.id);
      if (!folder) return library;
      const pack = packOf(state.folders, folder.id);
      // after a delete: a subfolder goes back to its parent, a pack to Packs, a folder to the Library
      const away = () => (location.hash = folder.parentId ? `#/f/${folder.parentId}` : folder.pack ? "#/packs" : "#/library");
      return {
        key: pack ? `pack-${pack.id}` : `folder-${folder.id}`,
        listKey: pack && folder.id,
        title: folder.name,
        items: live.filter((t) => t.folderId === folder.id),
        uploadFolderId: folder.id,
        headerActions: (
          <MenuButton label={folder.pack ? "Pack options" : "Folder options"} items={folderMenu(folder, actions, dialog, away, state.folders)}>
            <DotsIcon size="1.25rem" weight="bold" />
          </MenuButton>
        ),
        hero: pack && <PackTree pack={pack} currentId={folder.id} onSelectTrack={ui.select} />,
        empty: folder.parentId
          ? { icon: icon(FolderIcon), title: "This folder is empty", text: "Drop sounds here, or drag them onto a folder in the tree above.", action: uploadAction, upload: ui.upload }
          : folder.pack
          ? { icon: icon(BoxIcon), title: "This pack is empty", text: "Drop sounds, loops, presets or MIDI here to add them to the pack. New folder makes subfolders like 808s or Snares.", action: uploadAction, upload: ui.upload }
          : { icon: icon(FolderIcon), title: "This folder is empty", text: "Drop files to upload them straight into this folder, or drag tracks onto it from the Library.", action: uploadAction, upload: ui.upload },
      };
    }
    case "playlist": {
      const playlist = state.playlists.find((p) => p.id === route.id);
      if (!playlist) return library;
      return {
        key: `playlist-${playlist.id}`,
        title: "Playlist",
        items: playlist.trackIds.map((id) => live.find((t) => t.id === id)).filter((t): t is Track => !!t),
        playlistId: playlist.id,
        manualOrder: true,
        uploadFolderId: null,
        empty: { icon: icon(WaveformIcon), title: "This playlist is empty", text: "Add tracks from their “…” menu, or drag them onto the playlist in the sidebar." },
      };
    }
    default:
      return library;
  }
}
