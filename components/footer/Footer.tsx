const SEPARATOR = "·";

export function Footer() {
  const parts = [
    { kind: "text", value: "Taylor Allen" },
    { kind: "text", value: "2026" },
    { kind: "text", value: "Bay Area" },
    {
      kind: "link",
      value: "taylor@taylorallen.dev",
      href: "mailto:taylor@taylorallen.dev",
    },
  ] as const;

  return (
    <footer className="px-6 pt-16 pb-8 text-[11px] leading-none font-mono text-fg-quiet sm:px-10">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {parts.map((part, i) => (
          <span key={i} className="flex items-center gap-x-2">
            {i > 0 && (
              <span aria-hidden className="text-fg-quietest">
                {SEPARATOR}
              </span>
            )}
            {part.kind === "link" ? (
              <a
                href={part.href}
                className="transition-colors hover:text-fg-strong focus-visible:text-fg-strong"
              >
                {part.value}
              </a>
            ) : (
              <span>{part.value}</span>
            )}
          </span>
        ))}
      </p>
    </footer>
  );
}
