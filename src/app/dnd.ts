import { useState, type DragEvent } from "react";

// Dragging tracks inside the app (not files from the desktop, which upload).
const MIME = "application/x-stash-ids";

export function startTrackDrag(e: DragEvent, ids: string[]) {
  e.dataTransfer.setData(MIME, JSON.stringify(ids));
  e.dataTransfer.effectAllowed = "copyMove";
}

export const isTrackDrag = (e: DragEvent) => e.dataTransfer.types.includes(MIME);

// Spread `props` on anything that accepts dropped tracks; `over` is true while they hover it.
export function useTrackDrop(onDrop: (ids: string[]) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: DragEvent) => {
        if (!isTrackDrag(e)) return;
        e.preventDefault();
        if (!over) setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => {
        setOver(false);
        if (!isTrackDrag(e)) return;
        e.preventDefault();
        onDrop(JSON.parse(e.dataTransfer.getData(MIME)) as string[]);
      },
    },
  };
}
