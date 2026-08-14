"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { detectAutomation, watchForHumanInput } from "@/lib/analytics/bot";

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
 */
export function GoogleAnalytics() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const reason = detectAutomation();
    window.__ccBot = reason;
    if (reason) return;
    watchForHumanInput();
    setAllowed(true);
  }, []);

  if (!allowed || !GA_ID) return null;

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
