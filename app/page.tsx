import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { Shortcut } from "@/components/site/Shortcut";
import { Rulebook } from "@/components/site/Rulebook";
import { FreeTools } from "@/components/site/FreeTools";
import { Problem } from "@/components/site/Problem";
import { Questions } from "@/components/site/Questions";
import { LatestGuides } from "@/components/site/LatestGuides";
import { Faq } from "@/components/site/Faq";
import { FinalCta } from "@/components/site/FinalCta";
import { Footer } from "@/components/site/Footer";

// Regenerated every 5 minutes so newly published guides appear here on their own.
export const revalidate = 300;

export default function HomePage() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Shortcut />
        <Rulebook />
        <FreeTools />
        <Problem />
        <Questions />
        <LatestGuides />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
