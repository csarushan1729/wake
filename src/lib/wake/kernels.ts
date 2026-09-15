import type { CalibratedParams, KernelKind } from "./types.ts";

/** Propagator G(t) — dollars of mid displacement per share traded. */
export function propagator(kind: KernelKind, p: CalibratedParams, lag: number) {
  const t = Math.max(lag, 0);
  if (kind === "linear") {
    // Instantaneous temporary + permanent step. Encoded in the simulator,
    // not as a decaying kernel. Return 0 here.
    return 0;
  }
  if (kind === "exponential") {
    // G(t) = (η_ow) e^{-ρ t} with scale matched to square-root law via eta.
    // Depth inverse ≈ eta * ρ so initial hit is order-η.
    return p.eta * p.rho * Math.exp(-p.rho * t);
  }
  // power-law
  return p.g0 * Math.pow(t + p.t0, -p.beta);
}

export function kernelCurve(kind: KernelKind, p: CalibratedParams, n = 80) {
  const pts: { t: number; g: number }[] = [];
  if (kind === "linear") {
    // Show a Dirac-like temporary spike + flat permanent.
    pts.push({ t: 0, g: p.eta * 40 + p.gamma });
    const n2 = n - 1;
    for (let i = 0; i < n2; i++) {
      const t = ((i + 1) / n2) * p.T;
      pts.push({ t, g: p.gamma });
    }
    return pts;
  }
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * p.T;
    pts.push({ t, g: propagator(kind, p, t) });
  }
  return pts;
}

/**
 * Square-root law I(Q) in bps of notional.
 * I_bps = 1e4 · Y · σ_return · √(Q/ADV)
 */
export function squareRootBps(p: CalibratedParams, qty = p.qty) {
  return 1e4 * p.Y * p.sigmaReturn * Math.sqrt(qty / Math.max(p.adv, 1));
}

export function squareRootCurve(p: CalibratedParams) {
  const pts: { part: number; bps: number; qty: number }[] = [];
  for (let i = 1; i <= 24; i++) {
    const part = (i / 24) * 0.2; // 0–20% ADV
    const qty = part * p.adv;
    pts.push({ part: part * 100, qty, bps: 1e4 * p.Y * p.sigmaReturn * Math.sqrt(part) });
  }
  return pts;
}
