import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useApiStore, type PaperWithMeta } from "@/lib/api-store";
import { citationsApi } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Download, Quote, Sparkles, Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { slugify } from "@/lib/utils";

export const Route = createFileRoute("/_app/workspace/$name/citations")({
  component: CitationsPage,
  head: () => ({ meta: [{ title: "Citations — Curio" }] }),
});

type Fmt = "APA" | "IEEE" | "BibTeX";

function bibKey(p: PaperWithMeta): string {
  const first = (p.authors[0] ?? "anon")
    .split(/[\s,]+/)[0]
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const word = p.title.split(/\s+/).find((w) => w.length > 3) ?? "paper";
  return `${first}${p.year}${word.toLowerCase().replace(/[^a-z]/g, "")}`.slice(0, 32);
}

function formatCitation(p: PaperWithMeta, f: Fmt): string {
  const authors = p.authors.join(", ");
  if (f === "APA") return `${authors} (${p.year}). ${p.title}. ${p.venue}.`;
  if (f === "IEEE") return `${authors}, "${p.title}," ${p.venue}, ${p.year}.`;
  return `@article{${bibKey(p)},
  title   = {${p.title}},
  author  = {${p.authors.join(" and ")}},
  journal = {${p.venue}},
  year    = {${p.year}}
}`;
}

function CitationsPage() {
  const { name } = useParams({ from: "/_app/workspace/$name/citations" });
  const ws = useApiStore((s) => s.workspaces.find((w) => slugify(w.name) === name));
  const allPapers = useApiStore((s) => s.papers);
  const defaultCiteFormat = useApiStore((s) => s.defaultCiteFormat);
  const [fmt, setFmt] = useState<Fmt>(defaultCiteFormat);
  const [generated, setGenerated] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  if (!ws) return null;
  const papers = allPapers.filter((p) => ws.paperIds.includes(p.id));

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Copied to clipboard");
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportAction = async () => {
    setExporting(true);
    try {
      const idsParam = selected.size > 0 ? Array.from(selected).join(",") : undefined;
      const res = await citationsApi.export(ws.id, { format: fmt, ids: idsParam });
      if (res?.citations) {
        copy(res.citations);
      } else {
        const targets = selected.size > 0 ? papers.filter((p) => selected.has(p.id)) : papers;
        copy(targets.map((p) => formatCitation(p, fmt)).join("\n\n"));
      }
    } catch {
      const targets = selected.size > 0 ? papers.filter((p) => selected.has(p.id)) : papers;
      copy(targets.map((p) => formatCitation(p, fmt)).join("\n\n"));
    } finally {
      setExporting(false);
    }
  };

  const generateIds = async (ids: string[], force = false) => {
    const targets = force ? ids : ids.filter((id) => !generated.has(id));
    if (targets.length === 0) return;
    setLoadingIds((prev) => new Set([...prev, ...targets]));
    try {
      await citationsApi.aiGenerate(ws.id, targets);
      setGenerated((prev) => new Set([...prev, ...targets]));
    } catch {
      setGenerated((prev) => new Set([...prev, ...targets]));
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        targets.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const generateOne = (id: string) => generateIds([id], true);
  const generateSelectedOrAll = () => {
    const ids = selected.size > 0 ? Array.from(selected) : papers.map((p) => p.id);
    generateIds(ids);
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-[var(--primary)]" />
            <h1 className="font-display text-2xl font-semibold">Citations</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Copy or export any paper — one, several, or all.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <span className="font-ui text-xs text-muted-foreground">{selected.size} selected</span>
          )}
          <div className="flex rounded-md border border-border bg-card p-0.5">
            {(["APA", "IEEE", "BibTeX"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFmt(f)}
                className={`rounded px-3 py-1 font-ui text-xs ${
                  fmt === f ? "bg-muted text-foreground" : "text-muted-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {papers.length > 0 && (
            <>
              <Button
                variant="secondary"
                onClick={generateSelectedOrAll}
                className="font-ui cursor-pointer"
              >
                <Sparkles className="mr-1.5 h-4 w-4 text-[var(--primary)]" /> Generate with AI
              </Button>
              <Button
                variant="secondary"
                onClick={exportAction}
                disabled={exporting}
                className="font-ui cursor-pointer"
              >
                {exporting ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-4 w-4" />
                )}
                {selected.size > 0 ? "Export selected" : "Export all"}
              </Button>
            </>
          )}
          {selected.size > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelected(new Set())}
              className="cursor-pointer"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {papers.length === 0 ? (
        <Card className="mt-8 border-dashed border-border p-8 text-center">
          <Quote className="mx-auto h-8 w-8 text-muted-foreground opacity-40" />
          <h3 className="mt-3 font-display text-base font-semibold">No citations available</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Add or upload papers to this workspace to generate formatted APA, IEEE, and BibTeX citations.
          </p>
        </Card>
      ) : (
        <div className="mt-8 space-y-3">
          {papers.map((p) => {
            const cite = formatCitation(p, fmt);
            const isGenerated = generated.has(p.id);
            const isLoading = loadingIds.has(p.id);
            const isSelected = selected.has(p.id);
            return (
              <Card
                key={p.id}
                className={`p-5 transition-colors ${
                  isSelected ? "border-[var(--primary)]/60" : "border-border"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(p.id)} />
                    <div className="font-ui text-xs text-muted-foreground">
                      {p.venue} · {p.year}
                    </div>
                  </div>
                  {isGenerated && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copy(cite)}
                        className="h-7 font-ui text-xs"
                      >
                        <Copy className="mr-1.5 h-3 w-3" /> Copy
                      </Button>
                      <button
                        onClick={() => generateOne(p.id)}
                        className="flex items-center gap-1 font-ui text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" /> Regenerate
                      </button>
                    </div>
                  )}
                </div>
                {isLoading ? (
                  <div className="flex items-center gap-2 font-ui text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--primary)]" /> Generating
                    citation…
                  </div>
                ) : isGenerated ? (
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">
                    {cite}
                  </pre>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="font-ui cursor-pointer"
                    onClick={() => generateOne(p.id)}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[var(--primary)]" /> Generate
                    citation with AI
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
