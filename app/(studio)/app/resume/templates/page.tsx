import { redirect } from "next/navigation";

/**
 * The template gallery used to be a screen of its own. It now sits on the
 * resume page itself, next to the document the templates are shown with —
 * picking one was never a destination, it was a step in looking at your own
 * resume. This exists only so the links already shared to the old address,
 * including the one in the site footer, still land somewhere.
 */
export default function TemplatesRedirect(): never {
  redirect("/app/resume");
}
