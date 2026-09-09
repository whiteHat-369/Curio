import { describe, it, expect } from "vitest";
import {
  formatAuthors,
  formatCitationAPA,
  formatCitationIEEE,
  formatCitationBibTeX,
} from "./citations.js";

describe("citation formatting helpers", () => {
  const paper = {
    title: "Deep Learning for Natural Language Processing",
    authors: ["John Doe", "Jane Smith", "Bob Johnson"],
    year: 2023,
    venue: "Journal of AI Research",
  };

  describe("formatAuthors", () => {
    it("should format a single author", () => {
      expect(formatAuthors(["John Doe"])).toBe("John Doe");
    });

    it("should format up to three authors", () => {
      expect(formatAuthors(["John Doe", "Jane Smith"])).toBe("John Doe, Jane Smith");
      expect(formatAuthors(["John Doe", "Jane Smith", "Bob Johnson"])).toBe(
        "John Doe, Jane Smith, Bob Johnson"
      );
    });

    it("should format more than three authors with 'et al.'", () => {
      expect(formatAuthors(["John Doe", "Jane Smith", "Bob Johnson", "Alice Lee"])).toBe(
        "John Doe et al."
      );
    });

    it("should handle empty or null authors list", () => {
      expect(formatAuthors([])).toBe("Unknown");
      expect(formatAuthors([null as any, undefined as any])).toBe("Unknown");
    });
  });

  describe("formatCitationAPA", () => {
    it("should format paper details in APA style", () => {
      const citation = formatCitationAPA(paper);
      expect(citation).toBe(
        "John Doe, Jane Smith, Bob Johnson (2023). Deep Learning for Natural Language Processing. Journal of AI Research."
      );
    });

    it("should handle missing year or venue in APA style", () => {
      const missingPaper = {
        title: "Deep Learning",
        authors: ["John Doe"],
        year: null as any,
        venue: "",
      };
      const citation = formatCitationAPA(missingPaper);
      expect(citation).toBe("John Doe (n.d.). Deep Learning. Unknown venue.");
    });
  });

  describe("formatCitationIEEE", () => {
    it("should format paper details in IEEE style", () => {
      const citation = formatCitationIEEE(paper);
      expect(citation).toBe(
        'John Doe, Jane Smith, Bob Johnson, "Deep Learning for Natural Language Processing," Journal of AI Research, 2023.'
      );
    });

    it("should handle missing year or venue in IEEE style", () => {
      const missingPaper = {
        title: "Deep Learning",
        authors: ["John Doe"],
        year: null as any,
        venue: "",
      };
      const citation = formatCitationIEEE(missingPaper);
      expect(citation).toBe('John Doe, "Deep Learning," Unknown venue, n.d..');
    });
  });

  describe("formatCitationBibTeX", () => {
    it("should format paper details in BibTeX style", () => {
      const citation = formatCitationBibTeX(paper);
      expect(citation).toBe(`@article{johnson2023,
  author = {John Doe and Jane Smith and Bob Johnson},
  title = {Deep Learning for Natural Language Processing},
  year = {2023},
  journal = {Journal of AI Research}
}`);
    });

    it("should generate a proper bibKey when first author last name is complex or empty", () => {
      const singleWordAuthor = {
        title: "Paper Title",
        authors: ["Superstar"],
        year: 2020,
        venue: "Venue Name",
      };
      const citation = formatCitationBibTeX(singleWordAuthor);
      expect(citation).toContain("@article{superstar2020,");
    });

    it("should handle missing authors and empty fields in BibTeX", () => {
      const missingPaper = {
        title: "",
        authors: [],
        year: null as any,
        venue: "",
      };
      const citation = formatCitationBibTeX(missingPaper);
      expect(citation).toBe(`@article{unknownunknown,
  author = {Unknown},
  title = {Untitled},
  year = {unknown},
  journal = {Unknown venue}
}`);
    });
  });
});
