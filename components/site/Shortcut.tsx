import Image from "next/image";
import Link from "next/link";

/**
 * "The shortcut to getting ahead" — Figma nodes 174:4097 (rest) and
 * 174:4169 (hover).
 *
 * The interaction is one move: the grey panel at the foot of each card grows
 * from 152px to 226px, sliding up over the photograph, and a line of
 * description appears in the space that opens between the title and the link.
 *
 * Two details make it smooth rather than steppy. The panel is anchored to the
 * bottom of the card and the card's height never changes, so nothing on the
 * page reflows — the panel simply covers more of the image. And the
 * description is revealed by animating a grid row from 0fr to 1fr instead of
 * animating a height, so the browser interpolates the real measured height of
 * whatever text is in there; no magic pixel numbers to keep in sync with the
 * copy, and no jump if a line wraps differently.
 *
 * Sizes inside the card are in container-query units against its 386px width
 * (32.346px of 386 is 8.38cqw), so a card that shrinks on a narrower screen
 * takes its type and padding down with it and keeps the design's proportions.
 */
type Card = {
  img: string;
  title: string;
  body: string;
  href: string;
};

const CARDS: Card[] = [
  {
    img: "/home/card-01.png",
    title: "Your resume, but smarter.",
    body: "Create an ATS-ready resume with AI guidance, better structure and premium templates.",
    href: "/signin?next=/app/resume",
  },
  {
    img: "/home/card-02.png",
    title: "Your next interview starts here.",
    body: "Practice with AI-powered mock interviews and know where you stand before the real one.",
    href: "/signin?next=/app/interviews",
  },
  {
    img: "/home/card-03.png",
    // The hover frame repeats card two's title here; this is the title the
    // rest-state frame gives, which is the one that matches the card.
    title: "Your career is bigger than a resume.",
    body: "More tools to help you navigate your next move.",
    href: "/signin?next=/app/agent",
  },
];

export function Shortcut() {
  return (
    <section className="bg-paper py-20 sm:py-[6.9vw]">
      <div className="mx-auto w-full max-w-[1200px] px-5">
        <h2
          className="text-center font-display font-medium tracking-[-0.02em] text-black"
          style={{ fontSize: "clamp(1.9rem, 3.785vw, 3.41rem)", lineHeight: 1.15 }}
        >
          The shortcut to getting ahead.
        </h2>
        <p
          className="mx-auto mt-4 max-w-[35.2rem] text-center font-display text-[#7e7e7e]"
          style={{ fontSize: "clamp(1rem, 1.667vw, 1.5rem)", lineHeight: 1.3 }}
        >
          Build a better resume. Practice real interviews. Make smarter career moves.
        </p>

        <ul className="mt-12 grid gap-[21px] sm:grid-cols-2 lg:mt-[5.5vw] lg:grid-cols-3">
          {CARDS.map((c) => (
            <li key={c.title} className="@container">
              <Link
                href={c.href}
                data-ev="cta_click"
                data-ev-location="shortcut"
                data-ev-label={c.title}
                className="group relative block aspect-[386/440] overflow-hidden rounded-[24px] bg-[#e2e2e2]"
              >
                <Image
                  src={c.img}
                  quality={90}
                  alt=""
                  width={386}
                  height={299}
                  sizes="(min-width: 1024px) 386px, (min-width: 640px) 45vw, 90vw"
                  className="absolute inset-x-0 top-0 w-full"
                />

                <div
                  className="absolute inset-x-0 bottom-0 bg-[#f5f5f5]"
                  style={{
                    paddingLeft: "9.31cqw",
                    paddingRight: "9.31cqw",
                    paddingTop: "5.74cqw",
                    paddingBottom: "8.03cqw",
                  }}
                >
                  <h3
                    className="font-display font-medium text-black"
                    style={{
                      fontSize: "clamp(1.1rem, 8.38cqw, 2.03rem)",
                      lineHeight: "clamp(1.2rem, 8.81cqw, 2.13rem)",
                      minHeight: "17.62cqw",
                    }}
                  >
                    {c.title}
                  </h3>

                  {/* 0fr → 1fr: the browser animates to the text's own height. */}
                  <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr]">
                    <div className="overflow-hidden">
                      <p
                        className="font-display text-[#6d6d6d] opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 group-hover:delay-150 group-focus-visible:opacity-100"
                        style={{
                          paddingTop: "3.4cqw",
                          fontSize: "clamp(0.8rem, 4.145cqw, 1rem)",
                          lineHeight: 1.35,
                        }}
                      >
                        {c.body}
                      </p>
                    </div>
                  </div>

                  <span
                    className="mt-[3.1cqw] inline-block font-display font-medium text-[#6d6d6d] underline underline-offset-[3px]"
                    style={{
                      fontSize: "clamp(0.8rem, 4.19cqw, 1.01rem)",
                      letterSpacing: "-0.025em",
                    }}
                  >
                    Get Started
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
