import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { Problem } from "@/components/site/Problem";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Mentors } from "@/components/site/Mentors";
import { Questions } from "@/components/site/Questions";
import { Difference } from "@/components/site/Difference";
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
        <Problem />
        <HowItWorks />
        <Questions />
        <Mentors />
        <Difference />
        <LatestGuides />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
