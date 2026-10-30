import { useSyncExternalStore } from "react";
import { ProgressBar } from "./ProgressBar";
import { playSound } from "./sound";
import { SwipeToast } from "./SwipeToast";

// Toasts live in a tiny external store, so any module can call `toast(...)`; SwipeToast (React Bits) draws them:
// a fuse line burns for their lifetime, hovering pauses it, a flick down dismisses.
type Item = { id: string; title: string; description?: string; action?: { label: string; onClick: () => void }; duration: number; error: boolean; progress?: number; open: boolean };

let items: Item[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const set = (next: Item[]) => {
  items = next;
  listeners.forEach((l) => l());
};
const patch = (id: string, p: Partial<Item>) => set(items.map((t) => (t.id === id ? { ...t, ...p } : t)));
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function add(item: Omit<Item, "id" | "open">) {
  const id = String(++seq);
  // at most four on screen: the oldest slides away
  const open = items.filter((t) => t.open);
  const oldest = open.length >= 4 ? open[0].id : null;
  set([...items.map((t) => (t.id === oldest ? { ...t, open: false } : t)), { ...item, id, open: true }]);
  return id;
}

export function toast(title: string, opts: { description?: string; action?: { label: string; onClick: () => void }; timeout?: number; type?: "error" } = {}) {
  if (opts.type === "error") playSound("error");
  return add({ title, description: opts.description, action: opts.action, duration: opts.timeout ?? 4000, error: opts.type === "error" });
}

// A toast that stays until closed and shows a progress bar (0..1).
export const progressToast = {
  open: (title: string) => add({ title, duration: 0, error: false, progress: 0 }),
  set: (id: string, progress: number, description?: string) => patch(id, { progress, description }),
  close: (id: string) => patch(id, { open: false }),
};

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items);
  return (
    <div className="pointer-events-none fixed bottom-[calc(1rem+var(--toast-lift,0px))] right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col max-lg:bottom-20 *:pointer-events-auto">
      {list.map((t) => (
        <SwipeToast
          key={t.id}
          inline
          open={t.open}
          onClose={() => set(items.filter((x) => x.id !== t.id))}
          title={t.title}
          description={
            t.progress === undefined ? t.description : (
              <>
                {t.description}
                <ProgressBar value={t.progress} max={1} label={t.title} className="mt-1.5" />
              </>
            )
          }
          actionLabel={t.action?.label}
          onAction={t.action?.onClick}
          duration={t.duration}
          closeButton
          width={352}
          radius={16}
          background="#1c1c1c"
          color="#f4f4f4"
          fuseColor={t.error ? "#ff6b6b" : "#fafafa"}
        />
      ))}
    </div>
  );
}
