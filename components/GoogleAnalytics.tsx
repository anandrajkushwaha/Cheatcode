"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { detectAutomation, watchForHumanInput } from "@/lib/analytics/bot";
import { isOwner } from "@/lib/analytics/events";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-TZC69SKP8W";

/**
 * Loads GA4 — but only after the client has passed the automation check.
 *
 * Loading gtag inside an effect rather than at import time means a headless
 * browser never downloads the script and never registers a session, so the
 * GA property only ever sees real traffic. GA's own bot filter runs on top
 * of this; the two together are what keep the numbers trustworthy.
 *
 * Automatic page_view is disabled: this is a single-page app, so page views
 * are fired manually on route change (see components/Analytics.tsx).
 *
 * The script is also never loaded inside the admin panel, so your own
 * back-office work can't register as a GA4 session in the first place.
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Not loading gtag at all is stronger than not firing events: without the
    // script there is no session, no engagement time, and no user count.
    if (isAdmin || isOwner()) return;
    const reason = detectAutomation();
    window.__ccBot = reason;
    if (reason) return;
    watchForHumanInput();
    setAllowed(true);
  }, [isAdmin]);

  if (isAdmin || !allowed || !GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}', {
            send_page_view: false,
            anonymize_ip: true
          });
        `}
      </Script>
    </>
  );
}
