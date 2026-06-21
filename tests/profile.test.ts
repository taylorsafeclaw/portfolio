import { describe, expect, it } from "vitest";
import { detectProfile, chooseCellMetrics, type DetectEnv } from "@/lib/ascii/profile";

const desktopEnv: DetectEnv = { pointerCoarse: false, hover: true, vw: 1440, vh: 900 };
const coarse = (over: Partial<DetectEnv>): DetectEnv => ({
  pointerCoarse: true, hover: false, vw: 1024, vh: 1366, ...over,
});

describe("detectProfile", () => {
  it("fine pointer with hover → desktop", () => {
    expect(detectProfile(desktopEnv).name).toBe("desktop");
  });
  it("coarse pointer, large short side → tablet", () => {
    expect(detectProfile(coarse({ vw: 1024, vh: 1366 })).name).toBe("tablet");
  });
  it("coarse pointer, small short side → handheld", () => {
    expect(detectProfile(coarse({ vw: 390, vh: 844 })).name).toBe("handheld");
  });
  it("landscape phone (short side < 520) → handheld, not tablet", () => {
    expect(detectProfile(coarse({ vw: 932, vh: 430 })).name).toBe("handheld");
  });
  it("weak tablet (≤4 cores) demotes to handheld", () => {
    expect(detectProfile(coarse({ vw: 1024, vh: 1366, cores: 4 })).name).toBe("handheld");
  });
  it("weak tablet (≤4 GB memory) demotes to handheld", () => {
    expect(detectProfile(coarse({ vw: 1024, vh: 1366, deviceMemory: 4 })).name).toBe("handheld");
  });
  it("desktop is never demoted by low cores (keeps the warp)", () => {
    expect(detectProfile({ ...desktopEnv, cores: 2 }).name).toBe("desktop");
    expect(detectProfile({ ...desktopEnv, cores: 2 }).octaves).toBeGreaterThanOrEqual(3);
  });
  it("missing power hints are never required", () => {
    expect(detectProfile(coarse({ vw: 1024, vh: 1366 })).name).toBe("tablet");
  });
});

describe("chooseCellMetrics", () => {
  const desktop = detectProfile(desktopEnv);
  const handheld = detectProfile(coarse({ vw: 390, vh: 844 }));
  const cellsFor = (vw: number, vh: number, p = desktop) => {
    const m = chooseCellMetrics(vw, vh, p);
    return Math.ceil(vw / m.charW) * Math.ceil(vh / m.charH);
  };

  it("laptop keeps the base cell size (unchanged look)", () => {
    expect(chooseCellMetrics(1440, 900, desktop).fontSize).toBe(desktop.baseCellPx);
  });
  it("phone keeps the base cell size (unchanged look)", () => {
    expect(chooseCellMetrics(390, 844, handheld).fontSize).toBe(handheld.baseCellPx);
  });
  it("2560 monitor caps cells at or under the desktop budget", () => {
    expect(chooseCellMetrics(2560, 1440, desktop).fontSize).toBeGreaterThan(desktop.baseCellPx);
    expect(cellsFor(2560, 1440)).toBeLessThanOrEqual(desktop.cellBudget);
  });
  it("4K caps cells at or under the desktop budget", () => {
    expect(chooseCellMetrics(3840, 2160, desktop).fontSize).toBeGreaterThan(desktop.baseCellPx);
    expect(cellsFor(3840, 2160)).toBeLessThanOrEqual(desktop.cellBudget);
  });
  it("never grows past FONT_MAX (32)", () => {
    expect(chooseCellMetrics(7680, 4320, desktop).fontSize).toBeLessThanOrEqual(32);
  });
  it("charW/charH track fontSize (0.6 / 1.35)", () => {
    const m = chooseCellMetrics(2560, 1440, desktop);
    expect(m.charW).toBeCloseTo(m.fontSize * 0.6);
    expect(m.charH).toBeCloseTo(m.fontSize * 1.35);
  });
});
