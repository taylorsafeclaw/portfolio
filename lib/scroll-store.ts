export interface ScrollSnapshot {
  heroDissolve: number;
  footerGravity: number;
}

const INITIAL: ScrollSnapshot = {
  heroDissolve: 0,
  footerGravity: 0,
};

let current: ScrollSnapshot = { ...INITIAL };
const listeners = new Set<() => void>();
let rafPending = false;
let initialized = false;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function compute(): ScrollSnapshot {
  const scrollY = window.scrollY;
  const vh = window.innerHeight;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);

  return {
    heroDissolve: clamp(scrollY / vh, 0, 1),
    footerGravity: clamp(
      (scrollY - (maxScroll - vh * 0.5)) / (vh * 0.5),
      0,
      1,
    ),
  };
}

function onScroll() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    current = compute();
    for (const cb of listeners) cb();
  });
}

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  current = compute();
}

export function subscribe(cb: () => void): () => void {
  init();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getSnapshot(): ScrollSnapshot {
  init();
  return current;
}

export function getServerSnapshot(): ScrollSnapshot {
  return INITIAL;
}
