import type { CalibratedParams, MarketInputs } from "./types.ts";

/**
 * Map UI microstructure knobs onto Almgren–Chriss / propagator coefficients.
 *
 * Temporary impact η is chosen so a TWAP of this parent over horizon T has
 * expected temporary cost equal to the square-root law
 *   I = Y · σ · S0 · √(Q / ADV)     (dollars per share)
 * which in bps is 1e4 · Y · σ_return · √participation.
 *
 * This is the empirically stable “square-root law” (Grinold–Kahn / Bouchaud–
 * Farmer–Lillo / Gatheral). Linear AC cannot generate it — that is the
 * misspecification experiment.
 */
export function calibrate(raw: MarketInputs): CalibratedParams {
  const S0 = raw.S0;
  const qty = raw.qty;
  const T = Math.max(raw.T, 1e-6);
  const sigmaReturn = raw.sigmaReturn;
  const adv = Math.max(raw.adv, 1);
  const Y = raw.Y;
  const participation = qty / adv;
  const sigmaAbs = sigmaReturn * S0;

  // I_dollar_per_share = Y * sigmaAbs * sqrt(Q/ADV)
  const iShare = Y * sigmaAbs * Math.sqrt(Math.max(participation, 1e-12));
  // TWAP temporary cost $ = η Q² / T   ⇒  per share η Q / T = iShare
  const eta = (iShare * T) / Math.max(qty, 1e-12);
  // Permanent: ½ γ Q per share = permFrac * iShare
  const gamma = (2 * raw.permFrac * iShare) / Math.max(qty, 1e-12);

  const halfLifeDays = Math.max(raw.halfLifeDays, 1e-4);
  const rho = Math.LN2 / halfLifeDays;

  // Power-law G(t) = g0 (t + t0)^{-β}. t0 is a short cutoff (~1 bar).
  const t0 = T / Math.max(raw.steps, 8);
  // Scale g0 so a TWAP produces roughly the same expected displacement as iShare.
  // Crude but stable: ∫_0^T G(t) (Q/T) dt ≈ iShare.
  const beta = raw.beta;
  let integ: number;
  if (Math.abs(beta - 1) < 1e-6) {
    integ = Math.log((T + t0) / t0);
  } else {
    integ = (Math.pow(T + t0, 1 - beta) - Math.pow(t0, 1 - beta)) / (1 - beta);
  }
  const g0 = (iShare * T) / Math.max(qty * integ, 1e-18);

  // Urgency u ∈ [0,1] → κT ∈ [0.04, 8]
  const kappaT = 0.04 + raw.urgency * 7.96;
  const kappa = kappaT / T;
  // κ = sqrt(λ σ² / η)  ⇒  λ = κ² η / σ²
  const lambdaRisk = (kappa * kappa * eta) / Math.max(sigmaAbs * sigmaAbs, 1e-18);

  return {
    ...raw,
    S0,
    qty,
    T,
    sigmaAbs,
    eta,
    gamma,
    rho,
    t0,
    g0,
    lambdaRisk,
    kappa,
    participation,
  };
}

export const DEFAULT_INPUTS: MarketInputs = {
  S0: 100,
  qty: 400_000,
  T: 1,
  steps: 78,
  sigmaReturn: 0.018,
  adv: 8_000_000,
  Y: 0.6,
  permFrac: 0.25,
  spreadBps: 1.5,
  halfLifeDays: 0.04, // ~15.6 minutes if T=1 is a 6.5h session... we treat T as days
  beta: 0.45,
  urgency: 0.38,
  informed: 0.35,
};

export function notional(p: { S0: number; qty: number }) {
  return p.S0 * p.qty;
}

export function bpsOfNotional(dollars: number, p: { S0: number; qty: number }) {
  return (1e4 * dollars) / Math.max(notional(p), 1e-12);
}
