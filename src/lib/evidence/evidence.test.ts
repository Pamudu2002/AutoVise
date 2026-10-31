import { describe, expect, it } from "vitest";
import { makeEvidenceCodingSchema } from "@/lib/ai/schemas";
import { agreement } from "./agreement";
import { buildAppendix } from "./appendix";
import { duplicateCandidates, jaccard, pairKey } from "./duplicates";
import { guardFinding, unresolved } from "./guard";
import { autoMap, matchEntity, parseProduct, validateRows, type ImportContext } from "./import";
import { allowedNumbers, buildMatrix, matrixWarnings } from "./matrix";
import { offlineCode, offlineFindings } from "./offline";
import { selectQaSample } from "./qa-sample";
import { targetProgress, targetWarnings } from "./targets";
import { searchTermsFor, telecomSl, telecomSlDemo, TEMPLATES } from "./templates/telecom-sl";
import type { EntityLite, GroupLite, RecordLite, TargetLite, ThemeLite } from "./types";
import { stripPii } from "./validation";
import { inWindow, parseDate, windowStart } from "./window";

const groups: GroupLite[] = [
  { id: "g-m", name: "Mobile" },
  { id: "g-b", name: "Home broadband" },
];
const entities: EntityLite[] = [
  { id: "e-d", name: "Dialog", groupId: "g-m", isSubject: true, requiresGeoCheck: false },
  { id: "e-m", name: "Mobitel", groupId: "g-m", isSubject: false, requiresGeoCheck: false },
  { id: "e-dh", name: "Dialog Home Broadband / Air Fibre", groupId: "g-b", isSubject: true, requiresGeoCheck: false },
  { id: "e-s", name: "Starlink", groupId: "g-b", isSubject: false, requiresGeoCheck: true },
];
const themes: ThemeLite[] = telecomSl.themes.map((t, i) => ({ id: `t${i}`, key: t.key, label: t.label }));

let seq = 0;
const rec = (over: Partial<RecordLite> = {}): RecordLite => ({
  id: `r${++seq}`,
  recordCode: `R${String(seq).padStart(3, "0")}`,
  entityId: "e-d",
  platform: "reddit",
  product: "mobile",
  threadId: null,
  contributorRef: null,
  included: true,
  codingStatus: "coded",
  sentiment: "negative",
  switching: false,
  switchingNote: null,
  themeKeys: ["price_value"],
  text: "Packages are expensive",
  translationEn: null,
  ...over,
});

describe("window", () => {
  it("subtracts months and clamps to month end", () => {
    expect(windowStart("2026-10-15", 6)).toBe("2026-04-15");
    expect(windowStart("2026-08-31", 6)).toBe("2026-02-28");
    expect(windowStart("2024-08-31", 6)).toBe("2024-02-29");
  });
  it("is inclusive at both ends", () => {
    expect(inWindow("2026-04-15", "2026-04-15", "2026-10-15")).toBe(true);
    expect(inWindow("2026-10-15", "2026-04-15", "2026-10-15")).toBe(true);
    expect(inWindow("2026-04-14", "2026-04-15", "2026-10-15")).toBe(false);
    expect(inWindow("2026-10-16", "2026-04-15", "2026-10-15")).toBe(false);
    expect(inWindow(null, "2026-04-15", "2026-10-15")).toBe(false);
  });
  it("parses common date formats and rejects impossible dates", () => {
    expect(parseDate("2026-07-03")).toBe("2026-07-03");
    expect(parseDate("03/07/2026")).toBe("2026-07-03");
    expect(parseDate(46206)).toBe("2026-07-03");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("soon")).toBeNull();
  });
});

describe("PII stripping", () => {
  it("removes emails, handles and phone numbers", () => {
    const r = stripPii("Mail me at kasun@example.com or call 077 123 4567, ask @kasun_99 or u/lanka_guy. Rs. 1490 package.");
    expect(r.text).not.toMatch(/kasun|example\.com|077|lanka_guy/);
    expect(r.text).toContain("Rs. 1490 package");
    expect(r.removed).toEqual(expect.arrayContaining(["email", "handle", "phone"]));
  });
});

