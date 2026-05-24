import { Hero } from "@/components/hero/Hero";
import { SelectedWork } from "@/components/work/SelectedWork";
import { Footer } from "@/components/footer/Footer";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col">
      <Hero />
      <SelectedWork />
      <Footer />
    </main>
  );
}
