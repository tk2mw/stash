// Mark (supplied by the user, redrawn as vectors): four petals around a centre dot.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="-410 -410 820 820" fill="currentColor" aria-hidden className={className}>
      <ellipse cy="-300" rx="257.5" ry="105.5" />
      <ellipse cy="300" rx="257.5" ry="105.5" />
      <ellipse cx="-297" rx="111" ry="234.5" />
      <ellipse cx="297" rx="111" ry="234.5" />
      <circle r="143" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-4 text-fg">
      <LogoMark className="size-10" />
      <span className="text-[1.6875rem] font-semibold tracking-[-0.03em]">stash.</span>
    </span>
  );
}