describe("import validation", () => {
  const ctx: ImportContext = { entities, groups, themes, windowStart: "2026-04-15", collectionDate: "2026-10-15", existingCodes: ["R001"] };
  const base = {
    Platform: "Reddit",
    "Review/post date": "2026-08-01",
    Operator: "Dialog",
    "Service/product": "Mobile",
    "Relevant text or paraphrase": "Data packages got more expensive this year.",
    "Theme(s)": "price_value",
    Sentiment: "Negative",
  };
  const mapping = autoMap([...Object.keys(base), "Record ID", "Product evidence", "Sri Lankan experience (Yes/No)", "Included (Yes/No)"]);

  it("maps template headers automatically", () => {
    expect(mapping.platform).toBe("Platform");
    expect(mapping.postedAt).toBe("Review/post date");
    expect(mapping.text).toBe("Relevant text or paraphrase");
    expect(mapping.geoConfirmed).toBe("Sri Lankan experience (Yes/No)");
  });

  it("accepts a valid row and numbers it after existing codes", () => {
    const r = validateRows([base], mapping, ctx);
    expect(r.errors).toEqual([]);
    expect(r.valid[0].recordCode).toBe("R002");
    expect(r.valid[0].coded).toBe(true);
    expect(r.valid[0].themeKeys).toEqual(["price_value"]);
  });

  it("rejects air_fibre without product evidence", () => {
    const r = validateRows([{ ...base, Operator: "Dialog", "Service/product": "Air Fibre" }], mapping, ctx);
    expect(r.valid).toHaveLength(0);
    expect(r.errors[0].messages.join(" ")).toMatch(/Air Fibre/);
    const ok = validateRows([{ ...base, "Service/product": "Air Fibre", "Product evidence": "my Dialog Air Fibre connection" }], mapping, ctx);
    expect(ok.valid[0].product).toBe("air_fibre");
    expect(ok.valid[0].entityId).toBe("e-dh");
  });

  it("requires a Sri Lankan confirmation for geo-checked entities", () => {
    const row = { ...base, Operator: "Starlink", "Service/product": "Satellite" };
    expect(validateRows([row], mapping, ctx).errors[0].messages.join(" ")).toMatch(/Sri Lankan/);
    expect(validateRows([{ ...row, "Sri Lankan experience (Yes/No)": "Yes" }], mapping, ctx).valid).toHaveLength(1);
    // An overseas account the team has already excluded imports as excluded.
    const out = validateRows([{ ...row, "Included (Yes/No)": "No", "Inclusion/exclusion note": "overseas" }], { ...mapping, included: "Included (Yes/No)", inclusionNote: "Inclusion/exclusion note" }, ctx);
    expect(out.valid[0]).toMatchObject({ included: false, exclusionReason: "overseas" });
  });

  it("strips personal details and warns", () => {
    const r = validateRows([{ ...base, "Relevant text or paraphrase": "Contact me on 0771234567 about prices" }], mapping, ctx);
    expect(r.valid[0].text).not.toContain("0771234567");
    expect(r.warnings[0].message).toMatch(/phone/);
  });

  it("auto-excludes rows outside the window", () => {
    const r = validateRows([{ ...base, "Review/post date": "2025-01-10" }], mapping, ctx);
    expect(r.valid[0].included).toBe(false);
    expect(r.valid[0].exclusionReason).toBe("out_of_window");
    expect(r.autoExcluded).toBe(1);
  });

  it("reports unknown operators, platforms and themes", () => {
    const r = validateRows([{ ...base, Operator: "Etisalat", Platform: "Myspace", "Theme(s)": "vibes" }], mapping, ctx);
    expect(r.errors[0].messages).toHaveLength(3);
  });

  it("matches operators to entities by product group", () => {
    expect(matchEntity("Dialog", "home_broadband", entities, groups)?.id).toBe("e-dh");
    expect(matchEntity("Dialog", "mobile", entities, groups)?.id).toBe("e-d");
    expect(parseProduct("Self-care app")).toBe("app");
  });
});

