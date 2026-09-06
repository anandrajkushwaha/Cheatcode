import { cleanResume, type Resume } from "@/lib/app/resume-schema";
import { seedDesign } from "@/lib/app/design-seed";
import { A4, type Design, type Element } from "@/lib/app/design";
import { TEMPLATES } from "@/lib/app/resume-templates";

/**
 * The résumé the template gallery shows, and the portrait inside it.
 *
 * This reverses a decision made when the gallery was built. The old rule was
 * "show the person their own document in every card, because we have it, and
 * Canva only shows a stranger's CV because it does not" — which sounds right
 * and is wrong in practice for one reason: **a card is a picture of a layout,
 * and a layout is only legible when there is enough in it.**
 *
 * Most people arrive here having uploaded a thin résumé — one job, three
 * skills, no projects. Rendered into ten different templates, all ten come out
 * as the same short page with a lot of white underneath, and the differences
 * between them — the two-column split, the timeline rail, the sidebar — never
 * appear at all. The gallery becomes ten pictures of the same thing, and the
 * one job it has is to make choosing possible.
 *
 * So the previews use this: a full résumé, deliberately long enough that every
 * section a template can lay out actually has something in it. The person's
 * real content still lands the moment they pick one, and the editor is where
 * their words belong.
 *
 * ---------------------------------------------------------------- the names
 *
 * Varied per template rather than one name repeated across the wall. Twenty
 * cards all reading "Anand Raj Kushwaha" looks like a rendering bug — the eye
 * reads repetition as a mistake before it reads it as a placeholder — and it
 * is also the thing this file exists to stop being about one person.
 *
 * These are invented, ordinary names attached to invented jobs. Nothing here
 * refers to a real person, and nothing here should ever be presented as a real
 * document.
 */

/* ------------------------------------------------------------- the picture */

/**
 * The placeholder portraits.
 *
 * Two studio headshots, supplied for this purpose, at 320px — the size the
 * largest frame in the set renders at on a retina screen, and small enough
 * that both together are about the weight of one icon font.
 *
 * ------------------------------------------------------- why not a drawing
 *
 * These replaced a pair of flat SVG avatars, and the reason is the one thing
 * a template card has to do: **make somebody picture their own résumé.** A
 * grey silhouette in the frame answers "how big is the photo" and nothing
 * else. It reads as a wireframe, and a wireframe tells you the feature exists
 * without telling you whether you would want it. A face in the frame shows
 * what the design is actually for.
 *
 * ------------------------------------------------------------- what these are
 *
 * Synthetic portraits, not photographs of anybody. That distinction is the
 * whole licence to ship them: a stock photograph of a real person is that
 * person's likeness, and putting one inside a product that generates
 * documents is a use they never agreed to. If either of these is ever
 * replaced with a picture of a real human being, that permission has to be
 * obtained first — and this comment is where somebody will look for it.
 *
 * They are also placeholders and nothing else. They appear only in gallery
 * previews, never in a document somebody saves, downloads or shares:
 * `previewDesign` puts them into empty frames on its way to drawing a card,
 * and the real résumé that opens in the editor has an empty frame waiting for
 * the person's own picture.
 *
 * Base64 JPEG rather than a file in `public/`, so a card costs no network
 * request and so every `src` in a `Design` is the same shape the gate accepts
 * and a real upload produces.
 */

