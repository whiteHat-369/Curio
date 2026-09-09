import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";

export function NewWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [errors, setErrors] = useState<{ name?: string; question?: string }>({});
  const create = useStore((s) => s.createWorkspace);
  const navigate = useNavigate();

  const submit = async () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Please name your workspace.";
    else if (name.trim().length > 50) errs.name = "Workspace name must be 50 characters or fewer.";
    if (question.trim().length < 10) errs.question = "Add a research question (≥ 10 chars).";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const wsName = name.trim();
    try {
      await create(wsName, question);
      toast.success("Workspace created");
      onOpenChange(false);
      setName("");
      setQuestion("");
      navigate({ to: `/workspace/${slugify(wsName)}` });
    } catch (err) {
      toast.error("Failed to create workspace");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">New workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Retrieval-Grounded Generation"
              maxLength={50}
            />
            <p
              className={`font-ui text-[10px] text-right ${name.length > 45 ? (name.length >= 50 ? "text-[var(--destructive)]" : "text-[var(--warning)]") : "text-muted-foreground"}`}
            >
              {name.length}/50
            </p>
            {errors.name && (
              <p className="font-ui text-xs text-[var(--destructive)]">{errors.name}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-q">Research question</Label>
            <Textarea
              id="ws-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="What question is this workspace investigating?"
            />
            {errors.question && (
              <p className="font-ui text-xs text-[var(--destructive)]">{errors.question}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-ui">
            Cancel
          </Button>
          <Button onClick={submit} className="font-ui">
            Create workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
