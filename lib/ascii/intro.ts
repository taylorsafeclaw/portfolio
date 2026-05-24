/**
 * Intro Engine — Soft Radial Bloom
 *
 * The ASCII field undergoes a radial bloom transition:
 * dormant texture → soft Gaussian bloom from center → settled field → dissolve.
 *
 * Phase 1: Dormant (0-100ms)        — texture with firefly flickers
 * Phase 2: Bloom (100-1800ms)       — radial brightness bloom from center
 * Phase 3: Peak (1800-2800ms)       — breathing, settled field
 * Phase 4: Dissolve (2800-4500ms)   — edges fade first, center last
 * Phase 5: Done (4500ms+)           — ambient takes over
 *
 * Pixel-space distances produce a true circle on any aspect ratio.
 * Gaussian alpha falloff eliminates visible ring/band artifacts.
 * Timing noise per cell preserves clean circle with organic stagger.
 */

import { RAMP_LEN } from "@/lib/ascii/ramp";

export const INTRO_DURATION = 4500;

const DORMANT_END = 100;
const BLOOM_END = 1800;
const PEAK_END = 2800;

const SIGMA = 0.30;
const ECHO_SIGMA = 0.12;
const ECHO_OFFSET = 0.15;
const PEAK_ALPHA = 0.50;
const BLOOM_REACH = 1.05;

function cellHash(col: number, row: number): number {
  return ((col * 7919 + row * 104729 + col * row * 31) % 1000) / 1000;
}

function cellHash2(col: number, row: number): number {
  return (
    ((col * 13397 + row * 52711 + (col + 1) * (row + 1) * 17) % 1000) / 1000
  );
}

function ageToRamp(age: number, speedFactor: number): number {
  const adjustedAge = age * speedFactor;
  const t = Math.min(1, adjustedAge / 2200);
  const eased = 1 - Math.pow(1 - t, 2.5);
  return Math.min(RAMP_LEN - 2, Math.floor(eased * 12.5));
}

export class IntroEngine {
  private textureSeeds: Float32Array;
  private distances: Float32Array;
  private delays: Float32Array;
  private speeds: Float32Array;
  private cols: number;
  private total: number;

  constructor(
    cols: number,
    rows: number,
    centerCol: number,
    centerRow: number,
    charW: number,
    charH: number,
  ) {
    this.cols = cols;
    this.total = cols * rows;

    this.textureSeeds = new Float32Array(this.total);
    this.distances = new Float32Array(this.total);
    this.delays = new Float32Array(this.total);
    this.speeds = new Float32Array(this.total);

    const halfW = Math.max(1, cols / 2);
    const halfH = Math.max(1, rows / 2);
    const diag = Math.sqrt(
      (halfW * charW) ** 2 + (halfH * charH) ** 2,
    );

    for (let i = 0; i < this.total; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const px = (col - centerCol) * charW;
      const py = (row - centerRow) * charH;
      this.distances[i] = Math.sqrt(px * px + py * py) / diag;

      const h = cellHash(col, row);
      this.speeds[i] = 0.75 + h * 0.5;
      this.textureSeeds[i] = Math.floor(h * 6);
      this.delays[i] = (h - 0.5) * 0.06;
    }
  }

  private computePeakState(
    dist: number,
    speed: number,
    elapsed: number,
    col: number,
    row: number,
  ): { rampIdx: number; alpha: number } {
    const effectiveAge = elapsed - DORMANT_END;
    const rawRamp = ageToRamp(effectiveAge, speed);
    const zoneCap = Math.max(4, Math.floor(12.5 - dist * 8.5));

    const phase = Math.sin(elapsed * 0.0018 + col * 0.4 + row * 0.5);
    const breathOffset = phase * 0.8;

    const rampIdx = Math.max(
      0,
      Math.min(zoneCap, Math.round(rawRamp + breathOffset)),
    );

    return { rampIdx: Math.min(RAMP_LEN - 2, rampIdx), alpha: PEAK_ALPHA };
  }