/** The face the card shows, keyed by which sample person it belongs to. */
const PORTRAIT_A =
  "data:image/jpeg;base64," +
  "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" +
  "lDNVK1quqo1tMCGTtF3RnX05qxC27R0VoNFtQqlP91O+md8urPNv9FC0WAzyTgxPDUtlKthoYN7JzXPZ8L3D3SgJLKdqXGVK" +
  "Kh/zAFPbK1xtqCoCpoY7q8yrDPjxk2stFglRshauUIQhAJjz4U9NePCqZTcbcWerqsykcG4rVEn/AMbT9SmYjJljcXnRjS4j" +
  "zREMuLSk84h9HLyfadjxwjh8xQuBq6p4iiZzcT/HNYfTv/1zfibil0+NymF5e2G8cPmfmf8A19F4l0kmITPe92ZjLlx6q7iU" +
  "LqChcJHZp3NAcel+n1VGpkZQYY0C2eQXcOg6fqmLLLv1mV1SBc7l2jW+X8KTDKfNnnfqco06DoqDGvllMp+MnwjotmBgp6Zs" +
  "R0Nrv/hbeOb2onwiNlyNdymS5aelLravNgOv9lTPvNM2Mmw+J9v0VKomE0xcB91Hozp6omoC7uWanX4neqy5Hd67yUtTPncW" +
  "g+EKONlwNdFZnbsjW5nNHVTBoaXEnX9Ew+Am2w5pxNiOjgiTXuu6/IBamCsDpx5FZF8xt56ra4fH+eiG93BUz8X4/wDp2bg2" +
  "iaaGneRoYxtyNl0KlpgIxcXXjeBHNOGxk2NgBZdBp4hlF15Wc7ezheodGyw0Onop2+oslbH0S5SOpWetLmvbntmJsoZadoBs" +
  "AFYAF0jwLaKNG2a+mudAszEqAGMuIXobLPr7Pe2MfM4D6q0xPk1qCAQYfTxNGUMjaPopHtudVJ5DYaJp10K9OdOCq5ZzT2i6" +
  "lI11TLBr/JSg4N0VSvY5rGVDBd0JuQObeYUOIcQ4fhgtNOC/lGzxOPsFnx4nimLO/wArTfZad2meX4rdQFFWkb8ThJG1zTcE" +
  "XCfawUVNAKemjhaSQwWud1LsECWsjZAN0blEBrczgFeY3K1RQR2Fyp1vhNOHmz3dQIQhXYBCEIBCEIM+aHu8QbNyLHNP0XE8" +
  "cxD/ANRdpkhlJNLRDu2NO13HU/kCfdd5ljEjCPIrkOK8K1OHcRVlVC3wzvBGm3L9FhnjruO3i5Pl+tc04rcJsafy/wAxba1w" +
  "0BeWxKo+01jnN5nwjmvX8X0xgrZRcXzOy/ovKUtIXkyO8LLnxfsow8Ty3vR1FTNY3vXizIuR3cfNS9445nuOrjm12HmpH+No" +
  "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";

const PORTRAIT_B =
  "data:image/jpeg;base64," +
  "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" +
  "2Q==";

/* -------------------------------------------------------------- the tracks */

/**
 * Three careers, each written out at full length.
 *
 * The sample used to be one body of text — two jobs, five bullets, one project
 * — shared by every card and by every name. Two things were wrong with it, and
 * the second is the one that mattered.
 *
 * **It was too short.** A résumé that runs two thirds of the way down the page
 * makes every template look like it has a hole in the bottom of it, and a
 * gallery of thirty of those reads as thirty broken layouts rather than thirty
 * designs. The reference designs are all *full pages* — that is what makes a
 * timeline rail look like a timeline and a two-column body look balanced — so
 * the sample has to be a full page too. Three roles, four bullets on the first,
 * two projects and ten skills is roughly where an A4 fills.
 *
 * **The words did not match the name above them.** One shared body meant a card
 * headed "Ananya Iyer — Business Analyst" listed "Senior Product Designer,
 * Lumen Retail" underneath it. Nobody reads that as a placeholder; they read it
 * as the preview rendering the wrong record. A track fixes it at the source:
 * the headline *is* the track's current title, so the two can never disagree.
 *
 * Everything here is invented — the people, the employers, the numbers. It is
 * written to be plausible rather than impressive, because a preview full of
 * unicorn-scale achievements sets a bar the person's own résumé cannot meet,
 * and the point of the card is for them to picture themselves in it.
 */

type Track = {
  headline: string;
  summary: string;
  skills: string[];
  roles: { title: string; company: string; start: string; end: string; highlights: string[] }[];
  education: { degree: string; institution: string; year: string }[];
  projects: { name: string; description: string; link: string; highlights: string[] }[];
  certifications: string[];
  achievements: string[];
};

