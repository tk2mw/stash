import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Dialog";
import { BoxIcon, FolderIcon, UploadIcon, UserIcon, WaveformIcon } from "../ui/icons";
import { LogoMark } from "../ui/Logo";
import { ease } from "../ui/motion";

// First run: a short look around, shown once after setup (Settings → Take the tour shows it again).
const KEY = "stash.tour";
export function tourSeen() {
  try {
    return localStorage.getItem(KEY) === "done";
  } catch {
    return true; // storage blocked: don't show it on every start
  }
}
export function markTourSeen() {
  try {
    localStorage.setItem(KEY, "done");
  } catch {
    /* storage blocked */
  }
}

const icon = (I: typeof BoxIcon) => <I size="1.5rem" weight="light" />;

const TOUR: { icon: ReactNode; title: string; text: string }[] = [
  { icon: <LogoMark className="size-7" />, title: "Welcome to stash", text: "Your beats, samples and kits in one library, kept on this computer. Here's a quick look around: it takes a minute." },
  { icon: icon(UploadIcon), title: "Add your sounds", text: "Press Add or drop files anywhere in the window. stash asks whether they're tracks, samples or part of a pack, then reads the BPM and key for you." },
  { icon: icon(BoxIcon), title: "Packs and kits", text: "Import ZIP or RAR packs, or build your own drum kit, loop kit or preset kit from Packs. A kit you build exports as a ZIP in one click." },
  { icon: icon(FolderIcon), title: "Keep it tidy", text: "Make collections and playlists in the sidebar and drag tracks onto them. Star your favorites, add tags, and search everything with Ctrl K." },
  { icon: icon(WaveformIcon), title: "Play and credit", text: "Click a track to play it. The panel on the right shows its waveform, key, BPM and tags, and lists who worked on it: producers, beatmakers, engineers." },
  { icon: icon(UserIcon), title: "Make it yours", text: "The menu at the top right has your Profile (picture and artist name) and Storage, where you pick the folder for your sounds and how much space stash may use." },
];

// Closing it any way (Skip, Start, Esc, the X) counts as seen.
export function TourDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, onStep] = useState(0);
  const last = step === TOUR.length - 1;
  const close = (o: boolean) => {
    if (!o) markTourSeen();
    onOpenChange(o);
  };
  const done = () => close(false);
  return (
    <Modal open={open} onOpenChange={close} title={TOUR[step].title} description={`${step + 1} of ${TOUR.length}`}>
      <div className="flex flex-col gap-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.22, ease }}
            className="flex flex-col gap-4"
          >
            <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-fg">{TOUR[step].icon}</span>
            <p className="text-md text-fg-muted">{TOUR[step].text}</p>
          </motion.div>
        </AnimatePresence>
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1.5">
            {TOUR.map((s, i) => (
              <button
                key={s.title}
                type="button"
                aria-label={`Step ${i + 1}: ${s.title}`}
                aria-current={i === step ? "step" : undefined}
                onClick={() => onStep(i)}
                className={`h-1 rounded-full transition-all duration-300 ease-out ${i === step ? "w-6 bg-fg" : "w-3 bg-surface-3 hover:bg-fg-subtle"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {!last && (
              <Button variant="secondary" onClick={done}>
                Skip tour
              </Button>
            )}
            <Button onClick={() => (last ? done() : onStep(step + 1))}>{last ? "Start" : "Next"}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
