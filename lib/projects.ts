export interface Project {
  title: string;
  description: string;
  density: "█" | "▓" | "▒";
  year: string;
  href?: string;
}

export const projects: Project[] = [
  {
    title: "poppin",
    description: "social events app · co-founder & cto · pear-backed · exited",
    density: "█",
    year: "2021–2023",
    href: "#",
  },
  {
    title: "stanford health care",
    description: "enterprise architecture · reference architecture author · arb",
    density: "▓",
    year: "2023–2025",
    href: "#",
  },
  {
    title: "current build",
    description: "ai/llm tooling · building in public · shipping",
    density: "▒",
    year: "2025–",
    href: "#",
  },
];
