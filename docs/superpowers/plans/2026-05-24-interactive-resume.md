# Interactive Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing portfolio site into an interactive resume where a living ASCII density ramp field is the persistent substrate, content emerges from it via scroll-driven erosion, and every interaction speaks the same visual language (·░▒▓█).

**Architecture:** The existing AsciiGrid canvas becomes a site-wide breathing field (not hero-only). A shared density ramp engine (`lib/ascii/density.ts`) provides the core primitives that all 12 effects use. New sections (Story, Conviction) are added as components. The existing SelectedWork is redesigned as focus cards. Effects are layered: identity (always on), scroll (entrance), card (hover), closing, connective.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4, raw rAF for ASCII field, CSS animations for reveals, pnpm

**Spec:** `docs/superpowers/specs/2026-05-24-interactive-resume-design.md`

---

## File map

```
lib/
  ascii/
    ramp.ts              — existing, unchanged
    scramble.ts           — existing, unchanged
    intro.ts              — existing, unchanged
    density.ts            — NEW: shared density ramp utilities (breathing, erosion, sparkle math)
  hooks/
    useReducedMotion.ts   — existing, unchanged
    useInView.ts          — NEW: IntersectionObserver hook for scroll-triggered effects
    useMagnetic.ts        — NEW: magnetic drift hook for CTA
  scroll-store.ts         — existing, extend with section visibility tracking
  projects.ts             — existing, update descriptions

components/
  ascii/
    AsciiGrid.tsx          — existing, MAJOR REFACTOR: site-wide field, breathing, sparkles, erosion zones
  hero/
    Hero.tsx               — existing, minor: remove AsciiGrid mount (moves to layout)
    Wordmark.tsx           — existing, unchanged
    ScrambleLink.tsx       — existing, unchanged
  story/
    Story.tsx              — NEW: narrative section with text generate
    TextGenerate.tsx       — NEW: word-by-word reveal component
  work/
    SelectedWork.tsx       — existing, REWRITE: focus card container
    ProjectRow.tsx         — DELETE (replaced by WorkCard)
    WorkCard.tsx           — NEW: focus card with spotlight + moving border
  conviction/
    Conviction.tsx         — NEW: scroll-paced belief statements
  footer/
    Footer.tsx             — existing, REWRITE: magnetic CTA, "let's build something"
  shared/
    HeaderDecode.tsx       — NEW: viewport-triggered scramble decode for section headers
    BorderBeam.tsx         — NEW: density char walking a divider line
    SectionWrapper.tsx     — NEW: wraps sections with erosion zone registration

app/
  layout.tsx              — MODIFY: mount AsciiGrid site-wide, add Instrument Serif font
  page.tsx                — MODIFY: add Story, Conviction sections
  globals.css             — MODIFY: add new animation keyframes, add --font-serif token
```

---

### Task 1: Density ramp utilities

Create the shared engine that all effects consume. Pure functions, no React.

**Files:**
- Create: `lib/ascii/density.ts`

- [ ] **Step 1: Create density utility module**

```typescript
// lib/ascii/density.ts

import { RAMP, RAMP_LEN } from "@/lib/ascii/ramp";

/** Sinusoidal breathing: returns an opacity delta for a cell at time `now` */
export function breathingAlpha(
  col: number,
  row: number,
  now: number,
  period: number = 7000,
): number {
  const phase = Math.sin((now / period) * Math.PI * 2 + col * 0.15 + row * 0.2);
  return phase * 0.03;
}

/** Sparkle: returns a ramp boost (0 or positive) for a cell. Sparse, random. */
export function sparkleBoost(
  cellIndex: number,
  now: number,
  rate: number = 2.5,
  totalCells: number,
): number {
  const cycle = 400;
  const slot = Math.floor(now / cycle);
  const hash = ((slot * 7919 + cellIndex * 104729) % totalCells);
  const isSparkle = hash < Math.ceil(rate);
  if (!isSparkle) return 0;
  const t = (now % cycle) / cycle;
  const intensity = t < 0.5 ? t * 2 : (1 - t) * 2;
  return Math.floor(intensity * 3);
}

export interface ErosionZone {
  centerX: number;
  centerY: number;
  radius: number;
  progress: number; // 0 = no erosion, 1 = fully eroded
  shape: "center-out" | "top-down" | "edges-in" | "bottom-up";
}

/** Erosion: returns an alpha multiplier (0–1) for a cell given active zones */
export function erosionAlpha(
  cellX: number,
  cellY: number,
  viewportW: number,
  viewportH: number,
  zones: ErosionZone[],
): number {
  let alpha = 1;
  for (const zone of zones) {
    if (zone.progress <= 0) continue;
    let dist: number;
    switch (zone.shape) {
      case "center-out": {
        const dx = (cellX - zone.centerX) / viewportW;
        const dy = (cellY - zone.centerY) / viewportH;
        dist = Math.sqrt(dx * dx + dy * dy) * 2;
        break;
      }
      case "top-down": {
        dist = (cellY - zone.centerY + zone.radius) / (zone.radius * 2);
        break;
      }
      case "edges-in": {
        const edgeDist = Math.min(
          cellX / viewportW,
          (viewportW - cellX) / viewportW,
          cellY / viewportH,
          (viewportH - cellY) / viewportH,
        ) * 4;
        dist = 1 - edgeDist;
        break;
      }
      case "bottom-up": {
        dist = 1 - (cellY - zone.centerY + zone.radius) / (zone.radius * 2);
        break;
      }
    }
    const erosion = Math.max(0, 1 - Math.max(0, dist) / Math.max(0.01, 1 - zone.progress));
    alpha *= 1 - erosion;
  }
  return Math.max(0, Math.min(1, alpha));
}

/** Clamp a value between min and max */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/ascii/density.ts
git commit -m "feat: add density ramp utilities (breathing, sparkle, erosion)"
```

