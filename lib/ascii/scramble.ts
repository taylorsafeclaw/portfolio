const DEFAULT_CHARS = "·:-=+*#%";

function shouldPreserve(ch: string): boolean {
  return ch === " " || ch === "@" || ch === "." || ch === "→" || ch === "-";
}

export function scrambleText(
  text: string,
  progress: number,
  chars: string = DEFAULT_CHARS,
): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (shouldPreserve(ch)) {
      out += ch;
      continue;
    }
    const unlock = i / Math.max(1, text.length - 1);
    if (progress >= unlock) {
      out += ch;
    } else {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return out;
}