describe("QA sample", () => {
  const records = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, recordCode: `R${String(i + 1).padStart(3, "0")}`, entityId: i < 20 ? "a" : i < 28 ? "b" : "c", included: true, codingStatus: "coded" }));
  it("takes about 20 %, at least two per entity, deterministically", () => {
    const s1 = selectQaSample(records, { rate: 0.2, seed: "study-1" });
    const s2 = selectQaSample(records, { rate: 0.2, seed: "study-1" });
    expect([...s1].sort()).toEqual([...s2].sort());
    const per = (e: string) => records.filter((r) => r.entityId === e && s1.has(r.id)).length;
    expect(per("a")).toBe(4);
    expect(per("b")).toBe(2);
    expect(per("c")).toBe(2);
    expect(selectQaSample(records, { rate: 0.2, seed: "study-2" })).not.toEqual(s1);
  });
  it("always includes cited and already-checked records, and skips uncoded or excluded ones", () => {
    const extra = [...records, { id: "x1", recordCode: "R099", entityId: "a", included: false, codingStatus: "coded" }, { id: "x2", recordCode: "R098", entityId: "a", included: true, codingStatus: "uncoded" }];
    const s = selectQaSample(extra, { rate: 0.2, seed: "s", cited: ["q19"], keep: ["q18"] });
    expect(s.has("q19") && s.has("q18")).toBe(true);
    expect(s.has("x1") || s.has("x2")).toBe(false);
  });
});

describe("agreement", () => {
  it("computes agreement per field and overall", () => {
    const a = agreement([
      { checkFields: { themes: "agree", sentiment: "agree", switching: "agree", inclusion: "agree" } },
      { checkFields: { themes: "disagree", sentiment: "agree", switching: "agree", inclusion: "agree" } },
      { checkFields: null },
    ]);
    expect(a.themes).toEqual({ agree: 1, total: 2, pct: 50 });
    expect(a.sentiment.pct).toBe(100);
    expect(a.overall).toEqual({ agree: 7, total: 8, pct: 87.5 });
  });
});

describe("theme matrix", () => {
  it("counts denominators, threads and contributors, and hides % below the threshold", () => {
    seq = 0;
    const records = [
      rec({ threadId: "t1", contributorRef: "C1" }),
      rec({ threadId: "t1", contributorRef: "C2", themeKeys: ["price_value", "network"], sentiment: "mixed" }),
      rec({ threadId: null, contributorRef: "C1" }),
      rec({ threadId: null, contributorRef: null, themeKeys: ["network"], sentiment: "positive" }),
      rec({ entityId: "e-m" }),
      rec({ platform: "google_play", product: "app", themeKeys: ["billing_app"] }),
      rec({ codingStatus: "disputed" }),
      rec({ included: false }),
    ];
    const m = buildMatrix({ records, entities, groups, themes, minNForPercent: 20 });
    const reddit = m.blocks.find((b) => b.groupName === "Mobile" && b.platform === "reddit" && b.family === "service")!;
    const dialog = reddit.entities.find((e) => e.entityId === "e-d")!;
    expect(dialog.n).toBe(4);
    expect(dialog.threads).toBe(3); // t1 + two records without a thread
    expect(dialog.contributors).toBe(2);
    expect(dialog.unknownContributors).toBe(1);
    expect(dialog.cells.price_value.count).toBe(3);
    expect(dialog.cells.price_value.pct).toBeNull();
    expect(dialog.cells.network.sentiment).toEqual({ positive: 1, mixed: 1, negative: 0, unclear: 0 });
    // App reviews are a separate block, never mixed with service experiences.
    expect(m.blocks.find((b) => b.family === "app")!.entities.find((e) => e.entityId === "e-d")!.n).toBe(1);
    expect(m.pendingCoding).toBe(1);
    expect(matrixWarnings(m).join(" ")).toMatch(/one thread \(t1\)/);
  });

  it("shows percentages at or above the threshold", () => {
    seq = 0;
    const records = Array.from({ length: 20 }, (_, i) => rec({ themeKeys: i < 5 ? ["network"] : ["price_value"] }));
    const m = buildMatrix({ records, entities, groups, themes, minNForPercent: 20 });
    expect(m.blocks[0].entities[0].cells.network.pct).toBe(25);
    expect(allowedNumbers(m).percents).toContain(25);
  });
});