---

### Task 2: useInView hook

Shared IntersectionObserver hook for scroll-triggered effects.

**Files:**
- Create: `lib/hooks/useInView.ts`

- [ ] **Step 1: Create the hook**

```typescript
// lib/hooks/useInView.ts

"use client";

import { useEffect, useRef, useState } from "react";

interface UseInViewOptions {
  threshold?: number;
  once?: boolean;
  rootMargin?: string;
}

export function useInView<T extends HTMLElement = HTMLElement>(
  options: UseInViewOptions = {},
) {
  const { threshold = 0.2, once = true, rootMargin = "0px" } = options;
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once, rootMargin]);

  return { ref, inView };
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/useInView.ts
git commit -m "feat: add useInView hook for scroll-triggered effects"
```

---

### Task 3: HeaderDecode component

Viewport-triggered scramble decode for section headers. Extends existing ScrambleLink pattern.

**Files:**
- Create: `components/shared/HeaderDecode.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/shared/HeaderDecode.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "@/lib/hooks/useInView";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { scrambleText } from "@/lib/ascii/scramble";

const DECODE_MS = 300;
const TICK_MS = 28;
const DENSITY_CHARS = "·░▒▓█-:=+";

interface Props {
  text: string;
  className?: string;
  as?: "h2" | "span" | "div";
}

export function HeaderDecode({ text, className = "", as: Tag = "h2" }: Props) {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.3 });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(text);
  const hasDecoded = useRef(false);

  useEffect(() => {
    if (!inView || hasDecoded.current || reduced) return;
    hasDecoded.current = true;

    const start = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / DECODE_MS);
      setDisplay(scrambleText(text, t, DENSITY_CHARS));
      if (t < 1) {
        setTimeout(tick, TICK_MS);
      }
    };
    tick();
  }, [inView, text, reduced]);

  return (
    <Tag
      ref={ref as React.RefObject<never>}
      className={`font-[var(--font-display)] text-[13px] font-normal tracking-[0.04em] text-[var(--fg-strong)] lowercase ${className}`}
    >
      {display}
    </Tag>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/shared/HeaderDecode.tsx
git commit -m "feat: add HeaderDecode component (viewport-triggered scramble)"
```

---

### Task 4: TextGenerate component

Word-by-word text reveal on scroll with density ramp flash per word.

