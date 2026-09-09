import { Bookmark } from "lucide-react";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export function PinButton({ paperId }: { paperId: string }) {
  const pinned = useStore((s) => s.pinned.includes(paperId));
  const toggle = useStore((s) => s.togglePin);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(paperId);
        toast(pinned ? "Removed from pinned" : "Pinned to dashboard");
      }}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-accent ${
        pinned ? "text-[var(--primary)]" : "text-muted-foreground"
      }`}
      aria-label={pinned ? "Unpin" : "Pin"}
      title={pinned ? "Unpin" : "Pin to dashboard"}
    >
      <Bookmark className={`h-3.5 w-3.5 ${pinned ? "fill-current" : ""}`} />
    </button>
  );
}
