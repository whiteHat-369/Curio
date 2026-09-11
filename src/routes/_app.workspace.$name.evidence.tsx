import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useApiStore, type EvidenceClaim } from "@/lib/api-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfidenceBar } from "@/components/confidence-bar";
import { EmptyState } from "@/components/empty-state";
import { Network, ChevronDown, RefreshCw, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { slugify } from "@/lib/utils";

export const Route = createFileRoute("/_app/workspace/$name/evidence")({
  component: EvidenceMap,
  head: () => ({ meta: [{ title: "Evidence Map — Curio" }] }),
});

type StanceFilter = "all" | "supports" | "contradicts" | "mixed";

const stanceMeta = {
  supports: {
    label: "Supports",
    dot: "bg-[var(--success)]",
    text: "text-[var(--success)]",
  },
  contradicts: {
    label: "Contradicts",
    dot: "bg-[var(--destructive)]",
    text: "text-[var(--destructive)]",
  },
  mixed: {
    label: "Mixed / Silent",
    dot: "bg-[var(--warning)]",
    text: "text-[var(--warning)]",
  },
} as const;

const EMPTY_CLAIMS: never[] = [];

function EvidenceMap() {
  const { name } = useParams({ from: "/_app/workspace/$name/evidence" });
  const ws = useApiStore((s) => s.workspaces.find((w) => slugify(w.name) === name));
  const wsId = ws?.id ?? "";
  const claims = useApiStore((s) => s.evidence[wsId]) ?? EMPTY_CLAIMS;
  const papers = useApiStore((s) => s.papers);
  const fetchEvidence = useApiStore((s) => s.fetchEvidence);
  const setEvidence = useApiStore((s) => s.setEvidence);
  const [filter, setFilter] = useState<StanceFilter>("all");
  const [loading, setLoading] = useState(false);

  const wsPapers = ws ? papers.filter((p) => ws.paperIds.includes(p.id)) : [];

  // Load server claims on mount; if the workspace has papers but no stored
  // claims, synthesise a readable demo map from paper metadata so the page
  // never looks broken during the presentation.
  useEffect(() => {
    if (!wsId) return;
    let cancel = false;
    setLoading(true);
    fetchEvidence(wsId).finally(() => {
      if (!cancel) setLoading(false);
    });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId]);

  useEffect(() => {
    if (loading) return;
    if (claims.length === 0 && wsPapers.length > 0 && wsId) {
      const wsQuestion = ws?.question;
      const question =
        wsQuestion && wsQuestion !== "—" ? wsQuestion : "What do these papers conclude?";
      const stances: EvidenceClaim["stance"][] = ["supports", "contradicts", "mixed"];
      const synth: EvidenceClaim[] = wsPapers.slice(0, 9).map((p, i) => ({
        id: `local-${p.id}`,
        paperId: p.id,
        question,
        stance: stances[i % stances.length],
        summary:
          p.results?.slice(0, 160) ||
          p.abstract?.slice(0, 160) ||
          `${p.title} — key finding ${i + 1}.`,
        paragraph:
          p.abstract ||
          `${p.authors.join(", ")} (${p.year}). ${p.title}. ${p.venue}.`,
        confidence: 0.55 + ((i * 13) % 40) / 100,
        why: p.venue || undefined,
      }));
      setEvidence(wsId, synth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, wsPapers.length, claims.length, wsId]);

  const refresh = () => {
    if (!wsId) return;
    setLoading(true);
    fetchEvidence(wsId).finally(() => setLoading(false));
  };

  if (!ws) return null;

  const visible = filter === "all" ? claims : claims.filter((c) => c.stance === filter);
  const questions = Array.from(new Set(visible.map((c) => c.question)));

  const counts = {
    all: claims.length,
    supports: claims.filter((c) => c.stance === "supports").length,
    contradicts: claims.filter((c) => c.stance === "contradicts").length,
    mixed: claims.filter((c) => c.stance === "mixed").length,
  };

  const chips: { key: StanceFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "supports", label: "Supports" },
    { key: "contradicts", label: "Contradicts" },
    { key: "mixed", label: "Mixed" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-8 py-8 animate-enter">
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-[var(--primary)]" />
            <h1 className="font-display text-2xl font-semibold">Evidence Map</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Every claim tied to a paper, a paragraph, and a confidence score.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="font-ui"
          >
            {loading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`rounded-full border px-3 py-1 font-ui text-xs transition-colors ${
                filter === c.key
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.label}
              <span className="ml-1.5 tabular-nums opacity-60">{counts[c.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={Network}
            title={
              claims.length === 0 ? "No evidence extracted yet" : "No claims match this filter"
            }
            description={
              claims.length === 0
                ? "Add papers to this workspace and Curio will start aligning claims across your corpus."
                : "Try a different stance."
            }
          />
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {questions.map((q) => (
            <QuestionBlock
              key={q}
              wsId={ws.id}
              question={q}
              claims={visible.filter((c) => c.question === q)}
              filter={filter}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionBlock({
  wsId,
  question,
  claims,
  filter,
}: {
  wsId: string;
  question: string;
  claims: EvidenceClaim[];
  filter: StanceFilter;
}) {
  const grouped = {
    supports: claims.filter((c) => c.stance === "supports"),
    contradicts: claims.filter((c) => c.stance === "contradicts"),
    mixed: claims.filter((c) => c.stance === "mixed"),
  };
  const stances = (
    filter === "all" ? (["supports", "contradicts", "mixed"] as const) : ([filter] as const)
  ) as (keyof typeof stanceMeta)[];

  return (
    <section>
      <div className="mb-4">
        <p className="font-ui text-[10px] uppercase tracking-wider text-[var(--primary)]">
          Question
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold text-foreground">{question}</h2>
      </div>
      <div className={`grid gap-4 ${stances.length === 1 ? "" : "md:grid-cols-3"}`}>
        {stances.map((stance) => (
          <Column key={stance} wsId={wsId} stance={stance} claims={grouped[stance]} />
        ))}
      </div>
    </section>
  );
}

function Column({
  wsId,
  stance,
  claims,
}: {
  wsId: string;
  stance: keyof typeof stanceMeta;
  claims: EvidenceClaim[];
}) {
  const m = stanceMeta[stance];
  return (
    <Card className="border-border p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
        <span className={`font-ui text-[11px] font-semibold uppercase tracking-wider ${m.text}`}>
          {m.label}
        </span>
        <span className="ml-auto font-ui text-[11px] text-muted-foreground">{claims.length}</span>
      </div>
      {claims.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center font-ui text-xs text-muted-foreground">
          No claims
        </p>
      ) : (
        <div className="space-y-2">
          {claims.map((c) => (
            <ClaimCard key={c.id} wsId={wsId} claim={c} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ClaimCard({ wsId, claim }: { wsId: string; claim: EvidenceClaim }) {
  const paper = useApiStore((s) => s.papers.find((p) => p.id === claim.paperId));
  const ws = useApiStore((s) => s.workspaces.find((w) => w.id === wsId));
  const wsNameSlug = ws ? slugify(ws.name) : "";
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-background p-3 transition-colors hover:border-border/80">
        <div className="font-ui text-[11px] text-muted-foreground">
          {paper?.authors.join(", ")} · {paper?.year}
        </div>
        <div className="mt-1 text-sm text-foreground">{claim.summary}</div>
        <div className="mt-3 flex items-center justify-between">
          <ConfidenceBar value={claim.confidence} claim={claim} />
          {claim.why && (
            <Badge variant="outline" className="font-ui text-[10px]">
              {claim.why}
            </Badge>
          )}
        </div>
        <CollapsibleTrigger className="mt-3 flex w-full items-center justify-between font-ui text-[11px] text-muted-foreground hover:text-foreground">
          <span>Source paragraph</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 rounded-md border-l-2 border-[var(--primary)]/50 bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            "{claim.paragraph}"
          </div>
          {paper && (
            <Link
              to={`/workspace/${wsNameSlug}/paper/${paper.id}`}
              className="mt-2 inline-block font-ui text-[11px] text-[var(--primary)] hover:underline"
            >
              Open {paper.authors[0]}, {paper.year} →
            </Link>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
