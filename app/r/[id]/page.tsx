import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/supabase/app";
import { DesignPage, DesignStyles } from "@/components/app/DesignPage";
import { getShared } from "@/lib/app/resume-store";
import { designIsEmpty } from "@/lib/app/design";
import { seedDesign } from "@/lib/app/design-seed";

export const dynamic = "force-dynamic";

/**
 * Somebody else's resume, at the link they sent you.
 *
 * Outside `/app`, and readable with no account: a sign-in wall on a link that
 * was shared with somebody is the fastest way to make the link useless. What
 * it does carry is a thin bar — the name of the place this came from, and a
 * way in — because a page with no chrome at all reads as a leak rather than as
 * something deliberately published, and because a recruiter who likes the
 * document is exactly the person worth showing a door to.
 *
 * Nothing here is indexed. The address is unguessable and the person sharing
 * it chose who to send it to; a search engine finding it would make that
 * choice meaningless, and `noindex` is what says so to the crawlers that
 * respect it. It is not a substitute for the switch being off by default.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function SharedResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // The session is read first, because whether this person may edit depends on
  // the address they are signed in as — and that is the one thing the browser
  // is not allowed to assert about itself.
  const viewer = await getSessionUser();
  const shared = await getShared(id, viewer?.email ?? null);

  // A withdrawn link and a link that never existed are the same 404 on
  // purpose. Telling the difference would confirm that a resume is there,
  // which is exactly what switching sharing off was meant to stop.
  if (!shared) notFound();

  // A row from before the canvas editor has no design; it is rendered from the
  // same seeder the builder uses, so a link shared last month still opens and
  // still looks like the document the owner remembers.
  const design =
    shared.design && !designIsEmpty(shared.design)
      ? shared.design
      : seedDesign(shared.content, shared.template);

  return (
    <main className="min-h-screen bg-[#f4f4f5] print:bg-white">
      <header className="no-print sticky top-0 z-10 border-b border-black/[0.07] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[900px] items-center justify-between gap-6 px-5">
          <Link href="/" className="text-[0.9rem] font-semibold tracking-[-0.04em]">
            Cheatcode
          </Link>

          <div className="flex items-center gap-4 text-[0.82rem]">
            {shared.canEdit && (
              <Link
                href={`/r/${id}/edit`}
                className="rounded-full bg-black px-4 py-1.5 font-semibold text-white transition-transform hover:scale-[1.03]"
              >
                Edit this resume
              </Link>
            )}

            {viewer ? (
              <Link
                href="/app/resume"
                className={
                  shared.canEdit
                    ? "text-black/50 transition-colors hover:text-black"
                    : "rounded-full bg-black px-4 py-1.5 font-semibold text-white transition-transform hover:scale-[1.03]"
                }
              >
                Your resumes
              </Link>
            ) : (
              <>
                <Link href="/signin" className="text-black/50 transition-colors hover:text-black">
                  Sign in
                </Link>
                <Link
                  href="/signin"
                  className="rounded-full bg-black px-4 py-1.5 font-semibold text-white transition-transform hover:scale-[1.03]"
                >
                  Build yours free
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <DesignStyles />

      <div className="flex flex-col items-center gap-6 py-8 print:gap-0 print:py-0">
        {design.pages.map((p) => (
          <div
            key={p.id}
            className="w-fit shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_-12px_rgba(0,0,0,0.18)] print:shadow-none"
          >
            <DesignPage page={p} />
          </div>
        ))}

        <p className="no-print mx-auto mt-6 max-w-[62ch] px-5 text-center text-[0.82rem] leading-relaxed text-black/40">
          {shared.canEdit ? (
            <>
              Shared from Cheatcode — {shared.title}. You can change this one
              {shared.grantedBy === "invite" ? ", because you were invited to." : "."}
            </>
          ) : shared.linkRole === "edit" && !viewer ? (
            <>
              Shared from Cheatcode — {shared.title}. Whoever holds this link can edit it, but you
              have to{" "}
              <Link href="/signin" className="underline underline-offset-2">
                sign in
              </Link>{" "}
              first, so the change has a name on it.
            </>
          ) : (
            <>Shared from Cheatcode. This is a read-only copy — {shared.title}.</>
          )}
        </p>
      </div>
    </main>
  );
}
