"use client";

import { useState } from "react";
import { projects } from "@/lib/projects";
import { WorkCard } from "@/components/work/WorkCard";
import { HeaderDecode } from "@/components/shared/HeaderDecode";
import { useInView } from "@/lib/hooks/useInView";

export function SelectedWork() {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.15 });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      id="selected-work"
      className="relative z-10 mx-auto w-full max-w-[64ch] px-6 pt-16 pb-12 sm:px-10 sm:pt-24 sm:pb-16"
    >
      <HeaderDecode text="selected work" className="mb-8" />

      <div className="flex flex-col">
        {projects.map((project, i) => (
          <div key={project.title}>
            <WorkCard
              project={project}
              focused={hoveredIndex === null || hoveredIndex === i}
              onHover={() => setHoveredIndex(i)}
              onLeave={() => setHoveredIndex(null)}
              visible={inView}
              index={i}
            />
            {i < projects.length - 1 && (
              <div
                className="h-px w-full"
                style={{ backgroundColor: "var(--border)" }}
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
