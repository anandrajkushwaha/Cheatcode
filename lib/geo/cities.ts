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
] as const;

export type City = (typeof CANONICAL_CITIES)[number];

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
};

/** Every alias with its city, longest alias first. Built once. */
const LOOKUP: { alias: string; city: City }[] = Object.entries(ALIASES)
  .flatMap(([city, aliases]) => aliases.map((alias) => ({ alias, city: city as City })))
  .sort((a, b) => b.alias.length - a.alias.length);

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

export type Place = {
  cities: City[];
  isRemote: boolean;
  /** True when we are confident the role can be done from India. */
  inIndia: boolean;
};

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
  for (const { alias, city } of LOOKUP) {
    if (!scan.includes(alias)) continue;
    if (!cities.includes(city)) cities.push(city);
    // Blank the match so a shorter alias inside it cannot match again:
    // "greater noida" must not also register as "noida" a second time.
    scan = scan.split(alias).join(" ");
  }

  const isRemote = REMOTE_WORDS.some((w) => text.includes(w));
  const saysIndia = INDIA_WORDS.some((w) => text.includes(w));
  const saysForeign = FOREIGN_WORDS.some((w) => text.includes(w));

  const inIndia = cities.length > 0 || saysIndia || (isRemote && !saysForeign);

  return { cities, isRemote, inIndia };
}

/** Map a single free-text city to the canonical spelling, or null. */
export function matchCity(input: string): City | null {
  const t = input.trim().toLowerCase();
  if (!t) return null;
  for (const { alias, city } of LOOKUP) if (t.includes(alias)) return city;
  return null;
}
