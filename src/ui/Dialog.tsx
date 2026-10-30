import type { ReactNode } from "react";
import { Dialog } from "@animate-ui/react/primitives/base-ui/dialog";
import { AlertDialog } from "@animate-ui/react/primitives/base-ui/alert-dialog";
import { CloseIcon } from "./icons";
import { Button } from "./Button";
import { FuseButton } from "./FuseButton";
import { cx } from "./cx";

const backdrop = "fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]";
// centered with margin: auto, not translate(-50%): half-pixel offsets blur the text
const popup =
  "fixed inset-0 z-50 m-auto h-fit max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-line bg-panel p-6 shadow-popover outline-none";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  wide,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={backdrop} />
        <Dialog.Popup className={cx(popup, wide ? "w-[min(52rem,calc(100vw-2rem))]" : "w-[min(26rem,calc(100vw-2rem))]")}>
          <Dialog.Title className="pr-8 text-lg font-semibold">{title}</Dialog.Title>
          {description && <Dialog.Description className="mt-1 text-base text-fg-muted">{description}</Dialog.Description>}
          <div className="mt-5">{children}</div>
          <Dialog.Close aria-label="Close" className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-fg-muted transition hover:bg-surface-2 hover:text-fg active:scale-90">
            <CloseIcon size="1rem" />
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  confirm,
  danger,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirm: string;
  danger?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={backdrop} />
        <AlertDialog.Popup className={cx(popup, "w-[min(24rem,calc(100vw-2rem))]")}>
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-1.5 text-base text-fg-muted">{description}</AlertDialog.Description>
          <div className="mt-6 flex items-center justify-end gap-2">
            <AlertDialog.Close render={<Button variant="secondary" />}>Cancel</AlertDialog.Close>
            {danger ? (
              // same component as Empty Trash: deletes when the fuse burns out, Undo until then
              <FuseButton
                label={confirm}
                size="sm"
                radius={18}
                undoLabel="Undo"
                doneLabel="Deleted"
                undoWindow={2500}
                commitOn="fuseEnd"
                background="#1c1c1c"
                color="#f4f4f4"
                fuseColor="#ff6b6b"
                onCommit={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
              />
            ) : (
              <Button
                onClick={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
              >
                {confirm}
              </Button>
            )}
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="text-sm text-fg-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-10 w-full rounded-md border border-line bg-surface px-3 text-base text-fg outline-none transition placeholder:text-fg-subtle focus-visible:border-line-strong focus-visible:ring-2 focus-visible:ring-accent/40";
