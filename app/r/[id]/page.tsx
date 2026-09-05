import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ResumeDocument } from "@/components/app/ResumeDocument";
import { getShared } from "@/lib/app/resume-store";

export const dynamic = "force-dynamic";

/**
 * Somebody else's resume, at the link they sent you.
 *
 * Deliberately outside `/app`: no session, no navigation, no product around
 * it. A recruiter opening this should get the document and nothing else — a
 * sign-in wall on a link that was shared with them is the fastest way to make
 * the link useless.
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
  const shared = await getShared(id);

  // A withdrawn link and a link that never existed are the same 404 on
  // purpose. Telling the difference would confirm that a resume is there,
  // which is exactly what switching sharing off was meant to stop.
  if (!shared) notFound();

  return (
    <main className="min-h-screen bg-[#f4f4f5] py-8 print:bg-white print:py-0">
      <div className="mx-auto w-fit bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_-12px_rgba(0,0,0,0.18)] print:shadow-none">
        <ResumeDocument
          content={shared.content}
          template={shared.template}
          styles={shared.styles}
          photo={shared.photo}
        />
      </div>
    </main>
  );
}
