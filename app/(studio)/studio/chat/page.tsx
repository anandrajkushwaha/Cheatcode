import { redirect } from "next/navigation";

/**
 * There is no separate "new chat" screen.
 *
 * The studio home *is* the empty state of a conversation, so this path exists
 * only to catch anything still pointing at it — an old link, a bookmark — and
 * send it to the one screen that does the job.
 */
export default function Page() {
  redirect("/studio");
}
