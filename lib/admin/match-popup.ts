import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";

/**
 * The post-download match popup, person by person (/admin/match-popup).
 *
 * Joins four things: resume downloads (account_events), what each person did
 * with the popup (match_popup_events), what they paid (job_unlocks) and who
 * they are (profile + their resume's role and skills). Read with the service
 * key; the page sits behind the admin's "people" permission.
 */

export type PopupRow = {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  source: string | null;
  field: string | null;
  years: number | null;
  skills: string[];
  downloads: number;
  shown: number;
  firstShown: string | null;
  lastAt: string | null;
  matches: number | null;
  best: number | null;
  unlockClicks: number;
  passClicks: number;
  applyClicks: number;
  seeAll: number;
  proClicks: number;
  closed: number;
  avgSeconds: number | null;
  paidRupees: number;
  paidKinds: string[];
  outcome: string;
  jobs: { title: string; company: string; action: string }[];
};

export type PopupReport =
  | { ok: false; missing: string }
  | {
      ok: true;
      days: number | null;
      totals: {
        downloaders: number;
        shownUsers: number;
        shows: number;
        clickedUsers: number;
        startedPayUsers: number;
        paidUsers: number;
        revenue: number;
        appliedUsers: number;
        closedOnly: number;
        avgSeconds: number | null;
      };
      byField: { label: string; value: number; sub?: string }[];
      byScore: { label: string; value: number }[];
      rows: PopupRow[];
    };

type Ev = { user_id: string; event: string; job_id: string | null; props: Record<string, unknown>; created_at: string };

function fieldOf(content: Record<string, unknown> | null, p: Record<string, unknown> | null): string | null {
  const c = content ?? {};
  const roles = Array.isArray(c.roles) ? (c.roles as { title?: string }[]) : [];
  const pick = [
    c.target_role,
    Array.isArray(p?.target_roles) ? (p!.target_roles as string[])[0] : null,
    p?.current_title,
    roles[0]?.title,
    c.headline,
  ].find((x) => typeof x === "string" && x.trim());
  return typeof pick === "string" ? pick.trim().slice(0, 60) : null;
}

