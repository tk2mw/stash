import {
  UndoIcon,
  BoxIcon,
  DownloadIcon,
  FolderIcon,
  ImageIcon,
  ImageRemoveIcon,
  MinusCircleIcon,
  PauseIcon,
  PenIcon,
  PlayIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  WaveformIcon,
} from "../ui/icons";
import { player, usePlayer } from "../player/player";
import { useStore, type Actions } from "../store/store";
import { folderLabel, packOf } from "../store/tree";
import { playable, type Folder, type Track } from "../store/types";
import type { MenuEntry } from "../ui/Menu";
import { useDialog, type DialogState } from "./dialogs";

const i = (Icon: typeof PlayIcon) => <Icon size="1rem" />;

// Opens the system file picker for one image.
export function pickImage(onFile: (file: File) => void) {
  const input = Object.assign(document.createElement("input"), { type: "file", accept: "image/*" });
  input.onchange = () => input.files?.[0] && onFile(input.files[0]);
  input.click();
}

// Options for a folder or a pack made in stash: its card "…", right click and page header.
// RAR export needs the desktop app and WinRAR on this computer: asked once
let rar = false;
window.stashWindow?.hasRar().then((ok) => (rar = ok), () => undefined);

export const SUBFOLDER_NAMES = ["808s", "Kicks", "Snares", "Claps", "Hi-hats", "Open hats", "Percs", "FX", "Loops", "Vocals", "MIDI", "Presets"];

// A new folder inside `parent` (a pack or one of its subfolders); quick names are one click.
export const newSubfolder = (parent: Folder, actions: Actions, dialog: (d: DialogState) => void) =>
  dialog({ kind: "name", title: `New folder in “${parent.name}”`, label: "Name", submit: "Create", suggestions: SUBFOLDER_NAMES, onSubmit: (n) => actions.createFolder(n, undefined, parent.id) });

export function folderMenu(folder: Folder, actions: Actions, dialog: (d: DialogState) => void, onDeleted?: () => void, folders: Folder[] = []): MenuEntry[] {
  const noun = folder.pack ? "pack" : "folder";
  const parent = folders.find((f) => f.id === folder.parentId);
  return [
    folder.pack
      ? {
          label: "Edit pack…",
          icon: i(PenIcon),
          onSelect: () =>
            dialog({ kind: "pack", title: "Edit pack", initial: { name: folder.name, kind: folder.pack!.kind }, submit: "Save", onSubmit: (name, kind) => actions.updateFolder(folder.id, { name, pack: { kind } }) }),
        }
      : { label: "Rename…", icon: i(PenIcon), onSelect: () => dialog({ kind: "name", title: "Rename folder", label: "Name", initial: folder.name, submit: "Save", onSubmit: (name) => actions.updateFolder(folder.id, { name }) }) },
    ...(packOf(folders, folder.id) ? [{ label: "New folder inside…", icon: i(PlusIcon), onSelect: () => newSubfolder(folder, actions, dialog) }] : []),
    ...(folder.pack
      ? [
          {
            label: "Export",
            icon: i(DownloadIcon),
            submenu: [
              { label: "As a folder…", icon: i(FolderIcon), disabled: !window.showDirectoryPicker, onSelect: () => actions.exportPack(folder.id, "folder") },
              { label: "As ZIP", icon: i(BoxIcon), onSelect: () => actions.exportPack(folder.id, "zip") },
              { label: rar ? "As RAR" : "As RAR (needs WinRAR)", icon: i(BoxIcon), disabled: !rar, onSelect: () => actions.exportPack(folder.id, "rar") },
            ] satisfies MenuEntry[],
          },
        ]
      : []),
    { label: "Change cover…", icon: i(ImageIcon), onSelect: () => pickImage((f) => actions.setCover("folder", folder.id, f)) },
    ...(folder.coverId ? [{ label: "Remove cover", icon: i(ImageRemoveIcon), onSelect: () => actions.setCover("folder", folder.id, null) }] : []),
    "separator",
    {
      label: `Delete ${noun}…`,
      icon: i(TrashIcon),
      danger: true,
      onSelect: () =>
        dialog({
          kind: "confirm",
          title: `Delete “${folder.name}”?`,
          description: parent ? `The folder and its subfolders go away; their items move to “${parent.name}”.` : `The ${noun} goes away; its items stay in your Library.`,
          confirm: `Delete ${noun}`,
          danger: true,
          onConfirm: () => {
            actions.deleteFolder(folder.id);
            onDeleted?.();
          },
        }),
    },
  ];
}

