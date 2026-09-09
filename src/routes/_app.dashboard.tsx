import { createFileRoute, Link } from "@tanstack/react-router";
import { useApiStore } from "@/lib/api-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { slugify } from "@/lib/utils";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Curio" }] }),
});

function Dashboard() {
  const workspaces = useApiStore((s) => s.workspaces);
  const papers = useApiStore((s) => s.papers);
  const userName = useApiStore((s) => s.userName);
  const inProgress = papers.filter((p) => p.status === "reading").slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mt-4">
        <h1 className="font-display text-2xl font-semibold">Welcome back, {userName ?? "there"}.</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick up where you left off, or start a new inquiry.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Stat label="Total papers" value={papers.length} sub="across all workspaces" />
        <Stat
          label="Read"
          value={papers.filter((p) => p.status === "read").length}
          sub={`of ${papers.length} papers`}
          positive
        />
      </div>

      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent workspaces</h2>
          <Link
            to="/workspaces"
            className="font-ui text-sm text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {workspaces.slice(0, 3).map((w) => (
            <Link key={w.id} to={`/workspace/${slugify(w.name)}`}>
              <Card className="group h-full border-border p-5 transition-colors hover:border-[var(--primary)]/40">
                <div className="flex items-center gap-2 font-ui text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {w.updatedAt}
                </div>
                <h3 className="mt-2 font-display text-base font-semibold text-foreground group-hover:text-[var(--primary)]">
                  {w.name}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{w.question}</p>
                <div className="mt-5 space-y-1.5">
                  <div className="flex items-center justify-between font-ui text-[11px] text-muted-foreground">
                    <span>{w.paperIds.length} papers</span>
                    <span>{Math.round(w.progress * 100)}% read</span>
                  </div>
                  <Progress value={w.progress * 100} className="h-1" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {inProgress.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-display text-lg font-semibold">Continue reading</h2>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {inProgress.map((p) => {
              const ws = workspaces.find((w) => w.paperIds.includes(p.id));
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                  <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{p.title}</div>
                    <div className="font-ui text-xs text-muted-foreground">
                      {p.authors.join(", ")} · {p.venue} · {p.year}
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="font-ui" asChild>
                    <Link to={ws ? `/workspace/${slugify(ws.name)}/paper/${p.id}` : "/dashboard"}>
                      Resume
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  positive,
}: {
  label: string;
  value: number;
  sub: string;
  positive?: boolean;
}) {
  return (
    <Card className="border-border p-5">
      <div className="font-ui text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="font-display text-3xl font-semibold text-foreground">{value}</div>
        {positive && (
          <span className="flex items-center gap-1 text-xs text-[var(--success)]">
            <TrendingUp className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="mt-1 font-ui text-xs text-muted-foreground">{sub}</div>
    </Card>
  );
}
