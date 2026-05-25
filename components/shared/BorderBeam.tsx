// components/shared/BorderBeam.tsx

interface Props {
  className?: string;
}

export function BorderBeam({ className = "" }: Props) {
  return (
    <div
      className={`relative h-px w-full overflow-hidden ${className}`}
      style={{ backgroundColor: "var(--border)", containerType: "inline-size" }}
      aria-hidden
    >
      <span
        className="border-beam-char absolute left-0 top-1/2 -translate-y-1/2 font-mono text-[10px] text-[var(--fg-quietest)]"
        style={{
          animation: "border-beam-slide 6000ms linear infinite",
          willChange: "transform",
        }}
      >
        ░
      </span>
    </div>
  );
}
