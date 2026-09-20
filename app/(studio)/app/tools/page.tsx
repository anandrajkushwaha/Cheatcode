import Link from "next/link";

/**
 * The two tools, inside the app.
 *
 * They also live on the public site with no login, and that stays true — this
 * is the signed-in door to the same thing, so somebody already in the product
 * does not have to leave it to check a score.
 *
 * Both run the same lib/tools code the public pages run. One implementation,
 * two doors; the alternative is two scorers that disagree with each other
 * within a month.
 */
const TOOLS = [
  {
    href: "/app/tools/ats",
    name: "Resume ATS checker",
    tagline:
      "Upload the resume you are already sending and see what the software reads — with the exact weak points costing you interviews.",
    meta: "score · parse check · weak points",
  },
  {
    href: "/app/tools/salary",
    name: "In-hand salary calculator",
    tagline:
      "Turn the CTC on your offer letter into the number that reaches your bank account.",
    meta: "PF · gratuity · professional tax · income tax",
  },
];

export default function StudioToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.38rem] font-semibold tracking-[-0.03em]">Free tools</h1>
        <p className="mt-2 max-w-[58ch] text-[0.87rem] leading-relaxed text-ink-50">
          Both run entirely in your browser. Nothing you upload here is sent
          anywhere or stored.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group rounded-2xl border border-ink-08 bg-paper p-6 transition-colors hover:border-ink-30"
          >
            <p className="text-[1.02rem] font-medium tracking-[-0.02em]">{t.name}</p>
            <p className="mt-2.5 text-[0.85rem] leading-relaxed text-ink-50">{t.tagline}</p>
            <p className="mt-5 text-[0.72rem] uppercase tracking-wider text-ink-30">{t.meta}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
