import { linspace } from "./stats.ts";
import type { CalibratedParams, Schedule, StrategyId } from "./types.ts";

function makeSchedule(
  id: StrategyId,
  name: string,
  p: CalibratedParams,
  remaining: (t: number) => number,
): Schedule {
  const n = p.steps;
  const t = linspace(0, p.T, n + 1);
  const x = new Float64Array(n + 1);
  const v = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) x[i] = remaining(t[i]!);
  x[0] = p.qty;
  x[n] = 0;
  // Keep remaining nonincreasing and non-negative.
  for (let i = 1; i <= n; i++) {
    x[i] = Math.min(x[i - 1]!, Math.max(0, x[i]!));
  }
  x[n] = 0;
  const dt = p.T / n;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    v[i] = (x[i]! - x[i + 1]!) / dt;
    sum += v[i]! * dt;
  }
  // Exact notional conservation.
  if (sum > 0) {
    const scale = p.qty / sum;
    for (let i = 0; i < n; i++) v[i]! *= scale;
    let rem = p.qty;
    x[0] = rem;
    for (let i = 0; i < n; i++) {
      rem -= v[i]! * dt;
      x[i + 1] = Math.max(0, rem);
    }
    x[n] = 0;
  }
  v[n] = v[n - 1] ?? 0;
  return { id, name, t, x, v, dt };
}

/** TWAP: flat rate, linear remaining. */
export function twap(p: CalibratedParams): Schedule {
  return makeSchedule("twap", "TWAP", p, (t) => p.qty * (1 - t / p.T));
}

/**
 * VWAP against a synthetic U-shaped session volume curve
 *   λ(u) ∝ 0.55 + 1.8 (u − 0.5)²     u = t/T
 * Rate is proportional to volume so the parent completes on the horizon.
 */
export function vwap(p: CalibratedParams): Schedule {
  const n = p.steps;
  const dt = p.T / n;
  const dens = new Float64Array(n);
  let z = 0;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const d = 0.55 + 1.8 * (u - 0.5) * (u - 0.5);
    dens[i] = d;
    z += d;
  }
  const t = linspace(0, p.T, n + 1);
  const x = new Float64Array(n + 1);
  const v = new Float64Array(n + 1);
  x[0] = p.qty;
  for (let i = 0; i < n; i++) {
    v[i] = (p.qty * dens[i]!) / (z * dt);
    x[i + 1] = x[i]! - v[i]! * dt;
  }
  x[n] = 0;
  v[n] = v[n - 1]!;
  return { id: "vwap", name: "VWAP", t, x, v, dt };
}

/**
 * Almgren–Chriss (2000) mean-variance optimum, linear impact.
 * x(t) = Q sinh(κ(T−t)) / sinh(κT)
 * κ = sqrt(λ σ² / η)
 */
export function almgrenChriss(p: CalibratedParams): Schedule {
  const k = p.kappa;
  const kT = k * p.T;
  const sinhKT = Math.sinh(kT);
  return makeSchedule("ac", "Almgren–Chriss", p, (t) => {
    if (kT < 1e-6 || sinhKT === 0) return p.qty * (1 - t / p.T);
    return p.qty * (Math.sinh(k * (p.T - t)) / sinhKT);
  });
}

/**
 * Obizhaeva–Wang (2013) risk-neutral optimum for exponential resilience.
 * Equal blocks of size a = Q / (2 + ρT) at t=0 and t=T, continuous rate aρ
 * in between so the book displacement stays constant.
 *
 * Remaining for t ∈ (0,T): x(t) = a (1 + ρ(T−t))
 */
export function obizhaevaWang(p: CalibratedParams): Schedule {
  const a = p.qty / (2 + p.rho * p.T);
  return makeSchedule("ow", "Obizhaeva–Wang", p, (t) => {
    if (t <= 0) return p.qty;
    if (t >= p.T) return 0;
    return a * (1 + p.rho * (p.T - t));
  });
}

export function analyticAcCost(p: CalibratedParams) {
  const Q = p.qty;
  const T = p.T;
  const k = p.kappa;
  const kT = k * T;
  let intV2: number;
  let intX2: number;
  if (kT < 1e-6) {
    intV2 = (Q * Q) / T;
    intX2 = (Q * Q * T) / 3;
  } else {
    const s = Math.sinh(kT);
    const c = Math.cosh(kT);
    intV2 = (Q * Q * k * (s * c + kT)) / (2 * s * s);
    intX2 = (Q * Q * (s * c - kT)) / (2 * k * s * s);
  }
  const mean = 0.5 * p.gamma * Q * Q + p.eta * intV2;
  const variance = p.sigmaAbs * p.sigmaAbs * intX2;
  return { mean, variance, std: Math.sqrt(Math.max(variance, 0)), kappaT: kT, intV2, intX2 };
}

export function analyticTwapCost(p: CalibratedParams) {
  const Q = p.qty;
  const T = p.T;
  const mean = 0.5 * p.gamma * Q * Q + p.eta * ((Q * Q) / T);
  const variance = p.sigmaAbs * p.sigmaAbs * ((Q * Q * T) / 3);
  return { mean, variance, std: Math.sqrt(Math.max(variance, 0)) };
}

export function strategyById(id: StrategyId, p: CalibratedParams, optimal?: Schedule): Schedule {
  switch (id) {
    case "twap":
      return twap(p);
    case "vwap":
      return vwap(p);
    case "ac":
      return almgrenChriss(p);
    case "ow":
      return obizhaevaWang(p);
    case "optimal":
      return optimal ?? almgrenChriss(p);
  }
}
