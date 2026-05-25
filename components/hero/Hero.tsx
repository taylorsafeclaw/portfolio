"use client";

import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/hero/Wordmark";
import { ScrambleLink } from "@/components/hero/ScrambleLink";
import { subscribe, getSnapshot } from "@/lib/scroll-store";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

const RESOLVE_DONE_MS = 4800;
const SCROLL_UNLOCK_MS = RESOLVE_DONE_MS + 1200;

export function Hero() {
  const [markHover, setMarkHover] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    const timer = setTimeout(() => {
      html.style.overflow = "";
      body.style.overflow = "";
    }, SCROLL_UNLOCK_MS);
    return () => {
      clearTimeout(timer);
      html.style.overflow = "";
      body.style.overflow = "";
    };
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const el = sectionRef.current;
    if (!el) return;
    return subscribe(() => {
      const { heroDissolve } = getSnapshot();
      el.style.setProperty("--dp", heroDissolve.toFixed(4));
    });
  }, [reduced]);

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative"
      style={
        {
          height: reduced ? "auto" : "200vh",
          minHeight: "100dvh",
          "--dp": "0",
        } as React.CSSProperties
      }
    >
      <div
        className="isolate flex min-h-[100dvh] w-full flex-col overflow-hidden px-6 sm:px-10"
        style={{ position: reduced ? "relative" : "sticky", top: reduced ? undefined : 0 }}
      >
        <HeroBackdrop />
        <Grain />

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-12 sm:gap-14">
          <div
            className="hero-wordmark-exit relative px-6 py-5 sm:px-9 sm:py-7"
            onMouseEnter={() => setMarkHover(true)}
            onMouseLeave={() => setMarkHover(false)}
          >
            <Wordmark />
            <Scanline />
            <div className="hero-dissolve-accents absolute inset-0 pointer-events-none">
              <RegTicks snap={markHover} />
            </div>
          </div>

          <div className="hero-parallax">
            <p
              className="hero-fade-in max-w-[90vw] text-center font-mono text-[16px] leading-[1.75] text-[var(--fg)] sm:text-[17px] md:max-w-[58ch]"
              style={{ animationDelay: `${RESOLVE_DONE_MS + 300}ms` }}
            >
              Hi, I&apos;m Taylor. Builder from the Bay.{" "}
              <strong className="font-medium text-[var(--fg-peak)]">
                Repeat founder.
              </strong>{" "}
              Shipped startups from 0 &rarr; 1, gone deep on enterprise systems,
              now back to building. Mostly drawn to the parts other people skip,
              where taste compounds.
            </p>
          </div>

          <div className="hero-parallax">
            <div
              className="hero-fade-in flex flex-col items-center gap-4 sm:flex-row sm:gap-8"
              style={{ animationDelay: `${RESOLVE_DONE_MS + 550}ms` }}
            >
              <ScrambleLink
                href="#selected-work"
                className="hero-link font-mono text-[15px] text-[var(--fg-peak)]"
              >
                selected work &rarr;
              </ScrambleLink>
              <ScrambleLink
                href="mailto:taylor@taylorallen.dev"
                className="hero-link hero-link--muted font-mono text-[15px] text-[var(--fg-muted)]"
              >
                taylor@taylorallen.dev
              </ScrambleLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Scanline() {
  return (
    <span
      aria-hidden
      className="hero-scanline pointer-events-none absolute inset-0 overflow-hidden"
      style={{ animationDelay: `${RESOLVE_DONE_MS + 100}ms` }}
    >
      <span className="hero-scanline-bar absolute inset-y-0 left-0 w-full" />
    </span>
  );
}

function RegTicks({ snap }: { snap: boolean }) {
  const offset = snap ? 8 : 0;
  return (
    <div
      aria-hidden
      className="hero-fade-in pointer-events-none absolute inset-0"
      style={{ animationDelay: `${RESOLVE_DONE_MS + 400}ms` }}
    >
      <RegTick
        pos="top-0 left-0"
        d="M 0 7 L 0 0 L 7 0"
        tx={offset}
        ty={offset}
      />
      <RegTick
        pos="top-0 right-0"
        d="M 9 0 L 16 0 L 16 7"
        tx={-offset}
        ty={offset}
      />
      <RegTick
        pos="bottom-0 left-0"
        d="M 0 9 L 0 16 L 7 16"
        tx={offset}
        ty={-offset}
      />
      <RegTick
        pos="right-0 bottom-0"
        d="M 9 16 L 16 16 L 16 9"
        tx={-offset}
        ty={-offset}
      />
    </div>
  );
}

function RegTick({
  pos,
  d,
  tx,
  ty,
}: {
  pos: string;
  d: string;
  tx: number;
  ty: number;
}) {
  return (
    <svg
      className={`absolute h-3 w-3 sm:h-4 sm:w-4 ${pos}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="var(--fg-muted)"
      strokeWidth="0.9"
      style={{
        transform: `translate(${tx}px, ${ty}px)`,
        transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <path d={d} />
    </svg>
  );
}

function HeroBackdrop() {
  const reduced = useReducedMotion();
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0"
      style={{
        backgroundColor: "var(--ink-100)",
        animation: reduced
          ? "none"
          : "heroBackdropFade 7000ms ease forwards",
      }}
    />
  );
}

function Grain() {
  return (
    <svg
      aria-hidden
      className="hero-grain-entry pointer-events-none absolute inset-0 z-0 h-full w-full mix-blend-overlay"
    >
      <filter id="hero-grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.9"
          numOctaves="2"
          stitchTiles="stitch"
        />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#hero-grain)" />
    </svg>
  );
}
