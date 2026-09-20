/**
 * A gate on the few free-text fields that steer a model.
 *
 * Narrow on purpose. This is not a content filter for everything somebody
 * types — it guards the handful of inputs that become part of a prompt and
 * then come back as generated text with our name on it: the role you say you
 * are interviewing for, the role you want a resume reviewed against.
 *
 * ------------------------------------------------------------ whole words
 *
 * Matching is on word boundaries after the text is normalised to letters and
 * spaces. Substring matching is the obvious implementation and it is wrong in
 * a way that is embarrassing rather than unsafe: "Analyst" contains one slur
 * fragment, "Scunthorpe" is the famous example, and a product that refuses to
 * let somebody practise for an analyst job has a worse problem than the one
 * it was trying to solve.
 *
 * --------------------------------------------------------------- the list
 *
 * Deliberately short. A long list is a list nobody audits, and every entry is
 * a chance to refuse a real job title. These are categories rather than an
 * attempt at completeness: what gets through is caught by the model's own
 * refusals, which is the right place for judgement.
 */

const BLOCKED = [
  // Sexual services and adult work. Not a judgement about the work — these
  // are not roles this product can write screening questions for.
  "pornstar", "porn", "pornography", "escort", "prostitute", "prostitution",
  "stripper", "camgirl", "camboy", "sexworker", "hooker", "gigolo",
  "veshya", "tawaif", "kothewali", "randi", "randibaaz",
  // Explicit terms, which only ever appear here as a test of the input.
  "sex", "sexy", "nude", "naked", "blowjob", "handjob", "masturbation",
  "penis", "vagina", "boobs", "dick", "cock", "pussy", "anal",
  "rape", "rapist", "incest", "pedophile", "paedophile",
  // Hinglish abuse, typed in Latin script. This is what actually gets typed
  // into an Indian product — an English-only list would have caught almost
  // none of it.
  "chutiya", "chutiye", "bhenchod", "behenchod", "madarchod", "bhosdike",
  "bhosdi", "gandu", "lavde", "lauda", "harami", "kamina", "kaminey",
  "chinal", "rakhail",
  // Crime, asked as a role. "hacker" is deliberately absent: Ethical Hacker
  // and Growth Hacker are both real job titles, and refusing them would be a
  // worse failure than letting the word through.
  "hitman", "assassin", "drugdealer", "terrorist", "scammer",
  "conman", "smuggler",
];

/**
 * The same thing in Devanagari.
 *
 * A separate list because normaliseForCheck() strips everything that is not
 * a-z — which meant Devanagari input normalised to an empty string and passed
 * every check. On a product whose whole audience is in India, that was not an
 * edge case; it was the obvious way in.
 *
 * Matched as substrings of the raw text, because Devanagari conjuncts and
 * matras make word-boundary splitting unreliable, and none of these appear
 * inside an innocent Hindi word.
 */
const BLOCKED_DEVANAGARI = [
  "रंडी", "वेश्या", "तवायफ", "कोठेवाली", "चुतिया", "चूतिया", "भेनचोद",
  "बहनचोद", "मादरचोद", "भोसड़ी", "भोसडी", "गांडू", "लौड़ा", "लवड़े",
  "हरामी", "कमीना", "कमीने", "रखैल", "नंगा", "नंगी", "सेक्स",
];

const BLOCKED_SET = new Set(BLOCKED);

/**
 * A word that is NOT on this list, and must never be added: "cum".
 *
 * It is Latin for "combined with", and Indian job titles use it constantly —
 * "Clerk cum Typist", "Peon cum Chowkidar", "Steno cum Computer Operator",
 * "Driver cum Office Assistant". Blocking it would refuse a large slice of
 * exactly the government and clerical roles this product exists to help with.
 * The English-only instinct here would have been a serious bug.
 */

/**
 * Two-word forms, checked against the normalised string.
 *
 * Kept apart from the single words because a phrase cannot be found by the
 * word-by-word pass — and splitting "drug dealer" into "drug" and "dealer"
 * would refuse a pharmaceutical sales role.
 */
