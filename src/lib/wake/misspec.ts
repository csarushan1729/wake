import { bpsOfNotional } from "./calibrate.ts";
import { optimizeExecution } from "./optimize.ts";
import { almgrenChriss, analyticAcCost, twap } from "./schedules.ts";
import { runMonteCarlo } from "./simulate.ts";
import type { CalibratedParams, KernelKind, MonteCarloSummary } from "./types.ts";

export type MisspecResult = {
  trueKernel: KernelKind;
  assumed: string;
  rows: MonteCarloSummary[];
  /** Extra shortfall of AC-in-true-world vs kernel-optimal, bps. */
  costOfBeingWrong: number;
  analyticLinearTwapBps: number;
};

/**
 * True world is a decaying propagator (the empirically relevant case).
 * You optimize as if Almgren–Chriss linear impact were true.
 * The gap vs a kernel-optimal schedule is the cost of misspecification —
 * the result a desk actually cares about.
 */
export function misspecificationStudy(
  p: CalibratedParams,
  trueKernel: KernelKind = "powerlaw",
  paths = 280,
): MisspecResult {
  const ac = almgrenChriss(p);
  const tw = twap(p);
  const opt = optimizeExecution(p, trueKernel);
  const rows = [
    runMonteCarlo(p, tw, { kernel: trueKernel, paths, seed0: 11, informed: 0 }),
    runMonteCarlo(p, ac, { kernel: trueKernel, paths, seed0: 11, informed: 0 }),
    runMonteCarlo(p, opt, { kernel: trueKernel, paths, seed0: 11, informed: 0 }),
  ];
  const acRow = rows[1]!;
  const optRow = rows[2]!;
  return {
    trueKernel,
    assumed: "Almgren–Chriss linear",
    rows,
    costOfBeingWrong: acRow.meanBps - optRow.meanBps,
    analyticLinearTwapBps: bpsOfNotional(analyticAcCost({ ...p, kappa: 1e-8 }).mean, p),
  };
}
