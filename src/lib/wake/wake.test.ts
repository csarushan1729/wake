import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calibrate, DEFAULT_INPUTS } from "./calibrate.ts";
import { squareRootBps } from "./kernels.ts";
import { misspecificationStudy } from "./misspec.ts";
import { optimizeExecution } from "./optimize.ts";
import { gaussian, mulberry32 } from "./rng.ts";
import {
  almgrenChriss,
  analyticAcCost,
  analyticTwapCost,
  obizhaevaWang,
  twap,
  vwap,
} from "./schedules.ts";
import { simulatePath } from "./simulate.ts";
import { mean, variance } from "./stats.ts";

const p = calibrate(DEFAULT_INPUTS);

function totalSold(s: { v: Float64Array; dt: number }) {
  let q = 0;
  for (let i = 0; i < s.v.length - 1; i++) q += s.v[i]! * s.dt;
  return q;
}

describe("schedules conserve inventory", () => {
  for (const [name, s] of [
    ["twap", twap(p)],
    ["vwap", vwap(p)],
    ["ac", almgrenChriss(p)],
    ["ow", obizhaevaWang(p)],
    ["opt-exp", optimizeExecution(p, "exponential", 40)],
  ] as const) {
    it(`${name} sells Q and ends at 0`, () => {
      assert.ok(Math.abs(totalSold(s) - p.qty) / p.qty < 1e-4, `${name} sold ${totalSold(s)}`);
      assert.equal(s.x[0], p.qty);
      assert.ok(Math.abs(s.x[s.x.length - 1]!) < 1e-4);
      for (let i = 1; i < s.x.length; i++) {
        assert.ok(s.x[i]! <= s.x[i - 1]! + 1e-6);
      }
    });
  }
});

describe("Almgren–Chriss limits", () => {
  it("collapses to TWAP as urgency → 0", () => {
    const q = calibrate({ ...DEFAULT_INPUTS, urgency: 0 });
    const ac = almgrenChriss(q);
    const tw = twap(q);
    let err = 0;
    for (let i = 0; i < ac.x.length; i++) err += Math.abs(ac.x[i]! - tw.x[i]!);
    err /= ac.x.length * q.qty;
    assert.ok(err < 0.03, `relative L1 ${err}`);
  });

  it("is strictly more front-loaded than TWAP at high urgency", () => {
    const q = calibrate({ ...DEFAULT_INPUTS, urgency: 0.85 });
    const ac = almgrenChriss(q);
    const tw = twap(q);
    const mid = Math.floor(ac.x.length / 2);
    assert.ok(ac.x[mid]! < tw.x[mid]!, "AC should have sold more by T/2");
  });

  it("analytic TWAP integrals match closed form", () => {
    const tw = analyticTwapCost(p);
    const Q = p.qty;
    const T = p.T;
    assert.ok(Math.abs(tw.mean - (0.5 * p.gamma * Q * Q + (p.eta * Q * Q) / T)) < 1e-6);
    assert.ok(Math.abs(tw.variance - p.sigmaAbs ** 2 * ((Q * Q * T) / 3)) < 1e-4);
  });

  it("front-loading raises ∫v² and cuts residual risk ∫x²", () => {
    const ac = analyticAcCost(p);
    const twIntV2 = (p.qty * p.qty) / p.T;
    const twIntX2 = (p.qty * p.qty * p.T) / 3;
    assert.ok(ac.intV2 > twIntV2 * 0.999, "AC temporary cost should exceed TWAP");
    assert.ok(ac.intX2 < twIntX2 * 1.001, "AC should hold less residual risk");
  });
});

describe("Obizhaeva–Wang blocks", () => {
  it("interior remaining tracks a(1+ρ(T−t))", () => {
    const s = obizhaevaWang(p);
    const a = p.qty / (2 + p.rho * p.T);
    assert.equal(s.x[0], p.qty);
    const i = 3;
    const t = s.t[i]!;
    const interior = a * (1 + p.rho * (p.T - t));
    const rel = Math.abs(s.x[i]! - interior) / p.qty;
    assert.ok(rel < 0.08, `rel ${rel}`);
  });
});

describe("square-root law", () => {
  it("quadrupling Q doubles impact", () => {
    const i1 = squareRootBps(p, p.qty);
    const i4 = squareRootBps(p, p.qty * 4);
    assert.ok(Math.abs(i4 / i1 - 2) < 1e-9);
  });
});

describe("RNG", () => {
  it("gaussian moments are sane", () => {
    const r = mulberry32(123);
    const xs: number[] = [];
    for (let i = 0; i < 8000; i++) xs.push(gaussian(r));
    assert.ok(Math.abs(mean(xs)) < 0.05);
    assert.ok(Math.abs(variance(xs) - 1) < 0.08);
  });
});

describe("linear-kernel Monte Carlo vs analytic TWAP", () => {
  it("mean IS is within sampling noise of closed form", () => {
    const q = calibrate({ ...DEFAULT_INPUTS, informed: 0, spreadBps: 0, steps: 48 });
    const tw = twap(q);
    const samples: number[] = [];
    for (let i = 0; i < 400; i++) {
      samples.push(simulatePath(q, tw, { kernel: "linear", seed: 9 + i, informed: 0 }).isDollar);
    }
    const mu = mean(samples);
    const theory = analyticTwapCost(q).mean;
    const se = Math.sqrt(variance(samples) / samples.length);
    assert.ok(
      Math.abs(mu - theory) < 5 * se + 0.15 * Math.abs(theory),
      `mu=${mu} theory=${theory} se=${se}`,
    );
  });
});

describe("misspecification study runs", () => {
  it("returns three rows and a finite cost gap", () => {
    const q = calibrate({ ...DEFAULT_INPUTS, steps: 36 });
    const r = misspecificationStudy(q, "exponential", 40);
    assert.equal(r.rows.length, 3);
    assert.ok(Number.isFinite(r.costOfBeingWrong));
  });
});
