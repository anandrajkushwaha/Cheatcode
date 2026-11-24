"use client";

import { useEffect } from "react";

/**
 * On /resume-builder: send a guest who is mid-download back into the editor.
 *
 * Before Release A, the guest builder lived at /resume-builder and its Google
 * sign-in came back to that URL. It now lives at /resume-builder/create and
 * comes back there, but a tab that loaded the old builder before the deploy
 * still carries `next=/resume-builder`, and would land on this landing page
 * with a finished resume waiting to download. So: if this browser holds a
 * guest resume whose Download was tapped (GuestBuilder's `download: true`)
 * and a Supabase session cookie is present, the person has just signed in to
 * download — open the editor, which hands the resume over and downloads it.
 *
 * Both conditions, so nobody else is ever moved: a visitor who abandoned a
 * draft but is not signed in, and every crawler (no storage, no cookie), see
 * the landing page as it is.
 */
const STORE = "cc_guest_resume";

export function BuilderReturn() {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return;
      const saved = JSON.parse(raw) as { download?: boolean };
      const signedIn = /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/.test(document.cookie);
      if (saved?.download === true && signedIn) window.location.replace("/resume-builder/create");
    } catch {
      /* storage blocked: nothing to hand over */
    }
  }, []);
  return null;
}
