export type Stance = "supports" | "contradicts" | "mixed";
export type ReadingStatus = "unread" | "reading" | "read";

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  status: ReadingStatus;
  tags: string[];
  abstract: string;
  methodology: string;
  dataset: string;
  results: string;
  limitations: string;
  keywords: string[];
  group?: string;
}

export interface EvidenceClaim {
  id: string;
  paperId: string;
  question: string;
  stance: Stance;
  summary: string;
  paragraph: string;
  confidence: number; // 0..1
  why?: "different dataset" | "different population" | "different method" | "different assumption";
}

export interface Workspace {
  id: string;
  name: string;
  question: string;
  paperIds: string[];
  progress: number;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  paperIds: string[];
  updatedAt: string;
  group?: string;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { paperId: string; paragraph: string; confidence: number }[];
  followups?: string[];
  external?: boolean;
}

export const papers: Paper[] = [
  {
    id: "p1",
    title: "Attention Is All You Need",
    authors: ["Vaswani et al."],
    year: 2017,
    venue: "NeurIPS",
    status: "read",
    tags: ["transformers", "seq2seq"],
    abstract:
      "We propose the Transformer, a model architecture based solely on attention mechanisms.",
    methodology:
      "Encoder–decoder stacks of multi-head self-attention and position-wise feed-forward networks.",
    dataset: "WMT 2014 English–German and English–French translation.",
    results:
      "State-of-the-art BLEU with significantly less training time than recurrent baselines.",
    limitations: "Quadratic memory in sequence length; evaluated only on translation.",
    keywords: ["self-attention", "translation", "encoder-decoder"],
  },
  {
    id: "p2",
    title: "Efficient Transformers with Linear Attention",
    authors: ["Katharopoulos et al."],
    year: 2020,
    venue: "ICML",
    status: "reading",
    tags: ["transformers", "efficiency"],
    abstract: "Linear-time attention via kernel feature maps.",
    methodology: "Reformulate softmax attention as a kernel dot-product with associativity.",
    dataset: "IMDB, WikiText-103, autoregressive image generation.",
    results: "Comparable accuracy with 4000x speedup on long sequences.",
    limitations: "Kernel choice matters; performance gap on some short tasks.",
    keywords: ["linear attention", "kernel methods", "long context"],
  },
  {
    id: "p3",
    title: "Scaling Laws for Neural Language Models",
    authors: ["Kaplan et al."],
    year: 2020,
    venue: "arXiv",
    status: "read",
    tags: ["scaling", "LLMs"],
    abstract: "Loss scales as a power-law with model size, dataset size, and compute.",
    methodology: "Train hundreds of decoder-only transformers of varying size and data.",
    dataset: "WebText2.",
    results: "Predictable power-law relationships across 7 orders of magnitude.",
    limitations: "Only autoregressive language modeling; no downstream tasks.",
    keywords: ["scaling", "loss curves", "compute"],
  },
  {
    id: "p4",
    title: "Training Compute-Optimal Large Language Models",
    authors: ["Hoffmann et al."],
    year: 2022,
    venue: "NeurIPS",
    status: "reading",
    tags: ["scaling", "LLMs"],
    abstract: "For a fixed compute budget, model size and training tokens should scale equally.",
    methodology: "Over 400 models trained across 5M–500B tokens.",
    dataset: "MassiveText.",
    results: "Chinchilla (70B) outperforms Gopher (280B) trained with 4x more data.",
    limitations: "Assumes IsoFLOP curves generalize; specific to decoder-only.",
    keywords: ["compute-optimal", "chinchilla", "training data"],
  },
  {
    id: "p5",
    title: "Emergent Abilities of Large Language Models",
    authors: ["Wei et al."],
    year: 2022,
    venue: "TMLR",
    status: "unread",
    tags: ["emergence", "LLMs"],
    abstract: "Some abilities appear discontinuously at scale.",
    methodology: "Evaluate models across BIG-bench and other benchmarks.",
    dataset: "BIG-bench.",
    results: "Sharp transitions in performance for arithmetic, multi-step reasoning.",
    limitations: "Metric choice may create the appearance of emergence.",
    keywords: ["emergence", "phase transitions"],
  },
  {
    id: "p6",
    title: "Are Emergent Abilities a Mirage?",
    authors: ["Schaeffer et al."],
    year: 2023,
    venue: "NeurIPS",
    status: "unread",
    tags: ["emergence", "critique"],
    abstract:
      "Discontinuous metrics create the illusion of emergence; smooth metrics reveal predictable curves.",
    methodology: "Reanalyze BIG-bench with alternative continuous metrics.",
    dataset: "BIG-bench reanalysis.",
    results: "Most emergent abilities disappear under continuous metrics.",
    limitations: "Does not cover all reported emergent abilities.",
    keywords: ["metrics", "emergence", "critique"],
  },
  {
    id: "p7",
    title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP",
    authors: ["Lewis et al."],
    year: 2020,
    venue: "NeurIPS",
    status: "read",
    tags: ["RAG", "retrieval"],
    abstract: "Combine parametric and non-parametric memory via retrieval.",
    methodology: "Dense passage retrieval + seq2seq generator, jointly trained.",
    dataset: "Natural Questions, TriviaQA.",
    results: "State-of-the-art on open-domain QA.",
    limitations: "Retriever quality bounds generator performance.",
    keywords: ["RAG", "open-domain QA"],
  },
  {
    id: "p8",
    title: "Lost in the Middle: How Language Models Use Long Contexts",
    authors: ["Liu et al."],
    year: 2023,
    venue: "TACL",
    status: "reading",
    tags: ["long context", "evaluation"],
    abstract: "Performance degrades when relevant info is in the middle of a long context.",
    methodology: "Multi-document QA with position-controlled placement.",
    dataset: "NaturalQuestions-based multi-doc set.",
    results: "U-shaped performance curve across positions.",
    limitations: "English-only, specific to open-book QA.",
    keywords: ["long context", "position bias"],
  },
];

