import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/app";
import { ResumeEditor } from "@/components/app/ResumeEditor";
import { getShared } from "@/lib/app/resume-store";
import { DEFAULT_TEMPLATE } from "@/lib/app/resume-templates";

export const dynamic = "force-dynamic";

/**
 * Somebody else's resume, open for editing.
 *
 * The same editor as the owner's, with two differences and no third: saves go
 * through `/api/app/resume/shared`, and there is no Share button. Everything
 * else is identical on purpose — a cut-down editor for guests would mean two
 * renderers that could disagree about what the document looks like, which is
 * the bug that costs somebody an interview rather than a support ticket.
 *
 * The grant is checked here *and* again on every save. Checking only here
 * would mean a guest whose access was revoked mid-session could keep writing
 * from a tab they already had open.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function SharedResumeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getSessionUser();
  const shared = await getShared(id, viewer?.email ?? null);

  if (!shared) notFound();

  // Signed out, on a link that does grant editing: this is not a refusal, it
  // is a missing step. Say which step.
  if (!shared.canEdit) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f4f5] px-5">
        <div className="max-w-[46ch] text-center">
          <h1 className="text-xl font-semibold tracking-[-0.03em]">
            {shared.linkRole === "edit" && !viewer ? "Sign in to edit this resume" : "You can read this one"}
          </h1>
          <p className="mt-2.5 text-[0.9rem] leading-relaxed text-black/50">
            {shared.linkRole === "edit" && !viewer
              ? "Editing needs an account, so every change has a name attached to it. Signing in takes a moment and brings you straight back here."
              : "This link was shared with you to read. Ask whoever sent it to give you editing access — they can do it from the Share panel, by your email address."}
          </p>

          <div className="mt-6 flex justify-center gap-3 text-[0.85rem]">
            <Link
              href={`/r/${id}`}
              className="rounded-full border border-black/15 px-4 py-2 font-medium transition-colors hover:border-black"
            >
              View the resume
            </Link>
            {!viewer && (
              <Link
                href="/signin"
                className="rounded-full bg-black px-4 py-2 font-semibold text-white transition-transform hover:scale-[1.03]"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <ResumeEditor
      draftId={shared.draftId}
      initial={shared.content}
      template={shared.template || DEFAULT_TEMPLATE}
      title={shared.title}
      shareId={id}
      isPublic
      initialStyles={shared.styles}
      initialPhoto={shared.photo}
      sharedAs={id}
    />
  );
}
