"use client";

import { ScrambleLink } from "@/components/hero/ScrambleLink";

const SEPARATOR = "·";

const PARTS = [
  { kind: "text" as const, value: "Taylor Allen" },
  { kind: "text" as const, value: "2026" },
  { kind: "text" as const, value: "Bay Area" },
  {
    kind: "link" as const,
    value: "taylor@taylorallen.dev",
    href: "mailto:taylor@taylorallen.dev",
  },
];

export function Footer() {
  return (
    <footer className="relative z-10 px-6 pt-10 pb-6 font-mono text-[11px] leading-none text-[var(--fg-quiet)] sm:px-10 sm:pt-16 sm:pb-8">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {PARTS.map((part, i) => (
          <span key={i} className="flex items-center gap-x-2">
            {i > 0 && (
              <span aria-hidden className="text-[var(--fg-quietest)]">
                {SEPARATOR}
              </span>
            )}
            {part.kind === "link" ? (
              <ScrambleLink
                href={part.href}
                className="transition-colors hover:text-[var(--fg-strong)] focus-visible:text-[var(--fg-strong)]"
              >
                {part.value}
              </ScrambleLink>
            ) : (
              <span>{part.value}</span>
            )}
          </span>
        ))}
      </p>
    </footer>
  );
}