export const workspaces: Workspace[] = [
  {
    id: "w1",
    name: "Efficient Long-Context Transformers",
    question:
      "How does attention efficiency affect long-context reasoning quality in decoder-only language models?",
    paperIds: ["p1", "p2", "p7", "p8"],
    progress: 0.68,
    updatedAt: "2 hours ago",
  },
  {
    id: "w2",
    name: "Scaling Laws & Emergence",
    question:
      "Are emergent abilities a real phenomenon of scale, or an artifact of discontinuous evaluation metrics?",
    paperIds: ["p3", "p4", "p5", "p6"],
    progress: 0.42,
    updatedAt: "yesterday",
  },
  {
    id: "w3",
    name: "Retrieval-Grounded Generation",
    question:
      "When does retrieval augmentation actually reduce hallucination in generative models?",
    paperIds: ["p7", "p8", "p2"],
    progress: 0.15,
    updatedAt: "3 days ago",
  },
];

export const evidenceByWorkspace: Record<string, EvidenceClaim[]> = {
  w2: [
    {
      id: "e1",
      paperId: "p3",
      question: "Are emergent abilities real?",
      stance: "supports",
      summary:
        "Loss follows smooth power-laws — capability jumps at scale are consistent with the trend.",
      paragraph:
        "We observe that language modeling loss scales as a power-law with model size across 7 orders of magnitude, suggesting predictable capability gains.",
      confidence: 0.86,
    },
    {
      id: "e2",
      paperId: "p5",
      question: "Are emergent abilities real?",
      stance: "supports",
      summary: "Sharp transitions observed in arithmetic and multi-step reasoning benchmarks.",
      paragraph:
        "For several tasks, performance is near random until a scale threshold, after which accuracy rises sharply.",
      confidence: 0.79,
    },
    {
      id: "e3",
      paperId: "p6",
      question: "Are emergent abilities real?",
      stance: "contradicts",
      summary:
        "Emergence disappears under smoother, continuous metrics — likely a measurement artifact.",
      paragraph:
        "When we replace exact-match with token-level edit distance, the discontinuous jump becomes a smooth improvement.",
      confidence: 0.82,
      why: "different method",
    },
    {
      id: "e4",
      paperId: "p4",
      question: "Are emergent abilities real?",
      stance: "mixed",
      summary:
        "Compute-optimal scaling shifts where emergence would appear, but does not confirm or deny it.",
      paragraph:
        "Chinchilla-optimal training changes the parameter regime in which capabilities appear, complicating cross-paper comparisons.",
      confidence: 0.61,
      why: "different assumption",
    },
  ],
  w1: [
    {
      id: "e5",
      paperId: "p2",
      question: "Does linear attention preserve long-context quality?",
      stance: "supports",
      summary: "Comparable perplexity with 4000x speedup on very long sequences.",
      paragraph:
        "Linear attention matches softmax attention on WikiText-103 while enabling context lengths intractable for O(n²) attention.",
      confidence: 0.74,
    },
    {
      id: "e6",
      paperId: "p8",
      question: "Does linear attention preserve long-context quality?",
      stance: "contradicts",
      summary: "Long-context models still fail to use middle positions effectively.",
      paragraph:
        "Across models, accuracy on multi-document QA drops sharply when the relevant document is placed in the middle of the context.",
      confidence: 0.88,
      why: "different population",
    },
    {
      id: "e7",
      paperId: "p1",
      question: "Does linear attention preserve long-context quality?",
      stance: "mixed",
      summary:
        "Original transformer establishes the O(n²) baseline; long-context claims are extrapolation.",
      paragraph:
        "The original architecture was evaluated on translation with modest sequence lengths (< 512 tokens).",
      confidence: 0.55,
      why: "different dataset",
    },
  ],
  w3: [],
};

