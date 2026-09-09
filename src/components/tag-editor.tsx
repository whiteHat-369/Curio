import { useState, type KeyboardEvent } from "react";
import { X, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { toast } from "sonner";

export function TagEditor({
  paperId,
  size = "sm",
  maxVisible,
}: {
  paperId: string;
  size?: "sm" | "md";
  maxVisible?: number;
}) {
  const paper = useStore((s) => s.papers.find((p) => p.id === paperId));
  const addTag = useStore((s) => s.addTag);
  const removeTag = useStore((s) => s.removeTag);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  if (!paper) return null;

  const capped = maxVisible !== undefined && !expanded && paper.tags.length > maxVisible;
  const visibleTags = capped ? paper.tags.slice(0, maxVisible) : paper.tags;
  const hiddenCount = paper.tags.length - visibleTags.length;

  const submit = () => {
    const v = value.trim().toLowerCase();
    if (!v) return;
    if (paper.tags.includes(v)) {
      toast("Tag already added");
    } else {
      addTag(paperId, v);
      toast.success(`Tag "${v}" added`);
    }
    setValue("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      setOpen(false);
      setValue("");
    }
  };

  const chipCls =
    size === "md" ? "font-ui text-xs px-2 py-0.5" : "font-ui text-[10px] px-1.5 py-0.5";

  return (
    <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {visibleTags.map((t) => (
        <span
          key={t}
          className={`inline-flex items-center gap-1 rounded-full border border-border bg-background text-foreground ${chipCls}`}
        >
          {t}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              removeTag(paperId, t);
              toast(`Tag "${t}" removed`);
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Remove tag ${t}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setExpanded(true);
          }}
          className={`inline-flex items-center rounded-full border border-border bg-muted text-muted-foreground hover:text-foreground ${chipCls}`}
        >
          +{hiddenCount} more
        </button>
      )}
      {open ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => {
            submit();
            setOpen(false);
          }}
          placeholder="tag…"
          className={`w-20 rounded-full border border-dashed border-border bg-transparent text-foreground outline-none focus:border-[var(--primary)] ${chipCls}`}
        />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          className={`inline-flex items-center gap-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:text-foreground ${chipCls}`}
        >
          <Plus className="h-2.5 w-2.5" /> tag
        </button>
      )}
    </div>
  );
}
