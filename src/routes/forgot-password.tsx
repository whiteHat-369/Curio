import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPage,
  head: () => ({ meta: [{ title: "Reset your password — Curio" }] }),
});

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ForgotPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailRe.test(email)) {
      setError("Enter a valid email.");
      return;
    }
    setError(null);
    setSent(true);
  };

  return (
    <AuthShell
      title={sent ? "Check your inbox" : "Reset your password"}
      subtitle={
        sent
          ? "We sent a password reset link. It expires in 30 minutes."
          : "Enter your account email and we'll send you a reset link."
      }
      footer={
        <>
          Remembered it?{" "}
          <Link to="/login" className="text-foreground hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <Button asChild className="w-full" variant="secondary">
          <Link to="/login">Back to sign in</Link>
        </Button>
      ) : (
        <form className="space-y-4" onSubmit={submit} noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
            />
            {error && <p className="font-ui text-xs text-[var(--destructive)]">{error}</p>}
          </div>
          <Button className="w-full">Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}
