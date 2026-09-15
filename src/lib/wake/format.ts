export function fmtBps(x: number, digits = 1) {
  if (!Number.isFinite(x)) return "—";
  const sign = x > 0 ? "" : x < 0 ? "−" : "";
  return `${sign}${Math.abs(x).toFixed(digits)} bp`;
}

export function fmtNum(x: number, digits = 0) {
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

export function fmtCompact(x: number) {
  if (!Number.isFinite(x)) return "—";
  const abs = Math.abs(x);
  const sign = x < 0 ? "−" : "";
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}k`;
  return `${sign}${abs.toFixed(0)}`;
}

export function fmtPct(x: number, digits = 1) {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtHours(days: number) {
  return `${(days * 6.5).toFixed(1)}h`;
}

export function sessionLabel(tDays: number, T: number) {
  const hours = (tDays / T) * 6.5;
  const h = Math.floor(hours + 9.5);
  const m = Math.round((hours * 60) % 60);
  const hh = ((h % 24) + 24) % 24;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
