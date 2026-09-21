import "server-only";
import { unstable_cache } from "next/cache";
import { createAppAdminClient } from "@/lib/supabase/app";

/**
 * The one number the landing page brags with.
 *
 * The design had "100+ Other Design professionals are already using Naukri
 * Pro" set in the artwork. Two things were wrong with carrying that across:
 * it named somebody else's product, and it was a figure nobody would ever go
 * back and correct. So it is counted, and the rules are deliberately strict.
 *
 *   Pro subscribers, once there are enough of them to mean anything.
 *   Otherwise members, which is a smaller claim but a true one.
 *   Otherwise nothing at all, and the strip does not render.
 *
 * Rounding is always downward to the nearest ten or hundred, so the "+" is
 * doing honest work: 143 shows as "140+", never "150+".
 */

export type Proof = { value: string; text: string } | null;

const PRO_FLOOR = 25;
const MEMBER_FLOOR = 100;

function roundDown(n: number): number {
  if (n >= 1000) return Math.floor(n / 500) * 500;
  if (n >= 100) return Math.floor(n / 50) * 50;
  return Math.floor(n / 10) * 10;
}

/** Two count queries, rounded down anyway — cached for five minutes. */
export const getProof = unstable_cache(countProof, ["pro-proof"], { revalidate: 300 });

async function countProof(): Promise<Proof> {
  const db = createAppAdminClient();
  if (!db) return null;

  try {
    const pro = await db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("plan", "pro")
      .eq("plan_status", "active");

    if (!pro.error && (pro.count ?? 0) >= PRO_FLOOR) {
      return {
        value: `${roundDown(pro.count ?? 0)}+`,
        text: "professionals are already using Cheatcode Pro",
      };
    }

    const members = await db
      .from("profiles")
      .select("id", { count: "exact", head: true });

    if (!members.error && (members.count ?? 0) >= MEMBER_FLOOR) {
      return {
        value: `${roundDown(members.count ?? 0)}+`,
        text: "professionals are already building their career on Cheatcode",
      };
    }
  } catch (err) {
    console.error("[proof] count failed", err);
  }

  // Too few to claim anything. The strip is skipped rather than softened.
  return null;
}
