import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { useApiStore, useApiStoreApi } from "@/lib/api-store";

const SB_KEY = "curio.sidebar.open";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [openState, setOpenState] = useState<boolean>(true);
  const fetchMe = useApiStore((s) => s.fetchMe);
  const fetchWorkspaces = useApiStore((s) => s.fetchWorkspaces);
  const reduceMotion = useApiStore((s) => s.reduceMotion);
  const store = useApiStoreApi();
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(SB_KEY);
      if (v !== null) setOpenState(v === "1");
    } catch {}
    // Fetch real user data and workspaces from backend
    void fetchMe().then(() => {
      if (store.getState().isAuthenticated) {
        fetchWorkspaces();
        setReady(true);
      } else {
        navigate({ to: "/login" });
      }
    });
  }, [fetchMe, fetchWorkspaces, store, navigate]);
  useEffect(() => {
    try {
      document.documentElement.classList.toggle("reduce-motion", reduceMotion);
    } catch {}
  }, [reduceMotion]);
  const handleOpenChange = (o: boolean) => {
    setOpenState(o);
    try {
      sessionStorage.setItem(SB_KEY, o ? "1" : "0");
    } catch {}
  };
  if (!ready) return null;
  return (
    <SidebarProvider open={openState} onOpenChange={handleOpenChange}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <main className="flex-1">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
