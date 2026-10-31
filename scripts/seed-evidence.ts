/**
 * Seeds a demo customer-evidence study for Serendib Telecom (STEL) through the real service layer:
 * import → AI-assisted suggestions for a few rows → QA by a second person → approved findings →
 * published appendix → findings attached to the pitch. Operators and accounts are fictional.
 */
import { sampleRows } from "./evidence-sample";

export async function seedEvidence(opts: { companyId: string; coderId: string; checkerId: string; collectionDate: string }) {
  const svc = await import("@/lib/evidence/service");
  const { studyAnalysis, getStudyBundle } = await import("@/lib/evidence/data");
  const { autoMap } = await import("@/lib/evidence/import");
  const { refreshCompanyPitch } = await import("@/lib/evidence/pitch");

  const study = await svc.createStudy(
    { companyId: opts.companyId, title: "Mobile and home-broadband experiences (demo data)", collectionDate: opts.collectionDate, templateKey: "telecom-sl-demo" },
    opts.coderId,
  );
  await svc.saveScreening(study.id, "trustpilot", { decision: "excluded", reason: "Very few first-hand Sri Lankan telecom reviews in the window.", searchTerms: [], sortMethod: null, coverageNote: null }, opts.coderId);
  await svc.saveScreening(study.id, "facebook", { decision: "excluded", reason: "Reddit covered the satellite gap; comment threads were hard to attribute to first-hand experience.", searchTerms: [], sortMethod: null, coverageNote: null }, opts.coderId);

  // ── Import the team spreadsheet (six rows left uncoded for the coding queue) ──
  const rows = sampleRows({ collectionDate: opts.collectionDate, uncoded: 6 });
  const res = await svc.importRecords(study.id, { rows, mapping: autoMap(Object.keys(rows[0])) }, opts.coderId, true);
  if (res.errors.length) throw new Error(`Demo evidence import failed: ${JSON.stringify(res.errors.slice(0, 3))}`);

  let a = (await studyAnalysis(study.id))!;
  const uncoded = a.records.filter((r) => r.included && r.codingStatus === "uncoded").map((r) => r.id);
  await svc.codeRecords(study.id, uncoded);

  // ── Findings written from the matrix (counts with their denominators) ──
  const bundle = (await getStudyBundle(study.id))!;
  const entity = (name: string) => bundle.entities.find((e) => e.name === name)!;
  const col = (entityName: string, platform: string, family: "app" | "service") =>
    a.matrix.blocks
      .filter((b) => b.platform === platform && b.family === family)
      .flatMap((b) => b.entities)
      .find((e) => e.entityName === entityName);
  const cite = (entityName: string, theme: string, n = 3, product?: string) =>
    a.records
      .filter((r) => r.entityId === entity(entityName).id && r.included && r.codingStatus === "coded" && r.themeKeys.includes(theme) && (!product || r.product === product))
      .slice(0, n)
      .map((r) => r.recordCode);
  const q = (section: string) => bundle.questions.find((x) => x.reportSection === section)!.id;

  const subjectApp = col("Serendib", "google_play", "app")!;
  const subjectMobile = col("Serendib", "reddit", "service")!;
  const home = col("Serendib Home Broadband / Air Fibre", "reddit", "service")!;
  const fibre = col("IslandNet Fibre", "reddit", "service")!;
  const findings = [
    {
      questionId: q("value_perception"),
      support: "explains" as const,
      text: `In this exploratory sample, ${subjectApp.cells.price_value.count} of ${subjectApp.n} Serendib app reviews on Google Play raise price and value, usually about the split between night-time and daytime data rather than the headline package price.`,
      citedCodes: cite("Serendib", "price_value", 3, "app"),
    },
    {
      questionId: q("multi_sim_moat"),
      support: "qualifies" as const,
      text: `${subjectMobile.cells.switching.count} of ${subjectMobile.n} Serendib mobile experiences collected on Reddit describe keeping a second SIM for data or moving the number after a price change, which qualifies how firmly the data base is held.`,
      citedCodes: cite("Serendib", "switching", 3, "mobile"),
    },
    {
      questionId: q("fixed_broadband"),
      support: "explains" as const,
      text: `Installation and availability come up in ${home.cells.install_availability.count} of ${home.n} Serendib home-broadband accounts and ${fibre.cells.install_availability.count} of ${fibre.n} IslandNet Fibre accounts, where wireless home broadband is described as the option on roads that fibre has not reached.`,
      citedCodes: [...cite("Serendib Home Broadband / Air Fibre", "install_availability", 2), ...cite("IslandNet Fibre", "install_availability", 1)],
    },
  ];
  for (const f of findings) await svc.saveFinding(study.id, f);

  // ── QA by a second person (one disputed, two left open for the demo) ──
  await svc.refreshQaSample(study.id);
  a = (await studyAnalysis(study.id))!;
  const findingRows = await (await import("@/lib/evidence/data")).getFindings(study.id);
  const cited = new Set(findingRows.flatMap((f) => f.citedRecordIds));
  const agree = { themes: "agree", sentiment: "agree", switching: "agree", inclusion: "agree" } as const;
  let spare = 0;
  for (const r of a.records.filter((x) => x.inQaSample && x.codingStatus === "coded")) {
    if (!cited.has(r.id) && spare < 3) {
      spare++;
      if (spare === 1) await svc.submitCheck(r.id, { ...agree, sentiment: "disagree" }, "Reads as mixed rather than negative: the reviewer also praises the reload flow.", opts.checkerId);
      continue;
    }
    await svc.submitCheck(r.id, agree, null, opts.checkerId);
  }

  for (const f of findingRows) await svc.approveFinding(f.id, opts.checkerId);

  // Paraphrased examples for the appendix: one per comparison group.
  a = (await studyAnalysis(study.id))!;
  const checked = a.records.filter((r) => r.included && r.codingStatus === "checked");
  for (const g of bundle.groups) {
    const r = checked.find((x) => bundle.entities.find((e) => e.id === x.entityId)?.groupId === g.id);
    if (r) await svc.setPublicExample(r.id, true);
  }
  await svc.setAppendixPublished(study.id, true);
  await svc.setStatus(study.id, "checking");
  const pitch = await refreshCompanyPitch(opts.companyId);
  return { studyId: study.id, records: a.records.length, findings: findingRows.length, pitchesUpdated: pitch.updated };
}
