import { beforeEach, describe, expect, it } from "vitest";
import { emitClick, emitPulse, getRipples, resetRipples } from "@/lib/ascii/pulse-store";

beforeEach(() => {
  resetRipples();
});

describe("pulse store", () => {
  it("keeps at most 3 concurrent click ripples, evicting the oldest", () => {
    emitClick(0, 0, 1000);
    emitClick(10, 0, 1100);
    emitClick(20, 0, 1200);
    emitClick(30, 0, 1300);
    const clicks = getRipples(1400).filter((r) => r.kind === "click");
    expect(clicks).toHaveLength(3);
    expect(clicks.some((r) => r.x === 0)).toBe(false);
  });

  it("prunes ripples past their life", () => {
    emitPulse(0, 0, 1000);
    emitClick(0, 0, 1000);
    expect(getRipples(1901).filter((r) => r.kind === "click")).toHaveLength(0);
    expect(getRipples(3601)).toHaveLength(0);
  });

  it("pulse and click carry the spec crest amplitudes", () => {
    emitPulse(1, 2, 0);
    emitClick(3, 4, 0);
    const [pulse, click] = getRipples(1);
    expect(pulse.amp).toBe(2); // +2 ramp band (§3b-B)
    expect(click.amp).toBe(4); // crest +4 (§3b-C)
  });
});
