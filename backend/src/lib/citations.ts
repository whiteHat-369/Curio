export interface CitationPaper {
  title: string;
  authors: string[];
  year: number;
  venue: string;
}

export function formatAuthors(authors: string[]): string {
  if (!authors || authors.length === 0) return "Unknown";
  // Filter out empty or null strings
  const validAuthors = authors.map((a) => a?.trim()).filter(Boolean);
  if (validAuthors.length === 0) return "Unknown";
  if (validAuthors.length <= 3) return validAuthors.join(", ");
  return `${validAuthors[0]} et al.`;
}

export function formatCitationAPA(paper: CitationPaper): string {
  const authorStr = formatAuthors(paper.authors);
  const year = paper.year || "n.d.";
  const title = paper.title || "Untitled";
  const venue = paper.venue || "Unknown venue";
  return `${authorStr} (${year}). ${title}. ${venue}.`;
}

export function formatCitationIEEE(paper: CitationPaper): string {
  const authorStr = formatAuthors(paper.authors);
  const year = paper.year || "n.d.";
  const title = paper.title || "Untitled";
  const venue = paper.venue || "Unknown venue";
  return `${authorStr}, "${title}," ${venue}, ${year}.`;
}

export function formatCitationBibTeX(paper: CitationPaper): string {
  const validAuthors = (paper.authors || []).map((a) => a?.trim()).filter(Boolean);
  const firstAuthor = validAuthors[0] || "unknown";
  
  // Extract last name or default to firstAuthor
  const lastName = firstAuthor.split(/\s+/).pop()?.replace(/[^a-zA-Z0-9]/g, "") || "unknown";
  const bibKey = `${lastName.toLowerCase()}${paper.year || "unknown"}`;
  
  const authorStr = validAuthors.length > 0 ? validAuthors.join(" and ") : "Unknown";
  const title = paper.title || "Untitled";
  const venue = paper.venue || "Unknown venue";
  const year = paper.year || "unknown";

  return `@article{${bibKey},
  author = {${authorStr}},
  title = {${title}},
  year = {${year}},
  journal = {${venue}}
}`;
}