const PRODUCT: Track = {
  headline: "Senior Product Designer",
  summary:
    "Product designer with seven years across retail and fintech, most recently leading a team of four. Comfortable owning a problem end to end — research, specification, prototype, launch — and equally happy in the detail of a release checklist. Works closely with engineering rather than handing over to it.",
  skills: [
    "Product strategy",
    "User research",
    "Figma",
    "Design systems",
    "Prototyping",
    "Usability testing",
    "A/B testing",
    "SQL",
    "Stakeholder management",
    "Workshop facilitation",
  ],
  roles: [
    {
      title: "Senior Product Designer",
      company: "Lumen Retail",
      start: "2022",
      end: "Present",
      highlights: [
        "Rebuilt the checkout flow across web and app, cutting drop-off at payment by 18%.",
        "Built the design system now used by three product teams, halving time to first prototype.",
        "Ran fortnightly research sessions with warehouse staff, which reshaped the returns journey.",
        "Mentor two junior designers; both were promoted within the year.",
      ],
    },
    {
      title: "Product Designer",
      company: "Northwind Labs",
      start: "2019",
      end: "2022",
      highlights: [
        "Shipped the first Android app, to 40,000 installs in six months.",
        "Cut onboarding from nine screens to four without losing sign-ups.",
        "Introduced weekly usability tests, moving release decisions off opinion.",
      ],
    },
    {
      title: "UX Designer",
      company: "Sunrise Digital",
      start: "2017",
      end: "2019",
      highlights: [
        "Redesigned the booking funnel for a travel client; conversion up 11% quarter on quarter.",
        "Set the accessibility baseline still used across the agency's work.",
      ],
    },
  ],
  education: [
    { degree: "M.Des, Interaction Design", institution: "IIT Bombay", year: "2015 – 2017" },
    { degree: "B.Tech, Computer Science", institution: "VIT Vellore", year: "2011 – 2015" },
  ],
  projects: [
    {
      name: "Ledger",
      description: "A budgeting tool for freelancers",
      link: "",
      highlights: [
        "Built and launched solo; 1,200 monthly users with no marketing spend.",
        "Written up in two newsletters and used as a portfolio case study.",
      ],
    },
    {
      name: "Type Scale",
      description: "An open-source typography plugin for Figma",
      link: "",
      highlights: ["Nine hundred installs; maintained with two outside contributors."],
    },
  ],
  certifications: [
    "Google UX Design Certificate, 2021",
    "Certified Scrum Product Owner, 2020",
    "Nielsen Norman Group — Interaction Design, 2019",
  ],
  achievements: [
    "Speaker, Design Up 2023 — \u201cResearch on a two-week cycle\u201d",
    "Mentor on the ADPList platform since 2021, 60+ sessions",
    "Runner-up, Smart India Hackathon 2016",
  ],
};

const DATA: Track = {
  headline: "Senior Data Analyst",
  summary:
    "Analyst with six years turning messy operational data into decisions people actually take. Built the reporting layer two companies now run their weekly business review on. Equally comfortable writing the SQL and explaining the result to a room that does not write any.",
  skills: [
    "SQL",
    "Python",
    "dbt",
    "Looker",
    "Power BI",
    "Experiment design",
    "Forecasting",
    "Data modelling",
    "Snowflake",
    "Stakeholder management",
  ],
  roles: [
    {
      title: "Senior Data Analyst",
      company: "Meridian Logistics",
      start: "2022",
      end: "Present",
      highlights: [
        "Rebuilt the delivery-cost model, exposing ₹40 lakh a year of avoidable line-haul spend.",
        "Migrated 90 hand-written reports to dbt; the weekly refresh dropped from six hours to twenty minutes.",
        "Set up the experiment framework now used for every pricing change.",
        "Trained eleven operations managers to answer their own questions in Looker.",
      ],
    },
    {
      title: "Data Analyst",
      company: "Northwind Labs",
      start: "2020",
      end: "2022",
      highlights: [
        "Built the churn model that moved retention spend onto the accounts it could actually save.",
        "Automated the month-end pack, ending three days of manual reconciliation.",
        "Owned the definitions layer, which ended a long argument about what \u201cactive user\u201d meant.",
      ],
    },
    {
      title: "Business Analyst",
      company: "Sunrise Digital",
      start: "2018",
      end: "2020",
      highlights: [
        "Sized four new markets for a retail client; two were opened on the strength of it.",
        "Wrote the SQL onboarding guide still given to every new analyst.",
      ],
    },
  ],
  education: [
    { degree: "M.Sc, Statistics", institution: "University of Hyderabad", year: "2016 – 2018" },
    { degree: "B.Sc, Mathematics", institution: "Fergusson College, Pune", year: "2013 – 2016" },
  ],
  projects: [
    {
      name: "Fare Watch",
      description: "A public dashboard tracking intercity bus fares",
      link: "",
      highlights: [
        "Scrapes and publishes daily; cited twice in local press.",
        "Runs on a ₹400 a month server, by design.",
      ],
    },
    {
      name: "dbt-audit",
      description: "An open-source freshness checker for dbt projects",
      link: "",
      highlights: ["Four hundred stars; used by two consultancies."],
    },
  ],
  certifications: [
    "Google Advanced Data Analytics Certificate, 2022",
    "Snowflake SnowPro Core, 2021",
    "Microsoft Certified: Power BI Data Analyst, 2020",
  ],
  achievements: [
    "Speaker, PyData Bengaluru 2023 — \u201cThe report nobody reads\u201d",
    "Built and taught an internal SQL course, 40 colleagues through it",
    "Finalist, Kaggle Indian Retail Forecasting 2021",
  ],
};

