/**
 * The complete event taxonomy. Every event the site fires is listed here —
 * if it isn't in this file it isn't tracked, and nothing fires an ad-hoc
 * string. Each event goes to two places at once: Google Analytics 4 and our
 * own database, so the numbers can always be checked against each other.
 */
export const EVENTS = {
  // --- page lifecycle ---
  PAGE_VIEW: "page_view",
  SCROLL_DEPTH: "scroll_depth", // params: percent
  TIME_ON_PAGE: "time_on_page", // params: seconds (fired on leave)

  // --- navigation ---
  NAV_CLICK: "nav_click", // params: label, location
  INTERNAL_LINK_CLICK: "internal_link_click", // params: label (href)
  OUTBOUND_CLICK: "outbound_click", // params: label (host)
  FOOTER_CLICK: "footer_click",

  // --- conversion ---
  CTA_VIEW: "cta_view", // a CTA scrolled into view
  CTA_CLICK: "cta_click", // params: location, label
  WAITLIST_START: "waitlist_start", // first keystroke in the email field
  WAITLIST_SUBMIT: "waitlist_submit",
  WAITLIST_SUCCESS: "waitlist_success",
  WAITLIST_ERROR: "waitlist_error", // params: label (reason)

  // --- tools ---
  TOOL_VIEW: "tool_view", // params: label (tool slug)
  TOOL_COMPUTE: "tool_compute", // params: label, value
  TOOL_INPUT: "tool_input", // params: label (field)
  TOOL_RESULT_CTA: "tool_result_cta", // params: label

  // --- content ---
  ARTICLE_VIEW: "article_view", // params: label (slug), location (category)
  ARTICLE_READ: "article_read", // params: value (percent)
  TOC_CLICK: "toc_click",
  FAQ_OPEN: "faq_open", // params: label (question)
  RELATED_POST_CLICK: "related_post_click",
  CATEGORY_CLICK: "category_click",
  SHARE_CLICK: "share_click",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export type EventParams = {
  label?: string;
  location?: string;
  value?: number;
  [key: string]: string | number | boolean | undefined;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    __ccBot?: string | null;
  }
}

/**
 * Persistent, first-party visitor id. Lives in localStorage, so it survives
 * across sessions and tabs — that is what separates "unique users" from
 * "sessions". No cookie is set and nothing leaves your own domain.
 */
function visitorId() {
  try {
    const KEY = "cc_vid";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = "v" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

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

/**
 * The admin panel is a tool, not the product — nothing that happens inside it
 * is site traffic. It is cut off here, at the single point every event passes
 * through, rather than only on the server. That matters because GA4 is written
 * to directly from the browser and never sees our server-side filter.
 */
function isAdminSurface() {
  try {
    return window.location.pathname.startsWith("/admin");
  } catch {
    return false;
  }
}

/**
 * Your own browsing, anywhere on the site.
 *
 * The server drops these hits too, but this check has to exist on the client
 * as well — Google Analytics is written to directly from the browser and never
 * passes through our server, so a server-side filter alone would leave every
 * page you visit sitting in the GA4 property.
 *
 * Set by signing in to the admin panel, or by opening
 * /api/analytics/exclude?on=1 on any device.
 */
export function isOwner() {
  try {
    return document.cookie.split("; ").some((c) => c === "cc_owner=1");
  } catch {
    return false;
  }
}

/**
 * Fire an event. Safe to call anywhere — it no-ops during SSR, and it never
 * throws, because analytics must never be able to break a page.
 */
export function track(event: EventName, params: EventParams = {}) {
  if (typeof window === "undefined") return;

  // Automation detected on this client: send nothing, anywhere.
  if (window.__ccBot) return;

  // Your own traffic is never counted — not in GA4, not in our database.
  if (isAdminSurface() || isOwner()) return;

  try {
    window.gtag?.("event", event, params);
  } catch {
    /* GA blocked by an extension — our own tracking still runs */
  }

  try {
    const body = JSON.stringify({
      kind: "event",
      event,
      path: window.location.pathname,
      label: params.label,
      location: params.location,
      value: typeof params.value === "number" ? params.value : undefined,
      params,
      referrer: document.referrer || "",
      sessionId: sessionId(),
      visitorId: visitorId(),
    });

    // sendBeacon survives the page unloading; fetch is the fallback.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* never let analytics break the page */
  }
}

export function trackPageView(path: string) {
  if (typeof window === "undefined" || window.__ccBot) return;
  if (path.startsWith("/admin") || isAdminSurface() || isOwner()) return;
  try {
    window.gtag?.("event", "page_view", {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  } catch {
    /* ignore */
  }

  try {
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "pageview",
        path,
        referrer: document.referrer || "",
        sessionId: sessionId(),
        visitorId: visitorId(),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
