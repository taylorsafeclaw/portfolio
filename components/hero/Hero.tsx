"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Wordmark } from "@/components/hero/Wordmark";
import { GridLayer } from "@/components/hero/GridLayer";
import { AsciiField } from "@/components/hero/AsciiField";
import { ScrambleLink } from "@/components/hero/ScrambleLink";

const RESOLVE_DONE_MS = 2400;
const FADE_BIO_DELAY = (RESOLVE_DONE_MS + 200) / 1000;
const FADE_CTA_DELAY = (RESOLVE_DONE_MS + 500) / 1000;
const SCANLINE_DELAY = (RESOLVE_DONE_MS + 100) / 1000;
const REG_TICK_DELAY = (RESOLVE_DONE_MS + 350) / 1000;

export function Hero() {
  const [markHover, setMarkHover] = useState(false);

  return (
    <section className="relative isolate flex min-h-screen w-full flex-col overflow-hidden px-6 sm:px-10">
      <GridLayer />
      <AsciiField />
      <Vignette />
      <Grain />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-12 sm:gap-14">
        <div
          className="relative px-6 py-5 sm:px-9 sm:py-7"
          onMouseEnter={() => setMarkHover(true)}
          onMouseLeave={() => setMarkHover(false)}
        >
          <Wordmark />
          <Scanline />
          <RegTicks snap={markHover} />
        </div>

        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: FADE_BIO_DELAY,
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="max-w-[58ch] text-center font-mono text-[16px] sm:text-[17px] leading-[1.75] text-[var(--fg)]"
        >
          Hi, I&apos;m Taylor. Builder from the Bay.{" "}
          <strong className="font-medium text-[var(--fg-peak)]">
            Repeat founder.
          </strong>{" "}
          Shipped startups from 0 → 1, gone deep on enterprise systems, now back
          to building. Mostly drawn to the parts other people skip, where taste
          compounds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: FADE_CTA_DELAY,
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="flex flex-col items-center gap-5 sm:flex-row sm:gap-8"
        >
          <ScrambleLink
            href="mailto:taylor@taylorallen.dev"
            className="hero-link hero-link--muted font-mono text-[15px] text-[var(--fg-muted)]"
          >
            taylor@taylorallen.dev
          </ScrambleLink>
        </motion.div>
      </div>
    </section>
  );
}

function Scanline() {
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0] }}
      transition={{
        delay: SCANLINE_DELAY,
        duration: 1.4,
        times: [0, 0.5, 1],
        ease: "easeInOut",
      }}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <motion.span
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{
          delay: SCANLINE_DELAY,
          duration: 1.4,
          ease: [0.65, 0, 0.35, 1],
        }}
        className="absolute inset-y-0 left-0 w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 38%, rgba(244,241,234,0.12) 46%, rgba(244,241,234,0.20) 50%, rgba(244,241,234,0.12) 54%, transparent 62%)",
          mixBlendMode: "screen",
        }}
      />
    </motion.span>
  );
}

function RegTicks({ snap }: { snap: boolean }) {
  const offset = snap ? 8 : 0;
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: REG_TICK_DELAY, duration: 0.7, ease: "easeOut" }}
      className="pointer-events-none absolute inset-0"
    >
      <RegTick className="top-0 left-0" d="M 0 7 L 0 0 L 7 0" tx={offset} ty={offset} />
      <RegTick className="top-0 right-0" d="M 9 0 L 16 0 L 16 7" tx={-offset} ty={offset} />
      <RegTick className="bottom-0 left-0" d="M 0 9 L 0 16 L 7 16" tx={offset} ty={-offset} />
      <RegTick className="right-0 bottom-0" d="M 9 16 L 16 16 L 16 9" tx={-offset} ty={-offset} />
    </motion.div>
  );
}

function RegTick({
  className,
  d,
  tx,
  ty,
}: {
  className: string;
  d: string;
  tx: number;
  ty: number;
}) {
  return (
    <svg
      className={`absolute h-4 w-4 ${className}`}
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

function Vignette() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0"
      style={{
        background:
          "radial-gradient(ellipse 75% 65% at 50% 48%, rgba(255,253,247,0.035) 0%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.7) 100%)",
      }}
    />
  );
}

function Grain() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.07] mix-blend-overlay"
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
