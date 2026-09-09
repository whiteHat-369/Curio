import { prisma } from "./prisma.js";
import { deleteFile } from "./s3.js";

const UNDO_DELETION_MS = 30_000;
const BATCH_SIZE = 100;

export async function runCleanup() {
  const cutoff = new Date(Date.now() - UNDO_DELETION_MS);

  // The cutoff is rechecked inside each transaction to avoid purging a restored row.
  const papersToClean = await prisma.paper.findMany({
    where: {
      deletedAt: {
        lt: cutoff,
        not: null,
      },
    },
    orderBy: { deletedAt: "asc" },
    take: BATCH_SIZE,
  });

  const notesToClean = await prisma.note.findMany({
    where: { deletedAt: { lt: cutoff, not: null } },
    orderBy: { deletedAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true },
  });

  for (const paper of papersToClean) {
    try {
      // Delete the object before the database row becomes unreachable.
      if (paper.fileKey) {
        await deleteFile(paper.fileKey);
      }

      await prisma.$transaction(async (tx) => {
        const current = await tx.paper.findFirst({
          where: { id: paper.id, deletedAt: { lt: cutoff } },
          select: { id: true },
        });
        if (!current) return;

        // Delete all evidence claims referencing this paper
        await tx.evidenceClaim.deleteMany({
          where: { paperId: paper.id },
        });
        // Remove paper ID from the Note.paperIds string arrays in postgres
        await tx.$executeRaw`
          UPDATE "Note"
          SET "paperIds" = array_remove("paperIds", ${paper.id})
          WHERE ${paper.id} = ANY("paperIds")
        `;
        // Delete annotations associated with this paper
        await tx.annotation.deleteMany({
          where: { paperId: paper.id },
        });
        // Delete paper summary
        await tx.paperSummary.deleteMany({
          where: { paperId: paper.id },
        });
        // Finally hard delete the paper record
        await tx.paper.delete({
          where: { id: paper.id },
        });
      });
    } catch (err) {
      console.error(`[CLEANUP] Error during cleanup transaction for paper ${paper.id}:`, err);
    }
  }

  if (notesToClean.length > 0) {
    await prisma.note.deleteMany({
      where: {
        id: { in: notesToClean.map((note) => note.id) },
        deletedAt: { lt: cutoff },
      },
    });
  }
}

export function startCleanupWorker(intervalMs = 15_000) {
  console.log(`[CLEANUP] Starting background cleanup task running every ${intervalMs}ms.`);
  const timer = setInterval(async () => {
    try {
      await runCleanup();
    } catch (err) {
      console.error("[CLEANUP] Background cleanup worker encountered an error:", err);
    }
  }, intervalMs);

  // Allow process to exit cleanly if worker is the only active handle
  timer.unref();
  return timer;
}
