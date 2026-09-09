import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useApiStore, type PaperWithMeta } from "@/lib/api-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Upload,
  Search,
  BookOpen,
  X,
  Tag as TagIcon,
  Trash2,
  Copy,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { TagEditor } from "@/components/tag-editor";
import { StatusCycle } from "@/components/status-cycle";
import { slugify } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/workspace/$name/papers")({
  component: PaperLibrary,
  head: () => ({ meta: [{ title: "Papers — Curio" }] }),
});

const EMPTY_UPLOADS: never[] = [];

type SortKey = "added" | "year" | "author";

function PaperLibrary() {
  const { name } = useParams({ from: "/_app/workspace/$name/papers" });
  const ws = useApiStore((s) => s.workspaces.find((w) => slugify(w.name) === name));
  const allPapers = useApiStore((s) => s.papers);
  const loadingPapers = useApiStore((s) => s.loadingPapers);
  const fetchPapers = useApiStore((s) => s.fetchPapers);
  const wsId = ws?.id ?? "";
  const uploading = useApiStore((s) => s.uploading[wsId]) ?? EMPTY_UPLOADS;
  const startUpload = useApiStore((s) => s.startUpload);
  const deletePapers = useApiStore((s) => s.deletePapers);
  const restoreTrashedPapers = useApiStore((s) => s.restoreTrashedPapers);

  const renamePaper = useApiStore((s) => s.renamePaper);
  const groupPaper = useApiStore((s) => s.groupPaper);
  const bulkAddTag = useApiStore((s) => s.bulkAddTag);

  // Fetch papers from backend on mount
  useEffect(() => {
    if (wsId) {
      fetchPapers(wsId);
    }
  }, [wsId, fetchPapers]);

  const [q, setQ] = useState("");
  const [year, setYear] = useState("all");
  const [status, setStatus] = useState("all");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<SortKey>("added");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState("");

  if (!ws) return null;

  const wsPapers = allPapers.filter((p) => ws.paperIds.includes(p.id));

  // extract filters from current list
  const years = Array.from(new Set(wsPapers.map((p) => p.year.toString()))).sort((a, b) =>
    b.localeCompare(a),
  );
  const tags = Array.from(new Set(wsPapers.flatMap((p) => p.tags))).sort();

  // filter
  const filtered = wsPapers
    .filter((p) => {
      if (q.trim()) {
        const query = q.toLowerCase();
        const titleMatch = p.title.toLowerCase().includes(query);
        const authorMatch = p.authors.some((a) => a.toLowerCase().includes(query));
        const abstractMatch = p.abstract.toLowerCase().includes(query);
        const groupMatch = p.group ? p.group.toLowerCase().includes(query) : false;
        if (!titleMatch && !authorMatch && !abstractMatch && !groupMatch) return false;
      }
      if (year !== "all" && p.year.toString() !== year) return false;
      if (status !== "all" && p.status !== status) return false;
      if (tag !== "all" && !p.tags.includes(tag)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "year") return b.year - a.year;
      if (sort === "author") {
        const a1 = a.authors[0] ?? "";
        const b1 = b.authors[0] ?? "";
        return a1.localeCompare(b1);
      }
      return b.addedAt - a.addedAt;
    });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f && f.type === "application/pdf") {
        startUpload(ws.id, f.name);
        toast.success(`Upload started: ${f.name}`);
      }
    }
  };

  const toggleSelect = (pid: string) => {
    const next = new Set(selected);
    if (next.has(pid)) next.delete(pid);
    else next.add(pid);
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    deletePapers(ws.id, ids);
    setSelected(new Set());
    toast(`Deleted ${ids.length} papers`, {
      action: {
        label: "Undo",
        onClick: () => {
          restoreTrashedPapers(ids);
          toast.success("Restored papers");
        },
      },
    });
  };

  const handleBulkExport = () => {
    if (selected.size === 0) return;
    toast.success(`Exported ${selected.size} citations (BibTeX)`);
    setSelected(new Set());
  };

  const handleBulkTag = () => {
    const t = bulkTagValue.trim().toLowerCase();
    if (!t || selected.size === 0) return;
    bulkAddTag(Array.from(selected), t);
    toast.success(`Tagged ${selected.size} papers with "${t}"`);
    setSelected(new Set());
    setBulkTagOpen(false);
    setBulkTagValue("");
  };

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--primary)]" />
            <h1 className="font-display text-2xl font-semibold">Papers</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {wsPapers.length} papers in this workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <label>
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            <Button className="font-ui" asChild>
              <span className="cursor-pointer">
                <Upload className="mr-1.5 h-4 w-4" /> Upload PDF
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search papers"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 pl-9 font-ui text-sm"
          />
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="h-9 w-auto rounded-md border-border bg-card font-ui text-sm text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-auto rounded-md border-border bg-card font-ui text-sm text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="reading">Reading</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger className="h-9 w-auto rounded-md border-border bg-card font-ui text-sm text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-9 w-auto rounded-md border-border bg-card font-ui text-sm text-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="added">Sort: date added</SelectItem>
            <SelectItem value="year">Sort: year</SelectItem>
            <SelectItem value="author">Sort: author</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Uploading */}
      {uploading.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploading.map((u) => (
            <Card key={u.id} className="border-border p-4">
              <div className="flex items-center justify-between font-ui text-xs">
                <span className="truncate text-foreground">{u.title}</span>
                <span className="tabular-nums text-muted-foreground">
                  {Math.round(u.progress)}%
                </span>
              </div>
              <Progress value={u.progress} className="mt-2 h-1" />
            </Card>
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-16 z-20 mt-4 flex items-center gap-3 rounded-lg border border-[var(--primary)]/40 bg-[var(--primary)]/5 px-4 py-2.5">
          <span className="font-ui text-sm text-foreground">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setBulkTagOpen(true)}
              className="font-ui"
            >
              <TagIcon className="mr-1.5 h-3.5 w-3.5" /> Tag
            </Button>
            <Button size="sm" variant="secondary" onClick={handleBulkExport} className="font-ui">
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="font-ui">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection} className="font-ui">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Papers */}
      {filtered.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border py-12 text-center font-ui text-sm text-muted-foreground">
          No papers match your filters.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PaperCard
              key={p.id}
              paper={p}
              wsId={ws.id}
              wsNameSlug={slugify(ws.name)}
              selected={selected.has(p.id)}
              onToggle={() => toggleSelect(p.id)}
              renamePaper={renamePaper}
              groupPaper={groupPaper}
              deletePapers={deletePapers}
            />
          ))}
        </div>
      )}

      <Dialog open={bulkTagOpen} onOpenChange={setBulkTagOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Add tag to {selected.size} papers</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={bulkTagValue}
            onChange={(e) => setBulkTagValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleBulkTag()}
            placeholder="e.g. survey"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkTagOpen(false)} className="font-ui">
              Cancel
            </Button>
            <Button onClick={handleBulkTag} className="font-ui">
              Add tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaperCard({
  paper,
  wsId,
  wsNameSlug,
  selected,
  onToggle,
  renamePaper,
  groupPaper,
  deletePapers,
}: {
  paper: PaperWithMeta;
  wsId: string;
  wsNameSlug: string;
  selected: boolean;
  onToggle: () => void;
  renamePaper: (id: string, name: string) => void;
  groupPaper: (id: string, group: string) => void;
  deletePapers: (wsId: string, ids: string[]) => void;
}) {
  return (
    <Card
      className={`group relative h-full border p-5 transition-colors ${
        selected ? "border-[var(--primary)]/60" : "border-border hover:border-[var(--primary)]/40"
      }`}
    >
      <div
        className="absolute right-3 top-3 flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link to={`/workspace/${wsNameSlug}/paper/${paper.id}`}>Open</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                const newTitle = window.prompt("Rename paper:", paper.title);
                if (newTitle !== null) renamePaper(paper.id, newTitle);
              }}
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                const newGroup = window.prompt(
                  "Group paper (enter group name):",
                  paper.group || "",
                );
                if (newGroup !== null) groupPaper(paper.id, newGroup);
              }}
            >
              Group
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => {
                if (window.confirm("Are you sure you want to delete this paper?")) {
                  deletePapers(wsId, [paper.id]);
                }
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Checkbox checked={selected} onCheckedChange={onToggle} />
      </div>

      <Link to={`/workspace/${wsNameSlug}/paper/${paper.id}`} className="block">
        <h3 className="pr-14 font-display text-base font-semibold text-foreground group-hover:text-[var(--primary)]">
          {paper.title}
        </h3>
        <div className="mt-2 font-ui text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
          <span>
            {paper.authors.join(", ")} · {paper.venue} · {paper.year}
          </span>
          {paper.group && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary border border-primary/20">
              {paper.group}
            </span>
          )}
        </div>
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <StatusCycle paperId={paper.id} />
      </div>
      <div className="mt-2">
        <TagEditor paperId={paper.id} maxVisible={2} />
      </div>
    </Card>
  );
}
