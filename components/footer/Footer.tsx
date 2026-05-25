"use client";

import { ScrambleLink } from "@/components/hero/ScrambleLink";
import { DensityResolve } from "@/components/story/DensityResolve";
import { useMagnetic } from "@/lib/hooks/useMagnetic";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { SectionWrapper } from "@/components/shared/SectionWrapper";

const TAGLINE_SEGMENTS = [{ text: "Let's build something." }];

export function Footer() {
  const { ref: magneticRef } = useMagnetic(200, 4);
  const reduced = useReducedMotion();

  return (
    <SectionWrapper shape="edges-in">
      <footer className="relative z-10 mx-auto w-full max-w-[52ch] px-6 pt-16 pb-8 text-center sm:px-10 sm:pt-24 sm:pb-10">
        <DensityResolve
          segments={TAGLINE_SEGMENTS}
          className="mb-6 font-mono text-[14px] text-[var(--fg)] sm:text-[15px]"
        />

        <div className="mb-8">
          {/* Magnetic wrapper — ScrambleLink does not forward refs */}
          <span
            ref={magneticRef as React.RefObject<HTMLSpanElement>}
            style={{
              display: "inline-block",
              transition: reduced ? undefined : "transform 150ms ease",
            }}
          >
            <ScrambleLink
              href="mailto:taylor@taylorallen.dev"
              className="font-mono text-[15px] text-[var(--fg-peak)] sm:text-[16px]"
            >
              taylor@taylorallen.dev
            </ScrambleLink>
          </span>
        </div>

        <p className="font-mono text-[11px] text-[var(--fg-quiet)]">
          <span>Taylor Allen</span>
          <span className="mx-2 text-[var(--fg-quietest)]" aria-hidden>·</span>
          <span>2026</span>
          <span className="mx-2 text-[var(--fg-quietest)]" aria-hidden>·</span>
          <span>Bay Area</span>
        </p>
      </footer>
    </SectionWrapper>
  );
}
