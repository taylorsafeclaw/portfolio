// components/conviction/Conviction.tsx

import { DensityResolve } from "@/components/story/DensityResolve";
import { SectionWrapper } from "@/components/shared/SectionWrapper";

const LEAD = [{ text: "I keep starting things." }];

const STATEMENTS = [
  {
    segments: [
      { text: "The best products come from people who care about" },
      { text: "the details nobody asked them to care about.", emphasis: true },
    ],
  },
  {
    segments: [
      { text: "Self-taught since middle school. No degree." },
      { text: "Everything I know, I learned by shipping.", emphasis: true },
    ],
  },
];

export function Conviction() {
  return (
    <SectionWrapper shape="bottom-up" className="flex justify-center">
      <section className="relative z-10 mx-auto w-full max-w-[44ch] px-6 py-16 sm:py-24">
        <div className="flex flex-col gap-20 sm:gap-24">
          <DensityResolve
            segments={LEAD}
            className="text-center font-[var(--font-serif)] italic text-[20px] leading-[1.6] text-[var(--fg-muted)] sm:text-[22px]"
          />
          {STATEMENTS.map((stmt, i) => (
            <DensityResolve
              key={i}
              segments={stmt.segments}
              className="text-center font-[var(--font-serif)] italic text-[18px] leading-[1.6] text-[var(--fg-muted)] sm:text-[20px]"
            />
          ))}
        </div>
      </section>
    </SectionWrapper>
  );
}
