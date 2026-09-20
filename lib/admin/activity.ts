import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What each team member has actually done.
 *
 * Counts come from `posts.created_by` rather than from a separate activity
 * log. A log would record more — every save, every edit — and it would also
 * be a second source of truth that can disagree with the articles themselves.
 * The question the owner is asking is "what has this person put on the site",
 * and the articles are the answer to that by definition.
 *
 * Everything degrades to empty on failure. A team screen that will not load
 * because an activity query broke is worse than one with no numbers on it.
 */

export type PostedItem = {
  id: string;
  slug: string;
  title: string;
  status: string;
  createdAt: string;
  publishedAt: string | null;
  words: number;
  /** Set when somebody other than the author last touched it. */
  editedByOther: boolean;
};

export type MemberActivity = {
  today: number;
  week: number;
  month: number;
  total: number;
  /** Posts per day for the last 14 days, oldest first. For the sparkline. */
  daily: { date: string; count: number }[];
  recent: PostedItem[];
};

const EMPTY: MemberActivity = { today: 0, week: 0, month: 0, total: 0, daily: [], recent: [] };

function startOfDayIST(daysAgo: number): Date {
  // The business runs on IST, so "today" has to mean today in India rather
  // than today in UTC — otherwise everything published after 5.30am looks
  // like it happened tomorrow.
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  ist.setUTCHours(0, 0, 0, 0);
  ist.setUTCDate(ist.getUTCDate() - daysAgo);
  return new Date(ist.getTime() - 5.5 * 3600 * 1000);
}

function istDay(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * One map of activity, keyed by admin_users.id.
 *
 * Built in a single query for the whole team rather than one per person: a
 * team of six would otherwise mean six round trips on every page load, and
 * the whole set of articles anybody has written is a small table.
 */
export async function getTeamActivity(): Promise<Record<string, MemberActivity>> {
  const db = createAdminClient();
  if (!db) return {};

  const since = startOfDayIST(89).toISOString();

  const { data, error } = await db
    .from("posts")
    .select("id, slug, title, status, created_at, published_at, word_count, created_by, last_edited_by")
    .not("created_by", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    // Missing columns is the normal state before 86_post_authorship.sql runs.
    if (!/does not exist|column/i.test(error.message)) {
      console.error("[activity] read failed", error.message);
    }
    return {};
  }

  const rows = (data ?? []) as {
    id: string;
    slug: string;
    title: string;
    status: string;
    created_at: string;
    published_at: string | null;
    word_count: number | null;
    created_by: string;
    last_edited_by: string | null;
  }[];

  const dayStart = {
    today: startOfDayIST(0).getTime(),
    week: startOfDayIST(6).getTime(),
    month: startOfDayIST(29).getTime(),
  };

  // The last 14 day-keys, so a quiet day renders as a gap rather than being
  // skipped and making the chart lie about the shape of the week.
  const days: string[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    days.push(istDay(startOfDayIST(i).toISOString()));
  }

  const out: Record<string, MemberActivity> = {};

  for (const row of rows) {
    const who = row.created_by;
    if (!out[who]) {
      out[who] = { ...EMPTY, daily: days.map((date) => ({ date, count: 0 })) };
    }
    const bucket = out[who];

    const at = new Date(row.created_at).getTime();
    bucket.total += 1;
    if (at >= dayStart.month) bucket.month += 1;
    if (at >= dayStart.week) bucket.week += 1;
    if (at >= dayStart.today) bucket.today += 1;

    const key = istDay(row.created_at);
    const slot = bucket.daily.find((d) => d.date === key);
    if (slot) slot.count += 1;

    if (bucket.recent.length < 25) {
      bucket.recent.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.status,
        createdAt: row.created_at,
        publishedAt: row.published_at,
        words: row.word_count ?? 0,
        editedByOther: Boolean(row.last_edited_by && row.last_edited_by !== who),
      });
    }
  }

  return out;
}