export const notes: Record<string, Note[]> = {
  w1: [
    {
      id: "n1",
      title: "Position bias summary",
      body: "The U-shaped performance curve (Liu et al., 2023) suggests attention concentration matters more than raw context length.",
      paperIds: ["p8", "p2"],
      updatedAt: "1 hour ago",
    },
    {
      id: "n2",
      title: "Kernel choice tradeoffs",
      body: "Katharopoulos et al. show elu+1 kernels underperform on short sequences — worth revisiting for the discussion section.",
      paperIds: ["p2"],
      updatedAt: "yesterday",
    },
  ],
  w2: [
    {
      id: "n3",
      title: "Reframing emergence",
      body: "Consider framing thesis chapter around metric-dependence rather than 'does emergence exist'.",
      paperIds: ["p5", "p6"],
      updatedAt: "3 hours ago",
    },
  ],
  w3: [],
};

export const chatSeed: Record<string, ChatMessage[]> = {
  w2: [
    {
      id: "m1",
      role: "user",
      content: "Do the emergent-abilities papers actually agree with each other?",
    },
    {
      id: "m2",
      role: "assistant",
      content:
        "Not fully. Wei et al. (2022) report sharp transitions on several BIG-bench tasks, while Schaeffer et al. (2023) show these transitions disappear under continuous metrics. The disagreement is primarily methodological — different evaluation metrics, same underlying data.",
      sources: [
        {
          paperId: "p5",
          paragraph: "§3.1 — sharp transitions across benchmarks",
          confidence: 0.79,
        },
        {
          paperId: "p6",
          paragraph: "§4.2 — reanalysis under continuous metrics",
          confidence: 0.82,
        },
      ],
      followups: [
        "Which specific tasks disagree the most?",
        "How does Chinchilla scaling change this picture?",
        "Is there a task where all four papers agree?",
      ],
    },
  ],
};

export const findPaper = (id: string) => papers.find((p) => p.id === id);
export const findWorkspace = (id: string) => workspaces.find((w) => w.id === id);
