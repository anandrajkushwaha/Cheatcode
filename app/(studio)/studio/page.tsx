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

export default async function StudioHomePage() {
  const [profile, resume] = await Promise.all([getProfile(), getPrimaryResume()]);

  const cities = profile?.preferred_cities ?? [];
  const years = profile?.years_experience;

  const [all, inCities, remote, byYears, blog] = await Promise.all([
    searchJobs({ limit: PER_BUCKET }),
    cities.length ? searchJobs({ cities, limit: PER_BUCKET }) : null,
    searchJobs({ remote: true, limit: PER_BUCKET }),
    typeof years === "number" ? searchJobs({ maxYears: years, limit: PER_BUCKET }) : null,
    getPosts({ perPage: 4 }),
  ]);

  const buckets: Bucket[] = [
    { key: "all", label: "All roles", total: all.total, jobs: all.jobs },
    ...(inCities
      ? [{ key: "cities", label: "Your cities", total: inCities.total, jobs: inCities.jobs }]
      : []),
    { key: "remote", label: "Remote", total: remote.total, jobs: remote.jobs },
    ...(byYears
      ? [{ key: "years", label: "Your experience", total: byYears.total, jobs: byYears.jobs }]
      : []),
  ];

  const posts = blog.posts ?? [];
  const featured = posts[0] ?? null;
  const strip = posts.slice(1, 4);

  const gaps = profileGaps(profile, resume);
  const strength = profileStrength(profile, resume);

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_260px]">
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
        <ProBlock paid={isPaid(profile)} />
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
