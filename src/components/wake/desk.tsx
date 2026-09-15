import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Knob } from "@/components/wake/knob";
import { Metric } from "@/components/wake/metric";
import { Areas, Bars, C, ChartCard, Lines } from "@/components/wake/charts";
import { Notes } from "@/components/wake/notes";
import {
  almgrenChriss,
  analyticAcCost,
  analyticTwapCost,
  bpsOfNotional,
  calibrate,
  compareStrategies,
  DEFAULT_INPUTS,
  fmtBps,
  fmtCompact,
  fmtPct,
  frontier,
  histogram,
  kernelCurve,
  misspecificationStudy,
  obizhaevaWang,
  optimizeExecution,
  showcasePath,
  squareRootBps,
  squareRootCurve,
  twap,
  vwap,
  type KernelKind,
} from "@/lib/wake";

type PresetId = "liquid" | "future" | "toxic";

const PRESETS: Record<
  PresetId,
  { label: string; part: number; vol: number; Y: number; informed: number; urgency: number; hl: number }
> = {
  liquid: { label: "Liquid large-cap", part: 5, vol: 1.6, Y: 0.5, informed: 0.15, urgency: 0.32, hl: 18 },
  future: { label: "Index future", part: 8, vol: 1.2, Y: 0.4, informed: 0.2, urgency: 0.28, hl: 8 },
  toxic: { label: "Small-cap toxic", part: 12, vol: 3.2, Y: 0.85, informed: 0.72, urgency: 0.55, hl: 28 },
};

const KERNELS: { id: KernelKind; label: string }[] = [
  { id: "linear", label: "Linear AC" },
  { id: "exponential", label: "Exponential" },
  { id: "powerlaw", label: "Power-law" },
];

function sessionH(frac: number) {
  return `${(frac * 6.5).toFixed(1)}h`;
}

