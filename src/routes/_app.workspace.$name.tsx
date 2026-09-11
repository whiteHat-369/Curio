import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useApiStore } from "@/lib/api-store";
import { WorkspaceSkeleton, useSimulatedLoad } from "@/components/skeletons";
import { slugify } from "@/lib/utils";

export const Route = createFileRoute("/_app/workspace/$name")({
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const { name } = useParams({ from: "/_app/workspace/$name" });
  const ws = useApiStore((s) => s.workspaces.find((w) => slugify(w.name) === name));
  const fetchPapers = useApiStore((s) => s.fetchPapers);
  const fetchEvidence = useApiStore((s) => s.fetchEvidence);
  const fetchNotes = useApiStore((s) => s.fetchNotes);
  const fetchDatasets = useApiStore((s) => s.fetchDatasets);
  const loading = useSimulatedLoad([name]);

  // Hydrate all workspace data in one place so Overview health, Evidence
  // Map, Notes and Datasets never render empty when entered directly.
  useEffect(() => {
    if (!ws?.id) return;
    fetchPapers(ws.id);
    fetchEvidence(ws.id);
    fetchNotes(ws.id);
    fetchDatasets(ws.id);
  }, [ws?.id, fetchPapers, fetchEvidence, fetchNotes, fetchDatasets]);

  if (loading) return <WorkspaceSkeleton />;
  if (!ws) return null;
  return <Outlet />;
}