**Files:**
- Create: `components/story/TextGenerate.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/story/TextGenerate.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "@/lib/hooks/useInView";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

const WORD_DELAY_MS = 80;
const RAMP_FLASH_MS = 120;
const RAMP_CHARS = ["░", "▒"];

interface TextSegment {
  text: string;
  emphasis?: boolean;
}

interface Props {
  segments: TextSegment[];
  className?: string;
}

export function TextGenerate({ segments, className = "" }: Props) {
  const { ref, inView } = useInView<HTMLParagraphElement>({ threshold: 0.3 });
  const reduced = useReducedMotion();
  const [revealedWords, setRevealedWords] = useState<number>(0);
  const [flashIndex, setFlashIndex] = useState<number>(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allWords: { word: string; emphasis: boolean }[] = [];
  for (const seg of segments) {
    for (const w of seg.text.split(/\s+/).filter(Boolean)) {
      allWords.push({ word: w, emphasis: seg.emphasis ?? false });
    }
  }
  const totalWords = allWords.length;

  useEffect(() => {
    if (!inView || reduced) {
      if (reduced) setRevealedWords(totalWords);
      return;
    }

    let current = 0;
    const reveal = () => {
      if (current >= totalWords) return;
      setFlashIndex(current);
      setTimeout(() => setFlashIndex(-1), RAMP_FLASH_MS);
      current++;
      setRevealedWords(current);
      timerRef.current = setTimeout(reveal, WORD_DELAY_MS);
    };
    timerRef.current = setTimeout(reveal, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [inView, totalWords, reduced]);

  return (
    <p ref={ref} className={className}>
      {allWords.map((entry, i) => {
        const visible = i < revealedWords;
        const flashing = i === flashIndex;
        return (
          <span key={i}>
            {i > 0 && " "}
            <span
              style={{
                opacity: visible ? 1 : 0,
                transition: "opacity 100ms ease",
              }}
              className={entry.emphasis ? "font-medium text-[var(--fg-peak)]" : ""}
            >
              {flashing ? RAMP_CHARS[Math.floor(Math.random() * RAMP_CHARS.length)] : entry.word}
            </span>
          </span>
        );
      })}
    </p>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/story/TextGenerate.tsx
git commit -m "feat: add TextGenerate component (word-by-word reveal with ramp flash)"
```

---

### Task 5: BorderBeam component

Density character walking a divider line.

