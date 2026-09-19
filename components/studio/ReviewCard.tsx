import type { Review } from "@/lib/studio/reviews";

/**
 * One testimonial, exactly as drawn.
 *
 * No "use client" on purpose: this renders on the landing page as a server
 * component and inside the admin editor as part of a client tree. Keeping it
 * free of hooks is what lets the admin preview be the real card rather than a
 * second drawing of it that slowly stops matching.
 *
 * The avatar is a plain <img>. next/image would be the reflex, but
 * next.config.ts only allowlists our own Supabase host and the URL field
 * accepts any address — so an editor pasting a link from elsewhere would get
 * a broken image from the optimiser rather than a picture.
 */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function ReviewCard({ review }: { review: Review }) {
  return (
    <figure className="flex h-full w-full flex-col gap-4">
      <figcaption className="flex items-center gap-3">
        <span
          aria-hidden={review.avatarUrl ? undefined : true}
          className="relative grid size-[60px] shrink-0 place-items-center overflow-hidden rounded-full bg-ink-08 text-[0.95rem] font-semibold text-[#474d6a] sm:size-[72px]"
        >
          {/* Initials paint first; the photo covers them if it loads. A slow
              or dead image URL leaves a name badge, not a grey hole. */}
          {initials(review.name)}
          {review.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={review.avatarUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          )}
        </span>

        <span className="min-w-0">
          <span className="block truncate text-[0.875rem] font-bold leading-[18px] text-[#474d6a]">
            {review.name}
          </span>
          {review.role && (
            <span className="block truncate text-[0.75rem] font-medium leading-[15px] text-[#474d6a]">
              {review.role}
            </span>
          )}
        </span>
      </figcaption>

      <blockquote className="flex-1 rounded-[16px] bg-paper px-5 pb-6 pt-5 sm:min-h-[166px]">
        <p className="whitespace-pre-line text-[0.875rem] font-medium leading-[18px] text-[#121224]">
          {review.quote}
        </p>
      </blockquote>
    </figure>
  );
}
