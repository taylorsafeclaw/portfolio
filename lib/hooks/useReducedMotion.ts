import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function sub(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function get() {
  return window.matchMedia(QUERY).matches;
}

function getServer() {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(sub, get, getServer);
}
