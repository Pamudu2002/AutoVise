import { clamp } from "./math";
import { dcfValueAt, ddmValueAt, fadeGrowth, growthPath, pePath, projectPath } from "./projection";
import { overlayShifts } from "./qualitative";
import type { Levers, MethodWeights, ProjectionModel, ProjectionRow, ScenarioPrices, ScenarioSet, ValuationSettings } from "./types";

export interface MethodValues {
  /** P/E-based price per year. */
  pe: number[];
  dcf: (number | null)[];
  ddm: (number | null)[];
  weights: MethodWeights[];
}

export interface ScenarioRun {
  /** Final rows, with the cross-checks blended in and the qualitative overlay applied. */
  rows: ProjectionRow[];
  /** P/E-only path without the qualitative overlay (used by the waterfall). */
  quantRows: ProjectionRow[];
  /** Quant price per year after blending the methods, before the overlay. */
  quantPrices: number[];
  /** Each method's value per year before the overlay, with the weights used. */
  quantMethods: MethodValues;
  exitPe: number;
  growth: number[];
  /** Actual price effect of the qualitative overlay in the final year, after the tilt cap. */
  tiltPct: number;
}

/**
 * Blends P/E, DCF and dividend-discount values. A method that is switched off or cannot produce a
 * value for a year gives its weight back to P/E, so the weights always add up to 1.
 */
function blendMethods(model: ProjectionModel, rows: ProjectionRow[], growth: number[]): { prices: number[]; methods: MethodValues } {
  const dcf = model.dcf ?? null;
  const longGrowth = dcf ? fadeGrowth(growth, dcf.terminalGrowth, dcf.fadeYears, model.years + Math.round(dcf.fadeYears)) : [];
  const methods: MethodValues = { pe: [], dcf: [], ddm: [], weights: [] };
  const prices = rows.map((r) => {
    const d = dcf && dcf.weight > 0 ? dcfValueAt(model.eps0, longGrowth, r.year, dcf) : null;
    const v = model.ddm && model.ddm.weight > 0 ? ddmValueAt(rows, r.year, model.ddm) : null;
    const wDcf = d === null ? 0 : dcf!.weight;
    const wDdm = v === null ? 0 : model.ddm!.weight;
    const w = { pe: 1 - wDcf - wDdm, dcf: wDcf, ddm: wDdm };
    methods.pe.push(r.price);
    methods.dcf.push(d);
    methods.ddm.push(v);
    methods.weights.push(w);
    return w.pe * r.price + w.dcf * (d ?? 0) + w.ddm * (v ?? 0);
  });
  return { prices, methods };
}

/**
 * The single projection function. The engine, the scenarios and the browser simulator all call it,
 * so a visitor moving the sliders sees exactly the maths that produced the published target.
 */
export function runScenario(model: ProjectionModel, levers: Levers): ScenarioRun {
  const limits = model;
  const shifts = overlayShifts(levers.tilt, model);

  // Quantitative path (no overlay).
  const qGrowth = growthPath(levers.growth, model.sectorGrowth, model.meanReversion, model.years, limits);
  const qExit = clamp(levers.exitPe, model.minExitPe, model.maxExitPe);
  const quantRows = projectPath(model.eps0, qGrowth, pePath(model.pe0, qExit, model.years));
  const quant = blendMethods(model, quantRows, qGrowth);
  const quantPrices = quant.prices;

  // With the qualitative overlay: growth and multiple shift within their caps.
  const growth = growthPath(levers.growth + shifts.growthShift, model.sectorGrowth + shifts.growthShift, model.meanReversion, model.years, limits);
  const exitPe = clamp(qExit * (1 + shifts.multipleShift), model.minExitPe, model.maxExitPe);
  const rawRows = projectPath(model.eps0, growth, pePath(model.pe0, exitPe, model.years));
  const blended = blendMethods(model, rawRows, growth).prices;

  // The combined qualitative effect can never exceed ±tiltCap of the quantitative price.
  const rows = rawRows.map((r, i) => {
    const q = quantPrices[i];
    const price = clamp(blended[i], q * (1 - model.tiltCap), q * (1 + model.tiltCap));
    return { ...r, price };
  });
  const last = rows.length - 1;
  const tiltPct = quantPrices[last] > 0 ? rows[last].price / quantPrices[last] - 1 : 0;

  return { rows, quantRows, quantPrices, quantMethods: quant.methods, exitPe, growth, tiltPct };
}

export function pricesOf(run: ScenarioRun): ScenarioPrices {
  const p = run.rows.map((r) => r.price);
  return { y1: p[0], y2: p[1] ?? p[0], y3: p[2] ?? p[p.length - 1] };
}

/** Bear and bull shift growth and the exit multiple by fixed amounts around the base levers. */
export function scenarioLevers(base: Levers, shift: ValuationSettings["scenario"]): { bear: Levers; bull: Levers } {
  return {
    bear: { growth: base.growth - shift.growthShift, exitPe: base.exitPe * (1 - shift.peShift), tilt: base.tilt },
    bull: { growth: base.growth + shift.growthShift, exitPe: base.exitPe * (1 + shift.peShift), tilt: base.tilt },
  };
}

export function buildScenarios(model: ProjectionModel, base: Levers, shift: ValuationSettings["scenario"]) {
  const levers = scenarioLevers(base, shift);
  const runs = {
    bear: runScenario(model, levers.bear),
    base: runScenario(model, base),
    bull: runScenario(model, levers.bull),
  };
  const raw = { bear: pricesOf(runs.bear), base: pricesOf(runs.base), bull: pricesOf(runs.bull) };
  // Clamping (growth or P/E limits) can make neighbours equal but never inverted; enforce it anyway.
  const set: ScenarioSet = { bear: { ...raw.bear }, base: { ...raw.base }, bull: { ...raw.bull } };
  for (const y of ["y1", "y2", "y3"] as const) {
    set.bear[y] = Math.min(raw.bear[y], raw.base[y]);
    set.bull[y] = Math.max(raw.bull[y], raw.base[y]);
  }
  return { set, runs, levers };
}