export async function getPopupReport(days: number | null): Promise<PopupReport> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, missing: "service key" };
  const since = days ? new Date(Date.now() - days * 86_400_000).toISOString() : "2000-01-01";

  const [evRes, dlRes] = await Promise.all([
    db.from("match_popup_events").select("user_id,event,job_id,props,created_at").gte("created_at", since).order("created_at", { ascending: true }).limit(20000),
    db.from("account_events").select("user_id,created_at").eq("kind", "resume_download").gte("created_at", since).limit(20000),
  ]);
  if (evRes.error) return { ok: false, missing: "116_match_popup_events.sql" };
  const events = (evRes.data ?? []) as Ev[];
  const downloads = new Map<string, number>();
  for (const d of (dlRes.data ?? []) as { user_id: string }[]) downloads.set(d.user_id, (downloads.get(d.user_id) ?? 0) + 1);

  const userIds = [...new Set(events.map((e) => e.user_id))];
  const jobIds = [...new Set(events.map((e) => e.job_id).filter(Boolean) as string[])];

  const [profRes, draftRes, unlockRes, jobRes] = await Promise.all([
    userIds.length
      ? db.from("profiles").select("id,full_name,email,phone,city,preferred_cities,target_roles,current_title,years_experience,signup_source").in("id", userIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? db.from("resume_drafts").select("user_id,content,is_primary,updated_at").in("user_id", userIds).order("is_primary", { ascending: false }).order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    userIds.length
      ? db.from("job_unlocks").select("user_id,kind,job_id,amount_paise,status,paid_at").in("user_id", userIds).eq("status", "paid")
      : Promise.resolve({ data: [] }),
    jobIds.length ? db.from("jobs").select("id,title,company").in("id", jobIds) : Promise.resolve({ data: [] }),
  ]);

  const profiles = new Map(((profRes.data ?? []) as Record<string, unknown>[]).map((p) => [p.id as string, p]));
  const drafts = new Map<string, Record<string, unknown>>();
  for (const d of (draftRes.data ?? []) as { user_id: string; content: Record<string, unknown> }[]) if (!drafts.has(d.user_id)) drafts.set(d.user_id, d.content);
  const paid = new Map<string, { kind: string; job_id: string | null; amount_paise: number }[]>();
  for (const u of (unlockRes.data ?? []) as { user_id: string; kind: string; job_id: string | null; amount_paise: number }[]) {
    paid.set(u.user_id, [...(paid.get(u.user_id) ?? []), u]);
  }
  const jobs = new Map(((jobRes.data ?? []) as { id: string; title: string; company: string }[]).map((j) => [j.id, j]));

  const rows: PopupRow[] = userIds.map((uid) => {
    const evs = events.filter((e) => e.user_id === uid);
    const p = (profiles.get(uid) ?? null) as Record<string, unknown> | null;
    const content = drafts.get(uid) ?? null;
    const count = (name: string) => evs.filter((e) => e.event === name).length;
    const shownEvs = evs.filter((e) => e.event === "shown");
    const lastShown = shownEvs[shownEvs.length - 1];
    const closes = evs.filter((e) => e.event === "closed").map((e) => Number(e.props?.ms)).filter((n) => Number.isFinite(n) && n > 0);
    const pays = paid.get(uid) ?? [];
    const paidRupees = pays.reduce((s, x) => s + x.amount_paise / 100, 0);
    const unlockClicks = count("unlock_click");
    const passClicks = count("pass_click");
    const applyClicks = count("apply_click");
    const proClicks = count("pro_click");
    const seeAll = count("see_all_click");

    const jobActions = new Map<string, string>();
    for (const e of evs) if (e.job_id) jobActions.set(e.job_id, e.event === "apply_click" ? "applied" : e.event === "unlock_click" ? "clicked ₹49" : e.event);
    for (const x of pays) if (x.job_id) jobActions.set(x.job_id, "paid ₹49");

    const outcome = pays.some((x) => x.kind === "pass")
      ? "Paid ₹99"
      : pays.length
        ? "Paid ₹49"
        : applyClicks
          ? "Applied"
          : unlockClicks || passClicks
            ? "Started payment"
            : proClicks
              ? "Looked at Pro"
              : seeAll
                ? "Opened matches"
                : count("closed")
                  ? "Closed"
                  : "No action";

    const skills = Array.isArray(content?.skills) ? (content!.skills as string[]).slice(0, 6) : [];
    const cities = Array.isArray(p?.preferred_cities) ? (p!.preferred_cities as string[]) : [];
    return {
      userId: uid,
      name: (p?.full_name as string) ?? null,
      email: (p?.email as string) ?? null,
      phone: (p?.phone as string) ?? null,
      city: (p?.city as string) ?? cities[0] ?? null,
      source: (p?.signup_source as string) ?? null,
      field: fieldOf(content, p),
      years: (p?.years_experience as number) ?? (typeof content?.years_experience === "number" ? (content.years_experience as number) : null),
      skills,
      downloads: downloads.get(uid) ?? 0,
      shown: shownEvs.length,
      firstShown: shownEvs[0]?.created_at ?? null,
      lastAt: evs[evs.length - 1]?.created_at ?? null,
      matches: typeof lastShown?.props?.count === "number" ? (lastShown.props.count as number) : null,
      best: typeof lastShown?.props?.best === "number" ? (lastShown.props.best as number) : null,
      unlockClicks,
      passClicks,
      applyClicks,
      seeAll,
      proClicks,
      closed: count("closed"),
      avgSeconds: closes.length ? Math.round(closes.reduce((a, b) => a + b, 0) / closes.length / 1000) : null,
      paidRupees,
      paidKinds: pays.map((x) => (x.kind === "pass" ? "₹99 pass" : "₹49 job")),
      outcome,
      jobs: [...jobActions.entries()].map(([id, action]) => ({ title: jobs.get(id)?.title ?? "Job", company: jobs.get(id)?.company ?? "", action })),
    };
  });
  rows.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));

  const shownRows = rows.filter((r) => r.shown > 0);
  const allCloses = rows.map((r) => r.avgSeconds).filter((n): n is number => n !== null);
  const fieldCount = new Map<string, { n: number; paid: number }>();
  for (const r of shownRows) {
    const k = r.field ?? "Unknown";
    const v = fieldCount.get(k) ?? { n: 0, paid: 0 };
    v.n += 1;
    if (r.paidRupees > 0) v.paid += 1;
    fieldCount.set(k, v);
  }
  const buckets: [string, (n: number) => boolean][] = [
    ["90%+", (n) => n >= 90],
    ["80–89%", (n) => n >= 80 && n < 90],
    ["70–79%", (n) => n >= 70 && n < 80],
    ["60–69%", (n) => n < 70],
  ];

  return {
    ok: true,
    days,
    totals: {
      downloaders: downloads.size,
      shownUsers: shownRows.length,
      shows: shownRows.reduce((s, r) => s + r.shown, 0),
      clickedUsers: rows.filter((r) => r.unlockClicks + r.passClicks + r.applyClicks + r.seeAll + r.proClicks > 0).length,
      startedPayUsers: rows.filter((r) => r.unlockClicks + r.passClicks > 0).length,
      paidUsers: rows.filter((r) => r.paidRupees > 0).length,
      revenue: rows.reduce((s, r) => s + r.paidRupees, 0),
      appliedUsers: rows.filter((r) => r.applyClicks > 0).length,
      closedOnly: rows.filter((r) => r.outcome === "Closed").length,
      avgSeconds: allCloses.length ? Math.round(allCloses.reduce((a, b) => a + b, 0) / allCloses.length) : null,
    },
    byField: [...fieldCount.entries()]
      .map(([label, v]) => ({ label, value: v.n, sub: v.paid ? `${v.paid} paid` : undefined }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    byScore: buckets.map(([label, f]) => ({ label, value: shownRows.filter((r) => r.best !== null && f(r.best)).length })),
    rows,
  };
}
