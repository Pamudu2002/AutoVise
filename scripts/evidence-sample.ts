/**
 * Synthetic customer-evidence rows for the demo study (fictional operators from the
 * `telecom-sl-demo` template). Every account here is invented for demonstration; none describes a
 * real company or person. Rows use the import spreadsheet's headers, so the seed and the e2e fixture
 * go through the same import path as a real team spreadsheet.
 */

type Sent = "positive" | "mixed" | "negative" | "unclear";
interface Account {
  text: string;
  themes: string[];
  sentiment: Sent;
  switching?: string;
  product?: string;
  productEvidence?: string;
}

const APP: Account[] = [
  { text: "The {op} app keeps logging me out after the last update, so I cannot check my data balance.", themes: ["billing_app"], sentiment: "negative" },
  { text: "Reloading through the {op} app is quick and the receipt arrives straight away.", themes: ["billing_app"], sentiment: "positive" },
  { text: "Data packages in the {op} app look cheap until the night-time split leaves little for the day.", themes: ["price_value", "billing_app"], sentiment: "negative" },
  { text: "Bill payment in the {op} app failed twice and the money only came back a week later.", themes: ["billing_app", "support"], sentiment: "negative" },
  { text: "Good app overall, but the package list is confusing and prices change without notice.", themes: ["billing_app", "price_value"], sentiment: "mixed" },
  { text: "The chat help inside the {op} app answered my roaming question in a few minutes.", themes: ["support", "billing_app"], sentiment: "positive" },
  { text: "The app shows full signal but pages will not load in the evening where I live.", themes: ["network", "billing_app"], sentiment: "negative" },
  { text: "Simple design. I can see my usage and buy add-ons without calling anyone.", themes: ["billing_app"], sentiment: "positive" },
  { text: "Every update adds more adverts for packages I do not want, and the balance screen is buried.", themes: ["billing_app"], sentiment: "negative" },
  { text: "Loyalty points in the {op} app are nice, but the data bundles feel expensive for what you get.", themes: ["price_value", "billing_app"], sentiment: "mixed" },
];

const MOBILE: Account[] = [
  { text: "I keep a {op} SIM for calls but use another operator's data card because the night packages are no use to me.", themes: ["switching", "price_value"], sentiment: "negative", switching: "Keeps a second SIM for data" },
  { text: "{op} 4G is reliable on my commute between the city and the suburbs.", themes: ["network"], sentiment: "positive" },
  { text: "Moved my number away from {op} after the data package price went up again.", themes: ["switching", "price_value"], sentiment: "negative", switching: "Ported out after a price rise" },
  { text: "Coverage in the hill country is patchy with {op}; I lose signal on the train.", themes: ["network"], sentiment: "negative" },
  { text: "The hotline took most of an hour to reach an agent about a wrong charge.", themes: ["support", "price_value"], sentiment: "negative" },
  { text: "The social media add-on from {op} is decent value if you mostly use messaging apps.", themes: ["price_value"], sentiment: "positive" },
  { text: "Speeds are fine but the fair-usage limit on the unlimited plan kicks in fast.", themes: ["network", "price_value"], sentiment: "mixed" },
  { text: "Branch staff sorted my SIM swap quickly, no complaints.", themes: ["support"], sentiment: "positive" },
];

const HOME: Account[] = [
  { text: "Our Air Fibre connection was installed within a week and evenings are stable.", themes: ["install_availability", "network"], sentiment: "positive", product: "Air Fibre", productEvidence: "Our Air Fibre connection" },
  { text: "Still waiting for a technician three weeks after paying for the home router.", themes: ["install_availability", "support"], sentiment: "negative" },
  { text: "Home broadband from them is cheaper than fibre in our area but slows down at night.", themes: ["price_value", "network"], sentiment: "mixed" },
  { text: "We kept the 4G home router as a backup when fibre reached our road.", themes: ["switching", "network"], sentiment: "mixed", switching: "Kept as a backup after fibre arrived" },
  { text: "The anytime and night data split on the home plan makes it poor value for working from home.", themes: ["price_value"], sentiment: "negative" },
  { text: "Air Fibre speeds dropped after heavy rain until they re-aligned the antenna.", themes: ["network", "support"], sentiment: "mixed", product: "Air Fibre", productEvidence: "Air Fibre speeds" },
  { text: "Switched from fibre to their home broadband because fibre was never offered on our lane.", themes: ["switching", "install_availability"], sentiment: "positive", switching: "Chose wireless home broadband where fibre was unavailable" },
];

const FIBRE: Account[] = [
  { text: "IslandNet Fibre is fast and steady but the connection fee was high.", themes: ["network", "price_value"], sentiment: "mixed" },
  { text: "Fibre is not available on our lane yet even though the next street has it.", themes: ["install_availability"], sentiment: "negative" },
  { text: "Moved to IslandNet Fibre from a 4G router and video calls stopped freezing.", themes: ["switching", "network"], sentiment: "positive", switching: "Moved from a 4G router to fibre" },
  { text: "An outage lasted two days and the complaint line kept closing the ticket.", themes: ["support", "network"], sentiment: "negative" },
  { text: "The unlimited fibre plan is good value for a family that streams a lot.", themes: ["price_value"], sentiment: "positive" },
];

