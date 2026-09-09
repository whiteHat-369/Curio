import type { ReactNode } from "react";
import { CurioLogo } from "./curio-logo";
import { Link } from "@tanstack/react-router";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0 bg-grid-soft opacity-30" aria-hidden />
      <div className="absolute inset-0 bg-radial-glow" aria-hidden />
      <div className="relative flex min-h-screen items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <CurioLogo />
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-xl shadow-black/10">
            <h1 className="font-display text-xl font-semibold text-foreground">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && (
            <p className="mt-6 text-center font-ui text-sm text-muted-foreground">{footer}</p>
          )}
          <p className="mt-8 text-center font-ui text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              ← Back to curio.dev
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
