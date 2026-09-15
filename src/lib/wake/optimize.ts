import { propagator } from "./kernels.ts";
import { linspace } from "./stats.ts";
import type { CalibratedParams, KernelKind, Schedule } from "./types.ts";

/**
 * Project v onto { v ≥ 0, Σ v_i = s } (simplex with equal weights).
 * Michelot / Duchi algorithm.
 */
function projectSimplex(v: Float64Array, s: number) {
  const n = v.length;
  const u = Array.from(v).sort((a, b) => b - a);
  let cssv = 0;
  let rho = -1;
  let theta = 0;
  for (let i = 0; i < n; i++) {
    cssv += u[i]!;
    const t = (cssv - s) / (i + 1);
    if (u[i]! > t) {
      rho = i;
      theta = t;
    }
  }
  if (rho < 0) {
    const avg = s / n;
    for (let i = 0; i < n; i++) v[i] = Math.max(0, avg);
    return;
  }
  for (let i = 0; i < n; i++) v[i] = Math.max(0, v[i]! - theta);
}

/**
 * Discrete mean-variance execution under a chosen propagator.
 *
 * Cost ≈ η_temp ‖v‖² dt  +  vᵀ G v  +  λ σ² ‖x‖² dt
 * with x remaining from v, Σ v dt = Q, v ≥ 0.
 *
 * Linear kernel uses the AC quadratic (temporary + permanent) rather than G.
 * Exponential / power-law use the causal propagator matrix.
 *
 * n is kept modest (≤ 64) so projected gradient is instant in the browser.
 */
export function optimizeExecution(p: CalibratedParams, kind: KernelKind, iters = 90): Schedule {
  const n = Math.min(48, p.steps);
  const dt = p.T / n;
  const Q = p.qty;
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = Q / p.T; // TWAP start

  const G = new Float64Array(n * n);
  if (kind !== "linear") {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        const g = propagator(kind, p, (i - j) * dt);
        G[i * n + j] = g;
      }
    }
  }

  const grad = new Float64Array(n);
  const x = new Float64Array(n + 1);
  let lr = 0.35;

  for (let it = 0; it < iters; it++) {
    x[0] = Q;
    for (let i = 0; i < n; i++) x[i + 1] = x[i]! - v[i]! * dt;
    grad.fill(0);

    if (kind === "linear") {
      // d/dv (η dt Σ v² + ½ γ Q-related + λ σ² dt Σ x²)
      // permanent ½ γ Q² is schedule-invariant; skip.
      // remaining x_{k+1} = Q − dt Σ_{j≤k} v_j
      // ∂x_{k+1}/∂v_j = −dt for j≤k
      for (let i = 0; i < n; i++) {
        grad[i] = 2 * p.eta * dt * v[i]!;
      }
      for (let k = 0; k < n; k++) {
        const xk = x[k]!;
        const chain = 2 * p.lambdaRisk * p.sigmaAbs * p.sigmaAbs * dt * xk;
        for (let j = 0; j < k; j++) grad[j]! -= chain * dt;
      }
    } else {
      // vᵀ G v with G lower-triangular causal: impact on slice i from j≤i
      // cost_i ≈ (Σ_{j≤i} G_{i j} v_j dt) · v_i dt
      for (let i = 0; i < n; i++) {
        let hit = 0;
        for (let j = 0; j <= i; j++) hit += G[i * n + j]! * v[j]!;
        // d/dv_i (hit_i v_i) dt² + d/dv_i of later hits
        grad[i]! += hit * dt * dt + G[i * n + i]! * v[i]! * dt * dt;
        for (let k = i + 1; k < n; k++) {
          grad[i]! += G[k * n + i]! * v[k]! * dt * dt;
        }
      }
      for (let k = 0; k < n; k++) {
        const xk = x[k]!;
        const chain = 2 * p.lambdaRisk * p.sigmaAbs * p.sigmaAbs * dt * xk * 0.35;
        for (let j = 0; j < k; j++) grad[j]! -= chain * dt;
      }
    }

    // Gradient step then project.
    let gmax = 1e-12;
    for (let i = 0; i < n; i++) gmax = Math.max(gmax, Math.abs(grad[i]!));
    const step = lr / gmax;
    for (let i = 0; i < n; i++) v[i] = v[i]! - step * grad[i]!;
    projectSimplex(v, Q / dt);
    if (it % 20 === 19) lr *= 0.7;
  }

  // Upsample to p.steps.
  const N = p.steps;
  const t = linspace(0, p.T, N + 1);
  const xx = new Float64Array(N + 1);
  const vv = new Float64Array(N + 1);
  const coarseT = linspace(0, p.T, n + 1);
  const coarseX = new Float64Array(n + 1);
  coarseX[0] = Q;
  for (let i = 0; i < n; i++) coarseX[i + 1] = Math.max(0, coarseX[i]! - v[i]! * dt);
  coarseX[n] = 0;
  xx[0] = Q;
  const DT = p.T / N;
  for (let i = 1; i <= N; i++) {
    const ti = t[i]!;
    let k = 0;
    while (k < n && coarseT[k + 1]! < ti) k++;
    const t0 = coarseT[k]!;
    const t1 = coarseT[k + 1]!;
    const w = t1 === t0 ? 0 : (ti - t0) / (t1 - t0);
    xx[i] = (1 - w) * coarseX[k]! + w * coarseX[k + 1]!;
  }
  xx[N] = 0;
  for (let i = 0; i < N; i++) vv[i] = Math.max(0, (xx[i]! - xx[i + 1]!) / DT);
  vv[N] = vv[N - 1]!;
  return { id: "optimal", name: "Kernel-optimal", t, x: xx, v: vv, dt: DT };
}
