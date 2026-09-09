import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useApiStore, type ImportDatabase } from "@/lib/api-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Database, MoreVertical, Upload, FileSpreadsheet, Eye } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_app/workspace/$name/datasets")({
  component: DatasetsPage,
  head: () => ({ meta: [{ title: "Datasets — Curio" }] }),
});

function DatasetsPage() {
  const { name } = useParams({ from: "/_app/workspace/$name/datasets" });
  const ws = useApiStore((s) => s.workspaces.find((w) => slugify(w.name) === name));
  const databases = useApiStore((s) => s.databases);
  const addDatabase = useApiStore((s) => s.addDatabase);
  const renameDatabase = useApiStore((s) => s.renameDatabase);
  const deleteDatabase = useApiStore((s) => s.deleteDatabase);

  const [previewDb, setPreviewDb] = useState<string | null>(null);

  if (!ws) return null;

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    addDatabase(file.name, file.name);
    toast.success(`${file.name} uploaded`);
  };

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[var(--primary)]" />
            <h1 className="font-display text-2xl font-semibold">Datasets</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Upload a dataset offline.</p>
        </div>
        <label>
          <input
            type="file"
            accept=".csv,.json,.parquet,.xlsx"
            className="hidden"
            onChange={(e) => {
              handleFileUpload(e.target.files);
              e.currentTarget.value = "";
            }}
          />
          <Button className="font-ui" asChild>
            <span className="cursor-pointer">
              <Upload className="mr-1.5 h-4 w-4" /> Upload dataset
            </span>
          </Button>
        </label>
      </div>

      {databases.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={Database}
            title="No datasets yet"
            description="Upload a dataset offline (CSV, JSON, Parquet, XLSX) to make it available for import."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-2 sm:grid-cols-2">
          {databases.map((db) => (
            <Card key={db.id} className="flex items-center justify-between border-border px-4 py-3">
              <span className="flex items-center gap-2 font-ui text-sm text-foreground">
                <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{db.name}</span>
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 font-ui text-xs cursor-pointer"
                  onClick={() => setPreviewDb(db.id)}
                >
                  <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground cursor-pointer">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => {
                        const newName = window.prompt("Rename dataset:", db.name);
                        if (newName !== null) renameDatabase(db.id, newName);
                      }}
                    >
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive cursor-pointer"
                      onClick={() => {
                        if (window.confirm(`Remove "${db.name}"?`)) {
                          deleteDatabase(db.id);
                        }
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}

      <PreviewDialog
        db={databases.find((d) => d.id === previewDb) ?? null}
        onOpenChange={(open) => !open && setPreviewDb(null)}
      />
    </div>
  );
}

function PreviewDialog({
  db,
  onOpenChange,
}: {
  db: ImportDatabase | null;
  onOpenChange: (open: boolean) => void;
}) {
  const preview = db?.previewJson as { columns?: string[]; rows?: string[][] } | null;
  const columns = preview?.columns ?? [];
  const rows = preview?.rows ?? [];

  return (
    <Dialog open={db !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Preview {db?.name}</DialogTitle>
        </DialogHeader>
        <p className="font-ui text-xs text-muted-foreground">
          Showing a sample of the uploaded file.
        </p>
        <div className="mt-2 overflow-x-auto rounded-md border border-border">
          {columns.length > 0 ? (
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 font-semibold text-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {row.map((cell, j) => (
                      <td key={j} className="max-w-[220px] truncate px-3 py-2 text-muted-foreground">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-6 text-center font-ui text-xs text-muted-foreground">
              No preview data available for this dataset.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
