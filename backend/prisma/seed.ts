/**
 * Seed script — adds demo user and demo research data to the database.
 * Safe to re-run multiple times (uses upsert).
 * Run: npx tsx prisma/seed.ts
 */

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

const DEMO_USER_ID = "demo-user-id";
const DEMO_USER_EMAIL = "demo@curio.app";
const DEMO_USER_PASSWORD_HASH = crypto.createHash("sha256").update("password123").digest("hex");

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    console.log("⚠️ Skipping demo seed in production (set ALLOW_DEMO_SEED=true to force).");
    return;
  }

  console.log("🌱 Seeding database...");

  // ── 1. Demo User ────────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {
      email: DEMO_USER_EMAIL,
      name: "Demo Researcher",
      field: "Computer Science / Machine Learning",
      affiliation: "Curio Research Lab",
      onboardedAt: new Date(),
    },
    create: {
      id: DEMO_USER_ID,
      email: DEMO_USER_EMAIL,
      passwordHash: DEMO_USER_PASSWORD_HASH,
      name: "Demo Researcher",
      field: "Computer Science / Machine Learning",
      affiliation: "Curio Research Lab",
      emailVerifiedAt: new Date(),
      onboardedAt: new Date(),
    },
  });
  console.log(`✅ Demo User created (${user.email})`);

  // ── 2. Workspaces ───────────────────────────────────────────────
  const workspaces = [
    {
      id: "w1",
      ownerId: DEMO_USER_ID,
      name: "Efficient Attention Methods",
      question: "How do sub-quadratic attention mechanisms compare on long-context benchmarks?",
    },
    {
      id: "w2",
      ownerId: DEMO_USER_ID,
      name: "LLM Scaling & Emergence",
      question: "Are emergent abilities an artifact of metric selection or genuine compute-scale phase transitions?",
    },
    {
      id: "w3",
      ownerId: DEMO_USER_ID,
      name: "RAG & Retrieval Systems",
      question: "What are the primary failure modes of dense retrieval in production RAG systems?",
    },
  ];

  for (const ws of workspaces) {
    await prisma.workspace.upsert({
      where: { id: ws.id },
      update: ws,
      create: ws,
    });
  }
  console.log(`✅ ${workspaces.length} workspaces created`);

  // ── 3. Papers ───────────────────────────────────────────────────
  const paperData = [
    {
      id: "p1", workspaceId: "w1",
      title: "Attention Is All You Need",
      authors: ["Vaswani et al."], year: 2017, venue: "NeurIPS", status: "read",
      tags: ["transformers", "seq2seq"],
      abstract: "We propose the Transformer, a model architecture based solely on attention mechanisms.",
      methodology: "Encoder–decoder stacks of multi-head self-attention and position-wise feed-forward networks.",
      dataset: "WMT 2014 English–German and English–French translation.",
      results: "State-of-the-art BLEU with significantly less training time than recurrent baselines.",
      limitations: "Quadratic memory in sequence length; evaluated only on translation.",
      keywords: ["self-attention", "translation", "encoder-decoder"],
    },
    {
      id: "p2", workspaceId: "w1",
      title: "Efficient Transformers with Linear Attention",
      authors: ["Katharopoulos et al."], year: 2020, venue: "ICML", status: "reading",
      tags: ["transformers", "efficiency"],
      abstract: "Linear-time attention via kernel feature maps.",
      methodology: "Reformulate softmax attention as a kernel dot-product with associativity.",
      dataset: "IMDB, WikiText-103, autoregressive image generation.",
      results: "Comparable accuracy with 4000x speedup on long sequences.",
      limitations: "Kernel choice matters; performance gap on some short tasks.",
      keywords: ["linear attention", "kernel methods", "long context"],
    },
    {
      id: "p3", workspaceId: "w2",
      title: "Scaling Laws for Neural Language Models",
      authors: ["Kaplan et al."], year: 2020, venue: "arXiv", status: "read",
      tags: ["scaling", "LLMs"],
      abstract: "Loss scales as a power-law with model size, dataset size, and compute.",
      methodology: "Train hundreds of decoder-only transformers of varying size and data.",
      dataset: "WebText2.",
      results: "Predictable power-law relationships across 7 orders of magnitude.",
      limitations: "Only autoregressive language modeling; no downstream tasks.",
      keywords: ["scaling", "loss curves", "compute"],
    },
    {
      id: "p4", workspaceId: "w2",
      title: "Training Compute-Optimal Large Language Models",
      authors: ["Hoffmann et al."], year: 2022, venue: "NeurIPS", status: "reading",
      tags: ["scaling", "LLMs"],
      abstract: "For a fixed compute budget, model size and training tokens should scale equally.",
      methodology: "Over 400 models trained across 5M–500B tokens.",
      dataset: "MassiveText.",
      results: "Chinchilla (70B) outperforms Gopher (280B) trained with 4x more data.",
      limitations: "Assumes IsoFLOP curves generalize; specific to decoder-only.",
      keywords: ["compute-optimal", "chinchilla", "training data"],
    },
    {
      id: "p5", workspaceId: "w2",
      title: "Emergent Abilities of Large Language Models",
      authors: ["Wei et al."], year: 2022, venue: "TMLR", status: "unread",
      tags: ["emergence", "LLMs"],
      abstract: "Some abilities appear discontinuously at scale.",
      methodology: "Evaluate models across BIG-bench and other benchmarks.",
      dataset: "BIG-bench.",
      results: "Sharp transitions in performance for arithmetic, multi-step reasoning.",
      limitations: "Metric choice may create the appearance of emergence.",
      keywords: ["emergence", "phase transitions"],
    },
    {
      id: "p6", workspaceId: "w2",
      title: "Are Emergent Abilities a Mirage?",
      authors: ["Schaeffer et al."], year: 2023, venue: "NeurIPS", status: "unread",
      tags: ["emergence", "critique"],
      abstract: "Discontinuous metrics create the illusion of emergence; smooth metrics reveal predictable curves.",
      methodology: "Reanalyze BIG-bench with alternative continuous metrics.",
      dataset: "BIG-bench reanalysis.",
      results: "Most emergent abilities disappear under continuous metrics.",
      limitations: "Does not cover all reported emergent abilities.",
      keywords: ["metrics", "emergence", "critique"],
    },
    {
      id: "p7", workspaceId: "w3",
      title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP",
      authors: ["Lewis et al."], year: 2020, venue: "NeurIPS", status: "read",
      tags: ["RAG", "retrieval"],
      abstract: "Combine parametric and non-parametric memory via retrieval.",
      methodology: "Dense passage retrieval + seq2seq generator, jointly trained.",
      dataset: "Natural Questions, TriviaQA.",
      results: "State-of-the-art on open-domain QA.",
      limitations: "Retriever quality bounds generator performance.",
      keywords: ["RAG", "open-domain QA"],
    },
    {
      id: "p8", workspaceId: "w1",
      title: "Lost in the Middle: How Language Models Use Long Contexts",
      authors: ["Liu et al."], year: 2023, venue: "TACL", status: "reading",
      tags: ["long context", "evaluation"],
      abstract: "Performance degrades when relevant info is in the middle of a long context.",
      methodology: "Multi-document QA with position-controlled placement.",
      dataset: "NaturalQuestions-based multi-doc set.",
      results: "U-shaped performance curve across positions.",
      limitations: "English-only, specific to open-book QA.",
      keywords: ["long context", "position bias"],
    },
  ];

  for (const p of paperData) {
    await prisma.paper.upsert({
      where: { id: p.id },
      update: p,
      create: p,
    });
  }
  console.log(`✅ ${paperData.length} papers created`);

  // ── 4. Evidence Claims ──────────────────────────────────────────
  const claims = [
    {
      id: "ec1",
      workspaceId: "w2",
      paperId: "p5",
      question: "Do LLM abilities emerge discontinuously at specific compute thresholds?",
      stance: "supports",
      summary: "Performance on multi-step reasoning tasks transitions sharply from random to high accuracy past ~10^22 FLOPs.",
      paragraph: "Across BIG-bench benchmarks, tasks such as 3-digit addition and multi-step reasoning exhibit zero accuracy until a critical scale is reached, whereupon performance jumps discontinuously.",
      confidence: 0.88,
    },
    {
      id: "ec2",
      workspaceId: "w2",
      paperId: "p6",
      question: "Do LLM abilities emerge discontinuously at specific compute thresholds?",
      stance: "contradicts",
      summary: "Apparent emergent jumps disappear when nonlinear metrics (like exact match) are replaced with continuous metrics (like cross-entropy).",
      paragraph: "We demonstrate that emergent abilities are an artifact of nonlinear or discontinuous evaluation metrics rather than a property of the model's underlying representation.",
      confidence: 0.92,
    },
    {
      id: "ec3",
      workspaceId: "w1",
      paperId: "p2",
      question: "Can linear attention approximate standard softmax attention without loss of quality?",
      stance: "mixed",
      summary: "Linear attention achieves comparable perplexity on long-context tasks but degrades slightly on short-sequence classification.",
      paragraph: "Our kernel feature map reformulation maintains BLEU scores on translation benchmarks while scaling linearly in sequence length, though short classification tasks show a 1.2% drop.",
      confidence: 0.81,
    },
  ];

  for (const c of claims) {
    await prisma.evidenceClaim.upsert({
      where: { id: c.id },
      update: c,
      create: c,
    });
  }
  console.log(`✅ ${claims.length} evidence claims created`);

  // ── 5. Notes ────────────────────────────────────────────────────
  const notes = [
    {
      id: "n1",
      workspaceId: "w1",
      title: "Key trade-offs in linear vs standard attention",
      body: "Katharopoulos et al. demonstrate that kernel dot-product attention scales linearly O(N), but short sequences show minor accuracy drops. Need to benchmark against FlashAttention.",
      tags: ["attention", "efficiency"],
      paperIds: ["p1", "p2"],
    },
    {
      id: "n2",
      workspaceId: "w2",
      title: "Synthesis: Metric choices in emergence debate",
      body: "Wei et al. claim emergence; Schaeffer et al. show emergence is metric-dependent. The consensus appears to be that continuous loss scales smoothly, but discrete task accuracy jumps.",
      tags: ["scaling", "emergence"],
      paperIds: ["p5", "p6"],
    },
  ];

  for (const n of notes) {
    await prisma.note.upsert({
      where: { id: n.id },
      update: n,
      create: n,
    });
  }
  console.log(`✅ ${notes.length} notes created`);

  // ── 6. Conversations & Messages ────────────────────────────────
  const convs = [
    { id: "conv1", workspaceId: "w2", title: "Emergent abilities debate" },
    { id: "conv2", workspaceId: "w2", title: "Chinchilla optimality", group: "Scaling" },
    { id: "conv3", workspaceId: "w1", title: "Position bias analysis" },
  ];

  for (const c of convs) {
    await prisma.conversation.upsert({
      where: { id: c.id },
      update: c,
      create: c,
    });
  }

  const existingMessages = await prisma.chatMessage.count({
    where: { conversationId: "conv1" },
  });

  if (existingMessages === 0) {
    await prisma.chatMessage.createMany({
      data: [
        {
          conversationId: "conv1",
          role: "user",
          content: "Do the emergent-abilities papers actually agree with each other?",
        },
        {
          conversationId: "conv1",
          role: "assistant",
          content:
            "Not fully. Wei et al. (2022) report sharp transitions on several BIG-bench tasks, while Schaeffer et al. (2023) show these transitions disappear under continuous metrics. The disagreement is primarily methodological — different evaluation metrics, same underlying data.",
          sources: [
            { paperId: "p5", paragraph: "§3.1 — sharp transitions across benchmarks", confidence: 0.79 },
            { paperId: "p6", paragraph: "§4.2 — reanalysis under continuous metrics", confidence: 0.82 },
          ],
          followups: [
            "Which specific tasks disagree the most?",
            "How does Chinchilla scaling change this picture?",
            "Is there a task where all four papers agree?",
          ],
        },
      ],
    });
    console.log("✅ Chat messages created");
  }

  // ── 7. Datasets ─────────────────────────────────────────────────
  await prisma.dataset.upsert({
    where: { id: "db1" },
    update: {
      name: "Paper metadata export",
      fileKey: "demo/datasets/paper-metadata.csv",
      fileType: "csv",
      previewJson: {
        columns: ["id", "title", "year", "citations"],
        rows: [
          { id: "1", title: "Attention Is All You Need", year: "2017", citations: "98234" },
          { id: "2", title: "BERT: Pre-training of Deep...", year: "2018", citations: "76521" },
        ],
        totalRows: 2,
      },
    },
    create: {
      id: "db1",
      workspaceId: "w1",
      name: "Paper metadata export",
      fileKey: "demo/datasets/paper-metadata.csv",
      fileType: "csv",
      previewJson: {
        columns: ["id", "title", "year", "citations"],
        rows: [
          { id: "1", title: "Attention Is All You Need", year: "2017", citations: "98234" },
          { id: "2", title: "BERT: Pre-training of Deep...", year: "2018", citations: "76521" },
        ],
        totalRows: 2,
      },
    },
  });
  console.log("✅ Datasets created");

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });