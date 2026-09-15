export function mean(xs: ArrayLike<number>) {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i]!;
  return xs.length ? s / xs.length : 0;
}

export function variance(xs: ArrayLike<number>, mu = mean(xs)) {
  if (xs.length < 2) return 0;
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    const d = xs[i]! - mu;
    s += d * d;
  }
  return s / (xs.length - 1);
}

export function stdev(xs: ArrayLike<number>) {
  return Math.sqrt(variance(xs));
}

export function quantile(xs: number[], q: number) {
  if (!xs.length) return 0;
  const a = xs.slice().sort((x, y) => x - y);
  const i = Math.min(a.length - 1, Math.max(0, q * (a.length - 1)));
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  const t = i - lo;
  return a[lo]! * (1 - t) + a[hi]! * t;
}

export function cvar(xs: number[], q: number) {
  if (!xs.length) return 0;
  const a = xs.slice().sort((x, y) => x - y);
  const cut = Math.max(1, Math.floor(q * a.length));
  // right-tail CVaR (bad shortfall is high)
  let s = 0;
  for (let i = cut; i < a.length; i++) s += a[i]!;
  const n = a.length - cut;
  return n ? s / n : a[a.length - 1]!;
}

export function histogram(xs: number[], bins = 24) {
  if (!xs.length) return { bins: [] as { x0: number; x1: number; y: number; mid: number }[], min: 0, max: 0 };
  let min = xs[0]!;
  let max = xs[0]!;
  for (const x of xs) {
    if (x < min) min = x;
    if (x > max) max = x;
  }
  if (max === min) max = min + 1;
  const w = (max - min) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const x of xs) {
    const i = Math.min(bins - 1, Math.floor((x - min) / w));
    counts[i]! += 1;
  }
  return {
    min,
    max,
    bins: counts.map((y, i) => ({
      x0: min + i * w,
      x1: min + (i + 1) * w,
      mid: min + (i + 0.5) * w,
      y,
    })),
  };
}

export function linspace(a: number, b: number, n: number) {
  const out = new Float64Array(n);
  if (n === 1) {
    out[0] = a;
    return out;
  }
  const d = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) out[i] = a + i * d;
  return out;
}

export function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}

export function cov(x: ArrayLike<number>, y: ArrayLike<number>) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += x[i]!;
    my += y[i]!;
  }
  mx /= n;
  my /= n;
  let s = 0;
  for (let i = 0; i < n; i++) s += (x[i]! - mx) * (y[i]! - my);
  return s / (n - 1);
}
