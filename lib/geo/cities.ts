/**
 * The one list of Indian cities the product understands.
 *
 * Deliberately importless so both the browser and the server can read it. It
 * exists because "Bangalore", "Bengaluru", "BLR", "Bangalore, Karnataka,
 * India" and "Whitefield" are the same filter to a person and five different
 * strings to a database. Every city a user can pick and every city a job can
 * be tagged with comes from here, so the two can actually match.
 */

export const CANONICAL_CITIES = [
  // The markets that carry most of the hiring, and the ones offered as chips
  // before anybody asks for more. PRIMARY_COUNT below depends on this order.
  "Bengaluru",
  "Hyderabad",
  "Pune",
  "Chennai",
  "Mumbai",
  "Delhi NCR",
  "Noida",
  "Gurugram",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Indore",
  "Kochi",
  "Coimbatore",
  "Chandigarh",
  "Thiruvananthapuram",

  // Everything else we can recognise. A job in Nagpur was always stored — it
  // said India, so it passed — it simply could not be filtered for, which
  // made the whole of tier two invisible to anyone using the city chips.
  "Lucknow",
  "Bhubaneswar",
  "Nagpur",
  "Surat",
  "Vadodara",
  "Bhopal",
  "Visakhapatnam",
  "Vijayawada",
  "Mysuru",
  "Mangaluru",
  "Madurai",
  "Tiruchirappalli",
  "Kozhikode",
  "Thrissur",
  "Goa",
  "Dehradun",
  "Raipur",
  "Patna",
  "Guwahati",
  "Ludhiana",
  "Amritsar",
  "Nashik",
  "Rajkot",
  "Kanpur",
  "Jodhpur",
  "Ranchi",
  "Jamshedpur",
  "Puducherry",
] as const;

export type City = (typeof CANONICAL_CITIES)[number];

/**
 * How many of the above are shown before a "more cities" control. The filter
 * rails are a row of chips; forty of them is not a filter, it is a wall, and
 * the first sixteen cover the large majority of what the feed actually holds.
 */
export const PRIMARY_COUNT = 16;
export const PRIMARY_CITIES = CANONICAL_CITIES.slice(0, PRIMARY_COUNT) as readonly City[];
export const MORE_CITIES = CANONICAL_CITIES.slice(PRIMARY_COUNT) as readonly City[];

/**
 * Aliases, longest first at match time so "greater noida" is not eaten by
 * "noida" and "navi mumbai" is not eaten by "mumbai". Neighbourhoods are in
 * here too, because job boards routinely list an office park instead of a
 * city.
 */
const ALIASES: Record<City, string[]> = {
  Bengaluru: ["bengaluru", "bangalore", "bengaluru urban", "blr", "whitefield", "koramangala", "electronic city", "bellandur", "marathahalli"],
  Hyderabad: ["hyderabad", "secunderabad", "hitec city", "hitech city", "gachibowli", "telangana"],
  Pune: ["pune", "poona", "hinjewadi", "kharadi", "magarpatta", "baner"],
  Chennai: ["chennai", "madras", "guindy", "sholinganallur", "omr"],
  Mumbai: ["navi mumbai", "mumbai", "bombay", "thane", "andheri", "powai", "goregaon", "bkc", "bandra kurla"],
  "Delhi NCR": ["delhi ncr", "new delhi", "ncr", "delhi", "faridabad", "ghaziabad"],
  Noida: ["greater noida", "noida"],
  Gurugram: ["gurugram", "gurgaon", "udyog vihar", "cyber city", "cyberhub"],
  Kolkata: ["kolkata", "calcutta", "salt lake", "rajarhat"],
  Ahmedabad: ["ahmedabad", "gandhinagar", "gift city"],
  Jaipur: ["jaipur"],
  Indore: ["indore"],
  Kochi: ["kochi", "cochin", "ernakulam", "infopark"],
  Coimbatore: ["coimbatore"],
  Chandigarh: ["chandigarh", "mohali", "panchkula"],
  Thiruvananthapuram: ["thiruvananthapuram", "trivandrum", "technopark"],

  Lucknow: ["lucknow"],
  Bhubaneswar: ["bhubaneswar", "bhubaneshwar", "cuttack"],
  Nagpur: ["nagpur"],
  Surat: ["surat"],
  Vadodara: ["vadodara", "baroda"],
  Bhopal: ["bhopal"],
  Visakhapatnam: ["visakhapatnam", "vishakhapatnam", "vizag"],
  Vijayawada: ["vijayawada"],
  Mysuru: ["mysuru", "mysore"],
  Mangaluru: ["mangaluru", "mangalore"],
  Madurai: ["madurai"],
  Tiruchirappalli: ["tiruchirappalli", "trichy"],
  Kozhikode: ["kozhikode", "calicut"],
  Thrissur: ["thrissur", "trichur"],
  Goa: ["goa", "panaji", "panjim", "margao"],
  Dehradun: ["dehradun"],
  Raipur: ["naya raipur", "raipur"],
  Patna: ["patna"],
  Guwahati: ["guwahati", "gauhati"],
  Ludhiana: ["ludhiana"],
  Amritsar: ["amritsar"],
  Nashik: ["nashik", "nasik"],
  Rajkot: ["rajkot"],
  Kanpur: ["kanpur"],
  Jodhpur: ["jodhpur"],
  Ranchi: ["ranchi"],
  Jamshedpur: ["jamshedpur"],
  Puducherry: ["puducherry", "pondicherry"],
};

