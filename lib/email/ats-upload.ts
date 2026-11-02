import { SITE } from "@/lib/seo/constants";

/**
 * "Upload your resume and see the jobs it matches" — for people whose saved
 * resume matches nothing yet (usually a draft still full of template text).
 *
 * The button opens the free ATS checker. Uploading their real resume there
 * gives the score at once, and when it genuinely fits open jobs the checker
 * opens the same match popup as everywhere else (₹49 / ₹99). The email
 * promises only what that flow does: the job count and the three openings
 * shown are real rows from the board, and nothing claims a match before the
 * resume has been read.
 */

export const CAMPAIGN = "ats_upload_nov26";

export type Teaser = { title: string; where: string | null };

export function trackedUrl(token: string, path: string): string {
  return `${SITE.url}/e/c/${token}?to=${encodeURIComponent(path)}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderAtsUpload(o: { firstName: string | null; openJobs: number; teasers: Teaser[]; token: string }) {
  const name = o.firstName?.trim() ? esc(o.firstName.trim().split(/\s+/)[0]) : "there";
  const cta = trackedUrl(o.token, "/tools/resume-ats-checker");
  const unsub = `${SITE.url}/e/u/${o.token}`;
  const pixel = `${SITE.url}/e/o/${o.token}`;
  const jobs = o.openJobs.toLocaleString("en-IN");

  const subject = `${o.firstName?.trim() ? o.firstName.trim().split(/\s+/)[0] + ", which" : "Which"} of these ${jobs} jobs fit your resume?`;
  const preheader = "Add your resume once — ATS score and matching jobs in 30 seconds, free.";

  const cards = o.teasers
    .slice(0, 3)
    .map(
      (t) => `<tr><td style="padding:0 0 10px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e6e9;border-radius:12px">
    <tr><td style="padding:14px 16px">
      <div style="font-size:15px;font-weight:600;color:#0b0b0f">${esc(t.title)}</div>
      <div style="margin-top:6px;font-size:13px;color:#6e6e76">🔒 <span style="background:#e6e6e9;color:#e6e6e9;border-radius:4px;padding:0 6px">Hidden company</span>${t.where ? ` &nbsp;·&nbsp; 📍 ${esc(t.where)}` : ""}</div>
    </td></tr>
  </table>
</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px">
  <tr><td style="padding:28px 24px 8px">
    <div style="font-size:15px;font-weight:700;color:#0b0b0f">Cheatcode</div>
    <h1 style="margin:18px 0 0;font-size:24px;line-height:1.25;color:#0b0b0f">Hi ${name}, ${jobs} jobs are open right now. Which ones fit <span style="color:#c2410c">your</span> resume?</h1>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#3d3d42">Add your resume once and in about 30 seconds you get:</p>
    <p style="margin:10px 0 0;font-size:15px;line-height:1.8;color:#0b0b0f">✅ Your ATS score — whether hiring software can read your resume<br>✅ The open jobs your resume matches<br>✅ What to fix before you apply</p>
  </td></tr>
  <tr><td style="padding:18px 24px 4px">
    <div style="font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#6e6e76;margin-bottom:10px">Hiring now on Cheatcode</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>
  </td></tr>
  <tr><td align="center" style="padding:14px 24px 6px">
    <a href="${cta}" style="display:block;background:#c2410c;color:#ffffff;text-decoration:none;font-size:17px;font-weight:700;padding:16px 20px;border-radius:999px">Check my resume — free →</a>
    <p style="margin:10px 0 0;font-size:12px;color:#6e6e76">No sign-up needed for the score. Your file is read in your browser, not uploaded.</p>
  </td></tr>
  <tr><td style="padding:22px 24px 26px;border-top:1px solid #f0f0f2">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#a1a1aa">You are getting this because you signed up on <a href="${SITE.url}" style="color:#a1a1aa">cheatcodeapp.com</a>. Questions? Just reply to this email.<br><a href="${unsub}" style="color:#a1a1aa">Unsubscribe</a></p>
  </td></tr>
</table></td></tr></table>
<img src="${pixel}" width="1" height="1" alt="" style="display:block;border:0">
</body></html>`;

  const text = `Hi ${o.firstName?.trim() ? o.firstName.trim().split(/\s+/)[0] : "there"},

${jobs} jobs are open on Cheatcode right now. Which ones fit your resume?

Add your resume once and in about 30 seconds you get your ATS score, the open jobs your resume matches, and what to fix before you apply.

Check my resume (free): ${cta}

No sign-up needed for the score. Your file is read in your browser, not uploaded.

You are getting this because you signed up on cheatcodeapp.com. Unsubscribe: ${unsub}`;

  return { subject, preheader, html, text, unsubscribeUrl: unsub };
}
