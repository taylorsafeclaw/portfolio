import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6">
      <p className="font-mono text-[14px] text-[var(--fg-strong)]">
        404 &mdash; this page didn&apos;t ship
      </p>
      <Link
        href="/"
        className="mt-4 font-mono text-[12px] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg-strong)]"
      >
        &larr; back to taylorallen.dev
      </Link>
    </main>
  );
}
