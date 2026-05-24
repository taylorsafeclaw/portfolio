"use client";

import { StaticMeshGradient } from "@paper-design/shaders-react";

export function Substrate() {
  return (
    <StaticMeshGradient
      colors={["#0a0a0a", "#0c0b09", "#09090b", "#0b0a0a"]}
      waveX={0.35}
      waveY={0.35}
      mixing={1}
      grainOverlay={0.08}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
      }}
    />
  );
}
