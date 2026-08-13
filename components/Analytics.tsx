"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Records a page view on every route change. First-party only — the data
 * goes to our own Supabase table, never to a third party, and no cookies
 * are set. The session id lives in sessionStorage so it dies with the tab.
 */
function sessionId() {
  try {
    const KEY = "cc_sid";
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function Analytics() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    last.current = pathname;

    const payload = JSON.stringify({
      path: pathname,
      referrer: document.referrer || "",
      sessionId: sessionId(),
    });

    // keepalive so the request survives the user navigating away immediately
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      /* never let analytics break the page */
    });
  }, [pathname]);

  return null;
}
