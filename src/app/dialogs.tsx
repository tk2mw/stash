import { createContext, useContext, useState, type FormEvent, type ReactNode } from "react";
import { BoxIcon, FolderIcon, MusicIcon, PlusIcon, WaveformIcon } from "../ui/icons";
import { motion } from "motion/react";
import { ACCEPT, isArchive, isKitFile } from "../store/audio";
import { StorageSettings } from "./StorageSettings";
import { TourDialog } from "./Tour";
import { useStore } from "../store/store";
import { folderLabel, packOf } from "../store/tree";
import { playable, type ItemType } from "../store/types";
import { ActivityCalendar } from "../ui/ActivityCalendar";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Chip } from "../ui/Chip";
import { Cover } from "../ui/Cover";
import { formatTime } from "./TrackBrowser";
import { Confirm, Field, inputClass, Modal } from "../ui/Dialog";

export type DialogState =
  | { kind: "name"; title: string; label: string; initial?: string; submit: string; suggestions?: string[]; onSubmit: (name: string) => void }
  | { kind: "pack"; title: string; initial?: { name: string; kind: string }; submit: string; files?: boolean; onSubmit: (name: string, kind: string, files: File[]) => void }
  | { kind: "upload"; files: File[]; folderId: string | null; playlistId?: string }
  | { kind: "confirm"; title: string; description: string; confirm: string; danger?: boolean; onConfirm: () => void }
  | { kind: "edit"; trackId: string }
  | { kind: "move"; ids: string[] }
  | { kind: "playlist"; ids: string[] }
  | { kind: "addTracks"; playlistId: string }
  | { kind: "activity" }
  | { kind: "storage" }
  | { kind: "shortcuts" }
  | { kind: "tour" };

const DialogContext = createContext<(d: DialogState) => void>(() => {});
export const useDialog = () => useContext(DialogContext);

// Every way of adding files goes through here: inside a pack they just join it, archives are packs already,
// anything else makes stash ask what it is.
export function useUpload() {
  const { state, actions } = useStore();
  const dialog = useDialog();
  return (files: File[], folderId: string | null, playlistId?: string) => {
    if (!files.length) return;
    // inside a pack (or one of its subfolders) everything a kit holds is welcome
    if (packOf(state.folders, folderId)) actions.upload(files, folderId, "sample", true, playlistId);
    // only packs or files stash doesn't take: nothing to ask (the upload says what it skipped)
    else if (files.every((f) => isArchive(f.name) || !isKitFile(f.name))) actions.upload(files, folderId, undefined, false, playlistId);
    else dialog({ kind: "upload", files, folderId, playlistId });
  };
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  // keep the last dialog mounted while it animates out
  const [open, setOpen] = useState(false);
  const show = (d: DialogState) => {
    setDialog(d);
    setOpen(true);
  };
  return (
    <DialogContext.Provider value={show}>
      {children}
      {dialog && <DialogHost dialog={dialog} open={open} onOpenChange={setOpen} reopen={show} />}
    </DialogContext.Provider>
  );
}

// `suggestions`: one click on a chip uses that name right away (subfolders: 808s, Snares…)
function NameForm({ label, initial = "", submit, suggestions, onSubmit }: { label: string; initial?: string; submit: string; suggestions?: string[]; onSubmit: (name: string) => void }) {
  const [name, setName] = useState(initial);
  const valid = name.trim().length > 0 && name.trim().length <= 60;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(name.trim());
      }}
      className="flex flex-col gap-5"
    >
      {suggestions && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((n) => (
            <Chip key={n} onClick={() => onSubmit(n)} className="h-8 px-3.5">
              {n}
            </Chip>
          ))}
        </div>
      )}
      <Field label={label}>
        <input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={suggestions ? "Or type any name" : undefined} className={inputClass} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={!valid}>
          {submit}
        </Button>
      </div>
    </form>
  );
}

const PACK_KINDS = ["Drum kit", "Loop kit", "One-shot kit", "Preset kit", "MIDI kit", "Vocal pack", "Sample pack"];

