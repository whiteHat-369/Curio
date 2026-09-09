import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Check } from "lucide-react";
import { useApiStore } from "@/lib/api-store";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
  head: () => ({ meta: [{ title: "Set up your workspace — Curio" }] }),
});

const fields = [
  { id: "cs", label: "Computer Science / Engineering", enabled: true },
  { id: "bio", label: "Life Sciences", enabled: false },
  { id: "med", label: "Medicine", enabled: false },
  { id: "soc", label: "Social Sciences", enabled: false },
];

function OnboardingPage() {
  const navigate = useNavigate();
  const create = useApiStore((s) => s.createWorkspace);
  const [step, setStep] = useState<1 | 2>(1);
  const [field, setField] = useState("cs");
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [errors, setErrors] = useState<{ name?: string; question?: string }>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "Please name your workspace.";
    else if (name.trim().length > 50) errs.name = "Workspace name must be 50 characters or fewer.";
    if (question.trim().length < 10) errs.question = "Add a real research question.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const wsName = name.trim();
    create(wsName, question);
    toast.success("Workspace created");
    navigate({ to: `/workspace/${slugify(wsName)}` });
  };

  return (
    <AuthShell
      title={step === 1 ? "Choose your field" : "Create your first workspace"}
      subtitle={
        step === 1
          ? "Curio tailors extraction and evidence patterns to your discipline."
          : "You can add more workspaces later — one is enough to start."
      }
    >
      {step === 1 ? (
        <div className="space-y-3">
          {fields.map((f) => {
            const active = field === f.id;
            return (
              <button
                key={f.id}
                disabled={!f.enabled}
                onClick={() => setField(f.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left font-ui text-sm transition-colors ${
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)]/5 text-foreground"
                    : "border-border text-foreground hover:border-border/80"
                } ${!f.enabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <span>{f.label}</span>
                {!f.enabled ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Coming soon
                  </span>
                ) : (
                  active && <Check className="h-4 w-4 text-[var(--primary)]" />
                )}
              </button>
            );
          })}
          <Button className="mt-4 w-full" onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="wname">Workspace name</Label>
            <Input
              id="wname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Efficient Long-Context Transformers"
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
            <Label htmlFor="rq">Research question</Label>
            <Textarea
              id="rq"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="How does attention efficiency affect long-context reasoning quality?"
              rows={3}
            />
            {errors.question && (
              <p className="font-ui text-xs text-[var(--destructive)]">{errors.question}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="submit" className="flex-1">
              Enter Curio
            </Button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