const SAT: Account[] = [
  { text: "Orbit Satellite works well at our estate where no fibre or 4G reaches.", themes: ["install_availability", "network"], sentiment: "positive" },
  { text: "The satellite kit cost a lot upfront compared with local broadband.", themes: ["price_value"], sentiment: "negative" },
  { text: "We use Orbit Satellite as a backup during monsoon outages.", themes: ["switching", "network"], sentiment: "mixed", switching: "Backup connection during outages" },
];

export interface SampleOptions {
  /** End of the collection window (YYYY-MM-DD). */
  collectionDate: string;
  /** Leave the last N included rows without themes/sentiment, for the AI-assisted coding queue. */
  uncoded?: number;
  /** Smaller set for the end-to-end test. */
  small?: boolean;
  /** Omit coding columns entirely (the e2e test codes everything in the app). */
  noCoding?: boolean;
}

const shiftDays = (iso: string, days: number) => new Date(Date.parse(iso + "T00:00:00Z") - days * 86_400_000).toISOString().slice(0, 10);

/** Rows keyed by the import headers (IMPORT_FIELDS in src/lib/evidence/import.ts). */
export function sampleRows(o: SampleOptions): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  let n = 0;
  let contributor = 0;
  const add = (op: string, product: string, platform: string, a: Account, i: number, extra: Partial<Record<string, string | number>> = {}) => {
    n++;
    const thread = platform === "Reddit" ? `RD-${op.slice(0, 3).toUpperCase()}-${Math.floor(i / 3) + 1}` : "";
    rows.push({
      "Record ID": `R${String(n).padStart(3, "0")}`,
      Platform: platform,
      "Source URL": platform === "Reddit" ? `https://www.reddit.com/r/example/comments/demo${n}` : `https://play.google.com/store/apps/details?id=demo.${op.replace(/\W+/g, "").toLowerCase()}`,
      "Review/post date": shiftDays(o.collectionDate, 5 + ((n * 7) % 160)),
      "Collection date": o.collectionDate,
      "Thread ID": thread,
      "Contributor ref": `T0${(n % 4) + 1}-C${++contributor}`,
      Operator: op,
      "Service/product": a.product ?? product,
      "Product evidence": a.productEvidence ?? "",
      "Sri Lankan experience (Yes/No)": "Yes",
      "Star rating": platform === "Google Play" ? (a.sentiment === "positive" ? 5 : a.sentiment === "mixed" ? 3 : 1) : "",
      "Relevant text or paraphrase": a.text.replace("{op}", op),
      Language: "English",
      "English translation": "",
      "Theme(s)": o.noCoding ? "" : a.themes.join("; "),
      Sentiment: o.noCoding ? "" : a.sentiment,
      "Switching (Yes/No)": o.noCoding ? "" : a.switching ? "Yes" : "No",
      "Switching explanation": o.noCoding ? "" : (a.switching ?? ""),
      "Included (Yes/No)": "Yes",
      "Inclusion/exclusion note": "",
      ...extra,
    });
  };
  const pick = (pool: Account[], count: number, op: string, product: string, platform: string, offset = 0) => {
    for (let i = 0; i < count; i++) add(op, product, platform, pool[(i + offset) % pool.length], i);
  };

  const k = o.small ? 0.4 : 1;
  const c = (x: number) => Math.max(3, Math.round(x * k));
  pick(APP, c(22), "Serendib", "App", "Google Play");
  pick(APP, c(20), "Lanka Mobile", "App", "Google Play", 3);
  pick(APP, c(20), "Coastline Wireless", "App", "Google Play", 6);
  pick(MOBILE, c(12), "Serendib", "Mobile", "Reddit");
  pick(MOBILE, c(10), "Lanka Mobile", "Mobile", "Reddit", 2);
  pick(MOBILE, c(8), "Coastline Wireless", "Mobile", "Reddit", 4);
  pick(HOME, c(14), "Serendib Home Broadband / Air Fibre", "Home broadband", "Reddit");
  pick(FIBRE, c(12), "IslandNet Fibre", "Fibre", "Reddit");
  pick(SAT, c(5), "Orbit Satellite", "Satellite", "Reddit");

  // Records the team excludes, with the reason.
  add("Orbit Satellite", "Satellite", "Reddit", { text: "Great speeds with Orbit Satellite at my place in Perth.", themes: [], sentiment: "positive" }, 0, {
    "Sri Lankan experience (Yes/No)": "No",
    "Theme(s)": "",
    Sentiment: "",
    "Included (Yes/No)": "No",
    "Inclusion/exclusion note": "overseas: experience outside Sri Lanka",
  });
  add("Lanka Mobile", "Mobile", "Reddit", { text: "My cousin says their network is the worst, but I have never used it.", themes: [], sentiment: "unclear" }, 1, {
    "Theme(s)": "",
    Sentiment: "",
    "Included (Yes/No)": "No",
    "Inclusion/exclusion note": "hearsay: not the writer's own experience",
  });
  add("Serendib", "Mobile", "Reddit", { text: "Serendib data was great last year before the plan changes.", themes: ["price_value"], sentiment: "mixed" }, 2, {
    "Review/post date": shiftDays(o.collectionDate, 260),
  });

  if (o.uncoded) {
    const included = rows.filter((r) => r["Included (Yes/No)"] === "Yes" && r["Theme(s)"]);
    for (const r of included.slice(-o.uncoded)) {
      r["Theme(s)"] = "";
      r.Sentiment = "";
      r["Switching (Yes/No)"] = "";
      r["Switching explanation"] = "";
    }
  }
  return rows;
}
