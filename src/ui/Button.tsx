import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Tooltip } from "@animate-ui/react/primitives/base-ui/tooltip";
import { cx } from "./cx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; variant?: "primary" | "secondary" };

const variants = {
  primary: "bg-accent text-on-accent hover:-translate-y-px hover:bg-white hover:shadow-[0_8px_28px_-8px_rgb(255_255_255/0.55)]",
  secondary: "border border-line-strong text-fg hover:-translate-y-px hover:border-fg/30 hover:bg-surface-2",
};

// Pill button. `primary` (white) is the one main action on a screen.
export function Button({ icon, variant = "primary", className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        "group/btn inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-5 text-base font-medium transition duration-300 ease-out active:translate-y-0 active:scale-[0.97] active:duration-100 disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "outline";
  pressed?: boolean;
  tooltip?: boolean;
};

const sizes = { sm: "size-8", md: "size-10", lg: "size-13" };

// Icon-only button. The label is its accessible name and shows as an animated tooltip on hover/focus.
export function IconButton({ label, size = "md", variant = "ghost", pressed, tooltip = true, className, children, ...rest }: IconButtonProps) {
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      className={cx(
        "grid shrink-0 place-items-center rounded-full transition duration-300 ease-out active:scale-[0.88] active:duration-100 disabled:pointer-events-none disabled:opacity-40",
        "[&_svg]:transition-transform [&_svg]:duration-300 [&_svg]:ease-out hover:[&_svg]:scale-110",
        sizes[size],
        variant === "ghost" && "text-fg-muted hover:bg-surface-2 hover:text-fg aria-pressed:text-fg",
        variant === "outline" && "border border-line-strong text-fg hover:border-fg/30 hover:bg-surface-2",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
  if (!tooltip) return button;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={button} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={8} className="z-50">
          <Tooltip.Popup className="pointer-events-none rounded-xs bg-fg px-2 py-1 text-xs font-medium text-on-accent shadow-popover">{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export const TooltipProvider = Tooltip.Provider;