/**
 * Match a whole word, not a substring.
 *
 * This used to be `text.includes(alias)`, which is the kind of shortcut that
 * works on every example you think of and fails on the ones you do not:
 * "franchise" contains "ranchi", "Jerusalem" contains "salem", and a location
 * that matched a city was then treated as proof the job was in India. So a
 * single stray word could import a foreign posting into an India-only feed.
 *
 * Written without lookbehind on purpose — Safari only learned it in 16.4, and
 * this module is parsed in the browser, where a regex that throws at import
 * time takes the whole page with it. The delimiters are captured and put back
 * instead.
 */
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordRe = (word: string) => new RegExp(`(^|[^a-z0-9])${escape(word)}([^a-z0-9]|$)`, "g");

/** Every alias with its city, longest alias first. Built once. */
const LOOKUP: { re: RegExp; city: City }[] = Object.entries(ALIASES)
  .flatMap(([city, aliases]) =>
    aliases.map((alias) => ({ alias, city: city as City })),
  )
  .sort((a, b) => b.alias.length - a.alias.length)
  .map(({ alias, city }) => ({ re: wordRe(alias), city }));

export type Place = {
  cities: City[];
  isRemote: boolean;
  /** True when we are confident the role can be done from India. */
  inIndia: boolean;
};

/**
 * Other signals that a location string is inside India — states and union
 * territories. A job that says only "Karnataka" is Indian but has no city we
 * can pin, which is worth keeping and worth not mislabelling.
 */
const INDIA_WORDS = [
  "india", "bharat",
  "karnataka", "maharashtra", "tamil nadu", "telangana", "kerala", "gujarat",
  "rajasthan", "west bengal", "uttar pradesh", "haryana", "punjab",
  "madhya pradesh", "andhra pradesh", "odisha", "bihar", "assam",
  "jharkhand", "chhattisgarh", "uttarakhand", "goa", "himachal",
];

const REMOTE_WORDS = ["remote", "work from home", "wfh", "anywhere", "distributed"];

/**
 * Countries we see constantly on the same boards. Present so a "Bangalore
 * office of a US company" listing that says "San Francisco" is not silently
 * imported as an Indian job.
 */
const FOREIGN_WORDS = [
  // The bare abbreviations are here because the long forms were not enough:
  // "Remote (US only)" contains neither "united states" nor "usa" nor "u.s.",
  // so it read as a bare remote job and was imported as Indian. They are only
  // safe to list now that matching is by whole word — as substrings, "us" and
  // "uk" appear inside half the language.
  "us", "uk", "u.k.", "america", "europe",
  "united states", "usa", "u.s.", "san francisco", "new york", "seattle", "austin",
  "united kingdom", "london", "ireland", "dublin", "germany", "berlin", "amsterdam",
  "netherlands", "france", "paris", "spain", "poland", "warsaw", "canada", "toronto",
  "vancouver", "australia", "sydney", "melbourne", "singapore", "japan", "tokyo",
  "china", "shanghai", "hong kong", "dubai", "abu dhabi", "united arab emirates",
  "saudi", "qatar", "israel", "tel aviv", "brazil", "mexico", "argentina",
  "philippines", "manila", "indonesia", "jakarta", "malaysia", "kuala lumpur",
  "vietnam", "thailand", "bangkok", "korea", "seoul", "taiwan", "new zealand",
  "south africa", "nigeria", "kenya", "egypt", "turkey", "sweden", "norway",
  "denmark", "finland", "switzerland", "zurich", "austria", "belgium", "portugal",
  "lisbon", "italy", "milan", "czech", "prague", "romania", "bucharest", "greece",
];

const INDIA_RE = INDIA_WORDS.map(wordRe);
const REMOTE_RE = REMOTE_WORDS.map(wordRe);
const FOREIGN_RE = FOREIGN_WORDS.map(wordRe);

/** `g` regexes carry lastIndex between calls; test() would be order-dependent. */
const hits = (list: RegExp[], text: string) =>
  list.some((re) => {
    re.lastIndex = 0;
    return re.test(text);
  });

/**
 * Read one or more location strings.
 *
 * The rule that matters: a named Indian city always wins. "Remote - India"
 * and "Bangalore or Remote" are both Indian; "Remote (US only)" is not, and
 * a bare "Remote" is treated as Indian only because these boards belong to
 * companies we added for their Indian hiring — a wrong call here shows up as
 * an irrelevant job rather than a missing one.
 */
export function readPlace(...raw: (string | null | undefined)[]): Place {
  const text = raw.filter(Boolean).join(" | ").toLowerCase();
  if (!text.trim()) return { cities: [], isRemote: false, inIndia: false };

  const cities: City[] = [];
  let scan = text;
  for (const { re, city } of LOOKUP) {
    // Blank the match so a shorter alias inside it cannot match again:
    // "greater noida" must not also register as "noida" a second time. The
    // captured delimiters go back so neighbouring words keep their edges.
    const next = scan.replace(re, "$1 $2");
    if (next === scan) continue;
    scan = next;
    if (!cities.includes(city)) cities.push(city);
  }

  const isRemote = hits(REMOTE_RE, text);
  const saysIndia = hits(INDIA_RE, text);
  const saysForeign = hits(FOREIGN_RE, text);

  const inIndia = cities.length > 0 || saysIndia || (isRemote && !saysForeign);

  return { cities, isRemote, inIndia };
}

/** Map a single free-text city to the canonical spelling, or null. */
export function matchCity(input: string): City | null {
  const t = input.trim().toLowerCase();
  if (!t) return null;
  for (const { re, city } of LOOKUP) {
    re.lastIndex = 0;
    if (re.test(t)) return city;
  }
  return null;
}
