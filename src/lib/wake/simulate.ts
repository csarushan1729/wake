import { gaussian, mulberry32 } from "./rng.ts";
import { cvar, mean, quantile, stdev } from "./stats.ts";
import { almgrenChriss, analyticAcCost, analyticTwapCost } from "./schedules.ts";
import { bpsOfNotional } from "./calibrate.ts";
import type {
  CalibratedParams,
  KernelKind,
  MonteCarloSummary,
  PathPoint,
  PathResult,
  Schedule,
} from "./types.ts";

export type SimOpts = {
  kernel: KernelKind;
  seed: number;
  informed: number;
  recordPath?: boolean;
  adaptive?: boolean;
};

function uShape(u: number) {
  return 0.55 + 1.8 * (u - 0.5) * (u - 0.5);
}

/**
 * One execution path. Selling Q: cash proceeds, IS = Q S0 − cash.
 *
 * Linear: dS = σ dW − γ v_ours dt,  exec = S − η v − half-spread.
 * Exponential: displacement D with resilience ρ, S = Sfair − D.
 * Power-law: causal sum of G(t−s) v_s.
 *
 * Informed flow (toxicity): a mid-horizon “news” window with correlated
 * signed volume and a subsequent drift — Kyle’s λ spikes, adaptive slows.
 */
export function simulatePath(p: CalibratedParams, sched: Schedule, opts: SimOpts): PathResult {
  const rand = mulberry32(opts.seed);
  const n = p.steps;
  const dt = p.T / n;
  const half = p.S0 * (p.spreadBps / 1e4) * 0.5;
  let Sfair = p.S0;
  let D = 0;
  let cash = 0;
  let remaining = p.qty;

  const news0 = Math.floor(n * 0.32);
  const news1 = Math.floor(n * 0.55);
  const newsSign = rand() > 0.5 ? 1 : -1;
  const flowScale = 0.35 * (p.adv / Math.max(p.T, 1e-6));

  const histV = opts.kernel === "powerlaw" ? new Float64Array(n) : null;
  const points: PathPoint[] | null = opts.recordPath ? [] : null;

  const win = 8;
  const dSWin: number[] = [];
  const svWin: number[] = [];
  let kyle = 0;
  let kyleSum = 0;
  let kyleN = 0;

  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const inNews = opts.informed > 0 && i >= news0 && i < news1;
    const informedFlow =
      (inNews ? newsSign * opts.informed * flowScale * (0.6 + 0.8 * rand()) : 0) +
      (1 - opts.informed * 0.5) * flowScale * 0.15 * gaussian(rand);
    const volT = (p.adv / p.T) * uShape(u);
    const noise = 0.12 * volT * gaussian(rand);

    let vOurs = sched.v[i] ?? 0;
    if (opts.adaptive) {
      const tLeft = Math.max(p.T - i * dt, dt);
      const base = remaining / tLeft;
      const slow = 1 / (1 + 2.8 * Math.max(0, kyle) * 8e6);
      const cap = 0.28 * volT;
      vOurs = Math.min(cap, Math.max(0, base * (0.45 + 0.55 * slow)));
      if (i > n * 0.92) vOurs = Math.max(vOurs, remaining / tLeft);
    }
    vOurs = Math.min(vOurs, remaining / dt);
    const signed = vOurs + informedFlow + noise;

    const z = gaussian(rand);
    const dW = p.sigmaAbs * Math.sqrt(dt) * z;
    const Sprev = Sfair - D;

    if (opts.kernel === "linear") {
      Sfair = Sfair + dW - p.gamma * (vOurs + 0.25 * (informedFlow + noise)) * dt;
      D = p.eta * vOurs;
    } else if (opts.kernel === "exponential") {
      Sfair += dW;
      D = D * Math.exp(-p.rho * dt) + p.eta * p.rho * (vOurs + 0.35 * (informedFlow + noise)) * dt;
    } else {
      Sfair += dW;
      if (histV) histV[i] = vOurs + 0.35 * (informedFlow + noise);
      D = 0;
      if (histV) {
        for (let j = 0; j <= i; j++) {
          const lag = (i - j) * dt;
          D += p.g0 * Math.pow(lag + p.t0, -p.beta) * histV[j]! * dt;
        }
      }
    }

    const mid = Sfair - D;
    const exec = mid - p.eta * vOurs * (opts.kernel === "linear" ? 0 : 0.15) - half;
    cash += exec * vOurs * dt;
    remaining = Math.max(0, remaining - vOurs * dt);

    const dMid = mid - Sprev;
    dSWin.push(dMid);
    svWin.push(signed * dt);
    if (dSWin.length > win) {
      dSWin.shift();
      svWin.shift();
    }
    if (dSWin.length === win) {
      let ms = 0;
      let mv = 0;
      for (let k = 0; k < win; k++) {
        ms += dSWin[k]!;
        mv += svWin[k]!;
      }
      ms /= win;
      mv /= win;
      let cv = 0;
      let vv = 0;
      for (let k = 0; k < win; k++) {
        cv += (dSWin[k]! - ms) * (svWin[k]! - mv);
        vv += (svWin[k]! - mv) * (svWin[k]! - mv);
      }
      kyle = vv > 1e-18 ? cv / vv : 0;
      kyleSum += kyle;
      kyleN += 1;
    }

    if (points) {
      points.push({
        t: i * dt,
        mid,
        remaining,
        rate: vOurs,
        kyle,
      });
    }
  }

  if (remaining > 1e-6) {
    const mid = Sfair - D;
    cash += (mid - half) * remaining;
    remaining = 0;
  }

  const isDollar = p.qty * p.S0 - cash;
  return {
    isDollar,
    isBps: bpsOfNotional(isDollar, p),
    points,
    kyleMean: kyleN ? kyleSum / kyleN : 0,
  };
}

