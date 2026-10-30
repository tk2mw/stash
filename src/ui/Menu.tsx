import type { ReactElement, ReactNode } from "react";
import { Menu } from "@animate-ui/react/primitives/base-ui/menu";
import { ContextMenu } from "@animate-ui/react/primitives/base-ui/context-menu";
import { ChevronRightIcon, CheckIcon, CloseIcon } from "./icons";
import { IconButton } from "./Button";
import { Chip } from "./Chip";
import { cx } from "./cx";

// One list of entries drives both the "…" dropdown and the right-click menu. `submenu` opens to the side.
export type MenuEntry =
  | { label: string; icon?: ReactNode; onSelect?: () => void; disabled?: boolean; danger?: boolean; checked?: boolean; submenu?: MenuEntry[] }
  | "separator";

const popupClass = "min-w-48 max-h-[min(24rem,var(--available-height))] overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-popover outline-none";
// Animate UI glides one highlight between items, reading its colour from `data-highlighted:bg-*`.
const itemClass =
  "flex h-8 cursor-default select-none items-center gap-2.5 rounded-sm px-2.5 text-base outline-none data-highlighted:bg-surface-3 data-popup-open:bg-surface-3 data-disabled:opacity-40";

function Entries({ items, parts }: { items: MenuEntry[]; parts: typeof Menu }) {
  return items.map((entry, i) => {
    if (entry === "separator") return <parts.Separator key={i} className="mx-1 my-1 h-px bg-line" />;
    const icon = (
      <span className={cx("grid size-4 shrink-0 place-items-center", !entry.danger && "text-fg-muted")}>
        {entry.checked ? <CheckIcon size="0.875rem" weight="bold" className="text-fg" /> : entry.icon}
      </span>
    );
    if (entry.submenu)
      return (
        <parts.SubmenuRoot key={entry.label}>
          <parts.SubmenuTrigger disabled={entry.disabled} className={cx(itemClass, "text-fg/90")}>
            {icon}
            <span className="flex-1">{entry.label}</span>
            <ChevronRightIcon size="0.75rem" className="text-fg-muted" />
          </parts.SubmenuTrigger>
          <parts.Portal>
            <parts.Positioner sideOffset={4} alignOffset={-4} className="z-40">
              <parts.Popup className={popupClass}>
                <Entries items={entry.submenu} parts={parts} />
              </parts.Popup>
            </parts.Positioner>
          </parts.Portal>
        </parts.SubmenuRoot>
      );
    return (
      <parts.Item key={entry.label} disabled={entry.disabled} onClick={entry.onSelect} className={cx(itemClass, entry.danger ? "text-danger" : "text-fg/90")}>
        {icon}
        <span className="truncate">{entry.label}</span>
      </parts.Item>
    );
  });
}

// "…" button that opens the entries as a dropdown.
export function MenuButton({ label, items, size = "sm", className, children }: { label: string; items: MenuEntry[]; size?: "sm" | "md"; className?: string; children: ReactNode }) {
  return (
    <Menu.Root>
      <Menu.Trigger render={<IconButton size={size} label={label} className={className} />}>{children}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-40">
          <Menu.Popup className={popupClass}>
            <Entries items={items} parts={Menu} />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

// Makes `render` (e.g. a list row) open the same entries on right-click / long-press.
export function ContextMenuArea({ items, render, children }: { items: MenuEntry[]; render: ReactElement; children: ReactNode }) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={render}>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="z-40">
          <ContextMenu.Popup className={popupClass}>
            <Entries items={items} parts={ContextMenu as unknown as typeof Menu} />
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

export type FilterOption = { value: string; label: string; count?: number };

// Filter chip with a dropdown of options. `multiple` = checkboxes (match any), otherwise one choice that closes the menu.
// The chip turns white and shows the choice while the filter is on; "Clear" switches it off.
export function FilterMenu({
  label,
  options,
  value,
  onChange,
  multiple,
}: {
  label: string;
  options: FilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
}) {
  const active = value.length > 0;
  const summary = value.length === 1 ? options.find((o) => o.value === value[0])?.label : `${label} · ${value.length}`;
  const indicator = "grid size-4 shrink-0 place-items-center";
  const row = (o: FilterOption) => (
    <>
      <span className="flex-1 truncate">{o.label}</span>
      {o.count !== undefined && <span className="text-sm tabular-nums text-fg-subtle">{o.count}</span>}
    </>
  );

  return (
    <Menu.Root>
      <Menu.Trigger render={<Chip dropdown selected={active} />}>{active ? summary : label}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start" className="z-40">
          <Menu.Popup aria-label={`Filter by ${label}`} className={cx(popupClass, "max-h-[min(20rem,var(--available-height))] overflow-y-auto")}>
            {multiple ? (
              options.map((o) => (
                <Menu.CheckboxItem
                  key={o.value}
                  checked={value.includes(o.value)}
                  onCheckedChange={(on) => onChange(on ? [...value, o.value] : value.filter((v) => v !== o.value))}
                  className={cx(itemClass, "text-fg/90")}
                >
                  <span className={indicator}>
                    <Menu.CheckboxItemIndicator animation="pop">
                      <CheckIcon size="0.875rem" weight="bold" />
                    </Menu.CheckboxItemIndicator>
                  </span>
                  {row(o)}
                </Menu.CheckboxItem>
              ))
            ) : (
              <Menu.RadioGroup value={value[0] ?? null} onValueChange={(v: string) => onChange([v])}>
                {options.map((o) => (
                  <Menu.RadioItem key={o.value} value={o.value} closeOnClick className={cx(itemClass, "text-fg/90")}>
                    <span className={indicator}>
                      <Menu.RadioItemIndicator animation="pop">
                        <CheckIcon size="0.875rem" weight="bold" />
                      </Menu.RadioItemIndicator>
                    </span>
                    {row(o)}
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            )}
            {active && (
              // stays visible at the bottom while a long list scrolls
              <div className="sticky -bottom-1 -mx-1 bg-surface px-1 pb-1">
                <Menu.Separator className="mx-1 mb-1 h-px bg-line" />
                <Menu.Item onClick={() => onChange([])} className={cx(itemClass, "text-fg/90")}>
                  <span className={cx(indicator, "text-fg-muted")}>
                    <CloseIcon size="0.875rem" />
                  </span>
                  Clear
                </Menu.Item>
              </div>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
