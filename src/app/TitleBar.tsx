import { useEffect, useState } from "react";
import { CloseIcon, CoffeeIcon } from "../ui/icons";
import { cx } from "../ui/cx";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Dialog";

// The strip where Windows' title bar used to be, in the app's own colors (no line under it): drag it to move the
// window, the window buttons sit in the corner, and the Buy Me a Coffee banner in the middle until it's closed.
// Desktop app only for the buttons (electron/preload.cjs gives `window.stashWindow`); in the browser just the banner.
declare global {
  interface Window {
    stashWindow?: {
      minimize(): void;
      toggleMaximize(): void;
      close(): void;
      onMaximized(fn: (maximized: boolean) => void): () => void;
      hasRar(): Promise<boolean>;
      saveRar(name: string, entries: { path: string; data: ArrayBuffer }[]): Promise<boolean>; // false = save dialog closed
    };
  }
}

// × asks: hide it until stash opens again, or for good ("stash.coffee" = "closed")
const COFFEE = "stash.coffee";
let hiddenThisRun = false;
const coffeeClosed = () => {
  try {
    return hiddenThisRun || localStorage.getItem(COFFEE) === "closed";
  } catch {
    return hiddenThisRun;
  }
};

export function TitleBar({ banner = true, className }: { banner?: boolean; className?: string }) {
  const [closed, setClosed] = useState(coffeeClosed);
  const [asking, setAsking] = useState(false);
  const desktop = !!window.stashWindow;
  const showBanner = banner && !closed;
  const hide = (forGood: boolean) => {
    hiddenThisRun = true;
    setClosed(true);
    setAsking(false);
    if (forGood)
      try {
        localStorage.setItem(COFFEE, "closed");
      } catch {
        /* storage blocked: it comes back next time */
      }
  };
  return (
    <div className={cx("drag-window relative flex shrink-0 items-center pl-3", desktop ? "pr-30" : "pr-3", desktop || showBanner ? "h-9" : "h-0", className)}>
      {showBanner && (
        // a white strip with the text running across it: meant to be seen; it stops under the pointer
        <div className="group flex h-6 min-w-0 flex-1 items-center overflow-hidden rounded-full bg-fg text-on-accent">
          <a
            href="https://buymeacoffee.com/talk2me"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Enjoying stash? Buy me a coffee (opens buymeacoffee.com/talk2me)"
            className="flex h-full min-w-0 flex-1 items-center overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)]"
          >
            <span aria-hidden className="flex shrink-0 animate-[marquee_40s_linear_infinite] items-center group-hover:[animation-play-state:paused] motion-reduce:animate-none">
              {[0, 1].map((half) => (
                <span key={half} className="flex shrink-0 items-center">
                  {Array.from({ length: 6 }, (_, i) => (
                    <span key={i} className="flex items-center gap-2 whitespace-nowrap px-5 text-2xs font-semibold uppercase">
                      <CoffeeIcon size="0.85rem" weight="bold" />
                      Enjoying stash? Buy me a coffee
                      <span className="pl-5 text-on-accent/40">✦</span>
                    </span>
                  ))}
                </span>
              ))}
            </span>
          </a>
          <button type="button" aria-label="Close banner" onClick={() => setAsking(true)} className="mr-0.5 grid size-5 shrink-0 place-items-center rounded-full text-on-accent/60 transition hover:bg-black/10 hover:text-on-accent">
            <CloseIcon size="0.7rem" weight="bold" />
          </button>
        </div>
      )}
      {desktop && <WindowControls className="absolute inset-y-0 right-2" />}
      <Modal open={asking} onOpenChange={setAsking} title="Hide the banner?" description="It can go away until stash opens again, or for good.">
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => hide(false)}>
            Just for now
          </Button>
          <Button onClick={() => hide(true)}>Don't show again</Button>
        </div>
      </Modal>
    </div>
  );
}

const button = "grid size-8 place-items-center rounded-full text-fg-muted transition duration-200 ease-out hover:bg-surface-2 hover:text-fg active:scale-90";
const glyph = { width: 10, height: 10, viewBox: "0 0 10 10", fill: "none", stroke: "currentColor", strokeWidth: 1.1, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

function WindowControls({ className }: { className?: string }) {
  const win = window.stashWindow!;
  const [maximized, setMaximized] = useState(false);
  useEffect(() => win.onMaximized(setMaximized), [win]);
  return (
    <div className={cx("flex items-center gap-0.5", className)}>
      <button type="button" aria-label="Minimize" onClick={win.minimize} className={button}>
        <svg {...glyph}>
          <path d="M1.5 5h7" />
        </svg>
      </button>
      <button type="button" aria-label={maximized ? "Restore" : "Maximize"} onClick={win.toggleMaximize} className={button}>
        <svg {...glyph}>{maximized ? <path d="M3.5 1.5h5v5M1.5 3.5h5v5h-5z" /> : <rect x="1.5" y="1.5" width="7" height="7" rx="1.5" />}</svg>
      </button>
      <button type="button" aria-label="Close" onClick={win.close} className={cx(button, "hover:bg-danger hover:text-black")}>
        <svg {...glyph}>
          <path d="M2 2l6 6M8 2l-6 6" />
        </svg>
      </button>
    </div>
  );
}