// One click picks the kind (and names the pack if the name is still empty); with `files`, sounds go in at the same time.
function PackForm({ initial, submit, files: withFiles, onSubmit }: { initial?: { name: string; kind: string }; submit: string; files?: boolean; onSubmit: (name: string, kind: string, files: File[]) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const kinds = kind && !PACK_KINDS.includes(kind) ? [...PACK_KINDS, kind] : PACK_KINDS;
  const valid = name.trim().length > 0 && name.trim().length <= 60;
  // copied right away: the input is cleared and a drop's file list empties once the event ends
  const add = (list: File[]) => setFiles((f) => [...f, ...list.filter((x) => isKitFile(x.name) && !f.some((y) => y.name === x.name && y.size === x.size))]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(name.trim(), kind.trim(), files);
      }}
      className="flex flex-col gap-5"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm text-fg-muted">Kind</legend>
        <div className="flex flex-wrap gap-1.5">
          {kinds.map((k) => (
            <Chip
              key={k}
              selected={kind === k}
              onClick={() => {
                setKind(kind === k ? "" : k);
                if (!name.trim() || PACK_KINDS.includes(name.trim())) setName(kind === k ? "" : k);
              }}
              className="h-8 px-3.5"
            >
              {k}
            </Chip>
          ))}
        </div>
      </fieldset>
      <Field label="Name">
        <input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dark Drums Vol. 1" className={inputClass} />
      </Field>
      {withFiles && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation(); // the window drop would upload them to the Library
            setOver(false);
            add([...e.dataTransfer.files]);
          }}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-4 py-5 text-center transition-colors ${over ? "border-fg/50 bg-surface-2" : "border-line-strong hover:bg-surface"}`}
        >
          <input type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => (add([...(e.target.files ?? [])]), (e.target.value = ""))} />
          <span className="text-base">{files.length ? `${files.length} sound${files.length === 1 ? "" : "s"} ready` : "Drop sounds here or click to choose"}</span>
          <span className="text-sm text-fg-subtle">Audio, MIDI and presets. You can add more later.</span>
        </label>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={!valid}>
          {submit}
        </Button>
      </div>
    </form>
  );
}

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].flatMap((n) => [`${n} min`, `${n} maj`]);

function EditForm({ trackId, done }: { trackId: string; done: () => void }) {
  const { state, actions } = useStore();
  const track = state.tracks.find((t) => t.id === trackId);
  const [form, setForm] = useState(() => ({
    title: track?.title ?? "",
    artist: track?.artist ?? "",
    type: track?.type ?? "track",
    bpm: track?.bpm ? String(track.bpm) : "",
    key: track?.key ?? "",
    tags: track?.tags.join(", ") ?? "",
    folderId: track?.folderId ?? "",
  }));
  if (!track) return <p className="text-fg-muted">This item no longer exists.</p>;
  const bpm = form.bpm.trim() ? Number(form.bpm) : null;
  const bpmValid = bpm === null || (Number.isInteger(bpm) && bpm >= 20 && bpm <= 400);
  const valid = form.title.trim() && bpmValid;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    actions.updateTrack(track.id, {
      title: form.title.trim(),
      artist: form.artist.trim(),
      type: form.type as ItemType,
      bpm,
      key: form.key.trim(),
      tags: [...new Set(form.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))],
      folderId: form.folderId || null,
    });
    done();
  };

  return (
    <form onSubmit={save} className="grid grid-cols-2 gap-4">
      <Field label="Title" className="col-span-2">
        <input autoFocus value={form.title} onChange={set("title")} className={inputClass} />
      </Field>
      <Field label="Artist">
        <input value={form.artist} onChange={set("artist")} className={inputClass} />
      </Field>
      <Field label="Type">
        <select value={form.type} onChange={set("type")} className={inputClass}>
          <option value="track">Track</option>
          <option value="sample">Sample</option>
          <option value="pack">Pack</option>
          <option value="file">MIDI or preset</option>
        </select>
      </Field>
      <Field label="BPM">
        <input inputMode="numeric" value={form.bpm} onChange={set("bpm")} placeholder="—" className={inputClass} aria-invalid={!bpmValid} />
        {!bpmValid && <span className="text-sm text-danger">Use a whole number between 20 and 400.</span>}
      </Field>
      <Field label="Key">
        <input list="stash-keys" value={form.key} onChange={set("key")} placeholder="e.g. C# min" className={inputClass} />
        <datalist id="stash-keys">
          {KEYS.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
      </Field>
      <Field label="Tags (comma separated)" className="col-span-2">
        <input value={form.tags} onChange={set("tags")} placeholder="trap, vocal, 2026" className={inputClass} />
      </Field>
      <Field label="Folder" className="col-span-2">
        <select value={form.folderId} onChange={set("folderId")} className={inputClass}>
          <option value="">No folder</option>
          {state.folders.map((f) => (
            <option key={f.id} value={f.id}>
              {folderLabel(state.folders, f.id)}
            </option>
          ))}
        </select>
      </Field>
      <div className="col-span-2 mt-1 flex justify-end gap-2">
        <Button variant="secondary" onClick={done}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          Save
        </Button>
      </div>
    </form>
  );
}

function PickList({ options, onPick, create }: { options: { id: string | null; label: string; icon: ReactNode; meta?: string }[]; onPick: (id: string | null) => void; create: { label: string; onClick: () => void } }) {
  return (
    <div className="flex flex-col gap-1">
      {options.map((o, i) => (
        <motion.button
          key={o.id ?? "none"}
          type="button"
          onClick={() => onPick(o.id)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="flex h-10 items-center gap-3 rounded-md px-3 text-left text-base text-fg/90 transition hover:bg-surface-2"
        >
          <span className="text-fg-muted">{o.icon}</span>
          <span className="flex-1 truncate">{o.label}</span>
          {o.meta && <span className="text-sm tabular-nums text-fg-subtle">{o.meta}</span>}
        </motion.button>
      ))}
      <button type="button" onClick={create.onClick} className="mt-1 flex h-10 items-center gap-3 rounded-md border border-dashed border-line-strong px-3 text-base text-fg/90 transition hover:bg-surface-2">
        <PlusIcon size="1rem" className="text-fg-muted" />
        {create.label}
      </button>
    </div>
  );
}

function AddTracks({ playlistId, done }: { playlistId: string; done: () => void }) {
  const { state, actions } = useStore();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const playlist = state.playlists.find((p) => p.id === playlistId);
  if (!playlist) return <p className="text-fg-muted">This playlist no longer exists.</p>;
  const needle = q.trim().toLowerCase();
  const options = state.tracks.filter((t) => !t.trashedAt && playable(t) && !playlist.trackIds.includes(t.id) && (!needle || t.title.toLowerCase().includes(needle) || t.tags.some((tag) => tag.includes(needle))));
  const toggle = (id: string, on: boolean) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
  return (
    <div className="flex flex-col gap-3">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your library" aria-label="Search your library" className={inputClass} />
      <ul className="-mx-1 max-h-80 overflow-y-auto px-1">
        {options.length === 0 && <li className="py-8 text-center text-sm text-fg-muted">{needle ? "Nothing matches." : "Every track is already in this playlist."}</li>}
        {options.map((t) => (
          <li key={t.id}>
            <label className="flex h-12 cursor-pointer items-center gap-3 rounded-md px-2 transition-colors hover:bg-surface-2">
              <Checkbox checked={picked.includes(t.id)} onChange={(on) => toggle(t.id, on)} label={`Add ${t.title}`} />
              <Cover seed={t.id} image={t.coverId} className="size-8 shrink-0 rounded-xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base">{t.title}</span>
                <span className="block text-xs text-fg-subtle">
                  {t.key || "—"} · {t.bpm ?? "—"} BPM
                </span>
              </span>
              <span className="text-sm tabular-nums text-fg-muted">{formatTime(t.duration)}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <Button
          disabled={!picked.length}
          onClick={() => {
            actions.addToPlaylist(playlistId, picked);
            done();
          }}
        >
          {picked.length ? `Add ${picked.length} track${picked.length === 1 ? "" : "s"}` : "Add tracks"}
        </Button>
      </div>
    </div>
  );
}

const SHORTCUTS = [
  ["Space", "Play / pause"],
  ["← / →", "Seek 5 seconds"],
  ["Shift + ← / →", "Previous / next track"],
  ["M", "Mute / unmute"],
  ["Ctrl / ⌘ + K", "Search"],
  ["Esc", "Clear selection, close menus"],
  ["Right click", "Track and folder options"],
  ["Drag files onto the window", "Upload"],
  ["Drag tracks onto a folder or playlist", "Move / add"],
];

function DialogHost({ dialog, open, onOpenChange, reopen }: { dialog: DialogState; open: boolean; onOpenChange: (o: boolean) => void; reopen: (d: DialogState) => void }) {
  const { state, actions } = useStore();
  const close = () => onOpenChange(false);

  switch (dialog.kind) {
    case "confirm":
      return <Confirm open={open} onOpenChange={onOpenChange} {...dialog} />;
    case "name":
      return (
        <Modal open={open} onOpenChange={onOpenChange} title={dialog.title}>
          <NameForm
            label={dialog.label}
            initial={dialog.initial}
            submit={dialog.submit}
            suggestions={dialog.suggestions}
            onSubmit={(n) => {
              dialog.onSubmit(n);
              close();
            }}
          />
        </Modal>
      );
    case "pack":
      return (
        <Modal open={open} onOpenChange={onOpenChange} title={dialog.title}>
          <PackForm
            initial={dialog.initial}
            submit={dialog.submit}
            files={dialog.files}
            onSubmit={(name, kind, files) => {
              dialog.onSubmit(name, kind, files);
              close();
            }}
          />
        </Modal>
      );
    case "upload": {
      const { files, folderId, playlistId } = dialog;
      return (
        <Modal open={open} onOpenChange={onOpenChange} title="What are you adding?" description={`${files.length} file${files.length === 1 ? "" : "s"}`}>
          <PickList
            options={[
              { id: "track", label: "Tracks", icon: <WaveformIcon size="1rem" />, meta: "Songs, beats" },
              { id: "sample", label: "Samples", icon: <MusicIcon size="1rem" />, meta: "One-shots, loops" },
              ...state.folders.filter((f) => f.pack).map((f) => ({ id: f.id, label: `Add to ${f.name}`, icon: <BoxIcon size="1rem" />, meta: f.pack!.kind || "Pack" })),
            ]}
            onPick={(id) => {
              if (id === "track" || id === "sample") actions.upload(files, folderId, id, false, playlistId);
              else actions.upload(files, id, "sample", true, playlistId);
              close();
            }}
            create={{
              label: "New pack…",
              onClick: () =>
                reopen({
                  kind: "pack",
                  title: "New pack",
                  submit: "Create pack",
                  onSubmit: (name, kind) => {
                    const id = actions.createFolder(name, { kind });
                    actions.upload(files, id, "sample", true);
                    location.hash = `#/f/${id}`;
                  },
                }),
            }}
          />
        </Modal>
      );
    }
    case "edit":
      return (
        <Modal open={open} onOpenChange={onOpenChange} title="Edit details">
          <EditForm trackId={dialog.trackId} done={close} />
        </Modal>
      );
    case "move":
      return (
        <Modal open={open} onOpenChange={onOpenChange} title="Move to folder" description={`${dialog.ids.length} item${dialog.ids.length === 1 ? "" : "s"}`}>
          <PickList
            options={[
              { id: null, label: "No folder", icon: <FolderIcon size="1rem" /> },
              ...state.folders.map((f) => ({ id: f.id, label: folderLabel(state.folders, f.id), icon: f.pack ? <BoxIcon size="1rem" /> : <FolderIcon size="1rem" />, meta: String(state.tracks.filter((t) => t.folderId === f.id && !t.trashedAt).length) })),
            ]}
            onPick={(id) => {
              actions.move(dialog.ids, id);
              close();
            }}
            create={{
              label: "New folder…",
              onClick: () =>
                reopen({ kind: "name", title: "New folder", label: "Name", submit: "Create and move", onSubmit: (n) => actions.move(dialog.ids, actions.createFolder(n)) }),
            }}
          />
        </Modal>
      );
    case "playlist":
      return (
        <Modal open={open} onOpenChange={onOpenChange} title="Add to playlist" description={`${dialog.ids.length} item${dialog.ids.length === 1 ? "" : "s"}`}>
          <PickList
            options={state.playlists.map((p) => ({ id: p.id, label: p.name, icon: <WaveformIcon size="1rem" />, meta: String(p.trackIds.length) }))}
            onPick={(id) => {
              if (id) actions.addToPlaylist(id, dialog.ids);
              close();
            }}
            create={{
              label: "New playlist…",
              onClick: () => reopen({ kind: "name", title: "New playlist", label: "Name", submit: "Create", onSubmit: (n) => actions.createPlaylist(n, dialog.ids) }),
            }}
          />
        </Modal>
      );
    case "addTracks":
      return (
        <Modal open={open} onOpenChange={onOpenChange} title="Add tracks" description={state.playlists.find((p) => p.id === dialog.playlistId)?.name}>
          <AddTracks playlistId={dialog.playlistId} done={close} />
        </Modal>
      );
    case "tour":
      return <TourDialog open={open} onOpenChange={onOpenChange} />;
    case "storage":
      return (
        <Modal open={open} onOpenChange={onOpenChange} title="Storage" description="Where stash keeps your sounds on this computer.">
          <StorageSettings />
        </Modal>
      );
    case "activity":
      return (
        <Modal open={open} onOpenChange={onOpenChange} title="Your activity" description="Uploads and plays per day." wide>
          <ActivityCalendar counts={state.activity} />
        </Modal>
      );
    case "shortcuts":
      return (
        <Modal open={open} onOpenChange={onOpenChange} title="Keyboard shortcuts">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-base">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="contents">
                <dt>
                  <kbd className="rounded-xs bg-surface-2 px-2 py-1 font-sans text-sm text-fg">{k}</kbd>
                </dt>
                <dd className="self-center text-fg-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      );
  }
}
