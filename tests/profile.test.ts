import { describe, expect, it } from "vitest";
import { detectProfile, type DetectEnv } from "@/lib/ascii/profile";

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
  it("desktop is never demoted by low cores (keeps the warp)", () => {
    expect(detectProfile({ ...desktopEnv, cores: 2 }).name).toBe("desktop");
    expect(detectProfile({ ...desktopEnv, cores: 2 }).octaves).toBeGreaterThanOrEqual(3);
  });
  it("missing power hints are never required", () => {
    expect(detectProfile(coarse({ vw: 1024, vh: 1366 })).name).toBe("tablet");
  });
});
