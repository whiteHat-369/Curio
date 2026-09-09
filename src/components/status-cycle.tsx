import { useStore } from "@/lib/store";
import { type ReadingStatus } from "@/lib/mock-data";

const tone: Record<ReadingStatus, string> = {
  read: "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30",
  reading: "bg-[var(--primary)]/15 text-[var(--primary)] border-[var(--primary)]/30",
  unread: "bg-muted text-muted-foreground border-border",
};

export function StatusCycle({ paperId }: { paperId: string }) {
  const paper = useStore((s) => s.papers.find((p) => p.id === paperId));
  const cycle = useStore((s) => s.cyclePaperStatus);
  if (!paper) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        cycle(paperId);
      }}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-ui text-[10px] uppercase tracking-wider transition-colors ${tone[paper.status]}`}
      title="Click to cycle status"
    >
      {paper.status}
    </button>
  );
}
