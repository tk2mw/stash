import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { ChevronDownIcon } from "./icons";
import { cx } from "./cx";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; onPill?: boolean; dropdown?: boolean };

// Filter pill. `selected` = white; `onPill` = selected, but the white comes from a sliding pill behind it; `dropdown` adds a caret.
export function Chip({ selected, onPill, dropdown, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={dropdown ? undefined : !!(selected || onPill)}
      className={cx(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-base transition duration-300 ease-out active:scale-95 active:duration-100 [&_svg]:transition-transform [&_svg]:duration-300 aria-expanded:[&_svg]:rotate-180",
        selected ? "border-transparent bg-accent text-on-accent" : onPill ? "border-transparent text-on-accent" : "border-line text-fg/90 hover:-translate-y-px hover:border-line-strong hover:bg-surface-2",
        className,
      )}
      {...rest}
    >
      {children}
      {dropdown && <ChevronDownIcon size="0.875rem" />}
    </button>
  );
}

// Label. `sm` sits under a track title, `md` in detail panels. With `onClick` it's a button (filter by it, add it);
// `active` = that filter is on.
export function Tag({ size = "sm", active, onClick, children }: { size?: "sm" | "md"; active?: boolean; onClick?: (e: MouseEvent<HTMLButtonElement>) => void; children: ReactNode }) {
  const className = cx(
    "inline-flex shrink-0 items-center",
    size === "sm" ? "h-5.5 rounded-sm px-2 text-xs" : "h-9 rounded-full px-4 text-base",
    active ? "bg-accent text-on-accent" : cx("bg-surface-2", size === "sm" ? "text-fg-muted" : "text-fg"),
    onClick && !active && "transition-colors duration-200 hover:bg-surface-3 hover:text-fg",
  );
  if (!onClick) return <span className={className}>{children}</span>;
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

// Numeric counter pill (sidebar counts).
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 min-w-7 items-center justify-center rounded-xs bg-surface-2 px-1.5 text-xs tabular-nums text-fg-muted">
      {children}
    </span>
  );
}
