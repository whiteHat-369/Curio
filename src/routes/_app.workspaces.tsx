import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useApiStore } from "@/lib/api-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderPlus, Clock, MoreVertical } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { NewWorkspaceDialog } from "@/components/new-workspace-dialog";
import { slugify } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/workspaces")({
  component: WorkspacesPage,
  head: () => ({ meta: [{ title: "Workspaces — Curio" }] }),
});

function WorkspacesPage() {
  const workspaces = useApiStore((s) => s.workspaces);
  const renameWorkspace = useApiStore((s) => s.renameWorkspace);
  const deleteWorkspace = useApiStore((s) => s.deleteWorkspace);
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="mt-4 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">All workspaces</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each workspace is one research question and its paper corpus.
          </p>
        </div>
        <Button className="font-ui" onClick={() => setOpen(true)}>
          <FolderPlus className="mr-1.5 h-4 w-4" /> New workspace
        </Button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workspaces.map((w) => (
          <Card
            key={w.id}
            className="group relative h-full border-border p-5 transition-colors hover:border-[var(--primary)]/40"
          >
            <div className="absolute right-3 top-3 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => {
                      const newName = window
                        .prompt("Rename workspace:", w.name)
                        ?.trim()
                        .slice(0, 50);
                      if (newName) renameWorkspace(w.id, newName);
                    }}
                  >
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive cursor-pointer"
                    onClick={() => {
                      if (window.confirm(`Delete workspace "${w.name}"? This cannot be undone.`)) {
                        deleteWorkspace(w.id);
                        toast.success("Workspace deleted");
                      }
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Link to={`/workspace/${slugify(w.name)}`}>
              <div className="flex items-center gap-2 font-ui text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Updated {w.updatedAt}
              </div>
              <h3 className="mt-2 max-w-[85%] font-display text-base font-semibold text-foreground group-hover:text-[var(--primary)]">
                {w.name}
              </h3>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{w.question}</p>
              <div className="mt-5 space-y-1.5">
                <div className="flex items-center justify-between font-ui text-[11px] text-muted-foreground">
                  <span>{w.paperIds.length} papers</span>
                  <span>{Math.round(w.progress * 100)}% read</span>
                </div>
                <Progress value={w.progress * 100} className="h-1" />
              </div>
            </Link>
          </Card>
        ))}
      </div>

      <NewWorkspaceDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
