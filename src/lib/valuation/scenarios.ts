import { clamp } from "./math";
import { ddmValueAt, growthPath, pePath, projectPath } from "./projection";
import { overlayShifts } from "./qualitative";
import type { Levers, ProjectionModel, ProjectionRow, ScenarioPrices, ScenarioSet, ValuationSettings } from "./types";

export interface ScenarioRun {
  /** Final rows, with the dividend cross-check and the qualitative overlay applied. */
  rows: ProjectionRow[];
  /** P/E-only path without the qualitative overlay (used by the waterfall). */
  quantRows: ProjectionRow[];
  /** Quant price per year after the dividend blend, before the overlay. */
  quantPrices: number[];
  exitPe: number;
  growth: number[];
  /** Actual price effect of the qualitative overlay in the final year, after the tilt cap. */
  tiltPct: number;
}

function blendDdm(model: ProjectionModel, rows: ProjectionRow[]): number[] {
  return rows.map((r) => {
    if (!model.ddm || model.ddm.weight <= 0) return r.price;
    const d = ddmValueAt(rows, r.year, model.ddm);
    if (d === null) return r.price;
    return (1 - model.ddm.weight) * r.price + model.ddm.weight * d;
  });
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
  const quantPrices = blendDdm(model, quantRows);

  // With the qualitative overlay: growth and multiple shift within their caps.
  const growth = growthPath(levers.growth + shifts.growthShift, model.sectorGrowth + shifts.growthShift, model.meanReversion, model.years, limits);
  const exitPe = clamp(qExit * (1 + shifts.multipleShift), model.minExitPe, model.maxExitPe);
  const rawRows = projectPath(model.eps0, growth, pePath(model.pe0, exitPe, model.years));
  const blended = blendDdm(model, rawRows);

  // The combined qualitative effect can never exceed ±tiltCap of the quantitative price.
  const rows = rawRows.map((r, i) => {
    const q = quantPrices[i];
    const price = clamp(blended[i], q * (1 - model.tiltCap), q * (1 + model.tiltCap));
    return { ...r, price };
  });
  const last = rows.length - 1;
  const tiltPct = quantPrices[last] > 0 ? rows[last].price / quantPrices[last] - 1 : 0;

  return { rows, quantRows, quantPrices, exitPe, growth, tiltPct };
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
