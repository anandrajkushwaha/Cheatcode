"use client";

import { useEffect, useState } from "react";
import { PayButton } from "@/components/studio/PayButton";

/**
 * The bar that follows you down the page.
 *
 * It appears only once the hero's button has scrolled away, which is the
 * difference between a helpful bar and one that covers content while the
 * identical button is still on screen a few pixels above it.
 *
 * It renders the same PayButton as the hero rather than a link back up to it:
 * sending somebody to the top of a page they have just read in order to press
 * a button they can already see is a small insult.
 */

export function ProStickyBar({
  name,
  email,
  contact,
}: {
  name: string | null;
  email: string | null;
  contact: string | null;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 340px is a little past the hero's own button at every breakpoint.
    const onScroll = () => setShow(window.scrollY > 340);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!show}
      inert={!show}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink-08 bg-paper/95 backdrop-blur-xl transition-transform duration-300 ${
        show ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-[1120px] items-center justify-center px-4 py-4">
        <PayButton
          label="Get Pro"
          variant="dark"
          name={name}
          email={email}
          contact={contact}
        />
      </div>
    </div>
  );
}
