import { useRef, type ReactNode, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { UndoIcon, CalendarIcon, CloudIcon, CompassIcon, KeyboardIcon, MenuIcon, PlusIcon, UserIcon, VolumeIcon } from "../ui/icons";
import { sounds, useSoundsEnabled } from "../ui/sound";
import { useStore } from "../store/store";
import { ACCEPT } from "../store/audio";
import { BeamSearch } from "../ui/BeamSearch";
import { IconButton } from "../ui/Button";
import { SpecularButton } from "../ui/SpecularButton";
import { MenuButton } from "../ui/Menu";
import { cx } from "../ui/cx";
import { useDialog, useUpload } from "./dialogs";
import { useAvatar } from "../store/profile";

export function TopBar({
  title,
  titleKey,
  subtitle,
  actions: headerActions,
  query,
  onQuery,
  searchRef,
  onMenu,
  uploadFolderId,
  playlistId,
  className,
}: {
  title: string;
  titleKey: string; // the title animates only when this changes (not between folders of one pack)
  subtitle: string;
  actions?: ReactNode;
  query: string;
  onQuery: (q: string) => void;
  searchRef: Ref<HTMLInputElement>;
  onMenu: () => void;
  uploadFolderId: string | null;
  playlistId?: string;
  className?: string;
}) {
  const { actions } = useStore();
  const dialog = useDialog();
  const upload = useUpload();
  const soundsOn = useSoundsEnabled();
  const avatar = useAvatar();
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <header className={cx("drag-window flex flex-wrap items-center gap-x-3 gap-y-4 px-5 pb-3 pt-2 sm:gap-x-6 md:flex-nowrap lg:px-8 lg:pt-3", className)}>
      <IconButton label="Open menu" onClick={onMenu} className="-ml-2 lg:hidden">
        <MenuIcon size="1.375rem" />
      </IconButton>
      <div className="flex min-w-0 flex-1 items-center gap-2 md:basis-0">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={titleKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ type: "spring", stiffness: 400, damping: 32 }} className="min-w-0">
            <h1 className="truncate text-title font-semibold">{title}</h1>
            <p className="mt-1 text-base text-fg-muted">{subtitle}</p>
          </motion.div>
        </AnimatePresence>
        {headerActions}
      </div>
      <BeamSearch ref={searchRef} value={query} onChange={onQuery} placeholder="Search tracks, packs, tags…" className="order-last w-full md:order-none md:w-[27.875rem] md:min-w-45 md:shrink" />
      {/* +15rem (the sidebar width) puts the search in the middle of the window, not of the header */}
      <div className="flex flex-1 items-center justify-end gap-3 md:basis-0 xl:basis-60">
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          accept={ACCEPT}
          onChange={(e) => {
            upload([...(e.target.files ?? [])], uploadFolderId, playlistId);
            e.target.value = "";
          }}
        />
        {/* glass pill with a lit edge that follows the pointer, like the play button */}
        <SpecularButton aria-label="Add files" onClick={() => fileInput.current?.click()} size="sm" radius={999} tint="#fafafa" tintOpacity={0.06} baseColor="#5a5a5a" idleIntensity={0.5} proximity={180} className="h-11 max-sm:w-11" style={{ padding: "0 1.25rem" }}>
          <PlusIcon size="1.125rem" weight="bold" />
          <span className="max-sm:hidden">Add</span>
        </SpecularButton>
        <MenuButton
          label="Settings"
          items={[
            { label: "Profile", icon: <UserIcon size="1rem" />, onSelect: () => (location.hash = "#/profile") },
            { label: "Storage…", icon: <CloudIcon size="1rem" />, onSelect: () => dialog({ kind: "storage" }) },
            { label: "Activity", icon: <CalendarIcon size="1rem" />, onSelect: () => dialog({ kind: "activity" }) },
            { label: "Keyboard shortcuts", icon: <KeyboardIcon size="1rem" />, onSelect: () => dialog({ kind: "shortcuts" }) },
            { label: "Take the tour", icon: <CompassIcon size="1rem" />, onSelect: () => dialog({ kind: "tour" }) },
            { label: "Interface sounds", icon: <VolumeIcon size="1rem" />, checked: soundsOn, onSelect: sounds.toggle },
            "separator",
            {
              label: "Delete all data…",
              icon: <UndoIcon size="1rem" />,
              onSelect: () =>
                dialog({ kind: "confirm", title: "Delete all data?", description: "Every upload, folder and playlist is deleted, on this computer. This can't be undone.", confirm: "Delete everything", danger: true, onConfirm: actions.reset }),
            },
          ]}
          size="md"
          className="bg-surface-3 text-fg-muted ring-1 ring-line-strong hover:text-fg"
        >
          {avatar ? <img src={avatar} alt="" className="size-full rounded-full object-cover" /> : <UserIcon size="1.25rem" />}
        </MenuButton>
      </div>
    </header>
  );
}
