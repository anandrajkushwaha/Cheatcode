import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { Problem } from "@/components/site/Problem";
import { WhatYouGet } from "@/components/site/WhatYouGet";
import { Plans } from "@/components/site/Plans";
import { Mentors } from "@/components/site/Mentors";
import { Questions } from "@/components/site/Questions";
import { Difference } from "@/components/site/Difference";
import { ResumeTool } from "@/components/site/ResumeTool";
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
        {/*
          Order follows the sign-up decision, not the story we like telling.
          What you get, then the one place most people are actually losing,
          then the questions the agent is for, then the price — so nothing
          costs money without having been named first. Mentors come after all
          of that, because they are the one thing on this page that is a plan
          rather than a product.
        */}
        <ResumeTool />
        <WhatYouGet />
        <Questions />
        <Plans />
        <Difference />
        <Mentors />
        <LatestGuides />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
