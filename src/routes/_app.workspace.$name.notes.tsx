import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useApiStore, useApiStoreApi, type Note } from "@/lib/api-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NotebookPen,
  Plus,
  Search,
  Copy,
  Trash2,
  FolderKanban,
  FolderPlus,
  MoreVertical,
  PanelLeft,
  PanelLeftClose,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";

export const Route = createFileRoute("/_app/workspace/$name/notes")({
  component: NotesPage,
  head: () => ({ meta: [{ title: "Notes — Curio" }] }),
});

const EMPTY_NOTES: Note[] = [];

const starters = ["Summary of methodology", "Key results", "Open questions", "Comparison notes"];

function NotesPage() {
  const { name } = useParams({ from: "/_app/workspace/$name/notes" });
  const ws = useApiStore((s) => s.workspaces.find((w) => slugify(w.name) === name));
  const wsId = ws?.id ?? "";
  const notes = useApiStore((s) => s.notes[wsId]) ?? EMPTY_NOTES;
  const papers = useApiStore((s) => s.papers);
  const createNote = useApiStore((s) => s.createNote);
  const updateNote = useApiStore((s) => s.updateNote);
  const deleteNote = useApiStore((s) => s.deleteNote);
  const restoreNote = useApiStore((s) => s.restoreNote);
  const groupNotes = useApiStore((s) => s.groupNotes);
  const addNoteTag = useApiStore((s) => s.addNoteTag);
  const removeNoteTag = useApiStore((s) => s.removeNoteTag);
  const store = useApiStoreApi();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(q.toLowerCase()) ||
      n.body.toLowerCase().includes(q.toLowerCase()),
  );

  const groupedNotes = useMemo(() => {
    const map: Record<string, typeof notes> = {};
    filtered.forEach((n) => {
      const g = n.group || "General";
      if (!map[g]) map[g] = [];
      map[g].push(n);
    });
    return map;
  }, [filtered]);

  if (!ws) return null;

  const active = notes.find((n) => n.id === activeId) ?? null;

  const handleCreate = (title?: string) => {
    const nid = createNote(wsId);
    const created = store.getState().notes[wsId]?.find((n) => n.id === nid);
    if (title && created) updateNote(wsId, { ...created, title });
    setActiveId(nid);
    toast.success("Note created");
  };

  const handleDelete = (noteId: string) => {
    deleteNote(wsId, noteId);
    if (activeId === noteId) setActiveId(null);
    toast("Note deleted", {
      action: {
        label: "Undo",
        onClick: () => {
          restoreNote(wsId, noteId);
          setActiveId(noteId);
          toast.success("Restored");
        },
      },
    });
  };

  const handleCopy = () => {
    if (!active) return;
    navigator.clipboard.writeText(`# ${active.title}\n\n${active.body}`);
    toast.success("Note copied");
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full">
      {/* Notes history panel */}
      {historyOpen && (
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card/40 md:flex md:flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <button
                onClick={() => setHistoryOpen(false)}
                className="hover:text-foreground cursor-pointer"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
              <span className="font-ui text-xs font-semibold uppercase tracking-wider">Notes</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <button
                onClick={() => handleCreate()}
                className="hover:text-foreground cursor-pointer"
                title="New note"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  const gName = window.prompt("New group name:");
                  if (gName !== null && gName.trim()) {
                    const nid = createNote(wsId);
                    groupNotes(wsId, [nid], gName);
                    setActiveId(nid);
                    toast.success(`Group "${gName.trim()}" created`);
                  }
                }}
                className="hover:text-foreground cursor-pointer"
                title="New group"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="px-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search notes"
                className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 font-ui text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-3 flex-1 space-y-3 overflow-y-auto px-2 pb-3">
            {Object.entries(groupedNotes).map(([groupName, groupList]) => (
              <div key={groupName} className="space-y-0.5">
                <div className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <FolderKanban className="h-2.5 w-2.5 text-muted-foreground/65" />
                  <span>{groupName}</span>
                </div>
                {groupList.map((n) => (
                  <div
                    key={n.id}
                    className={`group flex items-center justify-between rounded-md px-3 py-1 font-ui text-sm transition-colors ${
                      active?.id === n.id
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/40"
                    }`}
                  >
                    <button
                      onClick={() => setActiveId(n.id)}
                      className="flex-1 truncate text-left py-1 cursor-pointer"
                    >
                      <div className="truncate font-medium">{n.title}</div>
                      <div className="text-[10px] text-muted-foreground/80">{n.updatedAt}</div>
                    </button>
                    <div className="opacity-0 group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 hover:text-foreground cursor-pointer"
                            aria-label="Note options"
                          >
                            <MoreVertical className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem
                            className="cursor-pointer text-xs"
                            onClick={() => {
                              const newTitle = window.prompt("Rename note:", n.title);
                              if (newTitle !== null && newTitle.trim()) {
                                updateNote(wsId, { ...n, title: newTitle.trim() });
                              }
                            }}
                          >
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer text-xs"
                            onClick={() => {
                              const gName = window.prompt(
                                "Group note (enter group name):",
                                n.group || "",
                              );
                              if (gName !== null) {
                                groupNotes(wsId, [n.id], gName);
                                toast.success("Note grouped");
                              }
                            }}
                          >
                            Group
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive cursor-pointer text-xs"
                            onClick={() => {
                              if (window.confirm("Are you sure you want to delete this note?")) {
                                handleDelete(n.id);
                              }
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center font-ui text-xs text-muted-foreground">
                No notes match.
              </p>
            )}
          </div>
        </aside>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <div className="border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!historyOpen && (
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>
              )}
              <NotebookPen className="h-4 w-4 text-[var(--primary)]" />
              <h1 className="font-display text-xl font-semibold">Notes</h1>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {notes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center space-y-6">
              <EmptyState
                icon={NotebookPen}
                title="Capture your first note"
                description="Notes tie back to papers automatically, and show up wherever that paper appears."
              />
              <div className="flex flex-col items-center max-w-xl">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3 font-ui">
                  Start from a template
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {starters.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleCreate(s)}
                      className="rounded-full border border-border bg-card px-3.5 py-1.5 font-ui text-xs text-foreground transition-all hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 cursor-pointer shadow-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : active ? (
            <div className="mx-auto max-w-3xl">
              <Card className="border-border p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {active.paperIds.map((pid: string) => {
                      const p = papers.find((x) => x.id === pid);
                      return p ? (
                        <Badge key={pid} variant="outline" className="font-ui text-[10px]">
                          {p.authors[0]}, {p.year}
                        </Badge>
                      ) : null;
                    })}
                    {active.group && (
                      <Badge className="border-primary/20 bg-primary/10 font-ui text-[10px] text-primary">
                        {active.group}
                      </Badge>
                    )}
                    {(active.tags ?? []).map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="flex items-center gap-1 font-ui text-[10px]"
                      >
                        {t}
                        <button
                          onClick={() => removeNoteTag(wsId, active.id, t)}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 cursor-pointer">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem className="cursor-pointer" onClick={handleCopy}>
                        <Copy className="mr-2 h-3.5 w-3.5" /> Copy
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => {
                          const t = window.prompt("Create tag (enter tag name):");
                          if (t !== null && t.trim()) {
                            addNoteTag(wsId, active.id, t);
                            toast.success(`Tag "${t.trim().toLowerCase()}" added`);
                          }
                        }}
                      >
                        <Tag className="mr-2 h-3.5 w-3.5" /> Create tag
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => {
                          const gName = window.prompt(
                            "Group note (enter group name):",
                            active.group || "",
                          );
                          if (gName !== null) {
                            groupNotes(wsId, [active.id], gName);
                            toast.success("Note grouped");
                          }
                        }}
                      >
                        <FolderKanban className="mr-2 h-3.5 w-3.5" /> Group
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive cursor-pointer"
                        onClick={() => {
                          if (window.confirm("Are you sure you want to delete this note?")) {
                            handleDelete(active.id);
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Input
                  value={active.title}
                  onChange={(e) => updateNote(wsId, { ...active, title: e.target.value })}
                  onBlur={() => toast.success("Note saved")}
                  className="mt-4 border-0 bg-transparent px-0 font-display text-2xl font-semibold shadow-none focus-visible:ring-0"
                />
                <Textarea
                  value={active.body}
                  onChange={(e) => updateNote(wsId, { ...active, body: e.target.value })}
                  onBlur={() => toast.success("Note saved")}
                  placeholder="Write in markdown…"
                  className="mt-4 min-h-[420px] resize-none border-0 bg-transparent px-0 font-sans text-[15px] leading-relaxed shadow-none focus-visible:ring-0"
                />
              </Card>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center space-y-6">
              <EmptyState
                icon={NotebookPen}
                title="Pick a note to view"
                description="Select a note from the list on the left, or create a new one to start writing."
              />
              <Button className="font-ui cursor-pointer" onClick={() => handleCreate()}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New note
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
