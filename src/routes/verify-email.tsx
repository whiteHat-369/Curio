import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { MailCheck } from "lucide-react";

export const Route = createFileRoute("/verify-email")({
  component: VerifyPage,
  head: () => ({ meta: [{ title: "Verify your email — Curio" }] }),
});

function VerifyPage() {
  return (
    <AuthShell
      title="Verify your email"
      subtitle="We sent a verification link to your inbox. Click it to activate your account."
    >
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
          <MailCheck className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground">
          Didn't get the email? Check spam, or resend in 30 seconds.
        </p>
        <div className="flex w-full gap-2">
          <Button variant="secondary" className="flex-1">
            Resend
          </Button>
          <Button asChild className="flex-1">
            <Link to="/onboarding">I verified</Link>
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
