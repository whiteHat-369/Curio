import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { authHook, getUser } from "../../middleware/auth.js";
import { validate } from "../../lib/validation.js";
import { updateDatasetSchema } from "../../lib/validation.js";
import { NotFoundError, BadRequestError } from "../../lib/errors.js";
import { uploadFile, deleteFile, generateFileKey } from "../../lib/s3.js";
import { assertWorkspaceOwner } from "../../lib/workspace-access.js";

export async function datasetRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth & workspace ownership validation
  app.addHook("onRequest", authHook);
  app.addHook("onRequest", async (request) => {
    const user = getUser(request);
    const { wsId } = request.params as { wsId: string };
    if (wsId) {
      await assertWorkspaceOwner(wsId, user.userId);
    }
  });

  // ── List datasets ──────────────────────────────────────────────
  app.get("/", async (request, reply) => {
    const { wsId } = request.params as { wsId: string };

    const datasets = await prisma.dataset.findMany({
      where: { workspaceId: wsId },
      orderBy: { createdAt: "desc" },
    });

    return reply.send(datasets);
  });

  // ── Upload dataset ─────────────────────────────────────────────
  app.post("/upload", async (request, reply) => {
    const user = getUser(request);
    const { wsId } = request.params as { wsId: string };

    const file = await request.file();
    if (!file) {
      throw new BadRequestError("No file provided");
    }

    const ext = file.filename.split(".").pop()?.toLowerCase() ?? "";
    const validTypes = ["csv", "json", "parquet", "xlsx"];
    if (!validTypes.includes(ext)) {
      throw new BadRequestError(`Unsupported file type: .${ext}. Supported: ${validTypes.join(", ")}`);
    }

    const fileKey = generateFileKey(wsId, user.userId, file.filename);

    await uploadFile(fileKey, file.file, file.mimetype);

    const dataset = await prisma.dataset.create({
      data: {
        workspaceId: wsId,
        name: file.filename.replace(/\.[^/.]+$/, ""),
        fileKey,
        fileType: ext,
      },
    });

    return reply.status(201).send(dataset);
  });

  // ── Update dataset ─────────────────────────────────────────────
  app.patch("/:id", async (request, reply) => {
    const { wsId, id } = request.params as { wsId: string; id: string };
    const data = validate(updateDatasetSchema, request.body);

    const existing = await prisma.dataset.findFirst({
      where: { id, workspaceId: wsId },
    });
    if (!existing) {
      throw new NotFoundError("Dataset not found");
    }

    const dataset = await prisma.dataset.update({
      where: { id },
      data,
    });

    return reply.send(dataset);
  });

  // ── Delete dataset ─────────────────────────────────────────────
  app.delete("/:id", async (request, reply) => {
    const { wsId, id } = request.params as { wsId: string; id: string };

    const existing = await prisma.dataset.findFirst({
      where: { id, workspaceId: wsId },
    });
    if (!existing) {
      throw new NotFoundError("Dataset not found");
    }

    // Delete from object storage
    if (existing.fileKey) {
      await deleteFile(existing.fileKey);
    }

    await prisma.dataset.delete({ where: { id } });

    return reply.status(204).send();
  });

  // ── Get preview ────────────────────────────────────────────────
  app.get("/:id/preview", async (request, reply) => {
    const { wsId, id } = request.params as { wsId: string; id: string };

    const dataset = await prisma.dataset.findFirst({
      where: { id, workspaceId: wsId },
    });
    if (!dataset) {
      throw new NotFoundError("Dataset not found");
    }

    if (!dataset.previewJson) {
      throw new BadRequestError("Preview not available for this file type yet");
    }

    return reply.send(dataset.previewJson);
  });
}