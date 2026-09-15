import { cn } from "@/lib/utils";

export function Metric({
  k,
  v,
  sub,
  tone = "default",
}: {
  k: string;
  v: string;
  sub?: string;
  tone?: "default" | "good" | "bad";
}) {
  return (
    <div className="min-w-0 rounded-lg bg-secondary/60 px-3 py-3 shadow-border">
      <div className="text-xs tracking-wide text-muted-foreground uppercase">{k}</div>
      <div
        className={cn(
          "mt-1 font-mono text-lg tabular leading-none",
          tone === "good" && "text-good",
          tone === "bad" && "text-bad",
          tone === "default" && "text-foreground",
        )}
      >
        {v}
      </div>
      {sub ? <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
