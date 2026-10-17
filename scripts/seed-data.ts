/**
 * Sample data for the seed script. Companies, logos and headline figures come from the design
 * handoff (design/autovise-design). All companies are fictional.
 */

export interface SeedSector {
  name: string;
  pe: number;
  growth: number;
  roe: number;
  notes: string;
}

export const SECTORS: SeedSector[] = [
  { name: "Logistics", pe: 11.8, growth: 0.084, roe: 0.123, notes: "Median of 7 listed logistics peers." },
  { name: "Telecommunications", pe: 14.0, growth: 0.06, roe: 0.12, notes: "Mobile and fixed operators." },
  { name: "Plantations", pe: 9.5, growth: 0.03, roe: 0.09, notes: "Tea and rubber estates." },
  { name: "Banking", pe: 8.5, growth: 0.09, roe: 0.14, notes: "Licensed commercial banks. Debt/equity is not meaningful." },
  { name: "Manufacturing", pe: 11.0, growth: 0.07, roe: 0.11, notes: "Building materials and industrials." },
  { name: "Leisure", pe: 16.0, growth: 0.1, roe: 0.08, notes: "Hotels and travel." },
  { name: "Energy", pe: 9.0, growth: 0.05, roe: 0.1, notes: "Power generation and distribution." },
  { name: "Healthcare", pe: 15.0, growth: 0.08, roe: 0.12, notes: "Pharmaceuticals and hospitals." },
];

export type Cat = "management" | "strategy" | "outlook" | "risk" | "governance" | "esg" | "market" | "capital_allocation";

export interface SeedInsight {
  report: string; // report key
  category: Cat;
  summary: string;
  sentiment: number;
  impact: "low" | "med" | "high";
  quote: string;
  page: number;
}

export interface SeedYear {
  year: number;
  eps: number;
  dps: number;
  /** Revenue in LKR million; derived from the net margin when omitted. */
  revenue?: number;
  netMargin: number;
  roe: number;
  de: number | null;
}

export interface SeedReport {
  key: string;
  title: string;
  type: "annual" | "quarterly" | "interim" | "other";
  fiscalYear: number;
  fiscalPeriod: string;
  periodEnd: string;
  /** Status of the current version after seeding. */
  status: "approved" | "review" | "failed";
  /** Years whose full-year statements the report carries (current, then comparative). */
  years?: number[];
  quarter?: { period: "Q2"; year: number; eps: number; revenue: number; netIncome: number; equity: number; debt: number | null };
  /** Earlier version replaced by the current one. */
  previousVersion?: { fileName: string; note: string; uploadedDaysAgo: number };
  note?: string;
  error?: string;
  uploadedDaysAgo: number;
  approveLater?: boolean;
}

export interface SeedCompany {
  ticker: string;
  name: string;
  sector: string;
  color: string;
  logo: string | null;
  logoDark: string | null;
  logoBg: "light" | "dark" | "transparent";
  logoShape: "square" | "round" | "tall" | "wide";
  description: string;
  website: string;
  price: number;
  priceDaysAgo: number;
  sharesMn: number;
  status: "published" | "draft";
  years: SeedYear[];
  reports: SeedReport[];
  insights: SeedInsight[];
  events: { daysAgo: number; title: string; body: string; sentiment: number }[];
  /** Past predictions for the track record: when made, price then, price 12 months later. */
  track: { made: string; start: number; actual: number }[];
}

const AR = (y: number, status: SeedReport["status"] = "approved", extra: Partial<SeedReport> = {}): SeedReport => ({
  key: `AR${y}`,
  title: `Annual Report ${y}`,
  type: "annual",
  fiscalYear: y,
  fiscalPeriod: `FY${y}`,
  periodEnd: `${y}-12-31`,
  status,
  years: [y, y - 1],
  uploadedDaysAgo: Math.max(5, (2026 - y) * 365 - 100),
  ...extra,
});

