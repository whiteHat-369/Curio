import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Home,
  FolderKanban,
  LayoutDashboard,
  BookOpen,
  Network,
  MessageSquareText,
  Quote,
  NotebookPen,
  Settings,
  LogOut,
  ChevronUp,
  ChevronDown,
  Search,
  Plus,
  MoreVertical,
  Database,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { CurioLogo, CurioMark } from "./curio-logo";
import { useStore } from "@/lib/store";
import { useApiStore } from "@/lib/api-store";
import { slugify } from "@/lib/utils";

const topItems = [{ title: "Dashboard", url: "/dashboard", icon: Home }];

function useCurrentWorkspaceId(): string | null {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const workspaces = useStore((s) => s.workspaces);
  const m = pathname.match(/^\/workspace\/([^/]+)/);
  if (!m) return null;
  const nameSlug = m[1];
  const ws = workspaces.find((w) => slugify(w.name) === nameSlug);
  return ws ? ws.id : null;
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const wsId = useCurrentWorkspaceId();
  const workspaces = useStore((s) => s.workspaces);
  const ws = workspaces.find((w) => w.id === wsId);
  const isActive = (p: string) => pathname === p || pathname.startsWith(p + "/");
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const setSearchOpen = useStore((s) => s.setSearchOpen);
  const [workspacesOpen, setWorkspacesOpen] = useState(true);
  const createWorkspace = useStore((s) => s.createWorkspace);
  const renameWorkspace = useStore((s) => s.renameWorkspace);
  const deleteWorkspace = useStore((s) => s.deleteWorkspace);
  const navigate = useNavigate();

  const quickCreateWorkspace = async () => {
    const existing = new Set(workspaces.map((w) => w.name));
    let name = "Untitled workspace";
    let n = 2;
    while (existing.has(name)) name = `Untitled workspace ${n++}`;
    try {
      const id = await createWorkspace(name, "—");
      const created = useStore.getState().workspaces.find((w) => w.id === id);
      toast.success("Workspace created");
      if (created) navigate({ to: `/workspace/${slugify(created.name)}` });
    } catch (err) {
      toast.error("Failed to create workspace");
    }
  };

  const overviewItem = ws
    ? {
        title: "Overview",
        url: `/workspace/${slugify(ws.name)}`,
        icon: LayoutDashboard,
        exact: true,
      }
    : null;

  const wsGroups = ws
    ? [
        {
          label: "Data Collection",
          items: [
            {
              title: "Papers",
              url: `/workspace/${slugify(ws.name)}/papers`,
              icon: BookOpen,
            },
            {
              title: "Datasets",
              url: `/workspace/${slugify(ws.name)}/datasets`,
              icon: Database,
            },
          ],
        },
        {
          label: "Research",
          items: [
            {
              title: "Evidence Map",
              url: `/workspace/${slugify(ws.name)}/evidence`,
              icon: Network,
            },
            { title: "Citations", url: `/workspace/${slugify(ws.name)}/citations`, icon: Quote },
          ],
        },
        {
          label: "Workspace",
          items: [
            {
              title: "AI Chat",
              url: `/workspace/${slugify(ws.name)}/chat`,
              icon: MessageSquareText,
            },
            { title: "Notes", url: `/workspace/${slugify(ws.name)}/notes`, icon: NotebookPen },
          ],
        },
      ]
    : [];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader
        className={`flex-none border-b border-sidebar-border px-3 ${
          isCollapsed
            ? "flex flex-col items-center gap-1.5 py-2.5"
            : "flex h-14 flex-row items-center justify-between"
        }`}
      >
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleSidebar}
                className="flex items-center justify-center text-foreground cursor-pointer"
                aria-label="Expand sidebar"
              >
                <CurioMark size={22} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        ) : (
          <>
            <CurioLogo withText />
            <SidebarTrigger className="h-7 w-7 shrink-0 text-muted-foreground" />
          </>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarSearchButton isCollapsed={isCollapsed} setSearchOpen={setSearchOpen} />
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarSeparator className="-mx-2 my-2 w-[calc(100%+1rem)]" />
            <SidebarMenu>
              {topItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link to={item.url} className="font-ui">
                        <item.icon
                          className={`h-3.5 w-3.5 ${active ? "text-[var(--primary)]" : ""}`}
                        />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Workspaces Collapsible Switcher */}
              <SidebarMenuItem>
                <div className="flex items-center justify-between w-full">
                  <SidebarMenuButton asChild isActive={isActive("/workspaces")}>
                    <Link to="/workspaces" className="font-ui flex-1">
                      <FolderKanban
                        className={`h-3.5 w-3.5 ${isActive("/workspaces") ? "text-[var(--primary)]" : ""}`}
                      />
                      <span>Workspaces</span>
                    </Link>
                  </SidebarMenuButton>
                  {!isCollapsed && (
                    <div className="mr-2 flex items-center gap-1 text-muted-foreground">
                      <button
                        onClick={quickCreateWorkspace}
                        className="hover:text-foreground cursor-pointer"
                        title="Create workspace instantly"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setWorkspacesOpen(!workspacesOpen)}
                        className="hover:text-foreground cursor-pointer"
                      >
                        {workspacesOpen ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronUp className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {workspacesOpen && !isCollapsed && (
                  <div className="ml-6 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                    {workspaces.slice(0, 5).map((w) => {
                      const url = `/workspace/${slugify(w.name)}`;
                      const active = pathname === url || pathname.startsWith(url + "/");
                      return (
                        <div key={w.id} className="group flex items-center justify-between gap-1">
                          <Link
                            to={url}
                            className={`block flex-1 truncate py-1 font-ui text-[11px] transition-colors ${
                              active
                                ? "font-semibold text-[var(--primary)]"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {w.name}
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground cursor-pointer">
                                <MoreVertical className="h-3 w-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-32">
                              <DropdownMenuItem
                                className="cursor-pointer text-xs"
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
                                className="text-destructive focus:text-destructive cursor-pointer text-xs"
                                onClick={() => {
                                  if (window.confirm(`Delete workspace "${w.name}"?`)) {
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
                      );
                    })}
                  </div>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {ws && overviewItem && (
          <SidebarGroup>
            <SidebarGroupLabel className="font-ui text-[10px] uppercase tracking-wider">
              Current Workspace
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === overviewItem.url}>
                    <Link to={overviewItem.url} className="font-ui">
                      <overviewItem.icon
                        className={`h-3.5 w-3.5 ${pathname === overviewItem.url ? "text-[var(--primary)]" : ""}`}
                      />
                      <span>{overviewItem.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {ws &&
          wsGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="font-ui text-[10px] uppercase tracking-wider">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = isActive(item.url);
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={active}>
                          <Link to={item.url} className="font-ui">
                            <item.icon
                              className={`h-3.5 w-3.5 ${active ? "text-[var(--primary)]" : ""}`}
                            />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarSearchButton({
  isCollapsed,
  setSearchOpen,
}: {
  isCollapsed: boolean;
  setSearchOpen: (open: boolean) => void;
}) {
  if (isCollapsed) {
    return (
      <button
        onClick={() => setSearchOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-sidebar-border bg-sidebar hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer text-muted-foreground transition-colors"
        title="Search (⌘K)"
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }
  return (
    <button
      onClick={() => setSearchOpen(true)}
      className="flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar px-2 text-left font-ui text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer"
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 text-left">Search</span>
      <kbd className="shrink-0 rounded border border-sidebar-border bg-sidebar-accent px-1.5 py-0.5 font-ui text-[10px] text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}

function UserMenu() {
  const [open, setOpen] = useState(false);
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const userName = useApiStore((s) => s.userName);
  const userEmail = useApiStore((s) => s.userEmail);
  const initial = (userName ?? "A")[0].toUpperCase();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-ui text-sm text-foreground transition-colors hover:bg-sidebar-accent ${isCollapsed ? "justify-center" : ""}`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {initial}
          </span>
          {!isCollapsed && (
            <>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium">{userName ?? "User"}</span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {userEmail ?? "user@example.com"}
                </span>
              </span>
              {open ? (
                <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronUp className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align={isCollapsed ? "center" : "start"}
        sideOffset={12}
        className="w-[var(--radix-popover-trigger-width)] min-w-[120px] p-1"
      >
        <Link
          to="/settings"
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 font-ui text-sm text-foreground transition-colors hover:bg-accent cursor-pointer"
        >
          <Settings className="h-4 w-4" /> Settings
        </Link>
        <Link
          to="/"
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 font-ui text-sm text-foreground transition-colors hover:bg-accent cursor-pointer"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Link>
      </PopoverContent>
    </Popover>
  );
}
