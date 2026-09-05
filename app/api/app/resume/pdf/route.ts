import { getSessionUser } from "@/lib/supabase/app";
import { getDraftById, getShared, StoreError } from "@/lib/app/resume-store";
import { designHtml, pdfFileName } from "@/lib/app/design-html";
import { designIsEmpty } from "@/lib/app/design";
import { seedDesign } from "@/lib/app/design-seed";
import { htmlToPdf } from "@/lib/app/pdf";
import { countDownload } from "@/lib/app/resume-store";

/**
 * Download, as an actual file.
 *
 * The button used to open the browser's print dialog, which is two extra
 * decisions ("Destination? Margins?") between a person and the thing they
 * asked for, saved under the name of the web page. This returns the PDF
 * itself, named after the résumé.
 *
 * It runs on Node rather than the edge because it drives a browser, and it is
 * allowed a long time because a cold container has to fetch and unpack Chrome
 * before it can print anything. Every later call in the same container reuses
 * it and takes about a second.
 */
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  let body: { id?: string; shareId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Could not read that request." }, { status: 400 });
  }

  try {
    /**
     * Two doors, one check each.
     *
     * A share id goes through `getShared`, which decides for itself whether
     * this session may see the document — the same function the public page
     * uses, so a withdrawn link stops printing at the same moment it stops
     * loading. A draft id is only ever the caller's own row.
     */
    const source = body.shareId
      ? await getShared(body.shareId, user.email ?? null)
      : body.id
        ? await getDraftById(body.id, user.id)
        : null;

    if (!source) {
      return Response.json({ ok: false, error: "That resume doesn't exist." }, { status: 404 });
    }

    const title = source.title || "Resume";
    const design =
      source.design && !designIsEmpty(source.design)
        ? source.design
        : seedDesign(source.content, source.template);

    const pdf = await htmlToPdf(await designHtml(design, title));

    /**
     * Recorded here, after the PDF exists and before it is handed over.
     *
     * Not in the browser: a download counter the client reports is a number
     * anybody can inflate and nobody can trust. Not before the render either
     * — a build that throws is not a download, and counting it would make the
     * admin screen say people are downloading a file they never got.
     *
     * Fire and forget. Nobody's download should fail because a counter did.
     */
    countDownload("draftId" in source ? source.draftId : source.id);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        // `attachment` is what makes it download rather than open in a tab,
        // and the filename is what stops four résumés all being Cheatcode.pdf.
        "Content-Disposition": `attachment; filename="${pdfFileName(title)}"; filename*=UTF-8''${encodeURIComponent(pdfFileName(title))}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof StoreError) {
      return Response.json({ ok: false, error: e.message }, { status: e.status });
    }
    // The client falls back to the print dialog on any failure here, so this
    // is logged rather than dressed up: what matters is that somebody can see
    // *why* in the runtime logs the next morning.
    console.error("resume/pdf:", e);
    return Response.json(
      { ok: false, error: "Couldn't build the PDF on the server." },
      { status: 500 },
    );
  }
}
