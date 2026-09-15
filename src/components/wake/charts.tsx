import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = { fill: "#8a8d96", fontSize: 11, fontFamily: "IBM Plex Mono, ui-monospace, monospace" };
const grid = "rgba(236,236,232,0.06)";
const stroke = "#2a2e38";

type TipProps = {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string | number;
  labelFmt?: (v: string | number) => string;
};

function Tip({ active, payload, label, labelFmt }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md bg-popover px-2.5 py-2 text-xs shadow-border">
      <div className="mb-1 text-muted-foreground">{labelFmt ? labelFmt(label ?? "") : label}</div>
      {payload.map((p) => (
        <div key={String(p.name)} className="flex items-center justify-between gap-6 font-mono tabular">
          <span style={{ color: p.color }}>{p.name}</span>
          <span>{Number(p.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export function ChartCard({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-card p-4 shadow-border sm:p-5">
      <header className="mb-4 flex items-end justify-between gap-3">
        <h3 className="font-display text-xl italic leading-tight text-foreground">{title}</h3>
        {kicker ? <p className="text-xs text-muted-foreground">{kicker}</p> : null}
      </header>
      <div className="h-64">{children}</div>
    </section>
  );
}

export function Lines({
  data,
  xKey,
  series,
  yFmt,
  xFmt,
}: {
  data: Record<string, number | string>[];
  xKey: string;
  series: { key: string; color: string; dashed?: boolean }[];
  yFmt?: (v: number) => string;
  xFmt?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={axis}
          stroke={stroke}
          tickFormatter={(v) => (xFmt ? xFmt(Number(v)) : String(v))}
          minTickGap={24}
        />
        <YAxis
          tick={axis}
          stroke={stroke}
          width={48}
          tickFormatter={(v) => (yFmt ? yFmt(Number(v)) : String(v))}
        />
        <Tooltip
          content={(props) => (
            <Tip
              active={props.active}
              payload={props.payload as TipProps["payload"]}
              label={props.label as string | number | undefined}
              labelFmt={(v) => (xFmt ? xFmt(Number(v)) : String(v))}
            />
          )}
          cursor={{ stroke: "#c5ccd6", strokeOpacity: 0.35 }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#8a8d96" }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.key}
            stroke={s.color}
            strokeWidth={1.75}
            dot={false}
            strokeDasharray={s.dashed ? "4 4" : undefined}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function Areas({
  data,
  xKey,
  series,
  yFmt,
  xFmt,
}: {
  data: Record<string, number | string>[];
  xKey: string;
  series: { key: string; color: string }[];
  yFmt?: (v: number) => string;
  xFmt?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={axis}
          stroke={stroke}
          tickFormatter={(v) => (xFmt ? xFmt(Number(v)) : String(v))}
        />
        <YAxis
          tick={axis}
          stroke={stroke}
          width={48}
          tickFormatter={(v) => (yFmt ? yFmt(Number(v)) : String(v))}
        />
        <Tooltip
          content={(props) => (
            <Tip
              active={props.active}
              payload={props.payload as TipProps["payload"]}
              label={props.label as string | number | undefined}
            />
          )}
          cursor={{ stroke: "#c5ccd6", strokeOpacity: 0.35 }}
        />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.key}
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.12}
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Bars({
  data,
  xKey,
  yKey,
  yFmt,
}: {
  data: Record<string, number | string>[];
  xKey: string;
  yKey: string;
  yFmt?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey={xKey} tick={axis} stroke={stroke} minTickGap={20} />
        <YAxis
          tick={axis}
          stroke={stroke}
          width={44}
          tickFormatter={(v) => (yFmt ? yFmt(Number(v)) : String(v))}
        />
        <Tooltip
          content={(props) => (
            <Tip
              active={props.active}
              payload={props.payload as TipProps["payload"]}
              label={props.label as string | number | undefined}
            />
          )}
          cursor={{ fill: "rgba(197,204,214,0.08)" }}
        />
        <Bar dataKey={yKey} name={yKey} fill="#c5ccd6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export const C = {
  paper: "#ecece8",
  muted: "#8a8d96",
  steel: "#c5ccd6",
  good: "#8fae9a",
  bad: "#c47a72",
};
