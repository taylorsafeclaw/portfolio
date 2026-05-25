import { HeaderDecode } from "@/components/shared/HeaderDecode";
import { DensityResolve } from "@/components/story/DensityResolve";
import { SectionWrapper } from "@/components/shared/SectionWrapper";

const SEGMENTS = [
  { text: "I started my first company at 19 — sole engineer, built the MVP, got it into PearX. Went deep on healthcare AI at Stanford, then co-founded an AI voice-agent platform and took it from zero to paying customers. Self-taught, no degree." },
  { text: "I keep shipping the parts other people skip.", emphasis: true },
];

export function Story() {
  return (
    <SectionWrapper shape="center-out" className="flex justify-center">
      <section className="relative z-10 mx-auto w-full max-w-[52ch] px-6 pt-24 pb-12 sm:px-10 sm:pt-32 sm:pb-16">
        <HeaderDecode text="about" className="mb-8" />
        <DensityResolve
          segments={SEGMENTS}
          className="text-center font-mono text-[16px] leading-[1.75] text-[var(--fg)] sm:text-[17px]"
        />
      </section>
    </SectionWrapper>
  );
}
