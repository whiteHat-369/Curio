import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { breakdownForClaim } from "@/lib/store";
import type { EvidenceClaim } from "@/lib/api-store";

export function ConfidenceBar({
  value,
  showLabel = true,
  claim,
}: {
  value: number;
  showLabel?: boolean;
  claim?: EvidenceClaim;
}) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.8
      ? "bg-[var(--success)]"
      : value >= 0.6
        ? "bg-[var(--primary)]"
        : "bg-[var(--warning)]";
  const bar = (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <span className="font-ui text-[11px] tabular-nums text-muted-foreground">{pct}%</span>
      )}
    </div>
  );
  if (!claim) return bar;
  const b = breakdownForClaim(claim);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-help outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 rounded"
        >
          {bar}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-64 p-4">
        <div className="mb-3">
          <div className="font-ui text-[10px] uppercase tracking-wider text-muted-foreground">
            Confidence breakdown
          </div>
          <div className="mt-0.5 font-display text-xl font-semibold tabular-nums">{pct}%</div>
        </div>
        <div className="space-y-2">
          <Row label="Source count" value={b.sourceCount} />
          <Row label="Recency" value={b.recency} />
          <Row label="Method strength" value={b.methodStrength} />
          <Row label="Cross-paper consistency" value={b.consistency} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex justify-between font-ui text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
