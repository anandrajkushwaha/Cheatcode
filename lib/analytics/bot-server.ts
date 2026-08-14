import "server-only";

/**
 * Server-side bot detection, run on every /api/track request.
 *
 * Independent of the client check so a script that skips our JS entirely — or
 * strips it — still gets flagged. Nothing is rejected outright: suspicious
 * hits are stored with is_bot = true so the numbers stay auditable, and every
 * admin query filters them out.
 */

const BOT_UA =
  /bot\b|crawl|spider|slurp|scrape|headless|phantom|puppeteer|playwright|selenium|webdriver|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl|wget|python-requests|python-urllib|axios|node-fetch|go-http|okhttp|java\/|libwww|httpclient|postman|insomnia|facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|slackbot|discordbot|embedly|quora link preview|redditbot|applebot|amazonbot|bingpreview|yandex|baiduspider|duckduckbot|ahrefs|semrush|mj12|dotbot|petalbot|dataforseo|screaming frog|gptbot|ccbot|claudebot|claude-web|anthropic|perplexitybot|bytespider|google-inspectiontool|googleother|adsbot/i;

export type BotVerdict = { isBot: boolean; reason: string | null };

export function detectBot(
  request: Request,
  clientReason?: string | null,
): BotVerdict {
  const ua = request.headers.get("user-agent") ?? "";

  if (!ua) return { isBot: true, reason: "no-ua" };
  if (BOT_UA.test(ua)) return { isBot: true, reason: "ua" };

  // Real browsers always send Accept-Language.
  if (!request.headers.get("accept-language")) {
    return { isBot: true, reason: "no-accept-language" };
  }

  // The client found something we couldn't see from here.
  if (clientReason) return { isBot: true, reason: `client:${clientReason}` };

  return { isBot: false, reason: null };
}
