/**
 * A screen that exists so the navigation is honest.
 *
 * Every destination in the top nav and the sidebar routes somewhere from the
 * first commit — a nav item that 404s teaches people not to trust the nav.
 * What each of these says is what is actually true of it, rather than one
 * reused "coming soon", because "we have not started this" and "this works at
 * the old address" are different messages to the person reading them.
 */
export function StudioPlaceholder({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-10 text-center sm:px-8">
      <h1 className="text-[clamp(1.4rem,3.4vw,1.9rem)] font-semibold tracking-[-0.035em] text-ink">
        {title}
      </h1>
      <p className="mt-4 max-w-[46ch] text-[1rem] leading-relaxed text-ink-50">
        {detail}
      </p>
    </div>
  );
}
