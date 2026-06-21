// lib/ascii/pulse-store.ts

/**
 * Ripple bus (§3b-B/C) — a ~20-line store in the style of scroll-store.
 * The Wordmark publishes breath pulses, pointer-down publishes click
 * ripples; the field engine consumes both each frame.
 */

export interface Ripple {
  x: number; // origin, CSS px
  y: number;
  start: number; // performance.now() ms
  amp: number; // ramp-step crest height
  life: number; // ms until fully dissipated
  kind: "pulse" | "click";
}

const MAX_CLICKS = 3;
const ripples: Ripple[] = [];

export function emitPulse(x: number, y: number, now: number): void {
  ripples.push({ x, y, start: now, amp: 2, life: 2600, kind: "pulse" });
}

export function emitClick(x: number, y: number, now: number): void {
  let clicks = 0;
  for (const r of ripples) if (r.kind === "click") clicks++;
  if (clicks >= MAX_CLICKS) {
    const oldest = ripples.findIndex((r) => r.kind === "click");
    if (oldest >= 0) ripples.splice(oldest, 1);
  }
  ripples.push({ x, y, start: now, amp: 4, life: 900, kind: "click" });
}

/** Prune expired ripples and return the live list. The engine never mutates it. */
export function getRipples(now: number): readonly Ripple[] {
  for (let i = ripples.length - 1; i >= 0; i--) {
    if (now - ripples[i].start > ripples[i].life) ripples.splice(i, 1);
  }
  return ripples;
}

export function resetRipples(): void {
  ripples.length = 0;
}
