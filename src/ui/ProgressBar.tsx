import { Progress } from "@animate-ui/react/primitives/base-ui/progress";

// Springs to each new value (Animate UI); starts at its value on mount.
export function ProgressBar({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  return (
    <Progress.Root value={value} max={max} aria-label={label} className={className}>
      <Progress.Track className="h-1 overflow-hidden rounded-full bg-surface-3">
        <Progress.Indicator className="h-full rounded-full bg-accent" />
      </Progress.Track>
    </Progress.Root>
  );
}
