import { useId, useState } from "react";
import { allowFolder, setFolderLimit, useFolder } from "../store/folder";
import { useStore } from "../store/store";
import { Button } from "../ui/Button";
import { FolderIcon } from "../ui/icons";
import { ProgressBar } from "../ui/ProgressBar";
import { toast } from "../ui/Toast";
import { formatBytes } from "./Sidebar";

// Where stash keeps the sounds on this computer, and how much room it may take.
// Used on the first-visit setup screen and in the Storage window.
export function StorageSettings() {
  const { supported, folder, access } = useFolder();
  const { state, actions } = useStore();
  const used = state.tracks.reduce((n, t) => n + (t.fileId ? t.size : 0), 0);

  if (!supported)
    return <p className="text-sm text-fg-muted">This browser can't save to a folder on your computer, so stash keeps your sounds inside it. Open stash in Chrome or Edge to pick a folder.</p>;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3 rounded-md border border-line px-4 py-3">
        <FolderIcon size="1.25rem" className="shrink-0 text-fg-muted" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base">{folder ? folder.place : "Inside the browser"}</p>
          <p className="text-xs text-fg-muted">
            {!folder ? "Pick a folder to keep your sounds on your computer." : access === "granted" ? "Your sounds are saved in this folder." : "stash needs your OK to open it again."}
          </p>
        </div>
        {folder && access !== "granted" && (
          <Button onClick={allowFolder} className="h-8 px-3.5 text-sm">
            Allow
          </Button>
        )}
        <Button variant="secondary" onClick={actions.chooseFolder} className="h-8 px-3.5 text-sm">
          {folder ? "Change" : "Choose folder"}
        </Button>
      </div>
      {folder && <Limit used={used} limit={folder.limit} />}
    </div>
  );
}

function Limit({ used, limit }: { used: number; limit: number }) {
  const id = useId();
  const [gb, setGb] = useState(String(Math.round(limit / 1e9)));
  const n = Number(gb);
  const valid = Number.isInteger(n) && n >= 1 && n <= 100_000;
  const save = () => {
    if (valid && n * 1e9 !== limit) setFolderLimit(n * 1e9).then(() => toast(`Space limit set to ${n} GB`));
  };
  return (
    <div className="rounded-md border border-line px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-base">
          Space limit
        </label>
        <span className="flex items-center gap-2">
          <input
            id={id}
            inputMode="numeric"
            value={gb}
            onChange={(e) => setGb(e.target.value.replace(/\D/g, ""))}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && save()}
            aria-invalid={!valid}
            className="h-8 w-20 rounded-sm bg-surface-2 px-2.5 text-right text-base tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-accent/40 aria-invalid:ring-2 aria-invalid:ring-danger/60"
          />
          <span className="text-sm text-fg-muted">GB</span>
        </span>
      </div>
      <ProgressBar value={Math.max(Math.min(used / limit, 1), 0.02)} max={1} label="Space used in your stash folder" className="mt-3" />
      <p className="mt-1.5 text-xs text-fg-muted">
        {valid ? `${formatBytes(used)} used of ${formatBytes(limit)}. Keep it below the free space on your disk.` : "Use a whole number of GB, from 1 up."}
      </p>
    </div>
  );
}
