import { Hero } from "@/components/hero/Hero";
import { Story } from "@/components/story/Story";
import { SelectedWork } from "@/components/work/SelectedWork";
import { Conviction } from "@/components/conviction/Conviction";
import { Footer } from "@/components/footer/Footer";
import { BorderBeam } from "@/components/shared/BorderBeam";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col">
      <Hero />
      <BorderBeam />
      <Story />
      <BorderBeam />
      <SelectedWork />
      <BorderBeam />
      <Conviction />
      <BorderBeam />
      <Footer />
    </main>
  );
}
