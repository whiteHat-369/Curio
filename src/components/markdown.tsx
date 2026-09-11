import { Fragment, type ReactNode } from "react";

/**
 * Lightweight markdown renderer — no extra dependencies.
 * Handles headings, bold/italic/strike, inline code, links,
 * bullets, numbered lists, blockquotes, dividers, fenced code,
 * and pipe tables. Anything unrecognized falls back to paragraphs.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g,
  );
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={key}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("~~") && part.endsWith("~~") && part.length > 4) {
      return <s key={key}>{part.slice(2, -2)}</s>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = link[2];
      const external = /^https?:\/\//.test(href);
      return (
        <a
          key={key}
          href={href}
          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          className="font-medium text-[var(--primary)] hover:underline"
        >
          {link[1]}
        </a>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  return /^\|?[\s:|-]+\|?$/.test(t) && t.includes("-");
}

function Table({ lines }: { lines: string[] }): ReactNode {
  const header = splitRow(lines[0]);
  const rows = lines.slice(2).map(splitRow);
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse font-sans text-[13px]">
        <thead>
          <tr className="bg-muted/60">
            {header.map((h, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-3 py-2 text-left font-ui text-[11px] font-semibold uppercase tracking-wide text-foreground"
              >
                {renderInline(h, `th-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-border last:border-0">
              {row.map((cell, c) => (
                <td key={c} className="min-w-[120px] px-3 py-2 align-top leading-relaxed text-foreground">
                  {renderInline(cell, `td-${r}-${c}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines (paragraph spacing handled by layout)
    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre
          key={key++}
          className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground"
        >
          {buf.join("\n")}
        </pre>,
      );
      continue;
    }

    // Headings
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const content = renderInline(heading[2], `h-${key}`);
      const cls =
        level === 1
          ? "font-display text-lg font-semibold text-foreground"
          : level === 2
            ? "font-display text-[15px] font-semibold text-foreground"
            : "font-ui text-[13px] font-semibold text-foreground";
      const Tag = (level <= 2 ? "h3" : "h4") as "h3" | "h4";
      blocks.push(
        <Tag key={key++} className={`${cls} ${key > 1 ? "mt-1" : ""}`}>
          {content}
        </Tag>,
      );
      i++;
      continue;
    }

    // Divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={key++} className="border-border/70" />);
      i++;
      continue;
    }

    // Pipe table
    if (
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const buf: string[] = [lines[i], lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        buf.push(lines[i]);
        i++;
      }
      blocks.push(<Table key={key++} lines={buf} />);
      continue;
    }

    // Bullet list
    if (/^([-*•]|\d+[.)])\s+/.test(trimmed)) {
      const items: string[] = [];
      const ordered = /^\d+[.)]\s+/.test(trimmed);
      while (i < lines.length && /^([-*•]|\d+[.)])\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^([-*•]|\d+[.)])\s+/, ""));
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List
          key={key++}
          className={`space-y-1.5 ${ordered ? "list-decimal pl-5" : "list-none pl-0"}`}
        >
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2.5 text-foreground">
              {!ordered && (
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
              )}
              <span className="min-w-0 flex-1 leading-relaxed">
                {renderInline(item, `li-${key}-${j}`)}
              </span>
            </li>
          ))}
        </List>,
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="border-l-2 border-[var(--primary)]/50 pl-3 text-muted-foreground"
        >
          {renderInline(buf.join(" "), `q-${key}`)}
        </blockquote>,
      );
      continue;
    }

    // Paragraph (merge wrapped lines)
    const buf: string[] = [trimmed];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|```|>|(-{3,}|\*{3,}|_{3,})$)/.test(lines[i].trim()) &&
      !/^([-*•]|\d+[.)])\s+/.test(lines[i].trim()) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={key++} className="leading-relaxed text-foreground">
        {renderInline(buf.join(" "), `p-${key}`)}
      </p>,
    );
  }

  return <div className={`space-y-3 font-sans text-[15px] ${className}`}>{blocks}</div>;
}
