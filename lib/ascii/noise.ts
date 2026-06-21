// lib/ascii/noise.ts

/**
 * Seeded value noise + fbm + single-layer domain warp (§3). Zero
 * dependencies. Time is the z axis — sampling a slowly increasing z is the
 * field's morph; advection is applied by the caller as an x/y offset.
 */

const PERM_SIZE = 256;

/** Deterministic permutation table from a seed (mulberry32 shuffle). */
export function buildPerm(seed: number): Uint8Array {
  let a = seed >>> 0;
  const rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const p = new Uint8Array(PERM_SIZE * 2);
  for (let i = 0; i < PERM_SIZE; i++) p[i] = i;
  for (let i = PERM_SIZE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < PERM_SIZE; i++) p[PERM_SIZE + i] = p[i];
  return p;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function lattice(perm: Uint8Array, x: number, y: number, z: number): number {
  return perm[(perm[(perm[x & 255] + y) & 255] + z) & 255] / 255;
}

/** 3D value noise in [0, 1] — trilinear interpolation over a hashed lattice. */
export function valueNoise3(perm: Uint8Array, x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const w = smooth(z - zi);

  const n000 = lattice(perm, xi, yi, zi);
  const n100 = lattice(perm, xi + 1, yi, zi);
  const n010 = lattice(perm, xi, yi + 1, zi);
  const n110 = lattice(perm, xi + 1, yi + 1, zi);
  const n001 = lattice(perm, xi, yi, zi + 1);
  const n101 = lattice(perm, xi + 1, yi, zi + 1);
  const n011 = lattice(perm, xi, yi + 1, zi + 1);
  const n111 = lattice(perm, xi + 1, yi + 1, zi + 1);

  const x00 = n000 + (n100 - n000) * u;
  const x10 = n010 + (n110 - n010) * u;
  const x01 = n001 + (n101 - n001) * u;
  const x11 = n011 + (n111 - n011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

/** fbm: lacunarity 2, gain 0.5, normalized to [0, 1] (§3). */
export function fbm(perm: Uint8Array, x: number, y: number, z: number, octaves: number): number {
  if (octaves <= 0) return 0;
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise3(perm, x * freq, y * freq, z * freq);
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / total;
}

/**
 * Domain-warped fbm (Quílez pattern): field = fbm(p + W·(fbm(p+e₁), fbm(p+e₂))).
 * The warp turns blobs into liquid, current-like structure. octaves < 3 is
 * the mobile degradation path: plain fbm, no warp (§8).
 */
export const WARP_STRENGTH = 1.6;
const E1 = 5.2;
const E2 = 1.3;

export function warpedFbm(perm: Uint8Array, x: number, y: number, z: number, octaves: number): number {
  if (octaves < 3) return fbm(perm, x, y, z, octaves);
  const qx = fbm(perm, x + E1, y + E1, z, octaves);
  const qy = fbm(perm, x + E2, y + E2, z, octaves);
  return fbm(perm, x + WARP_STRENGTH * (qx - 0.5) * 2, y + WARP_STRENGTH * (qy - 0.5) * 2, z, octaves);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 === edge0) return x >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
