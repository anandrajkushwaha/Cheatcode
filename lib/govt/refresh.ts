import "server-only";
import { revalidatePath } from "next/cache";
import { KIND_SLUG, NOTICE_KINDS } from "@/lib/govt/types";

/**
 * Throw away the cached government pages, now that something changed.
 *
 * Without this the posting works perfectly and nobody can tell. These pages
 * are rendered once and then re-rendered on a timer, so a notice posted at
 * 11:02 leaves /government-jobs serving the page it was built with — and when
 * that page is empty it says "nothing published yet", which is exactly the
 * wrong thing to be telling somebody the moment a notice lands.
 *
 * Everything is revalidated rather than only the page that obviously changed.
 * The reason is the lifecycle: a single recruitment's last date decides which
 * of /closing-soon, /closed and /dates-not-stated it belongs on, so editing
 * one date can change three lists plus the hub. Working out which three is
 * guesswork that gets it wrong quietly; revalidating ten cheap pages does not.
 */
export function refreshGovt(examSlug?: string | null): void {
  try {
    revalidatePath("/government-jobs");
    for (const k of NOTICE_KINDS) revalidatePath(`/government-jobs/${KIND_SLUG[k]}`);
    revalidatePath("/government-jobs/closing-soon");
    revalidatePath("/government-jobs/closed");
    revalidatePath("/government-jobs/dates-not-stated");
    if (examSlug) revalidatePath(`/government-jobs/${examSlug}`);
    revalidatePath("/sitemap.xml");
  } catch {
    // revalidatePath needs a request context, and there are callers — a
    // script, a test — that have none. A cache that stays warm a few minutes
    // longer is not worth failing a save that otherwise succeeded over.
  }
}
