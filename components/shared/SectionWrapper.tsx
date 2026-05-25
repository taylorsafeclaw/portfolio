// components/shared/SectionWrapper.tsx

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useInView } from "@/lib/hooks/useInView";
import type { ErosionZone } from "@/lib/ascii/density";

// Shared mutable store for active erosion zones — read by AsciiGrid each frame
export const erosionZones: ErosionZone[] = [];

interface Props {
  children: ReactNode;
  shape: ErosionZone["shape"];
  className?: string;
}

export function SectionWrapper({ children, shape, className = "" }: Props) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.05, once: false });
  const zoneRef = useRef<ErosionZone>({
    centerX: 0,
    centerY: 0,
    radius: 0,
    progress: 0,
    shape,
  });

  // Register/unregister this zone in the shared array
  useEffect(() => {
    const zone = zoneRef.current;
    erosionZones.push(zone);
    return () => {
      const idx = erosionZones.indexOf(zone);
      if (idx >= 0) erosionZones.splice(idx, 1);
    };
  }, []);

  // Update zone geometry on scroll/resize
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const zone = zoneRef.current;
      zone.centerX = rect.left + rect.width / 2;
      zone.centerY = rect.top + rect.height / 2;
      zone.radius = Math.max(rect.width, rect.height) / 2;
    };

    update();
    let pending = false;
    const throttledUpdate = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        update();
      });
    };
    window.addEventListener("scroll", throttledUpdate, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", throttledUpdate);
      window.removeEventListener("resize", update);
    };
  }, [ref]);

  // Lerp zone.progress toward target (0 or 1) so erosion fades in/out smoothly
  useEffect(() => {
    const zone = zoneRef.current;
    const target = inView ? 1 : 0;
    let raf: number;

    const tick = () => {
      const diff = target - zone.progress;
      if (Math.abs(diff) < 0.002) {
        zone.progress = target;
        return;
      }
      zone.progress += diff * 0.06;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView]);

  return (
    <div ref={ref} className={`relative z-10 ${className}`}>
      {children}
    </div>
  );
}
