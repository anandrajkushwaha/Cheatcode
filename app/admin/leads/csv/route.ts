import { getAtsLeads } from "@/lib/admin/ats-leads";

export const dynamic = "force-dynamic";

/** The ATS leads list as a spreadsheet. Behind the admin guard in proxy.ts like every /admin path. */

function cell(v: string | number | boolean | null, trusted = false): string {
  const s = v === null ? "" : String(v);
  // Quote everything, double inner quotes; a leading = + - @ is defused so a
  // name cannot become a formula when the file is opened in Excel. The phone
  // is ours (validated, "+91 98765 43210") and is left as it is.
  const safe = !trusted && /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  const result = await getAtsLeads();
  if (!result.ok) return new Response("Not set up yet", { status: 503 });

  const head = ["Name", "Phone", "Email", "LinkedIn", "Last score", "Checks", "First check", "Last check", "Source", "Campaign", "Has account"];
  const lines = [head.map((h) => cell(h)).join(",")];
  for (const l of result.leads) {
    lines.push(
      [
        cell(l.name),
        cell(l.phone && `+91 ${l.phone.slice(3, 8)} ${l.phone.slice(8)}`, true),
        ...[l.email, l.linkedin, l.lastScore, l.checks, l.firstAt, l.lastAt, l.source, l.campaign].map((v) => cell(v)),
        cell(l.signedIn ? "yes" : "no"),
      ].join(","),
    );
  }

  const day = new Date().toISOString().slice(0, 10);
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ats-leads-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
