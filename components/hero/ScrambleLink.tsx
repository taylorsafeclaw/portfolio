"use client";

import { type AnchorHTMLAttributes } from "react";
import { useScrambleWalk } from "@/lib/hooks/useScrambleWalk";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { children: string };

export function ScrambleLink({ children, onMouseMove, onFocus, onBlur, ...rest }: Props) {
  const walk = useScrambleWalk(children);

  return (
    <a
      {...rest}
      onMouseMove={(e) => {
        walk.onMouseMove(e);
        onMouseMove?.(e);
      }}
      onFocus={(e) => {
        walk.onFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        walk.onBlur();
        onBlur?.(e);
      }}
    >
      {walk.display}
    </a>
  );
}
