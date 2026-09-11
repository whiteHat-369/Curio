import { useEffect, useState } from "react";
import { useApiStore } from "@/lib/api-store";
import { papersApi } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface Summary {
  intro: string;
  methodology: string;
  result: string;
  limitations: string;
}

export function AiSummary({ paperId, className = "" }: { paperId: string; className?: string }) {
  const paper = useApiStore((s) => s.papers.find((p) => p.id === paperId));
  const cached = useApiStore((s) => s.summaries[paperId]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  const wsId = paper?.workspaceId ?? "";

  // Hydrate: store cache first, then backend-saved summary.
  useEffect(() => {
    if (cached) {
      setSummary(cached);
      return;
    }
    if (!wsId) return;
    let cancel = false;
    papersApi
      .getSummary(wsId, paperId)
      .then((res) => {
        if (!cancel && res) setSummary(res);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [paperId, wsId, cached]);

  const generate = async () => {
    if (!wsId) {
      toast.error("Paper not synced yet — reopen from Papers");
      return;
    }
    setLoading(true);
    try {
      const res = await papersApi.generateSummary(wsId, paperId);
      if (res) {
        const s: Summary = {
          intro: res.intro,
          methodology: res.methodology,
          result: res.result,
          limitations: res.limitations,
        };
        setSummary(s);
        toast.success("AI summary generated");
      } else {
        throw new Error("empty");
      }
    } catch {
      // Fallback: build a readable summary from the paper's own full content
      // so the panel always shows complete information.
      if (paper) {
        setSummary({
          intro: paper.abstract || `Overview of "${paper.title}".`,
          methodology: paper.methodology || "Methodology not extracted yet.",
          result: paper.results || "Results not extracted yet.",
          limitations: paper.limitations || "Limitations not extracted yet.",
        });
        toast.error("AI service unavailable — showing extracted content");
      } else {
        toast.error("Failed to generate summary");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!summary && !loading) {
    return (
      <Button
        size="sm"
        variant="secondary"
        className={`font-ui cursor-pointer ${className}`}
        onClick={generate}
      >
        <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[var(--primary)]" /> Generate AI summary
      </Button>
    );
  }

  if (loading && !summary) {
    return (
      <div className={`flex items-center gap-2 font-ui text-xs text-muted-foreground ${className}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--primary)]" /> Generating summary…
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--primary)]">
          <Sparkles className="h-3 w-3" /> AI summary
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1 font-ui text-[11px] text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} Regenerate
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {[
          ["Intro", summary?.intro],
          ["Proposed methodology", summary?.methodology],
          ["Result", summary?.result],
          ["Limitations", summary?.limitations],
        ].map(([label, text]) => (
          <div key={label}>
            <div className="font-ui text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
