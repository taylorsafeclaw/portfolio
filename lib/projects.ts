export interface Project {
  title: string;
  description: string;
  density: "█" | "▓" | "▒";
  year: string;
  href?: string;
}

export const projects: Project[] = [
  {
    title: "odisai",
    description: "co-founded an AI voice-agent platform for vet clinics. built end-to-end solo. 5 paying customers live in production.",
    density: "█",
    year: "2025 — 2026",
  },
  {
    title: "stanford health care",
    description: "solutions architect, AI. built an internal clinical note-taking tool. contributed to ChatEHR pilot.",
    density: "▓",
    year: "2024 — 2025",
  },
  {
    title: "poppin",
    description: "sole engineer on a social events app. built the MVP in two months. pear-backed. ~$2M seed. exited.",
    density: "▒",
    year: "2021 — 2022",
  },
];
