import type { Platform, Product, ReportSection } from "../types";

/** A study template is plain data; "New study" copies it into editable rows (PLAN2 §6). */
export interface StudyTemplate {
  key: string;
  name: string;
  description: string;
  windowMonths: number;
  questions: { question: string; reportSection: ReportSection }[];
  groups: { name: string; entities: { name: string; isSubject?: boolean; requiresGeoCheck?: boolean }[] }[];
  themes: { key: string; label: string; description: string; investmentRelevance: string }[];
  targets: { label: string; group: string | null; product: Product | null; platform: Platform | null; perEntity: boolean; min: number; max: number }[];
  searchTermPattern: string[];
  platforms: { platform: Platform; decision: "pending" | "selected" | "excluded"; reason: string | null; sortMethod: string | null; coverageNote: string | null }[];
  teamSplit: string;
}

export const telecomSl: StudyTemplate = {
  key: "telecom-sl",
  name: "Sri Lankan telecom — mobile and home broadband",
  description: "Dialog vs Mobitel and Hutch (mobile), and Dialog Home Broadband / Air Fibre vs SLT Fibre and Starlink (home broadband).",
  windowMonths: 6,
  questions: [
    { question: "What experiences explain or challenge the subject's weak value-for-money perception?", reportSection: "value_perception" },
    { question: "Why do users choose another operator for data or switch providers?", reportSection: "multi_sim_moat" },
    { question: "What trade-offs influence home-broadband choices between Dialog, SLT and Starlink?", reportSection: "fixed_broadband" },
  ],
  groups: [
    { name: "Mobile", entities: [{ name: "Dialog", isSubject: true }, { name: "Mobitel" }, { name: "Hutch" }] },
    {
      name: "Home broadband",
      entities: [{ name: "Dialog Home Broadband / Air Fibre", isSubject: true }, { name: "SLT Fibre" }, { name: "Starlink", requiresGeoCheck: true }],
    },
  ],
  themes: [
    { key: "price_value", label: "Price and value", description: "Package prices, data value, hidden charges.", investmentRelevance: "Pricing power and affordability" },
    { key: "network", label: "Network experience", description: "Coverage, speed, reliability.", investmentRelevance: "Perceived network differentiation" },
    { key: "billing_app", label: "Billing and app experience", description: "Self-care app, bills, reloads, top-ups.", investmentRelevance: "Customer-experience execution" },
    { key: "support", label: "Customer support", description: "Hotline, branches, complaint handling.", investmentRelevance: "Trust and retention" },
    { key: "switching", label: "Switching / multi-provider use", description: "Moving provider or keeping a second SIM or connection.", investmentRelevance: "Data-share retention and substitution" },
    { key: "install_availability", label: "Installation and availability", description: "Getting connected, coverage of fixed products.", investmentRelevance: "Air Fibre / SLT / Starlink positioning" },
  ],
  targets: [
    { label: "Mobile self-care app reviews", group: "Mobile", product: "app", platform: "google_play", perEntity: true, min: 20, max: 20 },
    { label: "Broader mobile experiences", group: "Mobile", product: "mobile", platform: null, perEntity: false, min: 20, max: 30 },
    { label: "Home-broadband experiences", group: "Home broadband", product: null, platform: null, perEntity: false, min: 15, max: 30 },
    { label: "Overall guide", group: null, product: null, platform: null, perEntity: false, min: 95, max: 120 },
  ],
  searchTermPattern: ["{operator} value", "{operator} speed", "{operator} switching", "{operator} customer service", "{operator} home broadband"],
  platforms: [
    { platform: "google_play", decision: "selected", reason: "Each operator's self-care app reviews.", sortMethod: "Most recent", coverageNote: null },
    { platform: "reddit", decision: "selected", reason: "First-hand discussion of value, speed and switching.", sortMethod: "Relevance, then newest", coverageNote: null },
    { platform: "trustpilot", decision: "pending", reason: null, sortMethod: null, coverageNote: null },
    { platform: "facebook", decision: "pending", reason: null, sortMethod: null, coverageNote: "Use only to fill the Sri Lankan Starlink gap." },
    { platform: "google_maps", decision: "excluded", reason: "Branch experience is not a research question in this study.", sortMethod: null, coverageNote: null },
  ],
  teamSplit: "Suggested split: one mobile collector (app reviews and mobile discussions) and one broadband collector (Dialog, SLT, Starlink). Budget about 3–4 team hours for collection and coding.",
};

/**
 * The same study design with fictional operators, for the demo company (Serendib Telecom) in the seed
 * and the end-to-end test. Keeps synthetic customer accounts away from real operators' names.
 */
const DEMO_NAMES: [RegExp, string][] = [
  [/Dialog/g, "Serendib"],
  [/Mobitel/g, "Lanka Mobile"],
  [/Hutch/g, "Coastline Wireless"],
  [/SLT/g, "IslandNet"],
  [/Starlink/g, "Orbit Satellite"],
];
export const telecomSlDemo: StudyTemplate = {
  ...(JSON.parse(DEMO_NAMES.reduce((s, [re, to]) => s.replace(re, to), JSON.stringify(telecomSl))) as StudyTemplate),
  key: "telecom-sl-demo",
  name: "Demo — fictional telecom operators (sample data)",
  description: "The telecom design with fictional operators: Serendib vs Lanka Mobile and Coastline Wireless (mobile); Serendib Home Broadband / Air Fibre vs IslandNet Fibre and Orbit Satellite (home broadband).",
};

export const TEMPLATES: Record<string, StudyTemplate> = { [telecomSl.key]: telecomSl, [telecomSlDemo.key]: telecomSlDemo };

/** {operator} + value | speed | … for each entity in the template. */
export function searchTermsFor(t: StudyTemplate): string[] {
  const names = [...new Set(t.groups.flatMap((g) => g.entities.map((e) => e.name.split(" /")[0])))];
  return names.flatMap((n) => t.searchTermPattern.map((p) => p.replace("{operator}", n)));
}