export function Desk() {
  const [part, setPart] = useState(5);
  const [horizon, setHorizon] = useState(1);
  const [vol, setVol] = useState(1.8);
  const [urgency, setUrgency] = useState(0.38);
  const [Y, setY] = useState(0.6);
  const [hl, setHl] = useState(16);
  const [informed, setInformed] = useState(0.35);
  const [kernel, setKernel] = useState<KernelKind>("powerlaw");
  const [preset, setPreset] = useState<PresetId>("liquid");
  const [tab, setTab] = useState("kernel");
  const [paths, setPaths] = useState(220);

  const p = useMemo(
    () =>
      calibrate({
        ...DEFAULT_INPUTS,
        qty: (part / 100) * DEFAULT_INPUTS.adv,
        T: Math.max(horizon, 0.12),
        sigmaReturn: vol / 100,
        Y,
        urgency,
        informed,
        halfLifeDays: hl / 390,
        steps: 64,
      }),
    [part, horizon, vol, Y, urgency, informed, hl],
  );

  const light = useMemo(() => {
    const tw = twap(p);
    const ac = almgrenChriss(p);
    const ow = obizhaevaWang(p);
    const vw = vwap(p);
    const opt = optimizeExecution(p, kernel, 70);
    const kPts = kernelCurve(kernel, p);
    const sr = squareRootCurve(p);
    const path = showcasePath(p, ac, kernel, 17, informed, false);
    const adapt = showcasePath(p, tw, kernel, 17, informed, true);
    const acA = analyticAcCost(p);
    const twA = analyticTwapCost(p);
    const rem = [];
    const rate = [];
    for (let i = 0; i < ac.t.length; i++) {
      const t = ac.t[i]!;
      rem.push({
        t,
        TWAP: tw.x[i]! / 1e3,
        VWAP: vw.x[i]! / 1e3,
        AC: ac.x[i]! / 1e3,
        OW: ow.x[i]! / 1e3,
        Optimal: opt.x[i]! / 1e3,
      });
      rate.push({
        t,
        TWAP: tw.v[i]! / 1e6,
        AC: ac.v[i]! / 1e6,
        OW: ow.v[i]! / 1e6,
        Optimal: opt.v[i]! / 1e6,
      });
    }
    return { tw, ac, ow, vw, opt, kPts, sr, path, adapt, acA, twA, rem, rate };
  }, [p, kernel, informed]);

  const heavy = useMemo(() => {
    if (tab !== "shortfall" && tab !== "misspec") return null;
    const mc = compareStrategies(p, [light.tw, light.vw, light.ac, light.ow, light.opt], kernel, paths, 0);
    const front = frontier(p, "linear", 8);
    const miss = misspecificationStudy(p, kernel === "linear" ? "exponential" : kernel, Math.min(paths, 240));
    return { mc, front, miss };
  }, [tab, p, kernel, paths, light.tw, light.vw, light.ac, light.ow, light.opt]);

  const srNow = squareRootBps(p);
  const tFmt = (t: number) => `${((t / p.T) * 6.5).toFixed(1)}h`;

  const pathMid = (light.path.points ?? []).map((pt, i) => ({
    t: pt.t,
    mid: pt.mid,
    adapt: light.adapt.points?.[i]?.mid ?? pt.mid,
  }));
  const pathKyle = (light.path.points ?? []).map((pt, i) => ({
    t: pt.t,
    kyle: pt.kyle * 1e6,
    adapt: (light.adapt.points?.[i]?.kyle ?? 0) * 1e6,
  }));

  function applyPreset(id: PresetId) {
    const x = PRESETS[id];
    setPreset(id);
    setPart(x.part);
    setVol(x.vol);
    setY(x.Y);
    setInformed(x.informed);
    setUrgency(x.urgency);
    setHl(x.hl);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-6 border-b border-border pb-8">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">
            Impact · execution · shortfall
          </p>
          <h1 className="font-display text-5xl italic leading-none text-foreground sm:text-6xl">WAKE</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            The wake of an order is the price you leave behind. A research desk for propagator
            kernels, optimal execution, and the cost of assuming the wrong impact model.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric k="Participation" v={fmtPct(p.participation)} sub={`${fmtCompact(p.qty)} sh`} />
          <Metric k="Square-root I" v={fmtBps(srNow)} sub={`Y = ${p.Y.toFixed(2)}`} />
          <Metric k="κT" v={p.kappa.toFixed(2)} sub="AC urgency" />
          <Metric
            k="Kernel"
            v={kernel === "powerlaw" ? "t⁻ᵝ" : kernel === "exponential" ? "e⁻ρt" : "linear"}
            sub={kernel}
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-4">
        <aside className="rounded-xl bg-card p-4 shadow-border lg:col-span-1 lg:sticky lg:top-4 lg:self-start">
          <details className="lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-medium">
              Parameters
            </summary>
            <Controls
              part={part}
              setPart={setPart}
              horizon={horizon}
              setHorizon={setHorizon}
              vol={vol}
              setVol={setVol}
              urgency={urgency}
              setUrgency={setUrgency}
              Y={Y}
              setY={setY}
              hl={hl}
              setHl={setHl}
              informed={informed}
              setInformed={setInformed}
              kernel={kernel}
              setKernel={setKernel}
              preset={preset}
              applyPreset={applyPreset}
            />
          </details>
          <div className="hidden lg:block">
            <p className="mb-3 text-xs tracking-widest text-muted-foreground uppercase">Parameters</p>
            <Controls
              part={part}
              setPart={setPart}
              horizon={horizon}
              setHorizon={setHorizon}
              vol={vol}
              setVol={setVol}
              urgency={urgency}
              setUrgency={setUrgency}
              Y={Y}
              setY={setY}
              hl={hl}
              setHl={setHl}
              informed={informed}
              setInformed={setInformed}
              kernel={kernel}
              setKernel={setKernel}
              preset={preset}
              applyPreset={applyPreset}
            />
          </div>
        </aside>

        <div className="min-w-0 lg:col-span-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="kernel">Kernel</TabsTrigger>
              <TabsTrigger value="schedule">Trajectories</TabsTrigger>
              <TabsTrigger value="path">Path</TabsTrigger>
              <TabsTrigger value="shortfall">Shortfall</TabsTrigger>
              <TabsTrigger value="misspec">Misspec</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="kernel" className="space-y-4">
              <ChartCard
                title="Propagator G(t)"
                kicker="dollars of mid per share, as a function of lag"
              >
                <Areas
                  data={light.kPts.map((d) => ({ t: d.t, G: d.g * 1e6 }))}
                  xKey="t"
                  series={[{ key: "G", color: C.steel }]}
                  xFmt={tFmt}
                  yFmt={(v) => v.toFixed(2)}
                />
              </ChartCard>
              <ChartCard
                title="Square-root law"
                kicker="I(Q) = Y σ √(Q/ADV), bps of notional — concave in size"
              >
                <Lines
                  data={light.sr.map((d) => ({
                    part: d.part,
                    bps: d.bps,
                  }))}
                  xKey="part"
                  series={[{ key: "bps", color: C.paper }]}
                  xFmt={(v) => `${v.toFixed(0)}%`}
                  yFmt={(v) => v.toFixed(1)}
                />
              </ChartCard>
              <p className="text-sm text-muted-foreground">
                Quadrupling the parent doubles the impact. That concavity is why you do not
                dump, and why a linear AC calibration at one size is wrong at another.
              </p>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric
                  k="AC E[IS] (linear)"
                  v={fmtBps(bpsOfNotional(light.acA.mean, p))}
                  sub={`σ(IS) ${fmtBps(bpsOfNotional(light.acA.std, p))}`}
                />
                <Metric
                  k="TWAP E[IS] (linear)"
                  v={fmtBps(bpsOfNotional(light.twA.mean, p))}
                  sub="closed form"
                />
                <Metric
                  k="Horizon"
                  v={sessionH(horizon)}
                  sub={`notional ${fmtCompact(p.S0 * p.qty)}`}
                />
              </div>
              <ChartCard title="Remaining inventory" kicker="thousands of shares">
                <Lines
                  data={light.rem}
                  xKey="t"
                  series={[
                    { key: "TWAP", color: C.muted, dashed: true },
                    { key: "VWAP", color: C.steel, dashed: true },
                    { key: "AC", color: C.paper },
                    { key: "OW", color: C.good },
                    { key: "Optimal", color: C.bad },
                  ]}
                  xFmt={tFmt}
                />
              </ChartCard>
              <ChartCard title="Trading rate" kicker="millions of shares / session">
                <Lines
                  data={light.rate}
                  xKey="t"
                  series={[
                    { key: "TWAP", color: C.muted, dashed: true },
                    { key: "AC", color: C.paper },
                    { key: "OW", color: C.good },
                    { key: "Optimal", color: C.bad },
                  ]}
                  xFmt={tFmt}
                />
              </ChartCard>
              <p className="text-sm text-muted-foreground">
                OW’s opening and closing blocks are the Dirac masses smeared onto the first
                and last bars. AC front-loads as urgency rises. Kernel-optimal is a discrete
                quadratic program under the selected G — not a rename of AC.
              </p>
            </TabsContent>

            <TabsContent value="path" className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric k="AC path IS" v={fmtBps(light.path.isBps)} sub="one seeded path" />
                <Metric
                  k="Adaptive IS"
                  v={fmtBps(light.adapt.isBps)}
                  sub="slows when Kyle λ spikes"
                  tone={light.adapt.isBps < light.path.isBps ? "good" : "default"}
                />
                <Metric k="Informed intensity" v={fmtPct(informed)} sub="mid-session news window" />
              </div>
              <ChartCard title="Mid" kicker="seeded path, same noise, two policies">
                <Lines
                  data={pathMid}
                  xKey="t"
                  series={[
                    { key: "mid", color: C.paper },
                    { key: "adapt", color: C.good },
                  ]}
                  xFmt={tFmt}
                  yFmt={(v) => v.toFixed(2)}
                />
              </ChartCard>
              <ChartCard title="Rolling Kyle λ" kicker="×10⁶, signed-volume on mid increment">
                <Lines
                  data={pathKyle}
                  xKey="t"
                  series={[
                    { key: "kyle", color: C.steel },
                    { key: "adapt", color: C.good },
                  ]}
                  xFmt={tFmt}
                />
              </ChartCard>
              <p className="text-sm text-muted-foreground">
                Informed flow is a signed burst correlated with a subsequent drift. λ rises;
                the adaptive policy cuts participation and catches up in the last 8% of the
                horizon. It is not magic — it is a state-dependent schedule with a hard
                completion constraint.
              </p>
            </TabsContent>

            <TabsContent value="shortfall" className="space-y-4">
              {!heavy ? (
                <p className="text-sm text-muted-foreground">Computing…</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Monte Carlo paths</span>
                    {[120, 220, 480].map((n) => (
                      <Button
                        key={n}
                        size="sm"
                        variant={paths === n ? "default" : "outline"}
                        onClick={() => setPaths(n)}
                      >
                        {n}
                      </Button>
                    ))}
                    <Badge>{kernel} world</Badge>
                  </div>
                  <div className="overflow-x-auto rounded-xl bg-card shadow-border">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-4 py-3 font-medium">Policy</th>
                          <th className="px-4 py-3 font-medium">Mean</th>
                          <th className="px-4 py-3 font-medium">Std</th>
                          <th className="px-4 py-3 font-medium">p5</th>
                          <th className="px-4 py-3 font-medium">p95</th>
                          <th className="px-4 py-3 font-medium">CVaR95</th>
                          <th className="px-4 py-3 font-medium">Analytic</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono tabular">
                        {heavy.mc.map((r) => (
                          <tr key={r.strategy} className="border-b border-border/70">
                            <td className="px-4 py-3 font-sans">{r.name}</td>
                            <td className="px-4 py-3">{fmtBps(r.meanBps)}</td>
                            <td className="px-4 py-3">{fmtBps(r.stdBps)}</td>
                            <td className="px-4 py-3">{fmtBps(r.p5)}</td>
                            <td className="px-4 py-3">{fmtBps(r.p95)}</td>
                            <td className="px-4 py-3">{fmtBps(r.cvar95)}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {r.analyticMeanBps == null ? "—" : fmtBps(r.analyticMeanBps)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ChartCard title="Shortfall histogram" kicker={`${heavy.mc[2]?.name ?? "AC"} · bps`}>
                    <Bars
                      data={histogram(heavy.mc[2]?.samples ?? [], 18).bins.map((b) => ({
                        x: b.mid.toFixed(1),
                        n: b.y,
                      }))}
                      xKey="x"
                      yKey="n"
                    />
                  </ChartCard>
                  <ChartCard
                    title="Risk–cost frontier"
                    kicker="Almgren–Chriss objective, linear analytics — move urgency"
                  >
                    <Lines
                      data={heavy.front.map((f) => ({
                        std: f.stdBps,
                        mean: f.meanBps,
                      }))}
                      xKey="std"
                      series={[{ key: "mean", color: C.paper }]}
                      xFmt={(v) => v.toFixed(1)}
                      yFmt={(v) => v.toFixed(1)}
                    />
                  </ChartCard>
                </>
              )}
            </TabsContent>

            <TabsContent value="misspec" className="space-y-4">
              {!heavy ? (
                <p className="text-sm text-muted-foreground">Computing…</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric
                      k="Mean gap AC − opt"
                      v={fmtBps(heavy.miss.costOfBeingWrong, 2)}
                      sub="positive = AC more expensive"
                      tone={heavy.miss.costOfBeingWrong > 0.5 ? "bad" : "default"}
                    />
                    <Metric
                      k="CVaR gap AC − opt"
                      v={fmtBps((heavy.miss.rows[1]?.cvar95 ?? 0) - (heavy.miss.rows[2]?.cvar95 ?? 0), 1)}
                      sub="tails, same seeds"
                    />
                    <Metric k="True kernel" v={heavy.miss.trueKernel} sub={`assumed ${heavy.miss.assumed}`} />
                  </div>
                  <div className="overflow-x-auto rounded-xl bg-card shadow-border">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-4 py-3 font-medium">Schedule</th>
                          <th className="px-4 py-3 font-medium">Mean IS</th>
                          <th className="px-4 py-3 font-medium">p95</th>
                          <th className="px-4 py-3 font-medium">CVaR95</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono tabular">
                        {heavy.miss.rows.map((r) => (
                          <tr key={r.strategy} className="border-b border-border/70">
                            <td className="px-4 py-3 font-sans">{r.name}</td>
                            <td className="px-4 py-3">{fmtBps(r.meanBps)}</td>
                            <td className="px-4 py-3">{fmtBps(r.p95)}</td>
                            <td className="px-4 py-3">{fmtBps(r.cvar95)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Same seeds, true kernel ≠ linear AC. Mean gap is extra impact from
                    front-loading into a concave G. CVaR gap is inventory risk: AC often
                    wins the tail because it finishes earlier. A small mean gap at 5% ADV
                    is a result — crank participation or urgency before you claim an edge.
                  </p>
                </>
              )}
            </TabsContent>

            <TabsContent value="notes">
              <div className="rounded-xl bg-card p-5 shadow-border sm:p-8">
                <Notes />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function Controls(props: {
  part: number;
  setPart: (n: number) => void;
  horizon: number;
  setHorizon: (n: number) => void;
  vol: number;
  setVol: (n: number) => void;
  urgency: number;
  setUrgency: (n: number) => void;
  Y: number;
  setY: (n: number) => void;
  hl: number;
  setHl: (n: number) => void;
  informed: number;
  setInformed: (n: number) => void;
  kernel: KernelKind;
  setKernel: (k: KernelKind) => void;
  preset: PresetId;
  applyPreset: (id: PresetId) => void;
}) {
  return (
    <div className="space-y-5 pt-2">
      <div>
        <p className="mb-2 text-xs tracking-widest text-muted-foreground uppercase">Book</p>
        <div className="flex flex-col gap-2">
          {(Object.keys(PRESETS) as PresetId[]).map((id) => (
            <Button
              key={id}
              size="sm"
              variant={props.preset === id ? "default" : "outline"}
              className="h-11 w-full justify-start"
              onClick={() => props.applyPreset(id)}
            >
              {PRESETS[id].label}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs tracking-widest text-muted-foreground uppercase">Kernel</p>
        <div className="flex flex-col gap-2">
          {KERNELS.map((k) => (
            <Button
              key={k.id}
              size="sm"
              variant={props.kernel === k.id ? "default" : "outline"}
              className="h-11 w-full justify-start"
              onClick={() => props.setKernel(k.id)}
            >
              {k.label}
            </Button>
          ))}
        </div>
      </div>
      <Knob
        label="Participation"
        value={props.part}
        display={`${props.part.toFixed(1)}% ADV`}
        min={1}
        max={18}
        step={0.5}
        onChange={props.setPart}
      />
      <Knob
        label="Horizon"
        value={props.horizon}
        display={sessionH(props.horizon)}
        min={0.15}
        max={1}
        step={0.05}
        onChange={props.setHorizon}
      />
      <Knob
        label="Daily vol"
        value={props.vol}
        display={`${props.vol.toFixed(1)}%`}
        min={0.6}
        max={5}
        step={0.1}
        onChange={props.setVol}
      />
      <Knob
        label="Urgency κT"
        value={props.urgency}
        display={props.urgency.toFixed(2)}
        min={0}
        max={1}
        step={0.01}
        onChange={props.setUrgency}
        hint="0 is TWAP. 1 dumps."
      />
      <Knob
        label="Y (sqrt prefactor)"
        value={props.Y}
        display={props.Y.toFixed(2)}
        min={0.3}
        max={1.2}
        step={0.05}
        onChange={props.setY}
      />
      <Knob
        label="Resilience half-life"
        value={props.hl}
        display={`${props.hl.toFixed(0)} min`}
        min={4}
        max={60}
        step={1}
        onChange={props.setHl}
      />
      <Knob
        label="Informed flow"
        value={props.informed}
        display={fmtPct(props.informed, 0)}
        min={0}
        max={1}
        step={0.05}
        onChange={props.setInformed}
      />
    </div>
  );
}
