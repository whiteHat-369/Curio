import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useApiStore } from "@/lib/api-store";
import { overviewApi } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Gauge, MessageSquareText, Network, NotebookPen, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { slugify } from "@/lib/utils";

export const Route = createFileRoute("/_app/workspace/$name/")({
  component: Overview,
});

interface HealthData {
  paperCount: number;
  readCount: number;
  coveragePercent: number;
  recencyPercent: number;
  evidenceCount: number;
  notesCount: number;
  datasetCount: number;
  suggestions: string[];
}

function Overview() {
  const { name } = useParams({ from: "/_app/workspace/$name/" });
  const ws = useApiStore((s) => s.workspaces.find((w) => slugify(w.name) === name));
  const papers = useApiStore((s) => s.papers);

  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const wsPapers = ws ? papers.filter((p) => ws.paperIds.includes(p.id)) : [];

  useEffect(() => {
    if (!ws?.id) return;
    let cancel = false;
    setHealthLoading(true);
    const computeLocal = (): HealthData => {
      const currentYear = new Date().getFullYear();
      const paperCount = wsPapers.length;
      const readCount = wsPapers.filter((p) => p.status === "read").length;
      const recent = wsPapers.filter((p) => (p.year ?? 0) >= currentYear - 3).length;
      const coveragePercent = paperCount > 0 ? Math.round((readCount / paperCount) * 100) : 0;
      const recencyPercent = paperCount > 0 ? Math.round((recent / paperCount) * 100) : 0;
      const suggestions: string[] =
        paperCount === 0
          ? ["No papers added yet. Start by uploading papers to build your workspace library."]
          : [
              coveragePercent < 50
                ? `Only ${coveragePercent}% of papers have been read. Consider reviewing unread papers to improve coverage.`
                : `Great coverage! ${coveragePercent}% of papers in this workspace have been read.`,
              recencyPercent < 40
                ? `Only ${recencyPercent}% of papers are from the last 3 years. Consider adding recent publications.`
                : `Strong temporal recency: ${recencyPercent}% of papers were published within the last 3 years.`,
            ];
      return {
        paperCount,
        readCount,
        coveragePercent,
        recencyPercent,
        evidenceCount: 0,
        notesCount: 0,
        datasetCount: 0,
        suggestions,
      };
    };
    overviewApi
      .getHealth(ws.id)
      .then((data) => {
        if (!cancel && data && typeof data.coveragePercent === "number") {
          setHealth(data);
        } else if (!cancel) {
          setHealth(computeLocal());
        }
      })
      .catch(() => {
        // Backend unreachable — compute health locally so the panel still shows.
        if (!cancel) setHealth(computeLocal());
      })
      .finally(() => {
        if (!cancel) setHealthLoading(false);
      });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws?.id]);

  if (!ws) return null;
  const readCount = wsPapers.filter((p) => p.status === "read").length;

  return (
    <div className="mx-auto max-w-6xl px-8 py-8 animate-enter">
      <div className="mt-6 rounded-xl border border-border bg-card p-8">
        <p className="font-ui text-xs uppercase tracking-wider text-[var(--primary)]">
          Research question
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold leading-snug text-foreground md:text-3xl">
          {ws.question}
        </h1>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <div className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Papers
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">{wsPapers.length}</div>
          </div>
          <div>
            <div className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Read
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">
              {readCount}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                / {wsPapers.length}
              </span>
            </div>
          </div>
          <div>
            <div className="mb-1 font-ui text-xs uppercase tracking-wider text-muted-foreground">
              Progress
            </div>
            <Progress value={Math.min(100, Math.max(0, ws.progress))} className="h-1.5" />
            <div className="mt-1 font-ui text-xs text-muted-foreground">
              {Math.round(ws.progress)}%
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <QuickLink to={`/workspace/${slugify(ws.name)}/papers`} icon={BookOpen} label="Papers" />
        <QuickLink
          to={`/workspace/${slugify(ws.name)}/evidence`}
          icon={Network}
          label="Evidence Map"
        />
        <QuickLink
          to={`/workspace/${slugify(ws.name)}/chat`}
          icon={MessageSquareText}
          label="AI Chat"
        />
        <QuickLink to={`/workspace/${slugify(ws.name)}/notes`} icon={NotebookPen} label="Notes" />
      </div>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-lg font-semibold">Papers in this workspace</h2>
        {wsPapers.length === 0 ? (
          <Card className="border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No papers yet.{" "}
              <Link
                to={`/workspace/${slugify(ws.name)}/papers`}
                className="text-[var(--primary)] hover:underline"
              >
                Add some
              </Link>{" "}
              to get started.
            </p>
          </Card>
        ) : (
          <Card className="divide-y divide-border border-border p-0">
            {wsPapers.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                to={`/workspace/${slugify(ws.name)}/paper/${p.id}`}
                className="block px-5 py-3 transition-colors hover:bg-accent/40"
              >
                <div className="truncate text-sm text-foreground">{p.title}</div>
                <div className="font-ui text-xs text-muted-foreground">
                  {p.authors.join(", ")} · {p.year} · {p.status}
                </div>
              </Link>
            ))}
          </Card>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[var(--primary)]" />
          <h2 className="font-display text-lg font-semibold">Research health</h2>
        </div>
        {healthLoading ? (
          <Card className="flex items-center justify-center border-border p-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-[var(--primary)]" /> Loading research health metrics...
          </Card>
        ) : wsPapers.length === 0 || (health && health.paperCount === 0) ? (
          <Card className="border-dashed border-border p-8 text-center">
            <p className="text-sm font-medium text-foreground">No research activity yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add papers, notes, or evidence to calculate coverage and temporal recency metrics for this workspace.
            </p>
            <Button size="sm" variant="secondary" className="mt-4 font-ui" asChild>
              <Link to={`/workspace/${slugify(ws.name)}/papers`}>Upload papers</Link>
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              <GaugeCard
                label="Coverage"
                value={health?.coveragePercent ?? 0}
                caption="Read papers relative to total workspace paper collection"
              />
              <GaugeCard
                label="Recency"
                value={health?.recencyPercent ?? 0}
                caption="Share of papers published in the last 3 years"
              />
            </div>
            <Card className="mt-6 border-border p-6">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Recommendations
              </h3>
              <ul className="mt-4 space-y-4 text-sm text-foreground">
                {(health?.suggestions ?? []).map((sug, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                    <span>{sug}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </section>
    </div>
  );
}

function GaugeCard({ label, value, caption }: { label: string; value: number; caption: string }) {
  const size = 160;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  const tone = value >= 75 ? "var(--success)" : value >= 50 ? "var(--primary)" : "var(--warning)";
  return (
    <Card className="border-border p-6">
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              strokeWidth={stroke}
              stroke="var(--border)"
              fill="none"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              strokeWidth={stroke}
              stroke={tone}
              fill="none"
              strokeDasharray={c}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 700ms ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-display text-3xl font-semibold tabular-nums text-foreground">
              {value}
            </div>
            <div className="font-ui text-[10px] uppercase tracking-wider text-muted-foreground">
              / 100
            </div>
          </div>
        </div>
        <div className="mt-4 font-display text-base font-semibold text-foreground">{label}</div>
        <div className="mt-1 text-center font-ui text-xs text-muted-foreground">{caption}</div>
      </div>
    </Card>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-[var(--primary)]/40"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="mt-3 font-ui text-sm font-medium text-foreground">{label}</div>
    </Link>
  );
}