// The same entries feed the row "…", the row right-click and the player's "…".
export function useTrackActions() {
  const { state, actions } = useStore();
  const dialog = useDialog();
  const current = usePlayer((s) => s.id);
  const playing = usePlayer((s) => s.playing);

  return (track: Track, ctx: { queue?: string[]; playlistId?: string } = {}): MenuEntry[] => {
    if (track.trashedAt)
      return [
        { label: "Restore", icon: i(UndoIcon), onSelect: () => actions.restore([track.id]) },
        "separator",
        {
          label: "Delete permanently…",
          icon: i(TrashIcon),
          danger: true,
          onSelect: () =>
            dialog({
              kind: "confirm",
              title: "Delete permanently?",
              description: `“${track.title}” and its file will be removed from this device. This can't be undone.`,
              confirm: "Delete",
              danger: true,
              onConfirm: () => actions.destroy([track.id]),
            }),
        },
      ];

    const isCurrentPlaying = current === track.id && playing;
    return [
      ...(playable(track)
        ? [{ label: isCurrentPlaying ? "Pause" : "Play", icon: i(isCurrentPlaying ? PauseIcon : PlayIcon), onSelect: () => (isCurrentPlaying ? player.pause() : player.play(track.id, ctx.queue)) }]
        : []),
      { label: track.starred ? "Remove from Starred" : "Add to Starred", icon: <StarIcon size="1rem" weight={track.starred ? "fill" : "regular"} />, onSelect: () => actions.toggleStar(track.id) },
      { label: "Edit details…", icon: i(PenIcon), onSelect: () => dialog({ kind: "edit", trackId: track.id }) },
      { label: "Change cover…", icon: i(ImageIcon), onSelect: () => pickImage((f) => actions.setCover("track", track.id, f)) },
      ...(track.coverId ? [{ label: "Remove cover", icon: i(ImageRemoveIcon), onSelect: () => actions.setCover("track", track.id, null) }] : []),
      {
        label: "Add to playlist",
        icon: i(WaveformIcon),
        submenu: [
          ...state.playlists.map((p) => ({
            label: p.name,
            checked: p.trackIds.includes(track.id),
            icon: i(WaveformIcon),
            onSelect: () => (p.trackIds.includes(track.id) ? actions.removeFromPlaylist(p.id, [track.id]) : actions.addToPlaylist(p.id, [track.id])),
          })),
          "separator",
          { label: "New playlist…", icon: i(PlusIcon), onSelect: () => dialog({ kind: "name", title: "New playlist", label: "Name", submit: "Create", onSubmit: (n) => actions.createPlaylist(n, [track.id]) }) },
        ],
      },
      {
        label: "Move to folder",
        icon: i(FolderIcon),
        submenu: [
          { label: "No folder", checked: !track.folderId, icon: i(FolderIcon), onSelect: () => actions.move([track.id], null) },
          ...state.folders.map((f) => ({ label: folderLabel(state.folders, f.id), checked: track.folderId === f.id, icon: i(f.pack ? BoxIcon : FolderIcon), onSelect: () => actions.move([track.id], f.id) })),
          "separator",
          { label: "New folder…", icon: i(PlusIcon), onSelect: () => dialog({ kind: "name", title: "New folder", label: "Name", submit: "Create and move", onSubmit: (n) => actions.move([track.id], actions.createFolder(n)) }) },
        ],
      },
      "separator",
      { label: "Download", icon: i(DownloadIcon), onSelect: () => actions.download([track.id]) },
      ...(ctx.playlistId ? [{ label: "Remove from playlist", icon: i(MinusCircleIcon), onSelect: () => actions.removeFromPlaylist(ctx.playlistId!, [track.id]) }] : []),
      "separator",
      { label: "Move to Trash", icon: i(TrashIcon), danger: true, onSelect: () => actions.trash([track.id]) },
    ];
  };
}