**Files:**
- Create: `components/shared/BorderBeam.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/shared/BorderBeam.tsx

"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

const LOOP_MS = 6000;
const CHAR = "░";

interface Props {
  className?: string;
}

export function BorderBeam({ className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const charRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const container = containerRef.current;
    const char = charRef.current;
    if (!container || !char) return;

    let raf: number;
    const start = performance.now();

    const tick = () => {
      const t = ((performance.now() - start) % LOOP_MS) / LOOP_MS;
      const w = container.offsetWidth;
      char.style.transform = `translateX(${t * w}px)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return (
    <div
      ref={containerRef}
      className={`relative h-px w-full overflow-hidden ${className}`}
      style={{ backgroundColor: "var(--border)" }}
      aria-hidden
    >
      {!reduced && (
        <span
          ref={charRef}
          className="absolute left-0 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[var(--fg-quietest)]"
          style={{ willChange: "transform" }}
        >
          {CHAR}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/shared/BorderBeam.tsx
git commit -m "feat: add BorderBeam component (density char walking section dividers)"
```

---

### Task 6: Story section

The narrative "who I am" section with TextGenerate and HeaderDecode.

**Files:**
- Create: `components/story/Story.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create Story component**

```typescript
// components/story/Story.tsx

"use client";

import { HeaderDecode } from "@/components/shared/HeaderDecode";
import { TextGenerate } from "@/components/story/TextGenerate";

const SEGMENTS = [
  { text: "I started my first company at 19 — sole engineer, built the MVP, got it into PearX. Went deep on healthcare AI at Stanford, then co-founded an AI voice-agent platform and took it from zero to paying customers. Self-taught, no degree." },
  { text: "I keep shipping the parts other people skip.", emphasis: true },
];

export function Story() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[52ch] px-6 pt-24 pb-12 sm:px-10 sm:pt-32 sm:pb-16">
      <HeaderDecode text="about" className="mb-8" />
      <TextGenerate
        segments={SEGMENTS}
        className="text-center font-mono text-[16px] leading-[1.75] text-[var(--fg)] sm:text-[17px]"
      />
    </section>
  );
}
```

- [ ] **Step 2: Add Story to page**

```typescript
// app/page.tsx — replace full contents

import { Hero } from "@/components/hero/Hero";
import { Story } from "@/components/story/Story";
import { SelectedWork } from "@/components/work/SelectedWork";
import { Conviction } from "@/components/conviction/Conviction";
import { Footer } from "@/components/footer/Footer";
import { BorderBeam } from "@/components/shared/BorderBeam";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col">
      <Hero />
      <BorderBeam />
      <Story />
      <BorderBeam />
      <SelectedWork />
      <BorderBeam />
      <Conviction />
      <BorderBeam />
      <Footer />
    </main>
  );
}
```

Note: `Conviction` doesn't exist yet — create a stub in the next task so this compiles.

- [ ] **Step 3: Verify types compile**

Run: `pnpm typecheck`
Expected: FAIL (Conviction not yet created). Proceed to Task 7 immediately.

- [ ] **Step 4: Commit (after Task 7 stub is created)**

```bash
git add components/story/Story.tsx app/page.tsx
git commit -m "feat: add Story section with TextGenerate and HeaderDecode"
```

---

### Task 7: Conviction section

Scroll-paced belief statements with TextGenerate.

**Files:**
- Create: `components/conviction/Conviction.tsx`

- [ ] **Step 1: Create Conviction component**

```typescript
// components/conviction/Conviction.tsx

"use client";

import { TextGenerate } from "@/components/story/TextGenerate";

const STATEMENTS = [
  {
    segments: [{ text: "I keep starting things." }],
  },
  {
    segments: [
      { text: "The best products come from people who care about" },
      { text: "the details nobody asked them to care about.", emphasis: true },
    ],
  },
  {
    segments: [
      { text: "Self-taught since high school. No degree." },
      { text: "Everything I know, I learned by shipping.", emphasis: true },
    ],
  },
];

export function Conviction() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-[44ch] px-6 py-16 sm:py-24">
      <div className="flex flex-col gap-20 sm:gap-24">
        {STATEMENTS.map((stmt, i) => (
          <TextGenerate
            key={i}
            segments={stmt.segments}
            className="text-center font-[var(--font-serif)] italic text-[18px] leading-[1.6] text-[var(--fg-muted)] sm:text-[20px]"
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify full page compiles**

Run: `pnpm typecheck && pnpm build`
Expected: PASS

- [ ] **Step 3: Commit Story + Conviction + page together**

```bash
git add components/story/Story.tsx components/conviction/Conviction.tsx app/page.tsx
git commit -m "feat: add Story and Conviction sections with scroll-paced text reveal"
```

---

### Task 8: WorkCard with Focus Cards

Redesign SelectedWork from a flat table to interactive focus cards.

**Files:**
- Create: `components/work/WorkCard.tsx`
- Modify: `components/work/SelectedWork.tsx`
- Modify: `lib/projects.ts`
- Delete: `components/work/ProjectRow.tsx`

- [ ] **Step 1: Update project data**

```typescript
// lib/projects.ts — replace full contents

export interface Project {
  title: string;
  description: string;
  density: "█" | "▓" | "▒";
  year: string;
  href?: string;
}

export const projects: Project[] = [
  {
    title: "odisai",
    description: "co-founded an AI voice-agent platform for vet clinics. built end-to-end solo. 5 paying customers live in production.",
    density: "█",
    year: "2025 — 2026",
  },
  {
    title: "stanford health care",
    description: "solutions architect, AI. built an internal clinical note-taking tool. contributed to ChatEHR pilot.",
    density: "▓",
    year: "2024 — 2025",
  },
  {
    title: "poppin",
    description: "sole engineer on a social events app. built the MVP in two months. pear-backed. ~$2M seed. exited.",
    density: "▒",
    year: "2021 — 2022",
  },
];
```

- [ ] **Step 2: Create WorkCard component**

```typescript
// components/work/WorkCard.tsx

"use client";

import { useRef, useEffect, useState } from "react";
import type { Project } from "@/lib/projects";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

const DENSITY_UP: Record<string, string> = { "▒": "▓", "▓": "█", "█": "█" };
const ORBIT_MS = 3500;
const ORBIT_CHAR = "▓";

interface Props {
  project: Project;
  focused: boolean;
  onHover: () => void;
  onLeave: () => void;
  visible: boolean;
  index: number;
}

export function WorkCard({ project, focused, onHover, onLeave, visible, index }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [orbitPos, setOrbitPos] = useState(0);
  const reduced = useReducedMotion();

  // Moving border orbit
  useEffect(() => {
    if (!focused || reduced) return;
    let raf: number;
    const start = performance.now();
    const tick = () => {
      setOrbitPos(((performance.now() - start) % ORBIT_MS) / ORBIT_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [focused, reduced]);

  // Card spotlight (track mouse within card)
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  const spotlightStyle = focused && !reduced
    ? {
        background: `radial-gradient(circle 120px at ${mousePos.x}% ${mousePos.y}%, rgba(200,198,194,0.04) 0%, transparent 100%)`,
      }
    : {};

  // Orbit position to CSS
  const orbitStyle = (): React.CSSProperties => {
    if (!focused || reduced) return { opacity: 0 };
    const perimeter = 2 * ((cardRef.current?.offsetWidth ?? 200) + (cardRef.current?.offsetHeight ?? 80));
    const pos = orbitPos * perimeter;
    const w = cardRef.current?.offsetWidth ?? 200;
    const h = cardRef.current?.offsetHeight ?? 80;

    let x = 0, y = 0;
    if (pos < w) { x = pos; y = 0; }
    else if (pos < w + h) { x = w; y = pos - w; }
    else if (pos < 2 * w + h) { x = w - (pos - w - h); y = h; }
    else { x = 0; y = h - (pos - 2 * w - h); }

    return {
      position: "absolute" as const,
      left: `${x}px`,
      top: `${y}px`,
      transform: "translate(-50%, -50%)",
      opacity: 1,
      transition: "opacity 200ms",
      pointerEvents: "none" as const,
    };
  };

  const dimmed = !focused && visible;

  return (
    <div
      ref={cardRef}
      className="section-reveal relative"
      style={{
        transitionDelay: visible ? `${index * 120}ms` : "0ms",
        opacity: visible ? undefined : 0,
      }}
      data-visible={visible || undefined}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onMouseMove={handleMouseMove}
    >
      <div
        className="relative overflow-hidden py-4 px-3 transition-all duration-300 sm:py-5 sm:px-4"
        style={{
          ...spotlightStyle,
          backgroundColor: focused ? "var(--bg-elev-1)" : "transparent",
        }}
      >
        {/* Orbit character */}
        <span
          className="font-mono text-[9px] text-[var(--fg-quietest)]"
          style={orbitStyle()}
          aria-hidden
        >
          {ORBIT_CHAR}
        </span>

        <div className="grid grid-cols-[2ch_1fr_auto] items-baseline gap-x-2 sm:grid-cols-[3ch_1fr_auto] sm:gap-x-4">
          <span
            className="font-mono text-[14px] transition-colors duration-300"
            style={{
              color: focused
                ? "var(--fg-muted)"
                : dimmed ? "var(--fg-quietest)" : "var(--fg-muted)",
            }}
            aria-hidden
          >
            {focused ? (DENSITY_UP[project.density] ?? project.density) : project.density}
          </span>

          <div className="min-w-0">
            <span
              className="font-mono text-[14px] font-medium transition-colors duration-300"
              style={{
                color: dimmed ? "var(--fg-quietest)" : "var(--fg-strong)",
              }}
            >
              {project.title}
            </span>
            <p
              className="mt-1 font-mono text-[12px] leading-[1.5] transition-colors duration-300"
              style={{
                color: dimmed ? "var(--fg-quietest)" : "var(--fg-muted)",
              }}
            >
              {project.description}
            </p>
          </div>

          <span
            className="font-mono text-[11px] whitespace-nowrap transition-colors duration-300"
            style={{
              color: dimmed ? "var(--fg-quietest)" : "var(--fg-quiet)",
            }}
          >
            {project.year}
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite SelectedWork as focus card container**

```typescript
// components/work/SelectedWork.tsx — replace full contents

"use client";

import { useState } from "react";
import { projects } from "@/lib/projects";
import { WorkCard } from "@/components/work/WorkCard";
import { HeaderDecode } from "@/components/shared/HeaderDecode";
import { useInView } from "@/lib/hooks/useInView";

export function SelectedWork() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.15 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section
      ref={ref}
      id="selected-work"
      className="relative z-10 mx-auto w-full max-w-[64ch] px-6 pt-16 pb-12 sm:px-10 sm:pt-24 sm:pb-16"
    >
      <HeaderDecode text="selected work" className="mb-8" />

      <div className="flex flex-col">
        {projects.map((project, i) => (
          <div key={project.title}>
            <WorkCard
              project={project}
              focused={hoveredIndex === null || hoveredIndex === i}
              onHover={() => setHoveredIndex(i)}
              onLeave={() => setHoveredIndex(null)}
              visible={inView}
              index={i}
            />
            {i < projects.length - 1 && (
              <div
                className="h-px w-full"
                style={{ backgroundColor: "var(--border)" }}
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Delete old ProjectRow**

```bash
rm components/work/ProjectRow.tsx
```

- [ ] **Step 5: Verify build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/projects.ts components/work/WorkCard.tsx components/work/SelectedWork.tsx
git rm components/work/ProjectRow.tsx
git commit -m "feat: redesign SelectedWork as focus cards with spotlight and moving border"
```

---

### Task 9: Footer rewrite with Magnetic CTA

**Files:**
- Create: `lib/hooks/useMagnetic.ts`
- Modify: `components/footer/Footer.tsx`

- [ ] **Step 1: Create magnetic drift hook**

```typescript
// lib/hooks/useMagnetic.ts

"use client";

import { useEffect, useRef, useState } from "react";

interface MagneticOffset {
  x: number;
  y: number;
}

export function useMagnetic(
  radius: number = 200,
  maxDrift: number = 4,
) {
  const ref = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState<MagneticOffset>({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const isTouchDevice = "ontouchstart" in window;
    if (isTouchDevice) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > radius) {
        setOffset({ x: 0, y: 0 });
        return;
      }

      const strength = 1 - dist / radius;
      setOffset({
        x: (dx / dist) * strength * maxDrift,
        y: (dy / dist) * strength * maxDrift,
      });
    };

    const handleLeave = () => setOffset({ x: 0, y: 0 });

    window.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, [radius, maxDrift]);

  return { ref, offset };
}
```

- [ ] **Step 2: Rewrite Footer**

```typescript
// components/footer/Footer.tsx — replace full contents

"use client";

import { ScrambleLink } from "@/components/hero/ScrambleLink";
import { TextGenerate } from "@/components/story/TextGenerate";
import { useMagnetic } from "@/lib/hooks/useMagnetic";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

const TAGLINE_SEGMENTS = [{ text: "Let's build something." }];

export function Footer() {
  const { ref: magneticRef, offset } = useMagnetic(200, 4);
  const reduced = useReducedMotion();

  return (
    <footer className="relative z-10 mx-auto w-full max-w-[52ch] px-6 pt-16 pb-8 text-center sm:px-10 sm:pt-24 sm:pb-10">
      <TextGenerate
        segments={TAGLINE_SEGMENTS}
        className="mb-6 font-mono text-[14px] text-[var(--fg)] sm:text-[15px]"
      />

      <div className="mb-8">
        <ScrambleLink
          ref={magneticRef as React.RefObject<HTMLAnchorElement>}
          href="mailto:taylor@taylorallen.dev"
          className="hero-link hero-link--muted inline-block font-mono text-[14px] text-[var(--fg-peak)] transition-transform duration-200 sm:text-[15px]"
          style={{
            transform: reduced
              ? undefined
              : `translate(${offset.x}px, ${offset.y}px)`,
          }}
        >
          taylor@taylorallen.dev
        </ScrambleLink>
      </div>

      <p className="font-mono text-[11px] text-[var(--fg-quiet)]">
        <span>Taylor Allen</span>
        <span className="mx-2 text-[var(--fg-quietest)]" aria-hidden>·</span>
        <span>2026</span>
        <span className="mx-2 text-[var(--fg-quietest)]" aria-hidden>·</span>
        <span>Bay Area</span>
      </p>
    </footer>
  );
}
```

Note: ScrambleLink needs a `ref` and `style` forwarded. If the current ScrambleLink doesn't accept these, wrap the `<a>` in a `<span>` that carries the magnetic offset instead. Adjust at implementation time based on what compiles.

- [ ] **Step 3: Verify build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS (may need to adjust ScrambleLink ref forwarding — see note above)

- [ ] **Step 4: Commit**

```bash
git add lib/hooks/useMagnetic.ts components/footer/Footer.tsx
git commit -m "feat: rewrite Footer with magnetic CTA and TextGenerate tagline"
```

---

### Task 10: AsciiGrid refactor — site-wide field with breathing + sparkles

This is the largest task. The AsciiGrid moves from hero-only to layout-level, gains breathing waves and sparkles, and the erosion zone system hooks up.

**Files:**
- Modify: `components/ascii/AsciiGrid.tsx`
- Modify: `app/layout.tsx`
- Modify: `components/hero/Hero.tsx`

- [ ] **Step 1: Add Instrument Serif font + move AsciiGrid to layout**

In `app/layout.tsx`:
1. Add Instrument Serif via `next/font/google` (or download woff2 and use `next/font/local`):

```typescript
import { Instrument_Serif } from "next/font/google";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-serif",
  display: "swap",
});
```

2. Add the variable class to `<html>`: `${instrumentSerif.variable}`

3. Add AsciiGrid as a fixed-position site-wide element:

```typescript
// Add: import { AsciiGrid } from "@/components/ascii/AsciiGrid";
// In <body>, add before {children}:
//   <AsciiGrid />
```

In `components/hero/Hero.tsx`, remove the `<AsciiGrid />` render (line 62 in the current file). The grid is now site-wide, not hero-scoped.

- [ ] **Step 2: Refactor AsciiGrid for breathing + sparkles**

Key changes to `components/ascii/AsciiGrid.tsx`:
- Change canvas from `absolute` to `fixed` positioning (covers entire viewport at all scroll positions)
- Import `breathingAlpha` and `sparkleBoost` from `lib/ascii/density.ts`
- In the ambient draw loop (post-intro), replace the fixed `alpha = 0.18 + ...` calculation with:
  - Base alpha reduced to `0.06 + (baseIdx / RAMP_LEN) * 0.08` (brings ambient to ~10%)
  - Add `breathingAlpha(c, r, now)` to the alpha
  - Add `sparkleBoost(idx, now, reducedSparkleRate, total)` to `drawIdx`
  - On mobile (viewport width < 768), reduce sparkle rate to 1/sec

The exact code changes are extensive modifications to the existing draw function. The implementer should:
1. Read the full AsciiGrid.tsx first
2. Change the canvas className from `absolute inset-0` to `fixed inset-0 z-0`
3. Reduce the base ambient alpha values in the draw function
4. Add breathing and sparkle calls from the density module
5. Test that the field is visible on all sections, not just the hero

- [ ] **Step 3: Verify the field renders behind all sections**

Run: `pnpm dev`, open browser, scroll through all 5 sections. The ASCII field should be visible (at low opacity) behind Story, Work, Conviction, and Contact sections.

- [ ] **Step 4: Verify build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/ascii/AsciiGrid.tsx app/layout.tsx components/hero/Hero.tsx
git commit -m "feat: make AsciiGrid site-wide with breathing waves and density sparkles"
```

---

### Task 11: Density erosion integration

Connect the erosion zone system so the ASCII field clears around content sections.

**Files:**
- Modify: `components/ascii/AsciiGrid.tsx`
- Create: `components/shared/SectionWrapper.tsx`
- Modify: `components/story/Story.tsx`
- Modify: `components/work/SelectedWork.tsx`
- Modify: `components/conviction/Conviction.tsx`
- Modify: `components/footer/Footer.tsx`

- [ ] **Step 1: Create SectionWrapper that registers erosion zones**

The SectionWrapper needs to communicate its bounding rect to the AsciiGrid. Use a shared ref store (similar to scroll-store pattern):

```typescript
// components/shared/SectionWrapper.tsx

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useInView } from "@/lib/hooks/useInView";
import type { ErosionZone } from "@/lib/ascii/density";

// Shared mutable store for active erosion zones
export const erosionZones: ErosionZone[] = [];
let zoneId = 0;

interface Props {
  children: ReactNode;
  shape: ErosionZone["shape"];
  className?: string;
}

export function SectionWrapper({ children, shape, className = "" }: Props) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.05, once: false });
  const idRef = useRef(zoneId++);
  const zoneRef = useRef<ErosionZone>({
    centerX: 0,
    centerY: 0,
    radius: 0,
    progress: 0,
    shape,
  });

  useEffect(() => {
    const zone = zoneRef.current;
    if (!erosionZones.includes(zone)) {
      erosionZones.push(zone);
    }
    return () => {
      const idx = erosionZones.indexOf(zone);
      if (idx >= 0) erosionZones.splice(idx, 1);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const zone = zoneRef.current;
      zone.centerX = rect.left + rect.width / 2;
      zone.centerY = rect.top + rect.height / 2;
      zone.radius = Math.max(rect.width, rect.height) / 2;
      zone.progress = inView ? 1 : 0;
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ref, inView]);

  return (
    <div ref={ref} className={`relative z-10 ${className}`}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Wrap content sections in SectionWrapper**

Update Story, SelectedWork, Conviction, and Footer to wrap their content in `<SectionWrapper shape="...">`. For example in Story.tsx, replace the outer `<section>` with `<SectionWrapper shape="center-out">` and move the section element inside.

- [ ] **Step 3: Connect erosion to AsciiGrid draw loop**

In AsciiGrid's draw function, import `erosionZones` from SectionWrapper and `erosionAlpha` from density.ts. After computing the cell's base alpha, multiply by `erosionAlpha(x, y, w, h, erosionZones)`. This dims/removes characters near visible content sections.

- [ ] **Step 4: Test erosion on scroll**

Run: `pnpm dev`, scroll through sections. ASCII field should thin/disappear around content areas and remain visible in the margins.

- [ ] **Step 5: Verify build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/shared/SectionWrapper.tsx components/story/Story.tsx components/work/SelectedWork.tsx components/conviction/Conviction.tsx components/footer/Footer.tsx components/ascii/AsciiGrid.tsx
git commit -m "feat: add density erosion system — ASCII field clears around content sections"
```

---

### Task 12: Mobile and responsive pass

Ensure all effects degrade gracefully on tablet and mobile per the spec.

**Files:**
- Modify: `components/ascii/AsciiGrid.tsx`
- Modify: `components/work/WorkCard.tsx`
- Modify: `components/footer/Footer.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: AsciiGrid mobile optimizations**

In AsciiGrid, detect viewport width on resize. When `< 768px`:
- Increase character cell size (reduce total cells for perf)
- Reduce sparkle rate from 2.5 to 1
- Reduce churn count from 12 to 6
- Simplify erosion to uniform alpha fade (skip shaped erosion)

- [ ] **Step 2: WorkCard touch behavior**

In WorkCard, on touch devices:
- Disable card spotlight (no cursor position)
- Disable moving border
- Focus via tap: `onTouchStart` sets focused, `onTouchEnd` doesn't immediately clear (use a 2s timeout)

- [ ] **Step 3: Footer touch behavior**

In Footer, disable magnetic drift when `ontouchstart` is available (already handled in useMagnetic hook).

- [ ] **Step 4: Global mobile styles**

Add `--font-serif: var(--font-serif);` to the `@theme inline` block in `app/globals.css` so Tailwind can reference it. Also add any needed mobile overrides for section spacing and text sizing. Verify:
- Bio max-width 90vw on mobile
- CTAs stack vertically on mobile (already in Hero.tsx)
- Work cards readable at 375px
- Conviction statements have appropriate spacing on mobile

- [ ] **Step 5: Test at 375px viewport**

Run: `pnpm dev`, resize browser to 375px width. Verify all sections render correctly, text is readable, no horizontal overflow.

- [ ] **Step 6: Verify build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add components/ascii/AsciiGrid.tsx components/work/WorkCard.tsx components/footer/Footer.tsx app/globals.css
git commit -m "feat: mobile and responsive pass — degrade effects for touch and small viewports"
```

---

### Task 13: Reduced motion pass

Ensure all 12 effects respect `prefers-reduced-motion: reduce`.

**Files:**
- Verify: all component files use `useReducedMotion()` or CSS `prefers-reduced-motion`

- [ ] **Step 1: Audit each component**

Check that:
- `AsciiGrid` — renders one static frame, no rAF loop when reduced
- `HeaderDecode` — renders text immediately, no scramble
- `TextGenerate` — reveals all words immediately
- `WorkCard` — no spotlight, no moving border, focus dimming uses CSS transition only
- `BorderBeam` — no animation, static hairline
- `Footer` — no magnetic drift
- `Conviction` — text appears immediately

Most of these are already handled by the `reduced` checks in each component. This task is an audit to confirm.

- [ ] **Step 2: Test with reduced motion**

In macOS System Settings → Accessibility → Display → Reduce Motion (enable). Reload the site. All content should be visible immediately, no animations, no jank.

- [ ] **Step 3: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: ensure all effects respect prefers-reduced-motion"
```

---

### Task 14: Final build verification and cleanup

**Files:**
- Modify: `CLAUDE.md` (update to reference new spec)
- Delete or archive: `HANDOFF.md`, `TODOS.md`, `plan.md`

- [ ] **Step 1: Full build check**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS with no warnings

- [ ] **Step 2: Update CLAUDE.md**

Replace references to HANDOFF.md with the new spec location:
`docs/superpowers/specs/2026-05-24-interactive-resume-design.md`

- [ ] **Step 3: Archive old docs**

```bash
mkdir -p docs/archive
mv HANDOFF.md docs/archive/
mv TODOS.md docs/archive/
mv plan.md docs/archive/
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: update CLAUDE.md to reference new spec, archive old docs"
```

---

## Execution order summary

| Task | What | Dependencies |
|------|------|-------------|
| 1 | Density ramp utilities | None |
| 2 | useInView hook | None |
| 3 | HeaderDecode component | 2 |
| 4 | TextGenerate component | 2 |
| 5 | BorderBeam component | None |
| 6 | Story section | 3, 4 |
| 7 | Conviction section | 4 |
| 8 | WorkCard + Focus Cards | 2, 3 |
| 9 | Footer rewrite | 4 |
| 10 | AsciiGrid site-wide + breathing + sparkles | 1 |
| 11 | Density erosion integration | 1, 10 |
| 12 | Mobile/responsive pass | All above |
| 13 | Reduced motion pass | All above |
| 14 | Cleanup | All above |

Tasks 1-5 can run in parallel. Tasks 6-9 can run in parallel. Tasks 10-11 are sequential. Tasks 12-14 are sequential after everything else.
