/** Shared plain types and labels for the customer-evidence module (docs/PLAN2.md). Client-safe. */

export const PLATFORMS = ["google_play", "reddit", "trustpilot", "facebook", "google_maps", "other"] as const;
export const PRODUCTS = ["mobile", "app", "home_broadband", "air_fibre", "fibre", "satellite", "unclear"] as const;
export const SENTIMENTS = ["positive", "mixed", "negative", "unclear"] as const;
export const LANGUAGES = ["en", "si", "ta", "mixed"] as const;
export const EXCLUSIONS = ["advert", "hearsay", "irrelevant", "duplicate", "out_of_window", "overseas", "not_first_hand", "other"] as const;
export const REPORT_SECTIONS = ["value_perception", "multi_sim_moat", "fixed_broadband", "investment_risks", "other"] as const;
export const STUDY_STATUSES = ["draft", "screening", "collecting", "coding", "checking", "complete"] as const;
export const CODING_STATUSES = ["uncoded", "ai_suggested", "coded", "checked", "disputed"] as const;
export const SUPPORTS = ["supports", "contradicts", "explains", "qualifies"] as const;
export const QA_FIELDS = ["themes", "sentiment", "switching", "inclusion"] as const;

export type Platform = (typeof PLATFORMS)[number];
export type Product = (typeof PRODUCTS)[number];
export type Sentiment = (typeof SENTIMENTS)[number];
export type Language = (typeof LANGUAGES)[number];
export type Exclusion = (typeof EXCLUSIONS)[number];
export type ReportSection = (typeof REPORT_SECTIONS)[number];
export type StudyStatus = (typeof STUDY_STATUSES)[number];
export type CodingStatus = (typeof CODING_STATUSES)[number];
export type Support = (typeof SUPPORTS)[number];
export type QaField = (typeof QA_FIELDS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  google_play: "Google Play",
  reddit: "Reddit",
  trustpilot: "Trustpilot",
  facebook: "Facebook",
  google_maps: "Google Maps",
  other: "Other",
};
export const PRODUCT_LABEL: Record<Product, string> = {
  mobile: "Mobile service",
  app: "Self-care app",
  home_broadband: "Home broadband",
  air_fibre: "Air Fibre",
  fibre: "Fibre",
  satellite: "Satellite",
  unclear: "Unclear",
};
export const LANGUAGE_LABEL: Record<Language, string> = { en: "English", si: "Sinhala", ta: "Tamil", mixed: "Mixed" };
export const EXCLUSION_LABEL: Record<Exclusion, string> = {
  advert: "Advert",
  hearsay: "Hearsay",
  irrelevant: "Irrelevant",
  duplicate: "Duplicate",
  out_of_window: "Outside the time window",
  overseas: "Overseas experience",
  not_first_hand: "Not first-hand",
  other: "Other",
};
export const SECTION_LABEL: Record<ReportSection, string> = {
  value_perception: "Value perception",
  multi_sim_moat: "Multi-SIM moat",
  fixed_broadband: "Fixed broadband",
  investment_risks: "Investment risks",
  other: "Other",
};
export const STATUS_STEPS: { key: StudyStatus; label: string }[] = [
  { key: "draft", label: "Setup" },
  { key: "screening", label: "Screening" },
  { key: "collecting", label: "Collecting" },
  { key: "coding", label: "Coding" },
  { key: "checking", label: "Checking" },
  { key: "complete", label: "Complete" },
];

/** App reviews are analysed apart from network / broadband experiences. */
export type ProductFamily = "app" | "service";
export const productFamily = (p: Product): ProductFamily => (p === "app" ? "app" : "service");
export const FAMILY_LABEL: Record<ProductFamily, string> = { app: "App reviews", service: "Service experiences" };

export interface GroupLite {
  id: string;
  name: string;
}

export interface EntityLite {
  id: string;
  name: string;
  groupId: string;
  isSubject: boolean;
  requiresGeoCheck: boolean;
}

export interface ThemeLite {
  id: string;
  key: string;
  label: string;
}

/** The fields the pure analysis functions need from a record. */
export interface RecordLite {
  id: string;
  recordCode: string;
  entityId: string;
  platform: Platform;
  product: Product;
  threadId: string | null;
  contributorRef: string | null;
  included: boolean;
  codingStatus: CodingStatus;
  sentiment: Sentiment | null;
  switching: boolean;
  switchingNote: string | null;
  themeKeys: string[];
  text: string;
  translationEn: string | null;
}

export interface TargetLite {
  id: string;
  label: string;
  groupId: string | null;
  product: Product | null;
  platform: Platform | null;
  perEntity: boolean;
  targetMin: number;
  targetMax: number;
}
