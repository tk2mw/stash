import { useState } from "react";
import { saveAvatar, saveProfile, useAvatar, useProfile } from "../store/profile";
import { ARTIST, shrinkImage, useStore } from "../store/store";
import { ActivityCalendar } from "../ui/ActivityCalendar";
import { Button } from "../ui/Button";
import { inputClass } from "../ui/Dialog";
import { ImageIcon, UserIcon } from "../ui/icons";
import { toast } from "../ui/Toast";
import { pickImage } from "./trackActions";

// #/profile: the picture and the artist name put on new uploads, plus what's in the library.
export function ProfilePage() {
  const { state } = useStore();
  const profile = useProfile();
  const avatar = useAvatar();
  const [name, setName] = useState(profile?.name ?? "");
  const live = state.tracks.filter((t) => !t.trashedAt);
  const stats = [
    ["Tracks", live.filter((t) => t.type === "track").length],
    ["Samples", live.filter((t) => t.type === "sample").length],
    ["Packs", live.filter((t) => t.type === "pack").length + state.folders.filter((f) => f.pack).length],
    ["Playlists", state.playlists.length],
    ["Collaborators", new Set(live.flatMap((t) => (t.credits ?? []).map((c) => c.name))).size],
  ] as const;

  const changePicture = () =>
    pickImage(async (file) => {
      try {
        await saveAvatar(await shrinkImage(file, 512));
        toast("Picture updated");
      } catch (e) {
        toast("Couldn't use that image", { description: (e as Error).message, type: "error" });
      }
    });

  return (
    <div className="flex max-w-[52rem] flex-col gap-10 pt-4">
      <section className="flex flex-wrap items-center gap-8">
        <button type="button" onClick={changePicture} aria-label="Change picture" className="group relative grid size-32 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-fg-muted">
          {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : <UserIcon size="3rem" weight="light" />}
          <span className="absolute inset-0 grid place-items-center bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
            <ImageIcon size="1.5rem" className="text-fg" />
          </span>
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveProfile({ ...profile, name: name.trim() });
            toast("Name saved", { description: "New uploads are signed with it." });
          }}
          className="flex min-w-[16rem] flex-1 flex-col gap-2"
        >
          <label htmlFor="artist-name" className="text-sm text-fg-muted">
            Artist name
          </label>
          <div className="flex gap-2">
            <input id="artist-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={ARTIST} className={inputClass} />
            <Button type="submit" disabled={name.trim() === (profile?.name ?? "")} className="h-10">
              Save
            </Button>
          </div>
          <p className="text-sm text-fg-subtle">
            {avatar ? (
              <button type="button" onClick={() => saveAvatar(null)} className="rounded-xs text-fg-muted transition-colors hover:text-fg">
                Remove picture
              </button>
            ) : (
              "Click the circle to add a picture."
            )}
          </p>
        </form>
      </section>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-5">
        {stats.map(([label, n]) => (
          <div key={label} className="bg-panel px-4 py-3">
            <dt className="text-sm text-fg-muted">{label}</dt>
            <dd className="text-title tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="activity-heading" className="flex flex-col gap-3">
        <h2 id="activity-heading" className="text-2xs font-medium uppercase text-fg-muted">
          Activity
        </h2>
        <ActivityCalendar counts={state.activity} />
      </section>
    </div>
  );
}
