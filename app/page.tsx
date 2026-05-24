import { Footer } from "@/components/footer/Footer";
import { Hero } from "@/components/hero/Hero";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col">
      <Hero />
      <Footer />
    </main>
  );
}