const BUSINESS: Track = {
  headline: "Marketing Manager",
  summary:
    "Marketer with seven years across D2C and B2B, most recently running a team of five and a ₹6 crore annual budget. Brought paid acquisition in-house and cut cost per acquisition by a third. Prefers a channel proven small before it is funded large.",
  skills: [
    "Performance marketing",
    "Brand strategy",
    "Content marketing",
    "Google Ads",
    "Meta Ads",
    "SEO",
    "Marketing automation",
    "Budget ownership",
    "Copywriting",
    "Team leadership",
  ],
  roles: [
    {
      title: "Marketing Manager",
      company: "Lumen Retail",
      start: "2022",
      end: "Present",
      highlights: [
        "Took paid acquisition in-house from an agency; cost per acquisition down 34% in two quarters.",
        "Grew organic traffic from 40,000 to 180,000 sessions a month over eighteen months.",
        "Rebuilt the lifecycle email programme, now 22% of monthly revenue.",
        "Manage a team of five and a ₹6 crore annual budget.",
      ],
    },
    {
      title: "Marketing Executive",
      company: "Northwind Labs",
      start: "2019",
      end: "2022",
      highlights: [
        "Launched the referral scheme that carried a quarter of the first year's sign-ups.",
        "Ran the rebrand across web, packaging and store fronts in eleven weeks.",
        "Set up weekly reporting that made spend arguments about numbers rather than taste.",
      ],
    },
    {
      title: "Marketing Associate",
      company: "Sunrise Digital",
      start: "2017",
      end: "2019",
      highlights: [
        "Ran campaigns for six retail clients, the largest at ₹80 lakh a year.",
        "Started the agency's case-study programme; four of them still win pitches.",
      ],
    },
  ],
  education: [
    { degree: "MBA, Marketing", institution: "Symbiosis, Pune", year: "2015 – 2017" },
    { degree: "B.Com, Honours", institution: "Christ University, Bengaluru", year: "2012 – 2015" },
  ],
  projects: [
    {
      name: "Local First",
      description: "A newsletter on Indian D2C brand building",
      link: "",
      highlights: [
        "Writes weekly to 4,000 subscribers; 46% open rate.",
        "Two brands hired directly out of it.",
      ],
    },
    {
      name: "Spend Sheet",
      description: "An open budget template for small marketing teams",
      link: "",
      highlights: ["Downloaded 2,000 times; used as teaching material on two courses."],
    },
  ],
  certifications: [
    "Google Ads Search Certification, 2023",
    "HubSpot Inbound Marketing, 2021",
    "Meta Certified Media Buying Professional, 2020",
  ],
  achievements: [
    "Speaker, D2C India Summit 2023 — \u201cBringing paid in-house\u201d",
    "Judge, IIM Bangalore marketing case competition since 2022",
    "Grew a personal newsletter to 4,000 subscribers with no paid promotion",
  ],
};

/* -------------------------------------------------------------- the people */

type Person = {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  /** The career this person has. Their headline and every date comes from it. */
  track: Track;
  /**
   * Which of the two portraits this person wears.
   *
   * Stated per person rather than hashed from the template id, which is what
   * it used to be. With drawn silhouettes that was harmless — the avatars
   * were deliberately featureless, so any of them fitted any name. With
   * photographs it stops being harmless: a card headed "Priya Nair" over a
   * photograph of a man does not read as a stock image, it reads as a bug in
   * the template, which is precisely the impression a gallery cannot afford.
   */
  portrait: string;
};

