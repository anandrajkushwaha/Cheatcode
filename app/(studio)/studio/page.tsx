import { getProfile, getPrimaryResume, isPaid, profileGaps, profileStrength } from "@/lib/app/account";
import { searchJobs } from "@/lib/jobs/query";
import { getPosts } from "@/lib/queries/posts";
import { ProfileCard } from "@/components/app/ProfileCard";
import { ProBlock } from "@/components/studio/ProBlock";
import { JobBuckets, type Bucket } from "@/components/studio/JobBuckets";
import { BlogStrip, FeaturedGuide } from "@/components/studio/BlogStrip";

/**
 * My home.
 *
 * Three columns, as drawn: who you are, what to do, what is happening.
 *
 * The buckets are built here rather than in the component because only the
 * server knows which of them are real for this person. Somebody who has not
 * said where they will work has no "Your cities" bucket, and showing them an
 * empty tab is worse than showing them three honest ones — so the tab is not
 * created at all. Same for experience.
 *
 * All four queries go out together. Run in sequence they would be four round
 * trips to paint one card.
 */

const PER_BUCKET = 6;

export default async function StudioHomePage({
  searchParams,
}: {
  searchParams: Promise<{ pro?: string }>;
}) {
  const [profile, resume, params] = await Promise.all([
    getProfile(),
    getPrimaryResume(),
    searchParams,
  ]);

  /*
   * The promo hides from anybody already paying, which is correct and also
   * means the person building it cannot see it: the test account is granted
   * Pro by 41_grant_pro.sql precisely so the paid surfaces can be checked.
   *
   * ?pro=preview forces it back on. It only changes which of two cards is
   * drawn — no data, no plan, nothing a URL should not be able to decide —
   * and it is the difference between designing this card and signing out to
   * look at it.
   */
  const previewingPromo = params.pro === "preview";
  const paid = isPaid(profile) && !previewingPromo;

  const cities = profile?.preferred_cities ?? [];
  const years = profile?.years_experience;

  const [all, inCities, remote, byYears, blog] = await Promise.all([
    searchJobs({ limit: PER_BUCKET }),
    cities.length ? searchJobs({ cities, limit: PER_BUCKET }) : null,
    searchJobs({ remote: true, limit: PER_BUCKET }),
    typeof years === "number" ? searchJobs({ maxYears: years, limit: PER_BUCKET }) : null,
    getPosts({ perPage: 4 }),
  ]);

  // t=1 tells the jobs page these filters were chosen, not inherited — without
  // it the page would re-apply the profile's defaults over them on arrival.
  const buckets: Bucket[] = [
    { key: "all", label: "All roles", total: all.total, jobs: all.jobs, href: "/studio/jobs" },
    ...(inCities
      ? [
          {
            key: "cities",
            label: "Your cities",
            total: inCities.total,
            jobs: inCities.jobs,
            href: `/studio/jobs?t=1&cities=${encodeURIComponent(cities.join(","))}`,
          },
        ]
      : []),
    {
      key: "remote",
      label: "Remote",
      total: remote.total,
      jobs: remote.jobs,
      href: "/studio/jobs?t=1&remote=1",
    },
    ...(byYears
      ? [
          {
            key: "years",
            label: "Your experience",
            total: byYears.total,
            jobs: byYears.jobs,
            href: `/studio/jobs?t=1&exp=${years}`,
          },
        ]
      : []),
  ];

  const posts = blog.posts ?? [];
  const featured = posts[0] ?? null;
  const strip = posts.slice(1, 4);

  const gaps = profileGaps(profile, resume);
  const strength = profileStrength(profile, resume);

  return (
    <div className="grid gap-4 lg:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[236px_minmax(0,1fr)_252px]">
      {/* /app's own identity card, pointed at /studio. Not a studio copy of
          it: the copy is how two versions of the same card drift apart. */}
      <aside className="min-w-0 lg:sticky lg:top-[88px] lg:self-start">
        <ProfileCard
          profile={profile}
          resume={resume}
          strength={strength}
          nextStep={gaps[0]?.label.toLowerCase() ?? null}
          basePath="/studio"
        />
      </aside>

      <div className="min-w-0 space-y-5">
        <ProBlock
          paid={paid}
          firstName={profile?.full_name?.trim().split(/\s+/)[0] ?? null}
        />
        <JobBuckets buckets={buckets} />
        <BlogStrip posts={strip} />
      </div>

      {/* The design's right rail also carried an Insights panel. Its feed is
          parked until there is a decision on where those items come from, so
          the rail is the featured guide alone rather than a panel with
          invented cards in it. */}
      <aside className="hidden min-w-0 xl:block">
        <FeaturedGuide post={featured} />
      </aside>
    </div>
  );
}
