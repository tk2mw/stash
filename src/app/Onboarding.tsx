import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { saveProfile } from "../store/profile";
import { StorageSettings } from "./StorageSettings";
import { TitleBar } from "./TitleBar";
import { Logo, LogoMark } from "../ui/Logo";
import { ease } from "../ui/motion";

// First visit: intro → artist name and folder → Library. No accounts. Layout from the user's reference:
// the mark on construction lines on the left, a dark card with a big title and a round white button on the right.
export type OnboardingScreen = "welcome" | "setup";

const STEPS = [
  { title: "All your sounds.\nOne stash.", text: "Beats, loops, one-shots, stems and kits, scattered across drives and folders. Bring them into one library you can play and search in seconds." },
  { title: "Your computer.\nYour files.", text: "Your sounds and everything about them stay on this computer. No account, no servers: names, tags, BPM and key included." },
  { title: "Less sorting.\nMore making.", text: "Drop files in and stash reads the BPM and key for you. Build drum kits and loop kits, then send them out as a ZIP in one click." },
];

export function Onboarding({ screen }: { screen: OnboardingScreen }) {
  const [step, setStep] = useState(0);

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <TitleBar banner={false} />
      <div className="grid min-h-0 flex-1 lg:grid-cols-2">
        <BrandPanel clip={screen === "setup"} />
        <div className="relative flex min-h-0 flex-col overflow-hidden bg-panel lg:my-3 lg:mr-3 lg:rounded-2xl lg:border lg:border-line lg:shadow-panel">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-radial-[at_30%_45%] from-white/5 to-transparent to-60%" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={screen === "welcome" ? `welcome-${step}` : screen}
              initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
              exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
              transition={{ duration: 0.36, ease }}
              className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5 sm:px-10 sm:pb-10 sm:pt-8"
            >
              {screen === "welcome" && <Welcome step={step} onStep={setStep} />}
              {screen === "setup" && <Setup />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function BrandPanel({ clip }: { clip: boolean }) {
  const reduceMotion = useReducedMotion();
  const line = "absolute left-1/2 top-1/2 h-px w-[300vmax] -translate-x-1/2 -translate-y-1/2 bg-line";
  return (
    <aside className="drag-window relative hidden overflow-hidden lg:block">
      {/* the lines fade out before the edges, so they never cross the wordmark */}
      <div aria-hidden className="absolute inset-0 [mask-image:radial-gradient(circle,black_20rem,transparent_32rem)]">
        <span className={line} />
        <span className={`${line} rotate-90`} />
        <span className={`${line} rotate-45`} />
        <span className={`${line} -rotate-45`} />
        <LogoMark className="absolute left-1/2 top-1/2 size-36 -translate-1/2 text-fg" />
      </div>
      {/* last step: the user's ASCII clip (made from their GIF, see public/media) takes the mark's place */}
      <AnimatePresence initial={false}>
        {clip && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease }}
            className="absolute inset-3 overflow-hidden rounded-2xl bg-panel"
          >
            <video
              src={`${import.meta.env.BASE_URL}media/signup.mp4`}
              poster={`${import.meta.env.BASE_URL}media/signup.webp`}
              autoPlay={!reduceMotion}
              muted
              loop
              playsInline
              className="size-full object-cover"
            />
            {/* keeps the wordmark and the footer readable on the light frames */}
            <span className="absolute inset-0 bg-linear-to-b from-black/70 via-transparent via-30% to-black/90" />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative flex h-full flex-col justify-between p-10">
        <Logo />
        <p className="text-xs text-fg-subtle">© 2026 loud4u. Your files never leave this computer.</p>
      </div>
    </aside>
  );
}

// Top row of the card: the wordmark on phones (the left panel is hidden there).
function CardTop() {
  return (
    <div className="drag-window flex min-h-10 items-center">
      <span className="lg:hidden">
        <Logo />
      </span>
    </div>
  );
}

function Title({ children }: { children: ReactNode }) {
  return <h1 className="whitespace-pre-line text-[2.75rem] font-normal leading-[1.02] tracking-[-0.045em] sm:text-[3.75rem]">{children}</h1>;
}

function RoundButton({ children, type = "submit", onClick }: { children: ReactNode; type?: "submit" | "button"; onClick?: () => void }) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.93 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className="grid size-22 shrink-0 place-items-center rounded-full bg-accent px-3 text-center text-2xs font-semibold uppercase text-on-accent sm:size-26"
    >
      {children}
    </motion.button>
  );
}

// Label on top, a single line underneath that turns white with focus (from the reference).
function LineField({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-fg-muted">
        {label}
      </label>
      <span className="flex items-center border-b border-line-strong transition-[border-color,box-shadow] duration-200 focus-within:border-fg focus-within:shadow-[0_1px_0_var(--color-fg)]">
        <input id={id} className="h-11 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-fg-subtle focus-visible:outline-none" {...input} />
      </span>
    </div>
  );
}

function Welcome({ step, onStep }: { step: number; onStep: (step: number) => void }) {
  const last = step === STEPS.length - 1;
  return (
    <>
      <CardTop />
      <div className="my-auto py-10">
        <p className="mb-5 text-sm tabular-nums text-fg-muted">
          0{step + 1} / 0{STEPS.length}
        </p>
        <Title>{STEPS[step].title}</Title>
        <p className="mt-6 max-w-[26rem] text-md text-fg-muted">{STEPS[step].text}</p>
      </div>
      <div className="flex items-end justify-between gap-6">
        <div className="flex gap-1.5 pb-2">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              aria-label={`Step ${i + 1}`}
              aria-current={i === step ? "step" : undefined}
              onClick={() => onStep(i)}
              className={`h-1 rounded-full transition-all duration-300 ease-out ${i === step ? "w-8 bg-fg" : "w-4 bg-surface-3 hover:bg-fg-subtle"}`}
            />
          ))}
        </div>
        <RoundButton type="button" onClick={() => (last ? (location.hash = "#/setup") : onStep(step + 1))}>
          {last ? "Get started" : "Next"}
        </RoundButton>
      </div>
    </>
  );
}

// Last step: the artist name put on uploads, and the folder for the sounds.
function Setup() {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saveProfile({ name: String(new FormData(e.currentTarget).get("name")).trim() });
        location.hash = "#/library";
      }}
      className="flex flex-1 flex-col"
    >
      <CardTop />
      <div className="my-auto py-10">
        <Title>{"Saved on\nthis computer."}</Title>
        <p className="mt-6 max-w-[30rem] text-md text-fg-muted">Write how you sign your beats, then pick a folder for your sounds and how much space stash may use.</p>
        <div className="mt-8 flex max-w-[34rem] flex-col gap-6">
          <LineField label="Artist name" name="name" autoComplete="nickname" required maxLength={60} placeholder="How you sign your beats" />
          <StorageSettings />
        </div>
      </div>
      <div className="flex items-end justify-between gap-6">
        <p className="max-w-[16rem] pb-2 text-xs text-fg-subtle">No account needed. Nothing leaves this computer.</p>
        <RoundButton>Continue</RoundButton>
      </div>
    </form>
  );
}
