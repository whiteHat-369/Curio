import { useEffect, useState } from "react";

export function useSimulatedLoad(deps: unknown[] = [], ms = 450) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return loading;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted/60 ${className}`} />;
}

export function WorkspaceSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <Skeleton className="h-3 w-40" />
      <div className="mt-6 rounded-xl border border-border bg-card p-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-8 w-3/4" />
        <div className="mt-8 grid grid-cols-3 gap-6">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    </div>
  );
}

export function PaperDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <Skeleton className="h-3 w-56" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-9 w-11/12" />
          <Skeleton className="mt-2 h-4 w-1/2" />
          <div className="mt-8 space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-11/12" />
                <Skeleton className="mt-2 h-4 w-9/12" />
              </div>
            ))}
          </div>
        </div>
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