export const COMPANIES: SeedCompany[] = [
  {
    ticker: "LHL",
    name: "Lanka Harbour Logistics",
    sector: "Logistics",
    color: "#1F4E8C",
    logo: "/logos/lhl.svg",
    logoDark: "/logos/lhl-dark.svg",
    logoBg: "transparent",
    logoShape: "square",
    description: "Port terminal operator and contract logistics group serving the main shipping lines calling at Colombo.",
    website: "https://example.com/lhl",
    price: 245.5,
    priceDaysAgo: 1,
    sharesMn: 156.04,
    status: "published",
    years: [
      { year: 2021, eps: 10.51, dps: 3.5, revenue: 18420, netMargin: 0.089, roe: 0.142, de: 0.62 },
      { year: 2022, eps: 12.24, dps: 4.0, revenue: 21060, netMargin: 0.091, roe: 0.151, de: 0.58 },
      { year: 2023, eps: 14.62, dps: 4.8, revenue: 24880, netMargin: 0.092, roe: 0.158, de: 0.55 },
      { year: 2024, eps: 16.22, dps: 5.4, revenue: 27310, netMargin: 0.093, roe: 0.164, de: 0.49 },
      { year: 2025, eps: 18.2, dps: 6.2, revenue: 30940, netMargin: 0.092, roe: 0.169, de: 0.44 },
    ],
    reports: [
      AR(2022, "approved", { uploadedDaysAgo: 920 }),
      AR(2023, "approved", { uploadedDaysAgo: 554 }),
      AR(2024, "approved", { uploadedDaysAgo: 557 - 365 + 180 }),
      AR(2025, "approved", {
        uploadedDaysAgo: 198,
        previousVersion: { fileName: "LHL_Annual_Report_2025.pdf", note: "Original filing.", uploadedDaysAgo: 217 },
        note: "Restated note 34 (lease liabilities).",
      }),
      {
        key: "Q2_2026",
        title: "Q2 2026 Interim Report",
        type: "quarterly",
        fiscalYear: 2026,
        fiscalPeriod: "Apr–Jun 2026",
        periodEnd: "2026-06-30",
        status: "review",
        approveLater: true,
        quarter: { period: "Q2", year: 2026, eps: 4.94, revenue: 8214, netIncome: 771, equity: 17940, debt: 7530 },
        uploadedDaysAgo: 0,
      },
    ],
    insights: [
      { report: "AR2025", category: "outlook", summary: "Container throughput rose 14% to a record 1.92 million TEU in 2025.", sentiment: 0.7, impact: "high", quote: "Container throughput handled across our terminals rose 14% to 1.92 million TEU, the highest in the Group's history.", page: 3 },
      { report: "AR2025", category: "strategy", summary: "Contract logistics and warehousing now make up 31% of revenue, up from 24% in 2023.", sentiment: 0.6, impact: "med", quote: "Contract logistics and warehousing contributed 31% of Group revenue (2023: 24%), reflecting the commissioning of 85,000 sq ft of new capacity.", page: 3 },
      { report: "AR2025", category: "management", summary: "Revenue rose 13.3% and profit to shareholders 12.3% in 2025.", sentiment: 0.5, impact: "med", quote: "Group revenue rose 13.3% to LKR 30.9 bn, while profit attributable to shareholders increased 12.3% to LKR 2.84 bn.", page: 2 },
      { report: "AR2025", category: "risk", summary: "The three largest shipping-line customers account for 46% of throughput.", sentiment: -0.6, impact: "high", quote: "Our three largest shipping-line customers together accounted for 46% of throughput in 2025.", page: 4 },
      { report: "AR2025", category: "risk", summary: "About 38% of operating costs are linked to the US dollar.", sentiment: -0.4, impact: "med", quote: "Approximately 38% of operating costs are denominated in or linked to the US dollar, principally fuel, equipment leases and spares.", page: 4 },
      { report: "AR2025", category: "governance", summary: "Majority-independent board; one related-party lease disclosed.", sentiment: 0.3, impact: "low", quote: "Five of the nine directors are independent non-executive directors. One property lease with a related party is disclosed in Note 38.", page: 4 },
      { report: "Q2_2026", category: "outlook", summary: "The new Kelaniya warehouse opened in May and was 74% occupied by quarter end.", sentiment: 0.6, impact: "med", quote: "The Kelaniya facility commenced operations on 12 May 2026 and was 74% occupied by 30 June.", page: 2 },
      { report: "Q2_2026", category: "management", summary: "Full-year throughput growth guidance reaffirmed at 10–12%.", sentiment: 0.5, impact: "high", quote: "We reaffirm our expectation of 10 to 12 per cent growth in throughput for the full year.", page: 2 },
      { report: "Q2_2026", category: "risk", summary: "Fuel costs grew faster than revenue in the quarter.", sentiment: -0.4, impact: "med", quote: "Fuel costs increased 19% year on year, outpacing revenue growth of 12%.", page: 3 },
      { report: "Q2_2026", category: "capital_allocation", summary: "The board will review the dividend policy before the 2027 AGM.", sentiment: 0.1, impact: "low", quote: "The Board intends to review the dividend policy ahead of the 2027 Annual General Meeting.", page: 3 },
    ],
    events: [{ daysAgo: 40, title: "Five-year berth agreement signed with a regional feeder line", body: "LHL announced a five-year berthing agreement with a regional feeder operator starting January 2027.", sentiment: 0.5 }],
    track: [
      { made: "2024-10-15", start: 198.2, actual: 228.4 },
      { made: "2025-04-15", start: 214.0, actual: 239.2 },
    ],
  },
  {
    ticker: "STEL",
    name: "Serendib Telecom",
    sector: "Telecommunications",
    color: "#0E9384",
    logo: "/logos/serendib.svg",
    logoDark: "/logos/serendib-dark.svg",
    logoBg: "transparent",
    logoShape: "wide",
    description: "Mobile, broadband and enterprise connectivity provider with national 4G coverage and a growing fibre network.",
    website: "https://example.com/stel",
    price: 112.25,
    priceDaysAgo: 1,
    sharesMn: 820,
    status: "published",
    years: [
      { year: 2021, eps: 5.8, dps: 3.6, netMargin: 0.108, roe: 0.128, de: 1.05 },
      { year: 2022, eps: 6.15, dps: 3.8, netMargin: 0.111, roe: 0.131, de: 1.01 },
      { year: 2023, eps: 6.55, dps: 4.1, netMargin: 0.113, roe: 0.134, de: 0.98 },
      { year: 2024, eps: 6.98, dps: 4.35, netMargin: 0.115, roe: 0.136, de: 0.95 },
      { year: 2025, eps: 7.38, dps: 4.6, netMargin: 0.116, roe: 0.138, de: 0.92 },
    ],
    reports: [AR(2022), AR(2023), AR(2024), AR(2025), { key: "Q2_2026", title: "Q2 2026 Interim Report", type: "quarterly", fiscalYear: 2026, fiscalPeriod: "Apr–Jun 2026", periodEnd: "2026-06-30", status: "approved", quarter: { period: "Q2", year: 2026, eps: 1.92, revenue: 13350, netIncome: 1574, equity: 44600, debt: 40100 }, uploadedDaysAgo: 2 }],
    insights: [
      { report: "AR2025", category: "strategy", summary: "Fibre-to-the-home connections grew 38% to 412,000 homes.", sentiment: 0.6, impact: "med", quote: "Fibre-to-the-home connections increased 38% during the year to reach 412,000 homes.", page: 3 },
      { report: "AR2025", category: "market", summary: "Mobile market share held at 41% despite price competition.", sentiment: 0.3, impact: "med", quote: "We maintained a 41% share of active mobile subscriptions in a market marked by aggressive data pricing.", page: 3 },
      { report: "AR2025", category: "risk", summary: "Spectrum renewal fees are due in 2027 and are not yet set.", sentiment: -0.4, impact: "med", quote: "The renewal fee for our 1800 MHz spectrum licence, due in 2027, has not yet been determined by the regulator.", page: 4 },
      { report: "AR2025", category: "capital_allocation", summary: "Capex will fall to about 18% of revenue as the 4G build-out completes.", sentiment: 0.4, impact: "med", quote: "We expect capital expenditure to moderate to around 18% of revenue as the national 4G programme concludes.", page: 2 },
      { report: "Q2_2026", category: "outlook", summary: "Enterprise revenue grew 15% in the quarter.", sentiment: 0.4, impact: "low", quote: "Enterprise solutions revenue grew 15% year on year, led by managed connectivity contracts.", page: 2 },
    ],
    events: [],
    track: [
      { made: "2024-10-15", start: 98.5, actual: 104.1 },
      { made: "2025-04-08", start: 104.6, actual: 126.7 },
    ],
  },
  {
    ticker: "KHT",
    name: "Kandy Highland Tea",
    sector: "Plantations",
    color: "#3F7D3A",
    logo: "/logos/kht.svg",
    logoDark: "/logos/kht-dark.svg",
    logoBg: "transparent",
    logoShape: "round",
    description: "High-grown tea estates in the central hills, selling through the Colombo auction and direct export contracts.",
    website: "https://example.com/kht",
    price: 86.1,
    priceDaysAgo: 2,
    sharesMn: 60,
    status: "published",
    years: [
      { year: 2021, eps: 11.2, dps: 5.0, netMargin: 0.081, roe: 0.104, de: 0.32 },
      { year: 2022, eps: 12.4, dps: 5.5, netMargin: 0.085, roe: 0.109, de: 0.3 },
      { year: 2023, eps: 10.9, dps: 5.0, netMargin: 0.072, roe: 0.094, de: 0.34 },
      { year: 2024, eps: 9.85, dps: 4.9, netMargin: 0.066, roe: 0.086, de: 0.36 },
      { year: 2025, eps: 9.16, dps: 4.82, netMargin: 0.062, roe: 0.081, de: 0.38 },
    ],
    reports: [
      AR(2022),
      AR(2023),
      AR(2024),
      AR(2025),
      { key: "Q2_2026", title: "Q2 2026 Interim Report", type: "quarterly", fiscalYear: 2026, fiscalPeriod: "Apr–Jun 2026", periodEnd: "2026-06-30", status: "review", approveLater: true, quarter: { period: "Q2", year: 2026, eps: 2.05, revenue: 2140, netIncome: 123, equity: 6850, debt: 2700 }, uploadedDaysAgo: 1 },
    ],
    insights: [
      { report: "AR2025", category: "risk", summary: "Unseasonal rain cut crop volumes by 9% in 2025.", sentiment: -0.6, impact: "high", quote: "Unseasonal rainfall in the second and third quarters reduced crop volumes by 9% compared with 2024.", page: 3 },
      { report: "AR2025", category: "market", summary: "Average auction prices fell 6% while wage costs rose 11%.", sentiment: -0.5, impact: "high", quote: "Average Colombo auction prices for our high-grown teas declined 6%, while estate wage costs rose 11% following the wage settlement.", page: 2 },
      { report: "AR2025", category: "strategy", summary: "Direct export contracts are 22% of volume and growing.", sentiment: 0.4, impact: "med", quote: "Direct export contracts with specialty buyers accounted for 22% of volumes, up from 15% two years ago.", page: 3 },
      { report: "AR2025", category: "governance", summary: "Long-serving board with a newly appointed independent chair.", sentiment: 0.2, impact: "low", quote: "An independent non-executive chairman was appointed in March, completing the separation of the chair and chief executive roles.", page: 4 },
      { report: "Q2_2026", category: "outlook", summary: "Management guides to lower yields in the second half.", sentiment: -0.5, impact: "med", quote: "Based on current weather patterns, we expect yields in the second half to remain below last year's levels.", page: 2 },
      { report: "Q2_2026", category: "risk", summary: "Weather risk flagged as the main uncertainty for the year.", sentiment: -0.4, impact: "med", quote: "Weather remains the principal uncertainty for full-year results.", page: 3 },
    ],
    events: [{ daysAgo: 25, title: "Estate wage agreement extended", body: "The industry-wide wage agreement was extended by two years with a 7% annual increment.", sentiment: -0.3 }],
    track: [{ made: "2024-10-22", start: 92.4, actual: 81.2 }],
  },
  {
    ticker: "CCB",
    name: "Colombo Capital Bank",
    sector: "Banking",
    color: "#8B1E3F",
    logo: "/logos/ccb.svg",
    logoDark: null,
    logoBg: "light",
    logoShape: "tall",
    description: "Licensed commercial bank focused on SME and retail lending, with 140 branches across the island.",
    website: "https://example.com/ccb",
    price: 402,
    priceDaysAgo: 1,
    sharesMn: 300,
    status: "published",
    years: [
      { year: 2021, eps: 30.2, dps: 10.0, netMargin: 0.198, roe: 0.138, de: null },
      { year: 2022, eps: 33.8, dps: 11.5, netMargin: 0.203, roe: 0.142, de: null },
      { year: 2023, eps: 38.4, dps: 12.8, netMargin: 0.209, roe: 0.147, de: null },
      { year: 2024, eps: 42.6, dps: 14.2, netMargin: 0.214, roe: 0.151, de: null },
      { year: 2025, eps: 46.74, dps: 15.5, netMargin: 0.218, roe: 0.154, de: null },
    ],
    reports: [AR(2022), AR(2023), AR(2024), AR(2025)],
    insights: [
      { report: "AR2025", category: "management", summary: "Cost-to-income ratio improved to 41% from 44%.", sentiment: 0.5, impact: "med", quote: "Our cost-to-income ratio improved to 41% from 44% a year earlier, reflecting branch automation.", page: 2 },
      { report: "AR2025", category: "risk", summary: "Stage 3 loans eased to 3.1% of the book.", sentiment: 0.3, impact: "med", quote: "Stage 3 loans as a proportion of gross loans declined to 3.1% (2024: 3.6%).", page: 4 },
      { report: "AR2025", category: "governance", summary: "Capital ratios comfortably above the regulatory minimum.", sentiment: 0.4, impact: "med", quote: "The Total Capital Ratio stood at 16.8%, well above the regulatory minimum of 12.5%.", page: 4 },
      { report: "AR2025", category: "strategy", summary: "Digital channels now handle 71% of transactions.", sentiment: 0.4, impact: "low", quote: "Digital channels accounted for 71% of customer transactions during the year.", page: 3 },
    ],
    events: [],
    track: [
      { made: "2024-11-12", start: 341, actual: 366.8 },
      { made: "2025-05-20", start: 359, actual: 388.5 },
    ],
  },
  {
    ticker: "RCEM",
    name: "Ruhuna Cement",
    sector: "Manufacturing",
    color: "#9A6A2F",
    logo: null,
    logoDark: null,
    logoBg: "transparent",
    logoShape: "square",
    description: "Integrated cement producer in the southern province supplying housing and infrastructure projects.",
    website: "https://example.com/rcem",
    price: 58.7,
    priceDaysAgo: 1,
    sharesMn: 410,
    status: "published",
    years: [
      { year: 2021, eps: 3.95, dps: 1.3, netMargin: 0.079, roe: 0.104, de: 0.74 },
      { year: 2022, eps: 4.4, dps: 1.45, netMargin: 0.081, roe: 0.107, de: 0.71 },
      { year: 2023, eps: 4.62, dps: 1.6, netMargin: 0.08, roe: 0.106, de: 0.7 },
      { year: 2024, eps: 5.05, dps: 1.75, netMargin: 0.083, roe: 0.109, de: 0.68 },
      { year: 2025, eps: 5.44, dps: 1.88, netMargin: 0.084, roe: 0.112, de: 0.66 },
    ],
    reports: [
      AR(2022),
      AR(2023),
      AR(2024),
      AR(2025),
      { key: "AR2025_SEG", title: "Annual Report 2025 — segment data", type: "other", fiscalYear: 2025, fiscalPeriod: "FY2025", periodEnd: "2025-12-31", status: "failed", error: "Pages 41–44 are scanned images — no readable text.", uploadedDaysAgo: 0 },
    ],
    insights: [
      { report: "AR2025", category: "outlook", summary: "Government road programme expected to lift cement demand.", sentiment: 0.5, impact: "med", quote: "The expanded national road programme is expected to lift domestic cement demand over the next three years.", page: 3 },
      { report: "AR2025", category: "risk", summary: "Coal and power costs remain volatile.", sentiment: -0.4, impact: "med", quote: "Energy costs, principally imported coal and grid electricity, remain the largest source of margin volatility.", page: 4 },
      { report: "AR2025", category: "esg", summary: "Waste-heat recovery plant cut grid power use by 12%.", sentiment: 0.3, impact: "low", quote: "The waste-heat recovery plant commissioned in 2025 reduced grid electricity consumption by 12%.", page: 3 },
    ],
    events: [],
    track: [{ made: "2024-11-19", start: 52.1, actual: 49.3 }],
  },
  {
    ticker: "GBH",
    name: "Galle Bay Hotels",
    sector: "Leisure",
    color: "#C2410C",
    logo: "/logos/gbh.svg",
    logoDark: "/logos/gbh-dark.svg",
    logoBg: "transparent",
    logoShape: "wide",
    description: "Owner-operator of five beach resorts on the south coast, recovering strongly with tourist arrivals.",
    website: "https://example.com/gbh",
    price: 33.4,
    priceDaysAgo: 3,
    sharesMn: 1200,
    status: "published",
    years: [
      { year: 2021, eps: -0.85, dps: 0, netMargin: -0.12, roe: -0.05, de: 1.42 },
      { year: 2022, eps: 0.35, dps: 0, netMargin: 0.04, roe: 0.017, de: 1.35 },
      { year: 2023, eps: 1.05, dps: 0.2, netMargin: 0.09, roe: 0.049, de: 1.26 },
      { year: 2024, eps: 1.48, dps: 0.3, netMargin: 0.112, roe: 0.067, de: 1.19 },
      { year: 2025, eps: 1.82, dps: 0.4, netMargin: 0.125, roe: 0.079, de: 1.14 },
    ],
    reports: [AR(2022), AR(2023), AR(2024), AR(2025)],
    insights: [
      { report: "AR2025", category: "market", summary: "Tourist arrivals reached 2.1 million, a new record.", sentiment: 0.6, impact: "high", quote: "Tourist arrivals reached 2.1 million in 2025, surpassing the previous record set in 2018.", page: 2 },
      { report: "AR2025", category: "outlook", summary: "Average room rates rose 18% with occupancy at 74%.", sentiment: 0.5, impact: "med", quote: "Average daily room rates increased 18% while occupancy across the portfolio reached 74%.", page: 3 },
      { report: "AR2025", category: "risk", summary: "High leverage from the resort refurbishment programme.", sentiment: -0.5, impact: "high", quote: "Borrowings taken for the refurbishment programme leave the Group with a debt to equity ratio above one.", page: 4 },
      { report: "AR2025", category: "risk", summary: "Earnings are sensitive to travel advisories and global shocks.", sentiment: -0.4, impact: "med", quote: "Our earnings remain highly sensitive to travel advisories and global events affecting long-haul travel.", page: 4 },
    ],
    events: [{ daysAgo: 60, title: "New Galle Fort boutique property announced", body: "GBH plans a 40-key boutique hotel inside Galle Fort, opening in late 2027.", sentiment: 0.3 }],
    track: [{ made: "2024-12-10", start: 27.8, actual: 30.1 }],
  },
  {
    ticker: "MPWR",
    name: "Meridian Power",
    sector: "Energy",
    color: "#6D28D9",
    logo: null,
    logoDark: null,
    logoBg: "transparent",
    logoShape: "square",
    description: "Independent power producer running hydro, wind and solar plants under long-term purchase agreements.",
    website: "https://example.com/mpwr",
    price: 19.8,
    priceDaysAgo: 1,
    sharesMn: 2100,
    status: "published",
    years: [
      { year: 2024, eps: 1.88, dps: 0.9, netMargin: 0.21, roe: 0.098, de: 0.85 },
      { year: 2025, eps: 2.1, dps: 1.0, netMargin: 0.22, roe: 0.104, de: 0.81 },
    ],
    reports: [AR(2025, "review", { uploadedDaysAgo: 0 })],
    insights: [
      { report: "AR2025", category: "strategy", summary: "120 MW of solar capacity will be added by 2028.", sentiment: 0.5, impact: "high", quote: "We will add 120 MW of solar capacity by 2028 under newly signed purchase agreements.", page: 3 },
      { report: "AR2025", category: "risk", summary: "Hydro output depends on monsoon rainfall.", sentiment: -0.3, impact: "med", quote: "Hydro generation, 46% of output, depends on monsoon rainfall in the central catchments.", page: 4 },
    ],
    events: [],
    track: [],
  },
  {
    ticker: "IPL",
    name: "Island Pharma Labs",
    sector: "Healthcare",
    color: "#0284C7",
    logo: "/logos/ipl.svg",
    logoDark: null,
    logoBg: "dark",
    logoShape: "square",
    description: "Generic medicines manufacturer supplying state hospitals and pharmacies, with a growing export business.",
    website: "https://example.com/ipl",
    price: 167,
    priceDaysAgo: 45,
    sharesMn: 95,
    status: "published",
    years: [
      { year: 2020, eps: 8.1, dps: 2.4, netMargin: 0.094, roe: 0.098, de: 0.36 },
      { year: 2021, eps: 9.02, dps: 2.6, netMargin: 0.097, roe: 0.1, de: 0.34 },
      { year: 2022, eps: 9.95, dps: 2.9, netMargin: 0.099, roe: 0.102, de: 0.32 },
      { year: 2023, eps: 10.9, dps: 3.1, netMargin: 0.101, roe: 0.104, de: 0.3 },
      { year: 2024, eps: 11.84, dps: 3.34, netMargin: 0.103, roe: 0.106, de: 0.29 },
    ],
    reports: [AR(2022), AR(2023), AR(2024)],
    insights: [
      { report: "AR2024", category: "strategy", summary: "Export revenue grew 24%, led by Maldives and East Africa.", sentiment: 0.5, impact: "med", quote: "Export revenue increased 24%, with the strongest growth in the Maldives and East Africa.", page: 3 },
      { report: "AR2024", category: "risk", summary: "State tender pricing pressure on 40% of revenue.", sentiment: -0.4, impact: "high", quote: "Around 40% of revenue comes from state tenders, where pricing remains under pressure.", page: 4 },
      { report: "AR2024", category: "governance", summary: "WHO-GMP certification renewed for the main plant.", sentiment: 0.4, impact: "med", quote: "Our Homagama plant successfully renewed its WHO-GMP certification during the year.", page: 4 },
    ],
    events: [],
    track: [{ made: "2025-01-14", start: 151, actual: 159.4 }],
  },
];

