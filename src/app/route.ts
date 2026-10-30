import { useSyncExternalStore } from "react";

export type Route =
  | { name: "library" | "packs" | "starred" | "trash" | "profile" }
  | { name: "folder" | "playlist"; id: string };

export function parseRoute(hash: string): Route {
  const [, a = "", b = ""] = hash.replace(/^#/, "").split("/");
  if (a === "f" && b) return { name: "folder", id: b };
  if (a === "p" && b) return { name: "playlist", id: b };
  if (a === "packs" || a === "starred" || a === "trash" || a === "profile") return { name: a };
  return { name: "library" };
}

export const href = (r: Route) => ("id" in r ? `#/${r.name[0]}/${r.id}` : `#/${r.name}`);

const subscribe = (l: () => void) => {
  window.addEventListener("hashchange", l);
  return () => window.removeEventListener("hashchange", l);
};

export const useHash = () => useSyncExternalStore(subscribe, () => location.hash);