describe("targets", () => {
  const targets: TargetLite[] = [
    { id: "t-app", label: "App reviews", groupId: "g-m", product: "app", platform: "google_play", perEntity: true, targetMin: 2, targetMax: 2 },
    { id: "t-hbb", label: "Home broadband", groupId: "g-b", product: null, platform: null, perEntity: false, targetMin: 6, targetMax: 10 },
  ];
  it("tracks progress and adds the smaller Sri Lankan sample limitation", () => {
    seq = 0;
    const records = [
      rec({ platform: "google_play", product: "app" }),
      rec({ platform: "google_play", product: "app" }),
      rec({ entityId: "e-dh", product: "home_broadband" }),
      rec({ entityId: "e-s", product: "satellite" }),
    ];
    const p = targetProgress(targets, records, entities);
    expect(p[0].rows.find((r) => r.entityId === "e-d")!.status).toBe("within");
    expect(p[0].rows.find((r) => r.entityId === "e-m")!.status).toBe("below");
    const w = targetWarnings({ targets, progress: p, records, entities, groups });
    expect(w.limitations[0]).toMatch(/Starlink: smaller Sri Lankan sample/);
  });
});

describe("guard", () => {
  const ctx = { allowedNumbers: [3, 12, 4], allowedPercents: [25] };
  it("flags disproportionate wording", () => {
    const codes = (t: string) => guardFinding(t, ctx).map((w) => w.code);
    expect(codes("Most customers find Dialog expensive.")).toContain("majority_claim");
    expect(codes("Customers are dissatisfied with support.")).toContain("blanket_sentiment");
    expect(codes("Churn will rise next year.")).toContain("churn_prediction");
    expect(codes("Dialog is losing market share.")).toContain("market_share");
    expect(codes("Dialog will lose data users to Hutch.")).toContain("loss_prediction");
  });
  it("checks numbers against the matrix", () => {
    expect(guardFinding("3 of 12 records mention price (25%).", ctx)).toEqual([]);
    const w = guardFinding("40% of 12 records mention speed; 7 users switched.", ctx);
    expect(w.map((x) => x.code)).toEqual(["small_sample_percent", "number_not_in_matrix"]);
    expect(unresolved([{ ...w[0], acknowledged: true }, w[1]])).toHaveLength(1);
  });
});

describe("AI schemas", () => {
  it("rejects theme keys outside the study", () => {
    const schema = makeEvidenceCodingSchema(["price_value", "network"]);
    const ok = offlineCode({ text: "The network is slow and packages are expensive", themeKeys: ["price_value", "network"], product: "mobile" });
    expect(schema.safeParse(ok).success).toBe(true);
    expect(schema.safeParse({ ...ok, themes: ["vibes"] }).success).toBe(false);
  });
  it("offline coder detects Air Fibre only when named", () => {
    expect(offlineCode({ text: "Got Dialog Air Fibre installed last week", themeKeys: ["install_availability"], product: "home_broadband" }).product_guess).toBe("air_fibre");
    expect(offlineCode({ text: "Dialog home broadband is slow", themeKeys: ["network"], product: "home_broadband" }).product_guess).toBe("home_broadband");
  });
  it("offline findings pass the guard and cite records", () => {
    seq = 0;
    const records = Array.from({ length: 6 }, () => rec({ codingStatus: "checked" }));
    const m = buildMatrix({ records, entities, groups, themes, minNForPercent: 20 });
    const f = offlineFindings({ section: "value_perception", matrix: m, themeLabels: Object.fromEntries(themes.map((t) => [t.key, t.label])), citable: records.map((r) => ({ recordCode: r.recordCode, entityId: r.entityId, themeKeys: r.themeKeys })) });
    expect(f.sentences.length).toBeGreaterThan(0);
    const allowed = allowedNumbers(m);
    for (const s of f.sentences) {
      expect(guardFinding(s.text, { allowedNumbers: allowed.numbers, allowedPercents: allowed.percents })).toEqual([]);
      expect(s.cited_record_codes.length).toBeGreaterThan(0);
    }
  });
});