  getRamp(
    col: number,
    row: number,
    elapsed: number,
  ): { rampIdx: number; alpha: number } | null {
    if (elapsed >= INTRO_DURATION) return null;

    const idx = row * this.cols + col;
    const dist = this.distances[idx];
    const speed = this.speeds[idx];
    const seed = this.textureSeeds[idx];

    // --- Phase 1: Dormant (0-100ms) ---
    if (elapsed < DORMANT_END) {
      const fadeIn = Math.min(1, elapsed / 100);
      let alpha = 0.15 + fadeIn * 0.15;

      const flickerPhase = cellHash(col, row) * 6.28;
      const flickerFreq = 0.005 + cellHash2(col, row) * 0.004;
      const flickerWave = Math.sin(elapsed * flickerFreq + flickerPhase);
      const flickerIntensity = Math.max(0, (flickerWave - 0.92) / 0.08);

      const rampBoost = Math.floor(flickerIntensity * 2);
      alpha += flickerIntensity * 0.15;

      return {
        rampIdx: Math.min(RAMP_LEN - 2, seed + rampBoost),
        alpha,
      };
    }

    // --- Phase 2: Bloom (100-1800ms) ---
    if (elapsed < BLOOM_END) {
      const bloomT =
        (elapsed - DORMANT_END) / (BLOOM_END - DORMANT_END);
      const easedT = 1 - Math.pow(1 - bloomT, 1.8);
      const wavePos = easedT * BLOOM_REACH;

      const ignitionT = Math.min(1, (elapsed - DORMANT_END) / 120);
      const ignitionFactor = ignitionT * ignitionT;

      const cellDelay = this.delays[idx];
      const effectiveWavePos = wavePos - cellDelay;

      const sdf = dist - effectiveWavePos;

      const gaussAlpha = Math.exp(-(sdf * sdf) / (2 * SIGMA * SIGMA));

      const echoWavePos = Math.max(0, effectiveWavePos - ECHO_OFFSET);
      const echoSdf = dist - echoWavePos;
      const echoGauss = Math.exp(
        -(echoSdf * echoSdf) / (2 * ECHO_SIGMA * ECHO_SIGMA),
      );

      const behind = Math.max(0, -sdf);
      const settleT = Math.min(1, behind / 0.3);
      const settleEased = settleT * settleT * (3 - 2 * settleT);

      const peak = this.computePeakState(dist, speed, elapsed, col, row);

      const bloomInfluence =
        Math.max(gaussAlpha, settleEased) * ignitionFactor;
      let alpha = 0.28 + (PEAK_ALPHA - 0.28) * bloomInfluence;
      alpha += 0.10 * echoGauss * ignitionFactor;

      const densityT = Math.max(
        0,
        1 - Math.abs(sdf) / (SIGMA * 2.5),
      );
      const waveRamp = Math.min(
        RAMP_LEN - 2,
        seed + Math.floor(densityT * 11),
      );
      let rampIdx = Math.round(
        waveRamp + (peak.rampIdx - waveRamp) * settleEased,
      );

      const crossfadeStart = BLOOM_END - 300;
      if (elapsed > crossfadeStart) {
        const t = (elapsed - crossfadeStart) / 300;
        const cfEased = t * t * t * (t * (6 * t - 15) + 10);
        rampIdx = Math.round(
          rampIdx + (peak.rampIdx - rampIdx) * cfEased,
        );
        alpha = alpha + (peak.alpha - alpha) * cfEased;
      }

      return {
        rampIdx: Math.min(RAMP_LEN - 2, Math.max(0, rampIdx)),
        alpha: Math.max(0, Math.min(PEAK_ALPHA + 0.04, alpha)),
      };
    }

    // --- Phase 3: Peak (1800-2600ms) ---
    if (elapsed < PEAK_END) {
      return this.computePeakState(dist, speed, elapsed, col, row);
    }

    // --- Phase 4: Dissolve (2600-4000ms) ---
    const dissolveT = (elapsed - PEAK_END) / (INTRO_DURATION - PEAK_END);
    const globalEased = 1 - Math.pow(1 - dissolveT, 2);

    const hash = cellHash(col, row);
    const hash2 = cellHash2(col, row);
    const distContrib = (1 - Math.min(1, dist / 0.9)) * 0.45;
    const noiseContrib = hash * 0.12 + hash2 * 0.08;
    const cellDissolveT = Math.max(
      0,
      Math.min(1, (globalEased - distContrib + noiseContrib) / 0.55),
    );

    const syntheticBirth =
      DORMANT_END + dist * (BLOOM_END - DORMANT_END);
    const peakAge = PEAK_END - syntheticBirth;
    const peakRamp = Math.min(RAMP_LEN - 2, ageToRamp(peakAge, speed));
    const cappedPeak = Math.min(
      peakRamp,
      Math.max(1, Math.floor(RAMP_LEN - 2 - dist * (RAMP_LEN - 3))),
    );

    const ambientRamp = Math.floor(hash * 3);

    const smoothT =
      cellDissolveT * cellDissolveT * (3 - 2 * cellDissolveT);
    const rampIdx = Math.max(
      0,
      Math.round(cappedPeak + (ambientRamp - cappedPeak) * smoothT),
    );

    const alpha = PEAK_ALPHA + (0.18 - PEAK_ALPHA) * smoothT;

    return { rampIdx: Math.min(RAMP_LEN - 2, rampIdx), alpha };
  }
}
