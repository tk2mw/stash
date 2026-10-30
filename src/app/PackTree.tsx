import { player } from "../player/player";
import { useStore } from "../store/store";
import { childrenOf, pathOf } from "../store/tree";
import type { Folder as FolderData } from "../store/types";
import { Button } from "../ui/Button";
import { File, Folder, Tree } from "../ui/FileTree";
import { PlusIcon } from "../ui/icons";
import { cx } from "../ui/cx";
import { useDialog } from "./dialogs";
import { useTrackDrop } from "./dnd";
import { href } from "./route";
import { newSubfolder } from "./trackActions";

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true });

// Top of a pack's page (and its subfolders'): the pack as a file tree. A folder opens on click and takes sounds
// dragged onto it; a sound is selected on click and plays on double click.
export function PackTree({ pack, currentId, onSelectTrack }: { pack: FolderData; currentId: string; onSelectTrack: (id: string) => void }) {
  const { state, actions } = useStore();
  const dialog = useDialog();
  const current = state.folders.find((f) => f.id === currentId) ?? pack;
  const isFolder = (id: string) => state.folders.some((f) => f.id === id);
  return (
    <section aria-label={`Folders in ${pack.name}`} className="mb-6 rounded-xl border border-line bg-surface/40 p-2">
      <div className="mb-1 flex items-center justify-between gap-3 py-1 pl-3 pr-1">
        <h2 className="text-2xs font-medium uppercase text-fg-muted">Inside this pack</h2>
        <Button variant="secondary" icon={<PlusIcon size="1rem" />} onClick={() => newSubfolder(current, actions, dialog)} className="h-8 px-3.5 text-sm">
          New folder
        </Button>
      </div>
      <Tree
        selectedId={currentId}
        initialExpandedItems={pathOf(state.folders, currentId).map((f) => f.id)}
        onSelect={(id) => (isFolder(id) ? (location.hash = href({ name: "folder", id })) : onSelectTrack(id))}
        className="max-h-72"
      >
        <TreeFolder folder={pack} />
      </Tree>
    </section>
  );
}

function TreeFolder({ folder }: { folder: FolderData }) {
  const { state, actions } = useStore();
  const drop = useTrackDrop((ids) => actions.move(ids, folder.id));
  const sounds = state.tracks.filter((t) => t.folderId === folder.id && !t.trashedAt).sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
  const ids = sounds.map((t) => t.id);
  return (
    <Folder
      value={folder.id}
      element={
        <>
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          <span className="text-sm tabular-nums text-fg-subtle">{sounds.length || ""}</span>
        </>
      }
      // a drop here lands in this folder only, not in the ones around it
      triggerProps={{ ...drop.props, onDrop: (e) => (e.stopPropagation(), drop.props.onDrop(e)), className: cx(drop.over && "bg-surface-3 ring-1 ring-inset ring-fg/30") }}
    >
      {childrenOf(state.folders, folder.id)
        .sort(byName)
        .map((f) => (
          <TreeFolder key={f.id} folder={f} />
        ))}
      {sounds.map((t) => (
        <File key={t.id} value={t.id} onDoubleClick={() => player.play(t.id, ids)}>
          <span className="truncate">{t.title}</span>
        </File>
      ))}
    </Folder>
  );
}
