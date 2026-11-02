import "server-only";
import nodemailer from "nodemailer";

/**
 * Sending email, over SMTP.
 *
 * Written for the domain's Google Workspace mailbox (support@cheatcodeapp.com):
 * set SMTP_USER to that address and SMTP_PASS to an app password made for it,
 * in Vercel's environment settings. Any SMTP service works the same way
 * through SMTP_HOST and SMTP_PORT. Nothing sends while these are unset.
 */

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export const FROM = process.env.EMAIL_FROM || "Cheatcode <support@cheatcodeapp.com>";
export const REPLY_TO = "support@cheatcodeapp.com";

let transport: nodemailer.Transporter | null = null;
function transporter() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport;
}

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!emailConfigured()) return { ok: false, error: "SMTP_USER and SMTP_PASS are not set" };
  try {
    await transporter().sendMail({
      from: FROM,
      replyTo: REPLY_TO,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      // Lets Gmail show its own "Unsubscribe" link next to the sender.
      headers: {
        "List-Unsubscribe": `<${msg.unsubscribeUrl}>, <mailto:${REPLY_TO}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "Send failed" };
  }
}
