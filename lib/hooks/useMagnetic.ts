"use client";

import { useEffect, useRef } from "react";

export function useMagnetic(radius: number = 200, maxDrift: number = 4) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const isTouchDevice = "ontouchstart" in window;
    if (isTouchDevice) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > radius) {
        el.style.transform = "";
        return;
      }

      const strength = 1 - dist / radius;
      const x = (dx / dist) * strength * maxDrift;
      const y = (dy / dist) * strength * maxDrift;
      el.style.transform = `translate(${x}px, ${y}px)`;
    };

    const handleLeave = () => {
      el.style.transform = "";
    };

    window.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, [radius, maxDrift]);

  return { ref };
}
