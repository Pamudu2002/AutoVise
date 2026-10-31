import type { EvidenceCoding, EvidenceFindings } from "@/lib/ai/schemas";
import type { Matrix } from "./matrix";
import type { Product, ReportSection } from "./types";

/**
 * Deterministic stand-ins for Gemini, used when GOOGLE_GENERATIVE_AI_API_KEY is missing or
 * EVIDENCE_AI_MOCK=1 (end-to-end tests). They follow the same output schemas, and every suggestion
 * still needs a person to accept it, exactly like a Gemini suggestion.
 */

const THEME_WORDS: Record<string, RegExp> = {
  price_value: /\b(price|prices|pricing|expensive|cheap|cheaper|cost|costly|value|package|packages|tariff|charges?|rs\.?|lkr|afford)/i,
  network: /\b(network|coverage|signal|speed|slow|fast|4g|5g|lte|drop|dropping|reliab|outage|ping|latency)/i,
  billing_app: /\b(app|bill|billing|reload|top-?up|login|crash|self-?care|payment|invoice)/i,
  support: /\b(support|hotline|call centre|call center|agent|branch|complain|complaint|service desk|customer care)/i,
  switching: /\b(switch|switched|moved to|second sim|dual sim|another sim|ported|leaving|left|cancel)/i,
  install_availability: /\b(install|installation|technician|connection took|available|availability|not available|router|dish|setup|set up)/i,
};
const POSITIVE = /\b(good|great|excellent|happy|fast|reliable|love|best|smooth|recommend|worth|improved)\b/i;
const NEGATIVE = /\b(bad|poor|slow|worst|terrible|expensive|crash|crashes|fail|failed|never|drop|dropping|unhappy|disappointed|overpriced|waste|issue|problem)\b/i;
const OVERSEAS = /\b(usa|uk|australia|canada|india|dubai|uae|europe|abroad|overseas|in the us)\b/i;
const ADVERT = /\b(promo code|use my code|click here|offer ends|sponsored|dm us)\b/i;
const HEARSAY = /\b(my friend said|i heard|people say|apparently|someone told)\b/i;

export function offlineCode(input: { text: string; themeKeys: string[]; product: Product }): EvidenceCoding {
  const t = input.text;
  const themes = input.themeKeys.filter((k) => THEME_WORDS[k]?.test(t));
  const pos = POSITIVE.test(t);
  const neg = NEGATIVE.test(t);
  const switching = THEME_WORDS.switching.test(t);
  const airFibre = /\bair\s*fib(re|er)\b/i.exec(t);
  const productGuess: Product = airFibre ? "air_fibre" : /starlink|satellite/i.test(t) ? "satellite" : input.product;
  return {
    themes: themes as EvidenceCoding["themes"],
    sentiment: pos && neg ? "mixed" : neg ? "negative" : pos ? "positive" : "unclear",
    switching: { value: switching, explanation: switching ? "The account describes moving to, or keeping, another provider." : null },
    product_guess: productGuess,
    product_evidence_quote: airFibre ? airFibre[0] : null,
    language: /[඀-෿]/.test(t) ? "si" : /[஀-௿]/.test(t) ? "ta" : "en",
    translation_en: null,
    flags: { advert: ADVERT.test(t), hearsay: HEARSAY.test(t), not_first_hand: HEARSAY.test(t), overseas: OVERSEAS.test(t), irrelevant: themes.length === 0 },
    confidence: themes.length ? 0.55 : 0.3,
  };
}

/**
 * Drafts up to three cautious sentences for a research question from the matrix. Wording only
 * describes counts with their denominators, so it passes the proportionality guard.
 */
export function offlineFindings(input: {
  section: ReportSection;
  matrix: Matrix;
  themeLabels: Record<string, string>;
  /** Checked records that can be cited, with their entity and themes. */
  citable: { recordCode: string; entityId: string; themeKeys: string[] }[];
}): EvidenceFindings {
  const focus: Record<ReportSection, string[]> = {
    value_perception: ["price_value", "network"],
    multi_sim_moat: ["switching", "price_value"],
    fixed_broadband: ["install_availability", "network", "price_value"],
    investment_risks: ["support", "network", "price_value"],
    other: Object.keys(input.themeLabels),
  };
  const sentences: EvidenceFindings["sentences"] = [];
  for (const key of focus[input.section]) {
    if (sentences.length >= 3) break;
    for (const b of input.matrix.blocks) {
      const subject = b.entities.find((e) => e.isSubject) ?? b.entities[0];
      const cell = subject?.cells[key];
      if (!subject || !cell || cell.count === 0) continue;
      const cites = input.citable.filter((c) => c.entityId === subject.entityId && c.themeKeys.includes(key)).slice(0, 3).map((c) => c.recordCode);
      if (!cites.length) continue;
      const label = (input.themeLabels[key] ?? key).toLowerCase();
      const tone = cell.sentiment.negative > cell.sentiment.positive ? "mostly critical" : cell.sentiment.positive > cell.sentiment.negative ? "mostly favourable" : "mixed";
      sentences.push({
        text: `In this exploratory sample, ${cell.count} of ${subject.n} ${subject.entityName} records from ${b.platform.replace("_", " ")} (${subject.threads} threads, ${subject.contributors} contributors) mention ${label}, and those accounts are ${tone}.`,
        support: "explains",
        cited_record_codes: cites,
      });
      break;
    }
  }
  return { sentences, caveats: ["Exploratory sample of public accounts; counts describe the records collected, not all customers."] };
}
