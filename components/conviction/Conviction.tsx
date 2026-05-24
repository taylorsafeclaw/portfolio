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
      { text: "Self-taught since middle school. No degree." },
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