/**
 * Eight of them, alternating portrait so the faces alternate down the grid,
 * and cycling the three tracks so neighbouring cards differ in their words as
 * well as in their name.
 */
const PEOPLE: Person[] = [
  { full_name: "Priya Nair", email: "priya.nair@example.com", phone: "+91 98200 41185", location: "Bengaluru", track: PRODUCT, portrait: PORTRAIT_A },
  { full_name: "Rohan Mehta", email: "rohan.mehta@example.com", phone: "+91 98111 27340", location: "Gurugram", track: BUSINESS, portrait: PORTRAIT_B },
  { full_name: "Ananya Iyer", email: "ananya.iyer@example.com", phone: "+91 99870 55219", location: "Pune", track: DATA, portrait: PORTRAIT_A },
  { full_name: "Kabir Sharma", email: "kabir.sharma@example.com", phone: "+91 90045 71862", location: "Hyderabad", track: PRODUCT, portrait: PORTRAIT_B },
  { full_name: "Meera Joshi", email: "meera.joshi@example.com", phone: "+91 98330 60417", location: "Mumbai", track: BUSINESS, portrait: PORTRAIT_A },
  { full_name: "Arjun Rao", email: "arjun.rao@example.com", phone: "+91 97400 13286", location: "Chennai", track: DATA, portrait: PORTRAIT_B },
  { full_name: "Sara Fernandes", email: "sara.fernandes@example.com", phone: "+91 98670 24951", location: "Goa", track: PRODUCT, portrait: PORTRAIT_A },
  { full_name: "Vikram Chandra", email: "vikram.chandra@example.com", phone: "+91 99100 38672", location: "Delhi", track: DATA, portrait: PORTRAIT_B },
];

/**
 * A sample résumé for one template, stable for a given id.
 *
 * Stable matters: the card must not shuffle its name every time React
 * re-renders the gallery, and the same template must look the same on the
 * gallery and in the editor's template panel.
 */
/**
 * Which invented person a template borrows, by its position in the list.
 *
 * This was a hash of the id, which is the obvious way to get a stable choice
 * and the wrong one for a wall of cards: hashes collide, and three of the four
 * photo-header templates sit next to each other in the gallery and all came
 * out as "Sara Fernandes". Three identical names in a row does not read as
 * a coincidence, it reads as the page failing to load different data.
 *
 * Position round-robins instead. Still stable — the same template draws the
 * same card every render — but now adjacent cards can never share a person,
 * which is the only property the gallery actually needs. The people alternate
 * between the two portraits, so the faces alternate down the grid too.
 *
 * An id not in the list falls back to the first person rather than throwing:
 * this is a preview, and a missing template should show a card, not a stack
 * trace on a gallery page.
 */
function personFor(templateId: string): Person {
  const index = TEMPLATES.findIndex((t) => t.id === templateId);
  return PEOPLE[(index < 0 ? 0 : index) % PEOPLE.length];
}

export function sampleFor(templateId: string): Resume {
  const { portrait, track, ...person } = personFor(templateId);
  void portrait; // belongs to the card, not to the résumé
  return cleanResume({
    ...person,
    ...track,
    links: [{ label: "Portfolio", url: "www.example.com/work" }],
  });
}

/**
 * The portrait for one template: whichever the sample person wears.
 *
 * Read off the person rather than out of the résumé, because `cleanResume`
 * would drop it — a `Resume` has no portrait field and should not gain one. A
 * photograph in the schema would mean every saved document could carry a face,
 * and that is a decision about people's data, not about a gallery card.
 */
export function portraitFor(templateId: string): string {
  return personFor(templateId).portrait;
}

/**
 * A finished preview of one template: sample words, and a face in the frame.
 *
 * The frame-filling is the half that matters. A template that ships an empty
 * photo frame renders in the gallery as a grey circle, which reads as a
 * missing image rather than as "your photo goes here" — so the card makes the
 * template look broken and people skip it. Filling it in the preview shows
 * what the template is *for*, and costs the real document nothing, because
 * this is only ever used to draw a card.
 */
