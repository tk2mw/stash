import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { cx } from "./cx";

type Option<T extends string> = { value: T; label: string; icon: ReactNode };

// Icon toggle group; the active background slides between options.
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx("flex rounded-md bg-panel", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-label={o.label}
          title={o.label}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx("relative grid h-9 w-12 place-items-center rounded-md transition-colors duration-200 ease-out active:scale-95", o.value === value ? "text-fg" : "text-fg-muted hover:text-fg")}
        >
          {o.value === value && <motion.span layoutId={id} transition={{ type: "spring", stiffness: 500, damping: 38 }} className="absolute inset-0 rounded-md bg-surface-3" />}
          <span className="relative">{o.icon}</span>
        </button>
      ))}
    </div>
  );
}
