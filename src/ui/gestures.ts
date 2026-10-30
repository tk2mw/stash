// The three hooks ExpandableActionBar imports from Spectrum UI's lib, which its registry doesn't publish.
// Written from how the bar uses them.
import { useEffect, useMemo, useRef, type PointerEvent, type RefObject } from "react";

// Remembers the pointer that started a tap (and a value captured at that moment) until the click reads it.
export function useTapGesture<S>() {
  const gesture = useRef<{ pointerType: string; state: S } | null>(null);
  return useMemo(
    () => ({
      start: (e: PointerEvent, state: S) => {
        gesture.current = { pointerType: e.pointerType, state };
      },
      take: () => {
        const g = gesture.current;
        gesture.current = null;
        return g;
      },
      drop: () => {
        gesture.current = null;
      },
    }),
    [],
  );
}

// Hover only counts for pointers that can hover (mouse, pen): a finger's synthetic enter/leave is ignored.
export function useHoverGesture() {
  const inside = useRef(false);
  return useMemo(
    () => ({
      enter: (e: PointerEvent) => {
        if (e.pointerType === "touch") return false;
        inside.current = true;
        return true;
      },
      leave: (e: PointerEvent) => {
        if (e.pointerType === "touch" || !inside.current) return false;
        inside.current = false;
        return true;
      },
    }),
    [],
  );
}

// While active, a press outside `ref` dismisses. "consume" also swallows that press so it doesn't hit what's underneath.
export function useDismiss(active: boolean, onDismiss: () => void, ref: RefObject<HTMLElement | null>, { behavior = "passthrough" }: { behavior?: "consume" | "passthrough" } = {}) {
  useEffect(() => {
    if (!active) return;
    const swallow = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDown = (e: globalThis.PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onDismiss();
      if (behavior !== "consume") return;
      e.preventDefault();
      e.stopPropagation();
      document.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 500);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [active, onDismiss, ref, behavior]);
}
