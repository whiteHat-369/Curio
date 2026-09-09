import { CurioLogo } from "./curio-logo";

export function SiteFooter() {
  const cols: { title: string; items: string[] }[] = [
    { title: "Product", items: ["Evidence Map", "AI Chat", "Health Score", "Citations"] },
    { title: "Company", items: ["About", "Blog", "Careers", "Contact"] },
    { title: "Legal", items: ["Privacy", "Terms", "Security", "Cookies"] },
  ];
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-6 py-14 md:grid-cols-4">
        <div>
          <CurioLogo />
          <p className="mt-3 max-w-[220px] text-sm text-muted-foreground">
            Evidence-first research intelligence for graduate researchers.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="font-ui text-sm font-semibold text-foreground">{c.title}</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {c.items.map((i) => (
                <li key={i}>
                  <a href="#" className="transition-colors hover:text-foreground">
                    {i}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 font-ui text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Curio Labs</span>
          <span>Made for researchers</span>
        </div>
      </div>
    </footer>
  );
}
