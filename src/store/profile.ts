import { useSyncExternalStore } from "react";
import { getSetting, setSetting } from "./db";

// The artist name put on uploads. stash has no accounts: this stays in this browser, on this computer.
export type Profile = { name: string };

const KEY = "stash.profile";
const listeners = new Set<() => void>();

function read(): Profile | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

let profile = read();
let avatar: string | null = null; // object URL of the profile picture; null = none

const emit = () => listeners.forEach((l) => l());

export function saveProfile(next: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the name lasts as long as this tab */
  }
  profile = next;
  emit();
}

// The picture is a blob in IndexedDB ("kv", not "files": Delete all data keeps it, like the name).
function show(blob: Blob | null | undefined) {
  if (avatar) URL.revokeObjectURL(avatar);
  avatar = blob ? URL.createObjectURL(blob) : null;
  emit();
}
getSetting<Blob | null>("avatar").then(show, () => undefined);

export async function saveAvatar(blob: Blob | null) {
  await setSetting("avatar", blob);
  show(blob);
}

export const getProfile = () => profile;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useProfile = () => useSyncExternalStore(subscribe, () => profile);
export const useAvatar = () => useSyncExternalStore(subscribe, () => avatar);
