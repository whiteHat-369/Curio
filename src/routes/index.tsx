import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  X,
  Network,
  MessageSquareText,
  Gauge,
  Quote,
  Upload,
  Sparkles,
  Eye,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { ConfidenceBar } from "@/components/confidence-bar";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <HowItWorks />
      <Features />
      <Comparison />
      <Testimonials />
      <FinalCTA />
      <SiteFooter />
    </div>
  );
}

/* ------------------------------- Hero ------------------------------- */
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="absolute inset-0 bg-grid-soft opacity-40" aria-hidden />
      <div className="absolute inset-0 bg-radial-glow" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 font-ui text-xs text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            Built for graduate researchers
          </div>
          <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
            Evidence-first research intelligence
            <span className="block text-muted-foreground">for your literature review.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Curio reads your paper corpus and builds a live evidence map — every AI-surfaced claim
            traces back to a specific paper and paragraph, with a visible confidence score.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-11 px-5">
              <Link to="/signup">
                Start your first workspace <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-11 px-4 text-muted-foreground">
              <a href="#how">See how it works</a>
            </Button>
          </div>
          <p className="mt-4 font-ui text-xs text-muted-foreground">
            No credit card. Import 30–300 papers on day one.
          </p>
        </div>

        {/* Product preview mockup */}
        <div className="mt-16 md:mt-20">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <div className="relative mx-auto max-w-5xl">
      <div
        className="absolute inset-x-16 -top-8 h-32 rounded-full bg-[var(--primary)]/20 blur-3xl"
        aria-hidden
      />
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/40">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-background/60 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          </div>
          <div className="ml-3 font-ui text-xs text-muted-foreground">
            curio · Efficient Long-Context Transformers · Evidence Map
          </div>
        </div>
        <div className="grid grid-cols-3 gap-0">
          <PreviewCol
            label="Supports"
            tone="success"
            items={[
              {
                paper: "Katharopoulos et al., 2020",
                claim: "Linear attention preserves quality on WikiText-103.",
                conf: 0.74,
              },
              {
                paper: "Vaswani et al., 2017",
                claim: "Attention scales to seq-to-seq translation.",
                conf: 0.68,
              },
            ]}
          />
          <PreviewCol
            label="Contradicts"
            tone="error"
            items={[
              {
                paper: "Liu et al., 2023",
                claim: "Long-context models fail on middle positions.",
                conf: 0.88,
                why: "different population",
              },
            ]}
          />
          <PreviewCol
            label="Mixed / Silent"
            tone="warning"
            items={[
              {
                paper: "Vaswani et al., 2017",
                claim: "Baseline only evaluated at <512 tokens.",
                conf: 0.55,
                why: "different dataset",
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function PreviewCol({
  label,
  tone,
  items,
}: {
  label: string;
  tone: "success" | "error" | "warning";
  items: { paper: string; claim: string; conf: number; why?: string }[];
}) {
  const dot =
    tone === "success"
      ? "bg-[var(--success)]"
      : tone === "error"
        ? "bg-[var(--destructive)]"
        : "bg-[var(--warning)]";
  return (
    <div className="border-r border-border p-4 last:border-r-0">
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="font-ui text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className="ml-auto font-ui text-[11px] text-muted-foreground">{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map((i, idx) => (
          <div key={idx} className="rounded-lg border border-border bg-background/40 p-3">
            <div className="font-ui text-[11px] text-muted-foreground">{i.paper}</div>
            <div className="mt-1 text-sm text-foreground">{i.claim}</div>
            <div className="mt-2 flex items-center justify-between">
              <ConfidenceBar value={i.conf} />
              {i.why && (
                <span className="font-ui text-[10px] uppercase tracking-wider text-muted-foreground">
                  {i.why}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- How it works --------------------------- */
function HowItWorks() {
  const steps = [
    {
      icon: Upload,
      title: "Upload your papers",
      body: "Drop PDFs or import from OpenAlex, arXiv, and PubMed. 30 or 300 — Curio handles the corpus.",
    },
    {
      icon: Sparkles,
      title: "AI extracts and cross-references claims",
      body: "Each paper is parsed for methods, datasets, and findings. Claims are aligned across your library.",
    },
    {
      icon: Eye,
      title: "See what's proven, contradicted, or missing",
      body: "The Evidence Map shows every claim, its source paragraph, and a confidence score — nothing asserted without a citation.",
    },
  ];
  return (
    <section id="how" className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead
          eyebrow="How it works"
          title="Three steps from PDF pile to publishable synthesis."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-[var(--primary)]/40"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted font-ui text-xs font-semibold text-foreground">
                  {i + 1}
                </span>
                <s.icon className="h-4 w-4 text-[var(--primary)]" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- Features ----------------------------- */
function Features() {
  const items = [
    {
      icon: Network,
      title: "Evidence Mapping",
      body: "See which papers support, contradict, or stay silent on each research question — with source paragraphs and confidence.",
    },
    {
      icon: MessageSquareText,
      title: "Grounded AI Chat",
      body: "Ask questions of your corpus. Every answer cites a paper chip and paragraph — no ungrounded assertions.",
    },
    {
      icon: Gauge,
      title: "Research Health Score",
      body: "Live coverage and recency gauges show where your review is thin before your committee does.",
    },
    {
      icon: Quote,
      title: "Citation Export",
      body: "One-click APA, IEEE, and BibTeX for any paper, section, or the whole corpus.",
    },
  ];
  return (
    <section id="features" className="border-b border-border/60 bg-card/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead
          eyebrow="What's in v1"
          title="Everything you need to run a defensible literature review."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {items.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-border bg-background p-6 transition-all hover:border-[var(--primary)]/40"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                <f.icon className="h-4 w-4" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- Comparison ---------------------------- */
function Comparison() {
  const rows = [
    { label: "Every claim traces to a source paragraph", curio: true, other: false },
    { label: "Persists across sessions & devices", curio: true, other: false },
    { label: "Visible confidence on every answer", curio: true, other: false },
    { label: "Cross-paper contradiction detection", curio: true, other: false },
  ];
  return (
    <section id="compare" className="border-b border-border/60 py-24">
      <div className="mx-auto max-w-4xl px-6">
        <SectionHead eyebrow="Comparison" title="Curio vs. ChatGPT + Zotero + Scholar." />
        <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-[1fr_120px_160px] border-b border-border bg-background/40 px-5 py-3 font-ui text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span></span>
            <span className="text-center text-foreground">Curio</span>
            <span className="text-center">Chat + Zotero + Scholar</span>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`grid grid-cols-[1fr_120px_160px] items-center px-5 py-4 text-sm ${
                i < rows.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <span className="text-foreground">{r.label}</span>
              <span className="flex justify-center">
                {r.curio ? (
                  <Check className="h-4 w-4 text-[var(--success)]" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <span className="flex justify-center">
                {r.other ? (
                  <Check className="h-4 w-4 text-[var(--success)]" />
                ) : (
                  <X className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Testimonials --------------------------- */
function Testimonials() {
  return (
    <section className="border-b border-border/60 bg-card/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHead eyebrow="Researchers" title="What early users are saying." />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-dashed border-border bg-background/60 p-6"
            >
              <div className="mb-4 h-3 w-16 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-2 w-full rounded bg-muted" />
                <div className="h-2 w-11/12 rounded bg-muted" />
                <div className="h-2 w-9/12 rounded bg-muted" />
              </div>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-2 w-24 rounded bg-muted" />
                  <div className="h-2 w-16 rounded bg-muted/60" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center font-ui text-xs text-muted-foreground">
          Real quotes coming from the closed beta cohort.
        </p>
      </div>
    </section>
  );
}

/* ----------------------------- Final CTA ---------------------------- */
function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-28">
      <div className="absolute inset-0 bg-radial-glow" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Start with the first thirty papers.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Curio is free for a single workspace. Upload your reading list and see the evidence map in
          under five minutes.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg" className="h-11 px-5">
            <Link to="/signup">
              Create your workspace <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-11 px-4 text-muted-foreground">
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="font-ui text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {title}
      </h2>
    </div>
  );
}
