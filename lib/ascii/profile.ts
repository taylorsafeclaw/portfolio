// lib/ascii/profile.ts
//
// Device-capability classification for the ASCII field. Pure and DOM-free:
// the caller reads matchMedia/navigator and passes plain values in, so these
// functions are unit-testable. This module chooses *quality* knobs only — the
// interaction model (mouse vs touch) is decided per-event by pointerType,
// never here.

export type ProfileName = "desktop" | "tablet" | "handheld";

export interface FieldProfile {
  name: ProfileName;
  baseCellPx: number; // base font size (px) before cell-budget growth
  dprCap: number; // device-pixel-ratio ceiling
  octaves: number; // fbm octaves; domain warp engages only at >= 3
  recomputeEvery: number; // run the expensive target pass every Nth frame
  cellBudget: number; // max cols*rows; cell size grows to hold this
  lowPowerHint: boolean; // consumers cap secondary rAF loops (e.g. wordmark 30fps)
}

export interface DetectEnv {
  pointerCoarse: boolean; // matchMedia('(pointer: coarse)') — the PRIMARY pointer
  hover: boolean; // matchMedia('(hover: hover)')
  cores?: number; // navigator.hardwareConcurrency (may be undefined)
  deviceMemory?: number; // navigator.deviceMemory (Chromium only; may be undefined)
  vw: number;
  vh: number;
}

const DESKTOP: FieldProfile = {
  name: "desktop", baseCellPx: 13, dprCap: 2, octaves: 3,
  recomputeEvery: 2, cellBudget: 16000, lowPowerHint: false,
};
const TABLET: FieldProfile = {
  name: "tablet", baseCellPx: 14, dprCap: 2, octaves: 2,
  recomputeEvery: 3, cellBudget: 11000, lowPowerHint: true,
};
const HANDHELD: FieldProfile = {
  name: "handheld", baseCellPx: 15, dprCap: 1.5, octaves: 2,
  recomputeEvery: 3, cellBudget: 4000, lowPowerHint: true,
};

const HANDHELD_MAX_SHORT_SIDE = 520; // px; a coarse pointer below this is a phone

/**
 * Choose the quality profile from device capability. A coarse primary pointer
 * (or no hover) means touch-first → tablet or handheld by viewport short side.
 * Power hints only ever DEMOTE a coarse tier (tablet→handheld); desktop is
 * never demoted, because the domain warp is part of the brand and the cell
 * budget already bounds its cost.
 */
export function detectProfile(env: DetectEnv): FieldProfile {
  const touchPrimary = env.pointerCoarse || !env.hover;
  let profile: FieldProfile;
  if (!touchPrimary) {
    profile = DESKTOP;
  } else {
    const shortSide = Math.min(env.vw, env.vh);
    profile = shortSide < HANDHELD_MAX_SHORT_SIDE ? HANDHELD : TABLET;
  }

  const weak =
    (env.cores !== undefined && env.cores <= 4) ||
    (env.deviceMemory !== undefined && env.deviceMemory <= 4);
  if (weak && profile.name === "tablet") return HANDHELD;
  return profile;
}

// FONT_MAX bounds glyph size so huge displays don't get absurd characters.
// Below ~5K the cell budget holds exactly; at 8K+ the clamp wins and the
// budget becomes best-effort (out of the ≤4K target range).
const FONT_MAX = 32; // px; clamp so absurd displays don't grow glyphs without bound
const CELL_ASPECT = 0.6 * 1.35; // charW = fontSize*0.6, charH = fontSize*1.35 → 0.81

/**
 * Grow the glyph cell size just enough to keep cols*rows <= profile.cellBudget.
 * On normal viewports returns the base size unchanged (laptop/phone identical);
 * on large viewports the cells grow, staying crisp and on the shared lattice.
 */
export function chooseCellMetrics(
  vw: number,
  vh: number,
  profile: FieldProfile,
): { fontSize: number; charW: number; charH: number } {
  const needed = Math.ceil(Math.sqrt((vw * vh) / (CELL_ASPECT * profile.cellBudget)));
  const fontSize = Math.min(FONT_MAX, Math.max(profile.baseCellPx, needed));
  return { fontSize, charW: fontSize * 0.6, charH: fontSize * 1.35 };
}