export function runMonteCarlo(
  p: CalibratedParams,
  sched: Schedule,
  opts: Omit<SimOpts, "recordPath" | "seed"> & { paths: number; seed0: number },
): MonteCarloSummary {
  const samples: number[] = [];
  for (let i = 0; i < opts.paths; i++) {
    const r = simulatePath(p, sched, {
      kernel: opts.kernel,
      informed: opts.informed,
      adaptive: opts.adaptive,
      seed: opts.seed0 + i * 9973,
    });
    samples.push(r.isBps);
  }
  const mu = mean(samples);
  let analytic: number | null = null;
  if (opts.kernel === "linear" && !opts.adaptive) {
    if (sched.id === "ac") analytic = bpsOfNotional(analyticAcCost(p).mean, p);
    if (sched.id === "twap") analytic = bpsOfNotional(analyticTwapCost(p).mean, p);
  }
  return {
    strategy: sched.id,
    name: sched.name,
    n: opts.paths,
    meanBps: mu,
    stdBps: stdev(samples),
    p5: quantile(samples, 0.05),
    p50: quantile(samples, 0.5),
    p95: quantile(samples, 0.95),
    cvar95: cvar(samples, 0.95),
    analyticMeanBps: analytic,
    samples,
  };
}

export function showcasePath(
  p: CalibratedParams,
  sched: Schedule,
  kernel: KernelKind,
  seed = 1,
  informed = 0.35,
  adaptive = false,
): PathResult {
  return simulatePath(p, sched, { kernel, seed, informed, recordPath: true, adaptive });
}

export function compareStrategies(
  p: CalibratedParams,
  schedules: Schedule[],
  kernel: KernelKind,
  paths: number,
  informed: number,
): MonteCarloSummary[] {
  return schedules.map((s) =>
    runMonteCarlo(p, s, { kernel, paths, seed0: 42, informed, adaptive: false }),
  );
}

export function frontier(p: CalibratedParams, kernel: KernelKind, points = 9) {
  const out: { urgency: number; kappaT: number; meanBps: number; stdBps: number }[] = [];
  for (let i = 0; i < points; i++) {
    const urgency = i / (points - 1);
    const kappa = (0.04 + urgency * 7.96) / p.T;
    const q: CalibratedParams = {
      ...p,
      urgency,
      kappa,
      lambdaRisk: (kappa * kappa * p.eta) / Math.max(p.sigmaAbs * p.sigmaAbs, 1e-18),
    };
    const ac = analyticAcCost(q);
    if (kernel === "linear") {
      out.push({
        urgency,
        kappaT: q.kappa * q.T,
        meanBps: bpsOfNotional(ac.mean, q),
        stdBps: bpsOfNotional(ac.std, q),
      });
    } else {
      const sched = almgrenChriss(q);
      const mc = runMonteCarlo(q, sched, { kernel, paths: 160, seed0: 7, informed: 0 });
      out.push({ urgency, kappaT: q.kappa * q.T, meanBps: mc.meanBps, stdBps: mc.stdBps });
    }
  }
  return out;
}