describe("duplicates", () => {
  it("finds near-identical texts and respects dismissals", () => {
    const items = [
      { id: "a", recordCode: "R001", text: "Dialog data packages are too expensive for students now", embedding: null },
      { id: "b", recordCode: "R002", text: "Dialog data packages are too expensive for students now!", embedding: null },
      { id: "c", recordCode: "R003", text: "Hutch coverage in Kandy is weak", embedding: null },
    ];
    expect(duplicateCandidates(items).map((p) => [p.a, p.b])).toEqual([["a", "b"]]);
    expect(duplicateCandidates(items, { dismissed: new Set([pairKey("b", "a")]) })).toEqual([]);
    expect(jaccard("a b c", "")).toBe(0);
    expect(duplicateCandidates([{ ...items[0], embedding: [1, 0] }, { ...items[2], embedding: [0.99, 0.05] }])[0].method).toBe("embedding");
  });
});

describe("appendix", () => {
  it("never exposes contributor refs or source links", () => {
    seq = 0;
    const records = [rec({ contributorRef: "T03-C2", threadId: "abc", codingStatus: "checked" })].map((r) => ({ ...r, publicExample: true, postedAt: "2026-08-01", language: "en" as const }));
    const m = buildMatrix({ records, entities, groups, themes, minNForPercent: 20 });
    const a = buildAppendix({
      study: { title: "S", collectionDate: "2026-10-15", windowStart: "2026-04-15", windowMonths: 6, languages: ["en"], languageLimitations: null, limitations: null, minNForPercent: 20 },
      questions: [],
      screenings: [],
      groups,
      entities,
      records,
      matrix: m,
      autoLimitations: [],
    });
    expect(JSON.stringify(a)).not.toContain("T03-C2");
    expect(a.examples[0]).toEqual({ entity: "Dialog", platform: "Reddit · Mobile service", month: "Aug 2026", text: "Packages are expensive" });
  });
});

describe("telecom-sl template", () => {
  it("has the PLAN2 structure", () => {
    expect(telecomSl.groups.map((g) => g.entities.length)).toEqual([3, 3]);
    expect(telecomSl.groups[1].entities.find((e) => e.name === "Starlink")?.requiresGeoCheck).toBe(true);
    expect(telecomSl.platforms.find((p) => p.platform === "google_maps")?.decision).toBe("excluded");
    expect(searchTermsFor(telecomSl)).toContain("Starlink home broadband");
  });

  it("has a demo copy with fictional operators only", () => {
    const json = JSON.stringify(telecomSlDemo);
    for (const real of ["Dialog", "Mobitel", "Hutch", "SLT", "Starlink"]) expect(json).not.toContain(real);
    expect(telecomSlDemo.groups[1].entities.find((e) => e.name === "Orbit Satellite")?.requiresGeoCheck).toBe(true);
    expect(TEMPLATES[telecomSlDemo.key]).toBe(telecomSlDemo);
  });
});

describe("appendix examples", () => {
  it("only shows records that passed the QA check", () => {
    seq = 0;
    const records = [rec({ codingStatus: "coded" }), rec({ codingStatus: "checked" })].map((r) => ({ ...r, publicExample: true, postedAt: "2026-08-01", language: "en" as const }));
    const m = buildMatrix({ records, entities, groups, themes, minNForPercent: 20 });
    const a = buildAppendix({
      study: { title: "S", collectionDate: "2026-10-15", windowStart: "2026-04-15", windowMonths: 6, languages: ["en"], languageLimitations: null, limitations: null, minNForPercent: 20 },
      questions: [],
      screenings: [],
      groups,
      entities,
      records,
      matrix: m,
      autoLimitations: [],
    });
    expect(a.examples).toHaveLength(1);
  });
});
