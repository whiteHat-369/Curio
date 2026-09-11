import { Link } from "@tanstack/react-router";
import { BookOpen, Globe, GraduationCap, Youtube, ArrowUpRight } from "lucide-react";
import { slugify } from "@/lib/utils";
import type { PaperWithMeta } from "@/lib/api-store";

export interface RelatedResource {
  id: string;
  kind: "paper" | "arxiv" | "scholar" | "video";
  title: string;
  description: string;
  href: string;
  meta: string;
  internal?: boolean;
  wsSlug?: string;
  paperId?: string;
}

const kindIcon = {
  paper: BookOpen,
  arxiv: GraduationCap,
  scholar: Globe,
  video: Youtube,
} as const;

const kindLabel = {
  paper: "Workspace paper",
  arxiv: "arXiv",
  scholar: "Scholar",
  video: "Video",
} as const;

/**
 * Builds 3–6 high-priority resource cards for an answer.
 * Workspace papers are real library items; external entries are
 * deterministic search links (never hallucinated URLs).
 */
export function buildRelatedResources(options: {
  query: string;
  papers: PaperWithMeta[];
  citedIds: string[];
  external: boolean;
  wsName: string;
}): RelatedResource[] {
  const { query, papers, citedIds, external, wsName } = options;
  const out: RelatedResource[] = [];
  const seen = new Set<string>();

  // 1. Cited workspace papers first, then other workspace papers — max 3.
  const cited = papers.filter((p) => citedIds.includes(p.id));
  const rest = papers.filter((p) => !citedIds.includes(p.id));
  for (const p of [...cited, ...rest].slice(0, 3)) {
    seen.add(p.id);
    out.push({
      id: p.id,
      kind: "paper",
      title: p.title,
      description:
        p.abstract?.slice(0, 110).trim() ||
        `${p.authors.slice(0, 2).join(", ")} · ${p.venue}`,
      href: `/workspace/${slugify(wsName)}/paper/${p.id}`,
      meta: `${p.authors[0] ?? "Unknown"} · ${p.year}`,
      internal: true,
    });
  }
  void seen;

  // 2. External shortcuts only when the toggle is on — max 3.
  if (external && query.trim()) {
    const q = query.trim().slice(0, 120);
    const eq = encodeURIComponent(q);
    out.push({
      id: "ext-arxiv",
      kind: "arxiv",
      title: `Preprints on “${q.length > 42 ? `${q.slice(0, 42)}…` : q}”`,
      description: "Latest open-access preprints matching your question.",
      href: `https://arxiv.org/search/?query=${eq}&searchtype=all&source=header`,
      meta: "arxiv.org",
    });
    out.push({
      id: "ext-scholar",
      kind: "scholar",
      title: "Scholarly articles & citations",
      description: "Peer-reviewed papers with citation counts and related work.",
      href: `https://scholar.google.com/scholar?q=${eq}`,
      meta: "scholar.google.com",
    });
    out.push({
      id: "ext-video",
      kind: "video",
      title: "Talks & explainers",
      description: "Conference talks and visual walkthroughs of the topic.",
      href: `https://www.youtube.com/results?search_query=${eq}`,
      meta: "youtube.com",
    });
  }

  return out.slice(0, 6);
}

export function RelatedRail({ resources }: { resources: RelatedResource[] }) {
  if (resources.length === 0) return null;
  return (
    <aside className="min-w-0">
      <div className="mb-2 font-ui text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Related resources · {resources.length}
      </div>
      <div className="space-y-2">
        {resources.map((r) => {
          const Icon = kindIcon[r.kind];
          const inner = (
            <div className="group card-lift rounded-xl border border-border bg-card p-3 hover:border-[var(--primary)]/40">
              <div className="flex items-center gap-1.5">
                <Icon className="h-3 w-3 shrink-0 text-[var(--primary)]" />
                <span className="font-ui text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {kindLabel[r.kind]}
                </span>
                <ArrowUpRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="mt-1.5 line-clamp-2 font-ui text-xs font-semibold leading-snug text-foreground">
                {r.title}
              </div>
              <div className="mt-1 line-clamp-2 font-sans text-[11px] leading-snug text-muted-foreground">
                {r.description}
              </div>
              <div className="mt-1.5 truncate font-ui text-[10px] text-[var(--primary)]">
                {r.meta}
              </div>
            </div>
          );
          return r.internal ? (
            <Link key={r.id} to={r.href} className="block">
              {inner}
            </Link>
          ) : (
            <a key={r.id} href={r.href} target="_blank" rel="noreferrer" className="block">
              {inner}
            </a>
          );
        })}
      </div>
    </aside>
  );
}
