"use client";

import { useEffect, useRef, useState } from "react";

interface MagneticOffset {
  x: number;
  y: number;
}

export function useMagnetic(
  radius: number = 200,
  maxDrift: number = 4,
) {
  const ref = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState<MagneticOffset>({ x: 0, y: 0 });

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
        setOffset({ x: 0, y: 0 });
        return;
      }

      const strength = 1 - dist / radius;
      setOffset({
        x: (dx / dist) * strength * maxDrift,
        y: (dy / dist) * strength * maxDrift,
      });
    };

    const handleLeave = () => setOffset({ x: 0, y: 0 });

    window.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, [radius, maxDrift]);

  return { ref, offset };
}
