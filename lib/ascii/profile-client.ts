// lib/ascii/profile-client.ts
//
// DOM-reading wrapper around the pure detectProfile (kept separate so
// profile.ts stays unit-testable). Effect-time only — never call during SSR.

import { detectProfile, type DetectEnv, type FieldProfile } from "@/lib/ascii/profile";

export function readDetectEnv(): DetectEnv {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    pointerCoarse: window.matchMedia("(pointer: coarse)").matches,
    hover: window.matchMedia("(hover: hover)").matches,
    cores: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    vw: window.innerWidth,
    vh: window.innerHeight,
  };
}

export function readProfile(): FieldProfile {
  return detectProfile(readDetectEnv());
}