export function previewDesign(templateId: string): Design {
  const design = seedDesign(sampleFor(templateId), templateId);
  const face = portraitFor(templateId);
  return {
    ...design,
    pages: design.pages.map((p) => ({
      ...p,
      elements: trimToPage(
        p.elements.map((el) => (el.type === "image" && !el.src ? { ...el, src: face } : el)),
      ),
    })),
  };
}

/** How close to the paper's edge a block may finish and still be drawn. */
const BOTTOM_MARGIN = 6;
/** A block this short is furniture — a heading, a rule, a date, a glyph. */
const FURNITURE = 9;

/**
 * Drop whatever the sheet cannot show whole.
 *
 * A card is a picture of a page, and a picture has to end somewhere sensible.
 * The document itself does not trim — an element that straddles the boundary
 * stays put and gets clipped, because on a canvas that is visible and the
 * person can drag it (see `seedDesign`). A card gives them nothing to drag, so
 * the same clipping reads as the renderer failing halfway down.
 *
 * Two passes, and the second is the one worth having:
 *
 * 1. **Drop what overhangs.** Anything finishing below the bottom margin goes.
 *    Full-bleed furniture is exempt — a sidebar fill or a header band is
 *    *supposed* to run to the paper's edge, and dropping it would take the
 *    template's entire colour off the card.
 *
 * 2. **Drop the heading it leaves behind.** Removing the paragraph under
 *    "Achievements" leaves the word "Achievements" alone at the foot of the
 *    page, which is worse than the clipping it replaced: a heading with
 *    nothing under it reads as a section that came out empty.
 *
 *    A heading goes only when **the trim is what orphaned it** — its own
 *    section's body was in the list and pass one removed it. Not merely
 *    "nothing substantial follows in this column", which was the first
 *    version of this rule and quietly deleted the entire left gutter of the
 *    `label-left` templates: those labels are a column made *only* of
 *    furniture, their content sits in a different column entirely, so by that
 *    test every one of them was a widow. The five cards came out as unlabelled
 *    text. Asking the narrower question — did I do this? — cannot make that
 *    mistake, because a label whose body was never dropped is never touched.
 *
 * 3. **Drop the panel it emptied.** The `boxed` templates draw a tinted
 *    rectangle behind each section, and a rectangle survives pass one on its
 *    own merits — it is a shape with a height, and nothing about it says what
 *    it was drawn for. On a full-length résumé the last panel kept its tint
 *    and lost its words, so the card ended with a large empty coloured box:
 *    the one thing on the page that looks like a bug rather than an edge. So
 *    a panel that ends up containing no text goes with the text it framed.
 *
 * All three passes are keyed off geometry rather than off a `role` field the
 * model does not have. `h` is an estimate, so this is approximate — and
 * approximate in the safe direction, since the cost of trimming one block too
 * many is a slightly shorter card and the cost of trimming one too few is a
 * card that
 * looks broken.
 */
const SAME_COLUMN = 12;

function trimToPage(elements: Element[]): Element[] {
  const fullBleed = (el: Element) => el.h >= A4.h - 1 || el.w >= A4.w - 1;
  const fits = (el: Element) => fullBleed(el) || el.y + el.h <= A4.h - BOTTOM_MARGIN;

  const orphaned = (el: Element, i: number) => {
    if (fullBleed(el) || el.h > FURNITURE) return false;
    // The next real block below this one, in this column. That is the thing
    // this piece of furniture is a heading for.
    const body = elements.find(
      (next, j) =>
        j > i && next.h > FURNITURE && Math.abs(next.x - el.x) <= SAME_COLUMN,
    );
    return body !== undefined && !fits(body);
  };

  const kept = elements.filter((el, i) => fits(el) && !orphaned(el, i));

  // A panel with nothing left inside it. Text only — a panel whose only
  // remaining occupant is the rule under its own heading is still empty.
  const holdsText = (box: Element) =>
    kept.some(
      (el) =>
        el !== box &&
        el.type === "text" &&
        el.x >= box.x - 1 &&
        el.x <= box.x + box.w + 1 &&
        el.y >= box.y - 1 &&
        el.y <= box.y + box.h + 1,
    );

  return kept.filter(
    (el) => el.type !== "shape" || fullBleed(el) || el.h < FURNITURE || holdsText(el),
  );
}
