import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { useApiStore } from "@/lib/api-store";
import { WorkspaceSkeleton, useSimulatedLoad } from "@/components/skeletons";
import { slugify } from "@/lib/utils";

export const Route = createFileRoute("/_app/workspace/$name")({
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const { name } = useParams({ from: "/_app/workspace/$name" });
  const ws = useApiStore((s) => s.workspaces.find((w) => slugify(w.name) === name));
  const loading = useSimulatedLoad([name]);
  if (loading) return <WorkspaceSkeleton />;
  if (!ws) return null;
  return <Outlet />;
}
