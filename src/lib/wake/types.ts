export type KernelKind = "linear" | "exponential" | "powerlaw";

export type StrategyId = "twap" | "vwap" | "ac" | "ow" | "optimal";

export type MarketInputs = {
  /** Arrival mid. */
  S0: number;
  /** Parent sell quantity (shares). */
  qty: number;
  /** Horizon in days (1 = full session). */
  T: number;
  /** Discrete steps along the horizon. */
  steps: number;
  /** Daily return volatility (e.g. 0.02 = 2%). */
  sigmaReturn: number;
  /** Average daily volume (shares). */
  adv: number;
  /** Square-root-law prefactor Y (empirically ~0.5–1). */
  Y: number;
  /** Fraction of square-root impact treated as permanent (linear kernel). */
  permFrac: number;
  /** Half-spread, bps of mid. */
  spreadBps: number;
  /** Exponential-kernel half-life in days. */
  halfLifeDays: number;
  /** Power-law exponent β in G(t) ∝ (t+t0)^{-β}. */
  beta: number;
  /** Almgren–Chriss urgency: maps to κT ∈ ~0.05–8. */
  urgency: number;
  /** Informed-flow intensity in [0, 1] for toxicity demos. */
  informed: number;
};

export type CalibratedParams = MarketInputs & {
  sigmaAbs: number;
  eta: number;
  gamma: number;
  rho: number;
  t0: number;
  g0: number;
  lambdaRisk: number;
  kappa: number;
  participation: number;
};

export type Schedule = {
  id: StrategyId;
  name: string;
  t: Float64Array;
  /** Remaining inventory. */
  x: Float64Array;
  /** Sell rate (shares / day). */
  v: Float64Array;
  dt: number;
};

export type PathPoint = {
  t: number;
  mid: number;
  remaining: number;
  rate: number;
  kyle: number;
};

export type PathResult = {
  isDollar: number;
  isBps: number;
  points: PathPoint[] | null;
  kyleMean: number;
};

export type MonteCarloSummary = {
  strategy: StrategyId;
  name: string;
  n: number;
  meanBps: number;
  stdBps: number;
  p5: number;
  p50: number;
  p95: number;
  cvar95: number;
  /** Analytic mean when available (AC / TWAP linear). */
  analyticMeanBps: number | null;
  samples: number[];
};

export type FrontierPoint = {
  urgency: number;
  meanBps: number;
  stdBps: number;
  kappaT: number;
};
