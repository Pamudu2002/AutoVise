import * as XLSX from "xlsx";
import { recordInputSchema, stripPii, type RecordInput } from "./validation";
import { inWindow, parseDate } from "./window";
import { EXCLUSIONS, LANGUAGES, PLATFORMS, type EntityLite, type Exclusion, type GroupLite, type Language, type Platform, type Product, type Sentiment, type ThemeLite } from "./types";

/**
 * Evidence import (PLAN2 §7.1): parse CSV/XLSX, map columns, validate every row, never half-import.
 * Records come from the team spreadsheet — the app never fetches or scrapes the source URLs.
 */

export const IMPORT_FIELDS = [
  { key: "recordCode", header: "Record ID", required: false },
  { key: "platform", header: "Platform", required: true },
  { key: "sourceUrl", header: "Source URL", required: false },
  { key: "postedAt", header: "Review/post date", required: true },
  { key: "collectionDate", header: "Collection date", required: false },
  { key: "threadId", header: "Thread ID", required: false },
  { key: "contributorRef", header: "Contributor ref", required: false },
  { key: "operator", header: "Operator", required: true },
  { key: "product", header: "Service/product", required: true },
  { key: "productEvidence", header: "Product evidence", required: false },
  { key: "geoConfirmed", header: "Sri Lankan experience (Yes/No)", required: false },
  { key: "starRating", header: "Star rating", required: false },
  { key: "text", header: "Relevant text or paraphrase", required: true },
  { key: "language", header: "Language", required: false },
  { key: "translationEn", header: "English translation", required: false },
  { key: "themes", header: "Theme(s)", required: false },
  { key: "sentiment", header: "Sentiment", required: false },
  { key: "switching", header: "Switching (Yes/No)", required: false },
  { key: "switchingNote", header: "Switching explanation", required: false },
  { key: "included", header: "Included (Yes/No)", required: false },
  { key: "inclusionNote", header: "Inclusion/exclusion note", required: false },
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
export type ColumnMapping = Partial<Record<ImportField, string>>;

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

export function parseSheet(data: ArrayBuffer | Uint8Array | string, fileName: string): ParsedSheet {
  const wb = typeof data === "string" || /\.csv$/i.test(fileName)
    ? XLSX.read(typeof data === "string" ? data : new TextDecoder().decode(data), { type: "string", cellDates: true, raw: false })
    : XLSX.read(data, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  const headers = (XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false })[0] ?? []).map((h) => String(h).trim()).filter(Boolean);
  return { headers, rows };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const SYNONYMS: Record<ImportField, string[]> = {
  recordCode: ["recordid", "record", "id", "recordcode", "code"],
  platform: ["platform", "source", "site"],
  sourceUrl: ["sourceurl", "url", "link"],
  postedAt: ["reviewpostdate", "postdate", "reviewdate", "posted", "date", "postedat"],
  collectionDate: ["collectiondate", "collected", "collectedon"],
  threadId: ["threadid", "thread"],
  contributorRef: ["contributorref", "contributor", "contributorid"],
  operator: ["operator", "entity", "company", "brand", "provider"],
  product: ["serviceproduct", "product", "service"],
  productEvidence: ["productevidence", "productquote"],
  geoConfirmed: ["srilankanexperienceyesno", "srilankanexperience", "geoconfirmed", "srilanka", "geo"],
  starRating: ["starrating", "stars", "rating"],
  text: ["relevanttextorparaphrase", "text", "relevanttext", "paraphrase", "excerpt", "content"],
  language: ["language", "lang"],
  translationEn: ["englishtranslation", "translation", "translationen"],
  themes: ["themes", "theme"],
  sentiment: ["sentiment"],
  switching: ["switchingyesno", "switching"],
  switchingNote: ["switchingexplanation", "switchingnote"],
  included: ["includedyesno", "included", "include"],
  inclusionNote: ["inclusionexclusionnote", "inclusionnote", "exclusionnote", "note"],
};

/** Best-guess column mapping from header names; the admin can change it before importing. */
export function autoMap(headers: string[]): ColumnMapping {
  const out: ColumnMapping = {};
  const used = new Set<string>();
  for (const f of IMPORT_FIELDS) {
    const hit = headers.find((h) => !used.has(h) && SYNONYMS[f.key].includes(norm(h)));
    if (hit) {
      out[f.key] = hit;
      used.add(hit);
    }
  }
  return out;
}

const yes = (v: unknown) => /^(y|yes|true|1)$/i.test(String(v ?? "").trim());
const blank = (v: unknown) => String(v ?? "").trim() === "";

const PLATFORM_ALIASES: Record<string, Platform> = { googleplay: "google_play", playstore: "google_play", play: "google_play", reddit: "reddit", trustpilot: "trustpilot", facebook: "facebook", fb: "facebook", googlemaps: "google_maps", maps: "google_maps", other: "other" };
export function parsePlatform(v: unknown): Platform | null {
  const n = norm(String(v ?? ""));
  if ((PLATFORMS as readonly string[]).includes(String(v).trim())) return String(v).trim() as Platform;
  return PLATFORM_ALIASES[n] ?? null;
}

export function parseProduct(v: unknown): Product | null {
  const n = norm(String(v ?? ""));
  if (!n) return null;
  if (n.includes("airfibre") || n.includes("airfiber")) return "air_fibre";
  if (n === "app" || n.includes("selfcare") || n.includes("mobileapp") || n.endsWith("app")) return "app";
  if (n.includes("homebroadband") || n === "broadband" || n === "hbb") return "home_broadband";
  if (n.includes("fibre") || n.includes("fiber") || n === "ftth") return "fibre";
  if (n.includes("satellite") || n.includes("starlink")) return "satellite";
  if (n.includes("mobile") || n.includes("network") || n.includes("data") || n === "sim") return "mobile";
  if (n === "unclear" || n === "unknown") return "unclear";
  return null;
}

export function parseSentiment(v: unknown): Sentiment | null {
  const n = norm(String(v ?? ""));
  if (!n) return null;
  if (n.startsWith("pos")) return "positive";
  if (n.startsWith("neg")) return "negative";
  if (n.startsWith("mix")) return "mixed";
  if (n.startsWith("unc") || n === "neutral") return "unclear";
  return null;
}

export function parseLanguage(v: unknown): Language | null {
  const n = norm(String(v ?? ""));
  if (!n) return "en";
  if ((LANGUAGES as readonly string[]).includes(n)) return n as Language;
  if (n.startsWith("eng")) return "en";
  if (n.startsWith("sin")) return "si";
  if (n.startsWith("tam")) return "ta";
  if (n.startsWith("mix")) return "mixed";
  return null;
}

/** Operator → entity. Exact name first; otherwise the entity starting with the operator whose group fits the product. */
export function matchEntity(operator: string, product: Product | null, entities: EntityLite[], groups: GroupLite[]): EntityLite | null {
  const o = norm(operator);
  if (!o) return null;
  const exact = entities.filter((e) => norm(e.name) === o);
  const candidates = entities.filter((e) => norm(e.name) === o || norm(e.name).startsWith(o) || norm(e.name.split(/[\s/]/)[0]) === o);
  if (candidates.length > 1 && product && product !== "unclear") {
    // "Dialog" + home broadband → the entity in the broadband group, even if "Dialog" itself also exists.
    const fixed = ["home_broadband", "air_fibre", "fibre", "satellite"].includes(product);
    const groupName = (e: EntityLite) => groups.find((g) => g.id === e.groupId)?.name ?? "";
    const pick = candidates.filter((e) => /broadband|home|fixed/i.test(groupName(e)) === fixed);
    if (pick.length === 1) return pick[0];
  }
  if (exact.length === 1) return exact[0];
  return candidates.length === 1 ? candidates[0] : null;
}

export interface ImportRow extends RecordInput {
  row: number;
  /** True when the sheet already coded the record (themes or sentiment given). */
  coded: boolean;
}

export interface ImportResult {
  valid: ImportRow[];
  errors: { row: number; recordCode?: string; messages: string[] }[];
  warnings: { row: number; message: string }[];
  autoExcluded: number;
}

export interface ImportContext {
  entities: EntityLite[];
  groups: GroupLite[];
  themes: ThemeLite[];
  windowStart: string;
  collectionDate: string;
  /** Existing record codes in the study, used to number new rows. */
  existingCodes: string[];
}

const cell = (row: Record<string, unknown>, mapping: ColumnMapping, f: ImportField) => (mapping[f] ? row[mapping[f]!] : undefined);

export function nextCode(existing: Iterable<string>): () => string {
  let max = 0;
  for (const c of existing) {
    const n = Number(c.replace(/^R/, ""));
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return () => `R${String(++max).padStart(3, "0")}`;
}

export function validateRows(rows: Record<string, unknown>[], mapping: ColumnMapping, ctx: ImportContext): ImportResult {
  const result: ImportResult = { valid: [], errors: [], warnings: [], autoExcluded: 0 };
  const allocate = nextCode([...ctx.existingCodes, ...rows.map((r) => String(cell(r, mapping, "recordCode") ?? "").trim()).filter((c) => /^R\d+$/.test(c))]);
  const seen = new Set<string>();
  const themeByAny = new Map<string, string>();
  for (const t of ctx.themes) {
    themeByAny.set(norm(t.key), t.key);
    themeByAny.set(norm(t.label), t.key);
  }

  rows.forEach((raw, i) => {
    const row = i + 2; // spreadsheet row number (header is row 1)
    if (IMPORT_FIELDS.every((f) => blank(cell(raw, mapping, f.key)))) return;
    const messages: string[] = [];
    const codeIn = String(cell(raw, mapping, "recordCode") ?? "").trim();
    if (codeIn && !/^R\d{3,}$/.test(codeIn)) messages.push(`Record ID "${codeIn}" should look like R001.`);
    const recordCode = codeIn && /^R\d{3,}$/.test(codeIn) ? codeIn : allocate();
    if (seen.has(recordCode)) messages.push(`Record ID ${recordCode} appears more than once in the file.`);
    seen.add(recordCode);

    const platform = parsePlatform(cell(raw, mapping, "platform"));
    if (!platform) messages.push(`Unknown platform "${String(cell(raw, mapping, "platform") ?? "")}".`);
    const product = parseProduct(cell(raw, mapping, "product"));
    if (!product) messages.push(`Unknown service/product "${String(cell(raw, mapping, "product") ?? "")}".`);
    const operator = String(cell(raw, mapping, "operator") ?? "").trim();
    const entity = matchEntity(operator, product, ctx.entities, ctx.groups);
    if (!entity) messages.push(`Operator "${operator}" does not match an entity in this study.`);

    const postedRaw = cell(raw, mapping, "postedAt");
    const postedAt = parseDate(postedRaw);
    if (!postedAt) messages.push(`Review/post date "${String(postedRaw ?? "")}" is not a date.`);
    const collRaw = cell(raw, mapping, "collectionDate");
    const collectionDate = blank(collRaw) ? ctx.collectionDate : parseDate(collRaw);
    if (!collectionDate) messages.push(`Collection date "${String(collRaw ?? "")}" is not a date.`);

    const language = parseLanguage(cell(raw, mapping, "language"));
    if (!language) messages.push(`Unknown language "${String(cell(raw, mapping, "language") ?? "")}".`);

    const textRaw = String(cell(raw, mapping, "text") ?? "").trim();
    const pii = stripPii(textRaw);
    if (pii.removed.length) result.warnings.push({ row, message: `Removed ${[...new Set(pii.removed)].join(", ")} from the text.` });
    const tr = blank(cell(raw, mapping, "translationEn")) ? null : stripPii(String(cell(raw, mapping, "translationEn")));
    if (tr?.removed.length) result.warnings.push({ row, message: "Removed personal details from the translation." });

    const themeText = String(cell(raw, mapping, "themes") ?? "").trim();
    const themeKeys: string[] = [];
    for (const part of themeText.split(/[;,]/).map((s) => s.trim()).filter(Boolean)) {
      const key = themeByAny.get(norm(part));
      if (key) themeKeys.push(key);
      else messages.push(`Unknown theme "${part}".`);
    }
    const sentimentRaw = cell(raw, mapping, "sentiment");
    const sentiment = parseSentiment(sentimentRaw);
    if (!blank(sentimentRaw) && !sentiment) messages.push(`Unknown sentiment "${String(sentimentRaw)}".`);

    const starRaw = cell(raw, mapping, "starRating");
    const star = blank(starRaw) ? null : Number(starRaw);
    if (star !== null && !(Number.isInteger(star) && star >= 1 && star <= 5)) messages.push(`Star rating "${String(starRaw)}" must be 1–5.`);

    const geoConfirmed = yes(cell(raw, mapping, "geoConfirmed"));

    let included = blank(cell(raw, mapping, "included")) ? true : yes(cell(raw, mapping, "included"));
    const note = String(cell(raw, mapping, "inclusionNote") ?? "").trim() || null;
    let exclusionReason: Exclusion | null = null;
    if (!included) exclusionReason = (EXCLUSIONS as readonly string[]).find((e) => note && norm(note).includes(norm(e))) as Exclusion | undefined ?? "other";
    if (postedAt && !inWindow(postedAt, ctx.windowStart, collectionDate ?? ctx.collectionDate)) {
      if (included) result.autoExcluded++;
      included = false;
      exclusionReason = "out_of_window";
      result.warnings.push({ row, message: `Posted ${postedAt}, outside the window ${ctx.windowStart} – ${collectionDate ?? ctx.collectionDate}; excluded.` });
    }

    if (entity?.requiresGeoCheck && !geoConfirmed && included) {
      messages.push(`${entity.name} records must be confirmed as Sri Lankan experiences (Sri Lankan experience = Yes); exclude overseas accounts.`);
    }

    if (messages.length) {
      result.errors.push({ row, recordCode, messages });
      return;
    }
    const parsed = recordInputSchema.safeParse({
      recordCode,
      platform,
      sourceUrl: String(cell(raw, mapping, "sourceUrl") ?? "").trim() || null,
      postedAt,
      collectionDate,
      threadId: String(cell(raw, mapping, "threadId") ?? "").trim() || null,
      contributorRef: String(cell(raw, mapping, "contributorRef") ?? "").trim() || null,
      starRating: star,
      entityId: entity!.id,
      product,
      productEvidence: String(cell(raw, mapping, "productEvidence") ?? "").trim() || null,
      geoConfirmed,
      text: pii.text,
      language,
      translationEn: tr?.text ?? null,
      sentiment,
      switching: yes(cell(raw, mapping, "switching")),
      switchingNote: String(cell(raw, mapping, "switchingNote") ?? "").trim() || null,
      themeKeys,
      included,
      exclusionReason,
      inclusionNote: note,
    });
    if (!parsed.success) {
      result.errors.push({ row, recordCode, messages: parsed.error.issues.map((x) => x.message) });
      return;
    }
    result.valid.push({ ...parsed.data, recordCode, row, coded: themeKeys.length > 0 || sentiment !== null });
  });
  return result;
}
