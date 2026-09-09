import { Link } from "@tanstack/react-router";

export function CurioMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <circle cx="12" cy="12" r="3.2" fill="var(--primary)" />
      <circle cx="19" cy="7" r="1.6" fill="var(--accent-purple)" />
      <line
        x1="12"
        y1="12"
        x2="19"
        y2="7"
        stroke="var(--accent-purple)"
        strokeWidth="1"
        opacity="0.6"
      />
    </svg>
  );
}

export function CurioLogo({ withText = true, size = 22 }: { withText?: boolean; size?: number }) {
  return (
    <Link to="/" className="flex items-center gap-2 font-display font-semibold text-foreground">
      <CurioMark size={size} />
      {withText && <span className="text-[15px] tracking-tight">Curio</span>}
    </Link>
  );
}