/** Sample visitor questions for the chat-insights screen. */
export const CHAT_SAMPLES: { ticker: string; q: string; a: string; vote: 1 | -1 | 0; reason?: string; note?: string; hoursAgo: number }[] = [
  { ticker: "LHL", q: "Why is the target above today's price?", a: "Mostly earnings growth: EPS is projected to rise over the three years, and the exit multiple eases toward the sector benchmark. [S1]", vote: 1, hoursAgo: 2 },
  { ticker: "LHL", q: "What's the biggest risk to this view?", a: "Customer concentration: the three largest shipping lines account for 46% of throughput. [S2]", vote: 1, hoursAgo: 5 },
  { ticker: "LHL", q: "What was LHL's revenue in Q2?", a: "LHL reported revenue of LKR 7,334 million for the second quarter…", vote: -1, reason: "Wrong number", note: "That is Q2 2025. The 2026 report says 8,214.", hoursAgo: 20 },
  { ticker: "CCB", q: "Is CCB's dividend safe?", a: "CCB paid LKR 15.50 per share in 2025, covered about three times by earnings…", vote: -1, reason: "Didn’t answer", note: "I asked about next year, not last year.", hoursAgo: 3 },
  { ticker: "MPWR", q: "When will Meridian Power get a prediction?", a: "Meridian Power's prediction is pending while its 2025 annual report is reviewed.", vote: -1, reason: "No date given", hoursAgo: 6 },
  { ticker: "IPL", q: "Why is IPL marked as outdated?", a: "IPL's latest approved report is the 2024 annual report, so the prediction does not reflect 2025 results.", vote: -1, reason: "Out of date", hoursAgo: 28 },
  { ticker: "STEL", q: "How does Serendib compare with its sector?", a: "Serendib trades above the sector P/E but earns a slightly higher return on equity.", vote: 1, hoursAgo: 9 },
  { ticker: "KHT", q: "Why is the KHT target below the price?", a: "Falling auction prices and higher wages have cut earnings for two years. [S1]", vote: 1, hoursAgo: 12 },
  { ticker: "GBH", q: "How much debt does Galle Bay Hotels have?", a: "Debt to equity is above one after the refurbishment programme. [S3]", vote: 0, hoursAgo: 30 },
  { ticker: "LHL", q: "How sensitive is the target to the P/E?", a: "Each 1.0× change in the exit P/E moves the target by roughly the year-three EPS.", vote: 1, hoursAgo: 40 },
];
