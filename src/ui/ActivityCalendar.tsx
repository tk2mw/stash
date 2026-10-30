/**
 * ActivityCalendar — adapted from Componentry's GitHub calendar (componentry.dev, @componentry/github-calendar).
 * Changes for stash: fed with our own per-day counts instead of fetching GitHub, grey-to-white scale
 * with the "city lights" glow, motion/react instead of framer-motion, our tokens.
 */
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cx } from "./cx";

const LEVELS = ["bg-surface-2", "bg-[#3a3a3a]", "bg-[#6b6b6b]", "bg-[#a8a8a8]", "bg-fg"];

// Calendar arithmetic (not +24h steps), so daylight-saving days don't repeat or vanish.
function weeksUntil(today: Date, weeks: number) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const first = end.getDate() - ((weeks - 1) * 7 + end.getDay());
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => new Date(end.getFullYear(), end.getMonth(), first + w * 7 + d)).filter((day) => day <= end),
  );
}

export function ActivityCalendar({ counts, weeks = 52, label = "activities", className }: { counts: Record<string, number>; weeks?: number; label?: string; className?: string }) {
  const grid = useMemo(() => weeksUntil(new Date(), weeks), [weeks]);
  const [hover, setHover] = useState<{ date: string; count: number; x: number; y: number } | null>(null);
  const keyOf = (d: Date) => d.toLocaleDateString("sv-SE");
  const all = grid.flat().map((d) => counts[keyOf(d)] ?? 0);
  const max = Math.max(1, ...all);
  const total = all.reduce((a, b) => a + b, 0);
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));

  return (
    <div className={cx("flex w-max max-w-full flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-6 text-sm text-fg-muted">
        <span>
          <span className="font-medium text-fg tabular-nums">{total}</span> {label} in the last year
        </span>
        <span className="flex items-center gap-1.5">
          Less
          {LEVELS.map((c) => (
            <span key={c} className={cx("size-[0.6875rem] rounded-[3px]", c)} />
          ))}
          More
        </span>
      </div>
      <div className="relative flex max-w-full gap-[3px] overflow-x-auto pb-1" onMouseLeave={() => setHover(null)}>
        <AnimatePresence>
          {hover && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 5, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-fg px-3 py-1.5 text-xs text-on-accent shadow-popover"
              style={{ left: hover.x, top: hover.y - 36 }}
            >
              <span className="mr-1 font-semibold">{hover.count}</span>
              <span className="text-on-accent/60">
                {label} on {new Date(hover.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        {grid.map((week, w) => (
          <div key={w} className="flex w-[0.6875rem] shrink-0 flex-col gap-[3px] pt-9">
            {week.map((day, d) => {
              const count = counts[keyOf(day)] ?? 0;
              const lv = level(count);
              return (
                <motion.div
                  key={keyOf(day)}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: w * 0.01 + d * 0.01, type: "spring", stiffness: 260, damping: 20 }}
                  onMouseEnter={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const p = (e.currentTarget.offsetParent as HTMLElement).getBoundingClientRect();
                    setHover({ date: keyOf(day), count, x: r.left - p.left + r.width / 2, y: r.top - p.top });
                  }}
                  className={cx("aspect-square w-full rounded-[3px] transition-colors duration-200", LEVELS[lv])}
                  style={lv >= 3 ? { boxShadow: `0 0 ${lv === 4 ? 7 : 4}px rgb(255 255 255 / ${lv === 4 ? 0.45 : 0.25})` } : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
