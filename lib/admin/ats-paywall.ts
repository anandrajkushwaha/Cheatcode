import "server-only";
import { createAppAdminClient } from "@/lib/supabase/app";
import { fetchAll } from "@/lib/admin/fetch-all";

/**
 * The ₹49 card on the ATS checker (components/tools/AtsPaywall.tsx), followed
 * down: who used the daily free check, who came back and met the card, who
 * tapped "See my score", who opened the payment, who paid.
 *
 *   free / locked   ats_checks (119_ats_checks.sql), one row per check
 *   tapped          page_events cta_click at location "ats-paywall"
 *   opened / paid   job_unlocks, kind 'ats'
 *
 * A person is their account when signed in, else the email in the resume,
 * else the browser — the same identities the gate itself uses.
 */

type Check = {
  created_at: string;
  outcome: "free" | "repeat" | "paid" | "locked";
  user_id: string | null;
  email: string | null;
  phone: string | null;
  visitor: string | null;
  device: string | null;
};

export type PaywallPerson = {
  key: string;
  /** From the resume's contact block, as saved in ats_leads. */
  name: string | null;
  email: string | null;
  phone: string | null;
  signedIn: boolean;
  shown: number;
  lastShown: string;
  opened: boolean;
  paid: boolean;
};

export type PaywallReport =
  | { ok: false; error: string }
  | {
      ok: true;
      days: number;
      freeChecks: number;
      shows: number;
      people: number;
      tapped: number;
      opened: number;
      paid: number;
      revenue: number;
      rows: PaywallPerson[];
    };

const who = (c: Check) => c.user_id ?? (c.email ? `e:${c.email}` : `v:${c.visitor ?? c.device ?? "?"}`);

export async function getAtsPaywall(days = 30): Promise<PaywallReport> {
  const db = createAppAdminClient();
  if (!db) return { ok: false, error: "Supabase isn't configured." };
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [checks, taps, orders] = await Promise.all([
    fetchAll<Check>((from, to) =>
      db
        .from("ats_checks")
        .select("created_at,outcome,user_id,email,phone,visitor,device")
        .gte("created_at", since)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAll<{ session_id: string | null }>((from, to) =>
      db
        .from("page_events")
        .select("session_id")
        .eq("event", "cta_click")
        .eq("params->>location", "ats-paywall")
        .eq("is_bot", false)
        .gte("created_at", since)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAll<{ user_id: string; status: string; amount_paise: number }>((from, to) =>
      db
        .from("job_unlocks")
        .select("user_id,status,amount_paise")
        .eq("kind", "ats")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .range(from, to),
    ),
  ]);
  if (checks.error) return { ok: false, error: checks.error };

  const openedBy = new Set(orders.rows.map((o) => o.user_id));
  const paidRows = orders.rows.filter((o) => o.status === "paid");
  const paidBy = new Set(paidRows.map((o) => o.user_id));

  // A person seen signed in and signed out is one person: their account wins
  // once any of their checks carries it (matched on email).
  const accountByEmail = new Map<string, string>();
  for (const c of checks.rows) if (c.user_id && c.email) accountByEmail.set(c.email, c.user_id);
  const keyOf = (c: Check) => (c.email && accountByEmail.get(c.email)) || who(c);

  const people = new Map<string, PaywallPerson>();
  let shows = 0;
  let freeChecks = 0;
  for (const c of checks.rows) {
    if (c.outcome === "free") freeChecks += 1;
    if (c.outcome !== "locked") continue;
    shows += 1;
    const k = keyOf(c);
    const p = people.get(k) ?? {
      key: k,
      name: null,
      email: null,
      phone: null,
      signedIn: false,
      shown: 0,
      lastShown: c.created_at,
      opened: false,
      paid: false,
    };
    p.shown += 1;
    p.email ??= c.email;
    p.phone ??= c.phone;
    if (c.created_at > p.lastShown) p.lastShown = c.created_at;
    const account = c.user_id ?? (c.email ? accountByEmail.get(c.email) : undefined);
    if (account) {
      p.signedIn = true;
      if (openedBy.has(account)) p.opened = true;
      if (paidBy.has(account)) p.paid = true;
    }
    people.set(k, p);
  }

  const rows = [...people.values()].sort((a, b) => b.lastShown.localeCompare(a.lastShown));

  // Names, from the leads the checker already saves (by email, else phone).
  const emails = [...new Set(rows.map((r) => r.email).filter(Boolean))] as string[];
  const phones = [...new Set(rows.map((r) => r.phone).filter(Boolean))] as string[];
  if (emails.length || phones.length) {
    const ors = [
      emails.length ? `email.in.(${emails.map((e) => `"${e.replace(/"/g, "")}"`).join(",")})` : "",
      phones.length ? `phone.in.(${phones.map((p) => `"${p}"`).join(",")})` : "",
    ].filter(Boolean);
    const { data } = await db.from("ats_leads").select("name,email,phone").or(ors.join(",")).limit(1000);
    const byEmail = new Map<string, string>();
    const byPhone = new Map<string, string>();
    for (const l of (data ?? []) as { name: string | null; email: string | null; phone: string | null }[]) {
      if (!l.name) continue;
      if (l.email) byEmail.set(l.email, l.name);
      if (l.phone) byPhone.set(l.phone, l.name);
    }
    for (const r of rows) r.name = (r.email && byEmail.get(r.email)) || (r.phone && byPhone.get(r.phone)) || null;
  }
  return {
    ok: true,
    days,
    freeChecks,
    shows,
    people: rows.length,
    // Everyone who opened a payment tapped first, even when their tap was
    // not recorded (the owner's own browsers are left out of page_events).
    tapped: Math.max(openedBy.size, new Set(taps.rows.map((t) => t.session_id).filter(Boolean)).size),
    opened: openedBy.size,
    paid: paidBy.size,
    revenue: paidRows.reduce((s, o) => s + o.amount_paise, 0) / 100,
    rows,
  };
}
