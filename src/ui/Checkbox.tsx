import { CheckIcon } from "./icons";

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <span className="relative grid size-5 place-items-center">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer size-4.5 appearance-none rounded-[0.3125rem] border border-line-strong transition duration-150 ease-out checked:border-accent checked:bg-accent"
      />
      <CheckIcon weight="bold" size="0.75rem" className="pointer-events-none absolute text-on-accent opacity-0 peer-checked:opacity-100" />
    </span>
  );
}
