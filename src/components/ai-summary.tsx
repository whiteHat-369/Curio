import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RotateCcw } from "lucide-react";

export function AiSummary({ paperId, className = "" }: { paperId: string; className?: string }) {
  const summary = useStore((s) => s.summaries[paperId]);
  const generateSummary = useStore((s) => s.generateSummary);
  const [loading, setLoading] = useState(false);

  const generate = () => {
    setLoading(true);
    setTimeout(() => {
      generateSummary(paperId);
      setLoading(false);
    }, 900);
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

  if (loading) {
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
          className="flex items-center gap-1 font-ui text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <RotateCcw className="h-3 w-3" /> Regenerate
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {[
          ["Intro", summary.intro],
          ["Proposed methodology", summary.methodology],
          ["Result", summary.result],
          ["Limitations", summary.limitations],
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
