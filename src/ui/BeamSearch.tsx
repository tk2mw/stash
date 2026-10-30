/**
 * BeamSearch — adapted from Spectrum UI (ui.spectrumhq.in, @spectrumui/beam-search).
 * The bottom edge lights up with a travelling beam while focused (border-beam, MIT, Jakub Antalík).
 * Changes for stash: always dark, pill shape and our tokens, Phosphor icons, ref for ⌘K.
 */
import { useRef, useState, type Ref } from "react";
import { BorderBeam } from "border-beam";
import { SearchIcon, CloseIcon } from "./icons";
import { cx } from "./cx";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

export function BeamSearch({
  value,
  onChange,
  placeholder,
  ref,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ref?: Ref<HTMLInputElement>;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const inner = useRef<HTMLInputElement | null>(null);
  const setRefs = (node: HTMLInputElement | null) => {
    inner.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <BorderBeam size="line" colorVariant="mono" theme="dark" active={focused} borderRadius={999} className={cx("rounded-full", className)}>
      <label
        className={cx(
          "flex h-11 w-full items-center gap-3 rounded-full border bg-surface pl-4 pr-2 transition-colors duration-200 ease-out",
          focused ? "border-line-strong" : "border-line hover:border-line-strong",
        )}
      >
        <SearchIcon className={cx("shrink-0 transition-colors", focused ? "text-fg" : "text-fg-muted")} />
        <input
          ref={setRefs}
          type="search"
          name="q"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onChange("");
              inner.current?.blur();
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              inner.current?.focus();
            }}
            className="grid size-7 place-items-center rounded-full text-fg-muted transition hover:bg-surface-2 hover:text-fg active:scale-90"
          >
            <CloseIcon size="0.875rem" />
          </button>
        ) : (
          <kbd className="rounded-xs bg-surface-2 px-1.5 py-1 font-sans text-2xs text-fg-subtle">{isMac ? "⌘ K" : "Ctrl K"}</kbd>
        )}
      </label>
    </BorderBeam>
  );
}
