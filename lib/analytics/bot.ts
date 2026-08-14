/**
 * Client-side automation detection.
 *
 * This is the first of two gates. It catches headless browsers and driver-
 * controlled sessions before a single event is sent, which keeps both Google
 * Analytics and our own database clean. The server runs a second, independent
 * check on the user agent — see lib/analytics/bot-server.ts.
 *
 * Deliberately conservative: a false positive silently loses a real visitor,
 * so every signal here is one that a normal browser never produces.
 */

const AUTOMATION_UA =
  /HeadlessChrome|PhantomJS|Puppeteer|Playwright|Selenium|WebDriver|Electron\/|bot|crawler|spider|lighthouse|pagespeed|gtmetrix/i;

export function detectAutomation(): string | null {
  if (typeof window === "undefined") return "ssr";

  const nav = navigator as Navigator & {
    webdriver?: boolean;
    languages?: readonly string[];
  };

  // Set by every major automation driver.
  if (nav.webdriver) return "webdriver";

  if (AUTOMATION_UA.test(nav.userAgent)) return "ua";

  // Real browsers always report at least one language.
  if (!nav.languages || nav.languages.length === 0) return "no-languages";

  // Headless Chrome historically reports zero plugins AND no language list.
  // Checking both together avoids flagging privacy-hardened real browsers.
  if (
    /Chrome/.test(nav.userAgent) &&
    navigator.plugins?.length === 0 &&
    !nav.languages?.length
  ) {
    return "headless-chrome";
  }

  // Known automation globals injected into the page.
  const w = window as unknown as Record<string, unknown>;
  if (w.__nightmare || w._phantom || w.callPhantom || w.__selenium_unwrapped) {
    return "automation-global";
  }

  return null;
}

/**
 * True once the visitor has produced an input event a script wouldn't.
 * Used to mark a session "confirmed human" — page views still record before
 * this, so bounce data is not lost; the flag simply upgrades confidence.
 */
let humanConfirmed = false;

export function isHumanConfirmed() {
  return humanConfirmed;
}

export function watchForHumanInput() {
  if (typeof window === "undefined" || humanConfirmed) return;
  const mark = () => {
    humanConfirmed = true;
    for (const e of ["pointerdown", "keydown", "touchstart", "wheel", "scroll"]) {
      window.removeEventListener(e, mark);
    }
  };
  for (const e of ["pointerdown", "keydown", "touchstart", "wheel", "scroll"]) {
    window.addEventListener(e, mark, { once: true, passive: true });
  }
}
