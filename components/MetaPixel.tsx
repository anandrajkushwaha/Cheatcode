"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { META_PIXEL_ID, metaPageView } from "@/lib/analytics/meta";

/**
 * The Meta Pixel.
 *
 * The base code is a plain <script> in the server-rendered <head> (see
 * app/layout.tsx and lib/analytics/meta-snippet.ts), as Meta ships it. It used to be injected only after a
 * client-side bot check, which kept automated visits out but also meant the
 * code was invisible in the page source and never ran for any checker —
 * Meta's diagnostics, Pixel Helper in a scripted browser, a plain curl. Meta
 * filters bot traffic on its side, so the snippet now loads for everyone
 * except two cases, checked before anything is fetched:
 *
 *   /admin/*          the back office is never measured
 *   cc_owner cookie   our own browsers (admin login, the exclude link, the
 *                     analytics-excluded accounts) — so testing does not
 *                     count as ad results
 *
 * The snippet sends the first PageView itself. This component sends one for
 * every later screen, because navigation inside the app does not reload the
 * page and Meta's code would otherwise never see it.
 */

export function MetaPixel() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    // The first page's PageView was sent by the snippet in <head>.
    if (first.current) {
      first.current = false;
      return;
    }
    if (!pathname || pathname.startsWith("/admin")) return;
    metaPageView();
  }, [pathname]);

  if (!META_PIXEL_ID) return null;

  return (
    <>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