const BLOCKED_PHRASES = [
  "drug dealer", "sex worker", "adult film", "adult performer", "call girl",
  "escort service", "hit man", "porn star",
];

export function normaliseForCheck(raw: string): string {
  return raw
    .toLowerCase()
    // Leetspeak, lightly. Enough to catch p0rn without turning real titles
    // into false positives.
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    // Everything that is not a letter becomes a space, so "porn-star" and
    // "porn_star" collapse to the same two words.
    .replace(/[^a-z]+/g, " ")
    .trim();
}

/** True when this text may not be used. */
export function isBlocked(raw: string): boolean {
  // Devanagari first, against the raw string — normalising would delete it.
  const devanagari = raw.toLowerCase();
  for (const word of BLOCKED_DEVANAGARI) {
    if (devanagari.includes(word)) return true;
  }

  const text = normaliseForCheck(raw);
  if (!text) return false;

  for (const phrase of BLOCKED_PHRASES) {
    if (text.includes(phrase)) return true;
  }

  const words = text.split(" ");

  // Whole words only.
  for (const word of words) {
    if (BLOCKED_SET.has(word)) return true;
  }

  /**
   * Adjacent pairs, joined.
   *
   * Catches the spaced spellings of words that are normally written as one —
   * "porn star" becoming "pornstar", "cam girl" becoming "camgirl".
   *
   * The earlier version joined the ENTIRE string and looked for any blocked
   * word inside it, which is how "Therapist" was refused: it contains
   * "rapist". Pairs cannot do that, because a single word is never joined
   * with anything and so is only ever matched whole.
   */
  for (let i = 0; i < words.length - 1; i += 1) {
    if (BLOCKED_SET.has(words[i] + words[i + 1])) return true;
  }

  return false;
}

/* ------------------------------------------------------------------ shape */

/**
 * Does this even look like a job title?
 *
 * Runs before anything expensive, and catches the whole class of input that
 * is not abusive but is not a role either: pasted URLs, prompts aimed at the
 * model, sentences, keyboard mashing. A blocklist never sees these because
 * there is no word to list.
 *
 * Kept generous on purpose. Real titles carry ampersands, slashes, hyphens,
 * brackets and full stops — "Asst. Manager (Sales & Marketing)", "Clerk cum
 * Typist", "SDE-II", "Level 3 Support". Anything stricter would refuse the
 * people this is meant to serve.
 */
export function shapeProblem(raw: string): string | null {
  const text = raw.trim();

  if (text.length < 2) return "Enter the job title you are applying for.";
  if (text.length > 60) return "That is too long for a job title. Just the role, not the description.";

  // Anything that is trying to be a link or an address is not a job title.
  if (/https?:\/\/|www\.|@[a-z]/i.test(text)) {
    return "Enter the job title you are applying for, not a link.";
  }

  // Characters a job title can legitimately contain. Devanagari is allowed
  // through; its own blocklist runs separately.
  if (!/^[\p{L}\p{M}0-9 .,&/()+'’-]+$/u.test(text)) {
    return "Use letters only — enter the job title you are applying for.";
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 8) {
    return "That reads like a sentence. Enter just the job title.";
  }

  // "aaaaaaa", "!!!!!!", and the rest of the keyboard-mashing family.
  if (/(.)\1{4,}/u.test(text)) {
    return "Enter the job title you are applying for.";
  }

  // An instruction aimed at the model rather than a role.
  if (/\b(ignore|disregard|forget) (all |any |the )?(previous|prior|above)\b/i.test(text)) {
    return "Enter the job title you are applying for.";
  }
  if (/\b(you are|act as|pretend|system prompt|instructions)\b/i.test(text)) {
    return "Enter the job title you are applying for.";
  }

  return null;
}

/**
 * What to say when it is refused.
 *
 * One message, no detail about which word tripped it. Naming the word is an
 * invitation to work around it, and a person who typed it by accident does
 * not need it repeated back to them.
 */
export const BLOCKED_MESSAGE =
  "That is not something we can write interview questions for. Enter the job title you are applying for.";

export const BLOCKED_MESSAGE_REVIEW =
  "That is not a role we can review a resume against. Enter the job title you are applying for.";
