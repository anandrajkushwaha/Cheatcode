"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { detectAutomation } from "@/lib/analytics/bot";
import { isOwner } from "@/lib/analytics/events";
import { META_PIXEL_ID, metaPageView } from "@/lib/analytics/meta";

/**
 * Loads the Meta Pixel on the public site and the app — not on /admin, not
 * for our own browsers, not for bots — and sends a PageView on every route
 * change. Meta's own snippet only counts the first page; in a single-page app
 * every later screen would otherwise be invisible to it.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isAdmin || isOwner() || !META_PIXEL_ID) return;
    if (window.__ccBot ?? detectAutomation()) return;
    setAllowed(true);
  }, [isAdmin]);

  // One PageView per screen, queued until the pixel is ready.
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    metaPageView();
  }, [pathname]);

  if (isAdmin || !allowed || !META_PIXEL_ID) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${META_PIXEL_ID}');
        // Replay whatever was tracked before this ran — including the first
        // PageView, which the queue already holds.
        (window.__metaQueue || []).splice(0).forEach(function (a) { fbq.apply(null, a); });
      `}
    </Script>
  );
}
