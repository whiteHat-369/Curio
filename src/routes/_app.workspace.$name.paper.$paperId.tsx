import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useApiStore } from "@/lib/api-store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfidenceBar } from "@/components/confidence-bar";
import { TagEditor } from "@/components/tag-editor";
import { StatusCycle } from "@/components/status-cycle";
import { PinButton } from "@/components/pin-button";
import { PaperDetailSkeleton, useSimulatedLoad } from "@/components/skeletons";
import { AiSummary } from "@/components/ai-summary";
import { FileText, Highlighter, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";

export const Route = createFileRoute("/_app/workspace/$name/paper/$paperId")({
  component: PaperDetail,
  loader: ({ params }) => {
    // Paper existence is validated by the component via the API store
    return null;
  },
});

function PaperDetail() {
  const { name, paperId } = useParams({ from: "/_app/workspace/$name/paper/$paperId" });
  const ws = useApiStore((s) => s.workspaces.find((w) => slugify(w.name) === name));
  const paper = useApiStore((s) => s.papers.find((p) => p.id === paperId));
  const wsId = ws?.id ?? "";
  const evidenceForWs = useApiStore((s) => s.evidence[wsId]);
  const linked = (evidenceForWs ?? []).filter((e) => e.paperId === paperId);
  const annotations = useApiStore((s) => s.annotations[paperId]) ?? [];
  const addAnnotation = useApiStore((s) => s.addAnnotation);
  const removeAnnotation = useApiStore((s) => s.removeAnnotation);
  const fetchPapers = useApiStore((s) => s.fetchPapers);
  const fetchAnnotations = useApiStore((s) => s.fetchAnnotations);
  const fetchEvidence = useApiStore((s) => s.fetchEvidence);
  const [note, setNote] = useState("");
  const loading = useSimulatedLoad([paperId]);

  // Ensure full paper info exists even on direct navigation / refresh.
  useEffect(() => {
    if (!paper && ws?.id) fetchPapers(ws.id);
  }, [paper, ws?.id, fetchPapers]);
  useEffect(() => {
    if (ws?.id && paperId) {
      fetchAnnotations(ws.id, paperId);
      fetchEvidence(ws.id);
    }
  }, [ws?.id, paperId, fetchAnnotations, fetchEvidence]);

  if (loading) return <PaperDetailSkeleton />;
  if (!ws || !paper) return null;

  return (
    <div className="mx-auto max-w-6xl px-8 py-8 animate-enter">
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="font-ui text-xs uppercase tracking-wider text-muted-foreground">
            {paper.venue} · {paper.year}
          </div>
          <h1 className="mt-2 font-display text-2xl font-semibold leading-snug text-foreground md:text-3xl">
            {paper.title}
          </h1>
          <div className="mt-2 font-ui text-sm text-muted-foreground">
            {paper.authors.join(", ")}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <StatusCycle paperId={paper.id} />
            <PinButton paperId={paper.id} />
            <TagEditor paperId={paper.id} size="md" />
          </div>
          {paper.keywords.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {paper.keywords.map((k) => (
                <Badge key={k} variant="outline" className="font-ui text-[10px]">
                  {k}
                </Badge>
              ))}
            </div>
          )}

          <Card className="mt-8 border-border p-5">
            <AiSummary paperId={paper.id} />
          </Card>

          <section className="mt-8">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--primary)]" />
              <h2 className="font-display text-lg font-semibold text-foreground">
                View &amp; annotate
              </h2>
            </div>
            <Card className="mt-3 border-border bg-background p-6">
              <div className="mx-auto max-w-2xl space-y-5 font-serif text-[15px] leading-relaxed text-foreground">
                <p className="text-center font-display text-lg font-semibold">{paper.title}</p>
                <p className="text-center text-xs text-muted-foreground">
                  {paper.authors.join(", ")} — {paper.venue}, {paper.year}
                </p>
                <p>
                  <span className="font-semibold">Abstract. </span>
                  {paper.abstract}
                </p>
                <p>
                  <span className="font-semibold">Methodology. </span>
                  {paper.methodology}
                </p>
                <p>
                  <span className="font-semibold">Dataset. </span>
                  {paper.dataset}
                </p>
                <p>
                  <span className="font-semibold">Results. </span>
                  {paper.results}
                </p>
                <p>
                  <span className="font-semibold">Limitations. </span>
                  {paper.limitations}
                </p>
              </div>
            </Card>

            <Card className="mt-4 border-border p-5">
              <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Highlighter className="h-3.5 w-3.5" /> Annotations
              </h3>
              <div className="mt-3 flex gap-2">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note or highlight about this paper…"
                  className="min-h-[70px] resize-none text-sm"
                />
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  className="font-ui cursor-pointer"
                  onClick={() => {
                    if (!note.trim()) return;
                    addAnnotation(paper.id, note);
                    setNote("");
                    toast.success("Annotation added");
                  }}
                >
                  Add annotation
                </Button>
              </div>
              {annotations.length > 0 && (
                <div className="mt-4 space-y-2">
                  {annotations.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background p-3"
                    >
                      <div>
                        <p className="text-sm text-foreground">{a.text}</p>
                        <p className="mt-1 font-ui text-[10px] text-muted-foreground">
                          {a.createdAt}
                        </p>
                      </div>
                      <button
                        onClick={() => removeAnnotation(paper.id, a.id)}
                        className="shrink-0 text-muted-foreground hover:text-[var(--destructive)] cursor-pointer"
                        aria-label="Delete annotation"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>
        </div>

        <aside className="space-y-4">
          <Card className="border-border p-5">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Linked claims
            </h3>
            {linked.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No evidence links yet. Open the Evidence Map to align claims across your corpus.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {linked.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={`font-ui text-[10px] ${
                          c.stance === "supports"
                            ? "border-[var(--success)]/40 text-[var(--success)]"
                            : c.stance === "contradicts"
                              ? "border-[var(--destructive)]/40 text-[var(--destructive)]"
                              : "border-[var(--warning)]/40 text-[var(--warning)]"
                        }`}
                      >
                        {c.stance}
                      </Badge>
                      <ConfidenceBar value={c.confidence} claim={c} />
                    </div>
                    <div className="mt-2 text-sm text-foreground">{c.summary}</div>
                    <Link
                      to={`/workspace/${slugify(ws.name)}/evidence`}
                      className="mt-2 inline-block font-ui text-[11px] text-[var(--primary)] hover:underline"
                    >
                      View in Evidence Map →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
