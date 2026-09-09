import { useEffect, useMemo, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { FolderPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { NewWorkspaceDialog } from "@/components/new-workspace-dialog";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { slugify } from "@/lib/utils";

const SECTION_LABELS: Record<string, string> = {
  papers: "Papers",
  datasets: "Datasets",
  evidence: "Evidence Map",
  chat: "AI Chat",
  citations: "Citations",
  notes: "Notes",
};

export function AppTopbar() {
  const open = useStore((s) => s.searchOpen);
  const setOpen = useStore((s) => s.setSearchOpen);
  const [q, setQ] = useState("");
  const [newWs, setNewWs] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const wsMatch = pathname.match(/^\/workspace\/([^/]+)(?:\/(.*))?$/);
  const wsSlug = wsMatch?.[1];
  const wsRest = wsMatch?.[2];
  const workspaces = useStore((s) => s.workspaces);
  const papers = useStore((s) => s.papers);
  const currentWs = wsSlug ? workspaces.find((w) => slugify(w.name) === wsSlug) : null;

  const crumbs = useMemo(() => {
    if (pathname === "/dashboard") return [{ label: "Dashboard" }];
    if (pathname === "/settings") return [{ label: "Settings" }];
    if (pathname === "/workspaces") return [{ label: "Workspaces" }];
    if (currentWs) {
      const items: { label: string; to?: string }[] = [
        { label: "Workspaces", to: "/workspaces" },
        { label: currentWs.name, to: `/workspace/${wsSlug}` },
      ];
      if (wsRest && wsRest in SECTION_LABELS) {
        items.push({ label: SECTION_LABELS[wsRest] });
      } else if (wsRest?.startsWith("paper/")) {
        const paperId = wsRest.split("/")[1];
        const paper = papers.find((p) => p.id === paperId);
        items.push({ label: "Papers", to: `/workspace/${wsSlug}/papers` });
        if (paper) items.push({ label: paper.title });
      }
      // last crumb is the current page — never a link
      if (items.length > 0) delete items[items.length - 1].to;
      return items;
    }
    return [];
  }, [pathname, currentWs, wsSlug, wsRest, papers]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const needle = q.trim().toLowerCase();
  const matchedWs = useMemo(
    () =>
      needle
        ? workspaces.filter(
            (w) =>
              w.name.toLowerCase().includes(needle) || w.question.toLowerCase().includes(needle),
          )
        : workspaces.slice(0, 5),
    [needle, workspaces],
  );
  const matchedPapers = useMemo(
    () =>
      needle
        ? papers
            .filter(
              (p) =>
                p.title.toLowerCase().includes(needle) ||
                p.authors.join(" ").toLowerCase().includes(needle),
            )
            .slice(0, 8)
        : papers.slice(0, 6),
    [needle, papers],
  );

  const jumpToPaper = (paperId: string) => {
    const ws = workspaces.find((w) => w.paperIds.includes(paperId));
    if (ws) navigate({ to: `/workspace/${slugify(ws.name)}/paper/${paperId}` });
    setOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
        {crumbs.length > 0 && <Breadcrumbs items={crumbs} />}
      </header>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search workspaces, papers, or actions…"
          value={q}
          onValueChange={setQ}
        />
        <CommandList>
          <CommandEmpty>No matches for "{q}".</CommandEmpty>
          {matchedWs.length > 0 && (
            <CommandGroup heading={needle ? "Workspaces" : "Recent workspaces"}>
              {matchedWs.map((w) => (
                <CommandItem
                  key={w.id}
                  value={"ws-" + w.id + "-" + w.name}
                  onSelect={() => {
                    navigate({ to: `/workspace/${slugify(w.name)}` });
                    setOpen(false);
                  }}
                >
                  <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                  {w.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {matchedPapers.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Papers">
                {matchedPapers.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={"p-" + p.id + "-" + p.title + "-" + p.authors.join(" ")}
                    onSelect={() => jumpToPaper(p.id)}
                  >
                    <div className="flex flex-col">
                      <span className="truncate">{p.title}</span>
                      <span className="font-ui text-[11px] text-muted-foreground">
                        {p.authors.join(", ")} · {p.year}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem
              value="new-workspace"
              onSelect={() => {
                setOpen(false);
                setNewWs(true);
              }}
            >
              <FolderPlus className="mr-2 h-4 w-4" /> New workspace
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <NewWorkspaceDialog open={newWs} onOpenChange={setNewWs} />
    </>
  );
}
